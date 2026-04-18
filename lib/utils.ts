import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getStorageUrl(path: string | null | undefined, bucket = "tour-images") {
  if (!path) return "/placeholder.svg"
  if (path.startsWith("http")) return path
  
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!baseUrl) return "/placeholder.svg"
  
  const cleanPath = path.replace(/^\/+/, "")
  
  // If the path already includes the bucket name, don't double it
  if (cleanPath.startsWith(`${bucket}/`)) {
    return `${baseUrl}/storage/v1/object/public/${cleanPath}`
  }
  
  return `${baseUrl}/storage/v1/object/public/${bucket}/${cleanPath}`
}

export function formatAuthError(message: string): string {
  if (!message) return "An error occurred during authentication"
  
  // Format the ugly Supabase password error into user-friendly instructions
  if (message.includes("Password should contain at least one character of each")) {
    return "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character."
  }
  
  return message
}
