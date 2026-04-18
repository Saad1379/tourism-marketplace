"use client"

import { useEffect, useRef } from "react"
import type { MessageDTO } from "@/lib/messaging/types"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AlertCircle, Send, ChevronLeft, MessageSquare } from "lucide-react"

interface MessagesAreaHeader {
  title: string
  subtitle?: string | null
  avatarUrl?: string | null
  fallback?: string
}

interface MessagesAreaProps {
  header: MessagesAreaHeader
  messages: MessageDTO[]
  currentUserId?: string | null
  inputValue: string
  onInputChange: (value: string) => void
  onSend: () => void
  error?: string | null
  onBack?: () => void
}

export function MessagesArea({
  header,
  messages,
  currentUserId,
  inputValue,
  onInputChange,
  onSend,
  error,
  onBack,
}: MessagesAreaProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="h-14 flex items-center gap-3 border-b border-border/50 bg-background px-4 shrink-0">
        {onBack && (
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={onBack}
            aria-label="Back to conversations"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src={header.avatarUrl || undefined} />
          <AvatarFallback className="text-xs font-semibold">
            {header.fallback || header.title?.[0] || "?"}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold truncate leading-tight">{header.title}</h3>
          {header.subtitle ? (
            <p className="text-xs text-muted-foreground truncate leading-tight">{header.subtitle}</p>
          ) : null}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-3 p-4">
          {messages.length > 0 ? (
            messages.map((message) => {
              const isOwnMessage = message.sender_id === currentUserId
              return (
                <div key={message.id} className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}>
                  <div className={`flex items-end gap-2 ${isOwnMessage ? "flex-row-reverse" : "flex-row"}`}>
                    {message.sender && (
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarImage src={message.sender.avatar_url || undefined} />
                        <AvatarFallback className="text-[10px] font-semibold">
                          {message.sender.full_name?.[0] || "?"}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div className="max-w-[70%]">
                      <div
                        className={`px-4 py-2.5 ${
                          isOwnMessage
                            ? "bg-primary text-primary-foreground rounded-2xl bubble-own shadow-sm"
                            : "bg-muted rounded-2xl bubble-other"
                        }`}
                      >
                        <p className="text-sm leading-relaxed">{message.body ?? message.content ?? ""}</p>
                      </div>
                      <p
                        className={`mt-1 text-[10px] text-muted-foreground/70 ${
                          isOwnMessage ? "text-right" : "text-left"
                        }`}
                      >
                        {new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center mb-4">
                <MessageSquare className="w-6 h-6 text-muted-foreground/60" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">No messages yet</p>
              <p className="text-xs text-muted-foreground">Send a message to start the conversation.</p>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="border-t border-border/50 bg-background p-3 shrink-0">
        {error && (
          <Alert className="mb-2 bg-destructive/10 border-destructive/20">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <AlertDescription className="text-destructive text-xs">{error}</AlertDescription>
          </Alert>
        )}
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <input
            placeholder="Type a message…"
            className="flex-1 h-10 rounded-2xl border border-border/60 bg-muted/40 px-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-colors"
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && onSend()}
          />
          <Button
            size="icon"
            onClick={onSend}
            disabled={!inputValue.trim()}
            className="h-10 w-10 rounded-xl shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
