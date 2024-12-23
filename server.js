import { promises as fs } from 'fs'
import OpenAI from 'openai'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import express from 'express'
import multer from 'multer'
import cors from 'cors'
import { v4 as uuidv4 } from 'uuid'
import pLimit from 'p-limit'

// Get current file's directory
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
app.use(cors())

// Redirect to trailing slash, but skip static assets and files
app.use((req, res, next) => {
  const pathWithoutSlash = req.path.replace(/\/+$/, '')
  const isStaticAsset = /\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/i.test(
    pathWithoutSlash,
  )

  // 如果是静态资源或已经以/结尾或是根路径，则跳过重定向
  if (isStaticAsset || req.path.endsWith('/') || req.path === '/') {
    return next()
  }

  // 只对非静态资源的路径添加斜杠
  return res.redirect(301, req.path + '/')
})

// Serve static files from dist directory
app.use(express.static(resolve(__dirname, 'dist')))

// Serve index.html for all routes except /api
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next()
  }
  res.sendFile(resolve(__dirname, 'dist', 'index.html'))
})

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

// 修改上传处理路由
app.post('/api/translate', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const direction = req.body.direction || 'en2zh' // 获取翻译方向

    const translationId = uuidv4()
    const inputPath = req.file.path

    activeTranslations.set(translationId, {
      inputPath,
      direction, // 保存翻译方向
      status: 'pending',
      progress: 0,
      clients: new Set(),
    })

    // Send the translation ID back to the client
    res.setHeader('X-Translation-Id', translationId)
    res.status(200).json({ message: 'File uploaded successfully', id: translationId })

    // Start translation process in background
    processTranslation(translationId).catch((error) => {
      console.error('Translation error:', error)
      const translation = activeTranslations.get(translationId)
      if (translation) {
        translation.error = error.message
        translation.status = 'error'
        notifyClients(translationId, {
          type: 'error',
          error: error.message,
        })
      }
    })
  } catch (error) {
    console.error('Upload error:', error)
    res.status(500).json({ error: 'Upload failed' })
  }
})

app.get('/api/translate/progress', (req, res) => {
  const translationId = req.query.id

  if (!translationId || !activeTranslations.has(translationId)) {
    return res.status(404).json({ error: 'Translation not found' })
  }

  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  const translation = activeTranslations.get(translationId)
  translation.clients.add(res)

  // 发送初始进度
  res.write(
    `data: ${JSON.stringify({
      type: 'progress',
      percentage: translation.progress,
      status: translation.status,
    })}\n\n`,
  )

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

function notifyClients(translationId, data) {
  const translation = activeTranslations.get(translationId)
  if (translation) {
    translation.clients.forEach((client) => {
      client.write(`data: ${JSON.stringify(data)}\n\n`)
    })
  }
}

// 修改 processTranslation 函数
async function processTranslation(translationId) {
  const translation = activeTranslations.get(translationId)
  if (!translation) return

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

    // Create an array of translation promises
    const translations = entries.map(([key, value], index) => {
      if (typeof value === 'string') {
        return limit(async () => {
          try {
            const context = getSimilarTranslations(key, data, translatedData)
            const translatedValue = await translateValue(value, key, translation.direction, context)
            translatedData[key] = translatedValue

            // Update progress
            completed++
            translation.progress = Math.round((completed / total) * 100)

            // Notify clients
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

            // Notify clients of error
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
        return Promise.resolve()
      }
    })

    // Wait for all translations to complete
    await Promise.all(translations)

    // Update status and notify clients
    translation.status = 'complete'

    // Split large translation content into chunks
    const contentStr = JSON.stringify(translatedData)
    const chunkSize = 16384 // 16KB chunks
    const chunks = Math.ceil(contentStr.length / chunkSize)

    for (let i = 0; i < chunks; i++) {
      const chunk = contentStr.slice(i * chunkSize, (i + 1) * chunkSize)
      notifyClients(translationId, {
        type: 'chunk',
        chunkIndex: i,
        totalChunks: chunks,
        data: chunk,
        completed,
        total,
        percentage: 100,
      })
      // Add a small delay between chunks to prevent overwhelming the connection
      await new Promise((resolve) => setTimeout(resolve, 50))
    }

    // Send final completion message without the full content
    notifyClients(translationId, {
      type: 'complete',
      completed,
      total,
      percentage: 100,
    })

    // Schedule cleanup
    scheduleFileDeletion(translation.inputPath)
    scheduleFileDeletion(translation.inputPath.replace('.json', '_translated.json'))
  } catch (error) {
    translation.status = 'error'
    translation.error = error.message
    throw error
  }
}

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

const PORT = 3000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
