"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Bot, Loader2, MessageCircle, Send, Sparkles, UserRound, X } from "lucide-react"
import { useAuth } from "@/lib/supabase/auth-context"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import type {
  AssistantContextCard,
  AssistantContextCardAction,
  AssistantHandoffResponseBody,
  AssistantMode,
  AssistantPageContext,
  AssistantResponseBody,
  AssistantResponseSection,
} from "@/lib/assistant/types"

type WidgetMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  sections?: AssistantResponseSection[]
}

type AssistantOpenEventDetail = {
  mode?: AssistantMode
  source?: string
  prompt?: string
}

const MAX_HISTORY_ITEMS = 8
const MAX_MESSAGE_CHARS = 1200

const QUICK_PROMPTS: Record<AssistantMode, string[]> = {
  guest: [
    "Where exactly is the meeting point?",
    "How does cancellation work?",
    "How much do guests usually tip?",
    "Talk to human",
  ],
  guide: [
    "What is my fastest publish checklist?",
    "How should I improve schedule setup?",
    "Talk to human",
  ],
}

const DEFAULT_ACTIONS: Record<AssistantMode, string[]> = {
  guest: [
    "Where exactly is the meeting point?",
    "How does cancellation work?",
    "How much do guests usually tip?",
    "Talk to human",
  ],
  guide: ["What is my fastest publish checklist?", "How should I improve schedule setup?", "Talk to human"],
}

function isTourDetailPath(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean)
  return segments.length >= 3 && segments[0] === "tours"
}

function resolveMode(pathname: string, role: string | null | undefined): AssistantMode | null {
  if (!pathname) return null

  const hiddenPrefixes = ["/admin", "/auth", "/messages"]
  if (hiddenPrefixes.some((prefix) => pathname.startsWith(prefix))) return null
  if (pathname.startsWith("/dashboard/messages")) return null
  if (pathname === "/login" || pathname === "/register" || pathname === "/forgot-password") return null

  if (pathname.startsWith("/dashboard")) {
    return role === "guide" ? "guide" : null
  }

  if (isTourDetailPath(pathname) && role !== "guide") {
    return "guest"
  }

  return null
}

function isAssistantModeValue(value: unknown): value is AssistantMode {
  return value === "guest" || value === "guide"
}

function buildPageContext(pathname: string): AssistantPageContext {
  const segments = pathname.split("/").filter(Boolean)
  if (segments.length >= 3 && segments[0] === "tours") {
    return {
      pathname,
      citySlug: segments[1] || null,
      tourSlug: segments[2] || null,
    }
  }
  return { pathname }
}

function createMessage(role: WidgetMessage["role"], content: string, sections?: AssistantResponseSection[]): WidgetMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    ...(sections && sections.length > 0 ? { sections } : {}),
  }
}

function getWelcome(mode: AssistantMode): string {
  if (mode === "guide") {
    return "I can help with publish readiness, schedules, and faster guide workflows. Ask one concrete question."
  }
  return "I can help with meeting point details, booking steps, cancellation basics, and tipping guidance for this tour."
}

function normalizeResponseSections(
  sections: AssistantResponseSection[] | undefined,
  answer: string,
): AssistantResponseSection[] | undefined {
  const answerFromSections = Array.isArray(sections)
    ? sections.find((section) => section?.type === "answer" && typeof section?.content === "string")?.content || ""
    : ""
  const content = (answerFromSections || answer).trim()
  if (!content) return undefined

  return [
    {
      type: "answer",
      label: "Answer",
      content,
    },
  ]
}

export function AssistantWidget() {
  const pathname = usePathname() || ""
  const router = useRouter()
  const { profile } = useAuth()

  const resolvedMode = useMemo(() => resolveMode(pathname, profile?.role), [pathname, profile?.role])
  const [modeOverride, setModeOverride] = useState<AssistantMode | null>(null)
  const activeMode = resolvedMode || modeOverride
  const pageContext = useMemo(() => buildPageContext(pathname), [pathname])
  const contextFetchKey = useMemo(() => {
    if (!activeMode) return null
    return [activeMode, pageContext.pathname || "", pageContext.citySlug || "", pageContext.tourSlug || ""].join("|")
  }, [activeMode, pageContext.pathname, pageContext.citySlug, pageContext.tourSlug])

  const [isMobile, setIsMobile] = useState(false)
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<WidgetMessage[]>([])
  const [input, setInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [isHandoffLoading, setIsHandoffLoading] = useState(false)
  const [isContextLoading, setIsContextLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [suggestedActions, setSuggestedActions] = useState<string[]>([])
  const [contextCard, setContextCard] = useState<AssistantContextCard | null>(null)
  const [loadedContextKey, setLoadedContextKey] = useState<string | null>(null)

  const isTalkToHumanAction = (value: string) => {
    const text = value.trim().toLowerCase()
    return (
      text === "talk to human" ||
      text === "talk with human" ||
      text === "message guide" ||
      text.includes("contact your guide") ||
      text.includes("contact guide")
    )
  }

  const openBookingSection = useCallback(() => {
    const bookingCard = document.getElementById("booking-card")
    if (!bookingCard) {
      setErrorMessage("Booking section is not available on this page.")
      return
    }

    setOpen(false)
    bookingCard.scrollIntoView({ behavior: "smooth", block: "start" })
    window.setTimeout(() => {
      const focusTarget = bookingCard.querySelector<HTMLElement>(
        "button:not([disabled]), [href], input, select, textarea",
      )
      focusTarget?.focus()
    }, 420)
  }, [])

  const handleTalkToHuman = useCallback(async () => {
    if (!activeMode || isHandoffLoading) return

    setIsHandoffLoading(true)
    setErrorMessage(null)

    try {
      const response = await fetch("/api/assistant/handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: activeMode,
          pageContext,
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(typeof payload?.error === "string" ? payload.error : "Unable to start handoff")
      }

      const payload = (await response.json()) as AssistantHandoffResponseBody
      if (!payload.redirectUrl) {
        throw new Error("Missing redirect URL from handoff")
      }

      setOpen(false)
      router.push(payload.redirectUrl)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to start handoff")
    } finally {
      setIsHandoffLoading(false)
    }
  }, [activeMode, isHandoffLoading, pageContext, router])

  const handleContextAction = useCallback(
    (action: AssistantContextCardAction) => {
      if (action.kind === "handoff") {
        void handleTalkToHuman()
        return
      }

      if (action.kind === "scroll_booking") {
        openBookingSection()
        return
      }

      if (action.kind === "navigate" && action.href) {
        setOpen(false)
        router.push(action.href)
      }
    },
    [handleTalkToHuman, openBookingSection, router],
  )

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)")
    const apply = () => setIsMobile(mediaQuery.matches)
    apply()
    mediaQuery.addEventListener("change", apply)
    return () => mediaQuery.removeEventListener("change", apply)
  }, [])

  useEffect(() => {
    if (!activeMode) {
      setOpen(false)
      setMessages([])
      setSuggestedActions([])
      setContextCard(null)
      setLoadedContextKey(null)
      setErrorMessage(null)
      return
    }

    setSuggestedActions(DEFAULT_ACTIONS[activeMode])
  }, [activeMode])

  useEffect(() => {
    if (resolvedMode) {
      setModeOverride(null)
    }
  }, [resolvedMode])

  useEffect(() => {
    const onAssistantOpen = (event: Event) => {
      const customEvent = event as CustomEvent<AssistantOpenEventDetail>
      const detail = customEvent.detail
      const requestedMode = detail?.mode
      if (requestedMode && !isAssistantModeValue(requestedMode)) return
      if (resolvedMode && requestedMode && requestedMode !== resolvedMode) return

      const nextMode = resolvedMode || requestedMode || activeMode
      if (!nextMode) return

      if (!resolvedMode && requestedMode) {
        setModeOverride(requestedMode)
      }

      if (typeof detail?.prompt === "string" && detail.prompt.trim().length > 0) {
        setInput(detail.prompt.trim().slice(0, MAX_MESSAGE_CHARS))
      }

      setOpen(true)
    }

    window.addEventListener("tipwalk:assistant-open", onAssistantOpen)
    return () => window.removeEventListener("tipwalk:assistant-open", onAssistantOpen)
  }, [activeMode, resolvedMode])

  useEffect(() => {
    if (!activeMode || !contextFetchKey) return
    setMessages([])
    setContextCard(null)
    setLoadedContextKey(null)
    setErrorMessage(null)
    setSuggestedActions(DEFAULT_ACTIONS[activeMode])
  }, [activeMode, contextFetchKey])

  useEffect(() => {
    if (!open || !activeMode || !contextFetchKey) return
    if (loadedContextKey === contextFetchKey) return

    let cancelled = false
    setIsContextLoading(true)

    const loadContext = async () => {
      try {
        const response = await fetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: activeMode,
            contextOnly: true,
            pageContext,
          }),
        })

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}))
          throw new Error(typeof payload?.error === "string" ? payload.error : "Unable to load assistant context")
        }

        const payload = (await response.json()) as AssistantResponseBody
        if (cancelled) return

        if (payload.contextCard) {
          setContextCard(payload.contextCard)
        }

        if (Array.isArray(payload.suggestedActions) && payload.suggestedActions.length > 0) {
          setSuggestedActions(payload.suggestedActions.slice(0, 4))
        }

        if ((payload.answer || "").trim().length > 0) {
          const answer = payload.answer.trim()
          const sections = normalizeResponseSections(payload.responseSections, answer)
          setMessages((prev) => (prev.length > 0 ? prev : [createMessage("assistant", answer, sections)]))
        }

        setLoadedContextKey(contextFetchKey)
      } catch (error) {
        if (cancelled) return
        setErrorMessage(error instanceof Error ? error.message : "Unable to load assistant context")
        setMessages((prev) => (prev.length > 0 ? prev : [createMessage("assistant", getWelcome(activeMode))]))
      } finally {
        if (!cancelled) {
          setIsContextLoading(false)
        }
      }
    }

    void loadContext()

    return () => {
      cancelled = true
    }
  }, [activeMode, contextFetchKey, loadedContextKey, open, pageContext])

  if (!activeMode) return null

  const sendMessage = async (rawMessage?: string) => {
    if (isSending) return

    const outgoing = (rawMessage ?? input).trim().slice(0, MAX_MESSAGE_CHARS)
    if (!outgoing) return

    const historyPayload = messages.slice(-MAX_HISTORY_ITEMS).map((entry) => ({
      role: entry.role,
      content: entry.content,
    }))

    setErrorMessage(null)
    setInput("")
    setMessages((prev) => [...prev, createMessage("user", outgoing)])
    setIsSending(true)

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: activeMode,
          message: outgoing,
          history: historyPayload,
          pageContext,
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(typeof payload?.error === "string" ? payload.error : "Assistant request failed")
      }

      const payload = (await response.json()) as AssistantResponseBody
      const answer = (payload.answer || "").trim()
      if (!answer) {
        throw new Error("Assistant returned an empty response")
      }

      const sections = normalizeResponseSections(payload.responseSections, answer)
      setMessages((prev) => [...prev, createMessage("assistant", answer, sections)])

      if (payload.contextCard) {
        setContextCard(payload.contextCard)
      }

      if (Array.isArray(payload.suggestedActions) && payload.suggestedActions.length > 0) {
        setSuggestedActions(payload.suggestedActions.slice(0, 4))
      }
    } catch (error) {
      const fallbackText =
        activeMode === "guide"
          ? "I could not complete that right now. Ask again, or use Talk to human for direct support."
          : "I could not complete that right now. Ask again, or use Talk to human to contact the guide."
      setMessages((prev) => [...prev, createMessage("assistant", fallbackText)])
      setErrorMessage(error instanceof Error ? error.message : "Assistant temporarily unavailable")
      setSuggestedActions(DEFAULT_ACTIONS[activeMode])
    } finally {
      setIsSending(false)
    }
  }

  const actionChips = (messages.length <= 1 ? QUICK_PROMPTS[activeMode] : suggestedActions).slice(0, 4)
  const sheetSide = isMobile ? "bottom" : "right"
  const guideContextCard = activeMode === "guide" && contextCard?.mode === "guide" ? contextCard : null

  return (
    <>
      {!open ? (
        <Button
          type="button"
          variant="outline"
          className="assistant-launcher"
          onClick={() => setOpen(true)}
          aria-label={activeMode === "guide" ? "Open Guide Assistant" : "Open Guest Assistant"}
        >
          <MessageCircle className="h-4 w-4" />
          <span className="assistant-launcher-label">{activeMode === "guide" ? "Guide Assistant" : "Need help now?"}</span>
        </Button>
      ) : null}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side={sheetSide}
          className={cn(
            "assistant-panel-content",
            sheetSide === "right" ? "w-full border-l p-0 sm:max-w-[500px]" : "h-[88vh] rounded-t-[1.4rem] p-0",
          )}
        >
          <div className="assistant-panel-surface">
            <SheetHeader className="assistant-panel-header">
              <div className="assistant-header-gradient" />
              <div className="assistant-header-main">
                <div className="assistant-header-title-row">
                  <SheetTitle className="assistant-title">
                    <Sparkles className="h-4 w-4 text-[color:var(--landing-accent)]" />
                    {activeMode === "guide" ? "Guide Assistant" : "Guest Assistant"}
                  </SheetTitle>
                  <div className="assistant-header-controls">
                    <span className="assistant-mode-badge">{activeMode === "guide" ? "Guide mode" : "Guest mode"}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="assistant-close-btn"
                      onClick={() => setOpen(false)}
                      aria-label="Close assistant"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <SheetDescription className="assistant-description">
                  {activeMode === "guide"
                    ? "Grounded in your dashboard context, tours, and scheduling data."
                    : "Grounded in tour context and TipWalk FAQ guidance."}
                </SheetDescription>
                <p className="assistant-status-line">
                  <span className="assistant-status-dot" aria-hidden="true" />
                  {isContextLoading ? "Loading live context..." : "Live context active"}
                </p>
              </div>
            </SheetHeader>

            <div className="assistant-content-stack">
              {guideContextCard ? (
                <section className="assistant-context-card" aria-label={guideContextCard.title}>
                  <div className="assistant-context-head">
                    <p className="assistant-context-title">{guideContextCard.title}</p>
                    {guideContextCard.subtitle ? <p className="assistant-context-subtitle">{guideContextCard.subtitle}</p> : null}
                  </div>
                  <div className="assistant-context-facts">
                    {guideContextCard.facts.slice(0, 5).map((fact) => (
                      <div key={`${fact.label}-${fact.value}`} className="assistant-context-fact-row">
                        <p className="assistant-context-fact-label">{fact.label}</p>
                        <p className="assistant-context-fact-value">{fact.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="assistant-context-actions">
                    {guideContextCard.actions.map((action) => (
                      <Button
                        key={action.id}
                        type="button"
                        size="sm"
                        variant={action.kind === "handoff" ? "default" : "outline"}
                        className={cn(
                          "assistant-context-btn",
                          action.kind === "handoff" ? "assistant-context-btn-primary" : "assistant-context-btn-secondary",
                        )}
                        onClick={() => handleContextAction(action)}
                        disabled={isHandoffLoading}
                      >
                        {action.label}
                      </Button>
                    ))}
                  </div>
                </section>
              ) : null}

              <ScrollArea className="assistant-thread-area" type="always">
                <div className="assistant-thread-stack">
                  {messages.map((entry) => (
                    <article
                      key={entry.id}
                      className={cn("assistant-message-row", entry.role === "user" ? "assistant-message-row-user" : "assistant-message-row-ai")}
                    >
                      <div className={cn("assistant-bubble", entry.role === "user" ? "assistant-bubble-user" : "assistant-bubble-ai")}>
                        <p className="assistant-bubble-label">
                          {entry.role === "user" ? (
                            <>
                              <UserRound className="h-3 w-3" />
                              You
                            </>
                          ) : (
                            <>
                              <Bot className="h-3 w-3" />
                              Assistant
                            </>
                          )}
                        </p>

                        {entry.role === "assistant" && entry.sections && entry.sections.length > 0 ? (
                          <div className="assistant-section-stack">
                            {entry.sections.map((section, index) => (
                              <div key={`${entry.id}-${section.type}-${index}`} className="assistant-section assistant-section-answer">
                                <p className="assistant-section-label">{section.label}</p>
                                <p className="assistant-section-content">{section.content}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="assistant-bubble-content">{entry.content}</p>
                        )}
                      </div>
                    </article>
                  ))}

                  {isSending ? (
                    <article className="assistant-message-row assistant-message-row-ai" aria-live="polite">
                      <div className="assistant-bubble assistant-bubble-ai">
                        <p className="assistant-bubble-label">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Assistant
                        </p>
                        <p className="assistant-bubble-content">Thinking through this now...</p>
                      </div>
                    </article>
                  ) : null}
                </div>
              </ScrollArea>

              <div className="assistant-chip-row">
                {actionChips.map((prompt) => (
                  <Button
                    key={prompt}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="assistant-chip-btn"
                    onClick={() => {
                      if (isTalkToHumanAction(prompt)) {
                        void handleTalkToHuman()
                        return
                      }
                      void sendMessage(prompt)
                    }}
                    disabled={isSending || isHandoffLoading}
                  >
                    {prompt}
                  </Button>
                ))}
              </div>
            </div>

            <div className="assistant-composer-shell">
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={
                  activeMode === "guide"
                    ? "Ask about publish readiness, schedules, or tour setup..."
                    : "Ask about meeting point, booking, cancellation, or tipping..."
                }
                rows={3}
                maxLength={MAX_MESSAGE_CHARS}
                className="assistant-composer-input"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault()
                    void sendMessage()
                  }
                }}
              />

              <div className="assistant-composer-actions">
                {activeMode === "guest" ? (
                  <Button type="button" variant="outline" className="assistant-utility-btn" onClick={openBookingSection}>
                    Open booking section
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  className="assistant-utility-btn"
                  onClick={() => void handleTalkToHuman()}
                  disabled={isHandoffLoading}
                >
                  {isHandoffLoading ? "Opening..." : "Talk to human"}
                </Button>
                <Button
                  type="button"
                  className="assistant-send-btn"
                  onClick={() => void sendMessage()}
                  disabled={isSending || input.trim().length === 0}
                >
                  <Send className="h-4 w-4" />
                  {isSending ? "Sending..." : "Send"}
                </Button>
              </div>

              {errorMessage ? <p className="assistant-error-text">{errorMessage}</p> : null}
              {activeMode === "guest" ? (
                <p className="assistant-footnote">TipWalk assistant gives fast guidance. For final guide confirmation, use Talk to human.</p>
              ) : null}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
