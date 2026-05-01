/**
 * Role normalization helpers.
 *
 * The DB still stores "guide" and "tourist" for backward compatibility.
 * These helpers translate both old and new role names into a canonical
 * MarketplaceRole so the rest of the app never needs to know about the
 * legacy names.
 *
 * Mapping:
 *   guide   → seller
 *   tourist → buyer
 *   seller  → seller
 *   buyer   → buyer
 *   admin   → admin
 *   null    → buyer  (safe default)
 */

import type { MarketplaceRole, AnyRole } from "./types"

export function normalizeRole(role: string | null | undefined): MarketplaceRole {
  if (role === "guide" || role === "seller") return "seller"
  if (role === "admin") return "admin"
  // tourist | buyer | null | unknown → buyer
  return "buyer"
}

export function isSeller(role: string | null | undefined): boolean {
  return normalizeRole(role) === "seller"
}

export function isBuyer(role: string | null | undefined): boolean {
  return normalizeRole(role) === "buyer"
}

export function isAdmin(role: string | null | undefined): boolean {
  return normalizeRole(role) === "admin"
}

/**
 * Returns the DB-safe role value to store for new signups.
 * Accepts both old and new role names from the registration form.
 */
export function canonicalDbRole(requestedRole: string | null | undefined): "seller" | "buyer" {
  if (requestedRole === "guide" || requestedRole === "seller") return "seller"
  return "buyer"
}
