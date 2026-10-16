import type { CalendarEvent, Task } from "@/app/mock-data"

// Identifies the exact bundled records used by older preview releases. Requiring
// both fields keeps a user's edited or repurposed record with the same legacy ID.
const legacyTasks = new Map([
  ["t1", "週末のカフェを探す"],
  ["t2", "洗剤と柔軟剤を買う"],
  ["t3", "旅行の宿泊先を決める"],
  ["t4", "部屋の片付け"],
  ["t5", "次のお出かけの候補を送る"]
])

const legacyEvents = new Map([
  ["e1", "夜ごはん"],
  ["e2", "ランチに行く"],
  ["e3", "買い出し"],
  ["e4", "映画を観る"],
  ["demo-a-morning", "午前の用事"],
  ["demo-b-hair", "美容室"],
  ["demo-a-payday", "給料日"],
  ["demo-b-dayoff", "お休み"],
  ["demo-next-a", "買い物に行く"],
  ["demo-next-b", "友だちとランチ"],
  ["demo-next-a-all", "在宅の日"],
  ["demo-next-b-all", "休暇"],
  ["demo-v3-a-meeting", "打ち合わせ"],
  ["demo-v3-both-all", "記念日"],
  ["demo-v3-both-timed", "ふたりで買い物"],
  ["demo-v3-next-both", "夜の散歩"]
])

// Deterministic document IDs used when the old local samples were imported to
// Firestore. This lets the offline cache identify them without a network call.
const legacyWorkspaceTasks = new Map([
  ["legacy_todos_80a44082f8207dbb0e5fe3170fbd1ec5d4edd7de4244ceba0f55d80d5b87894b", "週末のカフェを探す"],
  ["legacy_todos_d94d69cec90d5ad43ae8034a7cb89cefda99c681c33fb7b2aea2b1fafb760fd4", "洗剤と柔軟剤を買う"],
  ["legacy_todos_6ab2a70cd39f92bbac8a9a278caa5db95cc9e73976cf54f49a7ce9abc1976740", "旅行の宿泊先を決める"],
  ["legacy_todos_9b388c765568f3c89a8c123ac8fd1e8e46d15494e9e2d670462d796d4836eae0", "部屋の片付け"],
  ["legacy_todos_21dd75e6e4d99b3e6faf91ca9f1ad8a6c3fbdd23507399eecd503865016f4b2a", "次のお出かけの候補を送る"]
])

const legacyWorkspaceEvents = new Map([
  ["legacy_events_5b497d2c5ac7c6904c2bf61911bd2dbc9a6b09070bad567007fc655f42f6c7b2", "夜ごはん"],
  ["legacy_events_16b128e81c4025ad18fc5f072483134c930b50bd3755a19c41f70f2e6a026059", "ランチに行く"],
  ["legacy_events_a87f88277838bc9e9c2e4940f189b075d4e6ba7c5ff8bd7d356e31d3cd93607c", "買い出し"],
  ["legacy_events_066e64b530edc371b5a52d56e29fa0df06f58c0366181fdc39fdf52e3e90b9ee", "映画を観る"],
  ["legacy_events_9b252a08dba46d85ba6fe29a917d364b1356ea0a8cf1cd96f8170913ff0cb9bf", "午前の用事"],
  ["legacy_events_b2374a7f690a811f37b6da6dfc96ae720e3d870e96be2c0183e6fe67be13f4ed", "美容室"],
  ["legacy_events_8515461f6f7091f04d00b4f19fbb0542b16919061bf1de57edd12ad6ec7f95a9", "給料日"],
  ["legacy_events_ff75b6a6d54b0023d15c28c9662c31332c56e2fbf35e80337dfb11fa8e37d516", "お休み"],
  ["legacy_events_3b4c2c4adc0867efba3ec39e1ef05c50e31c30cce050f87c768d527d4d42e4b5", "買い物に行く"],
  ["legacy_events_16c31561670b884184d31e0d2b8cb386ec62b22dd1ad667d95add65c716246a3", "友だちとランチ"],
  ["legacy_events_01c11476092aadb14fe8765d2f3fb59ed077b5c4c7e9b61da35d25d493b29400", "在宅の日"],
  ["legacy_events_26894afce95d8f71300b8e59639777caa1eb9f7ad17b97e9a721ab039c20503b", "休暇"],
  ["legacy_events_e859edacc50644e18f0a996422dc15e27a93c1d3f6fd767544616a47d609399b", "打ち合わせ"],
  ["legacy_events_a25d7ea87e64e1b147c7bfb2a9d7eced6977a9e164504f1957083bea4c01e298", "記念日"],
  ["legacy_events_a71173d565e519c1bafa1fe176e96e1666bd3786bc5996d00b6251acc9373650", "ふたりで買い物"],
  ["legacy_events_c5d03a46414188e3363cc41bf902bf88d8300950929d8c2a13f1a50bc8edf306", "夜の散歩"]
])

export function isLegacyDemoTask(task: Pick<Task, "id" | "title">) {
  return legacyTasks.get(task.id) === task.title
}

export function isLegacyDemoEvent(event: Pick<CalendarEvent, "id" | "title">) {
  return legacyEvents.get(event.id) === event.title
}

export function isLegacyDemoRecord(kind: "todos" | "events", record: unknown) {
  if (!record || typeof record !== "object") return false
  const value = record as { id?: unknown; title?: unknown }
  if (typeof value.id !== "string" || typeof value.title !== "string") return false
  return kind === "todos"
    ? isLegacyDemoTask({ id: value.id, title: value.title })
    : isLegacyDemoEvent({ id: value.id, title: value.title })
}

export function isLegacyDemoWorkspaceRecord(kind: "todos" | "events", record: unknown) {
  if (!record || typeof record !== "object") return false
  const value = record as { id?: unknown; title?: unknown }
  if (typeof value.id !== "string" || typeof value.title !== "string") return false
  return (kind === "todos" ? legacyWorkspaceTasks : legacyWorkspaceEvents).get(value.id) === value.title
}

export function removeLegacyDemoTasks(tasks: Task[]) {
  return tasks.filter(task => !isLegacyDemoTask(task) && !isLegacyDemoWorkspaceRecord("todos", task))
}

export function removeLegacyDemoEvents(events: CalendarEvent[]) {
  return events.filter(event => !isLegacyDemoEvent(event) && !isLegacyDemoWorkspaceRecord("events", event))
}
