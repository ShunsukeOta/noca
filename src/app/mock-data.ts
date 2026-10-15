import { addDays, format } from "date-fns"

// TODO category names are user-managed. Calendar keeps using the built-in names for now.
export type TaskCategory = string
export type CategoryTone = "peach" | "green" | "lavender" | "blue" | "mint" | "yellow" | "rose" | "neutral" | "life" | "outing" | "couple"
export type TodoCategory = { id: string; name: TaskCategory; tone: CategoryTone }
export type Task = { id: string; title: string; category: TaskCategory; dueDate?: string; memo?: string; url?: string; address?: string; done: boolean; by: "A" | "B" }
export type CalendarEvent = { id: string; title: string; date: string; time?: string; endTime?: string; address?: string; memo?: string; category: TaskCategory; by: "A" | "B" | "both" }

const today = new Date()
const day = (offset: number) => format(addDays(today, offset), "yyyy-MM-dd")

export const mockTasks: Task[] = [
  { id: "t1", title: "週末のカフェを探す", category: "おでかけ", dueDate: day(0), done: false, by: "A" },
  { id: "t2", title: "洗剤と柔軟剤を買う", category: "暮らし", dueDate: day(1), done: false, by: "B" },
  { id: "t3", title: "旅行の宿泊先を決める", category: "ふたり", dueDate: day(4), done: false, by: "A" },
  { id: "t4", title: "部屋の片付け", category: "暮らし", done: false, by: "B" },
  { id: "t5", title: "次のお出かけの候補を送る", category: "おでかけ", done: true, by: "B" }
]
export const mockEvents: CalendarEvent[] = [
  { id: "e1", title: "夜ごはん", date: day(0), time: "19:00", endTime: "20:30", category: "ふたり", by: "A" },
  { id: "e2", title: "ランチに行く", date: day(2), time: "12:30", category: "おでかけ", by: "B" },
  { id: "e3", title: "買い出し", date: day(4), time: "15:00", category: "暮らし", by: "A" },
  { id: "e4", title: "映画を観る", date: day(9), time: "18:00", category: "おでかけ", by: "B" },
  // 初期プレビュー用の2人分の予定。任意のiPhoneで日付0・1のタイムラインを確認できる
  { id: "demo-a-morning", title: "午前の用事", date: day(0), time: "09:00", endTime: "14:00", category: "暮らし", address: "駅前", by: "A" },
  { id: "demo-b-hair", title: "美容室", date: day(0), time: "11:00", endTime: "14:40", category: "おでかけ", by: "B" },
  { id: "demo-a-payday", title: "給料日", date: day(0), category: "暮らし", by: "A" },
  { id: "demo-b-dayoff", title: "お休み", date: day(0), category: "ふたり", by: "B" },
  { id: "demo-next-a", title: "買い物に行く", date: day(1), time: "09:30", endTime: "13:30", category: "暮らし", by: "A" },
  { id: "demo-next-b", title: "友だちとランチ", date: day(1), time: "11:15", endTime: "14:40", category: "おでかけ", by: "B" },
  { id: "demo-next-a-all", title: "在宅の日", date: day(1), category: "暮らし", by: "A" },
  { id: "demo-next-b-all", title: "休暇", date: day(1), category: "ふたり", by: "B" },
  // 3分類と重なり表示を確認するためのサンプル
  { id: "demo-v3-a-meeting", title: "打ち合わせ", date: day(0), time: "11:00", endTime: "12:00", category: "暮らし", by: "A" },
  { id: "demo-v3-both-all", title: "記念日", date: day(0), category: "ふたり", by: "both" },
  { id: "demo-v3-both-timed", title: "ふたりで買い物", date: day(0), time: "15:00", endTime: "16:30", category: "ふたり", by: "both" },
  { id: "demo-v3-next-both", title: "夜の散歩", date: day(1), time: "19:00", endTime: "20:00", category: "ふたり", by: "both" }
]
