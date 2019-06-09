/* @flow */

import config from '../config'
import Watcher from '../observer/watcher'
import Dep, { pushTarget, popTarget } from '../observer/dep'
import { isUpdatingChildComponent } from './lifecycle'

import {
  set,
  del,
  observe,
  defineReactive,
  toggleObserving
} from '../observer/index'

import {
  warn,
  bind,
  noop,
  hasOwn,
  hyphenate,
  isReserved,
  handleError,
  nativeWatch,
  validateProp,
  isPlainObject,
  isServerRendering,
  isReservedAttribute
} from '../util/index'

// 这个对象是为了方便自定义defineProperty
const sharedPropertyDefinition = {
  enumerable: true,
  configurable: true,
  get: noop,
  set: noop
}

// defineProperty的工具方法
// 重置对象的指定字段的get set
// 这个方法是将target.key访问，其实是target.sourceKey.key，做了一个代理访问
export function proxy (target: Object, sourceKey: string, key: string) {
  sharedPropertyDefinition.get = function proxyGetter () {
    return this[sourceKey][key]
  }
  sharedPropertyDefinition.set = function proxySetter (val) {
    this[sourceKey][key] = val
  }
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

// 初始化数据
// 1、props
// 2、methods
// 3、data
// 4、computed
// 5、watch
export function initState (vm: Component) {
  vm._watchers = [] // 初始化watcher数组
  const opts = vm.$options
  if (opts.props) initProps(vm, opts.props)
  if (opts.methods) initMethods(vm, opts.methods)
  if (opts.data) {
    initData(vm)
  } else {
    observe(vm._data = {}, true /* asRootData */)
  }
  if (opts.computed) initComputed(vm, opts.computed)
  if (opts.watch && opts.watch !== nativeWatch) {
    initWatch(vm, opts.watch)
  }
}

// 初始化props
// vm： vue实例
// propsOptions：props
function initProps (vm: Component, propsOptions: Object) {
  const propsData = vm.$options.propsData || {}
  const props = vm._props = {} // 初始化_props
  // cache prop keys so that future props updates can iterate using Array
  // instead of dynamic object key enumeration.
  const keys = vm.$options._propKeys = []
  const isRoot = !vm.$parent
  // root instance props should be converted
  if (!isRoot) {
    toggleObserving(false)
  }
  // 对props遍历
  for (const key in propsOptions) {
    keys.push(key)
    // value为prop的默认值
    const value = validateProp(key, propsOptions, propsData, vm)
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      const hyphenatedKey = hyphenate(key) // 获取连词符转义的key
      if (isReservedAttribute(hyphenatedKey) ||
          config.isReservedAttr(hyphenatedKey)) {
        // 如果key是保留属性字段，或是用户设置的保留属性字段，则报错
        warn(
          `"${hyphenatedKey}" is a reserved attribute and cannot be used as component prop.`,
          vm
        )
      }
      defineReactive(props, key, value, () => {
        if (!isRoot && !isUpdatingChildComponent) {
          warn(
            `Avoid mutating a prop directly since the value will be ` +
            `overwritten whenever the parent component re-renders. ` +
            `Instead, use a data or computed property based on the prop's ` +
            `value. Prop being mutated: "${key}"`,
            vm
          )
        }
      })
    } else {
      defineReactive(props, key, value)
    }
    // static props are already proxied on the component's prototype
    // during Vue.extend(). We only need to proxy props defined at
    // instantiation here.
    if (!(key in vm)) {
      // 将key代理到this下，可以通过this.key访问
      proxy(vm, `_props`, key)
    }
  }
  toggleObserving(true)
}

// 初始化data
function initData (vm: Component) {
  let data = vm.$options.data
  // 将data赋到vm._data
  data = vm._data = typeof data === 'function'
    ? getData(data, vm)
    : data || {}
  if (!isPlainObject(data)) {
    // 如果data不是一个对象，则报错
    data = {}
    process.env.NODE_ENV !== 'production' && warn(
      'data functions should return an object:\n' +
      'https://vuejs.org/v2/guide/components.html#data-Must-Be-a-Function',
      vm
    )
  }
  // proxy data on instance
  const keys = Object.keys(data) // data的所有key
  const props = vm.$options.props
  const methods = vm.$options.methods
  let i = keys.length
  while (i--) {
    const key = keys[i]
    if (process.env.NODE_ENV !== 'production') {
      // key不能与methods字段同名
      if (methods && hasOwn(methods, key)) {
        warn(
          `Method "${key}" has already been defined as a data property.`,
          vm
        )
      }
    }
    if (props && hasOwn(props, key)) {
      // key不能与props字段同名
      process.env.NODE_ENV !== 'production' && warn(
        `The data property "${key}" is already declared as a prop. ` +
        `Use prop default value instead.`,
        vm
      )
    } else if (!isReserved(key)) {
      // 如果key不是保留关键词，则将key代理到this，可以通过this.key访问
      proxy(vm, `_data`, key)
    }
  }
  // observe data
  // 这里要注意的是它观察的是整个data，并不是data的每一个字段
  observe(data, true /* asRootData */)
}

// 返回data
export function getData (data: Function, vm: Component): any {
  // #7573 disable dep collection when invoking data getters
  pushTarget()
  try {
    return data.call(vm, vm) // 如果data是一个函数则直接call，并绑定this为vue实例
  } catch (e) {
    handleError(e, vm, `data()`)
    return {}
  } finally {
    popTarget()
  }
}

const computedWatcherOptions = { lazy: true }

// 初始化计算属性
function initComputed (vm: Component, computed: Object) {
  // $flow-disable-line
  // _computedWatchers为计算属性watcher的缓存对象
  const watchers = vm._computedWatchers = Object.create(null)
  // computed properties are just getters during SSR
  const isSSR = isServerRendering() // 判断是否为SSR

  for (const key in computed) {
    const userDef = computed[key]
    const getter = typeof userDef === 'function' ? userDef : userDef.get
    if (process.env.NODE_ENV !== 'production' && getter == null) {
      warn(
        `Getter is missing for computed property "${key}".`,
        vm
      )
    }

    if (!isSSR) {
      // create internal watcher for the computed property.
      // 在非SSR环境下为每一个computed字段创建一个新的Watcher对象
      // 并且放到vue的实例的_computedWatchers下
      watchers[key] = new Watcher(
        vm,
        getter || noop,
        noop,
        computedWatcherOptions // 注意这里的配置{ lazy: true }
      )
    }

    // component-defined computed properties are already defined on the
    // component prototype. We only need to define computed properties defined
    // at instantiation here.
    // 未定义的computed字段进行定义
    if (!(key in vm)) {
      defineComputed(vm, key, userDef)
    } else if (process.env.NODE_ENV !== 'production') {
      if (key in vm.$data) {
        // 这里检验了computed字段是否已经在data中定义
        warn(`The computed property "${key}" is already defined in data.`, vm)
      } else if (vm.$options.props && key in vm.$options.props) {
        // 这里检验了computed字段是否已经在data中定义
        warn(`The computed property "${key}" is already defined as a prop.`, vm)
      }
    }
  }
}

// 定义Computed计算属性
export function defineComputed (
  target: any,
  key: string,
  userDef: Object | Function
) {
  const shouldCache = !isServerRendering() // 服务端渲染不会走缓存
  if (typeof userDef === 'function') {
    // 如果用户的计算属性为函数
    sharedPropertyDefinition.get = shouldCache
      ? createComputedGetter(key)
      : createGetterInvoker(userDef)
    // 字段为函数时set方法为空函数
    sharedPropertyDefinition.set = noop
  } else {
    // 如果用户的计算属性不为函数（对象：要设置get、set）
    sharedPropertyDefinition.get = userDef.get
      ? shouldCache && userDef.cache !== false
        ? createComputedGetter(key)
        : createGetterInvoker(userDef.get)
      : noop
    // 如果用户设置了set则直接使用，否则为空函数
    sharedPropertyDefinition.set = userDef.set || noop
  }
  if (process.env.NODE_ENV !== 'production' &&
      sharedPropertyDefinition.set === noop) {
    // 在非产品环境下
    // 如果computed的set方法为空函数，且用户调用set方法时提示用户没有设置set方法
    sharedPropertyDefinition.set = function () {
      warn(
        `Computed property "${key}" was assigned to but it has no setter.`,
        this
      )
    }
  }
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

// 创建计算属性get方法
function createComputedGetter (key) {
  return function computedGetter () {
    // 获取当前vue实例的_computedWatchers字段缓存的watcher
    const watcher = this._computedWatchers && this._computedWatchers[key]
    if (watcher) {
      // 如果watcher为脏数据则更新value
      if (watcher.dirty) {
        watcher.evaluate()
      }
      if (Dep.target) {
        watcher.depend()
      }
      return watcher.value
    }
  }
}

// 创建get方法
function createGetterInvoker(fn) {
  // 这里直接返回了fn的方法调用
  return function computedGetter () {
    return fn.call(this, this)
  }
}

// 初始化methods
function initMethods (vm: Component, methods: Object) {
  const props = vm.$options.props // props
  for (const key in methods) {
    if (process.env.NODE_ENV !== 'production') {
      if (typeof methods[key] !== 'function') {
        // methods的每个字段必须为function
        warn(
          `Method "${key}" has type "${typeof methods[key]}" in the component definition. ` +
          `Did you reference the function correctly?`,
          vm
        )
      }
      if (props && hasOwn(props, key)) {
        // methods字段不能与props中的字段重复
        warn(
          `Method "${key}" has already been defined as a prop.`,
          vm
        )
      }
      if ((key in vm) && isReserved(key)) {
        // 如果vue实例已有key，且key以$或者_开头，则报错
        warn(
          `Method "${key}" conflicts with an existing Vue instance method. ` +
          `Avoid defining component methods that start with _ or $.`
        )
      }
    }
    // 如果对应key不是function，则赋为noop（空函数）
    // 对应的key为function时，为function绑定this为vue实例
    // vm[key]可以让用户直接通过this.key使用该方法
    vm[key] = typeof methods[key] !== 'function' ? noop : bind(methods[key], vm)
  }
}

// 初始化Watch
function initWatch (vm: Component, watch: Object) {
  for (const key in watch) {
    const handler = watch[key]
    if (Array.isArray(handler)) {
      for (let i = 0; i < handler.length; i++) {
        createWatcher(vm, key, handler[i])
      }
    } else {
      createWatcher(vm, key, handler)
    }
  }
}

// 创建watcher
function createWatcher (
  vm: Component,
  expOrFn: string | Function,
  handler: any,
  options?: Object
) {
  if (isPlainObject(handler)) {
    options = handler
    handler = handler.handler
  }
  if (typeof handler === 'string') {
    handler = vm[handler]
  }
  return vm.$watch(expOrFn, handler, options)
}

export function stateMixin (Vue: Class<Component>) {
  // flow somehow has problems with directly declared definition object
  // when using Object.defineProperty, so we have to procedurally build up
  // the object here.
  const dataDef = {}
  dataDef.get = function () { return this._data }
  const propsDef = {}
  propsDef.get = function () { return this._props }
  if (process.env.NODE_ENV !== 'production') {
    // 非生产环境中，对$data和$props赋值会报提示错误
    dataDef.set = function () {
      warn(
        'Avoid replacing instance root $data. ' +
        'Use nested data properties instead.',
        this
      )
    }
    propsDef.set = function () {
      warn(`$props is readonly.`, this)
    }
  }
  // 初始化$data返回_data
  Object.defineProperty(Vue.prototype, '$data', dataDef)
  // 初始化$props返回_props
  Object.defineProperty(Vue.prototype, '$props', propsDef)

  Vue.prototype.$set = set // 初始化$set
  Vue.prototype.$delete = del // 初始化$delete

  // 初始化$watch
  Vue.prototype.$watch = function (
    expOrFn: string | Function, // 监听的表达式或函数
    cb: any, // 回调
    options?: Object
  ): Function {
    const vm: Component = this
    if (isPlainObject(cb)) {
      return createWatcher(vm, expOrFn, cb, options)
    }
    options = options || {}
    options.user = true // user标志标示该watcher为用户建立
    const watcher = new Watcher(vm, expOrFn, cb, options) // 创建Watcher实例
    if (options.immediate) {
      // 如果设置了immediate则立即触发一次回调
      try {
        cb.call(vm, watcher.value)
      } catch (error) {
        handleError(error, vm, `callback for immediate watcher "${watcher.expression}"`)
      }
    }
    // 返回的函数可以关闭该watcher
    return function unwatchFn () {
      watcher.teardown()
    }
  }
}
