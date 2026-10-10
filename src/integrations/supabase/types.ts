export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      admin_invitations: {
        Row: {
          id: string
          invitation_code: string
          email: string
          role: Database["public"]["Enums"]["app_role"]
          department: Database["public"]["Enums"]["department_type"] | null
          created_by: string | null
          created_at: string
          expires_at: string
          claimed_at: string | null
          claimed_by: string | null
          is_active: boolean
        }
        Insert: {
          id?: string
          invitation_code: string
          email: string
          role: Database["public"]["Enums"]["app_role"]
          department?: Database["public"]["Enums"]["department_type"] | null
          created_by?: string | null
          created_at?: string
          expires_at: string
          claimed_at?: string | null
          claimed_by?: string | null
          is_active?: boolean
        }
        Update: {
          id?: string
          invitation_code?: string
          email?: string
          role?: Database["public"]["Enums"]["app_role"]
          department?: Database["public"]["Enums"]["department_type"] | null
          created_by?: string | null
          created_at?: string
          expires_at?: string
          claimed_at?: string | null
          claimed_by?: string | null
          is_active?: boolean
        }
        Relationships: []
      }
      road_projects: {
        Row: {
          id: string
          name: string
          department: Database["public"]["Enums"]["department_type"]
          category: string
          contractor: string
          budget_lakh: number
          spent_lakh: number | null
          sanction_date: string
          start_date: string
          target_date: string
          status: "Sanctioned" | "In Progress" | "Stalled" | "Completed"
          progress: number
          verification: "Officially Verified" | "Awaiting Confirmation" | "Unavailable"
          district: string
          length_km: number
          lat: number
          lng: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          name: string
          department: Database["public"]["Enums"]["department_type"]
          category: string
          contractor: string
          budget_lakh: number
          spent_lakh?: number | null
          sanction_date: string
          start_date: string
          target_date: string
          status: "Sanctioned" | "In Progress" | "Stalled" | "Completed"
          progress?: number
          verification?: "Officially Verified" | "Awaiting Confirmation" | "Unavailable"
          district: string
          length_km: number
          lat: number
          lng: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          department?: Database["public"]["Enums"]["department_type"]
          category?: string
          contractor?: string
          budget_lakh?: number
          spent_lakh?: number | null
          sanction_date?: string
          start_date?: string
          target_date?: string
          status?: "Sanctioned" | "In Progress" | "Stalled" | "Completed"
          progress?: number
          verification?: "Officially Verified" | "Awaiting Confirmation" | "Unavailable"
          district?: string
          length_km?: number
          lat?: number
          lng?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      complaints: {
        Row: {
          id: string
          tracking_id: string
          project_id: string | null
          department: Database["public"]["Enums"]["department_type"]
          issue_type: "Pothole" | "Stalled Work" | "Incomplete Road" | "Poor Quality Road" | "Other"
          description: string
          location: string
          lat: number | null
          lng: number | null
          photo_name: string | null
          video_name: string | null
          evidence_path: string | null
          status: "Submitted" | "Under Review" | "In Progress" | "Resolved"
          severity: "Low" | "Medium" | "High" | "Critical"
          upvote_count: number
          submitted_by: string | null
          citizen_contact: string | null
          assigned_officer_id: string | null
          internal_notes: string | null
          resolution_remarks: string | null
          public_resolution_summary: string | null
          submitted_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tracking_id: string
          project_id?: string | null
          department: Database["public"]["Enums"]["department_type"]
          issue_type: "Pothole" | "Stalled Work" | "Incomplete Road" | "Poor Quality Road" | "Other"
          description: string
          location: string
          lat?: number | null
          lng?: number | null
          photo_name?: string | null
          video_name?: string | null
          evidence_path?: string | null
          status?: "Submitted" | "Under Review" | "In Progress" | "Resolved"
          severity?: "Low" | "Medium" | "High" | "Critical"
          upvote_count?: number
          submitted_by?: string | null
          citizen_contact?: string | null
          assigned_officer_id?: string | null
          internal_notes?: string | null
          resolution_remarks?: string | null
          public_resolution_summary?: string | null
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tracking_id?: string
          project_id?: string | null
          department?: Database["public"]["Enums"]["department_type"]
          issue_type?: "Pothole" | "Stalled Work" | "Incomplete Road" | "Poor Quality Road" | "Other"
          description?: string
          location?: string
          lat?: number | null
          lng?: number | null
          photo_name?: string | null
          video_name?: string | null
          evidence_path?: string | null
          status?: "Submitted" | "Under Review" | "In Progress" | "Resolved"
          severity?: "Low" | "Medium" | "High" | "Critical"
          upvote_count?: number
          submitted_by?: string | null
          citizen_contact?: string | null
          assigned_officer_id?: string | null
          internal_notes?: string | null
          resolution_remarks?: string | null
          public_resolution_summary?: string | null
          submitted_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaints_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "road_projects"
            referencedColumns: ["id"]
          }
        ]
      }
      complaint_timeline: {
        Row: {
          id: string
          complaint_id: string
          old_status: string | null
          new_status: string
          public_note: string
          internal_note: string | null
          changed_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          complaint_id: string
          old_status?: string | null
          new_status: string
          public_note: string
          internal_note?: string | null
          changed_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          complaint_id?: string
          old_status?: string | null
          new_status?: string
          public_note?: string
          internal_note?: string | null
          changed_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaint_timeline_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          }
        ]
      }
      complaint_votes: {
        Row: {
          id: string
          complaint_id: string
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          complaint_id: string
          user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          complaint_id?: string
          user_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaint_votes_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          }
        ]
      }
      complaint_access_audit: {
        Row: {
          id: string
          complaint_id: string
          actor_id: string
          action: string
          outcome: string
          accessed_at: string
        }
        Insert: {
          id?: string
          complaint_id: string
          actor_id: string
          action: string
          outcome: string
          accessed_at?: string
        }
        Update: {
          id?: string
          complaint_id?: string
          actor_id?: string
          action?: string
          outcome?: string
          accessed_at?: string
        }
        Relationships: []
      }
      complaint_rate_limits: {
        Row: {
          rate_key: string
          attempt_count: number
          window_start: string
          last_attempt: string
        }
        Insert: {
          rate_key: string
          attempt_count?: number
          window_start?: string
          last_attempt?: string
        }
        Update: {
          rate_key?: string
          attempt_count?: number
          window_start?: string
          last_attempt?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_department_officer: {
        Args: {
          _dept: string
          _user_id: string
        }
        Returns: boolean
      }
      submit_complaint: {
        Args: {
          p_citizen_contact?: string | null
          p_department: string
          p_description: string
          p_evidence_path?: string | null
          p_issue_type: string
          p_lat?: number | null
          p_lng?: number | null
          p_location: string
          p_photo_name?: string | null
          p_project_id?: string | null
          p_video_name?: string | null
        }
        Returns: Json
      }
      get_public_complaint_by_tracking_id: {
        Args: {
          p_tracking_id: string
        }
        Returns: Json
      }
      toggle_complaint_vote: {
        Args: {
          p_complaint_id: string
        }
        Returns: Json
      }
      get_complaint_investigation_details: {
        Args: {
          p_complaint_id: string
        }
        Returns: Json
      }
      update_complaint_status: {
        Args: {
          p_assigned_officer_id?: string | null
          p_complaint_id: string
          p_internal_note?: string | null
          p_new_status: string
          p_public_note: string
          p_public_resolution_summary?: string | null
          p_severity?: string | null
        }
        Returns: Json
      }
      create_admin_invitation: {
        Args: {
          p_email: string
          p_role: string
          p_expires_days?: number
        }
        Returns: Json
      }
      activate_admin_invitation: {
        Args: {
          p_invitation_code: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role:
        | "central_admin"
        | "pwd_officer"
        | "nhai_officer"
        | "pmgsy_officer"
      department_type:
        | "State PWD"
        | "NHAI"
        | "PMGSY"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "central_admin",
        "pwd_officer",
        "nhai_officer",
        "pmgsy_officer",
      ],
      department_type: [
        "State PWD",
        "NHAI",
        "PMGSY",
      ],
    },
  },
} as const
