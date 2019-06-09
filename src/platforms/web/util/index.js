/* @flow */

import { warn } from 'core/util/index'

export * from './attrs'
export * from './class'
export * from './element'

/**
 * Query an element selector if it's not an element already.
 */
// 查询DOM元素
export function query (el: string | Element): Element {
  if (typeof el === 'string') {
    // 如果参数为字符串则使用querySelector查询
    const selected = document.querySelector(el)
    if (!selected) {
      // 如果不存在指定的DOM则报错
      process.env.NODE_ENV !== 'production' && warn(
        'Cannot find element: ' + el
      )
      // 报错返回一个新建的div元素（保证始终返回一个DOM元素）
      return document.createElement('div')
    }
    return selected
  } else {
    // 如果参数是一个DOM元素则直接返回该参数
    return el
  }
}
