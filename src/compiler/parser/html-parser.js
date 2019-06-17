/**
 * Not type-checking this file because it's mostly vendor code.
 */

/*!
 * HTML Parser By John Resig (ejohn.org)
 * Modified by Juriy "kangax" Zaytsev
 * Original code by Erik Arvidsson, Mozilla Public License
 * http://erik.eae.net/simplehtmlparser/simplehtmlparser.js
 */

import { makeMap, no } from 'shared/util'
import { isNonPhrasingTag } from 'web/compiler/util'
import { unicodeRegExp } from 'core/util/lang'

// Regular Expressions for parsing tags and attributes
// 属性正则
// ^\s* 以不可见字符开头（任意次）
// ([^\s"'<>\/=]+)匹配不可见字符开头、"、'、<、>、/、=（至少一个）
// ?:非获取匹配
// \s*(=)\s* 匹配=以及前后空格换行
// "([^"]*)"+ 匹配""里的内容
// '([^']*)'+ 匹配''里的内容
// ([^\s"'=<>`]+) 匹配非不可见字符、'、"、=、<、>、`
// 例：id="app"、:id="app"、id='app'
const attribute = /^\s*([^\s"'<>\/=]+)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/
// 动态属性正则
// ^\s* 以不可见字符开头（任意次）
// (?:v-[\w-]+:|@|:|#) 匹配v- + 任意字符、-（至少一次）+ :、或@、或:、或#
// \[[^=]+\] 匹配[ + 任意不为=的字符（至少一个） + ]
// [^\s"'<>\/=]* 匹配不可见字符开头、"、'、<、>、/、=（任意次）
// \s*(=)\s* 匹配=以及前后空格换行
// "([^"]*)"+ 匹配""里的内容
// '([^']*)'+ 匹配''里的内容
// ([^\s"'=<>`]+) 匹配非不可见字符、'、"、=、<、>、`
const dynamicArgAttribute = /^\s*((?:v-[\w-]+:|@|:|#)\[[^=]+\][^\s"'<>\/=]*)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/
// [a-zA-Z_][\-\.0-9_a-zA-Za-zA-Z\u00B7\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u037D\u037F-\u1FFF\u200C-\u200D\u203F-\u2040\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]*
// ncname表示（a-zA-Z_）一次 + （-.0-9_a-zA-Z、unicode字符）任意次数
// 例：a、a-a
const ncname = `[a-zA-Z_][\\-\\.0-9_a-zA-Z${unicodeRegExp.source}]*`
// ((?:[a-zA-Z_][\-\.0-9_a-zA-Za-zA-Z\u00B7\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u037D\u037F-\u1FFF\u200C-\u200D\u203F-\u2040\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]*\:)?[a-zA-Z_][\-\.0-9_a-zA-Za-zA-Z\u00B7\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u037D\u037F-\u1FFF\u200C-\u200D\u203F-\u2040\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]*)
// 例：a、a-a、a.d
const qnameCapture = `((?:${ncname}\\:)?${ncname})`
// /^<((?:[a-zA-Z_][\-\.0-9_a-zA-Za-zA-Z\u00B7\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u037D\u037F-\u1FFF\u200C-\u200D\u203F-\u2040\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]*\:)?[a-zA-Z_][\-\.0-9_a-zA-Za-zA-Z\u00B7\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u037D\u037F-\u1FFF\u200C-\u200D\u203F-\u2040\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]*)/
// 例：<a、<a-a、<a.d（注意^是开头）
const startTagOpen = new RegExp(`^<${qnameCapture}`)
const startTagClose = /^\s*(\/?)>/
// /^<\/((?:[a-zA-Z_][\-\.0-9_a-zA-Za-zA-Z\u00B7\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u037D\u037F-\u1FFF\u200C-\u200D\u203F-\u2040\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]*\:)?[a-zA-Z_][\-\.0-9_a-zA-Za-zA-Z\u00B7\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u037D\u037F-\u1FFF\u200C-\u200D\u203F-\u2040\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]*)[^>]*>/
// 例：</a>、</a-a>、</a.d>（注意^是开头）
const endTag = new RegExp(`^<\\/${qnameCapture}[^>]*>`)
const doctype = /^<!DOCTYPE [^>]+>/i // 匹配<!DOCTYPE 任意字符>（/i忽略大小写），例：<!DOCTYPE html>
// #7298: escape - to avoid being pased as HTML comment when inlined in page
const comment = /^<!\--/ // 注释开头匹配 <!--
const conditionalComment = /^<!\[/ // 匹配CData，<![开头

// Special Elements (can contain anything)
// 纯文本元素
export const isPlainTextElement = makeMap('script,style,textarea', true)
const reCache = {}

const decodingMap = {
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&amp;': '&',
  '&#10;': '\n',
  '&#9;': '\t',
  '&#39;': "'"
}
// 匹配&lt;（<）、&gt;（>）、&quot;（"）、&amp;（&）、&#39;（'）
const encodedAttr = /&(?:lt|gt|quot|amp|#39);/g
// 匹配&lt;（<）、&gt;（>）、&quot;（"）、&amp;（&）、&#39;（'）、&#10;（\n）、&#9;（\t）
const encodedAttrWithNewLines = /&(?:lt|gt|quot|amp|#39|#10|#9);/g

// #5992
const isIgnoreNewlineTag = makeMap('pre,textarea', true)
const shouldIgnoreFirstNewline = (tag, html) => tag && isIgnoreNewlineTag(tag) && html[0] === '\n'

function decodeAttr (value, shouldDecodeNewlines) {
  const re = shouldDecodeNewlines ? encodedAttrWithNewLines : encodedAttr
  return value.replace(re, match => decodingMap[match])
}

export function parseHTML (html, options) {
  const stack = []
  const expectHTML = options.expectHTML
  const isUnaryTag = options.isUnaryTag || no
  const canBeLeftOpenTag = options.canBeLeftOpenTag || no
  let index = 0
  let last, lastTag // lastTag最后匹配到的标签

  while (html) {
    last = html
    // Make sure we're not in a plaintext content element like script/style
    if (!lastTag || !isPlainTextElement(lastTag)) {
      let textEnd = html.indexOf('<')
      if (textEnd === 0) { // 以<开头
        // Comment: 注释处理
        if (comment.test(html)) { // 判断是否为注释，匹配<!--开头
          const commentEnd = html.indexOf('-->') // 匹配第一个-->注释结尾

          if (commentEnd >= 0) { // 匹配到-->
            if (options.shouldKeepComment) { // shouldKeepComment是否保留注释
              // html.substring(4, commentEnd)是取的<!--后第一个字符
              // index + commentEnd + 3是现在的index位置 + commentEnd（注释内容最后一个内容）+ 3为-->
              options.comment(html.substring(4, commentEnd), index, index + commentEnd + 3)
            }
            // 更新index、html
            // commentEnd + 3为注释内容结尾 + -->
            advance(commentEnd + 3)
            continue
          }
        }

        // http://en.wikipedia.org/wiki/Conditional_comment#Downlevel-revealed_conditional_comment
        // 条件判断注释
        if (conditionalComment.test(html)) {
          // 这里条件判断注释直接跳过不做任何处理
          const conditionalEnd = html.indexOf(']>') // 匹配第一个]>注释结尾

          if (conditionalEnd >= 0) { // 匹配到]>
            // conditionalEnd + 2为注释内容结尾 + ]>
            advance(conditionalEnd + 2)
            continue
          }
        }

        // Doctype: 文档类型注释
        // https://developer.mozilla.org/zh-CN/docs/Web/HTML/Quirks_Mode_and_Standards_Mode
        const doctypeMatch = html.match(doctype)
        // 如果匹配到DOCTYPE注释则直接跳过，不做任何处理
        if (doctypeMatch) {
          // doctypeMatch[0].length匹配到Doctype注释的长度
          advance(doctypeMatch[0].length)
          continue
        }

        // End tag: 结束标签匹配
        const endTagMatch = html.match(endTag)
        if (endTagMatch) {
          const curIndex = index
          // endTagMatch[0].length匹配到的结束标签长度
          advance(endTagMatch[0].length)
          // endTagMatch[1]结束标签内容
          parseEndTag(endTagMatch[1], curIndex, index)
          continue
        }

        // Start tag: 标签头
        const startTagMatch = parseStartTag()
        if (startTagMatch) {
          handleStartTag(startTagMatch)
          if (shouldIgnoreFirstNewline(startTagMatch.tagName, html)) {
            advance(1)
          }
          continue
        }
      }

      let text, rest, next
      if (textEnd >= 0) {
        rest = html.slice(textEnd)
        while (
          !endTag.test(rest) &&
          !startTagOpen.test(rest) &&
          !comment.test(rest) &&
          !conditionalComment.test(rest)
        ) {
          // < in plain text, be forgiving and treat it as text
          next = rest.indexOf('<', 1)
          if (next < 0) break
          textEnd += next
          rest = html.slice(textEnd)
        }
        text = html.substring(0, textEnd)
      }

      if (textEnd < 0) {
        text = html
      }

      if (text) {
        advance(text.length)
      }

      if (options.chars && text) {
        options.chars(text, index - text.length, index)
      }
    } else {
      let endTagLength = 0
      const stackedTag = lastTag.toLowerCase()
      const reStackedTag = reCache[stackedTag] || (reCache[stackedTag] = new RegExp('([\\s\\S]*?)(</' + stackedTag + '[^>]*>)', 'i'))
      const rest = html.replace(reStackedTag, function (all, text, endTag) {
        endTagLength = endTag.length
        if (!isPlainTextElement(stackedTag) && stackedTag !== 'noscript') {
          text = text
            .replace(/<!\--([\s\S]*?)-->/g, '$1') // #7298
            .replace(/<!\[CDATA\[([\s\S]*?)]]>/g, '$1')
        }
        if (shouldIgnoreFirstNewline(stackedTag, text)) {
          text = text.slice(1)
        }
        if (options.chars) {
          options.chars(text)
        }
        return ''
      })
      index += html.length - rest.length
      html = rest
      parseEndTag(stackedTag, index - endTagLength, index)
    }

    if (html === last) {
      options.chars && options.chars(html)
      if (process.env.NODE_ENV !== 'production' && !stack.length && options.warn) {
        options.warn(`Mal-formatted tag at end of template: "${html}"`, { start: index + html.length })
      }
      break
    }
  }

  // Clean up any remaining tags
  parseEndTag()

  // 每次调用传入n表示已完成至索引n
  // 并更新当前处理文本位置index，更新html将已处理的文本删掉
  function advance (n) {
    index += n // 索引更新
    html = html.substring(n) // html更新
  }

  // 解析标签头
  function parseStartTag () {
    // 匹配标签开头
    const start = html.match(startTagOpen)
    if (start) {
      const match = {
        tagName: start[1], // 标签头
        attrs: [],
        start: index // 当前索引位置
      }
      // index更新start[0].length为 < + 标签头
      advance(start[0].length)
      let end, attr
      while (!(end = html.match(startTagClose)) && (attr = html.match(dynamicArgAttribute) || html.match(attribute))) {
        // 1、html不是以标签结束位开头
        // 2、html匹配到动态属性或属性
        attr.start = index // 当前索引位置
        // attr[0].length为匹配属性内容长度
        advance(attr[0].length)
        attr.end = index // 属性内容结束位置
        match.attrs.push(attr)
      }
      if (end) { // 匹配到标签结束位
        match.unarySlash = end[1]
        advance(end[0].length)
        match.end = index
        return match
      }
    }
  }

  // 处理标签头
  function handleStartTag (match) {
    const tagName = match.tagName // 标签头
    const unarySlash = match.unarySlash // 结束位内容

    if (expectHTML) {
      // lastTag为p标签，且非行内元素标签
      if (lastTag === 'p' && isNonPhrasingTag(tagName)) {
        parseEndTag(lastTag)
      }
      // lastTag标签与标签头相等，且tagName为canBeLeftOpenTag
      if (canBeLeftOpenTag(tagName) && lastTag === tagName) {
        parseEndTag(tagName)
      }
    }

    const unary = isUnaryTag(tagName) || !!unarySlash

    const l = match.attrs.length

    const attrs = new Array(l)
    for (let i = 0; i < l; i++) {
      const args = match.attrs[i]
      const value = args[3] || args[4] || args[5] || '' // 属性=后的内容
      const shouldDecodeNewlines = tagName === 'a' && args[1] === 'href'
        ? options.shouldDecodeNewlinesForHref
        : options.shouldDecodeNewlines
      attrs[i] = {
        name: args[1],
        value: decodeAttr(value, shouldDecodeNewlines)
      }
      if (process.env.NODE_ENV !== 'production' && options.outputSourceRange) {
        attrs[i].start = args.start + args[0].match(/^\s*/).length
        attrs[i].end = args.end
      }
    }

    if (!unary) {
      // stack添加解析后的标签对象
      stack.push({ tag: tagName, lowerCasedTag: tagName.toLowerCase(), attrs: attrs, start: match.start, end: match.end })
      lastTag = tagName // 将lastTag更新至tagName
    }

    if (options.start) {
      options.start(tagName, attrs, unary, match.start, match.end)
    }
  }

  // 解析结束标签
  function parseEndTag (tagName, start, end) {
    let pos, lowerCasedTagName
    if (start == null) start = index
    if (end == null) end = index

    // Find the closest opened tag of the same type
    if (tagName) {
      lowerCasedTagName = tagName.toLowerCase() // 小写的标签名
      // 找到最近的一个相同的开始标签（标签名一致）
      for (pos = stack.length - 1; pos >= 0; pos--) {
        if (stack[pos].lowerCasedTag === lowerCasedTagName) {
          break
        }
      }
    } else {
      // If no tag name is provided, clean shop
      pos = 0
    }

    if (pos >= 0) {
      // Close all the open elements, up the stack
      for (let i = stack.length - 1; i >= pos; i--) {
        if (process.env.NODE_ENV !== 'production' &&
          (i > pos || !tagName) &&
          options.warn
        ) {
          options.warn(
            `tag <${stack[i].tag}> has no matching end tag.`,
            { start: stack[i].start, end: stack[i].end }
          )
        }
        if (options.end) {
          options.end(stack[i].tag, start, end)
        }
      }

      // Remove the open elements from the stack
      stack.length = pos
      lastTag = pos && stack[pos - 1].tag
    } else if (lowerCasedTagName === 'br') {
      if (options.start) {
        options.start(tagName, [], true, start, end)
      }
    } else if (lowerCasedTagName === 'p') {
      if (options.start) {
        options.start(tagName, [], false, start, end)
      }
      if (options.end) {
        options.end(tagName, start, end)
      }
    }
  }
}
