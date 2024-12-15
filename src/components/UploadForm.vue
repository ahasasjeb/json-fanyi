<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import type { UploadCustomRequestOptions } from 'naive-ui'
import { NUpload, NButton, NSpace, NCard, NProgress, useMessage } from 'naive-ui'

const message = useMessage()
const translatedContent = ref<string>('')
const loading = ref(false)
const progress = ref(0)
const currentKey = ref('')
const originalFileName = ref('')
const currentEventSource = ref<EventSource | null>(null)
const currentReader = ref<FileReader | null>(null)
const contentChunks = ref<string[]>([])
const totalChunks = ref(0)

// 关闭当前的 EventSource 连接
const closeCurrentEventSource = () => {
  if (currentEventSource.value) {
    currentEventSource.value.close()
    currentEventSource.value = null
  }
}

// 清理当前的 FileReader
const cleanupCurrentReader = () => {
  if (currentReader.value) {
    currentReader.value.onload = null
    currentReader.value.onerror = null
    currentReader.value = null
  }
}

// 客户端验证 JSON 格式
const validateJson = (file: File): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    // 清理之前的 FileReader
    cleanupCurrentReader()

    const reader = new FileReader()
    currentReader.value = reader

    reader.onload = (e) => {
      try {
        const content = JSON.parse(e.target?.result as string)

        // 验证是否为对象
        if (typeof content !== 'object' || Array.isArray(content)) {
          reject(new Error('JSON 必须是一个对象，不能是数组或其他类型'))
          return
        }

        // 验证是否只有单层键值对
        for (const [key, value] of Object.entries(content)) {
          if (typeof value !== 'string') {
            reject(new Error(`键 "${key}" 的值必须是字符串，不允许嵌套对象或数组`))
            return
          }
        }

        resolve(true)
      } catch (error) {
        reject(new Error('无效的 JSON 格式'))
      } finally {
        cleanupCurrentReader()
      }
    }

    reader.onerror = () => {
      reject(new Error('文件读取失败'))
      cleanupCurrentReader()
    }

    reader.readAsText(file)
  })
}

const customRequest = async ({ file }: UploadCustomRequestOptions) => {
  // 关闭之前的连接和清理
  closeCurrentEventSource()
  cleanupCurrentReader()

  loading.value = true
  progress.value = 0
  translatedContent.value = ''
  currentKey.value = ''
  originalFileName.value = file.file?.name || 'translated.json'
  contentChunks.value = []
  totalChunks.value = 0

  try {
    // 先在客户端验证 JSON 格式
    await validateJson(file.file as File)

    const formData = new FormData()
    formData.append('file', file.file as File)

    // First send the file using POST
    const response = await fetch('/api/translate', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || '上传失败')
    }

    // Then establish SSE connection for progress updates
    const eventSource = new EventSource(
      `/api/translate/progress?id=${response.headers.get('X-Translation-Id')}`,
    )

    // 保存当前的 EventSource
    currentEventSource.value = eventSource

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)

      switch (data.type) {
        case 'progress':
          progress.value = data.percentage
          if (data.lastTranslated) {
            currentKey.value = `正在翻译: ${data.lastTranslated.key}`
          }
          break

        case 'chunk':
          // Initialize chunks array if this is the first chunk
          if (data.chunkIndex === 0) {
            contentChunks.value = new Array(data.totalChunks)
            totalChunks.value = data.totalChunks
          }

          // Store the chunk
          contentChunks.value[data.chunkIndex] = data.data

          // If we have all chunks, combine them and parse
          if (contentChunks.value.filter(Boolean).length === totalChunks.value) {
            try {
              const fullContent = contentChunks.value.join('')
              translatedContent.value = JSON.stringify(JSON.parse(fullContent), null, 2)
              // Clear chunks array
              contentChunks.value = []
              totalChunks.value = 0
            } catch (error) {
              message.error('处理翻译数据时出错')
              closeCurrentEventSource()
              loading.value = false
            }
          }
          break

        case 'error':
          if (data.key) {
            message.warning(`翻译 "${data.key}" 时出错: ${data.error}`)
          } else {
            message.error(data.error || '翻译失败')
            closeCurrentEventSource()
            loading.value = false
          }
          break

        case 'complete':
          if (!translatedContent.value) {
            message.error('未收到完整的翻译内容')
            closeCurrentEventSource()
            loading.value = false
            return
          }
          message.success('翻译完成！')
          closeCurrentEventSource()
          loading.value = false
          break
      }
    }

    eventSource.onerror = () => {
      message.error('连接中断')
      closeCurrentEventSource()
      loading.value = false
    }
  } catch (error) {
    message.error((error as Error).message)
    loading.value = false
  }
}

// 组件卸载时关闭连接
onUnmounted(() => {
  closeCurrentEventSource()
  cleanupCurrentReader()
})

const saveToFile = () => {
  if (!translatedContent.value) {
    message.warning('没有可保存的翻译内容')
    return
  }

  try {
    // 创建 Blob 对象
    const blob = new Blob([translatedContent.value], { type: 'application/json;charset=utf-8' })

    // 创建下载链接
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.style.display = 'none'

    // 生成文件名（在原文件名前添加 translated_ 前缀）
    const fileName = originalFileName.value.replace('.json', '_translated.json')
    link.download = fileName

    // 触发下载
    document.body.appendChild(link)
    link.click()

    // 延迟清理，确保下载开始
    setTimeout(() => {
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    }, 100)

    message.success('文件已保存！')
  } catch (error) {
    message.error('保存文件失败：' + (error as Error).message)
  }
}
</script>

<template>
  <div class="container">
    <n-card title="JSON 翻译工具">
      <p>
        上传一个 JSON 文件，可以自动翻译成中文，请务必选择非嵌套json文件。
        如果卡在某个值半天没有翻译进展，多等等，不要刷新，因为上游负载满了，1分钟左右可能就恢复了。<br />
        使用gpt-4o-mini与deepseek-chat进行翻译，随机选择。没听过DeepSeek？这模型和gpt-4o-mini差不多，便宜还快。
      </p>
      <n-space vertical>
        <n-upload
          accept=".json"
          :max-size="3 * 1024 * 1024"
          :custom-request="customRequest"
          :show-file-list="false"
        >
          <n-button :loading="loading">
            {{ loading ? '翻译中...' : '上传 JSON 文件' }}
          </n-button>
        </n-upload>

        <n-button type="primary" :disabled="!translatedContent" @click="saveToFile">
          保存翻译结果
        </n-button>

        <template v-if="loading">
          <n-progress
            type="line"
            :percentage="progress"
            :height="24"
            indicator-placement="inside"
            processing
          >
            {{ `${progress}%` }}
          </n-progress>
          <div class="current-key" v-if="currentKey">
            {{ currentKey }}
          </div>
        </template>

        <div v-if="translatedContent" class="result">
          <pre>{{ translatedContent }}</pre>
        </div>
      </n-space>
    </n-card>
  </div>
</template>

<style scoped>
.current-key {
  margin-top: 8px;
  font-size: 14px;
  color: #666;
}

.result {
  margin-top: 1rem;
  background: #f5f5f5;
  padding: 1rem;
  border-radius: 4px;
}

.result pre {
  white-space: pre-wrap;
  word-wrap: break-word;
  max-height: 400px;
  overflow-y: auto;
}
</style>
