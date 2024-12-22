<template>
  <n-space>
    <n-button @click="notify('info')" type="info"> {{ $t('update') }} </n-button>
  </n-space>
</template>

<script lang="ts">
import type { NotificationType } from 'naive-ui'
import { useNotification } from 'naive-ui'
import { defineComponent } from 'vue'
import { changeLog } from './changelog'

export default defineComponent({
  setup() {
    const notification = useNotification()
    return {
      notify(type: string) {
        if (['info', 'success', 'warning', 'error'].includes(type)) {
          // 获取最新的日期
          const latestDate = Object.keys(changeLog)[0]
          notification[type as NotificationType]({
            title: latestDate,
            content: Object.entries(changeLog)
              .map(([date, content]) => `${date}:\n${content}`)
              .join('\n\n'),
            duration: 2500,
            keepAliveOnHover: true,
          })
        }
      },
    }
  },
})
</script>
