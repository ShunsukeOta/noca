import { getApp, getApps, initializeApp } from "firebase/app"
import { doc, getDoc, getFirestore, runTransaction, serverTimestamp } from "firebase/firestore"
import { getFirebaseConfig, isFirebaseConfigured } from "@/features/workspace/firebase-env"

export type PushPreferences = {
  eventReminders: boolean
  todoDeadlines: boolean
  sharedUpdates: boolean
}

export const DEFAULT_PUSH_PREFERENCES: PushPreferences = {
  eventReminders: false,
  todoDeadlines: false,
  sharedUpdates: false
}

const publicVapidKey = import.meta.env.VITE_WEB_PUSH_VAPID_PUBLIC_KEY as string | undefined
const deviceIdKey = "noca.push.device-id.v1"

function pushSupported() {
  return typeof window !== "undefined" && "Notification" in window && "PushManager" in window && "serviceWorker" in navigator
}

function getDatabase() {
  const app = getApps().length > 0 ? getApp() : initializeApp(getFirebaseConfig())
  return getFirestore(app)
}

function getDeviceId() {
  let id = localStorage.getItem(deviceIdKey)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(deviceIdKey, id)
  }
  return id
}

function publicKeyBytes(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4)
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(base64)
  return Uint8Array.from(raw, character => character.charCodeAt(0))
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && navigator.standalone === true)
}

export function pushEnvironment() {
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  return {
    supported: pushSupported(),
    firebaseConfigured: isFirebaseConfigured,
    configured: isFirebaseConfigured && !!publicVapidKey?.trim(),
    requiresHomeScreen: ios && !isStandalone(),
    permission: pushSupported() ? Notification.permission : "unsupported"
  }
}

function subscriptionPath(workspaceId: string, uid: string) {
  return doc(getDatabase(), "workspaces", workspaceId, "notificationSubscriptions", `${uid}_${getDeviceId()}`)
}

export async function loadPushPreferences(workspaceId: string, uid: string) {
  if (!pushSupported()) return { active: false, preferences: DEFAULT_PUSH_PREFERENCES }
  const registration = await navigator.serviceWorker.ready
  const activeSubscription = await registration.pushManager.getSubscription()
  const reference = subscriptionPath(workspaceId, uid)
  const snapshot = await getDoc(reference)
  const savedPreferences = snapshot.data()?.preferences as Partial<PushPreferences> | undefined
  const preferences: PushPreferences = {
    eventReminders: savedPreferences?.eventReminders === true,
    todoDeadlines: savedPreferences?.todoDeadlines === true,
    sharedUpdates: savedPreferences?.sharedUpdates === true
  }
  const hasEnabledPreference = Object.values(preferences).some(Boolean)
  const subscriptionMatches = !!activeSubscription && snapshot.exists() && snapshot.data().endpoint === activeSubscription.endpoint
  if (!subscriptionMatches || !hasEnabledPreference) {
    if (snapshot.exists()) {
      await runTransaction(getDatabase(), async transaction => {
        const current = await transaction.get(reference)
        if (!current.exists()) return
        const currentPreferences = current.data().preferences as Partial<PushPreferences> | undefined
        const currentEnabled = Object.values(currentPreferences ?? {}).some(value => value === true)
        if (!activeSubscription || current.data().endpoint !== activeSubscription.endpoint || !currentEnabled) {
          transaction.delete(reference)
        }
      })
    }
    if (activeSubscription && !hasEnabledPreference) await activeSubscription.unsubscribe()
    return { active: false, preferences: DEFAULT_PUSH_PREFERENCES }
  }
  return {
    active: true,
    preferences
  }
}

export async function savePushPreferences(workspaceId: string, uid: string, preferences: PushPreferences) {
  if (!pushSupported()) throw new Error("このブラウザーはプッシュ通知に対応していません。")
  if (!isFirebaseConfigured) throw new Error("Firebaseの設定がまだ完了していません。")
  const hasEnabledPreference = Object.values(preferences).some(Boolean)
  if (hasEnabledPreference && pushEnvironment().requiresHomeScreen) throw new Error("iPhoneではホーム画面に追加したアプリから設定してください。")
  const vapidKey = publicVapidKey?.trim()
  if (hasEnabledPreference && !vapidKey) throw new Error("プッシュ通知の公開キー設定がまだ完了していません。")

  // Ask immediately in the switch tap's call stack; iOS requires a direct user gesture.
  const permissionRequest = hasEnabledPreference && Notification.permission === "default"
    ? Notification.requestPermission()
    : Promise.resolve(Notification.permission)
  if (hasEnabledPreference && await permissionRequest !== "granted") {
    throw new Error("ブラウザーの通知を許可してください。")
  }

  const registration = await navigator.serviceWorker.ready
  let subscription = await registration.pushManager.getSubscription()
  if (!subscription && hasEnabledPreference) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: publicKeyBytes(vapidKey ?? "")
    })
  }
  const reference = subscriptionPath(workspaceId, uid)
  if (!hasEnabledPreference) {
    await runTransaction(getDatabase(), async transaction => {
      const current = await transaction.get(reference)
      if (current.exists()) transaction.delete(reference)
    })
    if (subscription) await subscription.unsubscribe()
    return
  }
  if (!subscription) throw new Error("この端末の通知登録を作成できませんでした。")
  const serialized = subscription.toJSON()
  const p256dh = serialized.keys?.p256dh
  const auth = serialized.keys?.auth
  if (!serialized.endpoint || !p256dh || !auth) {
    throw new Error("この端末の通知登録を読み取れませんでした。")
  }

  await runTransaction(getDatabase(), async transaction => {
    const current = await transaction.get(reference)
    transaction.set(reference, {
      uid,
      endpoint: serialized.endpoint,
      keys: { p256dh, auth },
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Tokyo",
      preferences,
      createdAt: current.exists() ? current.data().createdAt : serverTimestamp(),
      updatedAt: serverTimestamp()
    })
  })
  if (!hasEnabledPreference) await subscription.unsubscribe()
}
