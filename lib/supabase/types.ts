export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type ProfileRole = 'owner' | 'member'
export type TaskType = 'daily' | 'one_time'
export type SubmissionStatus = 'pending' | 'approved' | 'rejected'
export type RewardRedemptionStatus = 'requested' | 'fulfilled'
export type PointReason = 'task_approved' | 'reward_redeemed' | 'manual_adjustment'
export type PairRequestStatus = 'pending' | 'accepted' | 'rejected' | 'canceled'

export type Database = {
  public: {
    Tables: {
      allowed_users: {
        Row: {
          active: boolean
          created_at: string
          display_name: string | null
          email: string
          id: string
          invited_by: string | null
          role: ProfileRole
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_name?: string | null
          email: string
          id?: string
          invited_by?: string | null
          role?: ProfileRole
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          invited_by?: string | null
          role?: ProfileRole
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'allowed_users_invited_by_fkey'
            columns: ['invited_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      point_transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          note: string
          pair_id: string
          profile_id: string
          reason: PointReason
          reward_redemption_id: string | null
          submission_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          note: string
          pair_id?: string
          profile_id: string
          reason: PointReason
          reward_redemption_id?: string | null
          submission_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          note?: string
          pair_id?: string
          profile_id?: string
          reason?: PointReason
          reward_redemption_id?: string | null
          submission_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'point_transactions_profile_id_fkey'
            columns: ['profile_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'point_transactions_reward_redemption_id_fkey'
            columns: ['reward_redemption_id']
            isOneToOne: false
            referencedRelation: 'reward_redemptions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'point_transactions_submission_id_fkey'
            columns: ['submission_id']
            isOneToOne: false
            referencedRelation: 'task_submissions'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          auth_user_id: string
          created_at: string
          display_name: string | null
          email: string
          id: string
          invite_code: string | null
          role: ProfileRole
          updated_at: string
        }
        Insert: {
          active?: boolean
          auth_user_id: string
          created_at?: string
          display_name?: string | null
          email: string
          id?: string
          invite_code?: string | null
          role: ProfileRole
          updated_at?: string
        }
        Update: {
          active?: boolean
          auth_user_id?: string
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          invite_code?: string | null
          role?: ProfileRole
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          profile_id: string
          subscription: Json
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          profile_id: string
          subscription: Json
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          profile_id?: string
          subscription?: Json
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'push_subscriptions_profile_id_fkey'
            columns: ['profile_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      pairs: {
        Row: {
          active: boolean
          created_at: string
          created_by_profile_id: string
          id: string
          invite_code: string
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by_profile_id: string
          id?: string
          invite_code: string
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by_profile_id?: string
          id?: string
          invite_code?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: 'pairs_created_by_profile_id_fkey'
            columns: ['created_by_profile_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      pair_members: {
        Row: {
          created_at: string
          id: string
          pair_id: string
          partner_nickname: string | null
          profile_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pair_id: string
          partner_nickname?: string | null
          profile_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pair_id?: string
          partner_nickname?: string | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'pair_members_pair_id_fkey'
            columns: ['pair_id']
            isOneToOne: false
            referencedRelation: 'pairs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'pair_members_profile_id_fkey'
            columns: ['profile_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      pair_requests: {
        Row: {
          created_at: string
          id: string
          recipient_profile_id: string
          requester_profile_id: string
          responded_at: string | null
          status: PairRequestStatus
        }
        Insert: {
          created_at?: string
          id?: string
          recipient_profile_id: string
          requester_profile_id: string
          responded_at?: string | null
          status?: PairRequestStatus
        }
        Update: {
          created_at?: string
          id?: string
          recipient_profile_id?: string
          requester_profile_id?: string
          responded_at?: string | null
          status?: PairRequestStatus
        }
        Relationships: [
          {
            foreignKeyName: 'pair_requests_recipient_profile_id_fkey'
            columns: ['recipient_profile_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'pair_requests_requester_profile_id_fkey'
            columns: ['requester_profile_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      reward_redemptions: {
        Row: {
          cost: number
          created_at: string
          fulfilled_at: string | null
          id: string
          pair_id: string
          profile_id: string
          reward_id: string
          reward_title: string
          status: RewardRedemptionStatus
        }
        Insert: {
          cost: number
          created_at?: string
          fulfilled_at?: string | null
          id?: string
          pair_id?: string
          profile_id: string
          reward_id: string
          reward_title: string
          status?: RewardRedemptionStatus
        }
        Update: {
          cost?: number
          created_at?: string
          fulfilled_at?: string | null
          id?: string
          pair_id?: string
          profile_id?: string
          reward_id?: string
          reward_title?: string
          status?: RewardRedemptionStatus
        }
        Relationships: [
          {
            foreignKeyName: 'reward_redemptions_profile_id_fkey'
            columns: ['profile_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      rewards: {
        Row: {
          active: boolean
          cost: number
          created_at: string
          created_by_profile_id: string | null
          description: string | null
          id: string
          pair_id: string
          target_profile_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          cost: number
          created_at?: string
          created_by_profile_id?: string | null
          description?: string | null
          id?: string
          pair_id?: string
          target_profile_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          cost?: number
          created_at?: string
          created_by_profile_id?: string | null
          description?: string | null
          id?: string
          pair_id?: string
          target_profile_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'rewards_created_by_profile_id_fkey'
            columns: ['created_by_profile_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'rewards_target_profile_id_fkey'
            columns: ['target_profile_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      submission_photos: {
        Row: {
          created_at: string
          id: string
          storage_path: string
          submission_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          storage_path: string
          submission_id: string
        }
        Update: {
          created_at?: string
          id?: string
          storage_path?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'submission_photos_submission_id_fkey'
            columns: ['submission_id']
            isOneToOne: false
            referencedRelation: 'task_submissions'
            referencedColumns: ['id']
          },
        ]
      }
      task_submissions: {
        Row: {
          created_at: string
          id: string
          pair_id: string
          points_awarded: number
          profile_id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by_profile_id: string | null
          status: SubmissionStatus
          submission_date: string
          task_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pair_id?: string
          points_awarded?: number
          profile_id: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by_profile_id?: string | null
          status?: SubmissionStatus
          submission_date: string
          task_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pair_id?: string
          points_awarded?: number
          profile_id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by_profile_id?: string | null
          status?: SubmissionStatus
          submission_date?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'task_submissions_profile_id_fkey'
            columns: ['profile_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'task_submissions_reviewed_by_profile_id_fkey'
            columns: ['reviewed_by_profile_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'task_submissions_task_id_fkey'
            columns: ['task_id']
            isOneToOne: false
            referencedRelation: 'tasks'
            referencedColumns: ['id']
          },
        ]
      }
      tasks: {
        Row: {
          active: boolean
          created_at: string
          created_by_profile_id: string | null
          date: string | null
          description: string | null
          id: string
          pair_id: string
          points: number
          requires_photo: boolean
          target_profile_id: string | null
          title: string
          type: TaskType
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by_profile_id?: string | null
          date?: string | null
          description?: string | null
          id?: string
          pair_id?: string
          points: number
          requires_photo?: boolean
          target_profile_id?: string | null
          title: string
          type: TaskType
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by_profile_id?: string | null
          date?: string | null
          description?: string | null
          id?: string
          pair_id?: string
          points?: number
          requires_photo?: boolean
          target_profile_id?: string | null
          title?: string
          type?: TaskType
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tasks_created_by_profile_id_fkey'
            columns: ['created_by_profile_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tasks_target_profile_id_fkey'
            columns: ['target_profile_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: Record<string, never>
    Functions: {
      request_reward_redemption: {
        Args: {
          p_pair_id: string
          p_profile_id: string
          p_reward_id: string
        }
        Returns: string
      }
      review_submission: {
        Args: {
          p_action: 'approve' | 'reject' | 'reset'
          p_reviewer_profile_id: string
          p_rejection_reason?: string | null
          p_submission_id: string
        }
        Returns: string
      }
      seed_defaults: {
        Args: {
          p_pair_id: string
          p_profile_id: string
        }
        Returns: string
      }
      create_pair: {
        Args: {
          p_name: string
          p_profile_id: string
        }
        Returns: string
      }
      request_pair_by_code: {
        Args: {
          p_invite_code: string
          p_profile_id: string
        }
        Returns: string
      }
      respond_pair_request: {
        Args: {
          p_action: 'accept' | 'reject' | 'cancel'
          p_profile_id: string
          p_request_id: string
        }
        Returns: string | null
      }
      join_pair_by_code: {
        Args: {
          p_invite_code: string
          p_profile_id: string
        }
        Returns: string
      }
      generate_profile_invite_code: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      leave_pair: {
        Args: {
          p_pair_id: string
          p_profile_id: string
        }
        Returns: string
      }
      sync_current_profile: {
        Args: {
          p_admin_email: string
        }
        Returns: Json
      }
      update_profile_display_name: {
        Args: {
          p_display_name: string
          p_profile_id: string
        }
        Returns: Tables<'profiles'>
      }
      update_partner_nickname: {
        Args: {
          p_pair_id: string
          p_partner_nickname: string
          p_profile_id: string
        }
        Returns: string
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type Tables<TName extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][TName]['Row']
