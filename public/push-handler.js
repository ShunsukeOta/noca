/* Web Push runs independently of the page so notifications can arrive while noca is closed. */
self.addEventListener("push", event => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { body: event.data ? event.data.text() : "" }
  }

  const title = typeof payload.title === "string" ? payload.title : "noca"
  const body = typeof payload.body === "string" ? payload.body : ""
  const url = typeof payload.url === "string" ? payload.url : "/todo"
  const tag = typeof payload.tag === "string" ? payload.tag : undefined
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: "/noca-icon.svg",
    badge: "/noca-icon.svg",
    tag,
    renotify: false,
    data: { url }
  }))
})

self.addEventListener("notificationclick", event => {
  event.notification.close()
  const value = event.notification.data && typeof event.notification.data.url === "string"
    ? event.notification.data.url : "/todo"
  const target = new URL(value, self.location.origin)
  if (target.origin !== self.location.origin) target.href = new URL("/todo", self.location.origin).href
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(windowClients => {
    for (const client of windowClients) {
      if ("focus" in client) {
        return client.navigate(target.href).then(() => client.focus())
      }
    }
    return self.clients.openWindow(target.href)
  }))
})
