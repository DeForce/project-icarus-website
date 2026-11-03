import type { Locator, Page } from '@playwright/test'

/**
 * Fills a field once the app has hydrated: before hydration Vue owns no event listeners, so an
 * early fill is silently overwritten when the client takes over the server-rendered DOM.
 * Retries until the value sticks for a short settle window.
 */
export async function fillWhenHydrated(page: Page, locator: Locator, value: string): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt++) {
    await locator.fill(value)
    await page.waitForTimeout(150)
    if ((await locator.inputValue()) === value) {
      await page.waitForTimeout(300)
      if ((await locator.inputValue()) === value) return
    }
  }
  throw new Error('Input did not keep its value; the app likely never hydrated')
}
