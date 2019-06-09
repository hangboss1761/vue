/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 */

import { def } from '../util/index'

const arrayProto = Array.prototype // 所有的Array方法
export const arrayMethods = Object.create(arrayProto) // 根据Array方法创建一个新的对象

const methodsToPatch = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]

/**
 * Intercept mutating methods and emit events
 */
// 对数组的原生方法二次封装
methodsToPatch.forEach(function (method) {
  // cache original method
  const original = arrayProto[method]
  def(arrayMethods, method, function mutator (...args) {
    // 原生方法先执行
    const result = original.apply(this, args)
    const ob = this.__ob__
    let inserted // 新插入的元素
    // 只有push、unshift、splice方法会插入新的元素
    switch (method) {
      case 'push':
      case 'unshift':
        inserted = args
        break
      case 'splice':
        inserted = args.slice(2)
        break
    }
    // 如果有新插入的元素，则对所有的元素进行一次遍历绑定观察者
    if (inserted) ob.observeArray(inserted)
    // notify change
    ob.dep.notify() // 对所有依赖的watcher触发notify
    return result // 返回结果
  })
})
