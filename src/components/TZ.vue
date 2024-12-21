<template>
  <n-space>
    <n-button @click="notify('info')" type="info"> {{ $t('update') }} </n-button>
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
            title: '2024-12-21',
            content: `添加双向翻译，i18n进度推进。
2024-12-20:
完善后端，优化模型输出，确保输出非json格式，防止破坏语言文件。增加i18n，接入openai官方渠道gpt-4o-mini
2024-12-18：
完善DNT相关
2024-12-16：
优化js大小，收集数据进行统计
2024-12-15:
进一步完善后端提示词，更换gpt-4o-mini到更可靠的渠道，进一步优化前端js文件`,
            duration: 2500,
            keepAliveOnHover: true,
          })
        }
      },
    }
  },
})
</script>
