"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/lib/supabase/auth-context'
import type { MessageDTO } from '@/lib/messaging/types'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'
import { MessagesArea } from '@/components/messaging/MessagesArea'

interface ChatWindowProps {
  conversationId: string
  otherUser: {
    id: string
    full_name: string | null
    avatar_url: string | null
  }
  onBack?: () => void
}

export function ChatWindow({ conversationId, otherUser, onBack }: ChatWindowProps) {
  const { user } = useAuth()
  const [messages, setMessages] = useState<MessageDTO[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const optimisticIdsRef = useRef<Set<string>>(new Set())
  const supabase = createClient()


  useEffect(() => {
    if (!conversationId) return

    const fetchMessages = async () => {
      setLoading(true)
      const res = await fetch(`/api/messages?conversation_id=${conversationId}&limit=50`)
      if (res.ok) {
        const data = await res.json()
        const normalized = data.map((msg: any) => ({
          ...msg,
          content: msg.content || msg.body || ''
        }))
        setMessages(normalized.reverse())
      }
      setLoading(false)
    }

    fetchMessages()

    const markAsRead = async () => {
      await fetch('/api/messages/read', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: conversationId })
      })
    }

    markAsRead()
  }, [conversationId])

  const handleNewMessage = useCallback((newMsg: MessageDTO) => {
    const normalized: MessageDTO = {
      ...newMsg,
      content: newMsg.content || newMsg.body || '',
    }

    setMessages(prev => {
      const existingIndex = prev.findIndex(m => m.id === normalized.id)
      if (existingIndex !== -1) {
        const next = [...prev]
        next[existingIndex] = { ...prev[existingIndex], ...normalized }
        return next
      }

      const tempIndex = prev.findIndex(m => {
        const isTemp = typeof m.id === 'string' && m.id.startsWith('temp-')
        if (!isTemp) return false
        const sameSender = m.sender_id === normalized.sender_id
        const sameContent = (m.content || m.body) === normalized.content
        if (!sameSender || !sameContent) return false
        const prevTime = new Date(m.created_at).getTime()
        const nextTime = new Date(normalized.created_at).getTime()
        return Math.abs(prevTime - nextTime) < 120000
      })

      if (tempIndex !== -1) {
        const next = [...prev]
        optimisticIdsRef.current.delete(prev[tempIndex].id)
        next[tempIndex] = { ...prev[tempIndex], ...normalized }
        return next
      }

      return [...prev, normalized]
    })

    if (newMsg.sender_id !== user?.id) {
      fetch('/api/messages/read', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: conversationId })
      })
    }
  }, [conversationId, user?.id])

  useEffect(() => {
    if (!conversationId) return

    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as MessageDTO
          handleNewMessage(newMsg)
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const updatedMsg = payload.new as MessageDTO
          handleNewMessage(updatedMsg)
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId, handleNewMessage, supabase])

  const handleSend = async () => {
    if (!input.trim() || !user) return

    const optimisticId = `temp-${Date.now()}`
    const optimisticMsg: MessageDTO = {
      id: optimisticId,
      conversation_id: conversationId,
      sender_id: user.id,
      content: input.trim(),
      read_at: null,
      created_at: new Date().toISOString(),
      sender: {
        id: user.id,
        full_name: user.user_metadata?.full_name || null,
        avatar_url: user.user_metadata?.avatar_url || null
      }
    }

    optimisticIdsRef.current.add(optimisticId)
    setMessages(prev => [...prev, optimisticMsg])
    setInput('')
    setSending(true)

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          body: optimisticMsg.content,
          content: optimisticMsg.content,
        })
        .select()
        .single()

      if (error) throw error

      if (data) {
        handleNewMessage(data as MessageDTO)
        optimisticIdsRef.current.delete(optimisticId)
      }
    } catch (error) {
      console.error('Send error:', error)
      setMessages(prev => prev.filter(m => m.id !== optimisticId))
      optimisticIdsRef.current.delete(optimisticId)
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <MessagesArea
      header={{
        title: otherUser.full_name || "User",
        avatarUrl: otherUser.avatar_url || undefined,
        fallback: otherUser.full_name?.[0] || "U",
      }}
      messages={messages}
      currentUserId={user?.id}
      inputValue={input}
      onInputChange={setInput}
      onSend={handleSend}
      onBack={onBack}
    />
  )
}
