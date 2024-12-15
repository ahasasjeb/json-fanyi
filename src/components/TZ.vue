<template>
  <n-space>
    <n-button @click="notify('info')" type="info"> 更新日志 </n-button>
  </n-space>
</template>

<script lang="ts">
import type { NotificationType } from 'naive-ui'
import { useNotification } from 'naive-ui'
import { defineComponent } from 'vue'

export default defineComponent({
  setup() {
    const notification = useNotification()
    return {
      notify(type: string) {
        if (['info', 'success', 'warning', 'error'].includes(type)) {
          notification[type as NotificationType]({
            content: '2024-12-15',
            meta: '进一步完善后端提示词，更换gpt-4o-mini到更可靠的渠道，进一步优化前端js文件',
            duration: 2500,
            keepAliveOnHover: true,
          })
        }
      },
    }
  },
})
</script>
