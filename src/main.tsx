import React from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { LazyMotion } from "motion/react"
import App from "./App"
import "./styles/globals.css"
import "./styles/animations.css"
import { registerSW } from "virtual:pwa-register"

const firebaseChunkPattern = /\/assets\/(?:firebase-(?:auth|firestore)-sdk|firebase-workspace-)[^/]+\.js$/

function cacheLoadedFirebaseChunks(entries: PerformanceEntry[] = performance.getEntriesByType("resource")) {
  if (!navigator.serviceWorker?.controller) return
  const urls = new Set(entries
    .map(entry => entry.name)
    .filter(name => {
      try {
        const url = new URL(name)
        return url.origin === window.location.origin && firebaseChunkPattern.test(url.pathname)
      } catch {
        return false
      }
    }))
  for (const url of urls) void fetch(url).catch(() => undefined)
}

// Let the first screen finish loading before installing the offline cache.
window.addEventListener("load", () => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("controllerchange", () => cacheLoadedFirebaseChunks(), { once: true })
    if (typeof PerformanceObserver !== "undefined") {
      try {
        const observer = new PerformanceObserver(list => cacheLoadedFirebaseChunks(list.getEntries()))
        observer.observe({ type: "resource", buffered: true })
      } catch {
        // A browser without buffered resource entries still gets the controllerchange warm-up.
      }
    }
  }
  registerSW({ immediate: true })
  cacheLoadedFirebaseChunks()
}, { once: true })

const loadMotionFeatures = () => import("@/lib/motion-features").then(module => module.default)

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LazyMotion features={loadMotionFeatures}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </LazyMotion>
  </React.StrictMode>
)
