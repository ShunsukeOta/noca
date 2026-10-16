// TODO category names are user-managed. Calendar keeps using the built-in names for now.
export type TaskCategory = string
export type CategoryTone = "peach" | "green" | "lavender" | "blue" | "mint" | "yellow" | "rose" | "neutral" | "life" | "outing" | "couple"
export type TodoCategory = { id: string; name: TaskCategory; tone: CategoryTone }
export type Task = { id: string; title: string; category: TaskCategory; dueDate?: string; memo?: string; url?: string; address?: string; done: boolean; by: "A" | "B" }
export type CalendarEvent = { id: string; title: string; date: string; time?: string; endTime?: string; address?: string; memo?: string; category: TaskCategory; by: "A" | "B" | "both" }
