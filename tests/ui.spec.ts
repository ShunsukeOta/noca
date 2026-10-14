import { test, expect } from "@playwright/test"

for (const width of [375, 390, 430]) {
  test("responsive shell and tabs at " + width + "px", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2
    })
    const page = await context.newPage()
    await page.goto("/")
    await expect(page.getByTestId("todo-page")).toBeVisible()
    await page.screenshot({ path: "test-results/screenshots/todo-" + width + ".png", fullPage: false })
    await expect(page.getByRole("navigation", { name: "メインメニュー" })).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
    expect(overflow).toBe(false)

    await page.getByRole("navigation", { name: "メインメニュー" }).getByRole("link", { name: "カレンダー" }).click()
    await expect(page.getByTestId("calendar-page")).toBeVisible()
    await page.screenshot({ path: "test-results/screenshots/calendar-" + width + ".png", fullPage: false })
    await page.getByRole("button", { name: "次の月" }).click()
    await page.getByRole("navigation", { name: "メインメニュー" }).getByRole("link", { name: "メモ" }).click()
    await expect(page.getByTestId("memo-page")).toBeVisible()
    const overflowAfter = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
    expect(overflowAfter).toBe(false)

    await page.screenshot({ path: "test-results/screenshots/memo-" + width + ".png", fullPage: false })
    await context.close()
  })
}

test("TODO create, edit, delete, undo and persistence", async ({ page }) => {
  await page.goto("/todo")
  await page.getByRole("button", { name: "TODOを追加" }).click()
  await expect(page.getByRole("dialog")).toBeVisible()
  await page.locator("#todo-title").fill("確認用のタスク")
  await page.getByRole("button", { name: "ふたり" }).click()
  await page.getByRole("button", { name: "タスクを追加" }).last().click()
  await expect(page.getByRole("dialog")).toBeHidden()
  await expect(page.getByRole("button", { name: "確認用のタスクを編集" })).toBeVisible()

  await page.reload()
  await expect(page.getByRole("button", { name: "確認用のタスクを編集" })).toBeVisible()
  await page.getByRole("button", { name: "確認用のタスクを編集" }).click()
  await expect(page.locator("#todo-title")).toHaveValue("確認用のタスク")
  await page.locator("#todo-title").fill("編集済みのタスク")
  await page.getByRole("button", { name: "変更を保存" }).click()
  await expect(page.getByRole("button", { name: "編集済みのタスクを編集" })).toBeVisible()

  await page.getByRole("button", { name: "編集済みのタスクを編集" }).click()
  await page.getByRole("button", { name: "このタスクを削除" }).click()
  await expect(page.getByRole("button", { name: "編集済みのタスクを編集" })).toHaveCount(0)
  await page.getByRole("button", { name: "元に戻す" }).click()
  await expect(page.getByRole("button", { name: "編集済みのタスクを編集" })).toBeVisible()
})

test("TODO due date appears on calendar, completion removes it", async ({ page }) => {
  await page.goto("/todo")
  const today = await page.evaluate(() => {
    const d = new Date()
    const pad = (n: number) => String(n).padStart(2, "0")
    return d.getFullYear() + "-" + pad(d.getMonth()+1) + "-" + pad(d.getDate())
  })
  await page.getByRole("button", { name: "TODOを追加" }).click()
  await page.locator("#todo-title").fill("旅行の準備をする")
  await page.locator("#todo-date").fill(today)
  await page.getByRole("button", { name: "タスクを追加" }).last().click()

  await page.getByRole("navigation", { name: "メインメニュー" }).getByRole("link", { name: "カレンダー" }).click()
  await expect(page.getByRole("button", { name: "旅行の準備をするを編集" })).toBeVisible()
  await page.getByRole("navigation", { name: "メインメニュー" }).getByRole("link", { name: "TODO" }).click()
  await page.getByRole("button", { name: "旅行の準備をするを完了" }).click()
  await page.getByRole("navigation", { name: "メインメニュー" }).getByRole("link", { name: "カレンダー" }).click()
  await expect(page.getByRole("button", { name: "旅行の準備をするを編集" })).toHaveCount(0)
})

test("theme switch and mock task completion", async ({ page }) => {
  await page.goto("/todo")
  await page.getByRole("button", { name: "ダークモードに切り替え" }).click()
  await expect(page.locator("html")).toHaveClass(/dark/)
  await page.getByRole("button", { name: "週末のカフェを探すを完了" }).click()
  await page.getByRole("button", { name: /完了したこと/ }).click()
  await expect(page.getByRole("button", { name: "週末のカフェを探すの完了を解除" })).toBeVisible()
})

test("memo search narrows results", async ({ page }) => {
  await page.goto("/memo")
  await page.getByRole("textbox", { name: "メモを検索" }).fill("旅行")
  await expect(page.getByRole("button", { name: "次の旅行のことを開く" })).toBeVisible()
  await expect(page.getByRole("button", { name: "行きたいお店を開く" })).toHaveCount(0)
})

test("three main screens start with content, without redundant page headings", async ({ page }) => {
  for (const [path, label, firstSelector] of [
    ["/todo", "TODO", "section"],
    ["/calendar", "カレンダー", "section"],
    ["/memo", "メモ", "label"]
  ]) {
    await page.goto(path)
    await expect(page.locator("main")).toHaveAttribute("aria-label", label)
    await expect(page.locator("main h1")).toHaveCount(0)
    await expect(page.locator("main").locator(firstSelector).first()).toBeVisible()
  }
})

test("no decorative lead copy remains across three screens or sheets", async ({ page }) => {
  const removed = [
    "今日も、ひとつずつ片付けよう。",
    "今日も一緒に、無理せず。",
    "やることを、ひとつずつ。",
    "ふたりの予定を、ひと目で。",
    "思いついたことも、大切なことも。",
    "YOUR EVERYDAY", "OUR SCHEDULE", "LITTLE NOTES", "SELECTED DAY"
  ]
  for (const path of ["/todo", "/calendar", "/memo"]) {
    await page.goto(path)
    for (const lead of removed) await expect(page.getByText(lead, { exact: true })).toHaveCount(0)
  }
  await page.goto("/todo")
  await page.getByRole("button", { name: "TODOを追加" }).click()
  await expect(page.getByRole("dialog")).toBeVisible()
  await expect(page.getByRole("heading", { name: "タスクを追加" })).toBeVisible()
  await expect(page.getByText("やることを、ひとつずつ。")).toHaveCount(0)
})
