import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { MessageDTO } from './types'
import type { RealtimeChannel } from '@supabase/supabase-js'

export function useRealtimeMessages(
  conversationId: string | null,
  onNewMessage: (message: MessageDTO) => void
) {
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    if (!conversationId) return

    const supabase = createClient()
    
    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT' as const,
          schema: 'public' as const,
          table: 'messages' as const,
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload: { new: Record<string, unknown> }) => {
          const newMsg = payload.new as unknown as MessageDTO
          onNewMessage({
            ...newMsg,
            content: newMsg.content || newMsg.body || ''
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE' as const,
          schema: 'public' as const,
          table: 'messages' as const,
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload: { new: Record<string, unknown> }) => {
          const updatedMsg = payload.new as unknown as MessageDTO
          onNewMessage({
            ...updatedMsg,
            content: updatedMsg.content || updatedMsg.body || ''
          })
        }
      )
      .subscribe((status: string) => {
        console.log('Subscription status:', status, 'for conversation:', conversationId)
      })

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [conversationId, onNewMessage])
}
