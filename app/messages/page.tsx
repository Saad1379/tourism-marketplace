"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/supabase/auth-context'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { ConversationList } from '@/components/messaging/ConversationList'
import { ChatWindow } from '@/components/messaging/ChatWindow'
import type { ConversationDTO } from '@/lib/messaging/types'
import { useMessageNotificationsStore } from '@/store/message-notifications-store'
import { MessageSquare } from 'lucide-react'

export default function MessagesPage() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [selectedConversation, setSelectedConversation] = useState<ConversationDTO | null>(null)
  const [showConversationList, setShowConversationList] = useState(true)
  const conversationIdParam = searchParams.get('conversation_id')
  const assistantHandoff = searchParams.get("assistant_handoff") === "1"
  const handoffTourId = searchParams.get("tour_id")
  const handoffGuideId = searchParams.get("guide_id")
  const handoffBootstrappedRef = useRef(false)
  const clearConversation = useMessageNotificationsStore((s) => s.clearConversation)
  const setActiveConversation = useMessageNotificationsStore((s) => s.setActiveConversation)

  const loadConversationById = useCallback(
    async (conversationId: string) => {
      const response = await fetch("/api/conversations")
      if (!response.ok) return false

      const conversations: ConversationDTO[] = await response.json()
      const conversation = conversations.find((entry) => entry.id === conversationId)
      if (!conversation) return false

      setSelectedConversation(conversation)
      clearConversation(conversation.id)
      setShowConversationList(false)
      return true
    },
    [clearConversation],
  )

  useEffect(() => {
    if (!conversationIdParam) return
    if (selectedConversation?.id === conversationIdParam) return

    void loadConversationById(conversationIdParam)
  }, [conversationIdParam, loadConversationById, selectedConversation?.id])

  useEffect(() => {
    if (!user || !assistantHandoff || handoffBootstrappedRef.current) return
    handoffBootstrappedRef.current = true

    const openAssistantConversation = async () => {
      try {
        let resolvedGuideId = handoffGuideId

        if (!resolvedGuideId && handoffTourId) {
          const tourResponse = await fetch(`/api/tours/${handoffTourId}`, { cache: "no-store" })
          if (tourResponse.ok) {
            const tourPayload = await tourResponse.json()
            resolvedGuideId = tourPayload?.guide?.id || tourPayload?.guide_id || null
          }
        }

        if (!resolvedGuideId) {
          handoffBootstrappedRef.current = false
          return
        }

        const res = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tourist_id: user.id,
            guide_id: resolvedGuideId,
            ...(handoffTourId ? { tour_id: handoffTourId } : {}),
          }),
        })

        if (!res.ok) {
          handoffBootstrappedRef.current = false
          return
        }

        const conversation = await res.json()
        if (conversation?.id) {
          await loadConversationById(conversation.id)
          router.replace(`/messages?conversation_id=${conversation.id}`)
        } else {
          handoffBootstrappedRef.current = false
        }
      } catch (error) {
        console.error("[assistant-handoff] Failed to bootstrap conversation:", error)
        handoffBootstrappedRef.current = false
      }
    }

    void openAssistantConversation()
  }, [assistantHandoff, handoffGuideId, handoffTourId, loadConversationById, router, user])

  useEffect(() => {
    setActiveConversation(selectedConversation?.id || null)
    return () => setActiveConversation(null)
  }, [selectedConversation?.id, setActiveConversation])

  if (!user) {
    return (
      <div className="landing-template min-h-screen flex flex-col bg-[color:var(--landing-bg)] text-[color:var(--landing-ink)]">
        <Navbar variant="landingTemplate" />
        <div className="mx-auto flex w-full max-w-7xl flex-1 items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
          <p className="text-muted-foreground">Please log in to view messages</p>
        </div>
        <Footer variant="landingTemplate" />
      </div>
    )
  }

  return (
    <div className="landing-template min-h-screen flex flex-col bg-[color:var(--landing-bg)] text-[color:var(--landing-ink)]">
      <Navbar variant="landingTemplate" />
      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 rounded-2xl border border-[color:var(--landing-border)] bg-[color:var(--landing-surface)] p-5 shadow-[var(--landing-shadow-sm)]">
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-[color:var(--landing-ink)]">Messages</h1>
          <p className="mt-1 text-sm text-[color:var(--landing-muted)]">Talk with guides and keep all tour details in one thread.</p>
        </div>
        <div className="flex h-[calc(100vh-250px)] gap-4 md:grid md:grid-cols-[350px_1fr] md:gap-4">
          <div
            className={`dashboard-card overflow-hidden rounded-2xl md:block ${
              showConversationList ? "block w-full" : "hidden"
            }`}
          >
            <ConversationList
              onSelect={(conv) => {
                setSelectedConversation(conv)
                clearConversation(conv.id)
                setShowConversationList(false)
              }}
              selectedId={selectedConversation?.id}
            />
          </div>
          <div
            className={`dashboard-card overflow-hidden rounded-2xl md:block ${
              showConversationList ? "hidden md:block" : "block w-full"
            }`}
          >
            {selectedConversation ? (
              <ChatWindow
                conversationId={selectedConversation.id}
                otherUser={selectedConversation.other_user!}
                onBack={() => setShowConversationList(true)}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <MessageSquare className="w-16 h-16 mb-4" />
                <p>Select a conversation to start messaging</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer variant="landingTemplate" />
    </div>
  )
}
