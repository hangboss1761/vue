/* @flow */

import { warn } from './debug'
import { observe, toggleObserving, shouldObserve } from '../observer/index'
import {
  hasOwn,
  isObject,
  toRawType,
  hyphenate,
  capitalize,
  isPlainObject
} from 'shared/util'

type PropOptions = {
  type: Function | Array<Function> | null,
  default: any,
  required: ?boolean,
  validator: ?Function
};

// 校验props
export function validateProp (
  key: string,
  propOptions: Object,
  propsData: Object,
  vm?: Component
): any {
  const prop = propOptions[key] // key对应的prop对象
  const absent = !hasOwn(propsData, key) // 判断propsData是否已经有key字段
  let value = propsData[key] // 从propsData中取key对应的value（不存在则为undefined）
  // boolean casting
  // prop是否包含Boolean类型
  const booleanIndex = getTypeIndex(Boolean, prop.type)
  if (booleanIndex > -1) {
    // 如果propsData还没有key字段，prop也没有default字段
    // 则value默认为false
    if (absent && !hasOwn(prop, 'default')) {
      value = false
    } else if (value === '' || value === hyphenate(key)) {
      // only cast empty string / same name to boolean if
      // boolean has higher priority
      // 如果value为空字符串，或value等于用连词符转义后key
      // 判断prop是否包含String类型
      const stringIndex = getTypeIndex(String, prop.type)
      if (stringIndex < 0 || booleanIndex < stringIndex) {
        // 如果不包含String类型，或Boolean类型比String类型优先（索引值更小）
        // 则将value置为true
        value = true
      }
    }
  }
  // check default value
  if (value === undefined) {
    // 如果value为undefined，则获取prop默认值
    value = getPropDefaultValue(vm, prop, key)
    // since the default value is a fresh copy,
    // make sure to observe it.
    const prevShouldObserve = shouldObserve
    toggleObserving(true)
    observe(value) // 对value创建观察者
    toggleObserving(prevShouldObserve)
  }
  if (
    process.env.NODE_ENV !== 'production' &&
    // skip validation for weex recycle-list child component props
    !(__WEEX__ && isObject(value) && ('@binding' in value))
  ) {
    assertProp(prop, key, value, vm, absent)
  }
  return value
}

/**
 * Get the default value of a prop.
 */
// 返回prop默认值
function getPropDefaultValue (vm: ?Component, prop: PropOptions, key: string): any {
  // no default, return undefined
  // 如果没有设置default则返回undefined
  if (!hasOwn(prop, 'default')) {
    return undefined
  }
  const def = prop.default // 取设置的default值
  // warn against non-factory defaults for Object & Array
  if (process.env.NODE_ENV !== 'production' && isObject(def)) {
    // 如果def为一个对象或数组，则在非生产环境中报错
    // 这里解释一下为什么不能直接返回对象或数组（任意引用类型）
    // 是因为如果一个vue实例被多个vue实例注册了组件，
    // 直接返回引用类型就会出现多个vue实例操作内该组件的默认值是同一个（引用类型地址）
    // 所以一定要通过函数返回（每次都是一个新的）
    warn(
      'Invalid default value for prop "' + key + '": ' +
      'Props with type Object/Array must use a factory function ' +
      'to return the default value.',
      vm
    )
  }
  // the raw prop value was also undefined from previous render,
  // return previous default value to avoid unnecessary watcher trigger
  if (vm && vm.$options.propsData &&
    vm.$options.propsData[key] === undefined &&
    vm._props[key] !== undefined
  ) {
    // 到达此步骤需满足
    // 1、vue实例存在
    // 2、propsData存在
    // 3、propsData中对应的key还未定义
    // 4、_props对应的key已定义
    // 则直接返回_props[key]
    return vm._props[key]
  }
  // call factory function for non-Function types
  // a value is Function if its prototype is function even across different execution context
  // 1、如果default为一个function，且不是Function构造函数，则执行def
  // 2、其他情况则直接返回def（非function）
  return typeof def === 'function' && getType(prop.type) !== 'Function'
    ? def.call(vm)
    : def
}

/**
 * Assert whether a prop is valid.
 */
function assertProp (
  prop: PropOptions,
  name: string,
  value: any,
  vm: ?Component,
  absent: boolean
) {
  if (prop.required && absent) {
    warn(
      'Missing required prop: "' + name + '"',
      vm
    )
    return
  }
  if (value == null && !prop.required) {
    return
  }
  let type = prop.type
  let valid = !type || type === true
  const expectedTypes = []
  if (type) {
    if (!Array.isArray(type)) {
      type = [type]
    }
    for (let i = 0; i < type.length && !valid; i++) {
      const assertedType = assertType(value, type[i])
      expectedTypes.push(assertedType.expectedType || '')
      valid = assertedType.valid
    }
  }

  if (!valid) {
    warn(
      getInvalidTypeMessage(name, value, expectedTypes),
      vm
    )
    return
  }
  const validator = prop.validator
  if (validator) {
    if (!validator(value)) {
      warn(
        'Invalid prop: custom validator check failed for prop "' + name + '".',
        vm
      )
    }
  }
}

const simpleCheckRE = /^(String|Number|Boolean|Function|Symbol)$/

function assertType (value: any, type: Function): {
  valid: boolean;
  expectedType: string;
} {
  let valid
  const expectedType = getType(type)
  if (simpleCheckRE.test(expectedType)) {
    const t = typeof value
    valid = t === expectedType.toLowerCase()
    // for primitive wrapper objects
    if (!valid && t === 'object') {
      valid = value instanceof type
    }
  } else if (expectedType === 'Object') {
    valid = isPlainObject(value)
  } else if (expectedType === 'Array') {
    valid = Array.isArray(value)
  } else {
    valid = value instanceof type
  }
  return {
    valid,
    expectedType
  }
}

/**
 * Use function string name to check built-in types,
 * because a simple equality check will fail when running
 * across different vms / iframes.
 */
// 获取类型
// /^\s*function (\w+)/
// 匹配任何不可见字符（任意个） + function + 空格 + 匹配包括下划线的任何单词字符（至少一个）
// 举例：'function name'
// 这里是利用了函数的toString方法返回一个表示当前函数源代码的字符串
function getType (fn) {
  const match = fn && fn.toString().match(/^\s*function (\w+)/)
  return match ? match[1] : ''
}

// 判断是否为同年类型
function isSameType (a, b) {
  return getType(a) === getType(b)
}

// 获取props type中对应对的索引值
// type为要搜索的类型
// expectedTypes为props.type期望类型（对象或数组）
function getTypeIndex (type, expectedTypes): number {
  if (!Array.isArray(expectedTypes)) {
    // 如果expectedTypes不为数组，
    // 则判断expectedTypes, type是否为同类型，并返回对应索引值
    return isSameType(expectedTypes, type) ? 0 : -1
  }
  // expectedTypes为数组
  for (let i = 0, len = expectedTypes.length; i < len; i++) {
    // 对expectedTypes遍历，判断每个元素与type是否为同类型，并返回同类型的索引
    if (isSameType(expectedTypes[i], type)) {
      return i
    }
  }
  // 都找不到则返回-1
  return -1
}

function getInvalidTypeMessage (name, value, expectedTypes) {
  let message = `Invalid prop: type check failed for prop "${name}".` +
    ` Expected ${expectedTypes.map(capitalize).join(', ')}`
  const expectedType = expectedTypes[0]
  const receivedType = toRawType(value)
  const expectedValue = styleValue(value, expectedType)
  const receivedValue = styleValue(value, receivedType)
  // check if we need to specify expected value
  if (expectedTypes.length === 1 &&
      isExplicable(expectedType) &&
      !isBoolean(expectedType, receivedType)) {
    message += ` with value ${expectedValue}`
  }
  message += `, got ${receivedType} `
  // check if we need to specify received value
  if (isExplicable(receivedType)) {
    message += `with value ${receivedValue}.`
  }
  return message
}

function styleValue (value, type) {
  if (type === 'String') {
    return `"${value}"`
  } else if (type === 'Number') {
    return `${Number(value)}`
  } else {
    return `${value}`
  }
}

function isExplicable (value) {
  const explicitTypes = ['string', 'number', 'boolean']
  return explicitTypes.some(elem => value.toLowerCase() === elem)
}

function isBoolean (...args) {
  return args.some(elem => elem.toLowerCase() === 'boolean')
}
