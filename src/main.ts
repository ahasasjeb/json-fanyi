import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { setup } from '@css-render/vue3-ssr'
import { createDiscreteApi, NMessageProvider } from 'naive-ui'

const app = createApp(App)
setup(app)

const { message } = createDiscreteApi(['message'])

app.use(createPinia())
app.component('NMessageProvider', NMessageProvider)

app.mount('#app')
