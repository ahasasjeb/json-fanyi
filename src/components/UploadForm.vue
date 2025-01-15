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
const JavaMc = ref(false)

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

// 添加模型选择选项
const modelOptions = [
  {
    label: 'GPT 4o mini',
    value: 'gpt-4o-mini',
  },
  { label: 'mc翻译微调 gpt-4o v5 完全体', value: 'ft:gpt-4o-mini-2024-07-18:lvjia:mcv5:AjfNj00o' },

  { label: 'deepseek-chat 非Mc相关首选', value: 'deepseek-chat' },
  {
    label: 'mc翻译微调 gpt-4o v5 40步进',
    value: 'ft:gpt-4o-mini-2024-07-18:lvjia:mcv5:AjfNi769:ckpt-step-40',
  },
  {
    label: 'mc翻译微调 gpt-4o v5 80步进',
    value: 'ft:gpt-4o-mini-2024-07-18:lvjia:mcv5:AjfNiQvo:ckpt-step-80',
  },
]
const selectedModel = ref(modelOptions[0].value)

// 关闭当前的 EventSource 连接
const closeCurrentEventSource = () => {
  if (currentEventSource.value) {
    if (currentEventSource.value.readyState !== EventSource.CLOSED) {
      currentEventSource.value.close()
    }
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

const sendVisitorData = () => {
  // 直接发送指纹数据到后端
  if (visitorStore.visitorId) {
    sendFingerprint(visitorStore.visitorId)
    console.log(t('id1'), visitorStore.visitorId)
  }
}

// 在组件挂载时直接发送数据
onMounted(async () => {
  const savedLanguage = localStorage.getItem('userLanguage')
  if (savedLanguage) {
    locale.value = savedLanguage
  }

  // 等待指纹计算完成后直接发送
  await new Promise<void>((resolve) => {
    const checkVisitorId = () => {
      if (visitorStore.visitorId) {
        sendVisitorData()
        resolve()
      } else {
        setTimeout(checkVisitorId, 100)
      }
    }
    checkVisitorId()
  })

  fetchActiveTaskCount()
  taskCountInterval = setInterval(fetchActiveTaskCount, 3000)
  await recaptchaVerifier.value?.reset()
  recaptchaRefreshInterval = setInterval(() => {
    if (!loading.value) {
      recaptchaVerifier.value?.reset()
    }
  }, 110000)
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

// 添加接口类型定义
interface TranslationResponse {
  id: string
  status: 'pending' | 'complete' | 'error' | 'timeout'
  translatedData?: Record<string, string>
  error?: string
}

// 添加重置状态的函数
const resetState = () => {
  loading.value = false
  progress.value = 0
  currentKey.value = ''
  closeCurrentEventSource()
}

// 修改 customRequest 函数
const customRequest = async ({ file }: UploadCustomRequestOptions) => {
  try {
    // 在发送请求前先检查并刷新 token
    if (!recaptchaToken.value) {
      message.warning(t('uploadForm.waitingForRecaptcha') || '请等待人机验证完成')
      await recaptchaVerifier.value?.reset()
      resetState()
      return
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
      formData.append('model', selectedModel.value) // 添加选择的模型
      formData.append('recaptcha_token', recaptchaToken.value) // 添加 reCAPTCHA token

      const response = await fetch(`${API_BASE_URL}/api/translate`, {
        method: 'POST',
        body: formData,
      })

      if (response.status === 429) {
        resetState()
        throw new Error(t('uploadForm.rateLimitError'))
      }

      if (response.status === 403) {
        const errorData = await response.json()
        if (errorData.error === 'reCAPTCHA score too low') {
          message.error(`${t('uploadForm.recaptchaScoreTooLow')} (${errorData.score})`)
        } else {
          message.error(t('uploadForm.recaptchaFailed'))
        }
        await recaptchaVerifier.value?.reset()
        resetState()
        return
      }

      if (!response.ok) {
        const errorData = await response.json()
        resetState()
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
        try {
          const data = JSON.parse(event.data)
          console.log('SSE received:', data) // 添加调试日志

          switch (data.type) {
            case 'progress':
              progress.value = data.progress || 0
              if (data.lastTranslated) {
                currentKey.value = `${t('T')} ${data.lastTranslated.key}`
              }
              break

            case 'complete':
              if (data.translatedData) {
                translatedContent.value = JSON.stringify(data.translatedData, null, 2)
                handleTranslationComplete()
              } else {
                message.error(t('uploadForm.translationError'))
              }
              closeCurrentEventSource()
              loading.value = false
              break

            case 'timeout':
              if (data.translatedData) {
                translatedContent.value = JSON.stringify(data.translatedData, null, 2)
                // 如果有完整的翻译数据，当作正常完成处理
                handleTranslationComplete()
              } else {
                // 只有在没有翻译数据时才显示超时警告
                message.warning(t('uploadForm.timeoutWarning'))
              }
              closeCurrentEventSource()
              loading.value = false
              break

            case 'error':
              if (data.key) {
                message.warning(`${t('translate')} "${data.key}" ${t('error4')} ${data.error}`)
              } else {
                message.error(data.error || t('Error2'))
              }
              break
          }
        } catch (error) {
          console.error('Error parsing SSE data:', error, event.data)
          message.error(t('uploadForm.dataError'))
          closeCurrentEventSource()
          loading.value = false
        }
      }

      eventSource.onerror = (error) => {
        console.error('EventSource error:', error)
        // 只有在连接确实断开时才显示错误
        if (eventSource.readyState === EventSource.CLOSED) {
          message.error(t('uploadForm.connectionError'))
          closeCurrentEventSource()
          resetState()
          recaptchaVerifier.value?.reset()
        }
      }
    } catch (error) {
      message.error((error as Error).message)
      resetState()

      // 在发生错误时也重置 reCAPTCHA
      if ((error as Error).message.includes('429')) {
        await recaptchaVerifier.value?.reset()
      }
    }

    // 文件上传成功后，立即刷新 token 为下一次做准备
    await recaptchaVerifier.value?.reset()
  } catch (error) {
    message.error((error as Error).message)
    resetState()

    // 在发生错误时也重置 reCAPTCHA
    await recaptchaVerifier.value?.reset()
  }
}

// 在成功完成任务后也刷新 token
const handleTranslationComplete = async () => {
  message.success(t('uploadForm.translationComplete'))
  closeCurrentEventSource()
  loading.value = false
  // 完成后刷新 token
  await recaptchaVerifier.value?.reset()
}

// 组件卸载时关闭连接
onUnmounted(() => {
  closeCurrentEventSource()
  cleanupCurrentReader()
  if (taskCountInterval) {
    clearInterval(taskCountInterval)
  }
  if (recaptchaRefreshInterval) {
    clearInterval(recaptchaRefreshInterval)
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
let recaptchaRefreshInterval: ReturnType<typeof setInterval>

// 在已有的 imports 后添加
const showEmailModal = ref(false)
const emailAddress = ref('')
const sendingEmail = ref(false)

// 添加邮件发送相关函数
const handleSendEmail = async () => {
  if (!emailAddress.value || !translatedContent.value) {
    message.error(t('uploadForm.invalidEmailOrContent'))
    return
  }

  try {
    sendingEmail.value = true
    const response = await fetch(`${API_BASE_URL}/api/send-translation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: emailAddress.value,
        translatedContent: translatedContent.value,
        originalFileName: originalFileName.value,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || t('uploadForm.emailSendError'))
    }

    message.success(t('uploadForm.emailSentSuccess'))
    showEmailModal.value = false
    emailAddress.value = ''
  } catch (error) {
    message.error((error as Error).message)
  } finally {
    sendingEmail.value = false
  }
}
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
        <!-- 添加模型选择器 -->
        <n-select v-model:value="selectedModel" :options="modelOptions" style="width: 260px" />
        <!-- 修改任务计数器的显示条件和样式 -->
        <span class="task-count">
          {{ t('uploadForm.activeTaskCount') }}: {{ activeTaskCount }} / {{ totalTaskCount }}
        </span>
      </div>

      <p>
        {{ t('uploadForm.description') }}<br />
        {{ t('uploadForm.loadingText') }}<br />
        {{ t('uploadForm.modelInfo') }}<br />
        <br />{{ t('uploadForm.mcInfo') }}<br />
        <code>h@lvjia.cc</code><br />
        {{ t('no.money') }}<br />
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
        <n-button type="info" :disabled="!translatedContent" @click="showEmailModal = true">
          {{ t('uploadForm.sendEmail') }}
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

      <!-- 添加邮件发送对话框 -->
      <n-modal
        v-model:show="showEmailModal"
        :title="t('uploadForm.sendEmailTitle')"
        preset="dialog"
        :loading="sendingEmail"
      >
        <n-form>
          <n-form-item :label="t('uploadForm.emailAddress')">
            <n-input
              v-model:value="emailAddress"
              type="email"
              :placeholder="t('uploadForm.emailPlaceholder')"
            />
          </n-form-item>
        </n-form>
        <template #action>
          <n-space>
            <n-button @click="showEmailModal = false">
              {{ t('uploadForm.cancel') }}
            </n-button>
            <n-button type="primary" :loading="sendingEmail" @click="handleSendEmail">
              {{ t('uploadForm.send') }}
            </n-button>
          </n-space>
        </template>
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
