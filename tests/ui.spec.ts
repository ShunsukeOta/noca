import { test, expect } from "@playwright/test"

for (const width of [375, 390, 430]) {
  test("responsive shell and tabs at " + width + "px", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2
    })
    const page = await context.newPage()
    await page.goto("/")
    await expect(page.getByTestId("todo-page")).toBeVisible()
    await expect(page.getByRole("navigation", { name: "メインメニュー" })).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
    expect(overflow).toBe(false)

    await page.getByRole("navigation", { name: "メインメニュー" }).getByRole("link", { name: "カレンダー" }).click()
    await expect(page.getByTestId("calendar-page")).toBeVisible()
    await page.getByRole("button", { name: "次の月" }).click()
    await page.getByRole("navigation", { name: "メインメニュー" }).getByRole("link", { name: "メモ" }).click()
    await expect(page.getByTestId("memo-page")).toBeVisible()
    const overflowAfter = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
    expect(overflowAfter).toBe(false)

    await page.screenshot({ path: "test-results/screenshots/memo-" + width + ".png", fullPage: true })
    await context.close()
  })
}

test("FAB opens preview sheet and closes without claiming persistence", async ({ page }) => {
  await page.goto("/todo")
  await page.getByRole("button", { name: "TODOを追加" }).click()
  await expect(page.getByRole("dialog")).toBeVisible()
  await expect(page.getByText("保存機能は次のフェーズで実装します。")).toBeVisible()
  await page.getByRole("textbox", { name: "タイトル" }).fill("確認用のタスク")
  await page.getByRole("button", { name: "閉じる" }).last().click()
  await expect(page.getByRole("dialog")).toBeHidden()
})

test("theme switch and mock task completion", async ({ page }) => {
  await page.goto("/todo")
  await page.getByRole("button", { name: "ダークモードに切り替え" }).click()
  await expect(page.locator("html")).toHaveClass(/dark/)
  await page.getByRole("button", { name: "週末のカフェを探すを完了" }).click()
  await expect(page.getByRole("button", { name: "週末のカフェを探すの完了を解除" })).toBeVisible()
})

test("memo search narrows results", async ({ page }) => {
  await page.goto("/memo")
  await page.getByRole("textbox", { name: "メモを検索" }).fill("旅行")
  await expect(page.getByRole("button", { name: "次の旅行のことを開く" })).toBeVisible()
  await expect(page.getByRole("button", { name: "行きたいお店を開く" })).toHaveCount(0)
})
