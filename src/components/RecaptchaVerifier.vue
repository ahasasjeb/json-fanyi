<template>
  <div ref="recaptchaContainer"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const emit = defineEmits(['verify'])
const recaptchaContainer = ref<HTMLElement | null>(null)
let recaptchaInstance: ReturnType<typeof setInterval> | null = null

const loadRecaptcha = () => {
  const script = document.createElement('script')
  script.src =
    'https://recaptcha.net/recaptcha/api.js?render=6LeH4qMqAAAAALrzBAOHH4CGp-ZPIceKUCP5KKFq'
  script.async = true
  document.head.appendChild(script)

  return new Promise((resolve) => {
    script.onload = resolve
  })
}

const executeRecaptcha = async () => {
  try {
    const token = await window.grecaptcha.execute('6LeH4qMqAAAAALrzBAOHH4CGp-ZPIceKUCP5KKFq', {
      action: 'submit',
    })
    emit('verify', token)
  } catch (error) {
    console.error('reCAPTCHA execution failed:', error)
  }
}

// 添加错误处理
onMounted(async () => {
  try {
    await loadRecaptcha()
    window.grecaptcha.ready(async () => {
      try {
        await executeRecaptcha()
        recaptchaInstance = setInterval(executeRecaptcha, 110000)
      } catch (error) {
        console.error('Initial reCAPTCHA execution failed:', error)
      }
    })
  } catch (error) {
    console.error('Failed to load reCAPTCHA:', error)
  }
})

onUnmounted(() => {
  if (recaptchaInstance) {
    clearInterval(recaptchaInstance)
  }
})

// 确保 reset 函数返回 token
const resetRecaptcha = async () => {
  try {
    // 确保 grecaptcha 已加载
    if (!window.grecaptcha) {
      await loadRecaptcha()
      // 修复类型错误，将 resolve 函数包装以接受参数
      await new Promise<void>((resolve) => window.grecaptcha.ready(() => resolve()))
    }

    const token = await window.grecaptcha.execute('6LeH4qMqAAAAALrzBAOHH4CGp-ZPIceKUCP5KKFq', {
      action: 'submit',
    })
    emit('verify', token)
    return token
  } catch (error) {
    console.error('Failed to reset reCAPTCHA:', error)
    throw error
  }
}

defineExpose({
  reset: resetRecaptcha,
})
</script>

<script lang="ts">
// 为 grecaptcha 添加更精确的类型声明
declare global {
  interface Window {
    grecaptcha: {
      ready: (callback: () => void) => void
      execute: (siteKey: string, options: { action: string }) => Promise<string>
    }
  }
}
</script>
