import { addDays, format } from "date-fns"

export type TaskCategory = "暮らし" | "おでかけ" | "ふたり" | "その他"
export type Task = { id: string; title: string; category: TaskCategory; dueDate?: string; done: boolean; by: "A" | "B" }
export type CalendarEvent = { id: string; title: string; date: string; time?: string; category: TaskCategory; by: "A" | "B" }
export type SharedNote = { id: string; title: string; body: string; updated: string; pinned?: boolean }

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
  { id: "e1", title: "夜ごはん", date: day(0), time: "19:00", category: "ふたり", by: "A" },
  { id: "e2", title: "ランチに行く", date: day(2), time: "12:30", category: "おでかけ", by: "B" },
  { id: "e3", title: "買い出し", date: day(4), time: "15:00", category: "暮らし", by: "A" },
  { id: "e4", title: "映画を観る", date: day(9), time: "18:00", category: "おでかけ", by: "B" }
]

export const mockNotes: SharedNote[] = [
  { id: "n1", title: "行きたいお店", body: "駅の近くの小さなイタリアン\n景色のいいカフェ\n気になっていた和食のお店", updated: "今日", pinned: true },
  { id: "n2", title: "次の旅行のこと", body: "行き先の候補をまとめておく。\n温泉もいいかもしれない。", updated: "昨日" },
  { id: "n3", title: "お買いものメモ", body: "洗剤、キッチンペーパー、コーヒー", updated: "3日前" }
]
