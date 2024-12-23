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
  // 使用测试密钥
  script.src =
    'https://recaptcha.net/recaptcha/api.js?render=6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI'
  script.async = true
  document.head.appendChild(script)

  return new Promise((resolve) => {
    script.onload = resolve
  })
}

const executeRecaptcha = async () => {
  try {
    // 使用测试密钥
    const token = await window.grecaptcha.execute('6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI', {
      action: 'submit',
    })
    emit('verify', token)
  } catch (error) {
    console.error('reCAPTCHA execution failed:', error)
  }
}

// 添加重置方法
const resetRecaptcha = async () => {
  try {
    const token = await executeRecaptcha()
    emit('verify', token)
  } catch (error) {
    console.error('Failed to reset reCAPTCHA:', error)
  }
}

defineExpose({
  reset: resetRecaptcha,
})

onMounted(async () => {
  await loadRecaptcha()
  window.grecaptcha.ready(() => {
    recaptchaInstance = setInterval(executeRecaptcha, 110000) // 每110秒刷新一次token
  })
})

onUnmounted(() => {
  if (recaptchaInstance) {
    clearInterval(recaptchaInstance)
  }
})
</script>

<script lang="ts">
// 为 grecaptcha 添加类型声明
declare global {
  interface Window {
    grecaptcha: {
      ready: (callback: () => void) => void
      execute: (siteKey: string, options: { action: string }) => Promise<string>
    }
  }
}
</script>
