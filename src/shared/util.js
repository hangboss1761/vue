/* @flow */

export const emptyObject = Object.freeze({}) // 空对象（不可修改）

// These helpers produce better VM code in JS engines due to their
// explicitness and function inlining.

// 判断参数是否未定义
export function isUndef (v: any): boolean %checks {
  return v === undefined || v === null
}

// 判断参数是否已定义
export function isDef (v: any): boolean %checks {
  return v !== undefined && v !== null
}

// 判断参数是否为true（必须为boolean型）
export function isTrue (v: any): boolean %checks {
  return v === true
}

// 判断参数是否为false（必须为boolean型）
export function isFalse (v: any): boolean %checks {
  return v === false
}

/**
 * Check if value is primitive.
 */
// 判断参数是否为基础类型
export function isPrimitive (value: any): boolean %checks {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    // $flow-disable-line
    typeof value === 'symbol' ||
    typeof value === 'boolean'
  )
}

/**
 * Quick object check - this is primarily used to tell
 * Objects from primitive values when we know the value
 * is a JSON-compliant type.
 */
// 判断参数是否为一个非null的对象
export function isObject (obj: mixed): boolean %checks {
  return obj !== null && typeof obj === 'object'
}

/**
 * Get the raw type string of a value, e.g., [object Object].
 */
const _toString = Object.prototype.toString // 提出Object的toString方法

// 返回对象的类型（字符串）
export function toRawType (value: any): string {
  // 举个例子 toString(obj)返回[object type]
  // 这里只返回type
  return _toString.call(value).slice(8, -1)
}

/**
 * Strict object type check. Only returns true
 * for plain JavaScript objects.
 */
// 判断对象是否只继承于Object，非其他继承于其他对象
export function isPlainObject (obj: any): boolean {
  return _toString.call(obj) === '[object Object]'
}

// 判断对象是否为正则式
export function isRegExp (v: any): boolean {
  return _toString.call(v) === '[object RegExp]'
}

/**
 * Check if val is a valid array index.
 */
// 判断传入的值是否为一个有效的索引值
export function isValidArrayIndex (val: any): boolean {
  const n = parseFloat(String(val)) // 强制转成数字
  // 有效的索引值要满足
  // 1、大于0
  // 2、整数
  // 3、不是无穷大、NaN
  return n >= 0 && Math.floor(n) === n && isFinite(val)
}

// 判断对象是否为promise
export function isPromise (val: any): boolean {
  return (
    isDef(val) &&
    typeof val.then === 'function' &&
    typeof val.catch === 'function'
  )
}

/**
 * Convert a value to a string that is actually rendered.
 */
// 返回参数的字符串表达
export function toString (val: any): string {
  // 如果参数为null则返回空字符
  // 如果参数为数组或者纯对象则返回返回参数的字符串表达式（缩进2格）
  // 其他情况则直接返回参数的字符串格式
  return val == null
    ? ''
    : Array.isArray(val) || (isPlainObject(val) && val.toString === _toString)
      ? JSON.stringify(val, null, 2)
      : String(val)
}

/**
 * Convert an input value to a number for persistence.
 * If the conversion fails, return original string.
 */
// 将参数转成数字（成功返回数字，不成功返回自身）
export function toNumber (val: string): number | string {
  const n = parseFloat(val) // 强制转成数字
  return isNaN(n) ? val : n // 判断如果为NaN返回自身，如果不为NaN返回数字
}

/**
 * Make a map and return a function for checking if a key
 * is in that map.
 */
// 创建一个对象并返回一个匿名函数
// 匿名函数用来判断是否存在传入的字段
// 参数用 ',' 链接
export function makeMap (
  str: string,
  expectsLowerCase?: boolean
): (key: string) => true | void {
  // 创建空对象
  const map = Object.create(null)
  // 将传入的字段字符串转成数组
  const list: Array<string> = str.split(',')
  // 对数组遍历，存到map中并将对应字段设为true
  for (let i = 0; i < list.length; i++) {
    map[list[i]] = true
  }
  // expectsLowerCase表示是否区分大小写，true为不区分，false 为区分
  return expectsLowerCase
    ? val => map[val.toLowerCase()]
    : val => map[val]
}

/**
 * Check if a tag is a built-in tag.
 */
// 创建built in tag的map，包含slow、components字段，不区分大小写
export const isBuiltInTag = makeMap('slot,component', true)

/**
 * Check if an attribute is a reserved attribute.
 */
// 创建保留属性字段，区分大小写
export const isReservedAttribute = makeMap('key,ref,slot,slot-scope,is')

/**
 * Remove an item from an array.
 */
// 将一个对象从数组中移除
export function remove (arr: Array<any>, item: any): Array<any> | void {
  if (arr.length) {
    const index = arr.indexOf(item)
    if (index > -1) {
      return arr.splice(index, 1)
    }
  }
}

/**
 * Check whether an object has the property.
 */
// 提出Object 的hasOwnProperty方法
const hasOwnProperty = Object.prototype.hasOwnProperty
export function hasOwn (obj: Object | Array<*>, key: string): boolean {
  // 判断对象是否包含指定字段
  return hasOwnProperty.call(obj, key)
}

/**
 * Create a cached version of a pure function.
 */
// 创建缓存函数，缓存一个对象
export function cached<F: Function> (fn: F): F {
  // 创建一个空对象
  const cache = Object.create(null)
  // 返回一个函数
  // 函数返回指定字段的值
  return (function cachedFn (str: string) {
    const hit = cache[str] // 先从缓存的对象中取
    return hit || (cache[str] = fn(str)) // 如果不存在，则先赋值到缓存对象，再返回字段值
  }: any)
}

/**
 * Camelize a hyphen-delimited string.
 */
// 将连词符的字符串转成驼峰格式
// 举例：a-b 转成 aB
// 缓存参数
const camelizeRE = /-(\w)/g
export const camelize = cached((str: string): string => {
  return str.replace(camelizeRE, (_, c) => c ? c.toUpperCase() : '')
})

/**
 * Capitalize a string.
 */
// 首字母大写
// 缓存参数
export const capitalize = cached((str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1)
})

/**
 * Hyphenate a camelCase string.
 */
// 将驼峰格式改成连词符
// 举例：aB 转成 a-b
// 缓存参数
const hyphenateRE = /\B([A-Z])/g
export const hyphenate = cached((str: string): string => {
  return str.replace(hyphenateRE, '-$1').toLowerCase()
})

/**
 * Simple bind polyfill for environments that do not support it,
 * e.g., PhantomJS 1.x. Technically, we don't need this anymore
 * since native bind is now performant enough in most browsers.
 * But removing it would mean breaking code that was able to run in
 * PhantomJS 1.x, so this must be kept for backward compatibility.
 */

/* istanbul ignore next */
// 自建的bind方法
function polyfillBind (fn: Function, ctx: Object): Function {
  function boundFn (a) {
    const l = arguments.length
    return l
      ? l > 1
        ? fn.apply(ctx, arguments) // 如果多个参数则使用apply方法（大于一个）
        : fn.call(ctx, a) // 如果只有一个参数则使用call方法
      : fn.call(ctx) // 如果没有参数则使用call
  }

  boundFn._length = fn.length
  return boundFn
}

// 原生bind方法
function nativeBind (fn: Function, ctx: Object): Function {
  return fn.bind(ctx)
}
// 绑定函数，这里判断Function是否自带bind方法，如果没有则使用自建的bind方法
export const bind = Function.prototype.bind
  ? nativeBind
  : polyfillBind

/**
 * Convert an Array-like object to a real Array.
 */
// 将一个数组、类数组转成真数组，并截取部分
// PS：类数组是指对象的key为数字，例如：{ 1: 'a', 2: 'b' }
export function toArray (list: any, start?: number): Array<any> {
  start = start || 0
  let i = list.length - start
  const ret: Array<any> = new Array(i)
  // 这里的遍历是从后向前遍历
  while (i--) {
    ret[i] = list[i + start]
  }
  return ret
}

/**
 * Mix properties into target object.
 */
// to对象继承_from对象（浅拷贝）返回to对象
export function extend (to: Object, _from: ?Object): Object {
  for (const key in _from) {
    to[key] = _from[key]
  }
  return to
}

/**
 * Merge an Array of Objects into a single Object.
 */
// 将一组对象合并成一个新的对象（浅拷贝，存在覆盖）
export function toObject (arr: Array<any>): Object {
  // 声明一个空对象
  const res = {}
  // 对数据遍历调用extend方法
  for (let i = 0; i < arr.length; i++) {
    if (arr[i]) {
      extend(res, arr[i])
    }
  }
  return res
}

/* eslint-disable no-unused-vars */

/**
 * Perform no operation.
 * Stubbing args to make Flow happy without leaving useless transpiled code
 * with ...rest (https://flow.org/blog/2017/05/07/Strict-Function-Call-Arity/).
 */
// 声明空函数
export function noop (a?: any, b?: any, c?: any) {}

/**
 * Always return false.
 */
// 永远返回false
export const no = (a?: any, b?: any, c?: any) => false

/* eslint-enable no-unused-vars */

/**
 * Return the same value.
 */
// 返回自身函数
export const identity = (_: any) => _

/**
 * Generate a string containing static keys from compiler modules.
 */
// 返回ModuleOptions数组的所有静态key
export function genStaticKeys (modules: Array<ModuleOptions>): string {
  // 对数组遍历，并拼接元素的staticKeys字段，最后返回拼接后的字符串
  return modules.reduce((keys, m) => {
    return keys.concat(m.staticKeys || [])
  }, []).join(',')
}

/**
 * Check if two values are loosely equal - that is,
 * if they are plain objects, do they have the same shape?
 */
// 判断两个对象是否相等（浅拷贝对比）
export function looseEqual (a: any, b: any): boolean {
  // 同一对象地址返回true
  if (a === b) return true
  // 判断两个参数是否都为object
  const isObjectA = isObject(a)
  const isObjectB = isObject(b)
  if (isObjectA && isObjectB) {
    try {
      // 判断两个参数是否为数组
      const isArrayA = Array.isArray(a)
      const isArrayB = Array.isArray(b)
      if (isArrayA && isArrayB) {
        // 两个参数都是数组，则判断
        // 1、两个参数长度是否相等
        // 2、两个数组每一个元素是否相等（递归调用looseEqual方法）
        // 注：元素的索引一一对应的
        return a.length === b.length && a.every((e, i) => {
          return looseEqual(e, b[i])
        })
      } else if (a instanceof Date && b instanceof Date) {
        // 如果两个参数均为Date类型，则判断参数的毫秒数是否一致
        return a.getTime() === b.getTime()
      } else if (!isArrayA && !isArrayB) {
        // 两个参数都不是数组（两个参数都是对象）
        // 获取两个参数的key数组
        const keysA = Object.keys(a)
        const keysB = Object.keys(b)
        // 判断两个参数的字段数量是否一致
        // 对参数数组遍历递归调用looseEqual，判断每一个字段是否相等
        return keysA.length === keysB.length && keysA.every(key => {
          return looseEqual(a[key], b[key])
        })
      } else {
        // 异常case默认返回false
        // 举例：一个参数为数组，一个参数为对象
        /* istanbul ignore next */
        return false
      }
    } catch (e) {
      /* istanbul ignore next */
      return false
    }
  } else if (!isObjectA && !isObjectB) {
    // 两个参数都不是object则判断两个参数字符串格式
    return String(a) === String(b)
  } else {
    // 两个参数有一个为object，一个不为object则返回false
    return false
  }
}

/**
 * Return the first index at which a loosely equal value can be
 * found in the array (if value is a plain object, the array must
 * contain an object of the same shape), or -1 if it is not present.
 */
// 返回数组中指定元素的位置
// looseIndexOf和indexOf区别在于：
// 1、indexOf比较的是地址
// 2、looseIndexOf是比较字段
export function looseIndexOf (arr: Array<mixed>, val: mixed): number {
  for (let i = 0; i < arr.length; i++) {
    if (looseEqual(arr[i], val)) return i
  }
  return -1
}

/**
 * Ensure a function is called only once.
 */
// 只执行一次回调
export function once (fn: Function): Function {
  let called = false
  return function () {
    if (!called) {
      called = true
      fn.apply(this, arguments)
    }
  }
}
