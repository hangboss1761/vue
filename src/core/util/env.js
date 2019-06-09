/* @flow */

// can we use __proto__?
// 是否存在__proto__字段
// https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Object/proto
export const hasProto = '__proto__' in {}

// Browser environment sniffing
// 是否为浏览器环境
export const inBrowser = typeof window !== 'undefined'
// 是否在Weex环境
export const inWeex = typeof WXEnvironment !== 'undefined' && !!WXEnvironment.platform
// 在weex环境下返回weex平台环境
export const weexPlatform = inWeex && WXEnvironment.platform.toLowerCase()
// 浏览器环境下返回UA
export const UA = inBrowser && window.navigator.userAgent.toLowerCase()
export const isIE = UA && /msie|trident/.test(UA)
export const isIE9 = UA && UA.indexOf('msie 9.0') > 0
export const isEdge = UA && UA.indexOf('edge/') > 0
export const isAndroid = (UA && UA.indexOf('android') > 0) || (weexPlatform === 'android')
export const isIOS = (UA && /iphone|ipad|ipod|ios/.test(UA)) || (weexPlatform === 'ios')
export const isChrome = UA && /chrome\/\d+/.test(UA) && !isEdge
export const isPhantomJS = UA && /phantomjs/.test(UA)
export const isFF = UA && UA.match(/firefox\/(\d+)/)

// Firefox has a "watch" function on Object.prototype...
export const nativeWatch = ({}).watch

export let supportsPassive = false
if (inBrowser) {
  try {
    const opts = {}
    Object.defineProperty(opts, 'passive', ({
      get () {
        /* istanbul ignore next */
        supportsPassive = true
      }
    }: Object)) // https://github.com/facebook/flow/issues/285
    window.addEventListener('test-passive', null, opts)
  } catch (e) {}
}

// this needs to be lazy-evaled because vue may be required before
// vue-server-renderer can set VUE_ENV
// 判断是否为服务端渲染（只检查一次）
let _isServer
export const isServerRendering = () => {
  if (_isServer === undefined) {
    /* istanbul ignore if */
    // 如果当前不在浏览器环境下、不在weex环境下、global不为undefined（nodejs环境）
    if (!inBrowser && !inWeex && typeof global !== 'undefined') {
      // detect presence of vue-server-renderer and avoid
      // Webpack shimming the process
      // 判断global.process是否存在，并判断env.VUE_ENV是否为server
      _isServer = global['process'] && global['process'].env.VUE_ENV === 'server'
    } else {
      // 其他任意情况为false
      _isServer = false
    }
  }
  return _isServer
}

// detect devtools
export const devtools = inBrowser && window.__VUE_DEVTOOLS_GLOBAL_HOOK__

/* istanbul ignore next */
// 判断参数是否为内置函数
// https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Function/toString#Description
export function isNative (Ctor: any): boolean {
  // 参数必须为函数 & .toString返回native code
  return typeof Ctor === 'function' && /native code/.test(Ctor.toString())
}

export const hasSymbol =
  typeof Symbol !== 'undefined' && isNative(Symbol) &&
  typeof Reflect !== 'undefined' && isNative(Reflect.ownKeys)

// 这里对Set做了一个兼容
let _Set
/* istanbul ignore if */ // $flow-disable-line
if (typeof Set !== 'undefined' && isNative(Set)) {
  // use native Set when available.
  _Set = Set // 如果已有Set定义则直接使用Set
} else {
  // a non-standard Set polyfill that only works with primitive keys.
  // 这种兼容处理就是使用一个对象来保证去重（字段名唯一）
  _Set = class Set implements SimpleSet {
    set: Object;
    constructor () {
      // 创建一个空对象set
      this.set = Object.create(null)
    }
    has (key: string | number) {
      // 判断是否包含指定元素
      return this.set[key] === true
    }
    add (key: string | number) {
      // 添加新元素
      this.set[key] = true
    }
    clear () {
      // 重置对象set为null
      this.set = Object.create(null)
    }
  }
}

interface SimpleSet {
  has(key: string | number): boolean;
  add(key: string | number): mixed;
  clear(): void;
}

export { _Set }
export type { SimpleSet }
