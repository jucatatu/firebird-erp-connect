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
      app_settings: {
        Row: {
          created_at: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          created_at?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          created_at?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
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
          delivered_at: string | null
          delivered_by: string | null
          delivery_assigned_at: string | null
          delivery_assigned_by: string | null
          delivery_assignee_id: string | null
          erp_order_id: number
          erp_order_number: number | null
          has_returnable_equipment: boolean
          id: string
          operation_date: string
          operational_date: string | null
          operational_status: Database["public"]["Enums"]["operational_status"]
          pickup_assigned_at: string | null
          pickup_assigned_by: string | null
          pickup_assignee_id: string | null
          pickup_completed_at: string | null
          pickup_completed_by: string | null
          pickup_note: string | null
          pickup_scheduled_date: string | null
          pickup_scheduled_time: string | null
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
          delivered_at?: string | null
          delivered_by?: string | null
          delivery_assigned_at?: string | null
          delivery_assigned_by?: string | null
          delivery_assignee_id?: string | null
          erp_order_id: number
          erp_order_number?: number | null
          has_returnable_equipment?: boolean
          id?: string
          operation_date: string
          operational_date?: string | null
          operational_status?: Database["public"]["Enums"]["operational_status"]
          pickup_assigned_at?: string | null
          pickup_assigned_by?: string | null
          pickup_assignee_id?: string | null
          pickup_completed_at?: string | null
          pickup_completed_by?: string | null
          pickup_note?: string | null
          pickup_scheduled_date?: string | null
          pickup_scheduled_time?: string | null
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
          delivered_at?: string | null
          delivered_by?: string | null
          delivery_assigned_at?: string | null
          delivery_assigned_by?: string | null
          delivery_assignee_id?: string | null
          erp_order_id?: number
          erp_order_number?: number | null
          has_returnable_equipment?: boolean
          id?: string
          operation_date?: string
          operational_date?: string | null
          operational_status?: Database["public"]["Enums"]["operational_status"]
          pickup_assigned_at?: string | null
          pickup_assigned_by?: string | null
          pickup_assignee_id?: string | null
          pickup_completed_at?: string | null
          pickup_completed_by?: string | null
          pickup_note?: string | null
          pickup_scheduled_date?: string | null
          pickup_scheduled_time?: string | null
          reschedule_reason?: string | null
          sequence?: number | null
          snapshot?: Json
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "operation_states_delivery_assignee_id_fkey"
            columns: ["delivery_assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operation_states_pickup_assignee_id_fkey"
            columns: ["pickup_assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_catalog_setting_events: {
        Row: {
          actor_id: string | null
          created_at: string
          erp_item_id: number
          event_type: Database["public"]["Enums"]["catalog_event_type"]
          id: string
          item_type: Database["public"]["Enums"]["catalog_item_type"]
          new_value: Json | null
          previous_value: Json | null
          setting_id: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          erp_item_id: number
          event_type: Database["public"]["Enums"]["catalog_event_type"]
          id?: string
          item_type: Database["public"]["Enums"]["catalog_item_type"]
          new_value?: Json | null
          previous_value?: Json | null
          setting_id?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          erp_item_id?: number
          event_type?: Database["public"]["Enums"]["catalog_event_type"]
          id?: string
          item_type?: Database["public"]["Enums"]["catalog_item_type"]
          new_value?: Json | null
          previous_value?: Json | null
          setting_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_catalog_setting_events_setting_id_fkey"
            columns: ["setting_id"]
            isOneToOne: false
            referencedRelation: "order_catalog_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      order_catalog_settings: {
        Row: {
          company_ids: number[]
          created_at: string
          created_by: string | null
          default_quantity: number
          display_name: string | null
          enabled: boolean
          erp_description_snapshot: string
          erp_item_id: number
          id: string
          item_type: Database["public"]["Enums"]["catalog_item_type"]
          quantity_step: number
          requires_pickup: boolean | null
          sort_order: number
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          company_ids?: number[]
          created_at?: string
          created_by?: string | null
          default_quantity?: number
          display_name?: string | null
          enabled?: boolean
          erp_description_snapshot: string
          erp_item_id: number
          id?: string
          item_type: Database["public"]["Enums"]["catalog_item_type"]
          quantity_step?: number
          requires_pickup?: boolean | null
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          company_ids?: number[]
          created_at?: string
          created_by?: string | null
          default_quantity?: number
          display_name?: string | null
          enabled?: boolean
          erp_description_snapshot?: string
          erp_item_id?: number
          id?: string
          item_type?: Database["public"]["Enums"]["catalog_item_type"]
          quantity_step?: number
          requires_pickup?: boolean | null
          sort_order?: number
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
          delivered_at: string | null
          delivered_by: string | null
          delivery_assigned_at: string | null
          delivery_assigned_by: string | null
          delivery_assignee_id: string | null
          erp_order_id: number
          erp_order_number: number | null
          has_returnable_equipment: boolean
          id: string
          operation_date: string
          operational_date: string | null
          operational_status: Database["public"]["Enums"]["operational_status"]
          pickup_assigned_at: string | null
          pickup_assigned_by: string | null
          pickup_assignee_id: string | null
          pickup_completed_at: string | null
          pickup_completed_by: string | null
          pickup_note: string | null
          pickup_scheduled_date: string | null
          pickup_scheduled_time: string | null
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
      apply_operation_transition: {
        Args: {
          _action: string
          _expected_version: number
          _payload?: Json
          _state_id: string
        }
        Returns: {
          company_id: number | null
          created_at: string
          created_by: string
          delivered_at: string | null
          delivered_by: string | null
          delivery_assigned_at: string | null
          delivery_assigned_by: string | null
          delivery_assignee_id: string | null
          erp_order_id: number
          erp_order_number: number | null
          has_returnable_equipment: boolean
          id: string
          operation_date: string
          operational_date: string | null
          operational_status: Database["public"]["Enums"]["operational_status"]
          pickup_assigned_at: string | null
          pickup_assigned_by: string | null
          pickup_assignee_id: string | null
          pickup_completed_at: string | null
          pickup_completed_by: string | null
          pickup_note: string | null
          pickup_scheduled_date: string | null
          pickup_scheduled_time: string | null
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
      assign_operation_operator: {
        Args: {
          _expected_version: number
          _role: string
          _state_id: string
          _user_id: string
        }
        Returns: {
          company_id: number | null
          created_at: string
          created_by: string
          delivered_at: string | null
          delivered_by: string | null
          delivery_assigned_at: string | null
          delivery_assigned_by: string | null
          delivery_assignee_id: string | null
          erp_order_id: number
          erp_order_number: number | null
          has_returnable_equipment: boolean
          id: string
          operation_date: string
          operational_date: string | null
          operational_status: Database["public"]["Enums"]["operational_status"]
          pickup_assigned_at: string | null
          pickup_assigned_by: string | null
          pickup_assignee_id: string | null
          pickup_completed_at: string | null
          pickup_completed_by: string | null
          pickup_note: string | null
          pickup_scheduled_date: string | null
          pickup_scheduled_time: string | null
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
          delivered_at: string | null
          delivered_by: string | null
          delivery_assigned_at: string | null
          delivery_assigned_by: string | null
          delivery_assignee_id: string | null
          erp_order_id: number
          erp_order_number: number | null
          has_returnable_equipment: boolean
          id: string
          operation_date: string
          operational_date: string | null
          operational_status: Database["public"]["Enums"]["operational_status"]
          pickup_assigned_at: string | null
          pickup_assigned_by: string | null
          pickup_assignee_id: string | null
          pickup_completed_at: string | null
          pickup_completed_by: string | null
          pickup_note: string | null
          pickup_scheduled_date: string | null
          pickup_scheduled_time: string | null
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
      upsert_order_catalog_setting: {
        Args: {
          _company_ids: number[]
          _default_quantity: number
          _display_name?: string
          _enabled: boolean
          _erp_description_snapshot: string
          _erp_item_id: number
          _expected_version?: number
          _item_type: Database["public"]["Enums"]["catalog_item_type"]
          _quantity_step: number
          _requires_pickup?: boolean
          _sort_order: number
        }
        Returns: {
          company_ids: number[]
          created_at: string
          created_by: string | null
          default_quantity: number
          display_name: string | null
          enabled: boolean
          erp_description_snapshot: string
          erp_item_id: number
          id: string
          item_type: Database["public"]["Enums"]["catalog_item_type"]
          quantity_step: number
          requires_pickup: boolean | null
          sort_order: number
          updated_at: string
          updated_by: string | null
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "order_catalog_settings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "admin" | "vendedor" | "aprovador"
      catalog_event_type:
        | "created"
        | "enabled"
        | "disabled"
        | "updated"
        | "snapshot_updated"
      catalog_item_type: "product" | "equipment"
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
        | "delivery_assigned"
        | "delivery_assignee_changed"
        | "delivery_started"
        | "delivery_confirmed"
        | "delivery_customer_not_found"
        | "delivery_rescheduled"
        | "customer_will_contact"
        | "pickup_scheduled"
        | "pickup_rescheduled"
        | "pickup_assigned"
        | "pickup_assignee_changed"
        | "pickup_started"
        | "pickup_customer_not_found"
        | "pickup_confirmed"
        | "operation_completed"
      operational_status:
        | "pending"
        | "in_progress"
        | "delivered"
        | "collected"
        | "customer_will_call"
        | "not_found"
        | "rescheduled"
        | "awaiting_pickup_definition"
        | "awaiting_customer_contact"
        | "pickup_scheduled"
        | "pickup_in_progress"
        | "pickup_completed"
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
      catalog_event_type: [
        "created",
        "enabled",
        "disabled",
        "updated",
        "snapshot_updated",
      ],
      catalog_item_type: ["product", "equipment"],
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
        "delivery_assigned",
        "delivery_assignee_changed",
        "delivery_started",
        "delivery_confirmed",
        "delivery_customer_not_found",
        "delivery_rescheduled",
        "customer_will_contact",
        "pickup_scheduled",
        "pickup_rescheduled",
        "pickup_assigned",
        "pickup_assignee_changed",
        "pickup_started",
        "pickup_customer_not_found",
        "pickup_confirmed",
        "operation_completed",
      ],
      operational_status: [
        "pending",
        "in_progress",
        "delivered",
        "collected",
        "customer_will_call",
        "not_found",
        "rescheduled",
        "awaiting_pickup_definition",
        "awaiting_customer_contact",
        "pickup_scheduled",
        "pickup_in_progress",
        "pickup_completed",
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
