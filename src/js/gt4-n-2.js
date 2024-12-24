import http from 'http'
import https from 'https'
import { URL } from 'url'

class _Object {
  constructor(obj) {
    this._obj = obj
  }

  _each(process) {
    const _obj = this._obj
    for (const k in _obj) {
      if (Object.prototype.hasOwnProperty.call(_obj, k)) {
        process(k, _obj[k])
      }
    }
    return this
  }

  _extend(obj) {
    const self = this
    new _Object(obj)._each((key, value) => {
      self._obj[key] = value
    })
  }
}

const uuid = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

class Config {
  constructor(config) {
    Object.assign(this, config)
  }

  apiServers = ['gcaptcha4.geetest.com', 'gcaptcha4.geevisit.com', 'gcaptcha4.gsensebot.com']
  staticServers = ['static.geetest.com', 'static.geevisit.com']
  protocol = 'http://'
  typePath = '/load'
  fallback_config = {
    bypass: {
      staticServers: ['static.geetest.com', 'static.geevisit.com'],
      type: 'bypass',
      bypass: '/v4/bypass.js',
    },
  }

  _get_fallback_config() {
    if (typeof this.type === 'string') {
      return this.fallback_config[this.type]
    } else {
      return this.fallback_config.bypass
    }
  }

  _extend(obj) {
    Object.assign(this, obj)
  }
}

const isNumber = (value) => typeof value === 'number'
const isString = (value) => typeof value === 'string'
const isBoolean = (value) => typeof value === 'boolean'
const isObject = (value) => typeof value === 'object' && value !== null
const isFunction = (value) => typeof value === 'function'

const MOBILE = /Mobi/i.test(process.env.USER_AGENT || '')

const callbacks = {}
const status = {}

const random = () => parseInt(Math.random() * 10000) + Date.now()

const bind = (target, context, ...args) => {
  if (typeof target !== 'function') {
    return
  }
  if (target.bind) {
    return target.bind(context, ...args)
  } else {
    return (..._args) => target.apply(context, args.concat(_args))
  }
}

const toString = Object.prototype.toString

const _isFunction = (obj) => typeof obj === 'function'
const _isObject = (obj) => obj === Object(obj)
const _isArray = (obj) => toString.call(obj) === '[object Array]'
const _isDate = (obj) => toString.call(obj) === '[object Date]'
const _isRegExp = (obj) => toString.call(obj) === '[object RegExp]'
const _isBoolean = (obj) => toString.call(obj) === '[object Boolean]'

const resolveKey = (input) => {
  return input.replace(/(\S)(_([a-zA-Z]))/g, (match, p1, p2, p3) => {
    return p1 + p3.toUpperCase() || ''
  })
}

const camelizeKeys = (input, convert) => {
  if (
    !_isObject(input) ||
    _isDate(input) ||
    _isRegExp(input) ||
    _isBoolean(input) ||
    _isFunction(input)
  ) {
    return convert ? resolveKey(input) : input
  }

  if (_isArray(input)) {
    return input.map((item) => camelizeKeys(item))
  } else {
    const temp = {}
    for (const prop in input) {
      if (Object.prototype.hasOwnProperty.call(input, prop)) {
        temp[camelizeKeys(prop, true)] = camelizeKeys(input[prop])
      }
    }
    return temp
  }
}

const loadScript = (url, cb, timeout = 10000) => {
  const lib = url.startsWith('https') ? https : http
  const req = lib
    .get(url, (res) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cb(false)
      } else {
        cb(true)
      }
    })
    .on('error', () => cb(true))

  req.setTimeout(timeout, () => {
    req.abort()
    cb(true)
  })
}

const normalizeDomain = (domain) => {
  return domain.replace(/^https?:\/\/|\/$/g, '')
}

const normalizePath = (path) => {
  path = path && path.replace(/\/+/g, '/')
  if (path.indexOf('/') !== 0) {
    path = '/' + path
  }
  return path
}

const normalizeQuery = (query) => {
  if (!query) {
    return ''
  }
  const q = Object.entries(query)
    .filter(([key, value]) => isString(value) || isNumber(value) || isBoolean(value))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')
  return q ? `?${q}` : ''
}

const makeURL = (protocol, domain, path, query) => {
  domain = normalizeDomain(domain)
  const url = normalizePath(path) + normalizeQuery(query)
  return domain ? `${protocol}${domain}${url}` : url
}

const load = (config, protocol, domains, path, query, cb, handleCb) => {
  const tryRequest = (at) => {
    let cbName
    if (handleCb) {
      cbName = `geetest_${random()}`
      // Node.js 取消全局回调
      // handleCb 需要调整
    }
    const url = makeURL(protocol, domains[at], path, query)
    loadScript(
      url,
      (err) => {
        if (err) {
          if (at >= domains.length - 1) {
            cb(true)
          } else {
            tryRequest(at + 1)
          }
        } else {
          cb(false)
        }
      },
      config.timeout,
    )
  }
  tryRequest(0)
}

const jsonp = (domains, path, config, callback) => {
  load(
    config,
    config.protocol,
    domains,
    path,
    {
      callback: '',
      captcha_id: config.captchaId,
      challenge: config.challenge || uuid(),
      client_type: MOBILE ? 'h5' : 'web',
      risk_type: config.riskType,
      user_info: config.userInfo,
      call_type: config.callType,
      lang: config.language || 'en',
    },
    (err) => {
      if (err && typeof config.offlineCb === 'function') {
        config.offlineCb()
        return
      }
      if (err) {
        callback(config._get_fallback_config())
      }
    },
    null,
  )
}

const reportError = (config, url) => {
  load(
    config,
    config.protocol,
    ['monitor.geetest.com'],
    '/monitor/send',
    {
      time: Date.now(),
      captcha_id: config.gt,
      challenge: config.challenge,
      exception_url: url,
      error_code: config.error_code,
    },
    () => {},
  )
}

const throwError = (errorType, config, errObj) => {
  const errors = {
    networkError: '网络错误',
    gtTypeError: 'gt字段不是字符串类型',
  }
  if (typeof config.onError === 'function') {
    config.onError({
      desc: errObj.desc,
      msg: errObj.msg,
      code: errObj.code,
    })
  } else {
    throw new Error(errors[errorType])
  }
}

const detect = () => {
  // Node.js 环境下无法检测
  return false
}

let statusLoaded = detect()

const GeetestIsLoad = (fname) => {
  // Node.js 无需加载前端资源
  return false
}

const initGeetest4 = (userConfig, callback) => {
  const config = new Config(userConfig)
  if (userConfig.https) {
    config.protocol = 'https://'
  } else if (!userConfig.protocol) {
    config.protocol = 'http://'
  }

  if (isObject(userConfig.getType)) {
    config._extend(userConfig.getType)
  }

  jsonp(config.apiServers, config.typePath, config, (newConfig) => {
    const newConfigCamel = camelizeKeys(newConfig)

    if (newConfigCamel.status === 'error') {
      return throwError('networkError', config, newConfigCamel)
    }

    const type = newConfigCamel.type
    if (config.debug) {
      config._extend(config.debug)
    }

    const init = () => {
      config._extend(newConfigCamel)
      callback(new Geetest4(config))
    }

    callbacks[type] = callbacks[type] || []

    const s = status[type] || 'init'
    if (s === 'init') {
      status[type] = 'loading'

      callbacks[type].push(init)

      if (newConfigCamel.gctPath) {
        load(
          config,
          config.protocol,
          config.staticServers || newConfigCamel.staticServers || config.staticServers,
          newConfigCamel.gctPath,
          null,
          (err) => {
            if (err) {
              throwError('networkError', config, {
                code: '60205',
                msg: 'Network failure',
                desc: {
                  detail: 'gct resource load timeout',
                },
              })
            }
          },
        )
      }

      load(
        config,
        config.protocol,
        config.staticServers || newConfigCamel.staticServers || config.staticServers,
        newConfigCamel.bypass || newConfigCamel.staticPath + newConfigCamel.js,
        null,
        (err) => {
          if (err) {
            status[type] = 'fail'
            throwError('networkError', config, {
              code: '60204',
              msg: 'Network failure',
              desc: {
                detail: 'js resource load timeout',
              },
            })
          } else {
            status[type] = 'loaded'
            const cbs = callbacks[type]
            cbs.forEach((cb) => {
              if (isFunction(cb)) {
                cb()
              }
            })
            callbacks[type] = []
            status[type] = 'init'
          }
        },
      )
    } else if (s === 'loaded') {
      return init()
    } else if (s === 'fail') {
      throwError('networkError', config, {
        code: '60204',
        msg: 'Network failure',
        desc: {
          detail: 'js resource load timeout',
        },
      })
    } else if (s === 'loading') {
      callbacks[type].push(init)
    }
  })
}

export { initGeetest4 }
