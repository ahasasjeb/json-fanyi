<script setup lang="ts">
import { NConfigProvider, NMessageProvider } from 'naive-ui'
import UploadForm from './components/UploadForm.vue'
import { onMounted } from 'vue'

onMounted(() => {
  const loadingMessage = document.getElementById('loading-message')
  if (loadingMessage) {
    setTimeout(() => {
      loadingMessage.style.display = 'none'
    }, 200)
  }
})
</script>

<template>
  <n-config-provider>
    <n-loading-bar-provider>
      <n-message-provider>
        <n-notification-provider>
          <n-modal-provider>
            <n-dialog-provider>
              <upload-form />
            </n-dialog-provider>
          </n-modal-provider>
        </n-notification-provider>
      </n-message-provider>
    </n-loading-bar-provider>
  </n-config-provider>
</template>

<style scoped>
:deep(.container) {
  max-width: 800px;
  margin: 2rem auto;
  min-height: 100vh;
  padding: 1rem;
  box-sizing: border-box;
}

:deep(.result) {
  margin-top: 1rem;
  background: #f5f5f5;
  padding: 1rem;
  border-radius: 4px;
}

:deep(.result pre) {
  white-space: pre-wrap;
  word-wrap: break-word;
  max-height: 400px;
  overflow-y: auto;
}
</style>
