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

// 修改环境变量判断，支持 Windows
const isDevelopment = process.env.NODE_ENV === 'development'

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
  apiKey: 'sk-K8riFX9hm5zwhRXKRSlrOyg8pcNLmi0r8OKWGiPSkeNPVnWD',
  baseURL: 'https://api.lvjia1.top/v1',
})

// Create a concurrency limiter
const limit = pLimit(10)

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

    if (data.success) {
      if (data.score >= 0.1) {
        return { success: true, score: data.score }
      } else {
        return { success: false, error: 'low_score', score: data.score }
      }
    }
    return { success: false, error: 'verification_failed' }
  } catch (error) {
    console.error('reCAPTCHA verification failed:', error)
    return { success: false, error: 'verification_error' }
  }
}

// 添加新的延迟函数
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// 修改 upload 路由
app.post('/api/translate', upload.single('file'), async (req, res) => {
  try {
    // 在开发环境下跳过 reCAPTCHA 验证
    if (!isDevelopment) {
      const recaptchaToken = req.body.recaptcha_token
      if (!recaptchaToken) {
        return res.status(400).json({ error: 'Missing reCAPTCHA token' })
      }

      const verifyResult = await verifyRecaptcha(recaptchaToken)
      if (!verifyResult.success) {
        if (verifyResult.error === 'low_score') {
          return res.status(403).json({
            error: 'reCAPTCHA score too low',
            score: verifyResult.score,
          })
        }
        return res.status(403).json({ error: 'reCAPTCHA validation failed' })
      }
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const translationId = uuidv4()
    const inputPath = req.file.path

    // 读取并解析JSON以计算超时时间
    const fileContent = await fs.readFile(inputPath, 'utf8')
    const data = JSON.parse(fileContent)
    const keyCount = Object.keys(data).length
    const timeout = Math.ceil(keyCount * 0.7) * 1000 // 毫秒

    activeTranslations.set(translationId, {
      inputPath,
      direction: req.body.direction || 'en2zh',
      status: 'pending',
      progress: 0,
      timeout,
      startTime: Date.now(),
      translatedData: {},
    })

    // 去掉同步等待，改为后台执行
    processTranslation(translationId).catch((err) => {
      console.error('Async translation error:', err)
    })

    // 立即返回
    return res.status(200).json({
      message: 'Translation started',
      id: translationId,
      status: 'pending',
    })
  } catch (error) {
    console.error('Upload error:', error)
    // 清理上传的文件
    if (req.file) {
      await fs.unlink(req.file.path).catch(console.error)
    }
    res.status(500).json({
      error: error.message || 'Upload failed',
      details: isDevelopment ? error.stack : undefined,
    })
  }
})

// 修改进度查询路由
app.get('/api/translate/progress', (req, res) => {
  const translationId = req.query.id

  if (!translationId) {
    return res.status(400).json({ error: 'Translation ID is required' })
  }

  const translation = activeTranslations.get(translationId)
  if (!translation) {
    return res.status(404).json({ error: 'Translation not found' })
  }

  // 设置 SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no') // 禁用缓冲

  const sendEvent = (eventType, data) => {
    res.write(`data: ${JSON.stringify({ type: eventType, ...data })}\n\n`)
    if (typeof res.flush === 'function') {
      res.flush() // 刷新缓冲
    }
  }

  // 每次更新进度的事件发送器
  const progressInterval = setInterval(() => {
    try {
      const currentTranslation = activeTranslations.get(translationId)
      if (!currentTranslation) {
        clearInterval(progressInterval)
        return
      }

      const elapsed = Date.now() - currentTranslation.startTime
      if (elapsed >= currentTranslation.timeout) {
        sendEvent('timeout', {
          progress: currentTranslation.progress,
          translatedData: currentTranslation.translatedData,
        })
        clearInterval(progressInterval)
        scheduleFileDeletion(currentTranslation.inputPath)
        activeTranslations.delete(translationId)
        res.end()
        return
      }

      // 发送进度更新
      sendEvent('progress', {
        progress: currentTranslation.progress,
        lastTranslated: currentTranslation.lastTranslated,
      })

      // 如果翻译完成，发送完成事件并结束连接
      if (currentTranslation.status === 'complete') {
        sendEvent('complete', {
          translatedData: currentTranslation.translatedData,
        })
        clearInterval(progressInterval)
        scheduleFileDeletion(currentTranslation.inputPath)
        activeTranslations.delete(translationId) // 在发送完成事件后再删除
        res.end()
      }
    } catch (error) {
      console.error('Error sending progress:', error)
      clearInterval(progressInterval)
      res.end()
    }
  }, 1000) // 每秒更新一次进度

  // 当客户端断开连接时清理interval
  res.on('close', () => {
    clearInterval(progressInterval)
  })
})

// 修改 processTranslation 函数
async function processTranslation(translationId) {
  const translation = activeTranslations.get(translationId)
  if (!translation) return

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error('Translation timeout'))
    }, translation.timeout)
  })

  try {
    await Promise.race([
      (async () => {
        const data = JSON.parse(await fs.readFile(translation.inputPath, 'utf8'))
        validateJsonStructure(data)

        const entries = Object.entries(data)
        const total = entries.length
        let completed = 0

        const tasks = entries.map(([key, value]) =>
          limit(async () => {
            if (Date.now() - translation.startTime >= translation.timeout) {
              return
            }
            if (typeof value === 'string') {
              try {
                const context = getSimilarTranslations(key, data, translation.translatedData)
                const translatedValue = await translateValue(
                  value,
                  key,
                  translation.direction,
                  context,
                )
                translation.translatedData[key] = translatedValue
                translation.lastTranslated = { key, value: translatedValue }
                completed++
                translation.progress = Math.round((completed / total) * 100)
                // 每次翻译完成后更新状态
                translation.status = completed === total ? 'complete' : 'pending'
              } catch (error) {
                console.error(`Error translating "${key}":`, error)
                translation.translatedData[key] = value
                completed++
                translation.progress = Math.round((completed / total) * 100)
              }
            }
          }),
        )

        await Promise.all(tasks)
        translation.status = 'complete'
      })(),
      timeoutPromise,
    ])
  } catch (error) {
    if (error.message === 'Translation timeout') {
      translation.status = 'timeout'
    } else {
      translation.status = 'error'
      translation.error = error.message
    }
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

// 添加清理过期翻译的功能
function cleanupExpiredTranslations() {
  for (const [id, translation] of activeTranslations.entries()) {
    const elapsed = Date.now() - translation.startTime
    if (elapsed >= translation.timeout || translation.status === 'complete') {
      scheduleFileDeletion(translation.inputPath)
      activeTranslations.delete(id)
    }
  }
}

// 定期清理过期翻译
setInterval(cleanupExpiredTranslations, 5 * 60 * 1000) // 每5分钟清理一次

const PORT = 3000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
