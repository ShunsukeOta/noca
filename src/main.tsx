import React from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { LazyMotion } from "motion/react"
import App from "./App"
import "./styles/globals.css"
import "./styles/animations.css"
import { registerSW } from "virtual:pwa-register"

// Let the first screen finish loading before installing the offline cache.
window.addEventListener("load", () => { registerSW({ immediate: true }) }, { once: true })

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
