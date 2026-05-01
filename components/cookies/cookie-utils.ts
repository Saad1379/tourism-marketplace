// Cookie consent utilities

const COOKIE_NAME = "touricho_cookie_consent"
const COOKIE_EXPIRY_DAYS = 365

export type ConsentChoice = "accepted" | "rejected" | null

/**
 * Get current consent choice from storage
 */
export function getConsentChoice(): ConsentChoice {
  if (typeof window === "undefined") return null

  // Try to get from cookie first
  const cookieValue = getCookie(COOKIE_NAME)
  if (cookieValue) {
    return cookieValue as ConsentChoice
  }

  // Fallback to localStorage
  const storageValue = localStorage.getItem(COOKIE_NAME)
  if (storageValue) {
    return storageValue as ConsentChoice
  }

  return null
}

/**
 * Set consent choice
 */
export function setConsentChoice(choice: ConsentChoice) {
  if (typeof window === "undefined") return

  // Set cookie with expiry
  setCookie(COOKIE_NAME, choice || "", COOKIE_EXPIRY_DAYS)

  // Also set localStorage as backup
  if (choice) {
    localStorage.setItem(COOKIE_NAME, choice)
  } else {
    localStorage.removeItem(COOKIE_NAME)
  }
}

/**
 * Clear consent choice
 */
export function clearConsentChoice() {
  if (typeof window === "undefined") return

  deleteCookie(COOKIE_NAME)
  localStorage.removeItem(COOKIE_NAME)
}

/**
 * Helper: Set cookie
 */
function setCookie(name: string, value: string, days: number) {
  const date = new Date()
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000)
  const expires = `expires=${date.toUTCString()}`
  document.cookie = `${name}=${value};${expires};path=/;SameSite=Lax`
}

/**
 * Helper: Get cookie
 */
function getCookie(name: string): string | null {
  if (!document.cookie) return null
  const nameEQ = `${name}=`
  const cookies = document.cookie.split(";")
  for (let cookie of cookies) {
    cookie = cookie.trim()
    if (cookie.indexOf(nameEQ) === 0) {
      return cookie.substring(nameEQ.length)
    }
  }
  return null
}

/**
 * Helper: Delete cookie
 */
function deleteCookie(name: string) {
  setCookie(name, "", -1)
}

/**
 * Check if consent banner should be shown
 */
export function shouldShowBanner(): boolean {
  return getConsentChoice() === null
}
