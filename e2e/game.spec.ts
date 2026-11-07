import { expect, test, type Page } from '@playwright/test'

const enemyGrid = (page: Page) => page.getByRole('grid', { name: 'Enemy waters' })
const unexplored = (page: Page) => enemyGrid(page).locator('button[aria-label*="unexplored"]')

async function startBattle(page: Page) {
  await page.goto('/?fast')
  await page.getByRole('button', { name: /Deploy against Ensign Pip/ }).click()
  await page.getByRole('button', { name: 'Randomize' }).click()
  await page.getByRole('button', { name: 'Begin battle' }).click()
  await expect(enemyGrid(page)).toBeVisible()
}

test('title screen locks higher ranks until the previous one is beaten', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Battleship' })).toBeVisible()
  const ranks = page.getByRole('radio')
  await expect(ranks).toHaveCount(4)
  await expect(ranks.nth(0)).toHaveAttribute('aria-checked', 'true')
  await expect(ranks.nth(1)).toHaveAttribute('aria-disabled', 'true')
  await ranks.nth(1).click({ force: true })
  await expect(ranks.nth(0)).toHaveAttribute('aria-checked', 'true')
})

test('manual placement: preview, rotate, pick up, randomize', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Deploy against/ }).click()
  const grid = page.getByRole('grid', { name: 'Your fleet' })
  const cell = (label: string) => grid.getByRole('gridcell', { name: new RegExp(`^${label}\\b`) })

  await cell('A1').hover()
  await expect(grid.locator('.preview-ok')).toHaveCount(5)
  await cell('A7').hover()
  await expect(grid.locator('.preview-bad')).toHaveCount(4)

  await cell('A1').click()
  await expect(grid.locator('.ship')).toHaveCount(5)
  await expect(page.getByText(/Placing the Battleship/)).toBeVisible()

  await page.keyboard.press('r')
  await expect(page.getByText(/4 cells, vertical/)).toBeVisible()
  await cell('C1').click()
  await expect(grid.locator('.ship')).toHaveCount(9)

  await cell('A3').click()
  await expect(grid.locator('.ship')).toHaveCount(4)
  await expect(page.getByText(/Placing the Carrier/)).toBeVisible()

  await expect(page.getByRole('button', { name: /ships to place/ })).toBeDisabled()
  await page.getByRole('button', { name: 'Randomize' }).click()
  await expect(grid.locator('.ship')).toHaveCount(17)
  await expect(page.getByRole('button', { name: 'Begin battle' })).toBeEnabled()
})

test('firing marks the cell, blocks repeats, and the AI answers', async ({ page }) => {
  await startBattle(page)
  const log = page.getByRole('list', { name: 'Battle log' })
  const target = unexplored(page).first()
  const label = (await target.getAttribute('aria-label'))!.split(',')[0]
  await target.click()
  const fired = enemyGrid(page).getByRole('gridcell', { name: new RegExp(`^${label}, (hit|miss)`) })
  await expect(fired).toHaveCount(1)
  await expect(log.getByText(new RegExp(`You fired at ${label}`))).toBeVisible()
  await expect(log.getByText(/Ensign Pip fired at/).first()).toBeVisible()
  await expect(enemyGrid(page).locator('button[aria-disabled="false"]').first()).toBeVisible()
  const shotsBefore = await log.getByText(/You fired/).count()
  await fired.click({ force: true })
  expect(await log.getByText(/You fired/).count()).toBe(shotsBefore)
})

test('keyboard: arrows move focus across the enemy grid and Enter fires', async ({ page }) => {
  await startBattle(page)
  await enemyGrid(page).getByRole('gridcell', { name: /^A1\b/ }).focus()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowDown')
  await expect(enemyGrid(page).getByRole('gridcell', { name: /^B2\b/ })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(enemyGrid(page).getByRole('gridcell', { name: /^B2, (hit|miss)/ })).toBeVisible()
})

test('a full match ends in a dialog, records the campaign, and rematch works', async ({ page }) => {
  await startBattle(page)
  const dialog = page.getByRole('dialog')
  const nextCell = enemyGrid(page)
    .locator('button[aria-label*="unexplored"][aria-disabled="false"]')
    .first()
  for (let i = 0; i < 100; i++) {
    await dialog.or(nextCell).first().waitFor({ timeout: 10_000 })
    if (await dialog.isVisible()) break
    await nextCell.click()
  }
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('heading', { name: /Victory|Defeat/ })).toBeVisible()

  const won = await dialog.getByRole('heading', { name: 'Victory' }).isVisible()
  await dialog.getByRole('button', { name: 'Change opponent' }).click()
  const ranks = page.getByRole('radio')
  await expect(ranks.nth(0).getByText(won ? /1W 0L/ : /0W 1L/)).toBeVisible()
  if (won) await expect(ranks.nth(1)).not.toHaveAttribute('aria-disabled', 'true')

  await page.reload()
  await expect(
    page
      .getByRole('radio')
      .nth(0)
      .getByText(won ? /1W 0L/ : /0W 1L/),
  ).toBeVisible()
})
