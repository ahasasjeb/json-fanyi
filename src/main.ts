import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { setup } from '@css-render/vue3-ssr'
import { createDiscreteApi, NMessageProvider, NButton, NSpace, NInput, NSelect } from 'naive-ui'
import FingerprintJS from '@fingerprintjs/fingerprintjs'
import { useVisitorStore } from './stores/visitor'
import { createI18n } from 'vue-i18n'
import zh_CN from './locales/zhCN.json'
import en from './locales/en.json'
const i18n = createI18n({
  locale: 'zh-CN',
  fallbackLocale: 'en',
  messages: {
    zh_CN, // 修改这里，key 应该与 locale 值匹配
    en: en,
  },
})
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

app.component('NMessageProvider', NMessageProvider)
app.component('NButton', NButton)
app.component('NSpace', NSpace)
app.component('NInput', NInput)
app.component('NSelect', NSelect)
app.use(i18n)
app.mount('#app')
