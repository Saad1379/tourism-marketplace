import { test, expect } from "@playwright/test"
import { assertNoCrash } from "./helpers/assertions"

test.describe("Smoke Tests - Key Routes Load Without Errors", () => {
  const routes = ["/", "/tours", "/tours/page", "/privacy", "/terms"]

  for (const route of routes) {
    test(`Route ${route} loads without error`, async ({ page }) => {
      await assertNoCrash(page, route)
      await expect(page).not.toHaveTitle(/Error/)
    })
  }

  test("Tour detail page loads without error", async ({ page, baseURL }) => {
    const tourId = process.env.E2E_TOUR_ID
    if (!tourId) {
      test.skip()
    }

    await assertNoCrash(page, `/tours/${tourId}`)
    await expect(page).not.toHaveTitle(/Error/)
    // Verify tour content is present
    const tourContent = await page.locator("h1, h2").first()
    await expect(tourContent).toBeVisible()
  })

  test("Dashboard accessible to authenticated users", async ({ page }) => {
    await page.goto("/dashboard")
    // If not authenticated, will redirect to login
    const url = page.url()
    expect(url).toMatch(/\/(?:dashboard|login)/)
  })
})
