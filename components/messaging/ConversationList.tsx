"use client"

import { useState, useEffect, useCallback } from 'react'
import type { ConversationDTO } from '@/lib/messaging/types'
import { useRealtimeConversations } from '@/lib/messaging/useRealtimeConversations'
import { useAuth } from '@/lib/supabase/auth-context'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Loader2, MessageSquare } from 'lucide-react'

interface ConversationListProps {
  onSelect: (conversation: ConversationDTO) => void
  selectedId?: string
}

export function ConversationList({ onSelect, selectedId }: ConversationListProps) {
  const { user } = useAuth()
  const [conversations, setConversations] = useState<ConversationDTO[]>([])
  const [loading, setLoading] = useState(true)

  const fetchConversations = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/conversations')
    if (res.ok) {
      const data = await res.json()
      setConversations(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  useRealtimeConversations(user?.id || null, fetchConversations)

  if (loading) {
    return (
      <div className="flex items-center justify-center p-10">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center mb-4">
          <MessageSquare className="w-6 h-6 text-muted-foreground/60" />
        </div>
        <p className="text-sm font-medium text-foreground mb-1">No conversations yet</p>
        <p className="text-xs text-muted-foreground">Messages from guests will appear here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-0.5 p-2">
      {conversations.map((conv) => {
        const isSelected = selectedId === conv.id
        return (
          <button
            key={conv.id}
            onClick={() => onSelect(conv)}
            className={`w-full flex items-start gap-3 rounded-xl p-3 transition-colors duration-150 text-left ${
              isSelected
                ? 'bg-primary/[0.08] border border-primary/20'
                : 'hover:bg-muted/60 border border-transparent'
            }`}
          >
            <div className="relative shrink-0">
              <Avatar className="h-10 w-10 ring-2 ring-background">
                <AvatarImage src={conv.other_user?.avatar_url || undefined} />
                <AvatarFallback className="text-xs font-semibold">
                  {conv.other_user?.full_name?.[0]?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              {conv.unread_count! > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-white text-[10px] font-bold leading-none">
                  {conv.unread_count! > 9 ? '9+' : conv.unread_count}
                </span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <h4 className={`text-sm truncate leading-tight ${conv.unread_count! > 0 ? 'font-semibold text-foreground' : 'font-medium text-foreground'}`}>
                  {conv.other_user?.full_name || 'User'}
                </h4>
                {conv.last_message_at && (
                  <span className="text-[10px] text-muted-foreground/70 shrink-0">
                    {new Date(conv.last_message_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>
              {conv.last_message && (
                <p className={`text-xs line-clamp-1 ${conv.unread_count! > 0 ? 'text-foreground/80 font-medium' : 'text-muted-foreground'}`}>
                  {conv.last_message.content}
                </p>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
