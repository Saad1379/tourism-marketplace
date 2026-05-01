"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/supabase/auth-context"
import { useMessageNotificationsStore } from "@/store/message-notifications-store"
import { ConversationList } from "@/components/messaging/ConversationList"
import { ChatWindow } from "@/components/messaging/ChatWindow"
import { MessageSquare } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent } from "@/components/ui/card"
import type { ConversationDTO } from "@/lib/messaging/types"

import { isSeller } from "@/lib/marketplace/roles"

export default function SellerMessagesPage() {
  const { user, profile, isLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [selectedConversation, setSelectedConversation] = useState<ConversationDTO | null>(null)
  const [showConversationList, setShowConversationList] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const conversationIdParam = searchParams.get("conversation_id")
  const clearConversation = useMessageNotificationsStore((s) => s.clearConversation)
  const setActiveConversation = useMessageNotificationsStore((s) => s.setActiveConversation)

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login")
      return
    }

    if (!isLoading && profile && !isSeller(profile.role)) {
      router.push("/")
    }
  }, [isLoading, user, profile, router])

  useEffect(() => {
    setActiveConversation(selectedConversation?.id || null)
    return () => setActiveConversation(null)
  }, [selectedConversation?.id, setActiveConversation])

  useEffect(() => {
    const hydrateFromQuery = async () => {
      if (!conversationIdParam || !user) return
      if (selectedConversation?.id === conversationIdParam) return

      try {
        setLoadError(null)
        const res = await fetch("/api/conversations")
        if (!res.ok) throw new Error("Failed to load conversations")
        const convs: ConversationDTO[] = await res.json()
        const conv = convs.find((c) => c.id === conversationIdParam)
        if (conv) {
          setSelectedConversation(conv)
          clearConversation(conv.id)
          setShowConversationList(false)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to open conversation"
        setLoadError(message)
      }
    }

    hydrateFromQuery()
  }, [conversationIdParam, selectedConversation?.id, clearConversation, user])

  const isAuthorizedSeller = useMemo(() => {
    return Boolean(user && isSeller(profile?.role))
  }, [user, profile?.role])

  if (!isAuthorizedSeller) {
    return null
  }

  return (
    <main className="h-[calc(100vh-3.5rem)]">
      <div className="flex h-full">
        {loadError && (
          <Alert className="absolute top-4 right-4 z-20 max-w-sm border-destructive/40 bg-destructive/5">
            <AlertDescription className="text-destructive">{loadError}</AlertDescription>
          </Alert>
        )}

        <section
          className={`
            w-full md:w-[350px] lg:w-[390px] border-r bg-card
            ${showConversationList ? "block" : "hidden md:block"}
          `}
          aria-label="Conversations"
        >
          <ConversationList
            onSelect={(conv) => {
              setSelectedConversation(conv)
              clearConversation(conv.id)
              setShowConversationList(false)
              setLoadError(null)
            }}
            selectedId={selectedConversation?.id}
          />
        </section>

        <section
          className={`
            flex-1 bg-card
            ${showConversationList ? "hidden md:block" : "block"}
          `}
          aria-label="Messages"
        >
          {selectedConversation ? (
            <ChatWindow
              conversationId={selectedConversation.id}
              otherUser={
                selectedConversation.other_user || {
                  id: "unknown",
                  full_name: "User",
                  avatar_url: null,
                }
              }
              onBack={() => setShowConversationList(true)}
            />
          ) : (
            <Card className="h-full rounded-none border-0">
              <CardContent className="h-full flex flex-col items-center justify-center text-muted-foreground">
                <MessageSquare className="w-14 h-14 mb-3" aria-hidden="true" />
                <p className="text-sm">Select a conversation to start messaging</p>
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </main>
  )
}
