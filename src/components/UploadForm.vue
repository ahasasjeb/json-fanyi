<script setup lang="ts">
import { ref, onUnmounted, onMounted } from 'vue'
import type { UploadCustomRequestOptions } from 'naive-ui'
import { NUpload, NButton, NSpace, NCard, NProgress, useMessage, NModal, NSelect } from 'naive-ui'
import TZ from './TZ.vue'
import { useVisitorStore } from '../stores/visitor'
import { useI18n } from 'vue-i18n'
import RecaptchaVerifier from './RecaptchaVerifier.vue'

const { t, locale } = useI18n()
const message = useMessage()
const visitorStore = useVisitorStore()
const translatedContent = ref<string>('')
const loading = ref(false)
const progress = ref(0)
const currentKey = ref('')
const originalFileName = ref('')
const currentEventSource = ref<EventSource | null>(null)
const currentReader = ref<FileReader | null>(null)
const contentChunks = ref<string[]>([])
const totalChunks = ref(0)
const showTrackingDialog = ref(false)
const hasUserConsent = ref(false)
const JavaMc = ref(false)
const showPrivacyDetails = ref(false)

const activeTaskCount = ref(0)
const totalTaskCount = ref(0)

// 添加语言选择选项
const languageOptions = [
  { label: '简体中文', value: 'zh_CN' },
  { label: 'English', value: 'en' },
]
const translationDirectionOptions = [
  { label: t('uploadForm.translationDirection.en2zh'), value: 'en2zh' },
  { label: t('uploadForm.translationDirection.zh2en'), value: 'zh2en' },
]
const translationDirection = ref('en2zh')
// 添加语言切换处理函数
const handleLanguageChange = (value: string) => {
  locale.value = value
  localStorage.setItem('userLanguage', value)
}

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
          reject(new Error(t('jsonError1')))
          return
        }

        // 验证key数量
        const keyCount = Object.keys(content).length
        if (keyCount > 1000) {
          reject(new Error(`${t('jsonError5')}${keyCount}${t('jsonError6')}`))
          return
        }

        // 验证是否只有单层键值对
        for (const [key, value] of Object.entries(content)) {
          if (typeof value !== 'string') {
            reject(new Error(`${t('jsonKey')}${key} ${t('jsonError2')}`))
            return
          }
        }

        resolve(true)
      } catch (error) {
        reject(new Error(t('jsonError3')))
      } finally {
        cleanupCurrentReader()
      }
    }

    reader.onerror = () => {
      reject(new Error(t('jsonError4')))
      cleanupCurrentReader()
    }

    reader.readAsText(file)
  })
}
// 检查 Do Not Track 设置和用户同意状态
const checkTrackingConsent = () => {
  if (navigator.doNotTrack === '1') {
    message.success(t('uploadForm.dntEnabled'))
    return true
  }
  // 检查本地存储中的用户同意状态
  const storedConsent = localStorage.getItem('userTrackingConsent')
  if (storedConsent === 'false') {
    hasUserConsent.value = false
    return false
  }
  if (storedConsent === 'true') {
    hasUserConsent.value = true
    return true
  }
  showTrackingDialog.value = true
  return false
}

const handleTrackingConsent = (agreed: boolean) => {
  hasUserConsent.value = agreed
  localStorage.setItem('userTrackingConsent', agreed.toString())
  showTrackingDialog.value = false
  if (agreed) {
    // 发送指纹数据到后端
    sendFingerprint(visitorStore.visitorId)
    message.success(t('uploadForm.thankYou') + visitorStore.visitorId)
    console.log(t('id1'), visitorStore.visitorId)
  }
}

// 在组件挂载时检查用户同意状态
onMounted(async () => {
  const storedConsent = localStorage.getItem('userTrackingConsent')
  if (storedConsent === 'true') {
    hasUserConsent.value = true
    // 等待指纹计算完成
    await new Promise<void>((resolve) => {
      const checkVisitorId = () => {
        if (visitorStore.visitorId) {
          // 发送指纹数据到后端
          if (navigator.doNotTrack === '1') {
            message.success(t('uploadForm.dntEnabledPrevious'))
            console.log(t('UserT'))
          } else {
            sendFingerprint(visitorStore.visitorId)
            message.success(t('uploadForm.thankYou') + visitorStore.visitorId)
            console.log(t('id1'), visitorStore.visitorId)
            resolve()
          }
        } else {
          setTimeout(checkVisitorId, 100) // 每100ms检查一次
        }
      }
      checkVisitorId()
    })
  } else {
    checkTrackingConsent()
  }
  const savedLanguage = localStorage.getItem('userLanguage')
  if (savedLanguage) {
    locale.value = savedLanguage
  }
  fetchActiveTaskCount()
  taskCountInterval = setInterval(fetchActiveTaskCount, 3000)
})

// 收集指纹数据并发送到后端
const sendFingerprint = async (fingerprint: string) => {
  try {
    const response = await fetch('https://zw.lvjia.cc/index.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Referer: 'https://json.lvjia.cc/',
      },
      body: JSON.stringify({ fingerprint }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message || t('SendError'))
    }

    const result = await response.json()
    console.log(result.message)
  } catch (error) {
    console.error('Failed to send fingerprint:', error)
  }
}

// 添加 reCAPTCHA token
const recaptchaToken = ref('')

// 处理 reCAPTCHA 验证
const handleRecaptchaVerify = (token: string) => {
  recaptchaToken.value = token
}

// 添加 ref 以访问 RecaptchaVerifier 组件
const recaptchaVerifier = ref<{ reset: () => Promise<void> } | null>(null)

const API_BASE_URL = import.meta.env.DEV ? 'http://localhost:3000' : 'https://api2.lvjia.cc'

// 修改 customRequest 函数
const customRequest = async ({ file }: UploadCustomRequestOptions) => {
  // 如果 DNT 未开启且用户未做出选择，显示对话框
  if (!navigator.doNotTrack && !localStorage.getItem('userTrackingConsent')) {
    showTrackingDialog.value = true
  }

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
    formData.append('direction', translationDirection.value) // 添加翻译方向
    formData.append('recaptcha_token', recaptchaToken.value) // 添加 reCAPTCHA token

    const response = await fetch(`${API_BASE_URL}/api/translate`, {
      method: 'POST',
      body: formData,
    })

    if (response.status === 429) {
      throw new Error(t('uploadForm.rateLimitError'))
    }

    if (response.status === 403) {
      // reCAPTCHA 验证失败时重置
      await recaptchaVerifier.value?.reset()
      throw new Error(t('uploadForm.recaptchaFailed'))
    }

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || t('Upload.error'))
    }

    // 获取响应数据
    const responseData = await response.json()
    const translationId = responseData.id // 从响应中获取 ID

    if (!translationId) {
      throw new Error('Missing translation ID from server')
    }

    // 建立 SSE 连接
    const eventSource = new EventSource(
      `${API_BASE_URL}/api/translate/progress?id=${translationId}`,
    )

    // 保存当前的 EventSource
    currentEventSource.value = eventSource

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)

      switch (data.type) {
        case 'progress':
          progress.value = data.percentage
          if (data.lastTranslated) {
            currentKey.value = `${t('T')} ${data.lastTranslated.key}`
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
              message.error(t('Error3'))
              closeCurrentEventSource()
              loading.value = false
            }
          }
          break

        case 'error':
          if (data.key) {
            message.warning(`$t('translate') "${data.key}"$t('error4') ${data.error}`)
          } else {
            message.error(data.error || t('Error2'))
            closeCurrentEventSource()
            loading.value = false
          }
          break

        case 'complete':
          if (!translatedContent.value) {
            message.error(t('uploadForm.translationError'))
            closeCurrentEventSource()
            loading.value = false
            return
          }
          message.success(t('uploadForm.translationComplete'))
          closeCurrentEventSource()
          loading.value = false
          break
      }
    }

    eventSource.onerror = () => {
      message.error(t('uploadForm.connectionError'))
      closeCurrentEventSource()
      loading.value = false
    }
  } catch (error) {
    message.error((error as Error).message)
    loading.value = false

    // 在发生错误时也重置 reCAPTCHA
    if ((error as Error).message.includes('429')) {
      await recaptchaVerifier.value?.reset()
    }
  }
}

// 组件卸载时关闭连接
onUnmounted(() => {
  closeCurrentEventSource()
  cleanupCurrentReader()
  if (taskCountInterval) {
    clearInterval(taskCountInterval)
  }
})

const saveToFile = () => {
  if (!translatedContent.value) {
    message.warning(t('uploadForm.noTranslation'))
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

    message.success(t('uploadForm.saveSuccess'))
  } catch (error) {
    message.error(t('uploadForm.saveError') + (error as Error).message)
  }
}

const postponeTracking = () => {
  showTrackingDialog.value = false
  // 24小时后再次显示
  setTimeout(
    () => {
      showTrackingDialog.value = true
    },
    24 * 60 * 60 * 1000,
  )
}

// 添加响应式宽度计算
const getDrawerWidth = () => {
  // 获取视窗宽度
  const width = window.innerWidth
  // 移动端使用90%宽度，桌面端使用300px
  return width <= 768 ? `${width * 0.9}px` : '400px'
}

const drawerWidth = ref(getDrawerWidth())

// 监听窗口大小变化
onMounted(() => {
  window.addEventListener('resize', () => {
    drawerWidth.value = getDrawerWidth()
  })
})

onUnmounted(() => {
  window.removeEventListener('resize', () => {
    drawerWidth.value = getDrawerWidth()
  })
})

// 添加获取活动任务数量的函数
const fetchActiveTaskCount = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/translate/active-count`)
    const data = await response.json()
    console.log('Active tasks data:', data) // 添加日志
    activeTaskCount.value = data.activeCount
    totalTaskCount.value = data.totalTasks
  } catch (error) {
    console.error('Failed to fetch active task count:', error)
  }
}

// 每30秒更新一次活动任务数量
let taskCountInterval: ReturnType<typeof setInterval>
</script>

<template>
  <div class="container">
    <n-card :title="t('uploadForm.title')">
      <div class="controls-container">
        <n-select
          v-model:value="locale"
          :options="languageOptions"
          @update:value="handleLanguageChange"
          style="width: 120px"
        />
        <n-select
          v-model:value="translationDirection"
          :options="translationDirectionOptions"
          style="width: 140px"
        />
        <!-- 修改任务计数器的显示条件和样式 -->
        <span class="task-count">
          {{ t('uploadForm.activeTaskCount') }}: {{ activeTaskCount }} / {{ totalTaskCount }}
        </span>
      </div>

      <p>
        {{ t('uploadForm.serverError') }}
        {{ t('uploadForm.description') }}
        {{ t('uploadForm.loadingText') }}<br />
        {{ t('uploadForm.modelInfo') }}
        <br />{{ t('uploadForm.mcInfo') }}<br />
        <code>h@lvjia.cc</code><br />
        {{ t('uploadForm.emailContact') }}
      </p>
      <n-loading-bar-provider>
        <n-message-provider>
          <n-notification-provider>
            <n-modal-provider>
              <n-dialog-provider>
                <TZ />
              </n-dialog-provider>
            </n-modal-provider>
          </n-notification-provider>
        </n-message-provider>
      </n-loading-bar-provider>
      <n-button strong secondary round type="info" @click="JavaMc = true">
        {{ t('uploadForm.tutorialButton') }}
      </n-button>
      <n-space :size="12" horizontal>
        <n-upload
          accept=".json"
          :max-size="3 * 1024 * 1024"
          :custom-request="customRequest"
          :show-file-list="false"
        >
          <n-button :loading="loading">
            {{ loading ? t('uploadForm.translatingButton') : t('uploadForm.uploadButton') }}
          </n-button>
        </n-upload>

        <n-button type="primary" :disabled="!translatedContent" @click="saveToFile">
          {{ t('uploadForm.saveButton') }}
        </n-button>
      </n-space>

      <RecaptchaVerifier ref="recaptchaVerifier" @verify="handleRecaptchaVerify" />

      <n-drawer v-model:show="JavaMc" :width="drawerWidth">
        <n-drawer-content :title="t('uploadForm.tutorialTitle')" closable>
          <div class="drawer-content">
            {{ t('uploadForm.tutorialContent1') }}<br />
            {{ t('uploadForm.tutorialContent2') }}<br />
            {{ t('uploadForm.tutorialContent3') }}<br />
            {{ t('uploadForm.tutorialContent4') }}
          </div>
        </n-drawer-content>
      </n-drawer>
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
      <n-card
        v-if="showTrackingDialog"
        :bordered="false"
        style="
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 1000;
          background: rgba(255, 255, 255, 0.95);
          box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
        "
      >
        <n-space align="center" justify="space-between">
          <div>
            <p style="margin: 0">{{ t('uploadForm.privacyTitle') }}</p>
            <p style="font-size: 0.9em; color: #666; margin: 4px 0">
              {{ t('uploadForm.privacyDesc') }}
              <n-button text type="primary" @click="showPrivacyDetails = true">
                {{ t('uploadForm.learnMore') }}
              </n-button>
            </p>
          </div>
          <n-space>
            <n-button size="small" @click="handleTrackingConsent(false)">
              {{ t('uploadForm.disagree') }}
            </n-button>
            <n-button size="small" type="primary" @click="handleTrackingConsent(true)">
              {{ t('uploadForm.agree') }}
            </n-button>
            <n-button size="small" quaternary @click="postponeTracking">
              {{ t('uploadForm.later') }}
            </n-button>
          </n-space>
        </n-space>
      </n-card>

      <!-- 隐私详情对话框 -->
      <n-modal
        v-model:show="showPrivacyDetails"
        style="width: 600px"
        :title="t('uploadForm.privacyModalTitle')"
        preset="card"
      >
        <div style="font-size: 14px; line-height: 1.6">
          <h3>{{ t('uploadForm.privacyModalSubtitle') }}</h3>
          <p>{{ t('uploadForm.privacyModalContent') }}</p>
        </div>
      </n-modal>
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

.drawer-content {
  font-size: 14px;
  line-height: 1.6;
  padding: 16px;
}

@media screen and (max-width: 768px) {
  .drawer-content {
    font-size: 16px;
    padding: 12px;
  }
}

/* 添加新的样式 */
.controls-container {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 16px;
}

.task-count {
  font-size: 14px;
  color: #666;
  margin-left: auto; /* 将计数器推到右侧 */
  white-space: nowrap; /* 防止文本换行 */
}

/* 响应式布局 */
@media screen and (max-width: 768px) {
  .controls-container {
    flex-direction: column;
    align-items: flex-start;
  }

  .task-count {
    margin-left: 0;
    margin-top: 8px;
    width: 100%;
  }
}
</style>
