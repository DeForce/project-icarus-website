import { expect, test } from '@playwright/test'

test.describe('terminal font', () => {
  test('body text uses the self-hosted Anonymous Pro face', async ({ page }) => {
    await page.goto('/')
    const family = await page.evaluate(() => getComputedStyle(document.body).fontFamily)
    expect(family).toContain('Anonymous Pro')
    await page.evaluate(async () => {
      await document.fonts.load('16px "Anonymous Pro"', '°×«»')
      await document.fonts.load('700 16px "Anonymous Pro"', 'КОРАБЛЯ')
    })
    await expect.poll(() => page.evaluate(() => document.fonts.check('16px "Anonymous Pro"', '°×«»'))).toBe(true)
    await expect.poll(() => page.evaluate(() => document.fonts.check('700 16px "Anonymous Pro"', 'КОРАБЛЯ'))).toBe(true)
  })

  test('serif headings keep the Georgia stack', async ({ page }) => {
    await page.goto('/')
    const family = await page.locator('.terminal-header-title').evaluate((el) => getComputedStyle(el).fontFamily)
    expect(family).toContain('Georgia')
  })

  test('no horizontal overflow from wider cyrillic glyphs', async ({ page }) => {
    for (const path of ['/', '/archive', '/map', '/packages']) {
      await page.goto(path)
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    }
  })
})
