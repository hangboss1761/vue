/* @flow */

import { parseText } from 'compiler/parser/text-parser'
import { parseStyleText } from 'web/util/style'
import {
  getAndRemoveAttr,
  getBindingAttr,
  baseWarn
} from 'compiler/helpers'

// 解析ASTElement对象中style相关属性
// style、:style、v-bind:style
function transformNode (el: ASTElement, options: CompilerOptions) {
  const warn = options.warn || baseWarn
  // 匹配静态的style属性并从el的attrsList中移除移除该属性
  const staticStyle = getAndRemoveAttr(el, 'style')

  if (staticStyle) {
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production') {
      const res = parseText(staticStyle, options.delimiters)
      if (res) {
        warn(
          `style="${staticStyle}": ` +
          'Interpolation inside attributes has been removed. ' +
          'Use v-bind or the colon shorthand instead. For example, ' +
          'instead of <div style="{{ val }}">, use <div :style="val">.',
          el.rawAttrsMap['style']
        )
      }
    }
    // 将静态的style属性字符串存到staticStyle字段中
    el.staticStyle = JSON.stringify(parseStyleText(staticStyle))
  }

  // 匹配动态style属性，并从attrsList中移除
  // :style、v-bind:style
  const styleBinding = getBindingAttr(el, 'style', false /* getStatic */)
  if (styleBinding) {
    // 将匹配到的动态style属性存到styleBinding字段中
    el.styleBinding = styleBinding
  }
}

function genData (el: ASTElement): string {
  let data = ''
  if (el.staticStyle) {
    data += `staticStyle:${el.staticStyle},`
  }
  if (el.styleBinding) {
    data += `style:(${el.styleBinding}),`
  }
  return data
}

export default {
  staticKeys: ['staticStyle'],
  transformNode,
  genData
}
