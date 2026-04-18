import type { Profile } from "@/lib/supabase/bootstrap"

export function getMessagesUrl(profile: Profile | null): string {
  if (!profile) return "/login"
  return profile.role === "guide" ? "/dashboard/messages" : "/messages"
}
