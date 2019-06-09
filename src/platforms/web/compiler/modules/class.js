/* @flow */

import { parseText } from 'compiler/parser/text-parser'
import {
  getAndRemoveAttr,
  getBindingAttr,
  baseWarn
} from 'compiler/helpers'

// 解析AST Element对象的class相关属性
// class、:class、v-bind:class
function transformNode (el: ASTElement, options: CompilerOptions) {
  const warn = options.warn || baseWarn
  // 将el中的class属性从attrsList中移除
  // staticClass为移除的class属性
  const staticClass = getAndRemoveAttr(el, 'class')

  if (process.env.NODE_ENV !== 'production' && staticClass) {
    const res = parseText(staticClass, options.delimiters)
    if (res) {
      warn(
        `class="${staticClass}": ` +
        'Interpolation inside attributes has been removed. ' +
        'Use v-bind or the colon shorthand instead. For example, ' +
        'instead of <div class="{{ val }}">, use <div :class="val">.',
        el.rawAttrsMap['class']
      )
    }
  }
  if (staticClass) {
    // 将class属性对象存成字符串
    el.staticClass = JSON.stringify(staticClass)
  }
  // 获取绑定的class属性，并从attrsList中移除
  // :class和v-bind:class两个属性
  const classBinding = getBindingAttr(el, 'class', false /* getStatic */)

  if (classBinding) {
    // 如果有动态class则存到el.classBinding中
    el.classBinding = classBinding
  }
}

function genData (el: ASTElement): string {
  let data = ''
  if (el.staticClass) {
    data += `staticClass:${el.staticClass},`
  }
  if (el.classBinding) {
    data += `class:${el.classBinding},`
  }
  return data
}

export default {
  staticKeys: ['staticClass'],
  transformNode,
  genData
}
