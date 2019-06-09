/* @flow */

import type Watcher from './watcher'
import { remove } from '../util/index'
import config from '../config'

let uid = 0

/**
 * A dep is an observable that can have multiple
 * directives subscribing to it.
 */
export default class Dep {
  static target: ?Watcher;
  id: number;
  subs: Array<Watcher>;

  constructor () {
    this.id = uid++ // 依赖Id
    this.subs = [] // 订阅者数组
  }

  addSub (sub: Watcher) {
    // 添加新的订阅者（watcher）
    this.subs.push(sub)
  }

  removeSub (sub: Watcher) {
    // 移除指定订阅者（watcher）
    remove(this.subs, sub)
  }

  depend () {
    if (Dep.target) {
      Dep.target.addDep(this)
    }
  }

  notify () {
    // stabilize the subscriber list first
    const subs = this.subs.slice() // 新建一个订阅者拷贝
    if (process.env.NODE_ENV !== 'production' && !config.async) {
      // subs aren't sorted in scheduler if not running async
      // we need to sort them now to make sure they fire in correct
      // order
      subs.sort((a, b) => a.id - b.id)
    }
    // 对每一个订阅者（watcher）遍历触发watcher的update方法
    for (let i = 0, l = subs.length; i < l; i++) {
      subs[i].update()
    }
  }
}

// The current target watcher being evaluated.
// This is globally unique because only one watcher
// can be evaluated at a time.
// 将target设置为全局唯一，是因为同时只能处理一个watcher
Dep.target = null
const targetStack = [] // 目标栈

export function pushTarget (target: ?Watcher) {
  // 将当前watcher放到目标栈中
  targetStack.push(target)
  // 将当前target置为当前watcher
  Dep.target = target
}

export function popTarget () {
  // 弹出当前watcher
  targetStack.pop()
  // 将当前target置为最后一个watcher
  Dep.target = targetStack[targetStack.length - 1]
}
