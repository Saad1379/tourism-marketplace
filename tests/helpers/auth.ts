import { type Page, expect } from "@playwright/test"

export async function loginAsTourist(page: Page) {
  const email = process.env.E2E_TOURIST_EMAIL
  const password = process.env.E2E_TOURIST_PASSWORD

  if (!email || !password) {
    throw new Error("E2E_TOURIST_EMAIL and E2E_TOURIST_PASSWORD must be set in .env.local")
  }

  await page.goto("/login")
  await expect(page).toHaveTitle(/Login/i)

  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button:has-text("Sign In")')

  // Wait for redirect to dashboard or home
  await page.waitForNavigation()
  await expect(page).not.toHaveURL(/\/login/)
}

export async function loginAsGuide(page: Page) {
  const email = process.env.E2E_GUIDE_EMAIL
  const password = process.env.E2E_GUIDE_PASSWORD

  if (!email || !password) {
    throw new Error("E2E_GUIDE_EMAIL and E2E_GUIDE_PASSWORD must be set in .env.local")
  }

  await page.goto("/login")
  await expect(page).toHaveTitle(/Login/i)

  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button:has-text("Sign In")')

  // Wait for redirect to dashboard
  await page.waitForNavigation()
  await expect(page).not.toHaveURL(/\/login/)
}

export async function logout(page: Page) {
  // Click user menu and logout
  await page.click('button:has-text("Account")')
  await page.click('button:has-text("Sign Out")')
  await page.waitForNavigation()
  await expect(page).toHaveURL(/\//)
}
