/* @flow */

import he from 'he'
import { parseHTML } from './html-parser'
import { parseText } from './text-parser'
import { parseFilters } from './filter-parser'
import { genAssignmentCode } from '../directives/model'
import { extend, cached, no, camelize, hyphenate } from 'shared/util'
import { isIE, isEdge, isServerRendering } from 'core/util/env'

import {
  addProp,
  addAttr,
  baseWarn,
  addHandler,
  addDirective,
  getBindingAttr,
  getAndRemoveAttr,
  getRawBindingAttr,
  pluckModuleFunction,
  getAndRemoveAttrByRegex
} from '../helpers'

// 匹配@、v-on开头
export const onRE = /^@|^v-on:/
export const dirRE = process.env.VBIND_PROP_SHORTHAND
  // 匹配v-、@、:、.开头
  ? /^v-|^@|^:|^\./
  // 匹配v-、@、:开头
  : /^v-|^@|^:/

// v-for属性值的正则匹配
// ([\s\S]*?) 非贪婪模式匹配全部字符（不可见字符、可见字符任意次）
// \s+ 不可见字符（至少一次）
// (?:in|of) 匹配in或of
// \s+ 不可见字符（至少一次）
// ([\s\S]*) 非贪婪模式匹配全部字符（不可见字符、可见字符任意次）
// 例：item in list
export const forAliasRE = /([\s\S]*?)\s+(?:in|of)\s+([\s\S]*)/
// ,([^,\}\]]*) 匹配 , + ^,}]（任意个）
// 例：item,index、a,b,c
export const forIteratorRE = /,([^,\}\]]*)(?:,([^,\}\]]*))?$/
// 匹配()
const stripParensRE = /^\(|\)$/g
// 匹配[ + 任意字符（任意个） + ]
// 例：[abc]
const dynamicArgRE = /^\[.*\]$/
// 匹配 :
// 例：a:b、a:、:b
const argRE = /:(.*)$/
// v-bind正则
// 匹配:、.、v-bind:开头
// 例：:newKey、.newKey、v-bind:newKey
export const bindRE = /^:|^\.|^v-bind:/
// 匹配：.开头
// 例：.abc
const propBindRE = /^\./
// 匹配. + 任意字符 + 非]字符（修饰符）
// 例：a.abc
const modifierRE = /\.[^.\]]+(?=[^\]]*$)/g
// 匹配v-slot
// 例：v-slot:abc、v-slot
const slotRE = /^v-slot(:|$)|^#/

const lineBreakRE = /[\r\n]/
const whitespaceRE = /\s+/g

// 匹配无效属性
const invalidAttributeRE = /[\s"'<>\/=]/

const decodeHTMLCached = cached(he.decode)
// 默认slot scope
export const emptySlotScopeToken = `_empty_`

// configurable state
export let warn: any
let delimiters
let transforms
let preTransforms
let postTransforms
let platformIsPreTag
let platformMustUseProp
let platformGetTagNamespace
let maybeComponent

// 创建AST元素
export function createASTElement (
  tag: string,
  attrs: Array<ASTAttr>,
  parent: ASTElement | void
): ASTElement {
  return {
    type: 1,
    tag, // 标签名
    attrsList: attrs, // 标签上属性列表
    attrsMap: makeAttrsMap(attrs), // 属性列表的Map格式
    rawAttrsMap: {},
    parent, // 元素父级
    children: [] // 元素子集
  }
}

/**
 * Convert HTML string to AST.
 */
export function parse (
  template: string,
  options: CompilerOptions
): ASTElement | void {
  warn = options.warn || baseWarn

  platformIsPreTag = options.isPreTag || no
  platformMustUseProp = options.mustUseProp || no
  platformGetTagNamespace = options.getTagNamespace || no
  const isReservedTag = options.isReservedTag || no
  // 判断el是否为vue实例，通过component字段存在 && 非保留标签
  maybeComponent = (el: ASTElement) => !!el.component || !isReservedTag(el.tag)

  transforms = pluckModuleFunction(options.modules, 'transformNode')
  preTransforms = pluckModuleFunction(options.modules, 'preTransformNode')
  postTransforms = pluckModuleFunction(options.modules, 'postTransformNode')

  delimiters = options.delimiters

  const stack = []
  const preserveWhitespace = options.preserveWhitespace !== false
  const whitespaceOption = options.whitespace
  let root
  let currentParent
  let inVPre = false
  let inPre = false
  let warned = false

  function warnOnce (msg, range) {
    if (!warned) {
      warned = true
      warn(msg, range)
    }
  }

  // 关闭元素
  // 1、向父级的children添加该元素
  // 2、该元素的parent指向父级
  function closeElement (element) {
    trimEndingWhitespace(element)
    if (!inVPre && !element.processed) {
      // 解析ASTElement元素
      element = processElement(element, options)
    }

    // tree management
    if (!stack.length && element !== root) {
      // allow root elements with v-if, v-else-if and v-else
      if (root.if && (element.elseif || element.else)) {
        if (process.env.NODE_ENV !== 'production') {
          checkRootConstraints(element)
        }
        addIfCondition(root, {
          exp: element.elseif,
          block: element
        })
      } else if (process.env.NODE_ENV !== 'production') {
        warnOnce(
          `Component template should contain exactly one root element. ` +
          `If you are using v-if on multiple elements, ` +
          `use v-else-if to chain them instead.`,
          { start: element.start }
        )
      }
    }

    if (currentParent && !element.forbidden) {
      if (element.elseif || element.else) {
        processIfConditions(element, currentParent)
      } else {
        if (element.slotScope) {
          // scoped slot
          // keep it in the children list so that v-else(-if) conditions can
          // find it as the prev node.
          const name = element.slotTarget || '"default"'
          ;(currentParent.scopedSlots || (currentParent.scopedSlots = {}))[name] = element
        }
        currentParent.children.push(element)
        element.parent = currentParent
      }
    }

    // final children cleanup
    // filter out scoped slots
    element.children = element.children.filter(c => !(c: any).slotScope)
    // remove trailing whitespace node again
    trimEndingWhitespace(element)

    // check pre state
    if (element.pre) {
      inVPre = false
    }
    if (platformIsPreTag(element.tag)) {
      inPre = false
    }

    // apply post-transforms
    for (let i = 0; i < postTransforms.length; i++) {
      postTransforms[i](element, options)
    }
  }

  function trimEndingWhitespace (el) {
    // remove trailing whitespace node
    if (!inPre) { // 不在pre标签中
      let lastNode
      while (
        (lastNode = el.children[el.children.length - 1]) &&
        lastNode.type === 3 &&
        lastNode.text === ' '
      ) {
        el.children.pop()
      }
    }
  }

  function checkRootConstraints (el) {
    if (el.tag === 'slot' || el.tag === 'template') {
      warnOnce(
        `Cannot use <${el.tag}> as component root element because it may ` +
        'contain multiple nodes.',
        { start: el.start }
      )
    }
    if (el.attrsMap.hasOwnProperty('v-for')) {
      warnOnce(
        'Cannot use v-for on stateful component root element because ' +
        'it renders multiple elements.',
        el.rawAttrsMap['v-for']
      )
    }
  }

  parseHTML(template, {
    warn,
    expectHTML: options.expectHTML,
    isUnaryTag: options.isUnaryTag,
    canBeLeftOpenTag: options.canBeLeftOpenTag,
    shouldDecodeNewlines: options.shouldDecodeNewlines,
    shouldDecodeNewlinesForHref: options.shouldDecodeNewlinesForHref,
    shouldKeepComment: options.comments,
    outputSourceRange: options.outputSourceRange,
    start (tag, attrs, unary, start, end) {
      // check namespace.
      // inherit parent ns if there is one
      const ns = (currentParent && currentParent.ns) || platformGetTagNamespace(tag)
      // handle IE svg bug
      /* istanbul ignore if */
      // IE下svg属性bug，需要将属性格式化
      if (isIE && ns === 'svg') {
        attrs = guardIESVGBug(attrs)
      }

      // 创建AST元素
      let element: ASTElement = createASTElement(tag, attrs, currentParent)
      if (ns) {
        element.ns = ns
      }

      if (process.env.NODE_ENV !== 'production') {
        if (options.outputSourceRange) {
          element.start = start
          element.end = end
          element.rawAttrsMap = element.attrsList.reduce((cumulated, attr) => {
            cumulated[attr.name] = attr
            return cumulated
          }, {})
        }
        attrs.forEach(attr => {
          // 属性名不能包含空格、引号、<、>、/、=
          if (invalidAttributeRE.test(attr.name)) {
            warn(
              `Invalid dynamic argument expression: attribute names cannot contain ` +
              `spaces, quotes, <, >, / or =.`,
              {
                start: attr.start + attr.name.indexOf(`[`),
                end: attr.start + attr.name.length
              }
            )
          }
        })
      }

      if (isForbiddenTag(element) && !isServerRendering()) {
        // 1、element元素为非有效标签元素（script、style标签）
        // 2、当前非服务端渲染
        // 将元素forbidden字段置为true
        // 在非生产环境下报错
        element.forbidden = true
        process.env.NODE_ENV !== 'production' && warn(
          'Templates should only be responsible for mapping the state to the ' +
          'UI. Avoid placing tags with side-effects in your templates, such as ' +
          `<${tag}>` + ', as they will not be parsed.',
          { start: element.start }
        )
      }

      // apply pre-transforms
      for (let i = 0; i < preTransforms.length; i++) {
        // 解析v-model
        element = preTransforms[i](element, options) || element
      }

      if (!inVPre) {
        // 解析v-pre属性
        // https://cn.vuejs.org/v2/api/#v-pre
        processPre(element)
        if (element.pre) {
          inVPre = true // pre标志
        }
      }

      // 判断是否为pre标签
      if (platformIsPreTag(element.tag)) {
        inPre = true
      }

      if (inVPre) { // 含有v-pre属性
        // 直接拷贝
        processRawAttrs(element)
      } else if (!element.processed) {
        // structural directives
        // 解析v-for
        processFor(element)
        // 解析v-if
        processIf(element)
        // 解析v-once
        processOnce(element)
      }

      if (!root) {
        root = element
        if (process.env.NODE_ENV !== 'production') {
          checkRootConstraints(root)
        }
      }

      if (!unary) { // 非自闭合标签
        currentParent = element
        // 将当前元素push到栈中
        stack.push(element)
      } else { // 自闭合标签
        closeElement(element)
      }
    },

    end (tag, start, end) {
      const element = stack[stack.length - 1]
      // pop stack
      stack.length -= 1
      currentParent = stack[stack.length - 1]
      if (process.env.NODE_ENV !== 'production' && options.outputSourceRange) {
        element.end = end
      }
      closeElement(element)
    },

    chars (text: string, start: number, end: number) {
      if (!currentParent) {
        if (process.env.NODE_ENV !== 'production') {
          if (text === template) {
            warnOnce(
              'Component template requires a root element, rather than just text.',
              { start }
            )
          } else if ((text = text.trim())) {
            warnOnce(
              `text "${text}" outside root element will be ignored.`,
              { start }
            )
          }
        }
        return
      }
      // IE textarea placeholder bug
      /* istanbul ignore if */
      if (isIE &&
        currentParent.tag === 'textarea' &&
        currentParent.attrsMap.placeholder === text
      ) {
        return
      }
      const children = currentParent.children
      if (inPre || text.trim()) {
        text = isTextTag(currentParent) ? text : decodeHTMLCached(text)
      } else if (!children.length) {
        // remove the whitespace-only node right after an opening tag
        text = ''
      } else if (whitespaceOption) {
        if (whitespaceOption === 'condense') {
          // in condense mode, remove the whitespace node if it contains
          // line break, otherwise condense to a single space
          text = lineBreakRE.test(text) ? '' : ' '
        } else {
          text = ' '
        }
      } else {
        text = preserveWhitespace ? ' ' : ''
      }
      if (text) {
        if (!inPre && whitespaceOption === 'condense') {
          // condense consecutive whitespaces into single space
          text = text.replace(whitespaceRE, ' ')
        }
        let res
        let child: ?ASTNode
        if (!inVPre && text !== ' ' && (res = parseText(text, delimiters))) {
          child = {
            type: 2,
            expression: res.expression,
            tokens: res.tokens,
            text
          }
        } else if (text !== ' ' || !children.length || children[children.length - 1].text !== ' ') {
          child = {
            type: 3,
            text
          }
        }
        if (child) {
          if (process.env.NODE_ENV !== 'production' && options.outputSourceRange) {
            child.start = start
            child.end = end
          }
          children.push(child)
        }
      }
    },

    // 注释处理
    comment (text: string, start, end) {
      // adding anything as a sibling to the root node is forbidden
      // comments should still be allowed, but ignored
      if (currentParent) {
        const child: ASTText = {
          type: 3,
          text,
          isComment: true
        }
        if (process.env.NODE_ENV !== 'production' && options.outputSourceRange) {
          child.start = start
          child.end = end
        }
        currentParent.children.push(child)
      }
    }
  })

  return root
}

// 解析v-pre属性
function processPre (el) {
  // 移除v-pre属性，并将el.pre标志置为true
  if (getAndRemoveAttr(el, 'v-pre') != null) {
    el.pre = true
  }
}

// 初始化attrs属性
function processRawAttrs (el) {
  const list = el.attrsList
  const len = list.length
  if (len) { // attrsList不为空
    // 初始化attrs属性
    // 将attrsList
    const attrs: Array<ASTAttr> = el.attrs = new Array(len)
    for (let i = 0; i < len; i++) {
      attrs[i] = {
        name: list[i].name,
        value: JSON.stringify(list[i].value)
      }
      if (list[i].start != null) {
        attrs[i].start = list[i].start
        attrs[i].end = list[i].end
      }
    }
  } else if (!el.pre) {
    // non root node in pre blocks with no attributes
    el.plain = true
  }
}

// 解析ASTElement元素
export function processElement (
  element: ASTElement,
  options: CompilerOptions
) {
  // 解析key属性
  processKey(element)

  // determine whether this is a plain element after
  // removing structural attributes
  element.plain = (
    !element.key &&
    !element.scopedSlots &&
    !element.attrsList.length
  )

  // 解析ref属性
  processRef(element)
  // 解析slot、v-slot、slot-scope、scope属性
  processSlotContent(element)
  // 解析slot标签
  processSlotOutlet(element)
  // 解析is属性
  processComponent(element)
  // 解析class、style属性以及动态属性
  for (let i = 0; i < transforms.length; i++) {
    element = transforms[i](element, options) || element
  }
  // 解析其它属性
  processAttrs(element)
  return element
}

// 解析key属性
function processKey (el) {
  // 获取el的v-bind:key、:key属性，并从attrsList中移除返回
  const exp = getBindingAttr(el, 'key')
  if (exp) {
    if (process.env.NODE_ENV !== 'production') {
      // tag上不能加key
      if (el.tag === 'template') {
        warn(
          `<template> cannot be keyed. Place the key on real elements instead.`,
          getRawBindingAttr(el, 'key')
        )
      }
      if (el.for) { // 标签有v-for属性
        const iterator = el.iterator2 || el.iterator1 // 取索引值，优先第三个参数，其次是第二个参数
        const parent = el.parent // 元素父级
        if (iterator && iterator === exp && parent && parent.tag === 'transition-group') {
          // 1、v-for有索引值
          // 2、key绑定的就是索引值
          // 3、父级为transition-group
          // 会报错
          warn(
            `Do not use v-for index as key on <transition-group> children, ` +
            `this is the same as not using keys.`,
            getRawBindingAttr(el, 'key'),
            true /* tip */
          )
        }
      }
    }
    // 将key值赋予el上
    el.key = exp
  }
}

// 解析ref属性
function processRef (el) {
  // 获取:ref、v-bind:ref属性对应的属性值，并从el的attrsList中移除该属性
  const ref = getBindingAttr(el, 'ref')
  if (ref) {
    el.ref = ref // 将匹配到的ref值赋值到el.ref上
    el.refInFor = checkInFor(el) // 判断当前元素是否在for循环中
  }
}

// 解析v-for
export function processFor (el: ASTElement) {
  let exp
  // 获取v-for属性对应的属性值，并从el的attrsList中移除该属性
  if ((exp = getAndRemoveAttr(el, 'v-for'))) { // 存在v-for属性
    const res = parseFor(exp)
    if (res) {
      // 将v-for解析后的结果拷贝得到el
      extend(el, res)
    } else if (process.env.NODE_ENV !== 'production') {
      warn(
        `Invalid v-for expression: ${exp}`,
        el.rawAttrsMap['v-for']
      )
    }
  }
}

type ForParseResult = {
  for: string;
  alias: string;
  iterator1?: string;
  iterator2?: string;
};

// v-for使用有三种
// 1、item in obj
// 2、(item, index) in obj
// 3、(value, key, index) in obj
export function parseFor (exp: string): ?ForParseResult {
  // 解析v-for属性值
  const inMatch = exp.match(forAliasRE)
  if (!inMatch) return // 没有匹配到返回
  const res = {}
  res.for = inMatch[2].trim() // 循环的列表\对象名
  const alias = inMatch[1].trim().replace(stripParensRE, '') // in/of前部的表达式将()去掉
  const iteratorMatch = alias.match(forIteratorRE) // 解析alias匹配第二及后面的参数
  if (iteratorMatch) {
    res.alias = alias.replace(forIteratorRE, '').trim() // 取第一个参数名
    res.iterator1 = iteratorMatch[1].trim() // 第二个参数名
    if (iteratorMatch[2]) { // 如果存在第三个参数，则取第三个参数名
      res.iterator2 = iteratorMatch[2].trim()
    }
  } else {
    // 如果只有一个参数则直接取
    res.alias = alias
  }
  return res
}

// 解析v-if属性
function processIf (el) {
  // 获取v-if属性对应的属性值，并从el的attrsList中移除该属性
  const exp = getAndRemoveAttr(el, 'v-if')
  if (exp) { // 存在v-if
    el.if = exp // 将属性值赋值给if字段
    addIfCondition(el, {
      exp: exp,
      block: el
    })
  } else {
    if (getAndRemoveAttr(el, 'v-else') != null) {
      el.else = true
    }
    const elseif = getAndRemoveAttr(el, 'v-else-if')
    if (elseif) {
      el.elseif = elseif
    }
  }
}

function processIfConditions (el, parent) {
  const prev = findPrevElement(parent.children)
  if (prev && prev.if) {
    addIfCondition(prev, {
      exp: el.elseif,
      block: el
    })
  } else if (process.env.NODE_ENV !== 'production') {
    warn(
      `v-${el.elseif ? ('else-if="' + el.elseif + '"') : 'else'} ` +
      `used on element <${el.tag}> without corresponding v-if.`,
      el.rawAttrsMap[el.elseif ? 'v-else-if' : 'v-else']
    )
  }
}

function findPrevElement (children: Array<any>): ASTElement | void {
  let i = children.length
  while (i--) {
    if (children[i].type === 1) {
      return children[i]
    } else {
      if (process.env.NODE_ENV !== 'production' && children[i].text !== ' ') {
        warn(
          `text "${children[i].text.trim()}" between v-if and v-else(-if) ` +
          `will be ignored.`,
          children[i]
        )
      }
      children.pop()
    }
  }
}

// 添加if表达式，并初始化ifConditions属性
export function addIfCondition (el: ASTElement, condition: ASTIfCondition) {
  if (!el.ifConditions) {
    el.ifConditions = []
  }
  el.ifConditions.push(condition)
}

// 解析v-once属性
// https://cn.vuejs.org/v2/api/#v-once
function processOnce (el) {
  // 移除v-once属性，并将once标志置为true
  const once = getAndRemoveAttr(el, 'v-once')
  if (once != null) {
    el.once = true
  }
}

// handle content being passed to a component as slot,
// e.g. <template slot="xxx">, <div slot-scope="xxx">
// 解析slot部分
function processSlotContent (el) {
  let slotScope
  if (el.tag === 'template') { // 当元素为template
    // 从el中获取scope属性，并从attrsList中移除该属性
    slotScope = getAndRemoveAttr(el, 'scope')
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && slotScope) {
      // 提示scope属性已经被废弃了
      warn(
        `the "scope" attribute for scoped slots have been deprecated and ` +
        `replaced by "slot-scope" since 2.5. The new "slot-scope" attribute ` +
        `can also be used on plain elements in addition to <template> to ` +
        `denote scoped slots.`,
        el.rawAttrsMap['scope'],
        true
      )
    }
    // el slotScope字段为scope属性或slot-scope属性
    el.slotScope = slotScope || getAndRemoveAttr(el, 'slot-scope')
  } else if ((slotScope = getAndRemoveAttr(el, 'slot-scope'))) { // 如果el中包含slot-scope属性
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && el.attrsMap['v-for']) {
      // v-for和slot-scope不推荐放到一起
      warn(
        `Ambiguous combined usage of slot-scope and v-for on <${el.tag}> ` +
        `(v-for takes higher priority). Use a wrapper <template> for the ` +
        `scoped slot to make it clearer.`,
        el.rawAttrsMap['slot-scope'],
        true
      )
    }
    // el slotScope字段为slot-scope属性
    el.slotScope = slotScope
  }

  // slot="xxx"
  // 获取:slot或v-bind:slot属性，并从attrsList中移除该属性
  const slotTarget = getBindingAttr(el, 'slot')
  if (slotTarget) { // 包含slot-scope属性
    // 如果:slot属性值为空字符串，则默认置为default
    el.slotTarget = slotTarget === '""' ? '"default"' : slotTarget
    // slotTargetDynamic为动态slot存在标记位
    el.slotTargetDynamic = !!(el.attrsMap[':slot'] || el.attrsMap['v-bind:slot'])
    // preserve slot as an attribute for native shadow DOM compat
    // only for non-scoped slots.
    if (el.tag !== 'template' && !el.slotScope) {
      // 1、el不为template
      // 2、el不存在slotScope字段
      // el添加slot属性，并将el置为非纯元素（plain置为false）
      addAttr(el, 'slot', slotTarget, getRawBindingAttr(el, 'slot'))
    }
  }

  // 2.6 v-slot syntax
  if (process.env.NEW_SLOT_SYNTAX) {
    if (el.tag === 'template') { // v-slot在template
      // v-slot on <template>
      // 从el的attrsList中匹配v-slot属性，并从中移除
      const slotBinding = getAndRemoveAttrByRegex(el, slotRE)
      if (slotBinding) { // 存在v-slot
        if (process.env.NODE_ENV !== 'production') {
          if (el.slotTarget || el.slotScope) {
            // el上既存在scope-slot，也存在v-slot报错
            warn(
              `Unexpected mixed usage of different slot syntaxes.`,
              el
            )
          }
          if (el.parent && !maybeComponent(el.parent)) {
            // el有父级，且el的父级不是组件则报错
            warn(
              `<template v-slot> can only appear at the root level inside ` +
              `the receiving the component`,
              el
            )
          }
        }
        // 获取slot name
        const { name, dynamic } = getSlotName(slotBinding)
        el.slotTarget = name
        el.slotTargetDynamic = dynamic
        el.slotScope = slotBinding.value || emptySlotScopeToken // force it into a scoped slot for perf
      }
    } else {
      // v-slot on component, denotes default slot
      // 从el的attrsList中匹配v-slot属性，并从中移除
      const slotBinding = getAndRemoveAttrByRegex(el, slotRE)
      if (slotBinding) { // 存在v-slot
        if (process.env.NODE_ENV !== 'production') {
          if (!maybeComponent(el)) {
            // el不是组件则报错
            warn(
              `v-slot can only be used on components or <template>.`,
              slotBinding
            )
          }
          if (el.slotScope || el.slotTarget) {
            // el上既存在scope-slot，也存在v-slot报错
            warn(
              `Unexpected mixed usage of different slot syntaxes.`,
              el
            )
          }
          if (el.scopedSlots) {
            // el上既存在scopedSlots，也存在v-slot报错
            warn(
              `To avoid scope ambiguity, the default slot should also use ` +
              `<template> syntax when there are other named slots.`,
              slotBinding
            )
          }
        }
        // add the component's children to its default slot
        const slots = el.scopedSlots || (el.scopedSlots = {}) // 将el.scopedSlots初始化为空对象
        // 获取slot name
        const { name, dynamic } = getSlotName(slotBinding)
        // 创建一个新的ASTElement，且为template标签，它的父级为el
        // 并将新的ASTElement赋值到el.scopedSlots的name字段
        const slotContainer = slots[name] = createASTElement('template', [], el)
        slotContainer.slotTarget = name
        slotContainer.slotTargetDynamic = dynamic
        slotContainer.children = el.children.filter((c: any) => {
          // 对el的子集遍历，且子集没有slotScope字段的更改其父级为新的ASTElement
          // 并将其放到新的ASTElement的children中
          // （不包含v-slot、slot属性）
          if (!c.slotScope) {
            c.parent = slotContainer
            return true
          }
        })
        slotContainer.slotScope = slotBinding.value || emptySlotScopeToken
        // remove children as they are returned from scopedSlots now
        el.children = [] // 将el的children置空
        // mark el non-plain so data gets generated
        el.plain = false // 将el置为非纯元素
      }
    }
  }
}

// 获取slot name
function getSlotName (binding) {
  // 通过正则将v-slot替换为空字符串
  // 例：v-slot:abc => abc、v-slot => ''、# => ''、#abc => abc
  let name = binding.name.replace(slotRE, '')
  if (!name) { // 替换后为空字符串
    if (binding.name[0] !== '#') {
      // 匹配前name不是以#开头，则将name置为default
      name = 'default'
    } else if (process.env.NODE_ENV !== 'production') {
      // 使用#开头必须要指定slot name
      warn(
        `v-slot shorthand syntax requires a slot name.`,
        binding
      )
    }
  }
  // 判断name是否被[]包裹
  return dynamicArgRE.test(name)
    // dynamic [name]
    // 取[]中间的字符串，并将dynamic动态标志置为true
    ? { name: name.slice(1, -1), dynamic: true }
    // static name
    // name用"包裹，并将dynamic动态标志置为false
    : { name: `"${name}"`, dynamic: false }
}

// handle <slot/> outlets
// 解析slot标签
function processSlotOutlet (el) {
  if (el.tag === 'slot') { // el为slot标签
    // 获取el的v-bind:name、:name属性，并从attrsList中移除
    // 将移除的属性值赋值给slotName
    el.slotName = getBindingAttr(el, 'name')
    if (process.env.NODE_ENV !== 'production' && el.key) {
      // el如果绑定了key保存，slot标签不能加v-bind:key
      warn(
        `\`key\` does not work on <slot> because slots are abstract outlets ` +
        `and can possibly expand into multiple elements. ` +
        `Use the key on a wrapping element instead.`,
        getRawBindingAttr(el, 'key')
      )
    }
  }
}

// 解析is属性
function processComponent (el) {
  let binding
  // 获取el的v-bind:is、:is属性，并从attrsList中移除返回
  // https://cn.vuejs.org/v2/guide/components-edge-cases.html#%E5%86%85%E8%81%94%E6%A8%A1%E6%9D%BF
  if ((binding = getBindingAttr(el, 'is'))) {
    el.component = binding // is属性值赋值给el的component字段
  }
  // 获取el的inline-template属性，并从attrsList中移除返回
  // https://cn.vuejs.org/v2/guide/components-edge-cases.html#%E5%86%85%E8%81%94%E6%A8%A1%E6%9D%BF
  if (getAndRemoveAttr(el, 'inline-template') != null) {
    // 如果inline-template属性不为空，则将el的inlineTemplate标志位置为true
    el.inlineTemplate = true
  }
}

// 解析属性值（包括修饰符）
// v-、@、:
function processAttrs (el) {
  const list = el.attrsList
  let i, l, name, rawName, value, modifiers, syncGen, isDynamic
  for (i = 0, l = list.length; i < l; i++) { // 对el的attrsList遍历
    name = rawName = list[i].name
    value = list[i].value
    if (dirRE.test(name)) { // 属性名以v-、@、:开头
      // mark element as dynamic
      el.hasBindings = true // el的hasBindings标志位置为true，代表有绑定属性
      // modifiers
      // name.replace(dirRE, '')移除v-、@、:
      // 解析修饰符
      modifiers = parseModifiers(name.replace(dirRE, ''))
      // support .foo shorthand syntax for the .prop modifier
      if (process.env.VBIND_PROP_SHORTHAND && propBindRE.test(name)) {
        (modifiers || (modifiers = {})).prop = true
        name = `.` + name.slice(1).replace(modifierRE, '')
      } else if (modifiers) {
        // 如果有修饰符，则将name中的修饰符去掉
        name = name.replace(modifierRE, '')
      }
      if (bindRE.test(name)) { // 匹配v-bind
        name = name.replace(bindRE, '') // name移除v-bind相关开头字符
        value = parseFilters(value) // 解析过滤器并返回转义后的表达式
        isDynamic = dynamicArgRE.test(name) // 判断是否为动态属性名（被[]包裹）
        if (isDynamic) {
          name = name.slice(1, -1) // 移除[]
        }
        if (
          process.env.NODE_ENV !== 'production' &&
          value.trim().length === 0
        ) {
          // 属性对应的value为空提示报错
          warn(
            `The value for a v-bind expression cannot be empty. Found in "v-bind:${name}"`
          )
        }
        if (modifiers) { // 属性值有修饰符
          if (modifiers.prop && !isDynamic) {
            name = camelize(name)
            if (name === 'innerHtml') name = 'innerHTML'
          }
          if (modifiers.camel && !isDynamic) {
            // 非动态属性名，且设置了.camel修饰符
            // 将name由 连词符- 改为 驼峰格式
            name = camelize(name)
          }
          if (modifiers.sync) { // 设置了sync修饰符
            syncGen = genAssignmentCode(value, `$event`)
            if (!isDynamic) { // 非动态属性名
              // 添加events事件（使用驼峰格式name）
              addHandler(
                el,
                `update:${camelize(name)}`,
                syncGen,
                null,
                false,
                warn,
                list[i]
              )
              if (hyphenate(name) !== camelize(name)) {
                // 驼峰格式 与 连词符格式 不等时，
                // 添加events事件（使用连词符格式name）
                // （相等时表示没有大小写、没有连词符）
                addHandler(
                  el,
                  `update:${hyphenate(name)}`,
                  syncGen,
                  null,
                  false,
                  warn,
                  list[i]
                )
              }
            } else {
              // handler w/ dynamic event name
              // 动态属性名时，注意传入的name不同
              addHandler(
                el,
                `"update:"+(${name})`,
                syncGen,
                null,
                false,
                warn,
                list[i],
                true // dynamic
              )
            }
          }
        }

        if ((modifiers && modifiers.prop) || (
          !el.component && platformMustUseProp(el.tag, el.attrsMap.type, name)
        )) {
          // 1、修饰符包含prop
          // 2、el为必须使用prop元素
          // 将属性作为prop存到el的props中
          addProp(el, name, value, list[i], isDynamic)
        } else {
          // 其它情况则认为是属性
          // 存入el的attrs/dynamicAttrs中
          addAttr(el, name, value, list[i], isDynamic)
        }
      } else if (onRE.test(name)) { // 匹配v-on、@
        name = name.replace(onRE, '') // 移除v-on、@
        isDynamic = dynamicArgRE.test(name) // 动态事件名
        if (isDynamic) {
          name = name.slice(1, -1) // 取动态事件名
        }
        // 添加到events中
        addHandler(el, name, value, modifiers, false, warn, list[i], isDynamic)
      } else { // normal directives
        name = name.replace(dirRE, '') // 移除v-、@、:、.开头
        // parse arg
        const argMatch = name.match(argRE)
        let arg = argMatch && argMatch[1] // 匹配到:后的字符串
        isDynamic = false
        if (arg) {
          name = name.slice(0, -(arg.length + 1)) // 返回:前的字符串
          if (dynamicArgRE.test(arg)) { // 判断是否为动态属性名
            arg = arg.slice(1, -1) // 动态属性名
            isDynamic = true // 动态属性标志为true
          }
        }
        // 加入到directives属性中
        addDirective(el, name, rawName, value, arg, isDynamic, modifiers, list[i])
        if (process.env.NODE_ENV !== 'production' && name === 'model') {
          checkForAliasModel(el, value)
        }
      }
    } else {
      // 属性名不是以v-、@、:开头
      // literal attribute
      if (process.env.NODE_ENV !== 'production') {
        const res = parseText(value, delimiters)
        if (res) {
          warn(
            `${name}="${value}": ` +
            'Interpolation inside attributes has been removed. ' +
            'Use v-bind or the colon shorthand instead. For example, ' +
            'instead of <div id="{{ val }}">, use <div :id="val">.',
            list[i]
          )
        }
      }
      // 直接添加到attrs数组中
      addAttr(el, name, JSON.stringify(value), list[i])
      // #6887 firefox doesn't update muted state if set via attribute
      // even immediately after element creation
      // 元素创建后立即设置muted属性，在firefox中不会更新muted属性
      if (!el.component &&
          name === 'muted' &&
          platformMustUseProp(el.tag, el.attrsMap.type, name)) {
        // https://developer.mozilla.org/zh-CN/docs/Web/HTML/Element/video
        // 向prop中添加muted
        addProp(el, name, 'true', list[i])
      }
    }
  }
}

// 判断el是否在for循环中
function checkInFor (el: ASTElement): boolean {
  let parent = el
  // 逐层遍历父级，判断父级的for属性是否存在
  while (parent) {
    if (parent.for !== undefined) {
      return true
    }
    parent = parent.parent
  }
  return false
}

// 解析修饰符
function parseModifiers (name: string): Object | void {
  const match = name.match(modifierRE) // 匹配修饰符（.以及后面的字符）
  if (match) {
    const ret = {}
    // 对匹配结果遍历
    // m.slice(1)取.后面的字符并设为ret的key，value为true
    match.forEach(m => { ret[m.slice(1)] = true })
    return ret
  }
}

// 创建属性Map对象
function makeAttrsMap (attrs: Array<Object>): Object {
  const map = {}
  for (let i = 0, l = attrs.length; i < l; i++) {
    if (
      process.env.NODE_ENV !== 'production' &&
      map[attrs[i].name] && !isIE && !isEdge
    ) {
      // 在非生产环境、非IE、非Edge环境中，如果属性名的key已经存在，则报异常
      warn('duplicate attribute: ' + attrs[i].name, attrs[i])
    }
    // map的key、value赋值
    map[attrs[i].name] = attrs[i].value
  }
  return map
}

// for script (e.g. type="x/template") or style, do not decode content
// 是否为文本标签
function isTextTag (el): boolean {
  // script标签、style标签
  return el.tag === 'script' || el.tag === 'style'
}

// 判断是否为无效标签
function isForbiddenTag (el): boolean {
  // style标签、script标签
  return (
    el.tag === 'style' ||
    (el.tag === 'script' && (
      !el.attrsMap.type ||
      el.attrsMap.type === 'text/javascript'
    ))
  )
}

const ieNSBug = /^xmlns:NS\d+/ // 匹配xmlns:NS + 数字（至少一次），例：xmlns:NS1
const ieNSPrefix = /^NS\d+:/ // 匹配NS + 数字（至少一次），例：NS1:

/* istanbul ignore next */
// 处理IE中svg的bug
// 删掉所有以/^NS\d+:/开头的属性开头，只保留属性名
function guardIESVGBug (attrs) {
  const res = []
  for (let i = 0; i < attrs.length; i++) {
    const attr = attrs[i]
    if (!ieNSBug.test(attr.name)) {
      attr.name = attr.name.replace(ieNSPrefix, '')
      res.push(attr)
    }
  }
  return res
}

function checkForAliasModel (el, value) {
  let _el = el
  while (_el) {
    if (_el.for && _el.alias === value) {
      warn(
        `<${el.tag} v-model="${value}">: ` +
        `You are binding v-model directly to a v-for iteration alias. ` +
        `This will not be able to modify the v-for source array because ` +
        `writing to the alias is like modifying a function local variable. ` +
        `Consider using an array of objects and use v-model on an object property instead.`,
        el.rawAttrsMap['v-model']
      )
    }
    _el = _el.parent
  }
}
