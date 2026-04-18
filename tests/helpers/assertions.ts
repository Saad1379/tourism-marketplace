import { type Page, expect } from "@playwright/test"

export async function assertNoCrash(page: Page, path?: string) {
  if (path) {
    await page.goto(path)
  }

  // Check for common error indicators
  const pageContent = await page.content()

  // Check for Next.js Application Error
  expect(pageContent).not.toContain("Application error:")
  expect(pageContent).not.toContain("server-side exception")
  expect(pageContent).not.toContain("client-side exception")
  expect(pageContent).not.toContain("500 Internal Server Error")

  // Check page console for errors
  const errors: string[] = []
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(msg.text())
    }
  })

  // Assert no errors were logged
  expect(errors.filter((e) => !e.includes("ResizeObserver"))).toHaveLength(0)
}

export async function assertBookingVisible(page: Page, tourTitle: string, guestCount: number) {
  // Look for booking row/card with tour title and guest count
  const bookingRow = page.locator(`text=${tourTitle} >> text=${guestCount} guest${guestCount !== 1 ? "s" : ""}`)
  await expect(bookingRow).toBeVisible()
}
