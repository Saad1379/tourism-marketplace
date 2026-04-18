import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useMessageNotificationsStore } from '@/store/message-notifications-store'
import type { MessageDTO } from '@/lib/messaging/types'

export function useRealtimeMessageNotifications(userId: string | null) {
  const addUnread = useMessageNotificationsStore((s) => s.addUnread)
  const activeConversationId = useMessageNotificationsStore((s) => s.activeConversationId)
  const clearAll = useMessageNotificationsStore((s) => s.clearAll)

  useEffect(() => {
    if (!userId) {
      clearAll()
    }
  }, [clearAll, userId])

  useEffect(() => {
    if (!userId) return

    const supabase = createClient()
    const channel = supabase
      .channel(`message-notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const msg = payload.new as MessageDTO
          if (msg.sender_id === userId) return
          if (activeConversationId && msg.conversation_id === activeConversationId) return
          addUnread(msg.conversation_id, 1)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [activeConversationId, addUnread, userId])
}
