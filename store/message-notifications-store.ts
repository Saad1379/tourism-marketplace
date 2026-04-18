import { create } from 'zustand'

interface MessageNotificationsState {
  unreadByConversation: Record<string, number>
  totalUnread: number
  activeConversationId: string | null
  addUnread: (conversationId: string, amount?: number) => void
  clearConversation: (conversationId: string) => void
  clearAll: () => void
  setActiveConversation: (conversationId: string | null) => void
}

const getTotal = (map: Record<string, number>) =>
  Object.values(map).reduce((sum, count) => sum + count, 0)

export const useMessageNotificationsStore = create<MessageNotificationsState>((set) => ({
  unreadByConversation: {},
  totalUnread: 0,
  activeConversationId: null,
  addUnread: (conversationId, amount = 1) =>
    set((state) => {
      const current = state.unreadByConversation[conversationId] || 0
      const nextMap = { ...state.unreadByConversation, [conversationId]: current + amount }
      return { unreadByConversation: nextMap, totalUnread: getTotal(nextMap) }
    }),
  clearConversation: (conversationId) =>
    set((state) => {
      if (!state.unreadByConversation[conversationId]) return state
      const nextMap = { ...state.unreadByConversation }
      delete nextMap[conversationId]
      return { unreadByConversation: nextMap, totalUnread: getTotal(nextMap) }
    }),
  clearAll: () => set({ unreadByConversation: {}, totalUnread: 0 }),
  setActiveConversation: (conversationId) => set({ activeConversationId: conversationId }),
}))
