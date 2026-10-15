export const loadTodoCategorySettings = () => import("@/components/todo-category-settings")
export const loadConfirmDialog = () => import("@/components/ui/confirm-dialog")

export function preloadTodoCategorySettings() {
  void loadTodoCategorySettings().catch(() => undefined)
}

export function preloadConfirmDialog() {
  void loadConfirmDialog().catch(() => undefined)
}
