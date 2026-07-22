export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      operation_events: {
        Row: {
          actor_id: string | null
          created_at: string
          description: string | null
          event_type: Database["public"]["Enums"]["operation_event_type"]
          id: string
          metadata: Json
          operation_state_id: string
          origin: Database["public"]["Enums"]["operation_event_origin"]
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          description?: string | null
          event_type: Database["public"]["Enums"]["operation_event_type"]
          id?: string
          metadata?: Json
          operation_state_id: string
          origin?: Database["public"]["Enums"]["operation_event_origin"]
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          description?: string | null
          event_type?: Database["public"]["Enums"]["operation_event_type"]
          id?: string
          metadata?: Json
          operation_state_id?: string
          origin?: Database["public"]["Enums"]["operation_event_origin"]
        }
        Relationships: [
          {
            foreignKeyName: "operation_events_operation_state_id_fkey"
            columns: ["operation_state_id"]
            isOneToOne: false
            referencedRelation: "operation_states"
            referencedColumns: ["id"]
          },
        ]
      }
      operation_notes: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          operation_state_id: string
        }
        Insert: {
          author_id?: string
          body: string
          created_at?: string
          id?: string
          operation_state_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          operation_state_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "operation_notes_operation_state_id_fkey"
            columns: ["operation_state_id"]
            isOneToOne: false
            referencedRelation: "operation_states"
            referencedColumns: ["id"]
          },
        ]
      }
      operation_states: {
        Row: {
          company_id: number | null
          created_at: string
          created_by: string
          erp_order_id: number
          erp_order_number: number | null
          id: string
          operation_date: string
          operational_date: string | null
          operational_status: Database["public"]["Enums"]["operational_status"]
          reschedule_reason: string | null
          sequence: number | null
          snapshot: Json
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          company_id?: number | null
          created_at?: string
          created_by?: string
          erp_order_id: number
          erp_order_number?: number | null
          id?: string
          operation_date: string
          operational_date?: string | null
          operational_status?: Database["public"]["Enums"]["operational_status"]
          reschedule_reason?: string | null
          sequence?: number | null
          snapshot?: Json
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          company_id?: number | null
          created_at?: string
          created_by?: string
          erp_order_id?: number
          erp_order_number?: number | null
          id?: string
          operation_date?: string
          operational_date?: string | null
          operational_status?: Database["public"]["Enums"]["operational_status"]
          reschedule_reason?: string | null
          sequence?: number | null
          snapshot?: Json
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: []
      }
      order_draft_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json
          new_status: Database["public"]["Enums"]["order_draft_status"] | null
          order_draft_id: string
          previous_status:
            | Database["public"]["Enums"]["order_draft_status"]
            | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          new_status?: Database["public"]["Enums"]["order_draft_status"] | null
          order_draft_id: string
          previous_status?:
            | Database["public"]["Enums"]["order_draft_status"]
            | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          new_status?: Database["public"]["Enums"]["order_draft_status"] | null
          order_draft_id?: string
          previous_status?:
            | Database["public"]["Enums"]["order_draft_status"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "order_draft_events_order_draft_id_fkey"
            columns: ["order_draft_id"]
            isOneToOne: false
            referencedRelation: "order_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      order_drafts: {
        Row: {
          company_id: number | null
          created_at: string
          created_by: string
          customer_name_snapshot: string | null
          erp_order_id: number | null
          erp_order_number: number | null
          id: string
          idempotency_key: string
          last_send_error: string | null
          payload: Json
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          send_attempts: number
          sent_at: string | null
          status: Database["public"]["Enums"]["order_draft_status"]
          title: string | null
          updated_at: string
          updated_by: string
        }
        Insert: {
          company_id?: number | null
          created_at?: string
          created_by: string
          customer_name_snapshot?: string | null
          erp_order_id?: number | null
          erp_order_number?: number | null
          id?: string
          idempotency_key?: string
          last_send_error?: string | null
          payload?: Json
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          send_attempts?: number
          sent_at?: string | null
          status?: Database["public"]["Enums"]["order_draft_status"]
          title?: string | null
          updated_at?: string
          updated_by: string
        }
        Update: {
          company_id?: number | null
          created_at?: string
          created_by?: string
          customer_name_snapshot?: string | null
          erp_order_id?: number | null
          erp_order_number?: number | null
          id?: string
          idempotency_key?: string
          last_send_error?: string | null
          payload?: Json
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          send_attempts?: number
          sent_at?: string | null
          status?: Database["public"]["Enums"]["order_draft_status"]
          title?: string | null
          updated_at?: string
          updated_by?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          full_name: string
          id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          full_name: string
          id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          full_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_company_access: {
        Row: {
          company_id: number
          created_at: string
          created_by: string | null
          user_id: string
        }
        Insert: {
          company_id: number
          created_at?: string
          created_by?: string | null
          user_id: string
        }
        Update: {
          company_id?: number
          created_at?: string
          created_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_operation_status: {
        Args: {
          _expected_version: number
          _new_status: Database["public"]["Enums"]["operational_status"]
          _reason?: string
          _state_id: string
        }
        Returns: {
          company_id: number | null
          created_at: string
          created_by: string
          erp_order_id: number
          erp_order_number: number | null
          id: string
          operation_date: string
          operational_date: string | null
          operational_status: Database["public"]["Enums"]["operational_status"]
          reschedule_reason: string | null
          sequence: number | null
          snapshot: Json
          updated_at: string
          updated_by: string | null
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "operation_states"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_company_access: {
        Args: { _company_id: number; _uid: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      reschedule_operation: {
        Args: {
          _expected_version: number
          _new_date: string
          _reason: string
          _state_id: string
        }
        Returns: {
          company_id: number | null
          created_at: string
          created_by: string
          erp_order_id: number
          erp_order_number: number | null
          id: string
          operation_date: string
          operational_date: string | null
          operational_status: Database["public"]["Enums"]["operational_status"]
          reschedule_reason: string | null
          sequence: number | null
          snapshot: Json
          updated_at: string
          updated_by: string | null
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "operation_states"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_order_draft_status: {
        Args: {
          _draft_id: string
          _new_status: Database["public"]["Enums"]["order_draft_status"]
          _reason?: string
        }
        Returns: {
          company_id: number | null
          created_at: string
          created_by: string
          customer_name_snapshot: string | null
          erp_order_id: number | null
          erp_order_number: number | null
          id: string
          idempotency_key: string
          last_send_error: string | null
          payload: Json
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          send_attempts: number
          sent_at: string | null
          status: Database["public"]["Enums"]["order_draft_status"]
          title: string | null
          updated_at: string
          updated_by: string
        }
        SetofOptions: {
          from: "*"
          to: "order_drafts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "admin" | "vendedor" | "aprovador"
      operation_event_origin: "local" | "erp"
      operation_event_type:
        | "loaded"
        | "started"
        | "note_added"
        | "rescheduled"
        | "customer_will_call"
        | "delivered"
        | "collected"
        | "not_found"
        | "corrected"
      operational_status:
        | "pending"
        | "in_progress"
        | "delivered"
        | "collected"
        | "customer_will_call"
        | "not_found"
        | "rescheduled"
      order_draft_status:
        | "draft"
        | "pending_approval"
        | "approved"
        | "rejected"
        | "sending"
        | "sent"
        | "send_failed"
        | "cancelled"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["admin", "vendedor", "aprovador"],
      operation_event_origin: ["local", "erp"],
      operation_event_type: [
        "loaded",
        "started",
        "note_added",
        "rescheduled",
        "customer_will_call",
        "delivered",
        "collected",
        "not_found",
        "corrected",
      ],
      operational_status: [
        "pending",
        "in_progress",
        "delivered",
        "collected",
        "customer_will_call",
        "not_found",
        "rescheduled",
      ],
      order_draft_status: [
        "draft",
        "pending_approval",
        "approved",
        "rejected",
        "sending",
        "sent",
        "send_failed",
        "cancelled",
      ],
    },
  },
} as const
