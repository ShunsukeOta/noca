export const loadTodoEditor = () => import("@/components/todo-editor-sheet")
export const loadCalendarEditor = () => import("@/components/calendar-editor-sheet")

export function preloadTodoEditor() {
  void loadTodoEditor().catch(() => undefined)
}

export function preloadCalendarEditor() {
  void loadCalendarEditor().catch(() => undefined)
}
