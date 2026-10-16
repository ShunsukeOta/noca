import { expect, test } from "@playwright/test"

test("installed PWA manifest exposes TODO and today's agenda shortcuts", async ({ page }) => {
  const response = await page.request.get("/manifest.webmanifest")
  expect(response.ok()).toBe(true)
  const manifest = await response.json()
  expect(manifest.shortcuts).toEqual(expect.arrayContaining([
    expect.objectContaining({ name: "TODOを追加", url: "/todo?shortcut=add-todo" }),
    expect.objectContaining({ name: "今日の予定", url: "/calendar?shortcut=today" })
  ]))
})

test("cold TODO view defers calendar, editor and category modules", async ({ browser }) => {
  const context = await browser.newContext({ baseURL: "http://127.0.0.1:4173", serviceWorkers: "block" })
  try {
    const page = await context.newPage()
    const requested = new Set<string>()
    page.on("request", request => requested.add(new URL(request.url()).pathname))
    await page.goto("/todo")
    await expect(page.getByTestId("todo-page")).toBeVisible()
    await expect(page.getByRole("navigation", { name: "メインメニュー" })).toBeVisible()
    expect([...requested].filter(path => /(?:calendar-page|editor-sheet|todo-category-settings)-.*\.js$/.test(path))).toEqual([])

    await page.getByRole("link", { name: "設定を開く" }).click()
    await expect(page.getByTestId("settings-page")).toBeVisible()
    await expect(page.getByRole("group", { name: "テーマ" })).toBeVisible()
    await expect(page.getByRole("list", { name: "TODOカテゴリ一覧" })).toBeVisible()
  } finally {
    await context.close()
  }
})

test("settings header and theme appear while the category module is loading", async ({ browser }) => {
  const context = await browser.newContext({ baseURL: "http://127.0.0.1:4173", serviceWorkers: "block" })
  let releaseChunk: (() => void) | undefined
  const blocked = new Promise<void>(resolve => { releaseChunk = () => resolve() })
  try {
    const page = await context.newPage()
    await page.route(/todo-category-settings-.*\.js$/, async route => {
      await blocked
      await route.continue()
    })
    await page.goto("/todo")
    await page.getByRole("link", { name: "設定を開く" }).click()
    await expect(page.getByTestId("settings-page")).toBeVisible()
    await expect(page.getByRole("group", { name: "テーマ" })).toBeVisible()
    await expect(page.locator('[aria-busy="true"]')).toBeVisible()
    releaseChunk?.()
    await expect(page.getByRole("list", { name: "TODOカテゴリ一覧" })).toBeVisible()
  } finally {
    releaseChunk?.()
    await context.close()
  }
})

test("deferred category manager keeps drag order after storage commits", async ({ browser }) => {
  const context = await browser.newContext({ baseURL: "http://127.0.0.1:4173", viewport: { width: 390, height: 844 }, serviceWorkers: "block" })
  try {
    const page = await context.newPage()
    await page.goto("/settings")
    const list = page.getByRole("list", { name: "TODOカテゴリ一覧" })
    await expect(list).toBeVisible()
    const names = () => list.locator('input[aria-label$="のカテゴリ名"]').evaluateAll(inputs =>
      inputs.map(input => (input as HTMLInputElement).value))
    const original = await names()
    const handle = page.getByRole("button", { name: /おでかけをドラッグして並び替え/ })
    const box = await handle.boundingBox()
    if (!box) throw new Error("ドラッグハンドルが見つかりません。")
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x, y + 105, { steps: 12 })
    await page.mouse.up()

    const storedNames = () => page.evaluate(() => JSON.parse(localStorage.getItem("noca.todo.categories.v1") ?? "[]")
      .map((category: { name: string }) => category.name) as string[])
    await expect.poll(storedNames).not.toEqual(original)
    const saved = await storedNames()
    await expect.poll(names).toEqual(saved)
    await page.reload()
    await expect.poll(names).toEqual(saved)
  } finally {
    await context.close()
  }
})

test("PWA precache keeps both routes and editors available offline", async ({ browser }) => {
  const context = await browser.newContext({ baseURL: "http://127.0.0.1:4173" })
  try {
    const page = await context.newPage()
    await page.goto("/todo")
    await expect(page.getByTestId("todo-page")).toBeVisible()
    await page.evaluate(async () => { await navigator.serviceWorker.ready })
    await page.reload()
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller))

    await context.setOffline(true)
    await page.goto("/calendar")
    await expect(page.getByTestId("calendar-page")).toBeVisible()
    await page.getByRole("link", { name: "設定を開く" }).click()
    await expect(page.getByTestId("settings-page")).toBeVisible()
    await expect(page.getByRole("list", { name: "TODOカテゴリ一覧" })).toBeVisible()
    await page.getByRole("link", { name: "設定を閉じる" }).click()
    await page.getByRole("button", { name: "カレンダーを追加" }).click()
    await expect(page.getByRole("dialog", { name: "予定を追加" })).toBeVisible()
    await page.keyboard.press("Escape")
    await page.getByRole("navigation", { name: "メインメニュー" }).getByRole("link", { name: "TODO" }).click()
    await page.getByRole("button", { name: "TODOを追加" }).click()
    await expect(page.getByRole("dialog", { name: "タスクを追加" })).toBeVisible()
  } finally {
    await context.close()
  }
})
