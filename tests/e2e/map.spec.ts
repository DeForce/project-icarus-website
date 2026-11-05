import { expect, test } from '@playwright/test'

test.describe('star cartography', () => {
  test('scene mounts and list matches scene markers', async ({ page }) => {
    await page.goto('/map')
    const scene = page.getByTestId('star-scene')
    await expect(scene).toBeVisible()
    await expect(scene).toHaveAttribute('data-markers', '3')
    await expect(page.locator('.map-system-entry')).toHaveCount(3)
    await expect(page.getByRole('button', { name: /Sol/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Proxima Centauri/ })).toBeVisible()
  })

  test('world-class and route-status filters keep list and scene consistent', async ({ page }) => {
    await page.goto('/map')
    const scene = page.getByTestId('star-scene')
    await expect(scene).toHaveAttribute('data-markers', '3')

    await page.getByLabel(/Класс мира/).selectOption('uncolonized')
    await expect(page.locator('.map-system-entry')).toHaveCount(2)
    await expect(scene).toHaveAttribute('data-markers', '2')
    await expect(page.getByRole('button', { name: /Sol/ })).toHaveCount(0)
    // the only open route touches Sol, so it disappears with its endpoint
    await expect(page.locator('.map-list li', { hasText: '→' })).toHaveCount(0)

    await page.getByLabel(/Статус маршрута/).selectOption('open')
    await expect(page.locator('.map-system-entry')).toHaveCount(2)

    await page.getByLabel(/Класс мира/).selectOption('')
    await page.getByLabel(/Статус маршрута/).selectOption('')
    await expect(page.locator('.map-system-entry')).toHaveCount(3)
    await expect(scene).toHaveAttribute('data-markers', '3')
  })

  test('selection syncs with the URL and renders the source card', async ({ page }) => {
    await page.goto('/map')
    await expect(page.getByTestId('star-scene')).toHaveAttribute('data-markers', '3')
    await page.locator('.map-system-entry', { hasText: 'Proxima Centauri' }).click()

    await expect(page).toHaveURL(/[?&]system=/)
    const card = page.locator('.map-card')
    await expect(card).toBeVisible()
    await expect(card).toContainText('SIMBAD')
    await expect(card).toContainText('J2000.0')
    await expect(card).toContainText('св. лет')

    await page.reload()
    await expect(page.locator('.map-card')).toContainText('Proxima Centauri')

    await page.getByRole('button', { name: 'Снять выделение' }).click()
    await expect(page).not.toHaveURL(/[?&]system=/)
    await expect(card).toHaveCount(0)
  })

  test('scene normalizes all system positions inside the fixed grid', async ({ page }) => {
    await page.goto('/map')
    const scene = page.getByTestId('star-scene')
    await expect(scene).toHaveAttribute('data-markers', '3')

    // Mirrors app/utils/map-scale.ts: the farthest scene position (light years)
    // must land on the fit radius, so the whole set stays inside the ±10 grid.
    const expected = await page.evaluate(async () => {
      const LY_PER_PARSEC = 3.26156
      const MAP_FIT_RADIUS = 8.5
      const response = await fetch('/api/public/map')
      const data = (await response.json()) as {
        systems: { astronomy: { distance: number | null } }[]
      }
      const maxDistance = Math.max(...data.systems.map((system) => (system.astronomy.distance ?? 0) * LY_PER_PARSEC), 0)
      return maxDistance > 0 ? MAP_FIT_RADIUS / maxDistance : 1
    })

    const scale = Number(await scene.getAttribute('data-scale'))
    expect(scale).toBeCloseTo(expected, 6)
  })

  test('deep link selects the system without forced navigation', async ({ page }) => {
    await page.goto('/map')
    await expect(page.getByTestId('star-scene')).toHaveAttribute('data-markers', '3')
    const systemId = await page.evaluate(async () => {
      const response = await fetch('/api/public/map')
      const data = (await response.json()) as { systems: { id: string; name: string }[] }
      return data.systems.find((system) => system.name === 'α Centauri A')?.id
    })
    expect(systemId).toBeTruthy()

    await page.goto(`/map?system=${systemId}`)
    await expect(page.locator('.map-card')).toContainText('α Centauri A')
    await expect(page.getByRole('button', { name: 'Центрировать' })).toBeVisible()
  })

  test('text fallback renders when WebGL is unavailable', async ({ browser }) => {
    const restricted = await browser.browserType().launch({ args: ['--disable-webgl'] })
    try {
      const page = await restricted.newPage()
      await page.goto('/map')
      await expect(page.getByText(/текстовом режиме/)).toBeVisible()
      await expect(page.locator('.map-fallback .map-list-name', { hasText: 'Proxima Centauri' })).toBeVisible()
      await expect(page.getByTestId('star-scene')).toHaveCount(0)
    } finally {
      await restricted.close()
    }
  })

  test('phone layout keeps the scene and list usable without horizontal overflow', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'phone', 'phone-only layout check')
    await page.goto('/map')
    await expect(page.getByTestId('star-scene')).toBeVisible()
    await expect(page.locator('.map-system-entry')).toHaveCount(3)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  })
})
