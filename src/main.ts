import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { setup } from '@css-render/vue3-ssr'
import { createDiscreteApi, NMessageProvider } from 'naive-ui'
import naive from 'naive-ui'
import FingerprintJS from '@fingerprintjs/fingerprintjs'

// Initialize an agent at application startup.
const fpPromise = FingerprintJS.load()

;(async () => {
  // Get the visitor identifier when you need it.
  const fp = await fpPromise
  const result = await fp.get()
  console.log(result.visitorId)
})()
const app = createApp(App)
setup(app)

const { message } = createDiscreteApi(['message'])

app.use(createPinia())
app.use(naive)
app.component('NMessageProvider', NMessageProvider)

app.mount('#app')
