import { lazy, Suspense } from "react"
import { Navigate, Route, Routes } from "react-router-dom"
import { AppShell } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { ChunkLoadBoundary } from "@/components/chunk-load-boundary"
import { TodoProvider } from "@/features/todos/todo-store"
import { CalendarProvider } from "@/features/calendar/calendar-store"
import { WorkspaceMembershipProvider } from "@/features/workspace/workspace-membership"
import { isFirebaseConfigured } from "@/features/workspace/firebase-env"
import { TodoPage } from "@/pages/todo-page"
import { MemoPage } from "@/pages/memo-page"
import { SettingsPage } from "@/pages/settings-page"

// Keep the default TODO screen and Settings eager. The calendar's larger daily
// timeline is only needed after the user visits that tab.
const CalendarPage = lazy(async () => {
  const page = await import("@/pages/calendar-page")
  return { default: page.CalendarPage }
})
const JoinWorkspacePage = lazy(async () => ({
  default: (await import("@/pages/join-workspace-page")).JoinWorkspacePage
}))
const FirebaseWorkspaceMembershipProvider = lazy(async () => ({
  default: (await import("@/features/workspace/firebase-workspace-membership-provider")).FirebaseWorkspaceMembershipProvider
}))

function CalendarLoadingState() {
  return (
    <div role="status" className="min-h-[45vh]">
      <span className="sr-only">カレンダーを読み込み中</span>
    </div>
  )
}

function JoinLoadingState() {
  return <div role="status" className="min-h-[45vh]"><span className="sr-only">招待画面を読み込み中</span></div>
}

function JoinLoadError() {
  return (
    <div role="alert" className="flex min-h-[45vh] flex-col items-center justify-center gap-3 text-center">
      <p className="text-sm text-muted-foreground">招待画面を表示できませんでした。</p>
      <Button type="button" variant="outline" onClick={() => window.location.reload()}>再読み込み</Button>
    </div>
  )
}

function CalendarLoadError() {
  return (
    <div role="alert" className="flex min-h-[45vh] flex-col items-center justify-center gap-3 text-center">
      <p className="text-sm text-muted-foreground">カレンダーを表示できませんでした。</p>
      <Button type="button" variant="outline" onClick={() => window.location.reload()}>再読み込み</Button>
    </div>
  )
}

export default function App() {
  const routes = (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/todo" element={<TodoPage />} />
        <Route path="/calendar" element={
          <ChunkLoadBoundary fallback={<CalendarLoadError />}>
            <Suspense fallback={<CalendarLoadingState />}>
              <CalendarPage />
            </Suspense>
          </ChunkLoadBoundary>
        } />
        <Route path="/memo" element={<MemoPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/join" element={
          <ChunkLoadBoundary fallback={<JoinLoadError />}>
            <Suspense fallback={<JoinLoadingState />}><JoinWorkspacePage /></Suspense>
          </ChunkLoadBoundary>
        } />
        <Route path="*" element={<Navigate to="/todo" replace />} />
      </Route>
    </Routes>
  )

  return (
    <WorkspaceMembershipProvider>
      <TodoProvider>
        <CalendarProvider>
          {isFirebaseConfigured ? (
            <Suspense fallback={routes}>
              <FirebaseWorkspaceMembershipProvider>{routes}</FirebaseWorkspaceMembershipProvider>
            </Suspense>
          ) : routes}
        </CalendarProvider>
      </TodoProvider>
    </WorkspaceMembershipProvider>
  )
}
