<script setup lang="ts">
import { ref, onUnmounted, onMounted } from 'vue'
import type { UploadCustomRequestOptions } from 'naive-ui'
import { NUpload, NButton, NSpace, NCard, NProgress, useMessage, NModal } from 'naive-ui'
import TZ from './TZ.vue'
import { useVisitorStore } from '../stores/visitor'

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

// 检查 Do Not Track 设置和用户同意状态
const checkTrackingConsent = () => {
  if (navigator.doNotTrack === '1') {
    message.success('已启用请勿追踪，我们将不会收集任何统计信息')
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
    message.success('感谢您的支持！您的ID是：' + visitorStore.visitorId)
    console.log('访问者ID:', visitorStore.visitorId)
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
            message.success(
              '已启用请勿追踪，虽然曾经同意过，但现在开启了DNT，我们将不会收集任何统计信息',
            )
            console.log('用户曾经同意过，但现在开启了DNT')
          } else {
            sendFingerprint(visitorStore.visitorId)
            message.success('感谢您的支持！您的ID是：' + visitorStore.visitorId)
            console.log('访问者ID:', visitorStore.visitorId)
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
      throw new Error(errorData.message || '发送指纹失败')
    }

    const result = await response.json()
    console.log(result.message)
  } catch (error) {
    console.error('Failed to send fingerprint:', error)
  }
}

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
</script>

<template>
  <div class="container">
    <n-card title="JSON 翻译工具">
      <p>
        上传一个 JSON 文件，可以自动翻译成中文，请务必选择非嵌套json文件。
        如果卡在某个值半天没有翻译进展，多等等，不要刷新，因为上游负载满了，1分钟左右可能就恢复了。<br />
        使用gpt-4o-mini与deepseek-chat进行翻译，随机选择。没听过DeepSeek？这模型和gpt-4o-mini差不多，便宜还快。
        <br />Minecraft模组苦苦汉化？上传到这里自动汉化翻译Java版Minecraft模组。对于基岩版，可以通过邮箱
        <code>h@lvjia.cc</code>
        来告诉我，需要的人多就开发一个。
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
        Java版模组翻译教程
      </n-button>
      <n-space :size="12" horizontal>
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
      </n-space>

      <n-drawer v-model:show="JavaMc" :width="drawerWidth">
        <n-drawer-content title="Java版模组翻译教程" closable>
          <div class="drawer-content">
            下载一个压缩软件，例如 7-zip，右键jar打开或者解压，找到 assets
            文件夹，里面就是模组的资源文件。<br />assets里，会有个名字非Minecraft的文件夹，打开它，里面的json就是语言文件。<br />将其上传到这个网站，翻译完后保存，重命名为zh_cn.json，拖动放进去。<br />如果你解压了，就重新压缩为普通zip格式，确保压缩后的一级目录不是单个文件夹，大概率就是压缩成功了，把后缀改成jar。
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
            <p style="margin: 0">帮助我们改进服务</p>
            <p style="font-size: 0.9em; color: #666; margin: 4px 0">
              我们仅收集匿名访问统计，不含个人信息
              <n-button text type="primary" @click="showPrivacyDetails = true"> 了解更多 </n-button>
            </p>
          </div>
          <n-space>
            <n-button size="small" @click="handleTrackingConsent(false)"> 不用了 </n-button>
            <n-button size="small" type="primary" @click="handleTrackingConsent(true)">
              同意
            </n-button>
            <n-button size="small" quaternary @click="postponeTracking"> 稍后再说 </n-button>
          </n-space>
        </n-space>
      </n-card>

      <!-- 隐私详情对话框 -->
      <n-modal
        v-model:show="showPrivacyDetails"
        style="width: 600px"
        title="隐私说明"
        preset="card"
      >
        <div style="font-size: 14px; line-height: 1.6">
          <h3>收集数据做什么？</h3>
          <p>很简单，统计真实用户人数，且不与任何第三方共享。</p>
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
</style>
