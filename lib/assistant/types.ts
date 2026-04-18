export type AssistantMode = "guest" | "guide"

export type AssistantHistoryRole = "user" | "assistant"

export interface AssistantChatMessage {
  role: AssistantHistoryRole
  content: string
}

export interface AssistantPageContext {
  pathname?: string | null
  citySlug?: string | null
  tourSlug?: string | null
  tourId?: string | null
  guideId?: string | null
}

export interface AssistantRequestBody {
  mode: AssistantMode
  message?: string
  history?: AssistantChatMessage[]
  pageContext?: AssistantPageContext
  contextOnly?: boolean
}

export type AssistantResponseSectionType = "answer" | "next_step" | "important_note"

export interface AssistantResponseSection {
  type: AssistantResponseSectionType
  label: string
  content: string
}

export interface AssistantContextCardFact {
  label: string
  value: string
}

export interface AssistantContextCardAction {
  id: string
  label: string
  kind: "handoff" | "scroll_booking" | "navigate"
  href?: string
}

export interface AssistantContextCard {
  mode: AssistantMode
  title: string
  subtitle?: string
  facts: AssistantContextCardFact[]
  actions: AssistantContextCardAction[]
}

export interface AssistantResponseBody {
  answer: string
  suggestedActions: string[]
  groundingSummary: string[]
  responseSections?: AssistantResponseSection[]
  contextCard?: AssistantContextCard | null
}

export interface AssistantHandoffRequestBody {
  mode: AssistantMode
  tourId?: string | null
  guideId?: string | null
  pageContext?: AssistantPageContext
}

export interface AssistantHandoffResponseBody {
  redirectUrl: string
  conversationId?: string
}
