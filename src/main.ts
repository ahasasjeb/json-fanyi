import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { setup } from '@css-render/vue3-ssr'
import { createDiscreteApi, NMessageProvider } from 'naive-ui'
import naive from 'naive-ui'
import FingerprintJS from '@fingerprintjs/fingerprintjs'
import { useVisitorStore } from './stores/visitor'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)

// Initialize an agent at application startup.
const fpPromise = FingerprintJS.load()

;(async () => {
  // Get the visitor identifier when you need it.
  const fp = await fpPromise
  const result = await fp.get()
  const visitorStore = useVisitorStore()
  visitorStore.setVisitorId(result.visitorId)
})()

setup(app)

const { message } = createDiscreteApi(['message'])

app.use(naive)
app.component('NMessageProvider', NMessageProvider)

app.mount('#app')
