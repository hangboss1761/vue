/* @flow */

import {
  warn,
  remove,
  isObject,
  parsePath,
  _Set as Set,
  handleError,
  noop
} from '../util/index'

import { traverse } from './traverse'
import { queueWatcher } from './scheduler'
import Dep, { pushTarget, popTarget } from './dep'

import type { SimpleSet } from '../util/index'

let uid = 0

/**
 * A watcher parses an expression, collects dependencies,
 * and fires callback when the expression value changes.
 * This is used for both the $watch() api and directives.
 */
export default class Watcher {
  vm: Component; // 当前watcher所在的vue实例
  expression: string; // 监听表达式
  cb: Function; // 回调函数
  id: number; // 唯一ID
  deep: boolean;
  user: boolean; // 是否为用户创建
  lazy: boolean; // 延迟更新
  sync: boolean;
  dirty: boolean;
  active: boolean; // 是否活跃标志
  deps: Array<Dep>;
  newDeps: Array<Dep>; // 当前的Dep依赖数组
  depIds: SimpleSet;
  newDepIds: SimpleSet; // 当前的Dep依赖ID数组
  before: ?Function;
  getter: Function; // 获取value的方法
  value: any;

  constructor (
    vm: Component,
    expOrFn: string | Function,
    cb: Function,
    options?: ?Object,
    isRenderWatcher?: boolean
  ) {
    this.vm = vm
    if (isRenderWatcher) {
      vm._watcher = this
    }
    vm._watchers.push(this)
    // options
    if (options) {
      this.deep = !!options.deep
      this.user = !!options.user
      this.lazy = !!options.lazy // 延迟更新
      this.sync = !!options.sync
      this.before = options.before
    } else {
      this.deep = this.user = this.lazy = this.sync = false
    }
    this.cb = cb
    this.id = ++uid // uid for batching
    this.active = true
    this.dirty = this.lazy // for lazy watchers
    this.deps = [] // dep依赖数组
    this.newDeps = []
    this.depIds = new Set()
    this.newDepIds = new Set()
    this.expression = process.env.NODE_ENV !== 'production'
      ? expOrFn.toString()
      : ''
    // parse expression for getter
    if (typeof expOrFn === 'function') {
      // 如果监听为一个函数则getter为传入的函数
      this.getter = expOrFn
    } else {
      // 如果监听为一个字符串
      // 则通过parsePath解析expOrFn表达式创建一个新函数遍历至对象指定的字段
      this.getter = parsePath(expOrFn)
      if (!this.getter) {
        // 如果parsePath返回了undefined，则证明传入的表达式包含其它字符（详情看parsePath方法）
        this.getter = noop
        process.env.NODE_ENV !== 'production' && warn(
          `Failed watching path: "${expOrFn}" ` +
          'Watcher only accepts simple dot-delimited paths. ' +
          'For full control, use a function instead.',
          vm
        )
      }
    }
    // 当前watcher监听的value
    // 如果lazy为true，则认为延迟更新
    // lazy为false，则立即调用一次get方法更新value
    this.value = this.lazy
      ? undefined
      : this.get()
  }

  /**
   * Evaluate the getter, and re-collect dependencies.
   */
  get () {
    // 放入执行栈中
    pushTarget(this)
    let value
    const vm = this.vm
    try {
      // 调用watcher的getter方法
      // 这里要注意getter方法的参数为当前vue实例
      value = this.getter.call(vm, vm)
    } catch (e) {
      // 这里报错会分两种，一种为用户创建的watcher，一种为内置的watcher
      // 两种报错信息不同，区别为user标志
      if (this.user) {
        handleError(e, vm, `getter for watcher "${this.expression}"`)
      } else {
        throw e
      }
    } finally {
      // "touch" every property so they are all tracked as
      // dependencies for deep watching
      if (this.deep) {
        // 如果设置的深度遍历deep: true
        // 则对value进行深度遍历（调用的Dep对象每一个getter方法）
        traverse(value)
      }
      // 弹出执行栈
      popTarget()
      this.cleanupDeps()
    }
    return value
  }

  /**
   * Add a dependency to this directive.
   */
  // 添加Dep依赖
  addDep (dep: Dep) {
    const id = dep.id
    if (!this.newDepIds.has(id)) {
      // 如果newDepIds中没有该Dep，则放入newDepIds、newDeps中
      this.newDepIds.add(id)
      this.newDeps.push(dep)
      if (!this.depIds.has(id)) {
        // 如果depIds中没有该Dep，则向dep中添加this订阅者
        dep.addSub(this)
      }
    }
  }

  /**
   * Clean up for dependency collection.
   */
  cleanupDeps () {
    let i = this.deps.length
    while (i--) {
      const dep = this.deps[i]
      if (!this.newDepIds.has(dep.id)) {
        // 如果newDepIds不包含dep则将this订阅者从dep中移除
        dep.removeSub(this)
      }
    }
    // 综合说一下这一段逻辑
    // 将newDepIds和newDeps放到depIds和deps中，然后将newDepIds和newDeps制空
    let tmp = this.depIds
    this.depIds = this.newDepIds // 将新加入的DepIds放到depIds中
    this.newDepIds = tmp
    this.newDepIds.clear()
    tmp = this.deps
    this.deps = this.newDeps
    this.newDeps = tmp
    this.newDeps.length = 0
  }

  /**
   * Subscriber interface.
   * Will be called when a dependency changes.
   */
  update () {
    // 订阅更新
    /* istanbul ignore else */
    if (this.lazy) {
      // 延迟更新，将dirty标志置为true
      this.dirty = true
    } else if (this.sync) {
      this.run()
    } else {
      queueWatcher(this)
    }
  }

  /**
   * Scheduler job interface.
   * Will be called by the scheduler.
   */
  run () {
    // 只有活跃状态才有效
    if (this.active) {
      const value = this.get() // 先拿到value
      if (
        value !== this.value ||
        // Deep watchers and watchers on Object/Arrays should fire even
        // when the value is the same, because the value may
        // have mutated.
        isObject(value) ||
        this.deep
      ) {
        // 1、value与当前this.value不一致
        // 2、value是一个对象
        // 3、deep为true
        // set new value
        const oldValue = this.value
        this.value = value // 更新value
        if (this.user) {
          try {
            // 如果该watcher为用户创建，则调用回调，绑定this为vue实例
            this.cb.call(this.vm, value, oldValue)
          } catch (e) {
            handleError(e, this.vm, `callback for watcher "${this.expression}"`)
          }
        } else {
          // 调用回调，绑定this为vue实例
          this.cb.call(this.vm, value, oldValue)
        }
      }
    }
  }

  /**
   * Evaluate the value of the watcher.
   * This only gets called for lazy watchers.
   */
  evaluate () {
    // 调用get方法更新value，并将dirty标示置为false
    this.value = this.get()
    this.dirty = false
  }

  /**
   * Depend on all deps collected by this watcher.
   */
  depend () {
    let i = this.deps.length
    while (i--) {
      this.deps[i].depend()
    }
  }

  /**
   * Remove self from all dependencies' subscriber list.
   */
  // 将该wathcer置为失效
  teardown () {
    if (this.active) {
      // remove self from vm's watcher list
      // this is a somewhat expensive operation so we skip it
      // if the vm is being destroyed.
      if (!this.vm._isBeingDestroyed) {
        // 在vue实例destroy之前，从该vm实例中_watchers列表中移除
        remove(this.vm._watchers, this)
      }
      // 将所有的deps中移除该watcher订阅者
      let i = this.deps.length
      while (i--) {
        this.deps[i].removeSub(this)
      }
      // active标示置为false失效
      this.active = false
    }
  }
}
