export interface ConversationDTO {
  id: string
  tour_id: string | null
  tourist_id: string
  guide_id: string
  created_at: string
  updated_at: string
  last_message_at: string | null
  unread_count?: number
  other_user?: {
    id: string
    full_name: string | null
    avatar_url: string | null
    role: 'tourist' | 'guide'
  }
  last_message?: {
    content: string
    created_at: string
  }
}

export interface MessageDTO {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  body?: string
  read_at: string | null
  is_read?: boolean
  created_at: string
  sender?: {
    id: string
    full_name: string | null
    avatar_url: string | null
  }
}

export interface CreateConversationRequest {
  tourist_id: string
  guide_id: string
  tour_id?: string
}

export interface SendMessageRequest {
  conversation_id: string
  content: string
}
