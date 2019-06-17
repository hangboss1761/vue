/* @flow */

import { isDef, isObject } from 'shared/util'

// 生成class属性
export function genClassForVnode (vnode: VNodeWithData): string {
  let data = vnode.data
  let parentNode = vnode
  let childNode = vnode
  while (isDef(childNode.componentInstance)) {
    childNode = childNode.componentInstance._vnode
    if (childNode && childNode.data) {
      data = mergeClassData(childNode.data, data)
    }
  }
  while (isDef(parentNode = parentNode.parent)) {
    if (parentNode && parentNode.data) {
      data = mergeClassData(data, parentNode.data)
    }
  }
  return renderClass(data.staticClass, data.class)
}

function mergeClassData (child: VNodeData, parent: VNodeData): {
  staticClass: string,
  class: any
} {
  return {
    staticClass: concat(child.staticClass, parent.staticClass),
    class: isDef(child.class)
      ? [child.class, parent.class]
      : parent.class
  }
}

// 渲染class
export function renderClass (
  staticClass: ?string,
  dynamicClass: any
): string {
  if (isDef(staticClass) || isDef(dynamicClass)) {
    // 静态class属性、动态class属性至少有一个存在
    return concat(staticClass, stringifyClass(dynamicClass))
  }
  /* istanbul ignore next */
  return ''
}

// 字符串通过 ' ' 拼接
export function concat (a: ?string, b: ?string): string {
  return a ? (b ? (a + ' ' + b) : a) : (b || '')
}

// 将动态class属性转为字符串
export function stringifyClass (value: any): string {
  if (Array.isArray(value)) { // :class为数组
    return stringifyArray(value)
  }
  if (isObject(value)) { // :class为对象
    return stringifyObject(value)
  }
  if (typeof value === 'string') { // :class为字符串
    return value
  }
  /* istanbul ignore next */
  return ''
}

// 对数组递归遍历返回通过 ' ' 拼接后的字符串
function stringifyArray (value: Array<any>): string {
  let res = ''
  let stringified
  for (let i = 0, l = value.length; i < l; i++) {
    if (isDef(stringified = stringifyClass(value[i])) && stringified !== '') {
      if (res) res += ' '
      res += stringified
    }
  }
  return res
}

// 对对象遍历返回通过 ' ' 拼接后的字符串
function stringifyObject (value: Object): string {
  let res = ''
  for (const key in value) {
    if (value[key]) {
      if (res) res += ' '
      res += key
    }
  }
  return res
}
