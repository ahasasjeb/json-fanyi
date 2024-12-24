import https from 'https'
import http from 'http'
import { v4 as uuidv4 } from 'uuid'

class Geetest4Node {
  constructor() {
    this.TIMEOUT = 10000
  }

  _Object(obj) {
    this._obj = obj
  }

  Config(config) {
    const self = this
    new this._Object(config)._each((key, value) => {
      self[key] = value
    })
  }

  async makeRequest(options) {
    return new Promise((resolve, reject) => {
      const protocol = options.protocol === 'https://' ? https : http
      const req = protocol.request(options, (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => resolve(JSON.parse(data)))
      })

      req.on('error', reject)
      req.setTimeout(this.TIMEOUT)
      req.end()
    })
  }

  async initGeetest4(userConfig) {
    const config = new this.Config(userConfig)

    // 设置默认配置
    config.apiServers = [
      'gcaptcha4.geetest.com',
      'gcaptcha4.geevisit.com',
      'gcaptcha4.gsensebot.com',
    ]

    config.protocol = userConfig.https ? 'https://' : 'http://'

    const query = {
      captcha_id: config.captchaId,
      challenge: config.challenge || uuidv4(),
      client_type: 'nodejs',
      risk_type: config.riskType,
      user_info: config.userInfo,
      call_type: config.callType,
      lang: config.language || 'zh-cn',
    }

    // 构造请求选项
    const options = {
      hostname: config.apiServers[0],
      path: '/load?' + new URLSearchParams(query).toString(),
      method: 'GET',
      protocol: config.protocol,
    }

    try {
      const response = await this.makeRequest(options)
      return this.camelizeKeys(response)
    } catch (err) {
      throw new Error('Geetest API request failed: ' + err.message)
    }
  }

  camelizeKeys(input) {
    // 保留原来的camelizeKeys逻辑
    if (!this.isObject(input)) return input

    if (Array.isArray(input)) {
      return input.map((item) => this.camelizeKeys(item))
    }

    const result = {}
    for (const key in input) {
      if (input.hasOwnProperty(key)) {
        const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
        result[camelKey] = this.camelizeKeys(input[key])
      }
    }
    return result
  }

  isObject(obj) {
    return obj !== null && typeof obj === 'object'
  }
}

module.exports = new Geetest4Node()
