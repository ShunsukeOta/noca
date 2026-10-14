import { Navigate, Route, Routes } from "react-router-dom"
import { AppShell } from "@/components/app-shell"
import { TodoProvider } from "@/features/todos/todo-store"
import { TodoPage } from "@/pages/todo-page"
import { CalendarPage } from "@/pages/calendar-page"
import { MemoPage } from "@/pages/memo-page"
import { SettingsPage } from "@/pages/settings-page"

export default function App() {
  return (
    <TodoProvider>
      <Routes>
      <Route element={<AppShell />}>
        <Route path="/todo" element={<TodoPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/memo" element={<MemoPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/todo" replace />} />
      </Route>
      </Routes>
    </TodoProvider>
  )
}
