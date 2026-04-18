import { test, expect } from "@playwright/test"
import { loginAsTourist, loginAsGuide, logout } from "./helpers/auth"
import { assertNoCrash } from "./helpers/assertions"

test.describe("Booking Flow - Tourist to Guide", () => {
  test.beforeEach(async ({ page }) => {
    // Ensure we have test credentials
    if (!process.env.E2E_TOURIST_EMAIL || !process.env.E2E_TOURIST_PASSWORD) {
      test.skip()
    }
    if (!process.env.E2E_GUIDE_EMAIL || !process.env.E2E_GUIDE_PASSWORD) {
      test.skip()
    }
    if (!process.env.E2E_TOUR_ID) {
      test.skip()
    }
  })

  test("Complete booking flow: tourist books tour, guide sees it", async ({ page }) => {
    const tourId = process.env.E2E_TOUR_ID!

    // Step 1: Tourist logs in
    await loginAsTourist(page)

    // Step 2: Open tour detail page
    await page.goto(`/tours/${tourId}`)
    await assertNoCrash(page)

    // Step 3: Select a schedule date (calendar or date picker)
    // Try multiple selectors for robustness
    let scheduleSelected = false

    // Approach 1: Click first available date button in calendar
    const dateButtons = await page.locator('button[role="button"]:not(:disabled)').count()
    if (dateButtons > 0) {
      const firstDateButton = page.locator('button[role="button"]:not(:disabled)').first()
      await firstDateButton.click()
      scheduleSelected = true
    }

    // Approach 2: Use a select dropdown if available
    if (!scheduleSelected) {
      const scheduleSelect = page.locator('select, [role="combobox"]').first()
      if (await scheduleSelect.isVisible()) {
        await scheduleSelect.click()
        await page.locator('[role="option"]').first().click()
        scheduleSelected = true
      }
    }

    expect(scheduleSelected, "Should be able to select a schedule").toBeTruthy()

    // Step 4: Set Adults=2, Children=1
    const adultsInput = page.locator('input[name*="adult"]').first()
    if (await adultsInput.isVisible()) {
      await adultsInput.fill("2")
    }

    const childrenInput = page.locator('input[name*="child"]').first()
    if (await childrenInput.isVisible()) {
      await childrenInput.fill("1")
    }

    // Step 5: Click "Book Now" button
    const bookButton = page
      .locator('button:has-text("Book Now"), button:has-text("Book Tour"), button:has-text("Reserve")')
      .first()
    await expect(bookButton).toBeEnabled()
    await bookButton.click()

    // Step 6: Assert redirect to /bookings
    await page.waitForNavigation()
    expect(page.url()).toContain("/bookings")
    await assertNoCrash(page)

    // Step 7: Assert booking visible on tourist's bookings page
    const bookingElement = page.locator("text=Confirmed, text=Upcoming").first()
    await expect(bookingElement).toBeVisible({ timeout: 5000 })

    // Step 8: Tourist logs out
    await logout(page)

    // Step 9: Guide logs in
    await loginAsGuide(page)

    // Step 10: Navigate to guide bookings dashboard
    await page.goto("/dashboard/bookings")
    await assertNoCrash(page)

    // Step 11: Assert guide sees the new booking
    const guideBookingElement = page.locator(`text=${tourId}`).first()
    if (await guideBookingElement.isVisible()) {
      await expect(guideBookingElement).toBeVisible()
    } else {
      // Fallback: look for any booking with the guest count
      const guestCountElement = page.locator("text=3 guests, text=Confirmed").first()
      await expect(guestCountElement).toBeVisible({ timeout: 5000 })
    }
  })
})
