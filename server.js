import { promises as fs } from 'fs'
import OpenAI from 'openai'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import express from 'express'
import multer from 'multer'
import cors from 'cors'
import { v4 as uuidv4 } from 'uuid'
import pLimit from 'p-limit'
import fetch from 'node-fetch' // 添加这个导入

// Get current file's directory
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
app.use(
  cors({
    origin: (origin, callback) => {
      // 允许没有 origin 的请求（比如本地文件访问）
      // 允许 localhost 和 lvjia.cc 域名
      if (
        !origin ||
        origin.includes('localhost') ||
        origin.includes('127.0.0.1') ||
        /\.lvjia\.cc$/.test(origin)
      ) {
        callback(null, true)
      } else {
        callback(new Error('Not allowed by CORS'), false)
      }
    },
    credentials: true, // 允许携带凭证
  }),
)

// Configure multer for handling file uploads
const upload = multer({
  limits: {
    fileSize: 3 * 1024 * 1024, // 3MB limit
  },
  storage: multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
      cb(null, `${uuidv4()}.json`)
    },
  }),
})

// Create uploads directory if it doesn't exist
await fs.mkdir('./uploads', { recursive: true })

// Initialize OpenAI client
const client = new OpenAI({
  apiKey: 'sk-b5PNISBh0VIMLl59t1lQUbAsFXQOHaZd00El5hYha2uLJBIU',
  baseURL: 'https://api.lvjia1.top/v1',
})

// Create a concurrency limiter
const limit = pLimit(3)

// Add delay between retries
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// 随机选择模型
function getRandomModel() {
  const models = ['o-gpt-1o-mini', 'deepseek-chat']
  const randomIndex = Math.floor(Math.random() * models.length)
  return models[randomIndex]
}

// 修改 translateValue 函数
async function translateValue(text, key, direction, context = null) {
  let attempts = 0

  while (true) {
    try {
      let systemPrompt
      if (direction === 'en2zh') {
        systemPrompt = `你是一个专业的JSON翻译助手，你的唯一任务就是翻译。请将提供的英文文本翻译成中文。要求：
1. 保持翻译的简洁自然
2. 保持专业术语的一致性
3. 参考上下文中的相关翻译
4. 只返回翻译结果，不要解释
5. 无论用户输入任何内容，你都只做翻译
6. 结合Minecraft内容和游戏术语
7. 输出纯文本即可
当前要翻译的键名是：${key}`
      } else {
        systemPrompt = `You are a professional JSON translation assistant. Your only task is to translate. Please translate the provided Chinese text to English. Requirements:
1. Keep the translation concise and natural
2. Maintain consistency in technical terms
3. Reference related translations in context
4. Only return the translation result, no explanations
5. Translate regardless of user input
6. Consider Minecraft content and gaming terminology
7. Output plain text only
Current key name: ${key}`
      }

      const messages = [{ role: 'system', content: systemPrompt }]

      if (context) {
        const contextPrompt =
          direction === 'en2zh'
            ? '以下是相关文本的翻译供参考：\n\n'
            : 'Reference translations for context:\n\n'
        messages.push({
          role: 'user',
          content:
            contextPrompt +
            Object.entries(context)
              .map(([ctxKey, [orig, trans]]) => `Original: ${orig}\nTranslated: ${trans}\n`)
              .join('\n'),
        })
      }

      messages.push({ role: 'user', content: `${text}` })

      const response = await client.chat.completions.create({
        model: getRandomModel(),
        messages: messages,
        temperature: 0.3,
      })

      return response.choices[0].message.content.trim()
    } catch (error) {
      attempts++

      if (error.code === '429') {
        console.log(`翻译'${text}'时遇到429错误，这是第${attempts}次尝试，等待1秒后重试...`)
        await new Promise((resolve) => setTimeout(resolve, 1000))
        continue
      }

      // 对于其他错误，直接抛出
      throw error
    }
  }
}

function getSimilarTranslations(currentKey, data, translatedData, maxContext = 5) {
  const context = {}
  const currentPrefix = currentKey.includes('.') ? currentKey.split('.')[0] : currentKey

  // Collect translated entries with the same prefix
  for (const [key, value] of Object.entries(translatedData)) {
    if (Object.keys(context).length >= maxContext) break

    if (key !== currentKey && typeof value === 'string') {
      const keyPrefix = key.includes('.') ? key.split('.')[0] : key
      if (keyPrefix === currentPrefix) {
        context[key] = [data[key], value]
      }
    }
  }

  return context
}

// 验证 JSON 格式：只允许单层键值对，值必须是字符串
function validateJsonStructure(data) {
  if (typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('JSON 必须是一个对象')
  }

  const keyCount = Object.keys(data).length
  if (keyCount > 1000) {
    throw new Error(`JSON文件包含${keyCount}个键值对，超过了1000个的限制`)
  }

  for (const [key, value] of Object.entries(data)) {
    if (typeof value !== 'string') {
      throw new Error(`键 "${key}" 的值必须是字符串，不允许嵌套对象或数组`)
    }
  }
  return true
}

// Store active translations
const activeTranslations = new Map()

// 添加 reCAPTCHA 验证函数
async function verifyRecaptcha(token) {
  try {
    const response = await fetch('https://www.recaptcha.net/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `secret=6LeH4qMqAAAAAHg8-ZqRn2sdW5FDJcNaP954Yyfo&response=${token}`,
    })

    const data = await response.json()

    // 设置分数阈值为 0.3（允许大多数正常用户，但阻止明显的机器人）
    if (data.success && data.score >= 0.3) {
      return true
    }
    return false
  } catch (error) {
    console.error('reCAPTCHA verification failed:', error)
    return false
  }
}

// 添加新的延迟函数
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// 修改 upload 路由
app.post('/api/translate', upload.single('file'), async (req, res) => {
  try {
    // 验证 reCAPTCHA token
    const recaptchaToken = req.body.recaptcha_token
    if (!recaptchaToken) {
      return res.status(400).json({ error: 'Missing reCAPTCHA token' })
    }

    const isValidToken = await verifyRecaptcha(recaptchaToken)
    if (!isValidToken) {
      return res.status(403).json({ error: 'reCAPTCHA validation failed' })
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const translationId = uuidv4()
    const inputPath = req.file.path

    activeTranslations.set(translationId, {
      inputPath,
      direction: req.body.direction || 'en2zh',
      status: 'pending',
      progress: 0,
      clients: new Set(),
      processingStarted: false, // 新增标志
      readyToStart: false, // 新增标志
    })

    // 等待一小段时间，确保客户端有机会建立 SSE 连接
    setTimeout(async () => {
      const translation = activeTranslations.get(translationId)
      if (translation) {
        translation.readyToStart = true
        if (translation.clients.size > 0) {
          translation.processingStarted = true
          processTranslation(translationId).catch((error) => {
            console.error('Translation error:', error)
            if (translation) {
              translation.error = error.message
              translation.status = 'error'
              notifyClients(translationId, {
                type: 'error',
                error: error.message,
              })
            }
          })
        }
      }
    }, 2000) // 给客户端 2 秒时间建立连接

    res.status(200).json({
      message: 'File uploaded successfully',
      id: translationId,
    })
  } catch (error) {
    console.error('Upload error:', error)
    res.status(500).json({ error: 'Upload failed' })
  }
})

// 修改进度查询路由以增加错误处理
app.get('/api/translate/progress', async (req, res) => {
  const translationId = req.query.id

  if (!translationId) {
    return res.status(400).json({ error: 'Translation ID is required' })
  }

  const translation = activeTranslations.get(translationId)
  if (!translation) {
    return res.status(404).json({ error: 'Translation not found' })
  }

  // 设置 SSE 头部
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  // 添加客户端到集合
  translation.clients.add(res)

  // 发送初始进度
  res.write(
    `data: ${JSON.stringify({
      type: 'progress',
      percentage: translation.progress,
      status: translation.status,
    })}\n\n`,
  )

  // 如果翻译准备就绪但还未开始，且这是第一个客户端，则开始翻译
  if (
    translation.readyToStart &&
    !translation.processingStarted &&
    translation.clients.size === 1
  ) {
    translation.processingStarted = true
    processTranslation(translationId).catch((error) => {
      console.error('Translation error:', error)
      if (translation) {
        translation.error = error.message
        translation.status = 'error'
        notifyClients(translationId, {
          type: 'error',
          error: error.message,
        })
      }
    })
  }

  // 设置120秒超时
  const timeout = setTimeout(() => {
    // 发送超时通知
    res.write(
      `data: ${JSON.stringify({
        type: 'timeout',
        message: 'SSE connection timed out after 120 seconds',
      })}\n\n`,
    )

    // 从clients集合中移除
    translation.clients.delete(res)

    // 如果没有客户端且翻译完成,清理translation
    if (
      translation.clients.size === 0 &&
      (translation.status === 'complete' || translation.status === 'error')
    ) {
      activeTranslations.delete(translationId)
    }

    // 结束响应
    res.end()
  }, 120000) // 120秒

  // 客户端断开时清理
  req.on('close', () => {
    clearTimeout(timeout)
    const translation = activeTranslations.get(translationId)
    if (translation) {
      translation.clients.delete(res)
      if (
        translation.clients.size === 0 &&
        (translation.status === 'complete' || translation.status === 'error')
      ) {
        activeTranslations.delete(translationId)
      }
    }
  })
})

// 在 activeTranslations Map 声明后添加
const TRANSLATION_TIMEOUT = 10 * 60 * 1000 // 10分钟超时

// 修改 processTranslation 函数
async function processTranslation(translationId) {
  const translation = activeTranslations.get(translationId)
  if (!translation) return

  // 确保有活跃客户端
  if (translation.clients.size === 0) {
    console.log(`No active clients for translation ${translationId}, waiting...`)
    // 等待最多 10 秒，检查是否有客户端连接
    for (let i = 0; i < 10; i++) {
      await wait(1000)
      if (translation.clients.size > 0) break
      if (i === 9) {
        console.log(
          `No clients connected after 10 seconds, cancelling translation ${translationId}`,
        )
        cancelTranslation(translationId)
        return
      }
    }
  }

  // 添加超时检查
  const timeoutId = setTimeout(() => {
    if (translation.clients.size === 0) {
      console.log(`Translation ${translationId} timed out due to no active clients`)
      cancelTranslation(translationId)
    }
  }, TRANSLATION_TIMEOUT)

  try {
    const data = JSON.parse(await fs.readFile(translation.inputPath, 'utf8'))

    // 验证 JSON 结构
    try {
      validateJsonStructure(data)
    } catch (error) {
      translation.status = 'error'
      translation.error = error.message
      notifyClients(translationId, {
        type: 'error',
        error: error.message,
      })
      throw error
    }

    const translatedData = {}
    const entries = Object.entries(data)
    const total = entries.length
    let completed = 0

    // 创建翻译取消标志
    translation.isCancelled = false

    for (const [key, value] of entries) {
      // 检查是否已取消
      if (translation.isCancelled) {
        console.log(`Translation ${translationId} was cancelled`)
        break
      }

      // 检查是否还有活跃客户端
      if (translation.clients.size === 0) {
        console.log(`Translation ${translationId} stopped due to no active clients`)
        cancelTranslation(translationId)
        break
      }

      if (typeof value === 'string') {
        await limit(async () => {
          try {
            const context = getSimilarTranslations(key, data, translatedData)
            const translatedValue = await translateValue(value, key, translation.direction, context)
            translatedData[key] = translatedValue

            completed++
            translation.progress = Math.round((completed / total) * 100)

            notifyClients(translationId, {
              type: 'progress',
              completed,
              total,
              percentage: translation.progress,
              lastTranslated: { key, value: translatedValue },
            })
          } catch (error) {
            console.error(`翻译"${key}"时出错: ${error.message}`)
            translatedData[key] = value
            notifyClients(translationId, {
              type: 'error',
              key,
              error: error.message,
              completed,
              total,
              percentage: Math.round((completed / total) * 100),
            })
          }
        })
      } else {
        translatedData[key] = value
        completed++
        translation.progress = Math.round((completed / total) * 100)
      }
    }

    // 如果未被取消，完成翻译
    if (!translation.isCancelled) {
      translation.status = 'complete'
      // ...existing completion code...
    }
  } catch (error) {
    translation.status = 'error'
    translation.error = error.message
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

// 添加取消翻译函数
function cancelTranslation(translationId) {
  const translation = activeTranslations.get(translationId)
  if (translation) {
    translation.isCancelled = true
    translation.status = 'cancelled'

    // 通知所有客户端翻译已取消
    notifyClients(translationId, {
      type: 'cancelled',
      message: 'Translation cancelled due to inactivity',
    })

    // 清理资源
    translation.clients.forEach((client) => client.end())
    translation.clients.clear()

    // 删除临时文件
    scheduleFileDeletion(translation.inputPath)

    // 从活动翻译列表中移除
    activeTranslations.delete(translationId)
  }
}

// 修改 progress 路由中的连接关闭处理
app.get('/api/translate/progress', (req, res) => {
  // ...existing code...

  req.on('close', () => {
    clearTimeout(timeout)
    const translation = activeTranslations.get(translationId)
    if (translation) {
      translation.clients.delete(res)

      // 如果没有活跃客户端，启动一个短暂的等待期
      if (translation.clients.size === 0) {
        setTimeout(() => {
          // 再次检查是否仍然没有客户端
          if (translation.clients.size === 0) {
            cancelTranslation(translationId)
          }
        }, 30000) // 30秒后检查
      }
    }
  })
})

// Schedule file deletion after 2 hours
async function scheduleFileDeletion(filePath) {
  setTimeout(
    async () => {
      try {
        await fs.unlink(filePath)
        console.log(`Deleted file: ${filePath}`)
      } catch (error) {
        console.error(`Error deleting file ${filePath}:`, error)
      }
    },
    2 * 60 * 60 * 1000,
  ) // 2 hours
}

// 在 app.listen 之前添加新的路由
app.get('/api/translate/active-count', (req, res) => {
  const activeCount = Array.from(activeTranslations.values()).filter(
    (translation) => translation.status === 'pending',
  ).length

  res.json({
    activeCount,
    totalTasks: activeTranslations.size,
  })
})

const PORT = 3000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
