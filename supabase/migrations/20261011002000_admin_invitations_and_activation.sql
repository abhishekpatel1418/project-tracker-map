-- =============================================================================
-- ROAD-TRACK — Admin Invitation & Account Activation Migration
-- Version: 20261011002000
-- Scope: admin_invitations table, RLS, create_admin_invitation RPC, activate_admin_invitation RPC
-- Safety: Preflight verification, idempotent, no destructive modifications
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. PREFLIGHT SAFETY CHECK
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'user_roles'
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT ERROR: public.user_roles table does not exist. Apply foundation migration first.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid 
    WHERE n.nspname = 'public' AND t.typname = 'app_role'
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT ERROR: public.app_role enum does not exist. Apply foundation migration first.';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 1. ADMIN INVITATIONS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_code text NOT NULL UNIQUE,
  email text NOT NULL,
  role public.app_role NOT NULL,
  department public.department_type,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  claimed_at timestamptz,
  claimed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT chk_invitation_code_length CHECK (length(trim(invitation_code)) >= 10),
  CONSTRAINT chk_invitation_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

CREATE INDEX IF NOT EXISTS idx_admin_invitations_code ON public.admin_invitations (invitation_code);
CREATE INDEX IF NOT EXISTS idx_admin_invitations_email ON public.admin_invitations (lower(trim(email)));
CREATE INDEX IF NOT EXISTS idx_admin_invitations_active ON public.admin_invitations (is_active, expires_at);

-- -----------------------------------------------------------------------------
-- 2. ROW LEVEL SECURITY (RLS)
-- -----------------------------------------------------------------------------
ALTER TABLE public.admin_invitations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.admin_invitations FROM PUBLIC, anon;
GRANT SELECT ON public.admin_invitations TO authenticated;

-- Only Central Admin can inspect or view invitation records
DROP POLICY IF EXISTS "Central Admins view invitations" ON public.admin_invitations;
CREATE POLICY "Central Admins view invitations" ON public.admin_invitations
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'central_admin'::public.app_role));

DROP POLICY IF EXISTS "Central Admins manage invitations" ON public.admin_invitations;
CREATE POLICY "Central Admins manage invitations" ON public.admin_invitations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'central_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'central_admin'::public.app_role));

-- -----------------------------------------------------------------------------
-- 3. SECURE RPC: CREATE ADMIN INVITATION (CENTRAL ADMIN ONLY)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_admin_invitation(
  p_email text,
  p_role text,
  p_expires_days integer DEFAULT 7
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _uid uuid := auth.uid();
  _role_enum public.app_role;
  _dept public.department_type;
  _code text;
  _now timestamptz := now();
  _expires_at timestamptz;
  _clean_email text;
  _date_str text;
  _random_str text;
  _chars text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  _i integer;
BEGIN
  -- Strict caller verification: Central Admin only
  IF _uid IS NULL OR NOT public.has_role(_uid, 'central_admin'::public.app_role) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'ACCESS_DENIED',
      'message', 'Only authorized Central Administrators may issue official admin invitations.'
    );
  END IF;

  _clean_email := lower(trim(COALESCE(p_email, '')));
  IF _clean_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_EMAIL',
      'message', 'Please provide a valid official email address.'
    );
  END IF;

  -- Validate role and map bound department
  BEGIN
    _role_enum := p_role::public.app_role;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_ROLE',
      'message', 'Invalid role specified. Must be central_admin, pwd_officer, nhai_officer, or pmgsy_officer.'
    );
  END;

  IF _role_enum = 'pwd_officer' THEN
    _dept := 'State PWD'::public.department_type;
  ELSIF _role_enum = 'nhai_officer' THEN
    _dept := 'NHAI'::public.department_type;
  ELSIF _role_enum = 'pmgsy_officer' THEN
    _dept := 'PMGSY'::public.department_type;
  ELSIF _role_enum = 'central_admin' THEN
    _dept := NULL;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'UNSUPPORTED_ROLE');
  END IF;

  IF p_expires_days IS NULL OR p_expires_days < 1 OR p_expires_days > 30 THEN
    p_expires_days := 7;
  END IF;
  _expires_at := _now + (p_expires_days || ' days')::interval;

  -- Generate unique high-entropy invitation code: RT-INV-YYMMDD-XXXXXXXX
  _date_str := to_char(_now, 'YYMMDD');
  LOOP
    _random_str := '';
    FOR _i IN 1..8 LOOP
      _random_str := _random_str || substr(_chars, floor(random() * length(_chars) + 1)::integer, 1);
    END LOOP;
    _code := 'RT-INV-' || _date_str || '-' || _random_str;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.admin_invitations WHERE invitation_code = _code);
  END LOOP;

  -- Deactivate previous unclaimed invitations for this email to prevent confusion
  UPDATE public.admin_invitations
  SET is_active = false
  WHERE lower(trim(email)) = _clean_email AND claimed_at IS NULL AND is_active = true;

  -- Insert new invitation
  INSERT INTO public.admin_invitations (
    invitation_code, email, role, department, created_by, created_at, expires_at, is_active
  ) VALUES (
    _code, _clean_email, _role_enum, _dept, _uid, _now, _expires_at, true
  );

  RETURN jsonb_build_object(
    'success', true,
    'invitation_code', _code,
    'email', _clean_email,
    'role', _role_enum,
    'department', _dept,
    'expires_at', _expires_at
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_admin_invitation(text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_admin_invitation(text, text, integer) TO authenticated;

-- -----------------------------------------------------------------------------
-- 4. SECURE RPC: ACTIVATE ADMIN INVITATION (AUTHENTICATED OFFICER)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.activate_admin_invitation(
  p_invitation_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _uid uuid := auth.uid();
  _caller_email text;
  _inv record;
  _clean_code text;
  _now timestamptz := now();
BEGIN
  -- Authentication guard: ID alone is not sufficient; caller must have an authenticated session
  IF _uid IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'AUTHENTICATION_REQUIRED',
      'message', 'You must sign in with your official account before redeeming an activation code.'
    );
  END IF;

  -- Get caller email securely from auth token / users table
  SELECT email INTO _caller_email FROM auth.users WHERE id = _uid;
  IF _caller_email IS NULL THEN
    _caller_email := auth.jwt() ->> 'email';
  END IF;
  _caller_email := lower(trim(COALESCE(_caller_email, '')));

  _clean_code := upper(trim(COALESCE(p_invitation_code, '')));
  IF length(_clean_code) < 10 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_CODE_FORMAT',
      'message', 'Please enter a valid official Admin Activation Code.'
    );
  END IF;

  -- Lock and fetch invitation to prevent concurrent double-claim races
  SELECT * INTO _inv
  FROM public.admin_invitations
  WHERE invitation_code = _clean_code
  FOR UPDATE;

  IF _inv.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVITATION_NOT_FOUND',
      'message', 'The activation code entered does not exist. Please check the code or contact Central Admin.'
    );
  END IF;

  IF NOT _inv.is_active OR _inv.claimed_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'ALREADY_ACTIVATED',
      'message', 'This activation code has already been claimed and cannot be reused.'
    );
  END IF;

  IF _inv.expires_at <= _now THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVITATION_EXPIRED',
      'message', 'This activation code has expired. Please request a new invitation from Central Admin.'
    );
  END IF;

  -- Verify recipient email matches authenticated caller
  IF lower(trim(_inv.email)) <> _caller_email THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'EMAIL_MISMATCH',
      'message', 'This invitation was issued to ' || _inv.email || '. Please sign in with that official email to activate.'
    );
  END IF;

  -- Atomically claim invitation
  UPDATE public.admin_invitations
  SET claimed_at = _now,
      claimed_by = _uid,
      is_active = false
  WHERE id = _inv.id;

  -- Assign the bound role strictly (no privilege self-escalation)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_uid, _inv.role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'role', _inv.role,
    'department', _inv.department,
    'email', _caller_email,
    'activated_at', _now,
    'message', 'Officer account successfully activated.'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.activate_admin_invitation(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.activate_admin_invitation(text) TO authenticated;

COMMIT;
