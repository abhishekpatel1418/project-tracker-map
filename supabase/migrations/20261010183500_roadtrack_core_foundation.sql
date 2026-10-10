-- =============================================================================
-- ROAD-TRACK — Core Database Foundation Migration
-- Version: 20261010183500
-- Scope: Schema, Tables, Constraints, Indexes, Functions, RPCs, RLS, Storage
-- Data: PURE DDL (NO FICTIONAL OR DEMO DATA INSERTED)
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. PREFLIGHT ENVIRONMENT & SAFETY VALIDATION
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  -- Verify existing user_roles table exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'user_roles'
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT ERROR: public.user_roles does not exist. Aborting to protect auth invariants.';
  END IF;

  -- Verify existing app_role enum exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid 
    WHERE n.nspname = 'public' AND t.typname = 'app_role'
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT ERROR: public.app_role enum does not exist. Aborting.';
  END IF;

  -- Verify existing has_role function exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' AND p.proname = 'has_role'
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT ERROR: public.has_role function does not exist. Aborting.';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 1. EXTENSIONS & TYPES
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'department_type') THEN
    CREATE TYPE public.department_type AS ENUM ('State PWD', 'NHAI', 'PMGSY');
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. HELPER FUNCTIONS: AUTHORIZATION & DEPARTMENT MAPPING
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_department_officer(_user_id uuid, _dept text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN _user_id IS NULL THEN false
    WHEN public.has_role(_user_id, 'central_admin'::public.app_role) THEN true
    WHEN _dept = 'State PWD' AND public.has_role(_user_id, 'pwd_officer'::public.app_role) THEN true
    WHEN _dept = 'NHAI' AND public.has_role(_user_id, 'nhai_officer'::public.app_role) THEN true
    WHEN _dept = 'PMGSY' AND public.has_role(_user_id, 'pmgsy_officer'::public.app_role) THEN true
    ELSE false
  END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_department_officer(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_department_officer(uuid, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 3. SERVER-SIDE CLIENT IDENTIFIER & RATE LIMITING
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.complaint_rate_limits (
  rate_key text PRIMARY KEY,
  attempt_count integer NOT NULL DEFAULT 1 CHECK (attempt_count >= 0),
  window_start timestamptz NOT NULL DEFAULT now(),
  last_attempt timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.complaint_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.complaint_rate_limits FROM PUBLIC, anon, authenticated;

-- Trusted helper to derive client identity without trusting caller-supplied tokens
CREATE OR REPLACE FUNCTION public.get_request_client_identifier()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _uid uuid := auth.uid();
  _headers jsonb;
  _ip text;
BEGIN
  -- 1. If authenticated, use verified JWT subject (cannot be spoofed)
  IF _uid IS NOT NULL THEN
    RETURN 'user:' || _uid::text;
  END IF;

  -- 2. Extract headers from PostgREST environment
  BEGIN
    _headers := current_setting('request.headers', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    _headers := NULL;
  END;

  -- Prefer Cloudflare edge header (cannot be spoofed from outside)
  _ip := _headers->>'cf-connecting-ip';
  IF _ip IS NULL OR length(trim(_ip)) = 0 THEN
    _ip := _headers->>'x-real-ip';
  END IF;

  -- Fall back to leftmost IP in x-forwarded-for if present
  IF _ip IS NULL OR length(trim(_ip)) = 0 THEN
    _ip := split_part(_headers->>'x-forwarded-for', ',', 1);
  END IF;

  _ip := trim(COALESCE(_ip, ''));

  -- Fail-closed flag if no client IP header exists in HTTP context
  IF length(_ip) = 0 THEN
    RETURN 'anon:unidentified';
  END IF;

  -- Hash the client IP to protect privacy in the rate-limit table and normalize format
  RETURN 'anon:ip:' || encode(digest(_ip, 'sha256'), 'hex');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_request_client_identifier() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.check_and_consume_rate_limit(
  p_key text,
  p_max_attempts integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _rec record;
  _now timestamptz := now();
BEGIN
  IF p_key IS NULL OR length(trim(p_key)) = 0 THEN
    RETURN false;
  END IF;

  -- Probabilistic purge (5% of requests) to prevent unbounded table growth
  IF random() < 0.05 THEN
    DELETE FROM public.complaint_rate_limits
    WHERE window_start < _now - interval '24 hours';
  END IF;

  SELECT rate_key, attempt_count, window_start INTO _rec
  FROM public.complaint_rate_limits
  WHERE rate_key = p_key
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.complaint_rate_limits (rate_key, attempt_count, window_start, last_attempt)
    VALUES (p_key, 1, _now, _now);
    RETURN true;
  END IF;

  -- Window expired: reset window
  IF _now - _rec.window_start > (p_window_seconds || ' seconds')::interval THEN
    UPDATE public.complaint_rate_limits
    SET attempt_count = 1, window_start = _now, last_attempt = _now
    WHERE rate_key = p_key;
    RETURN true;
  END IF;

  -- Within window: check limit
  IF _rec.attempt_count >= p_max_attempts THEN
    UPDATE public.complaint_rate_limits
    SET last_attempt = _now
    WHERE rate_key = p_key;
    RETURN false;
  END IF;

  -- Increment attempts
  UPDATE public.complaint_rate_limits
  SET attempt_count = _rec.attempt_count + 1, last_attempt = _now
  WHERE rate_key = p_key;
  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_and_consume_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. ROAD PROJECTS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.road_projects (
  id text PRIMARY KEY,
  name text NOT NULL CHECK (length(trim(name)) >= 3),
  department text NOT NULL CHECK (department IN ('State PWD', 'NHAI', 'PMGSY')),
  category text NOT NULL CHECK (length(trim(category)) >= 2),
  contractor text NOT NULL CHECK (length(trim(contractor)) >= 2),
  budget_lakh numeric NOT NULL CHECK (budget_lakh >= 0),
  spent_lakh numeric CHECK (spent_lakh IS NULL OR spent_lakh >= 0),
  sanction_date date NOT NULL,
  start_date date NOT NULL,
  target_date date NOT NULL,
  status text NOT NULL CHECK (status IN ('Sanctioned', 'In Progress', 'Stalled', 'Completed')),
  progress integer NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  verification text NOT NULL DEFAULT 'Awaiting Confirmation' CHECK (verification IN ('Officially Verified', 'Awaiting Confirmation', 'Unavailable')),
  district text NOT NULL CHECK (length(trim(district)) >= 2),
  length_km numeric NOT NULL CHECK (length_km > 0),
  lat double precision NOT NULL CHECK (lat BETWEEN -90.0 AND 90.0),
  lng double precision NOT NULL CHECK (lng BETWEEN -180.0 AND 180.0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_road_projects_dept_status ON public.road_projects (department, status);
CREATE INDEX IF NOT EXISTS idx_road_projects_district ON public.road_projects (district);

ALTER TABLE public.road_projects ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- ROAD PROJECTS DISCLOSURE POLICY:
-- Under the civic transparency charter of ROAD-TRACK (Section 4 proactive disclosure
-- for public infrastructure projects), contractor names, budget allocations, and
-- expenditures are intentionally readable by the public. Write operations (INSERT,
-- UPDATE, DELETE) remain strictly restricted to authorized department officials.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public read road projects" ON public.road_projects;
CREATE POLICY "Public read road projects" ON public.road_projects
  FOR SELECT TO PUBLIC USING (true);

DROP POLICY IF EXISTS "Officers insert own department projects" ON public.road_projects;
CREATE POLICY "Officers insert own department projects" ON public.road_projects
  FOR INSERT TO authenticated
  WITH CHECK (public.is_department_officer(auth.uid(), department));

DROP POLICY IF EXISTS "Officers update own department projects" ON public.road_projects;
CREATE POLICY "Officers update own department projects" ON public.road_projects
  FOR UPDATE TO authenticated
  USING (public.is_department_officer(auth.uid(), department))
  WITH CHECK (public.is_department_officer(auth.uid(), department));

DROP POLICY IF EXISTS "Central admin delete projects" ON public.road_projects;
CREATE POLICY "Central admin delete projects" ON public.road_projects
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'central_admin'::public.app_role));

-- -----------------------------------------------------------------------------
-- 5. COMPLAINTS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_id text UNIQUE NOT NULL,
  project_id text REFERENCES public.road_projects(id) ON DELETE SET NULL,
  department text NOT NULL CHECK (department IN ('State PWD', 'NHAI', 'PMGSY')),
  issue_type text NOT NULL CHECK (issue_type IN ('Pothole', 'Stalled Work', 'Incomplete Road', 'Poor Quality Road', 'Other')),
  description text NOT NULL CHECK (length(trim(description)) >= 10),
  location text NOT NULL CHECK (length(trim(location)) >= 3),
  lat double precision CHECK (lat IS NULL OR (lat BETWEEN -90.0 AND 90.0)),
  lng double precision CHECK (lng IS NULL OR (lng BETWEEN -180.0 AND 180.0)),
  photo_name text,
  video_name text,
  evidence_path text,
  status text NOT NULL DEFAULT 'Submitted' CHECK (status IN ('Submitted', 'Under Review', 'In Progress', 'Resolved')),
  severity text NOT NULL DEFAULT 'Medium' CHECK (severity IN ('Low', 'Medium', 'High', 'Critical')),
  upvote_count integer NOT NULL DEFAULT 0 CHECK (upvote_count >= 0),
  submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  citizen_contact text,
  assigned_officer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  internal_notes text,
  resolution_remarks text,
  public_resolution_summary text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_complaints_dept_status ON public.complaints (department, status);
CREATE INDEX IF NOT EXISTS idx_complaints_tracking_id ON public.complaints (tracking_id);
CREATE INDEX IF NOT EXISTS idx_complaints_submitted_by ON public.complaints (submitted_by);
CREATE INDEX IF NOT EXISTS idx_complaints_project_id ON public.complaints (project_id);

ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

-- Deny direct client table inserts, updates, deletes; all writes happen via audited RPCs
REVOKE INSERT, UPDATE, DELETE ON public.complaints FROM PUBLIC, anon, authenticated;

-- Read policies: department officers can view complaints in their jurisdiction; citizens can view their own
DROP POLICY IF EXISTS "Officers view department complaints" ON public.complaints;
CREATE POLICY "Officers view department complaints" ON public.complaints
  FOR SELECT TO authenticated
  USING (public.is_department_officer(auth.uid(), department));

DROP POLICY IF EXISTS "Citizens view own submitted complaints" ON public.complaints;
CREATE POLICY "Citizens view own submitted complaints" ON public.complaints
  FOR SELECT TO authenticated
  USING (auth.uid() = submitted_by);

-- -----------------------------------------------------------------------------
-- 6. COMPLAINT TIMELINE TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.complaint_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  old_status text CHECK (old_status IS NULL OR old_status IN ('Submitted', 'Under Review', 'In Progress', 'Resolved')),
  new_status text NOT NULL CHECK (new_status IN ('Submitted', 'Under Review', 'In Progress', 'Resolved')),
  public_note text NOT NULL CHECK (length(trim(public_note)) >= 3),
  internal_note text,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_complaint_timeline_complaint ON public.complaint_timeline (complaint_id, created_at);

ALTER TABLE public.complaint_timeline ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE ON public.complaint_timeline FROM PUBLIC, anon, authenticated;

-- Officers can view timeline entries for complaints in their jurisdiction
DROP POLICY IF EXISTS "Officers view department timeline" ON public.complaint_timeline;
CREATE POLICY "Officers view department timeline" ON public.complaint_timeline
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.complaints c 
      WHERE c.id = complaint_timeline.complaint_id 
        AND public.is_department_officer(auth.uid(), c.department)
    )
  );

-- Citizens can view timeline entries for their own complaints
DROP POLICY IF EXISTS "Citizens view own complaint timeline" ON public.complaint_timeline;
CREATE POLICY "Citizens view own complaint timeline" ON public.complaint_timeline
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.complaints c 
      WHERE c.id = complaint_timeline.complaint_id 
        AND c.submitted_by = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- 7. COMPLAINT VOTES TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.complaint_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (complaint_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_complaint_votes_complaint ON public.complaint_votes (complaint_id);
CREATE INDEX IF NOT EXISTS idx_complaint_votes_user ON public.complaint_votes (user_id);

ALTER TABLE public.complaint_votes ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE ON public.complaint_votes FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "Users read own votes" ON public.complaint_votes;
CREATE POLICY "Users read own votes" ON public.complaint_votes
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 8. COMPLAINT ACCESS AUDIT TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.complaint_access_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES public.complaints(id) ON DELETE RESTRICT,
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  action text NOT NULL,
  outcome text NOT NULL,
  accessed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_access_audit_complaint ON public.complaint_access_audit (complaint_id, accessed_at);
CREATE INDEX IF NOT EXISTS idx_access_audit_actor ON public.complaint_access_audit (actor_id, accessed_at);

ALTER TABLE public.complaint_access_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.complaint_access_audit FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "Deny direct audit access" ON public.complaint_access_audit;
CREATE POLICY "Deny direct audit access" ON public.complaint_access_audit
  FOR ALL TO PUBLIC USING (false);

-- -----------------------------------------------------------------------------
-- 9. SECURE RPC: CITIZEN / ANONYMOUS COMPLAINT SUBMISSION
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_complaint(
  p_department text,
  p_issue_type text,
  p_description text,
  p_location text,
  p_lat double precision DEFAULT NULL,
  p_lng double precision DEFAULT NULL,
  p_photo_name text DEFAULT NULL,
  p_video_name text DEFAULT NULL,
  p_evidence_path text DEFAULT NULL,
  p_project_id text DEFAULT NULL,
  p_citizen_contact text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _uid uuid := auth.uid();
  _client_id text;
  _rate_key text;
  _allowed boolean;
  _tracking_id text;
  _complaint_id uuid;
  _now timestamptz := now();
  _date_part text;
  _random_part text;
  _chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  _i integer;
BEGIN
  -- Rate limiting: Derive identity securely from server environment
  _client_id := public.get_request_client_identifier();

  -- If anonymous caller has no discernible origin header, fail closed:
  IF _uid IS NULL AND _client_id = 'anon:unidentified' THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'UNIDENTIFIED_ORIGIN', 
      'message', 'Unable to verify client origin. Please sign in to submit a complaint.'
    );
  END IF;

  _rate_key := 'submit_complaint:' || _client_id;
  _allowed := public.check_and_consume_rate_limit(_rate_key, 5, 3600);
  IF NOT _allowed THEN
    RETURN jsonb_build_object('success', false, 'error', 'RATE_LIMIT_EXCEEDED', 'message', 'Too many complaints submitted recently. Please try again later.');
  END IF;

  -- Validate inputs
  IF p_department NOT IN ('State PWD', 'NHAI', 'PMGSY') THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_DEPARTMENT');
  END IF;

  IF p_issue_type NOT IN ('Pothole', 'Stalled Work', 'Incomplete Road', 'Poor Quality Road', 'Other') THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_ISSUE_TYPE');
  END IF;

  IF length(trim(COALESCE(p_description, ''))) < 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'DESCRIPTION_TOO_SHORT');
  END IF;

  IF length(trim(COALESCE(p_location, ''))) < 3 THEN
    RETURN jsonb_build_object('success', false, 'error', 'LOCATION_TOO_SHORT');
  END IF;

  IF p_lat IS NOT NULL AND (p_lat < -90.0 OR p_lat > 90.0) THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_LATITUDE');
  END IF;

  IF p_lng IS NOT NULL AND (p_lng < -180.0 OR p_lng > 180.0) THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_LONGITUDE');
  END IF;

  -- Validate evidence path ownership and existence
  IF p_evidence_path IS NOT NULL AND length(trim(p_evidence_path)) > 0 THEN
    -- Anonymous callers cannot link private bucket storage
    IF _uid IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'ANONYMOUS_EVIDENCE_FORBIDDEN',
        'message', 'Evidence file attachments require an authenticated citizen account.'
      );
    -- Authenticated path must strictly begin with caller UUID folder
    ELSIF NOT (p_evidence_path LIKE _uid::text || '/%') THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'UNAUTHORIZED_EVIDENCE_PATH',
        'message', 'Evidence path must reside in your own user storage directory.'
      );
    -- File must actually exist in the complaint-evidence bucket
    ELSIF NOT EXISTS (
      SELECT 1 FROM storage.objects
      WHERE bucket_id = 'complaint-evidence'
        AND name = p_evidence_path
        AND (storage.foldername(name))[1] = _uid::text
    ) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'EVIDENCE_NOT_FOUND',
        'message', 'Referenced evidence file does not exist in the evidence storage bucket.'
      );
    END IF;
  ELSE
    p_evidence_path := NULL;
  END IF;

  -- Validate optional project reference
  IF p_project_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.road_projects WHERE id = p_project_id) THEN
    p_project_id := NULL;
  END IF;

  -- Generate unique tracking ID: RT-YYMMDD-XXXXX
  _date_part := to_char(_now, 'YYMMDD');
  LOOP
    _random_part := '';
    FOR _i IN 1..5 LOOP
      _random_part := _random_part || substr(_chars, floor(random() * length(_chars) + 1)::integer, 1);
    END LOOP;
    _tracking_id := 'RT-' || _date_part || '-' || _random_part;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.complaints WHERE tracking_id = _tracking_id);
  END LOOP;

  -- Insert complaint record
  INSERT INTO public.complaints (
    tracking_id, project_id, department, issue_type, description, location,
    lat, lng, photo_name, video_name, evidence_path, status, severity,
    upvote_count, submitted_by, citizen_contact, submitted_at, updated_at
  ) VALUES (
    _tracking_id, p_project_id, p_department, p_issue_type, trim(p_description), trim(p_location),
    p_lat, p_lng, p_photo_name, p_video_name, p_evidence_path, 'Submitted', 'Medium',
    0, _uid, trim(p_citizen_contact), _now, _now
  )
  RETURNING id INTO _complaint_id;

  -- Create initial timeline entry
  INSERT INTO public.complaint_timeline (
    complaint_id, old_status, new_status, public_note, changed_by, created_at
  ) VALUES (
    _complaint_id, NULL, 'Submitted', 'Complaint submitted by citizen and queued for review.', _uid, _now
  );

  RETURN jsonb_build_object(
    'success', true,
    'tracking_id', _tracking_id,
    'complaint_id', _complaint_id,
    'submitted_at', _now
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_complaint(text, text, text, text, double precision, double precision, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_complaint(text, text, text, text, double precision, double precision, text, text, text, text, text) TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- 10. SECURE RPC: PUBLIC COMPLAINT TRACKING BY TRACKING ID
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_complaint_by_tracking_id(
  p_tracking_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _client_id text;
  _rate_key text;
  _allowed boolean;
  _rec record;
  _timeline jsonb;
  _clean_id text;
BEGIN
  _clean_id := upper(trim(COALESCE(p_tracking_id, '')));
  IF length(_clean_id) < 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_TRACKING_ID');
  END IF;

  -- Anti-enumeration rate limit: Max 30 lookups per minute per client (derived server-side)
  _client_id := public.get_request_client_identifier();
  _rate_key := 'track_lookup:' || _client_id;
  _allowed := public.check_and_consume_rate_limit(_rate_key, 30, 60);
  IF NOT _allowed THEN
    RETURN jsonb_build_object('success', false, 'error', 'RATE_LIMIT_EXCEEDED', 'message', 'Too many tracking lookups. Please wait a moment.');
  END IF;

  -- Retrieve ONLY approved public columns
  SELECT id, tracking_id, department, issue_type, description, location, lat, lng,
         status, upvote_count, public_resolution_summary, submitted_at, updated_at
  INTO _rec
  FROM public.complaints
  WHERE tracking_id = _clean_id;

  IF _rec.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND');
  END IF;

  -- Retrieve timeline entries with ONLY public notes (internal notes never selected)
  SELECT jsonb_agg(to_jsonb(t) ORDER BY t.created_at ASC) INTO _timeline
  FROM (
    SELECT id, old_status, new_status, public_note, created_at
    FROM public.complaint_timeline
    WHERE complaint_id = _rec.id
  ) t;

  RETURN jsonb_build_object(
    'success', true,
    'data', to_jsonb(_rec),
    'timeline', COALESCE(_timeline, '[]'::jsonb)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_public_complaint_by_tracking_id(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_complaint_by_tracking_id(text) TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- 11. SECURE RPC: ATOMIC COMPLAINT UPVOTE TOGGLE
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.toggle_complaint_vote(
  p_complaint_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _uid uuid := auth.uid();
  _existing_vote_id uuid;
  _new_count integer;
  _has_voted boolean;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'AUTHENTICATION_REQUIRED', 'message', 'You must be signed in to vote on complaints.');
  END IF;

  -- Row lock to prevent race conditions
  PERFORM 1 FROM public.complaints WHERE id = p_complaint_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND');
  END IF;

  SELECT id INTO _existing_vote_id
  FROM public.complaint_votes
  WHERE complaint_id = p_complaint_id AND user_id = _uid;

  IF _existing_vote_id IS NOT NULL THEN
    DELETE FROM public.complaint_votes WHERE id = _existing_vote_id;
    UPDATE public.complaints 
    SET upvote_count = GREATEST(0, upvote_count - 1), updated_at = now()
    WHERE id = p_complaint_id
    RETURNING upvote_count INTO _new_count;
    _has_voted := false;
  ELSE
    INSERT INTO public.complaint_votes (complaint_id, user_id)
    VALUES (p_complaint_id, _uid);
    UPDATE public.complaints 
    SET upvote_count = upvote_count + 1, updated_at = now()
    WHERE id = p_complaint_id
    RETURNING upvote_count INTO _new_count;
    _has_voted := true;
  END IF;

  RETURN jsonb_build_object('success', true, 'has_voted', _has_voted, 'upvote_count', _new_count);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.toggle_complaint_vote(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.toggle_complaint_vote(uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- 12. SECURE RPC: AUDITED INVESTIGATION DETAILS FETCH
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_complaint_investigation_details(
  p_complaint_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _uid uuid := auth.uid();
  _dept text;
  _assigned uuid;
  _is_authorized boolean := false;
  _rec record;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED');
  END IF;

  SELECT department, assigned_officer_id INTO _dept, _assigned
  FROM public.complaints WHERE id = p_complaint_id;

  IF _dept IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND');
  END IF;

  -- Authorization check: Central Admin, Assigned Officer, or Department Officer
  IF public.has_role(_uid, 'central_admin'::public.app_role) OR _assigned = _uid THEN
    _is_authorized := true;
  ELSIF public.is_department_officer(_uid, _dept) THEN
    _is_authorized := true;
  END IF;

  -- Append audit entry (fails closed)
  INSERT INTO public.complaint_access_audit (complaint_id, actor_id, action, outcome)
  VALUES (p_complaint_id, _uid, 'READ_INVESTIGATION_DETAILS', CASE WHEN _is_authorized THEN 'ALLOWED' ELSE 'DENIED' END);

  IF NOT _is_authorized THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT id, tracking_id, department, citizen_contact, internal_notes, resolution_remarks, severity, evidence_path, assigned_officer_id
  INTO _rec
  FROM public.complaints
  WHERE id = p_complaint_id;

  RETURN jsonb_build_object('success', true, 'data', to_jsonb(_rec));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_complaint_investigation_details(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_complaint_investigation_details(uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- 13. SECURE RPC: OFFICER STATUS TRANSITION & ASSIGNMENT
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_complaint_status(
  p_complaint_id uuid,
  p_new_status text,
  p_public_note text,
  p_internal_note text DEFAULT NULL,
  p_assigned_officer_id uuid DEFAULT NULL,
  p_severity text DEFAULT NULL,
  p_public_resolution_summary text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _uid uuid := auth.uid();
  _current_dept text;
  _current_status text;
  _now timestamptz := now();
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED');
  END IF;

  IF p_new_status NOT IN ('Submitted', 'Under Review', 'In Progress', 'Resolved') THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_STATUS');
  END IF;

  IF length(trim(COALESCE(p_public_note, ''))) < 3 THEN
    RETURN jsonb_build_object('success', false, 'error', 'PUBLIC_NOTE_REQUIRED');
  END IF;

  -- Lock row and get current state
  SELECT department, status INTO _current_dept, _current_status
  FROM public.complaints
  WHERE id = p_complaint_id
  FOR UPDATE;

  IF _current_dept IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND');
  END IF;

  -- Verify department officer authorization
  IF NOT public.is_department_officer(_uid, _current_dept) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN');
  END IF;

  -- Enforce valid transition matrix
  IF _current_status = 'Submitted' AND p_new_status NOT IN ('Submitted', 'Under Review') THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_TRANSITION', 'message', 'Submitted complaint must move to Under Review first.');
  ELSIF _current_status = 'Under Review' AND p_new_status NOT IN ('Under Review', 'In Progress', 'Resolved') THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_TRANSITION');
  ELSIF _current_status = 'In Progress' AND p_new_status NOT IN ('In Progress', 'Resolved', 'Under Review') THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_TRANSITION');
  ELSIF _current_status = 'Resolved' AND p_new_status != 'Resolved' AND p_new_status != 'Under Review' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_TRANSITION', 'message', 'Resolved complaints can only be reopened to Under Review.');
  END IF;

  -- Resolution requires non-empty resolution summary
  IF p_new_status = 'Resolved' AND length(trim(COALESCE(p_public_resolution_summary, ''))) < 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'RESOLUTION_SUMMARY_REQUIRED', 'message', 'A public resolution summary is required when marking as Resolved.');
  END IF;

  -- Update complaint
  UPDATE public.complaints
  SET
    status = p_new_status,
    updated_at = _now,
    assigned_officer_id = COALESCE(p_assigned_officer_id, assigned_officer_id),
    severity = COALESCE(p_severity, severity),
    internal_notes = CASE WHEN p_internal_note IS NOT NULL THEN p_internal_note ELSE internal_notes END,
    public_resolution_summary = CASE WHEN p_new_status = 'Resolved' THEN trim(p_public_resolution_summary) ELSE public_resolution_summary END
  WHERE id = p_complaint_id;

  -- Record timeline entry
  INSERT INTO public.complaint_timeline (
    complaint_id, old_status, new_status, public_note, internal_note, changed_by, created_at
  ) VALUES (
    p_complaint_id, _current_status, p_new_status, trim(p_public_note), trim(p_internal_note), _uid, _now
  );

  RETURN jsonb_build_object('success', true, 'status', p_new_status, 'updated_at', _now);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_complaint_status(uuid, text, text, text, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_complaint_status(uuid, text, text, text, uuid, text, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 14. PRIVATE STORAGE BUCKET: complaint-evidence
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'complaint-evidence',
  'complaint-evidence',
  false,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'];

-- Storage Upload Policy (Authenticated users upload to their own user-id folder)
DROP POLICY IF EXISTS "Authenticated users upload evidence to user folder" ON storage.objects;
CREATE POLICY "Authenticated users upload evidence to user folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'complaint-evidence'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Storage Read Policy: Officers of department or uploading user
DROP POLICY IF EXISTS "Authorized read complaint evidence" ON storage.objects;
CREATE POLICY "Authorized read complaint evidence"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'complaint-evidence'
  AND (
    -- Central Admin
    public.has_role(auth.uid(), 'central_admin'::public.app_role)
    -- Uploader
    OR (storage.foldername(name))[1] = auth.uid()::text
    -- Department officer for complaints associated with this evidence path
    OR EXISTS (
      SELECT 1 FROM public.complaints c
      WHERE c.evidence_path = storage.objects.name
        AND public.is_department_officer(auth.uid(), c.department)
    )
  )
);

-- Storage Delete Policy: Authenticated users can delete unlinked evidence in their own folder (e.g. rollback on failed submit)
DROP POLICY IF EXISTS "Authenticated users delete own unlinked evidence" ON storage.objects;
CREATE POLICY "Authenticated users delete own unlinked evidence"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'complaint-evidence'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND NOT EXISTS (
    SELECT 1 FROM public.complaints c WHERE c.evidence_path = storage.objects.name
  )
);

COMMIT;
