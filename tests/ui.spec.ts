import { test, expect } from "@playwright/test"

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
  await expect(page.getByRole("button", { name: "ダークモードに切り替え" })).toHaveCount(0)
  await page.getByRole("link", { name: "設定を開く" }).click()
  await page.getByRole("group", { name: "テーマ" }).getByRole("button", { name: "ダーク" }).click()
  await expect(page.locator("html")).toHaveClass(/dark/)
  await page.getByRole("button", { name: "前の画面に戻る" }).click()
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


test("settings icon opens the page; theme setting persists; back returns to the source tab", async ({ page }) => {
  await page.goto("/calendar")
  await page.getByRole("link", { name: "設定を開く" }).click()
  await expect(page).toHaveURL(/\/settings$/)
  await expect(page.getByTestId("settings-page")).toBeVisible()
  await expect(page.locator("main")).toHaveAttribute("aria-label", "設定")
  await expect(page.getByRole("heading", { name: "設定" })).toBeVisible()
  await expect(page.getByRole("button", { name: "カレンダーを追加" })).toHaveCount(0)
  await expect(page.getByRole("navigation", { name: "メインメニュー" }).getByRole("link")).toHaveCount(3)

  await page.getByRole("group", { name: "テーマ" }).getByRole("button", { name: "ダーク" }).click()
  await expect(page.locator("html")).toHaveClass(/dark/)
  await page.reload()
  await expect(page.locator("html")).toHaveClass(/dark/)
  await expect(page.getByRole("group", { name: "テーマ" }).getByRole("button", { name: "ダーク" })).toHaveAttribute("aria-pressed", "true")
  await page.getByRole("button", { name: "前の画面に戻る" }).click()
  await expect(page.getByTestId("calendar-page")).toBeVisible()
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
    await expect(page.locator("main").getByText("準備中")).toHaveCount(7)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
    expect(overflow).toBe(false)
    await page.screenshot({ path: "test-results/screenshots/settings-" + width + ".png", fullPage: false })
    await page.getByRole("button", { name: "前の画面に戻る" }).click()
    await expect(page.getByTestId("memo-page")).toBeVisible()
    await context.close()
  }
})


test("opening an editor does not immediately show the iPhone keyboard", async ({ page }) => {
  await page.goto("/todo")
  await page.getByRole("button", { name: "TODOを追加" }).click()
  await expect(page.getByRole("dialog")).toBeVisible()
  await expect(page.locator("#todo-title")).not.toBeFocused()
  await expect(page.getByRole("dialog")).toHaveAttribute("data-keyboard-open", "false")
  await page.getByRole("button", { name: "閉じる" }).click()
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
  await page.getByRole("button", { name: "週末のカフェを探すを完了" }).click()
  // AnimatePresence retains the removed item briefly for its exit animation.
  await expect(row).toHaveCount(1)
  await expect(row).toHaveCount(0)
  await page.getByRole("button", { name: /完了したこと/ }).click()
  await expect(page.getByRole("button", { name: "週末のカフェを探すの完了を解除" })).toBeVisible()
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
  await page.getByRole("textbox", { name: "メモを検索" }).fill("旅行")
  await expect(page.getByRole("button", { name: "次の旅行のことを開く" })).toBeVisible()
  await page.getByRole("link", { name: "設定を開く" }).click()
  await expect(page.locator('[data-page-transition="/settings"]')).toBeVisible()
  await page.getByRole("button", { name: "前の画面に戻る" }).click()
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
  await page.locator("#event-start").fill("12:00")
  await page.locator("#event-end").fill("11:00")
  await page.getByRole("button", { name: "予定を追加" }).last().click()
  await expect(page.getByRole("alert")).toHaveText("終了時間は開始時間より後にしてください")
  await page.locator("#event-end").fill("13:30")
  await page.getByText("詳細を追加（任意）").click()
  await page.locator("#event-address").fill("駅前のカフェ")
  await page.getByRole("group", { name: "予定のカテゴリ" }).getByRole("button", { name: "おでかけ" }).click()
  await page.getByRole("button", { name: "予定を追加" }).last().click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(page.getByRole("button", { name: "テスト用の予定を編集" })).toBeVisible()
  await expect(page.getByText("12:00–13:30", { exact: false })).toBeVisible()

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
      await expect(page.getByRole("link", { name: "設定を開く" })).toBeVisible()
      if (route === "/todo") {
        await page.getByRole("link", { name: "設定を開く" }).click()
        await expect(page.getByTestId("settings-page")).toBeVisible()
      }
    }
    await context.close()
  }
})

test("drawer overlays the sticky header without blocking the close control", async ({ page }) => {
  await page.goto("/todo")
  await page.getByRole("button", { name: "TODOを追加" }).click()
  await expect(page.getByRole("dialog")).toBeVisible()
  const stacking = await page.evaluate(() => ({
    header: Number(getComputedStyle(document.querySelector('[data-testid="app-header"]')!).zIndex),
    dialog: Number(getComputedStyle(document.querySelector('[role="dialog"]')!).zIndex)
  }))
  expect(stacking.dialog).toBeGreaterThan(stacking.header)
  await page.getByRole("button", { name: "閉じる" }).click()
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
  const chipLabels = await chips.getByRole("button").allTextContents()
  expect(chipLabels.map(text => text.trim())).toEqual(["すべて", "おでかけ", "暮らし", "ふたり", "その他"])
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
    const samples = [
      { category: "おでかけ", task: "週末のカフェを探す" },
      { category: "暮らし", task: "洗剤と柔軟剤を買う" },
      { category: "ふたり", task: "旅行の宿泊先を決める" }
    ]
    for (const { category, task } of samples) {
      const chip = chips.getByRole("button", { name: category, exact: true })
      await chip.click()
      await expect(chip).toHaveAttribute("aria-pressed", "true")
      const badge = page.getByRole("button", { name: task + "を編集" }).getByText(category, { exact: true })
      await expect(badge).toBeVisible()
      const chipColor = await chip.evaluate(node => ({
        bg: getComputedStyle(node).backgroundColor,
        text: getComputedStyle(node).color
      }))
      const badgeColor = await badge.evaluate(node => ({
        bg: getComputedStyle(node).backgroundColor,
        text: getComputedStyle(node).color
      }))
      expect(chipColor).toEqual(badgeColor)
      await expect(chip.locator('[class*="ring-2"]')).toHaveCount(1)
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
