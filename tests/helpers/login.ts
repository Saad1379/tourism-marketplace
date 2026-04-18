import type { Page } from "@playwright/test"

export async function login(page: Page, baseUrl: string, email: string, password: string): Promise<void> {
  // Navigate to login page
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" })

  const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first()
  await emailInput.waitFor({ timeout: 20000 })
  await page.waitForLoadState("networkidle")

  // Fill email and wait for change to propagate
  await emailInput.fill(email)
  await page.waitForTimeout(500)

  const passwordInput = page
    .locator('input[type="password"], input[name="password"], input[placeholder*="password" i]')
    .first()
  await passwordInput.waitFor({ timeout: 20000 })

  // Fill password and wait for change to propagate
  await passwordInput.fill(password)
  await page.waitForTimeout(500)

  const loginButton = page
    .locator('button:has-text("Log In"), button:has-text("Sign In"), button:has-text("Login"), button[type="submit"]')
    .first()

  try {
    await loginButton.click()
  } catch (error) {
    // If page closed during click, this is expected with some auth flows
    if (!error.toString().includes("Target page") && !error.toString().includes("closed")) {
      throw error
    }
  }

  // Handle case where page might reload/close during auth
  await Promise.race([
    page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 30000 }).catch(() => {}),
    page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {}),
    page.waitForTimeout(5000),
  ])

  let attempts = 0
  while (page.url().includes("/login") && attempts < 3) {
    await page.waitForLoadState("networkidle").catch(() => {})
    attempts++
  }

  if (page.url().includes("/login")) {
    throw new Error(`Login failed: still on /login after authentication. Final URL: ${page.url()}`)
  }
}
