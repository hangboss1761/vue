/* @flow */

import Dep from './dep'
import VNode from '../vdom/vnode'
import { arrayMethods } from './array'
import {
  def,
  warn,
  hasOwn,
  hasProto,
  isObject,
  isPlainObject,
  isPrimitive,
  isUndef,
  isValidArrayIndex,
  isServerRendering
} from '../util/index'

const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

/**
 * In some cases we may want to disable observation inside a component's
 * update computation.
 */
export let shouldObserve: boolean = true // 是否要观察

// 更改是否开启Observing观察方法
export function toggleObserving (value: boolean) {
  shouldObserve = value
}

/**
 * Observer class that is attached to each observed
 * object. Once attached, the observer converts the target
 * object's property keys into getter/setters that
 * collect dependencies and dispatch updates.
 */
// 观察者原型
export class Observer {
  value: any;
  dep: Dep;
  vmCount: number; // number of vms that have this object as root $data

  constructor (value: any) {
    this.value = value // 参数值
    this.dep = new Dep() // 创建一个Dep依赖实例
    this.vmCount = 0 // vue实例数
    def(value, '__ob__', this) // value加上__ob__字段指向当前Observer实例
    if (Array.isArray(value)) { // value为数组
      if (hasProto) {
        // 包含__proto__字段
        protoAugment(value, arrayMethods)
      } else {
        copyAugment(value, arrayMethods, arrayKeys)
      }
      // 对每一个元素绑定观察者
      this.observeArray(value)
    } else {
      // value为一个对象
      this.walk(value)
    }
  }

  /**
   * Walk through all properties and convert them into
   * getter/setters. This method should only be called when
   * value type is Object.
   */
  walk (obj: Object) {
    // 对象的每一个字段做响应式绑定
    const keys = Object.keys(obj)
    for (let i = 0; i < keys.length; i++) {
      defineReactive(obj, keys[i])
    }
  }

  /**
   * Observe a list of Array items.
   */
  observeArray (items: Array<any>) {
    // 对每一个元素绑定观察者
    for (let i = 0, l = items.length; i < l; i++) {
      observe(items[i])
    }
  }
}

// helpers

/**
 * Augment a target Object or Array by intercepting
 * the prototype chain using __proto__
 */
function protoAugment (target, src: Object) {
  /* eslint-disable no-proto */
  target.__proto__ = src // 直接修改原型链
  /* eslint-enable no-proto */
}

/**
 * Augment a target Object or Array by defining
 * hidden properties.
 */
/* istanbul ignore next */
function copyAugment (target: Object, src: Object, keys: Array<string>) {
  // 对target绑定指定字段
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i]
    def(target, key, src[key])
  }
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 */
// 创建一个新的观察者实例，如果已有观察者则直接返回，如果没有则创建一个新的返回
export function observe (value: any, asRootData: ?boolean): Observer | void {
  if (!isObject(value) || value instanceof VNode) {
    // 如果value不是一个对象，或者value为一个VNode则返回
    return
  }
  let ob: Observer | void
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    // 如果value已经有__ob__字段，以及__ob__字段为Observer实例
    // 则直接返回__ob__字段
    ob = value.__ob__
  } else if (
    shouldObserve &&
    !isServerRendering() &&
    (Array.isArray(value) || isPlainObject(value)) &&
    Object.isExtensible(value) &&
    !value._isVue
  ) {
    // 创建一个新的观察者需要满足：
    // 1、shouldObserve为true
    // 2、非服务端渲染
    // 3、value为一个数组或者纯对象
    // 4、value可扩展：
    //    https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Object/isExtensible
    // 5、value不是vue实例（不存在_isVue字段）
    ob = new Observer(value)
  }
  if (asRootData && ob) {
    ob.vmCount++
  }
  return ob
}

/**
 * Define a reactive property on an Object.
 */
// 定义响应式
export function defineReactive (
  obj: Object, // 原对象
  key: string, // 要设置的key
  val: any, // 默认值
  customSetter?: ?Function, // 自定义setter
  shallow?: boolean
) {
  // 初始化一个dep
  const dep = new Dep()

  // 获取指定字段的描述
  const property = Object.getOwnPropertyDescriptor(obj, key)
  // 如果该字段不可配置则结束
  if (property && property.configurable === false) {
    return
  }

  // cater for pre-defined getter/setters
  const getter = property && property.get
  const setter = property && property.set
  if ((!getter || setter) && arguments.length === 2) {
    val = obj[key]
  }

  let childOb = !shallow && observe(val)
  // 双向绑定的get/set方法重写
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get: function reactiveGetter () {
      const value = getter ? getter.call(obj) : val
      if (Dep.target) {
        dep.depend()
        if (childOb) {
          childOb.dep.depend()
          if (Array.isArray(value)) {
            dependArray(value)
          }
        }
      }
      return value
    },
    set: function reactiveSetter (newVal) {
      // 先获取当前value
      const value = getter ? getter.call(obj) : val
      /* eslint-disable no-self-compare */
      // 新老值一致 & 新老值每一次get都不一致，则直接返回
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      }
      /* eslint-enable no-self-compare */
      if (process.env.NODE_ENV !== 'production' && customSetter) {
        customSetter()
      }
      // #7981: for accessor properties without setter
      // 如果字段只有get方法没有set方法则返回
      if (getter && !setter) return
      if (setter) {
        // 如果有setter方法则call
        setter.call(obj, newVal)
      } else {
        // 直接赋值
        val = newVal
      }
      childOb = !shallow && observe(newVal)
      dep.notify() // 触发所有watcher
    }
  })
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 */
// Vue.set方法 & this.$vue 方法定义
export function set (target: Array<any> | Object, key: any, val: any): any {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    // 在非生产环境中，如果target目标为undefined、null、基础类型，则提示错误
    warn(`Cannot set reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    // 如果target为一个数组，且key是一个正确的索引值
    // 改变数组长度（如果key大于当前长度则变长，否则不变）
    target.length = Math.max(target.length, key)
    // 插入元素
    target.splice(key, 1, val)
    return val
  }
  if (key in target && !(key in Object.prototype)) {
    // 如果key为target的一个字段，且不是基础方法
    // 直接对字段赋值
    //
    // 这里会有这样的一个case：
    // 如果targer为vue实例，如果key为vue实例已定义的字段则直接赋值触发响应式
    target[key] = val
    return val
  }
  // 到这一步证明两个条件
  // 1、target为一个对象
  // 2、key在target中未定义
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid adding reactive properties to a Vue instance or its root $data ' +
      'at runtime - declare it upfront in the data option.'
    )
    return val
  }
  if (!ob) {
    // 如果__ob__（observe未定义）则直接赋值
    target[key] = val
    return val
  }
  // observe已定义，则定义响应式
  defineReactive(ob.value, key, val)
  ob.dep.notify() // 触发观察者的notify方法
  return val
}

/**
 * Delete a property and trigger change if necessary.
 */
// 删除一个对象的指定字段，如果target被订阅了则触发修改通知
export function del (target: Array<any> | Object, key: any) {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    // 在非生产环境下，如果target为undefined/null/基本类型则报错
    warn(`Cannot delete reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    // 如果target为一个数组，且key为有效的索引值
    // 则直接使用splice方法
    target.splice(key, 1)
    return
  }
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    // 如果target是vue实例或者是observer观察者则报错
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid deleting properties on a Vue instance or its root $data ' +
      '- just set it to null.'
    )
    return
  }
  if (!hasOwn(target, key)) {
    // 如果key不是target的字段则直接返回
    return
  }
  // 走到这一步则认为target是一个对象
  // 直接使用delete方法
  delete target[key]
  if (!ob) {
    // 如果target没有observer观察者则返回
    return
  }
  // 这里证明target有observer观察则进行notify通知响应式
  ob.dep.notify()
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 */
function dependArray (value: Array<any>) {
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i]
    e && e.__ob__ && e.__ob__.dep.depend()
    if (Array.isArray(e)) {
      dependArray(e)
    }
  }
}
