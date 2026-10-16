import { test, expect, type Page } from "@playwright/test"
import { readFile } from "node:fs/promises"
import { shareInviteUrl, type NativeShareHandler } from "../src/lib/web-share"

const pairedMembers = [
  { id: "A", displayName: "A" },
  { id: "B", displayName: "B" }
]

async function seedPairedWorkspace(page: Page) {
  await page.addInitScript(members => {
    localStorage.setItem("noca.workspace.members.v1", JSON.stringify(members))
  }, pairedMembers)
}

async function seedPreviewFixtures(page: Page) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("noca-test-fixtures-seeded") === "yes") return
    sessionStorage.setItem("noca-test-fixtures-seeded", "yes")
    const date = (offset: number) => {
      const value = new Date()
      value.setDate(value.getDate() + offset)
      const pad = (part: number) => String(part).padStart(2, "0")
      return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
    }
    localStorage.setItem("noca.todos.v1", JSON.stringify([
      { id: "test-t1", title: "週末のカフェを探す", category: "おでかけ", dueDate: date(0), done: false, by: "A" },
      { id: "test-t2", title: "洗剤と柔軟剤を買う", category: "暮らし", dueDate: date(1), done: false, by: "B" },
      { id: "test-t3", title: "旅行の宿泊先を決める", category: "ふたり", dueDate: date(4), done: false, by: "A" },
      { id: "test-t4", title: "部屋の片付け", category: "暮らし", done: false, by: "B" },
      { id: "test-t5", title: "次のお出かけの候補を送る", category: "おでかけ", done: true, by: "B" }
    ]))
    localStorage.setItem("noca.calendar.events.v1", JSON.stringify([
      { id: "test-e1", title: "夜ごはん", date: date(0), time: "19:00", endTime: "20:30", category: "ふたり", by: "A" },
      { id: "test-e2", title: "ランチに行く", date: date(2), time: "12:30", category: "おでかけ", by: "B" },
      { id: "test-e3", title: "買い出し", date: date(4), time: "15:00", category: "暮らし", by: "A" },
      { id: "test-e4", title: "映画を観る", date: date(9), time: "18:00", category: "おでかけ", by: "B" },
      { id: "test-demo-a-morning", title: "午前の用事", date: date(0), time: "09:00", endTime: "14:00", category: "暮らし", address: "駅前", by: "A" },
      { id: "test-demo-b-hair", title: "美容室", date: date(0), time: "11:00", endTime: "14:40", category: "おでかけ", by: "B" },
      { id: "test-demo-a-payday", title: "給料日", date: date(0), category: "暮らし", by: "A" },
      { id: "test-demo-b-dayoff", title: "お休み", date: date(0), category: "ふたり", by: "B" },
      { id: "test-demo-next-a", title: "買い物に行く", date: date(1), time: "09:30", endTime: "13:30", category: "暮らし", by: "A" },
      { id: "test-demo-next-b", title: "友だちとランチ", date: date(1), time: "11:15", endTime: "14:40", category: "おでかけ", by: "B" },
      { id: "test-demo-next-a-all", title: "在宅の日", date: date(1), category: "暮らし", by: "A" },
      { id: "test-demo-next-b-all", title: "休暇", date: date(1), category: "ふたり", by: "B" },
      { id: "test-demo-v3-a-meeting", title: "打ち合わせ", date: date(0), time: "11:00", endTime: "12:00", category: "暮らし", by: "A" },
      { id: "test-demo-v3-both-all", title: "記念日", date: date(0), category: "ふたり", by: "both" },
      { id: "test-demo-v3-both-timed", title: "ふたりで買い物", date: date(0), time: "15:00", endTime: "16:30", category: "ふたり", by: "both" },
      { id: "test-demo-v3-next-both", title: "夜の散歩", date: date(1), time: "19:00", endTime: "20:00", category: "ふたり", by: "both" }
    ]))
  })
}

// Existing A/B behavior tests explicitly use a paired preview. Solo-first behavior
// is covered in an isolated, unseeded browser context below.
test.beforeEach(async ({ page }) => {
  await seedPairedWorkspace(page)
  await seedPreviewFixtures(page)
})

for (const width of [375, 390, 430]) {
  test("responsive shell and tabs at " + width + "px", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2
    })
    const page = await context.newPage()
    await page.goto("/")
    await expect(page.getByTestId("todo-page")).toBeVisible()
    await page.waitForTimeout(260)
    await page.screenshot({ path: "test-results/screenshots/todo-" + width + ".png", fullPage: false })
    await expect(page.getByRole("navigation", { name: "メインメニュー" })).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
    expect(overflow).toBe(false)

    await page.getByRole("navigation", { name: "メインメニュー" }).getByRole("link", { name: "カレンダー" }).click()
    await expect(page.getByTestId("calendar-page")).toBeVisible()
    await page.waitForTimeout(260)
    await page.screenshot({ path: "test-results/screenshots/calendar-" + width + ".png", fullPage: false })
    await page.getByRole("button", { name: "次の月" }).click()
    await page.getByRole("navigation", { name: "メインメニュー" }).getByRole("link", { name: "メモ" }).click()
    await expect(page.getByTestId("memo-page")).toBeVisible()
    const overflowAfter = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
    expect(overflowAfter).toBe(false)

    await page.waitForTimeout(260)
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
  await expect(page.locator("#todo-title")).toHaveValue("")
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(page.getByRole("button", { name: "確認用のタスクを編集" })).toBeVisible()

  await page.reload()
  await expect(page.getByRole("button", { name: "確認用のタスクを編集" })).toBeVisible()
  await page.getByRole("button", { name: "確認用のタスクを編集" }).click()
  await expect(page.locator("#todo-title")).toHaveValue("確認用のタスク")
  await page.locator("#todo-title").fill("編集済みのタスク")
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(page.getByRole("button", { name: "編集済みのタスクを編集" })).toBeVisible()

  await page.getByRole("button", { name: "編集済みのタスクを編集" }).click()
  await page.getByRole("button", { name: "このタスクを削除" }).click()
  await expect(page.getByRole("button", { name: "編集済みのタスクを編集" })).toHaveCount(0)
  await page.getByRole("button", { name: "元に戻す" }).click()
  await expect(page.getByRole("button", { name: "編集済みのタスクを編集" })).toBeVisible()

  await page.getByRole("button", { name: "TODOを追加" }).click()
  await page.locator("#todo-title").fill("閉じると追加されるタスク")
  await page.keyboard.press("Escape")
  await expect(page.getByRole("button", { name: "閉じると追加されるタスクを編集" })).toBeVisible()
})

test("PWA shortcuts open TODO creation and today's calendar agenda", async ({ page }) => {
  await page.goto("/todo?shortcut=add-todo")
  await expect(page.getByRole("dialog", { name: "タスクを追加" })).toBeVisible()
  await expect(page).toHaveURL(/\/todo$/)
  await page.keyboard.press("Escape")

  await page.goto("/calendar")
  const today = await page.evaluate(() => {
    const value = new Date()
    const pad = (part: number) => String(part).padStart(2, "0")
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
  })
  const anotherDay = await page.locator("[data-calendar-date]").evaluateAll((elements, currentDate) => {
    const date = elements.find(element => (element as HTMLButtonElement).getAttribute("data-calendar-date") !== currentDate)
    return date?.getAttribute("data-calendar-date") ?? null
  }, today)
  if (!anotherDay) throw new Error("今日以外の日付が見つかりません。")
  await page.locator(`[data-calendar-date="${anotherDay}"]`).click()

  await page.evaluate(() => {
    window.history.pushState({}, "", "/calendar?shortcut=today")
    window.dispatchEvent(new PopStateEvent("popstate"))
  })
  await expect(page.locator(`[data-calendar-date="${today}"]`)).toHaveAttribute("aria-pressed", "true")
  await expect(page).toHaveURL(/\/calendar$/)
})

test("invite sharing sends the link through the native share sheet and treats dismissal as cancellation", async () => {
  const payloads: ShareData[] = []
  const successfulShare: NativeShareHandler = async data => { payloads.push(data) }
  const inviteUrl = "https://noca.example/join#test-invite-token"

  expect(await shareInviteUrl(inviteUrl, successfulShare)).toBe("shared")
  expect(payloads).toEqual([{
    title: "nocaへの招待",
    text: "nocaの共有スペースに招待します。",
    url: inviteUrl
  }])

  const dismissedShare: NativeShareHandler = async () => { throw new DOMException("Share dismissed", "AbortError") }
  expect(await shareInviteUrl(inviteUrl, dismissedShare)).toBe("cancelled")
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
  await page.getByText("詳細を入力", { exact: true }).click()
  await page.locator("#todo-date").fill(today)
  await page.getByRole("button", { name: "タスクを追加" }).last().click()
  await expect(page.locator("#todo-title")).toHaveValue("")
  await page.keyboard.press("Escape")

  await page.getByRole("navigation", { name: "メインメニュー" }).getByRole("link", { name: "カレンダー" }).click()
  await expect(page.getByRole("button", { name: "旅行の準備をするを編集" })).toBeVisible()
  await page.getByRole("navigation", { name: "メインメニュー" }).getByRole("link", { name: "TODO" }).click()
  await page.getByRole("checkbox", { name: "旅行の準備をするを完了" }).click()
  await page.getByRole("navigation", { name: "メインメニュー" }).getByRole("link", { name: "カレンダー" }).click()
  await expect(page.getByRole("button", { name: "旅行の準備をするを編集" })).toHaveCount(0)
})

test("theme switch and task completion", async ({ page }) => {
  await page.goto("/todo")
  await expect(page.getByRole("button", { name: "ダークモードに切り替え" })).toHaveCount(0)
  await page.getByRole("link", { name: "設定を開く" }).click()
  await page.getByRole("group", { name: "テーマ" }).getByRole("button", { name: "ダーク" }).click()
  await expect(page.locator("html")).toHaveClass(/dark/)
  await page.getByRole("button", { name: "前の画面に戻る" }).click()
  await page.getByRole("checkbox", { name: "週末のカフェを探すを完了" }).click()
  await page.getByRole("button", { name: /完了したこと/ }).click()
  await expect(page.getByRole("checkbox", { name: "週末のカフェを探すの完了を解除" })).toBeVisible()
})

test("completed TODOs can be restored or permanently removed", async ({ page }) => {
  await page.goto("/todo")
  await page.getByRole("button", { name: /完了したこと/ }).click()

  await expect(page.getByRole("button", { name: "次のお出かけの候補を送るを未完了に戻す" })).toBeVisible()
  await expect(page.getByRole("button", { name: "次のお出かけの候補を送るを完全に削除" })).toBeVisible()
  await page.getByRole("button", { name: "次のお出かけの候補を送るを未完了に戻す" }).click()
  await expect(page.getByRole("checkbox", { name: "次のお出かけの候補を送るを完了" })).toBeVisible()

  await page.getByRole("checkbox", { name: "次のお出かけの候補を送るを完了" }).click()
  await page.getByRole("button", { name: "次のお出かけの候補を送るを完全に削除" }).click()
  await expect(page.getByRole("button", { name: "次のお出かけの候補を送るを編集" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "元に戻す" })).toHaveCount(0)
  const storedTodos = await page.evaluate(() => JSON.parse(localStorage.getItem("noca.todos.v1") ?? "[]") as Array<{ id: string }>)
  expect(storedTodos.some(todo => todo.id === "test-t5")).toBe(false)
})

test("memo tab remains in navigation and shows only its development notice", async ({ page }) => {
  await page.goto("/memo")
  await expect(page.getByTestId("memo-page")).toHaveText("メモ機能は開発中です")
  await expect(page.getByRole("navigation", { name: "メインメニュー" }).getByRole("link", { name: "メモ" })).toHaveAttribute("aria-current", "page")
  await expect(page.getByTestId("dock-add-button")).toHaveCount(0)
})

test("TODO and calendar start with content, without redundant page headings", async ({ page }) => {
  for (const [path, label, firstSelector] of [
    ["/todo", "TODO", "section"],
    ["/calendar", "カレンダー", "section"]
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
  await expect(page.getByRole("dialog", { name: "タスクを追加" })).toBeVisible()
  await expect(page.getByText("やることを、ひとつずつ。")).toHaveCount(0)
})


test("settings icon opens the page; theme setting persists; back returns to the source tab", async ({ page }) => {
  await page.goto("/calendar")
  await page.getByRole("link", { name: "設定を開く" }).click()
  await expect(page).toHaveURL(/\/settings$/)
  await expect(page.getByTestId("settings-page")).toBeVisible()
  await expect(page.locator("main")).toHaveAttribute("aria-label", "設定")
  await expect(page.getByRole("heading", { name: "設定" })).toBeVisible()
  await expect(page.getByRole("button", { name: "カレンダーを追加" })).toHaveCount(0)
  await expect(page.getByTestId("bottom-dock")).toHaveCount(0)
  await expect(page.getByRole("navigation", { name: "メインメニュー" })).toHaveCount(0)
  await expect(page.getByRole("link", { name: "設定を閉じる" })).toBeVisible()

  await page.getByRole("group", { name: "テーマ" }).getByRole("button", { name: "ダーク" }).click()
  await expect(page.locator("html")).toHaveClass(/dark/)
  await page.reload()
  await expect(page.locator("html")).toHaveClass(/dark/)
  await expect(page.getByRole("group", { name: "テーマ" }).getByRole("button", { name: "ダーク" })).toHaveAttribute("aria-pressed", "true")
  await page.getByRole("link", { name: "設定を閉じる" }).click()
  await expect(page.getByTestId("calendar-page")).toBeVisible()
})

test("settings exports a versioned local backup without changing stored data", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined })
  })
  await page.goto("/settings")
  await page.evaluate(() => {
    localStorage.setItem("noca.todos.v1", JSON.stringify([
      { id: "backup-task", title: "保険の書類", category: "自分用", dueDate: "2026-10-22", memo: "住所確認", done: false, by: "B" }
    ]))
    localStorage.setItem("noca.todo.categories.v1", JSON.stringify([
      { id: "backup-category", name: "自分用", tone: "mint" }
    ]))
    localStorage.setItem("noca.calendar.events.v1", JSON.stringify([
      { id: "backup-event", title: "病院", date: "2026-10-22", time: "10:00", endTime: "11:00", address: "中央区", category: "暮らし", by: "both" }
    ]))
    localStorage.setItem("noca.calendar.samples.v2", "done")
    localStorage.setItem("noca.calendar.samples.v3", "done")
  })
  await page.reload()
  await expect(page.getByText("TODO・カテゴリ・予定をJSONで保存・復元できます。TODO・予定の詳細メモや住所も含み、復元時は内容を確認して置き換えます。")).toBeVisible()
  const before = await page.evaluate(() => [
    localStorage.getItem("noca.todos.v1"),
    localStorage.getItem("noca.todo.categories.v1"),
    localStorage.getItem("noca.calendar.events.v1"),
    localStorage.getItem("noca.calendar.samples.v2"),
    localStorage.getItem("noca.calendar.samples.v3")
  ])
  const downloadPromise = page.waitForEvent("download")
  await page.getByRole("button", { name: "バックアップを書き出す" }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^noca-backup-\d{4}-\d{2}-\d{2}\.json$/)
  const path = await download.path()
  expect(path).not.toBeNull()
  const backup = JSON.parse(await readFile(path as string, "utf8"))
  expect(backup).toMatchObject({ format: "noca.local-backup", version: 1 })
  expect(backup.exportedAt).toEqual(expect.any(String))
  expect(backup.localState.calendarSampleMigrations).toEqual({ v2: true, v3: true })
  expect(backup.data.todos[0]).toMatchObject({ id: "backup-task", title: "保険の書類", memo: "住所確認", by: "B" })
  expect(backup.data.todoCategories[0]).toMatchObject({ id: "backup-category", name: "自分用", tone: "mint" })
  expect(backup.data.calendarEvents[0]).toMatchObject({ id: "backup-event", title: "病院", address: "中央区", by: "both" })
  await expect(page.getByRole("status").first()).toHaveText("バックアップファイルを保存しました。")
  const after = await page.evaluate(() => [
    localStorage.getItem("noca.todos.v1"),
    localStorage.getItem("noca.todo.categories.v1"),
    localStorage.getItem("noca.calendar.events.v1"),
    localStorage.getItem("noca.calendar.samples.v2"),
    localStorage.getItem("noca.calendar.samples.v3")
  ])
  expect(after).toEqual(before)
})

test("backup restore previews counts, preserves data on cancel, and replaces all local records on confirmation", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 })
  await page.goto("/settings")
  const today = await page.evaluate(() => {
    const date = new Date()
    const pad = (value: number) => String(value).padStart(2, "0")
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  })
  await page.evaluate(date => {
    localStorage.setItem("noca.todos.v1", JSON.stringify([
      { id: "old-task", title: "置き換え前", category: "古い", done: false, by: "A" }
    ]))
    localStorage.setItem("noca.todo.categories.v1", JSON.stringify([
      { id: "old-category", name: "古い", tone: "neutral" }
    ]))
    localStorage.setItem("noca.calendar.events.v1", JSON.stringify([
      { id: "old-event", title: "置き換え前の予定", date, category: "暮らし", by: "A" }
    ]))
    localStorage.setItem("noca.calendar.samples.v2", "done")
    localStorage.setItem("noca.calendar.samples.v3", "done")
  }, today)
  await page.reload()
  const storedSnapshot = () => page.evaluate(() => [
    localStorage.getItem("noca.todos.v1"),
    localStorage.getItem("noca.todo.categories.v1"),
    localStorage.getItem("noca.calendar.events.v1"),
    localStorage.getItem("noca.calendar.samples.v2"),
    localStorage.getItem("noca.calendar.samples.v3")
  ])
  const before = await storedSnapshot()
  const backup = {
    format: "noca.local-backup",
    version: 1,
    exportedAt: "2026-10-15T01:00:00.000Z",
    localState: { calendarSampleMigrations: { v2: false, v3: true } },
    data: {
      todos: [{ id: "restored-task", title: "復元されたTODO", category: "検証", dueDate: today, memo: "詳細", done: false, by: "B" }],
      todoCategories: [{ id: "restored-category", name: "検証", tone: "mint" }],
      calendarEvents: [{ id: "restored-event", title: "復元された予定", date: today, time: "10:00", endTime: "11:00", category: "暮らし", by: "both" }]
    }
  }
  const file = { name: "noca-backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backup)) }
  const fileInput = page.getByLabel("バックアップファイルを選択")
  await fileInput.setInputFiles(file)
  const dialog = page.getByRole("dialog", { name: "バックアップを復元しますか？" })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText("TODO")
  await expect(dialog).toContainText("カテゴリ")
  await expect(dialog).toContainText("予定")
  await page.screenshot({ path: "test-results/screenshots/backup-restore-confirm-320.png" })
  expect(await storedSnapshot()).toEqual(before)
  await dialog.getByRole("button", { name: "キャンセル" }).click()
  await expect(dialog).toHaveCount(0)
  expect(await storedSnapshot()).toEqual(before)

  await fileInput.setInputFiles(file)
  await expect(dialog).toBeVisible()
  await dialog.getByRole("button", { name: "置き換えて復元" }).click()
  await expect(page.getByRole("status").last()).toHaveText("バックアップを復元しました。")
  const restored = await page.evaluate(() => ({
    todos: JSON.parse(localStorage.getItem("noca.todos.v1") || "[]"),
    categories: JSON.parse(localStorage.getItem("noca.todo.categories.v1") || "[]"),
    events: JSON.parse(localStorage.getItem("noca.calendar.events.v1") || "[]"),
    migrationV2: localStorage.getItem("noca.calendar.samples.v2"),
    migrationV3: localStorage.getItem("noca.calendar.samples.v3")
  }))
  expect(restored.todos).toMatchObject([{ id: "restored-task", title: "復元されたTODO", memo: "詳細", by: "B" }])
  expect(restored.categories).toMatchObject([{ id: "restored-category", name: "検証", tone: "mint" }])
  expect(restored.events).toMatchObject([{ id: "restored-event", title: "復元された予定", by: "both" }])
  expect(restored.migrationV2).toBeNull()
  expect(restored.migrationV3).toBe("done")
  await page.goto("/todo")
  await expect(page.getByRole("button", { name: "復元されたTODOを編集" })).toBeVisible()
  await page.reload()
  await expect(page.getByRole("button", { name: "復元されたTODOを編集" })).toBeVisible()
  await page.getByRole("navigation", { name: "メインメニュー" }).getByRole("link", { name: "カレンダー" }).click()
  await expect(page.getByRole("button", { name: "復元された予定を編集" })).toBeVisible()
})

test("invalid backup is rejected without changing local data", async ({ page }) => {
  await page.goto("/settings")
  const before = await page.evaluate(() => [
    localStorage.getItem("noca.todos.v1"),
    localStorage.getItem("noca.todo.categories.v1"),
    localStorage.getItem("noca.calendar.events.v1")
  ])
  const fileInput = page.getByLabel("バックアップファイルを選択")
  const restoreDialog = page.getByRole("dialog", { name: "バックアップを復元しますか？" })
  await fileInput.setInputFiles({
    name: "invalid.json", mimeType: "application/json", buffer: Buffer.from("{broken json")
  })
  await expect(page.getByRole("status").last()).toHaveText("JSONファイルを読み取れません。")
  await expect(restoreDialog).toHaveCount(0)
  await fileInput.setInputFiles({
    name: "unsupported.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ format: "noca.local-backup", version: 2 }))
  })
  await expect(page.getByRole("status").last()).toHaveText("このバックアップのバージョンには対応していません。")
  await expect(restoreDialog).toHaveCount(0)
  const after = await page.evaluate(() => [
    localStorage.getItem("noca.todos.v1"),
    localStorage.getItem("noca.todo.categories.v1"),
    localStorage.getItem("noca.calendar.events.v1")
  ])
  expect(after).toEqual(before)
})

test("failed backup storage write rolls back earlier keys without changing the app state", async ({ page }) => {
  await page.goto("/settings")
  await page.evaluate(() => {
    localStorage.setItem("noca.todos.v1", JSON.stringify([
      { id: "safe-task", title: "残しておくTODO", category: "保管", done: false, by: "A" }
    ]))
    localStorage.setItem("noca.todo.categories.v1", JSON.stringify([
      { id: "safe-category", name: "保管", tone: "blue" }
    ]))
    localStorage.setItem("noca.calendar.events.v1", JSON.stringify([]))
  })
  await page.reload()
  const storedSnapshot = () => page.evaluate(() => [
    localStorage.getItem("noca.todos.v1"),
    localStorage.getItem("noca.todo.categories.v1"),
    localStorage.getItem("noca.calendar.events.v1"),
    localStorage.getItem("noca.calendar.samples.v2"),
    localStorage.getItem("noca.calendar.samples.v3")
  ])
  const before = await storedSnapshot()
  await page.evaluate(() => {
    const originalSetItem = Storage.prototype.setItem
    let failOnce = true
    Storage.prototype.setItem = function (key, value) {
      if (failOnce && key === "noca.calendar.events.v1") {
        failOnce = false
        throw new DOMException("Storage is full", "QuotaExceededError")
      }
      return originalSetItem.call(this, key, value)
    }
  })
  const backup = {
    format: "noca.local-backup",
    version: 1,
    exportedAt: "2026-10-15T01:00:00.000Z",
    localState: { calendarSampleMigrations: { v2: false, v3: false } },
    data: {
      todos: [{ id: "unsafe-task", title: "適用されないTODO", category: "新規", done: false, by: "B" }],
      todoCategories: [{ id: "new-category", name: "新規", tone: "mint" }],
      calendarEvents: []
    }
  }
  await page.getByLabel("バックアップファイルを選択").setInputFiles({
    name: "noca-backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backup))
  })
  const dialog = page.getByRole("dialog", { name: "バックアップを復元しますか？" })
  await expect(dialog).toBeVisible()
  await dialog.getByRole("button", { name: "置き換えて復元" }).click()
  await expect(page.getByRole("status").last()).toHaveText("保存に失敗したため、現在のデータを元に戻しました。空き容量を確認して再試行してください。")
  expect(await storedSnapshot()).toEqual(before)
  await page.goto("/todo")
  await expect(page.getByRole("button", { name: "残しておくTODOを編集" })).toBeVisible()
  await expect(page.getByRole("button", { name: "適用されないTODOを編集" })).toHaveCount(0)
})

test("settings is reachable on small iPhone widths with no horizontal overflow", async ({ browser }) => {
  for (const width of [320, 375, 390, 430]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true })
    const page = await context.newPage()
    await page.goto("/memo")
    await page.getByRole("link", { name: "設定を開く" }).click()
    await expect(page.getByTestId("settings-page")).toBeVisible()
    await expect(page.getByText("相手を招待")).toBeVisible()
    await expect(page.getByText("クラウド同期")).toBeVisible()
    await expect(page.locator("main").getByText("準備中")).toHaveCount(6)
    const backupButton = page.getByRole("button", { name: "バックアップを書き出す" })
    await expect(backupButton).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
    expect(overflow).toBe(false)
    await page.screenshot({ path: "test-results/screenshots/settings-" + width + ".png", fullPage: false })
    await backupButton.scrollIntoViewIfNeeded()
    await page.screenshot({ path: "test-results/screenshots/settings-data-" + width + ".png", fullPage: false })
    await page.getByRole("button", { name: "前の画面に戻る" }).click()
    await expect(page.getByTestId("memo-page")).toBeVisible()
    await context.close()
  }
})

test("empty TODO categories delete directly while categories with TODOs require a destination", async ({ page }) => {
  await page.goto("/settings")
  await page.getByRole("button", { name: "その他を削除" }).click()
  const emptyCategoryDialog = page.getByRole("dialog", { name: "カテゴリを削除しますか？" })
  await expect(emptyCategoryDialog).toBeVisible()
  await expect(emptyCategoryDialog.getByLabel("移動先")).toHaveCount(0)
  await emptyCategoryDialog.getByRole("button", { name: "削除する" }).click()
  await expect(page.getByTestId("todo-category-その他")).toHaveCount(0)

  await page.getByRole("button", { name: "おでかけを削除" }).click()
  const usedCategoryDialog = page.getByRole("dialog", { name: "カテゴリを削除しますか？" })
  await expect(usedCategoryDialog.getByLabel("移動先")).toBeVisible()
  await expect(usedCategoryDialog.getByText("対象のTODO：2件")).toBeVisible()
  await expect(usedCategoryDialog.getByRole("button", { name: "移動して削除" })).toBeVisible()
  await usedCategoryDialog.getByRole("button", { name: "キャンセル" }).click()
})


test("opening an editor does not immediately show the iPhone keyboard", async ({ page }) => {
  await page.goto("/todo")
  await page.getByRole("button", { name: "TODOを追加" }).click()
  await expect(page.getByRole("dialog")).toBeVisible()
  await expect(page.locator("#todo-title")).not.toBeFocused()
  await expect(page.getByRole("dialog")).toHaveAttribute("data-keyboard-open", "false")
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog")).toBeHidden()
})

test("keyboard-sized visual viewport keeps the drawer and save action above it", async ({ page }) => {
  await page.addInitScript(() => {
    const viewport = Object.assign(new EventTarget(), {
      height: window.innerHeight,
      offsetTop: 0,
      width: window.innerWidth
    })
    Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport })
  })

  await page.goto("/todo")
  await page.getByRole("button", { name: "TODOを追加" }).click()
  await page.locator("#todo-title").focus()

  await page.evaluate(() => {
    const viewport = window.visualViewport as VisualViewport & { height: number }
    viewport.height = window.innerHeight - 330
    viewport.dispatchEvent(new Event("resize"))
  })

  const dialog = page.getByRole("dialog")
  await expect(dialog).toHaveAttribute("data-keyboard-open", "true")
  const geometry = await page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>('[role="dialog"]')!
    const save = panel.querySelector<HTMLButtonElement>('button[type="submit"]')!
    const keyboardTop = window.innerHeight - 330
    return {
      panelBottom: panel.getBoundingClientRect().bottom,
      panelTop: panel.getBoundingClientRect().top,
      buttonBottom: save.getBoundingClientRect().bottom,
      keyboardTop,
      maxHeight: parseFloat(getComputedStyle(panel).maxHeight)
    }
  })
  expect(geometry.panelBottom).toBeLessThanOrEqual(geometry.keyboardTop + 2)
  expect(geometry.buttonBottom).toBeLessThanOrEqual(geometry.keyboardTop + 2)
  expect(geometry.panelTop).toBeGreaterThanOrEqual(-3)
  expect(geometry.maxHeight).toBeLessThanOrEqual(geometry.keyboardTop)

  await page.evaluate(() => {
    const viewport = window.visualViewport as VisualViewport & { height: number }
    viewport.height = window.innerHeight
    viewport.dispatchEvent(new Event("resize"))
  })
  await expect(dialog).toHaveAttribute("data-keyboard-open", "false")
})


test("task rows animate out instead of disappearing instantly", async ({ page }) => {
  await page.goto("/todo")
  const row = page.locator('[data-todo-row="t1"]')
  await expect(row).toBeVisible()
  await page.getByRole("checkbox", { name: "週末のカフェを探すを完了" }).click()
  // AnimatePresence retains the removed item briefly for its exit animation.
  await expect(row).toHaveCount(1)
  await expect(row).toHaveCount(0)
  await page.getByRole("button", { name: /完了したこと/ }).click()
  await expect(page.getByRole("checkbox", { name: "週末のカフェを探すの完了を解除" })).toBeVisible()
})

test("tab and settings routes transition and remain usable with reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/todo")
  await expect(page.locator('[data-page-transition="/todo"]')).toBeVisible()
  await page.getByRole("navigation", { name: "メインメニュー" }).getByRole("link", { name: "カレンダー" }).click()
  await expect(page.locator('[data-page-transition="/calendar"]')).toBeVisible()
  await page.getByRole("button", { name: "次の月" }).click()
  await page.getByRole("navigation", { name: "メインメニュー" }).getByRole("link", { name: "メモ" }).click()
  await expect(page.locator('[data-page-transition="/memo"]')).toBeVisible()
  await expect(page.getByTestId("memo-page")).toHaveText("メモ機能は開発中です")
  await expect(page.getByTestId("dock-add-button")).toHaveCount(0)
  await page.getByRole("link", { name: "設定を開く" }).click()
  await expect(page.getByTestId("settings-page")).toBeVisible()
  await expect(page.locator('[data-page-transition="/settings"]')).toHaveCount(0)
  await page.getByRole("link", { name: "設定を閉じる" }).click()
  await expect(page.getByTestId("memo-page")).toBeVisible()
})


test("calendar events: create, edit, persistent storage and leap day", async ({ page }) => {
  await page.goto("/calendar")
  await expect(page.getByTestId("calendar-page")).toBeVisible()
  await page.getByRole("button", { name: "カレンダーを追加" }).click()
  await expect(page.getByRole("heading", { name: "予定を追加" })).toBeVisible()
  await expect(page.locator("#event-title")).not.toBeFocused()
  await page.locator("#event-title").fill("テスト用の予定")
  await page.getByRole("switch", { name: "終日" }).click()
  await page.locator("#event-start").fill("17:00")
  await page.locator("#event-end").fill("16:00")
  await page.getByRole("button", { name: "予定を追加" }).last().click()
  await expect(page.getByRole("alert")).toHaveText("終了時間は開始時間より後にしてください")
  await page.locator("#event-end").fill("18:30")
  await page.getByText("詳細を追加（任意）").click()
  await page.locator("#event-address").fill("駅前のカフェ")
  await page.getByRole("group", { name: "カテゴリ" }).getByRole("button", { name: "おでかけ" }).click()
  await page.getByRole("button", { name: "予定を追加" }).last().click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(page.getByRole("button", { name: "テスト用の予定を編集" })).toBeVisible()
  await expect(page.getByText("17:00–18:30", { exact: false })).toBeVisible()

  await page.reload()
  await expect(page.getByRole("button", { name: "テスト用の予定を編集" })).toBeVisible()
  await page.getByRole("button", { name: "テスト用の予定を編集" }).click()
  await expect(page.locator("#event-title")).toHaveValue("テスト用の予定")
  await expect(page.locator("#event-address")).toHaveValue("駅前のカフェ")
  await page.locator("#event-title").fill("うるう日の予定")
  await page.locator("#event-date").fill("2028-02-29")
  await page.getByRole("button", { name: "変更を保存" }).click()
  await expect(page.getByRole("heading", { name: "2028年 2月" })).toBeVisible()
  await expect(page.locator('[data-calendar-date="2028-02-29"]')).toBeVisible()
  await expect(page.getByRole("button", { name: "うるう日の予定を編集" })).toBeVisible()
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("noca.calendar.events.v1") || "[]"))
  expect(saved.some((event: { title: string; date: string }) => event.title === "うるう日の予定" && event.date === "2028-02-29")).toBe(true)
})

test("calendar event deletion can be undone without duplicating TODOs", async ({ page }) => {
  await page.goto("/calendar")
  await expect(page.getByRole("button", { name: "夜ごはんを編集" })).toBeVisible()
  await page.getByRole("button", { name: "夜ごはんを編集" }).click()
  await page.getByRole("button", { name: "この予定を削除" }).click()
  await expect(page.getByRole("button", { name: "夜ごはんを編集" })).toHaveCount(0)
  await page.getByRole("button", { name: "元に戻す" }).click()
  await expect(page.getByRole("button", { name: "夜ごはんを編集" })).toBeVisible()
  await expect(page.getByRole("button", { name: "週末のカフェを探すを編集" })).toBeVisible()
})

test("calendar FAB uses the selected day and date changes refresh the agenda", async ({ page }) => {
  await page.goto("/calendar")
  const tomorrow = await page.evaluate(() => {
    const now = new Date()
    now.setDate(now.getDate() + 1)
    const pad = (x: number) => String(x).padStart(2, "0")
    return now.getFullYear() + "-" + pad(now.getMonth()+1) + "-" + pad(now.getDate())
  })
  await page.locator('[data-calendar-date="' + tomorrow + '"]').click()
  await page.getByRole("button", { name: "カレンダーを追加" }).click()
  await expect(page.locator("#event-date")).toHaveValue(tomorrow)
  await page.locator("#event-title").fill("翌日の予定")
  await page.getByRole("button", { name: "予定を追加" }).last().click()
  await expect(page.getByRole("button", { name: "翌日の予定を編集" })).toBeVisible()
  await page.getByRole("button", { name: "今日", exact: true }).click()
  await expect(page.getByRole("button", { name: "翌日の予定を編集" })).toHaveCount(0)
})

test("calendar drawer stays within mobile width with time and details expanded", async ({ browser }) => {
  for (const width of [320, 375, 390, 430]) {
    const context = await browser.newContext({ viewport: { width, height: 760 }, isMobile: true, hasTouch: true })
    const page = await context.newPage()
    await page.goto("/calendar")
    await page.getByRole("button", { name: "カレンダーを追加" }).click()
    await page.getByRole("switch", { name: "終日" }).click()
    await page.getByText("詳細を追加（任意）").click()
    await expect(page.locator("#event-memo")).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
    expect(overflow).toBe(false)
    await page.screenshot({ path: "test-results/screenshots/calendar-editor-" + width + ".png", fullPage: false })
    await context.close()
  }
})


test("header stays fixed at the top while scrolling across all tabs and settings", async ({ browser }) => {
  for (const width of [320, 390, 430]) {
    const context = await browser.newContext({
      viewport: { width, height: 760 },
      isMobile: true, hasTouch: true, deviceScaleFactor: 2
    })
    const page = await context.newPage()
    for (const route of ["/todo", "/calendar", "/memo", "/settings"]) {
      await page.goto(route)
      const header = page.getByTestId("app-header")
      await expect(header).toBeVisible()
      await page.evaluate(() => {
        const spacer = document.createElement("div")
        spacer.setAttribute("data-test-scroll-spacer", "")
        spacer.style.height = "1400px"
        document.querySelector("main")!.appendChild(spacer)
        window.scrollTo(0, 1200)
      })
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100)
      const top = await header.evaluate(element => element.getBoundingClientRect().top)
      expect(top).toBeGreaterThanOrEqual(-1)
      expect(top).toBeLessThanOrEqual(1)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
      expect(overflow).toBe(false)
      const settingsLink = route === "/settings"
        ? page.getByRole("link", { name: "設定を閉じる" })
        : page.getByRole("link", { name: "設定を開く" })
      await expect(settingsLink).toBeVisible()
      if (route === "/todo") {
        await settingsLink.click()
        await expect(page.getByTestId("settings-page")).toBeVisible()
      }
    }
    await context.close()
  }
})

test("drawer overlays the sticky header and closes with Escape", async ({ page }) => {
  await page.goto("/todo")
  await page.getByRole("button", { name: "TODOを追加" }).click()
  await expect(page.getByRole("dialog")).toBeVisible()
  const stacking = await page.evaluate(() => ({
    header: Number(getComputedStyle(document.querySelector('[data-testid="app-header"]')!).zIndex),
    dialog: Number(getComputedStyle(document.querySelector('[role="dialog"]')!).zIndex)
  }))
  expect(stacking.dialog).toBeGreaterThan(stacking.header)
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog")).toBeHidden()
})


test("header shows today's date beside noca without duplicate copy at small widths", async ({ browser }) => {
  for (const width of [320, 375, 390, 430]) {
    const context = await browser.newContext({
      viewport: { width, height: 760 }, isMobile: true, hasTouch: true
    })
    const page = await context.newPage()
    await page.goto("/todo")
    const date = page.getByTestId("header-date")
    const expected = await page.evaluate(() => {
      const now = new Date()
      const weekdays = ["日", "月", "火", "水", "木", "金", "土"]
      const pad = (value: number) => String(value).padStart(2, "0")
      return {
        text: (now.getMonth() + 1) + "月" + now.getDate() + "日（" + weekdays[now.getDay()] + "）",
        iso: now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate())
      }
    })
    await expect(date).toBeVisible()
    await expect(date).toHaveText(expected.text)
    await expect(date).toHaveAttribute("datetime", expected.iso)
    await expect(page.getByTestId("app-header").locator("time")).toHaveCount(1)
    await expect(page.getByTestId("app-header").getByText("ふたりのスペース")).toHaveCount(0)
    await expect(page.getByRole("link", { name: "設定を開く" })).toBeVisible()
    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
    expect(hasOverflow).toBe(false)
    await context.close()
  }
})

test("header date changes at midnight without reloading the PWA", async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 9, 14, 23, 59, 59) })
  await page.goto("/todo")
  await expect(page.getByTestId("header-date")).toHaveText("10月14日（水）")
  await page.clock.fastForward(2_000)
  await expect(page.getByTestId("header-date")).toHaveText("10月15日（木）")
})


test("TODO chips filter by category, keep completed tasks, and include newly created items", async ({ page }) => {
  await page.goto("/todo")
  const chips = page.getByRole("group", { name: "TODOの絞り込み" })
  const chipLabels = await Promise.all((await chips.getByRole("button").all()).map(chip => chip.getAttribute("aria-label")))
  expect(chipLabels).toEqual(["すべて", "おでかけ", "暮らし", "ふたり", "その他"])
  await expect(chips.getByRole("button", { name: "すべて" })).toHaveAttribute("aria-pressed", "true")
  await expect(page.getByRole("button", { name: "週末のカフェを探すを編集" })).toBeVisible()

  await chips.getByRole("button", { name: "おでかけ" }).click()
  await expect(chips.getByRole("button", { name: "おでかけ" })).toHaveAttribute("aria-pressed", "true")
  await expect(page.getByRole("button", { name: "週末のカフェを探すを編集" })).toBeVisible()
  await expect(page.getByRole("button", { name: "洗剤と柔軟剤を買うを編集" })).toHaveCount(0)
  await page.getByRole("button", { name: /完了したこと/ }).click()
  await expect(page.getByRole("button", { name: "次のお出かけの候補を送るを編集" })).toBeVisible()

  await chips.getByRole("button", { name: "ふたり" }).click()
  await expect(page.getByRole("button", { name: "旅行の宿泊先を決めるを編集" })).toBeVisible()
  await expect(page.getByRole("button", { name: "週末のカフェを探すを編集" })).toHaveCount(0)

  await chips.getByRole("button", { name: "暮らし" }).click()
  await expect(page.getByRole("button", { name: "洗剤と柔軟剤を買うを編集" })).toBeVisible()
  await expect(page.getByRole("button", { name: "部屋の片付けを編集" })).toBeVisible()

  await chips.getByRole("button", { name: "その他" }).click()
  await expect(page.getByText("このカテゴリのタスクはありません")).toBeVisible()
  await page.getByRole("button", { name: "TODOを追加" }).click()
  await page.locator("#todo-title").fill("カテゴリ別のテスト")
  await page.getByRole("button", { name: "タスクを追加" }).last().click()
  await expect(page.locator("#todo-title")).toHaveValue("")
  await page.keyboard.press("Escape")
  await expect(page.getByRole("button", { name: "カテゴリ別のテストを編集" })).toBeVisible()
  await page.reload()
  await chips.getByRole("button", { name: "その他" }).click()
  await expect(page.getByRole("button", { name: "カテゴリ別のテストを編集" })).toBeVisible()
})


test("category filter chips match task category tag colors in light and dark modes", async ({ page }) => {
  for (const theme of ["light", "dark"]) {
    await page.goto("/todo")
    if (theme === "dark") {
      await page.getByRole("link", { name: "設定を開く" }).click()
      await page.getByRole("group", { name: "テーマ" }).getByRole("button", { name: "ダーク" }).click()
      await page.getByRole("button", { name: "前の画面に戻る" }).click()
      await expect(page.locator("html")).toHaveClass(/dark/)
    }
    const chips = page.getByRole("group", { name: "TODOの絞り込み" })
    const finishFilterAnimations = () => chips.evaluate(async element => {
      const animations = element.getAnimations({ subtree: true })
      await Promise.all(animations.map(animation => animation.finished.catch(() => undefined)))
    })
    const samples = [
      { category: "おでかけ", task: "週末のカフェを探す" },
      { category: "暮らし", task: "洗剤と柔軟剤を買う" },
      { category: "ふたり", task: "旅行の宿泊先を決める" }
    ]
    for (const { category, task } of samples) {
      const chip = chips.getByRole("button", { name: category, exact: true })
      await chip.click()
      await expect(chip).toHaveAttribute("aria-pressed", "true")
      await finishFilterAnimations()
      await expect(page.getByRole("button", { name: task + "を編集" }).getByText(category, { exact: true })).toHaveCount(0)
      await page.mouse.move(0, 0)
      await expect(chip.locator('[class*="ring-2"]')).toHaveCount(1)
      await chips.getByRole("button", { name: "すべて", exact: true }).click()
      await finishFilterAnimations()
      const badge = page.getByRole("button", { name: task + "を編集" }).getByText(category, { exact: true })
      await expect(badge).toBeVisible()
      const badgeColor = await badge.evaluate(node => ({
        bg: getComputedStyle(node).backgroundColor,
        text: getComputedStyle(node).color
      }))
      // The chip transitions from its hover color after the pointer leaves.
      // Wait for that transition before comparing its base category tone.
      await expect.poll(() => chip.evaluate(node => getComputedStyle(node).backgroundColor)).toBe(badgeColor.bg)
      const chipColor = await chip.evaluate(node => ({
        bg: getComputedStyle(node).backgroundColor,
        text: getComputedStyle(node).color
      }))
      expect(badgeColor.text).toBe(chipColor.text)
      const channels = (value: string) => value.match(/\d+/g)?.map(Number) ?? []
      const chipChannels = channels(chipColor.bg)
      const badgeChannels = channels(badgeColor.bg)
      expect(chipChannels).toHaveLength(3)
      expect(badgeChannels).toHaveLength(3)
      expect(badgeChannels.every((channel, index) => Math.abs(channel - chipChannels[index]) <= 1)).toBe(true)
    }
    const other = chips.getByRole("button", { name: "その他", exact: true })
    await other.click()
    await expect(other).toHaveAttribute("aria-pressed", "true")
    await expect(other).toHaveClass(/bg-secondary/)
    await expect(other.locator('[class*="ring-2"]')).toHaveCount(1)
    await chips.getByRole("button", { name: "すべて", exact: true }).click()
    await expect(chips.getByRole("button", { name: "すべて", exact: true })).toHaveAttribute("aria-pressed", "true")
  }
})


test("TODO category tiles show two-line unfinished counts and no redundant section title", async ({ page }) => {
  await page.goto("/todo")
  await expect(page.getByText("これからすること", { exact: true })).toHaveCount(0)
  const chips = page.getByRole("group", { name: "TODOの絞り込み" })
  for (const [category, count] of [
    ["すべて", "4件"], ["おでかけ", "1件"], ["暮らし", "2件"], ["ふたり", "1件"], ["その他", "0件"]
  ]) {
    const chip = chips.getByRole("button", { name: category, exact: true })
    await expect(chip).toHaveAttribute("aria-describedby", /todo-filter-count-/)
    await expect(page.getByTestId("todo-filter-count-" + category)).toHaveText(count)
    const dimensions = await chip.boundingBox()
    expect(dimensions?.height).toBeGreaterThanOrEqual(58)
    expect(dimensions?.width).toBeGreaterThanOrEqual(74)
  }
  await expect(chips.getByRole("button", { name: "すべて", exact: true })).toHaveAttribute("aria-pressed", "true")
})

test("TODO tile counts respond immediately to creating and completing tasks", async ({ page }) => {
  await page.goto("/todo")
  const chips = page.getByRole("group", { name: "TODOの絞り込み" })
  await chips.getByRole("button", { name: "その他", exact: true }).click()
  await expect(page.getByTestId("todo-filter-count-その他")).toHaveText("0件")

  await page.getByRole("button", { name: "TODOを追加" }).click()
  await page.locator("#todo-title").fill("件数のテスト")
  await page.getByRole("button", { name: "タスクを追加" }).last().click()
  await expect(page.getByTestId("todo-filter-count-その他")).toHaveText("1件")
  await expect(page.getByTestId("todo-filter-count-すべて")).toHaveText("5件")
  await page.keyboard.press("Escape")

  await page.getByRole("checkbox", { name: "件数のテストを完了" }).click()
  await expect(page.getByTestId("todo-filter-count-その他")).toHaveText("0件")
  await expect(page.getByTestId("todo-filter-count-すべて")).toHaveText("4件")
  await page.getByRole("button", { name: /完了したこと/ }).click()
  await expect(page.getByRole("checkbox", { name: "件数のテストの完了を解除" })).toBeVisible()
  await page.getByRole("checkbox", { name: "件数のテストの完了を解除" }).click()
  await expect(page.getByTestId("todo-filter-count-その他")).toHaveText("1件")
})


test("TODO starts with category tiles and has no redundant remaining-task summary card", async ({ page }) => {
  await page.goto("/todo")
  const todo = page.getByTestId("todo-page")
  await expect(todo.getByText("残りのタスク", { exact: true })).toHaveCount(0)
  await expect(todo.locator(":scope > section.noca-shadow")).toHaveCount(0)
  await expect(todo.locator(":scope > [role='group'][aria-label='TODOの絞り込み']")).toBeVisible()
  await expect(todo.getByTestId("todo-filter-count-すべて")).toHaveText("4件")
  await expect(page.getByRole("button", { name: "TODOを追加" })).toBeVisible()
})


test("floating navigation dock fits narrow iPhones and has a distinct right-side add action", async ({ browser }) => {
  for (const width of [320, 375, 390, 430]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true })
    const page = await context.newPage()
    await page.goto("/todo")
    const nav = page.getByRole("navigation", { name: "メインメニュー" })
    const dock = page.getByTestId("bottom-dock")
    const add = dock.getByRole("button", { name: "TODOを追加" })
    await expect(nav.getByRole("link")).toHaveCount(3)
    await expect(nav.getByRole("button")).toHaveCount(0)
    await expect(add).toBeVisible()
    await expect(page.locator(".fab")).toHaveCount(0)
    const geometry = await page.evaluate(() => {
      const el = document.querySelector<HTMLElement>('[data-testid="bottom-dock"]')!
      const memo = el.querySelector<HTMLAnchorElement>('a[href="/memo"]')!
      const add = el.querySelector<HTMLButtonElement>('[data-testid="dock-add-button"]')!
      const nav = el.querySelector<HTMLElement>("nav")!
      const box = el.getBoundingClientRect()
      const navBox = nav.getBoundingClientRect()
      const memoBox = memo.getBoundingClientRect()
      const addBox = add.getBoundingClientRect()
      return {
        x: box.left,
        right: box.right,
        bottomGap: window.innerHeight - box.bottom,
        gap: addBox.left - navBox.right,
        navRight: navBox.right,
        navHeight: navBox.height,
        addCenter: addBox.top + addBox.height / 2,
        navCenter: navBox.top + navBox.height / 2,
        buttonLeft: addBox.left,
        memoRight: memoBox.right,
        addWidth: addBox.width,
        addHeight: addBox.height,
        navShadow: getComputedStyle(nav).boxShadow,
        navBackground: getComputedStyle(nav).backgroundColor,
        outerBackground: getComputedStyle(el).backgroundColor,
        plusInsideNav: nav.contains(add),
        overflow: document.documentElement.scrollWidth > window.innerWidth + 1
      }
    })
    expect(geometry.x).toBeGreaterThanOrEqual(10)
    expect(geometry.right).toBeLessThanOrEqual(width - 10)
    expect(geometry.bottomGap).toBeGreaterThanOrEqual(8)
    expect(geometry.buttonLeft).toBeGreaterThan(geometry.memoRight)
    expect(geometry.addWidth).toBeGreaterThanOrEqual(44)
    expect(geometry.addHeight).toBeGreaterThanOrEqual(54)
    expect(geometry.navHeight).toBeGreaterThanOrEqual(54)
    expect(geometry.gap).toBeGreaterThanOrEqual(15.5)
    expect(geometry.gap).toBeLessThanOrEqual(16.5)
    expect(Math.abs(geometry.addCenter - geometry.navCenter)).toBeLessThan(2)
    expect(geometry.navShadow).not.toBe("none")
    expect(geometry.navBackground).not.toBe("rgba(0, 0, 0, 0)")
    expect(geometry.outerBackground).toBe("rgba(0, 0, 0, 0)")
    expect(geometry.plusInsideNav).toBe(false)
    expect(geometry.overflow).toBe(false)
    await page.screenshot({ path: "test-results/screenshots/floating-dock-" + width + ".png", fullPage: false })
    await context.close()
  }
})

test("the dock plus opens supported editors and is hidden on the memo placeholder", async ({ page }) => {
  for (const { route, tab, addLabel, editorTitle } of [
    { route: "/todo", tab: "TODO", addLabel: "TODOを追加", editorTitle: "タスクを追加" },
    { route: "/calendar", tab: "カレンダー", addLabel: "カレンダーを追加", editorTitle: "予定を追加" }
  ]) {
    await page.goto(route)
    const dock = page.getByTestId("bottom-dock")
    await expect(dock.getByRole("link")).toHaveCount(3)
    await expect(dock.getByRole("link", { name: tab })).toHaveAttribute("aria-current", "page")
    await dock.getByRole("button", { name: addLabel }).click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await expect(page.getByRole("dialog", { name: editorTitle })).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog")).toBeHidden()
  }
  await page.goto("/memo")
  await expect(page.getByTestId("memo-page")).toHaveText("メモ機能は開発中です")
  await expect(page.getByTestId("dock-add-button")).toHaveCount(0)
  await page.goto("/settings")
  await expect(page.getByTestId("bottom-dock")).toHaveCount(0)
  await expect(page.getByRole("navigation", { name: "メインメニュー" })).toHaveCount(0)
})

test("floating dock maintains create action and contrast in dark mode", async ({ page }) => {
  await page.goto("/settings")
  await page.getByRole("group", { name: "テーマ" }).getByRole("button", { name: "ダーク" }).click()
  await page.getByRole("link", { name: "設定を閉じる" }).click()
  await page.getByRole("navigation", { name: "メインメニュー" }).getByRole("link", { name: "カレンダー" }).click()
  await expect(page.locator("html")).toHaveClass(/dark/)
  const add = page.getByTestId("dock-add-button")
  await expect(add).toBeVisible()
  const appearance = await add.evaluate(button => {
    const style = getComputedStyle(button)
    return { bg: style.backgroundColor, foreground: style.color, shadow: style.boxShadow }
  })
  expect(appearance.bg).not.toBe("rgba(0, 0, 0, 0)")
  expect(appearance.foreground).not.toBe(appearance.bg)
  expect(appearance.shadow).not.toBe("none")
  await add.click()
  await expect(page.getByRole("heading", { name: "予定を追加" })).toBeVisible()
})


test("new local workspace starts with one member and hides B owner UI", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const page = await context.newPage()
  await page.goto("/todo")

  const avatars = page.getByTestId("app-header").locator('[data-slot="owner-avatar"]')
  await expect(avatars).toHaveCount(1)
  await expect(avatars.first()).toHaveText("自")
  await expect(page.getByRole("group", { name: "利用中のメンバー: 自分" })).toBeVisible()
  await page.goto("/calendar")
  await expect(page.getByTestId("single-person-schedule")).toBeVisible()
  await expect(page.getByTestId("person-header-A")).toHaveCount(0)
  await expect(page.getByTestId("person-header-B")).toHaveCount(0)
  const soloLane = page.getByTestId("timeline-lane-self")
  await expect(soloLane.getByRole("button", { name: "午前の用事を編集" })).toHaveCount(0)
  await expect(page.getByTestId("all-day-strip")).toHaveCount(0)
  await expect(page.getByRole("button", { name: "記念日を編集" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "週末のカフェを探すを編集" })).toHaveCount(0)
  const initialStorage = await page.evaluate(() => ({
    todos: localStorage.getItem("noca.todos.v1"),
    events: localStorage.getItem("noca.calendar.events.v1")
  }))
  expect(initialStorage).toEqual({ todos: "[]", events: "[]" })

  await page.getByRole("button", { name: "カレンダーを追加" }).click()
  await expect(page.getByRole("group", { name: "予定の担当" })).toHaveCount(0)
  await page.goto("/settings")
  await expect(page.getByTestId("workspace-members")).toContainText("自分（1人）")

  await context.close()
})

test("header member avatar uses the available Google profile photo", async ({ page }) => {
  const profilePhoto = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="
  await page.addInitScript(members => {
    localStorage.setItem("noca.workspace.members.v1", JSON.stringify(members))
  }, [{ id: "A", displayName: "Taro", photoURL: profilePhoto }])
  await page.goto("/todo")

  const avatar = page.getByTestId("app-header").locator('[data-slot="owner-avatar"]')
  await expect(avatar.locator("img")).toHaveAttribute("src", profilePhoto)
  await expect(avatar).toHaveAttribute("aria-hidden", "true")
})

test("header member avatar falls back to the display-name initial when the photo fails to load", async ({ page }) => {
  await page.route("https://example.invalid/**", route => route.abort())
  await page.addInitScript(members => {
    localStorage.setItem("noca.workspace.members.v1", JSON.stringify(members))
  }, [{ id: "A", displayName: "Taro", photoURL: "https://example.invalid/profile.png" }])
  await page.goto("/todo")

  const avatar = page.getByTestId("app-header").locator('[data-slot="owner-avatar"]')
  await expect(avatar.locator("img")).toHaveCount(0)
  await expect(avatar).toContainText("T")
})

test("calendar shows two separate people with all-day and time-proportional blocks", async ({ page }) => {
  await page.goto("/calendar")
  await expect(page.getByTestId("two-person-schedule")).toBeVisible()
  await expect(page.getByTestId("person-header-A")).toContainText("Aの予定")
  await expect(page.getByTestId("person-header-B")).toContainText("Bの予定")
  await expect(page.getByTestId("all-day-A").getByRole("button", { name: "給料日を編集" })).toBeVisible()
  await expect(page.getByTestId("all-day-B").getByRole("button", { name: "お休みを編集" })).toBeVisible()
  const morning = page.getByTestId("timeline-lane-A").getByRole("button", { name: "午前の用事を編集" })
  const hair = page.getByTestId("timeline-lane-B").getByRole("button", { name: "美容室を編集" })
  await expect(morning).toHaveAttribute("data-start", "09:00")
  await expect(morning).toHaveAttribute("data-end", "14:00")
  await expect(hair).toHaveAttribute("data-start", "11:00")
  await expect(hair).toHaveAttribute("data-end", "14:40")
  const boxes = await Promise.all([morning, hair].map(item => item.evaluate(el => {
    const rect = el.getBoundingClientRect()
    return { top: rect.top, height: rect.height, left: rect.left, right: rect.right }
  })))
  expect(boxes[0].top).toBeLessThan(boxes[1].top)
  expect(boxes[0].height).toBeGreaterThan(boxes[1].height)
  expect(boxes[0].right).toBeLessThan(boxes[1].left)
  await expect(page.getByRole("button", { name: "週末のカフェを探すを編集" })).toBeVisible()
})

test("calendar can create and edit a B person's event including an all-day switch", async ({ page }) => {
  await page.goto("/calendar")
  await page.getByRole("button", { name: "カレンダーを追加" }).click()
  await page.locator("#event-title").fill("Bの新しい予定")
  await page.getByRole("group", { name: "予定の担当" }).getByRole("button", { name: "Bの予定" }).click()
  await page.getByRole("switch", { name: "終日" }).click()
  await page.locator("#event-start").fill("16:00")
  await page.locator("#event-end").fill("17:30")
  await page.getByRole("button", { name: "予定を追加" }).last().click()
  const created = page.getByTestId("timeline-lane-B").getByRole("button", { name: "Bの新しい予定を編集" })
  await expect(created).toBeVisible()
  await expect(created).toHaveAttribute("data-end", "17:30")
  await page.reload()
  await expect(page.getByTestId("timeline-lane-B").getByRole("button", { name: "Bの新しい予定を編集" })).toBeVisible()
  await page.getByRole("button", { name: "Bの新しい予定を編集" }).click()
  await expect(page.getByRole("group", { name: "予定の担当" }).getByRole("button", { name: "Bの予定" })).toHaveAttribute("aria-pressed", "true")
  await page.getByRole("switch", { name: "終日" }).click()
  await page.getByRole("button", { name: "変更を保存" }).click()
  await expect(page.getByTestId("all-day-B").getByRole("button", { name: "Bの新しい予定を編集" })).toBeVisible()
  await expect(page.getByTestId("timeline-lane-B").getByRole("button", { name: "Bの新しい予定を編集" })).toHaveCount(0)
})

test("old exact demo records are removed while edited and user records remain", async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seed-test")) return
    sessionStorage.setItem("seed-test", "yes")
    const date = new Date()
    const pad = (x: number) => String(x).padStart(2, "0")
    const d = date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate())
    localStorage.setItem("noca.todos.v1", JSON.stringify([
      { id: "t1", title: "週末のカフェを探す", category: "おでかけ", dueDate: d, done: false, by: "A" },
      { id: "t2", title: "洗剤と柔軟剤を買う（変更済み）", category: "暮らし", done: false, by: "B" },
      { id: "user-task", title: "自分で追加したTODO", category: "暮らし", done: false, by: "A" }
    ]))
    localStorage.setItem("noca.calendar.events.v1", JSON.stringify([
      { id: "e1", title: "夜ごはん", date: d, category: "ふたり", by: "A", time: "19:00" },
      { id: "e2", title: "ランチに行く", date: d, category: "おでかけ", by: "B", time: "12:30" },
      { id: "demo-v3-both-all", title: "記念日", date: d, category: "ふたり", by: "both" },
      { id: "demo-a-morning", title: "午前の用事（変更済み）", date: d, time: "09:00", endTime: "14:00", category: "暮らし", by: "A" },
      { id: "user-event", title: "自分で追加した予定", date: d, category: "暮らし", by: "A", time: "16:00" }
    ]))
    localStorage.removeItem("noca.calendar.samples.v2")
    localStorage.removeItem("noca.calendar.samples.v3")
  })
  await page.goto("/todo")
  await expect(page.getByRole("button", { name: "週末のカフェを探すを編集" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "洗剤と柔軟剤を買う（変更済み）を編集" })).toBeVisible()
  await expect(page.getByRole("button", { name: "自分で追加したTODOを編集" })).toBeVisible()
  const storedTodos = await page.evaluate(() => JSON.parse(localStorage.getItem("noca.todos.v1") || "[]"))
  expect(storedTodos.map((task: { id: string }) => task.id)).toEqual(["t2", "user-task"])

  await page.goto("/calendar")
  await expect(page.getByRole("button", { name: "夜ごはんを編集" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "ランチに行くを編集" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "記念日を編集" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "午前の用事（変更済み）を編集" })).toBeVisible()
  await expect(page.getByRole("button", { name: "自分で追加した予定を編集" })).toBeVisible()
  const storedEvents = await page.evaluate(() => JSON.parse(localStorage.getItem("noca.calendar.events.v1") || "[]"))
  expect(storedEvents.map((event: { id: string }) => event.id)).toEqual(["demo-a-morning", "user-event"])
  await page.reload()
  await expect(page.getByRole("button", { name: "夜ごはんを編集" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "午前の用事（変更済み）を編集" })).toBeVisible()
  await expect(page.getByRole("button", { name: "自分で追加した予定を編集" })).toBeVisible()
})

test("two-person timeline fits 320px iPhone without horizontal overflow", async ({ browser }) => {
  for (const width of [320, 375, 390, 430]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true })
    const page = await context.newPage()
    await seedPairedWorkspace(page)
    await page.goto("/calendar")
    await expect(page.getByTestId("timeline-lane-A")).toBeVisible()
    await expect(page.getByTestId("timeline-lane-B")).toBeVisible()
    const result = await page.evaluate(() => {
      const root = document.querySelector<HTMLElement>('[data-testid="two-person-schedule"]')!
      const rect = root.getBoundingClientRect()
      const a = root.querySelector<HTMLElement>('[data-testid="timeline-lane-A"]')!.getBoundingClientRect()
      const b = root.querySelector<HTMLElement>('[data-testid="timeline-lane-B"]')!.getBoundingClientRect()
      return {
        pageOverflow: document.documentElement.scrollWidth > innerWidth + 1,
        rootInside: rect.left >= -1 && rect.right <= innerWidth + 1,
        columnsOrdered: a.right <= b.left + 1,
        minColumn: Math.min(a.width, b.width)
      }
    })
    expect(result.pageOverflow).toBe(false)
    expect(result.rootInside).toBe(true)
    expect(result.columnsOrdered).toBe(true)
    expect(result.minColumn).toBeGreaterThan(100)
    const monthHeaderHeight = await page.getByRole("heading", { level: 2, name: /年.*月/ }).first()
      .evaluate(el => el.getBoundingClientRect().height)
    expect(monthHeaderHeight).toBeLessThan(30)
    await page.screenshot({ path: "test-results/screenshots/two-person-calendar-" + width + ".png", fullPage: false })
    await page.evaluate(() => {
      const timeline = document.querySelector<HTMLElement>('[data-testid="timeline-grid"]')
      if (timeline) window.scrollTo({ top: timeline.getBoundingClientRect().top + window.scrollY - 165, behavior: "instant" })
    })
    await page.waitForTimeout(270)
    await page.screenshot({ path: "test-results/screenshots/two-person-timeline-" + width + ".png", fullPage: false })
    await context.close()
  }
})


test("calendar all-day labels are compact, match timed typography, and have no redundant wording", async ({ page }) => {
  await page.goto("/calendar")
  const strip = page.getByTestId("all-day-strip")
  const a = strip.getByRole("button", { name: "給料日を編集" })
  const timed = page.getByTestId("timeline-lane-A").getByRole("button", { name: "午前の用事を編集" })
  await expect(a).toHaveText("給料日")
  await expect(strip.getByRole("button", { name: "お休みを編集" })).toHaveText("お休み")
  await expect(strip.getByRole("button", { name: "記念日を編集" })).toHaveText("記念日")
  const fonts = await Promise.all([
    a.locator("span").first().evaluate(el => ({ size: getComputedStyle(el).fontSize, weight: getComputedStyle(el).fontWeight })),
    timed.locator("span").first().evaluate(el => ({ size: getComputedStyle(el).fontSize, weight: getComputedStyle(el).fontWeight }))
  ])
  expect(fonts[0]).toEqual(fonts[1])
  const appearance = await page.getByTestId("schedule-surface").evaluate(el => ({
    bg: getComputedStyle(el).backgroundColor,
    borderTop: getComputedStyle(el).borderTopWidth,
    borderLeft: getComputedStyle(el).borderLeftWidth,
    shadow: getComputedStyle(el).boxShadow
  }))
  expect(appearance).toEqual({ bg: "rgba(0, 0, 0, 0)", borderTop: "0px", borderLeft: "0px", shadow: "none" })
})

test("all-day row is omitted when the selected day has no all-day events", async ({ page }) => {
  await page.goto("/calendar")
  const today = await page.evaluate(() => {
    const date = new Date()
    const pad = (value: number) => String(value).padStart(2, "0")
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  })
  await page.evaluate(date => localStorage.setItem("noca.calendar.events.v1", JSON.stringify([
    { id: "timed-a", title: "Aの予定", date, time: "09:00", endTime: "10:00", category: "暮らし", by: "A" },
    { id: "timed-b", title: "Bの予定", date, time: "11:00", endTime: "12:00", category: "暮らし", by: "B" }
  ])), today)
  await page.reload()

  await expect(page.getByTestId("all-day-strip")).toHaveCount(0)
  await expect(page.getByTestId("timeline-lane-A").getByRole("button", { name: "Aの予定を編集" })).toBeVisible()
  await expect(page.getByTestId("timeline-lane-B").getByRole("button", { name: "Bの予定を編集" })).toBeVisible()

  await page.evaluate(date => localStorage.setItem("noca.calendar.events.v1", JSON.stringify([
    { id: "shared-all-day", title: "ふたりの終日予定", date, category: "ふたり", by: "both" }
  ])), today)
  await page.reload()
  await expect(page.getByTestId("all-day-strip")).toBeVisible()
  await expect(page.getByTestId("all-day-both").getByRole("button", { name: "ふたりの終日予定を編集" })).toBeVisible()
})

test("shared events span both personal lanes without a third all-day header", async ({ page }) => {
  await page.goto("/calendar")
  await expect(page.getByTestId("person-header-A")).toContainText("Aの予定")
  await expect(page.getByTestId("person-header-B")).toContainText("Bの予定")
  await expect(page.getByTestId("person-header-both")).toHaveCount(0)
  await expect(page.getByTestId("all-day-both").getByRole("button", { name: "記念日を編集" })).toBeVisible()
  const shared = page.getByTestId("timeline-lane-both").getByRole("button", { name: "ふたりで買い物を編集" })
  await expect(shared).toHaveAttribute("data-owner", "both")
  const geometry = await page.evaluate(() => {
    const bounds = (selector: string) => document.querySelector<HTMLElement>(selector)!.getBoundingClientRect()
    const a = bounds('[data-testid="timeline-lane-A"]')
    const b = bounds('[data-testid="timeline-lane-B"]')
    const shared = bounds('[data-owner="both"][data-start="15:00"]')
    return { sharedLeft: shared.left, sharedRight: shared.right, aLeft: a.left, aRight: a.right, bLeft: b.left, bRight: b.right }
  })
  expect(geometry.sharedLeft).toBeGreaterThanOrEqual(geometry.aLeft)
  expect(geometry.sharedRight).toBeLessThanOrEqual(geometry.bRight)
  expect(geometry.sharedRight - geometry.sharedLeft).toBeGreaterThan((geometry.aRight - geometry.aLeft) * 1.7)
  await shared.click()
  await expect(page.getByRole("heading", { name: "予定を編集" })).toBeVisible()
  await expect(page.getByRole("group", { name: "予定の担当" }).getByRole("button", { name: "ふたりの予定" })).toHaveAttribute("aria-pressed", "true")
})

test("demo overlap keeps the long appointment in place and summarizes the shorter one", async ({ page }) => {
  await page.goto("/calendar")
  const lane = page.getByTestId("timeline-lane-A")
  const long = lane.getByRole("button", { name: "午前の用事を編集" })
  const summary = lane.getByTestId("overlap-summary-test-demo-a-morning")
  const label = page.getByTestId("event-label-test-demo-a-morning")
  await expect(long).toBeVisible()
  await expect(lane.getByRole("button", { name: "打ち合わせを編集" })).toHaveCount(0)
  await expect(long).toHaveAttribute("data-depth", "0")
  await expect(summary).toHaveAttribute("data-overlap-count", "1")
  await expect(summary).toContainText("他1件")
  const boxes = await Promise.all([long, label].map(b => b.evaluate(el => {
    const rect = el.getBoundingClientRect()
    return { top: rect.top, bottom: rect.bottom }
  })))
  expect(boxes[1].top - boxes[0].top).toBeLessThan(10)
  await summary.click()
  await expect(page.getByTestId("overlap-sheet")).toBeVisible()
  await expect(page.getByText("打ち合わせ", { exact: true })).toBeVisible()
  await expect(page.getByText("11:00–12:00 ・ 暮らし", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: /打ち合わせ.*11:00/ }).click()
  await expect(page.getByRole("heading", { name: "予定を編集" })).toBeVisible()
})

test("shared appointment can be created and persists with owner both", async ({ page }) => {
  await page.goto("/calendar")
  await page.getByRole("button", { name: "カレンダーを追加" }).click()
  await page.locator("#event-title").fill("ふたりの予約")
  await page.getByRole("group", { name: "予定の担当" }).getByRole("button", { name: "ふたりの予定" }).click()
  await page.getByRole("switch", { name: "終日" }).click()
  await page.locator("#event-start").fill("17:00")
  await page.locator("#event-end").fill("18:00")
  await page.getByRole("button", { name: "予定を追加" }).last().click()
  await expect(page.getByTestId("timeline-lane-both").getByRole("button", { name: "ふたりの予約を編集" })).toBeVisible()
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("noca.calendar.events.v1") || "[]"))
  expect(saved.some((x: { title: string; by: string }) => x.title === "ふたりの予約" && x.by === "both")).toBe(true)
  await page.reload()
  await expect(page.getByTestId("timeline-lane-both").getByRole("button", { name: "ふたりの予約を編集" })).toBeVisible()
  await expect(page.getByTestId("all-day-both").getByRole("button", { name: "記念日を編集" })).toBeVisible()
})

test("two-column all-day layout and shared spanning strip fit narrow phones", async ({ browser }) => {
  for (const width of [320, 375, 390, 430]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true })
    const page = await context.newPage()
    await seedPairedWorkspace(page)
    await page.goto("/calendar")
    await expect(page.getByTestId("calendar-page")).toBeVisible()
    await expect(page.getByTestId("person-header-both")).toHaveCount(0)
    const dims = await page.evaluate(() => {
      const strip = document.querySelector<HTMLElement>('[data-testid="all-day-strip"]')!
      const timeline = document.querySelector<HTMLElement>('[data-testid="timeline-grid"]')!
      const parts = ["A", "B", "both"].map(p => strip.querySelector<HTMLElement>('[data-testid="all-day-' + p + '"]')!.getBoundingClientRect())
      const hourLines = [...timeline.querySelectorAll<HTMLElement>(".pointer-events-none > div")].map(el => el.offsetTop)
      return {
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        stripWidth: strip.getBoundingClientRect().width,
        parts: parts.map(x => ({left:x.left,right:x.right,width:x.width})),
        lines: hourLines
      }
    })
    expect(dims.overflow).toBe(false)
    expect(dims.parts[0].width).toBeGreaterThan(90)
    expect(dims.parts[0].right).toBeLessThanOrEqual(dims.parts[1].left + 1)
    expect(dims.parts[2].left).toBeGreaterThanOrEqual(dims.parts[0].left - 1)
    expect(dims.parts[2].right).toBeGreaterThanOrEqual(dims.parts[1].right - 1)
    expect(dims.parts[2].width).toBeGreaterThan(dims.parts[0].width * 1.85)
    expect(dims.lines[1] - dims.lines[0]).toBe(54)
    await page.evaluate(() => {
      const timeline = document.querySelector<HTMLElement>('[data-testid="timeline-grid"]')!
      window.scrollTo({ top: timeline.getBoundingClientRect().top + scrollY - 140, behavior: "instant" })
    })
    await page.waitForTimeout(250)
    await page.screenshot({ path: "test-results/screenshots/shared-calendar-v2-" + width + ".png", fullPage: false })
    await context.close()
  }
})


test("overlapping appointments use a summary chip and open the complete event list", async ({ page }) => {
  await page.goto("/calendar")
  await page.evaluate(() => {
    const date = new Date()
    const pad = (n: number) => String(n).padStart(2, "0")
    const day = date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate())
    localStorage.setItem("noca.calendar.events.v1", JSON.stringify([
      { id: "long", title: "仕事", date: day, time: "09:00", endTime: "14:00", category: "暮らし", by: "A" },
      { id: "short", title: "朝の打ち合わせ", date: day, time: "09:05", endTime: "10:15", category: "暮らし", by: "A" }
    ]))
  })
  await page.reload()
  const lane = page.getByTestId("timeline-lane-A")
  const long = lane.getByRole("button", { name: "仕事を編集" })
  const summary = lane.getByTestId("overlap-summary-long")
  const longLabel = page.getByTestId("event-label-long")
  await expect(long).toBeVisible()
  await expect(lane.getByRole("button", { name: "朝の打ち合わせを編集" })).toHaveCount(0)
  await expect(summary).toHaveAttribute("data-overlap-count", "1")
  await expect(summary).toContainText("他1件")
  const boxes = await Promise.all([long,longLabel].map(el => el.evaluate(node => {
    const r = node.getBoundingClientRect()
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }
  })))
  expect(boxes[1].top - boxes[0].top).toBeLessThan(10)
  await summary.click()
  await expect(page.getByTestId("overlap-sheet")).toBeVisible()
  await expect(page.getByText("朝の打ち合わせ", { exact: true })).toBeVisible()
  await expect(page.getByText("09:05–10:15 ・ 暮らし", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: /朝の打ち合わせ.*09:05/ }).click()
  await expect(page.getByRole("heading", { name: "予定を編集" })).toBeVisible()
})

test("5-minute and 15-minute events always display their titles inside readable compact cards", async ({ page }) => {
  await page.goto("/calendar")
  await page.evaluate(() => {
    const date = new Date()
    const pad = (n: number) => String(n).padStart(2, "0")
    const day = date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate())
    localStorage.setItem("noca.calendar.events.v1", JSON.stringify([
      { id: "five", title: "電話", date: day, time: "09:00", endTime: "09:05", category: "その他", by: "A" },
      { id: "fifteen", title: "予定確認", date: day, time: "10:00", endTime: "10:15", category: "その他", by: "B" }
    ]))
  })
  await page.reload()
  for (const [id,title] of [["five","電話"],["fifteen","予定確認"]]) {
    const button = page.locator('[data-calendar-event="' + id + '"]')
    const label = page.getByTestId("event-label-" + id)
    await expect(button).toHaveAttribute("data-compact", "true")
    await expect(label).toContainText(title)
    const r = await Promise.all([button,label].map(el => el.evaluate(n => {
      const rect = n.getBoundingClientRect()
      return { top: rect.top, bottom: rect.bottom, width: rect.width }
    })))
    expect(r[0].bottom - r[0].top).toBeGreaterThanOrEqual(35)
    expect(r[1].top).toBeGreaterThan(r[0].top)
    expect(r[1].bottom).toBeLessThan(r[0].bottom)
    expect(r[1].width).toBeGreaterThan(40)
    await button.click()
    await expect(page.getByRole("heading", { name: "予定を編集" })).toBeVisible()
    await page.keyboard.press("Escape")
  }
})

test("shared all-day events are a single full-width bar and remain editable", async ({ page }) => {
  await page.goto("/calendar")
  const strip = page.getByTestId("all-day-strip")
  await expect(page.getByTestId("person-header-both")).toHaveCount(0)
  const full = strip.getByTestId("all-day-both").getByRole("button", { name: "記念日を編集" })
  const a = strip.getByTestId("all-day-A")
  const b = strip.getByTestId("all-day-B")
  const bounds = await Promise.all([full,a,b].map(x => x.evaluate(el => {
    const r = el.getBoundingClientRect()
    return { left: r.left, right: r.right, width: r.width }
  })))
  expect(bounds[0].width).toBeGreaterThan(bounds[1].width * 1.75)
  expect(bounds[0].left).toBeGreaterThanOrEqual(bounds[1].left)
  expect(bounds[0].right).toBeLessThanOrEqual(bounds[2].right)
  await full.click()
  await expect(page.getByRole("group", { name: "予定の担当" }).getByRole("button", { name: "ふたりの予定" })).toHaveAttribute("aria-pressed", "true")
})
