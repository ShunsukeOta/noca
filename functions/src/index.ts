import { createHash } from "node:crypto"
import { initializeApp } from "firebase-admin/app"
import { FieldValue, getFirestore } from "firebase-admin/firestore"
import { logger } from "firebase-functions"
import { onDocumentCreated } from "firebase-functions/v2/firestore"
import { onSchedule } from "firebase-functions/v2/scheduler"
import { defineSecret, defineString } from "firebase-functions/params"
import webpush, { type PushSubscription } from "web-push"

initializeApp()

const db = getFirestore()
const vapidPublicKey = defineString("PUSH_VAPID_PUBLIC_KEY")
const vapidPrivateKey = defineSecret("PUSH_VAPID_PRIVATE_KEY")
const vapidSubject = defineString("PUSH_VAPID_SUBJECT", { default: "https://noca-delta.vercel.app" })
const FUNCTION_REGION = "asia-northeast1"
const TIMEZONE_FALLBACK = "Asia/Tokyo"
const TODO_REMINDER_HOUR = 9
const LATE_DELIVERY_WINDOW_MS = 10 * 60_000

type NotificationPreferences = {
  eventReminders?: boolean
  todoDeadlines?: boolean
  sharedUpdates?: boolean
}

type RegisteredSubscription = {
  id: string
  uid: string
  endpoint: string
  keys: { p256dh: string; auth: string }
  timezone?: string
  preferences?: NotificationPreferences
  reference: FirebaseFirestore.DocumentReference
}

type NotificationPayload = {
  title: string
  body: string
  url: string
  tag: string
}

type WorkspaceRecordData = {
  record?: Record<string, unknown>
  deleted?: boolean
  updatedByUid?: string
  sourceInstallId?: string
}

function pushClient() {
  webpush.setVapidDetails(vapidSubject.value(), vapidPublicKey.value(), vapidPrivateKey.value())
  return webpush
}

function getSubscription(snapshot: FirebaseFirestore.QueryDocumentSnapshot): RegisteredSubscription | null {
  const data = snapshot.data()
  if (typeof data.uid !== "string" || typeof data.endpoint !== "string" || !data.endpoint.startsWith("https://") ||
    typeof data.keys?.p256dh !== "string" || typeof data.keys?.auth !== "string") return null
  const rawTimezone = typeof data.timezone === "string" ? data.timezone : TIMEZONE_FALLBACK
  let timezone = TIMEZONE_FALLBACK
  try {
    new Intl.DateTimeFormat("en", { timeZone: rawTimezone }).format(new Date())
    timezone = rawTimezone
  } catch {
    // Ignore invalid values written by older clients; notification times fall back to Japan.
  }
  return {
    id: snapshot.id,
    uid: data.uid,
    endpoint: data.endpoint,
    keys: { p256dh: data.keys.p256dh, auth: data.keys.auth },
    timezone,
    preferences: data.preferences && typeof data.preferences === "object" ? data.preferences as NotificationPreferences : {},
    reference: snapshot.ref
  }
}

function webPushSubscription(subscription: RegisteredSubscription): PushSubscription {
  return { endpoint: subscription.endpoint, keys: subscription.keys }
}

function markerId(subscriptionId: string, kind: string, recordId: string, date: string) {
  return createHash("sha256").update(`${subscriptionId}:${kind}:${recordId}:${date}`).digest("hex")
}

async function sendOnce(
  workspaceId: string,
  subscription: RegisteredSubscription,
  kind: string,
  recordId: string,
  date: string,
  payload: NotificationPayload
) {
  const deliveryRef = db.doc(`workspaces/${workspaceId}/notificationDeliveries/${markerId(subscription.id, kind, recordId, date)}`)
  const claimed = await db.runTransaction(async transaction => {
    const prior = await transaction.get(deliveryRef)
    if (prior.exists) return false
    transaction.create(deliveryRef, { kind, recordId, subscriptionId: subscription.id, state: "sending", createdAt: FieldValue.serverTimestamp() })
    return true
  })
  if (!claimed) return

  try {
    await pushClient().sendNotification(webPushSubscription(subscription), JSON.stringify(payload), {
      TTL: 60 * 60,
      urgency: "normal",
      topic: markerId(subscription.id, kind, recordId, date).slice(0, 32)
    })
  } catch (error) {
    const statusCode = typeof error === "object" && error !== null && "statusCode" in error
      ? Number((error as { statusCode: unknown }).statusCode) : 0
    if (statusCode === 404 || statusCode === 410) {
      await Promise.all([subscription.reference.delete(), deliveryRef.update({ expired: true })])
      return
    }
    await deliveryRef.delete().catch(() => undefined)
    logger.error("Web Push delivery failed", { workspaceId, subscriptionId: subscription.id, statusCode })
    throw error
  }
  await deliveryRef.update({ state: "sent", sentAt: FieldValue.serverTimestamp() }).catch(error => {
    logger.warn("Web Push delivery marker could not be updated", { workspaceId, subscriptionId: subscription.id, error })
  })
}

async function sendNewItemNotification(
  workspaceId: string,
  recordId: string,
  senderUid: string,
  kind: "todos" | "calendarEvents",
  data: WorkspaceRecordData
) {
  const workspaceRef = db.doc(`workspaces/${workspaceId}`)
  const [workspace, registrations] = await Promise.all([
    workspaceRef.get(),
    workspaceRef.collection("notificationSubscriptions").where("uid", "!=", senderUid).get()
  ])
  const memberUids: unknown = workspace.data()?.memberUids
  if (!workspace.exists || !Array.isArray(memberUids) || memberUids.length < 2) return
  const recipients = new Set(memberUids.filter((uid): uid is string => typeof uid === "string" && uid !== senderUid))
  const record = data.record ?? {}
  const title = typeof record.title === "string" ? record.title.slice(0, 160) : "新しい項目"
  const calendar = kind === "calendarEvents"
  const date = typeof record.date === "string" ? record.date : ""
  const time = typeof record.time === "string" ? record.time : ""
  const body = calendar
    ? `${title}${date ? ` · ${date}` : ""}${time ? ` ${time}` : ""}`
    : title
  const payload: NotificationPayload = {
    title: calendar ? "予定が追加されました" : "TODOが追加されました",
    body,
    url: calendar && date ? `/calendar?date=${encodeURIComponent(date)}` : "/todo",
    tag: `${calendar ? "event" : "todo"}-${recordId}`
  }
  const subscriptions = registrations.docs
    .map(getSubscription)
    .filter((item): item is RegisteredSubscription => !!item && recipients.has(item.uid) && item.preferences?.sharedUpdates === true)

  await Promise.all(subscriptions.map(subscription => sendOnce(
    workspaceId, subscription, `shared-${kind}`, recordId, String(data.record?.date ?? "new"), payload
  )))
}

async function onNewTodo(snapshot: FirebaseFirestore.QueryDocumentSnapshot, workspaceId: string, recordId: string) {
  const data = snapshot.data() as WorkspaceRecordData
  if (data.deleted === true || data.record?.done === true || typeof data.updatedByUid !== "string" || data.sourceInstallId) return
  await sendNewItemNotification(workspaceId, recordId, data.updatedByUid, "todos", data)
}

async function onNewEvent(snapshot: FirebaseFirestore.QueryDocumentSnapshot, workspaceId: string, recordId: string) {
  const data = snapshot.data() as WorkspaceRecordData
  if (data.deleted === true || typeof data.updatedByUid !== "string" || data.sourceInstallId) return
  await sendNewItemNotification(workspaceId, recordId, data.updatedByUid, "calendarEvents", data)
}

export const notifyPartnerOfTodo = onDocumentCreated({
  document: "workspaces/{workspaceId}/todos/{recordId}",
  region: FUNCTION_REGION,
  retry: true,
  secrets: [vapidPrivateKey]
}, event => {
  if (!event.data) return
  return onNewTodo(event.data, event.params.workspaceId, event.params.recordId)
})

export const notifyPartnerOfEvent = onDocumentCreated({
  document: "workspaces/{workspaceId}/calendarEvents/{recordId}",
  region: FUNCTION_REGION,
  retry: true,
  secrets: [vapidPrivateKey]
}, event => {
  if (!event.data) return
  return onNewEvent(event.data, event.params.workspaceId, event.params.recordId)
})

function formatLocalParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(date)
  return Object.fromEntries(parts.map(part => [part.type, part.value]))
}

function localDate(date: Date, timeZone: string) {
  try {
    const parts = formatLocalParts(date, timeZone)
    return `${parts.year}-${parts.month}-${parts.day}`
  } catch {
    return `${formatLocalParts(date, TIMEZONE_FALLBACK).year}-${formatLocalParts(date, TIMEZONE_FALLBACK).month}-${formatLocalParts(date, TIMEZONE_FALLBACK).day}`
  }
}

function wallClockToDate(date: string, time: string, timeZone: string): Date | null {
  const [year, month, day] = date.split("-").map(Number)
  const [hour, minute] = time.split(":").map(Number)
  const target = Date.UTC(year, month - 1, day, hour, minute)
  let guess = target
  try {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const parts = formatLocalParts(new Date(guess), timeZone)
      const actual = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute))
      const delta = target - actual
      if (delta === 0) return new Date(guess)
      guess += delta
    }
  } catch {
    return null
  }
  return null
}

function workspaceIdForRecord(snapshot: FirebaseFirestore.QueryDocumentSnapshot) {
  return snapshot.ref.parent.parent?.id ?? null
}

async function loadSubscriptions() {
  const snapshot = await db.collectionGroup("notificationSubscriptions").get()
  return snapshot.docs.map(getSubscription).filter((item): item is RegisteredSubscription => !!item)
}

async function sendReminderForSubscriptions(
  workspaceId: string,
  recordId: string,
  date: string,
  kind: "todo-deadline" | "event-reminder",
  subscriptions: RegisteredSubscription[],
  payload: NotificationPayload
) {
  await Promise.all(subscriptions.map(subscription => sendOnce(workspaceId, subscription, kind, recordId, date, payload)))
}

export const sendDueReminders = onSchedule({
  schedule: "every 5 minutes",
  timeZone: "UTC",
  region: FUNCTION_REGION,
  maxInstances: 1,
  secrets: [vapidPrivateKey]
}, async () => {
  const now = new Date()
  const subscriptions = await loadSubscriptions()
  const dueReminderSubscriptions = subscriptions.filter(item => item.preferences?.todoDeadlines === true || item.preferences?.eventReminders === true)
  const timeZones = [...new Set(dueReminderSubscriptions.map(item => item.timezone || TIMEZONE_FALLBACK))]

  for (const timeZone of timeZones) {
    const today = localDate(now, timeZone)
    const zoneSubscriptions = dueReminderSubscriptions.filter(item => item.timezone === timeZone)
    const todoTargets = new Map<string, RegisteredSubscription[]>()
    const eventTargets = new Map<string, RegisteredSubscription[]>()
    for (const subscription of zoneSubscriptions) {
      const workspaceId = subscription.reference.parent.parent?.id
      if (!workspaceId) continue
      if (subscription.preferences?.todoDeadlines === true) {
        todoTargets.set(workspaceId, [...(todoTargets.get(workspaceId) ?? []), subscription])
      }
      if (subscription.preferences?.eventReminders === true) {
        eventTargets.set(workspaceId, [...(eventTargets.get(workspaceId) ?? []), subscription])
      }
    }

    const deadlineReminderAt = wallClockToDate(today, `${String(TODO_REMINDER_HOUR).padStart(2, "0")}:00`, timeZone)
    if (deadlineReminderAt && now.getTime() >= deadlineReminderAt.getTime() &&
      now.getTime() < deadlineReminderAt.getTime() + LATE_DELIVERY_WINDOW_MS) {
      const dueTodos = await db.collectionGroup("todos")
        .where("deleted", "==", false)
        .where("record.dueDate", "==", today)
        .get()
      await Promise.all(dueTodos.docs.map(async snapshot => {
        const workspaceId = workspaceIdForRecord(snapshot)
        const data = snapshot.data()
        if (!workspaceId || data.record?.done === true) return
        const targets = todoTargets.get(workspaceId)
        if (!targets?.length) return
        const title = typeof data.record?.title === "string" ? data.record.title.slice(0, 160) : "期限のTODO"
        await sendReminderForSubscriptions(workspaceId, snapshot.id, today, "todo-deadline", targets, {
          title: "今日が期限です",
          body: title,
          url: "/todo",
          tag: `todo-deadline-${snapshot.id}-${today}`
        })
      }))
    }

    if (eventTargets.size > 0) {
      const events = await db.collectionGroup("calendarEvents")
        .where("deleted", "==", false)
        .where("record.date", "==", today)
        .get()
      await Promise.all(events.docs.map(async snapshot => {
        const workspaceId = workspaceIdForRecord(snapshot)
        const data = snapshot.data()
        const time = data.record?.time
        if (!workspaceId || typeof time !== "string") return
        const targets = eventTargets.get(workspaceId)
        if (!targets?.length) return
        const eventAt = wallClockToDate(today, time, timeZone)
        if (!eventAt) return
        const reminderAt = eventAt.getTime() - 30 * 60_000
        if (now.getTime() < reminderAt || now.getTime() >= reminderAt + LATE_DELIVERY_WINDOW_MS) return
        const title = typeof data.record?.title === "string" ? data.record.title.slice(0, 160) : "予定"
        await sendReminderForSubscriptions(workspaceId, snapshot.id, today, "event-reminder", targets, {
          title: "予定まであと30分です",
          body: title,
          url: `/calendar?date=${encodeURIComponent(today)}`,
          tag: `event-reminder-${snapshot.id}-${today}`
        })
      }))
    }
  }
})
