/* @flow */

import { emptyObject } from 'shared/util'
import { parseFilters } from './parser/filter-parser'
type Range = { start?: number, end?: number };

/* eslint-disable no-unused-vars */
export function baseWarn (msg: string, range?: Range) {
  console.error(`[Vue compiler]: ${msg}`)
}
/* eslint-enable no-unused-vars */

// 匹配modules中每个元素key字段
export function pluckModuleFunction<F: Function> (
  modules: ?Array<Object>,
  key: string
): Array<F> {
  return modules
    ? modules.map(m => m[key]).filter(_ => _)
    : []
}

// 添加prop
export function addProp (el: ASTElement, name: string, value: string, range?: Range, dynamic?: boolean) {
  // el没有props属性则初始化空数组
  // 添加新的prop
  (el.props || (el.props = [])).push(rangeSetItem({ name, value, dynamic }, range))
  // el纯元素标志置为false
  el.plain = false
}

// 向el中添加属性
export function addAttr (el: ASTElement, name: string, value: any, range?: Range, dynamic?: boolean) {
  const attrs = dynamic
    ? (el.dynamicAttrs || (el.dynamicAttrs = [])) // 如果没有动态属性数组dynamicAttrs，则初始化空数组
    : (el.attrs || (el.attrs = [])) // 如果没有属性数组attrs，则初始化空数组
  // 向属性数组中添加属性
  attrs.push(rangeSetItem({ name, value, dynamic }, range))
  // plain纯Element标志置为false
  el.plain = false
}

// add a raw attr (use this in preTransforms)
// 向el中添加指定的属性及属性值
export function addRawAttr (el: ASTElement, name: string, value: any, range?: Range) {
  el.attrsMap[name] = value
  el.attrsList.push(rangeSetItem({ name, value }, range))
}

// 初始化directives属性并加入Directive
export function addDirective (
  el: ASTElement,
  name: string,
  rawName: string,
  value: string,
  arg: ?string,
  isDynamicArg: boolean,
  modifiers: ?ASTModifiers,
  range?: Range
) {
  // 初始化directives属性
  (el.directives || (el.directives = [])).push(rangeSetItem({
    name,
    rawName,
    value,
    arg,
    isDynamicArg,
    modifiers
  }, range))
  el.plain = false
}

function prependModifierMarker (symbol: string, name: string, dynamic?: boolean): string {
  return dynamic // 动态属性名
    // 动态属性名使用_p包裹拼接
    ? `_p(${name},"${symbol}")`
    // 静态属性名直接拼接
    : symbol + name // mark the event as captured
}

// 为el添加events/nativeEvents事件
export function addHandler (
  el: ASTElement,
  name: string,
  value: string,
  modifiers: ?ASTModifiers,
  important?: boolean,
  warn?: ?Function,
  range?: Range,
  dynamic?: boolean
) {
  modifiers = modifiers || emptyObject // 修饰符默认空对象
  // warn prevent and passive modifier
  /* istanbul ignore if */
  if (
    process.env.NODE_ENV !== 'production' && warn &&
    modifiers.prevent && modifiers.passive
  ) {
    // prevent和passive属性不能同时设置
    // https://developer.mozilla.org/zh-CN/docs/Web/API/EventTarget/addEventListener#%E5%8F%82%E6%95%B0
    warn(
      'passive and prevent can\'t be used together. ' +
      'Passive handler can\'t prevent default event.',
      range
    )
  }

  // normalize click.right and click.middle since they don't actually fire
  // this is technically browser-specific, but at least for now browsers are
  // the only target envs that have right/middle clicks.
  if (modifiers.right) { // 右键点击事件
    if (dynamic) { // 动态属性名
      // 只有click时才会监听contextmenu事件，其它属性时直接使用属性名
      // contextmenu事件：https://developer.mozilla.org/en-US/docs/Web/API/Element/contextmenu_event
      name = `(${name})==='click'?'contextmenu':(${name})`
    } else if (name === 'click') { // 静态属性名为click
      // 更改属性名为contextmenu，并删除right修饰符
      name = 'contextmenu'
      delete modifiers.right
    }
  } else if (modifiers.middle) { // 鼠标中键
    if (dynamic) { // 动态属性名
      // 只有click时才会监听mouseup事件，其它属性时直接使用属性名
      name = `(${name})==='click'?'mouseup':(${name})`
    } else if (name === 'click') { // 静态属性名为click
      // 更改属性名为mouseup
      name = 'mouseup'
    }
  }

  // check capture modifier
  // 以下几个修饰符介绍：
  // https://developer.mozilla.org/zh-CN/docs/Web/API/EventTarget/addEventListener#%E5%8F%82%E6%95%B0
  if (modifiers.capture) { // 事件捕获
    delete modifiers.capture // 删除capture修饰符
    // 格式化name加事件捕获标志
    name = prependModifierMarker('!', name, dynamic)
  }
  if (modifiers.once) { // 只触发一次
    delete modifiers.once // 删除once修饰符
    // 格式化name加once标志
    name = prependModifierMarker('~', name, dynamic)
  }
  /* istanbul ignore if */
  if (modifiers.passive) { // 永远不会调用preventDefault（调用会报错）
    // https://developer.mozilla.org/zh-CN/docs/Web/API/EventTarget/addEventListener#%E5%8F%82%E6%95%B0
    delete modifiers.passive // 删除passive修饰符
    // 格式化name加passive标志
    name = prependModifierMarker('&', name, dynamic)
  }

  let events
  if (modifiers.native) { // native修饰符
    delete modifiers.native // 删除native修饰符
    events = el.nativeEvents || (el.nativeEvents = {}) // 为el添加nativeEvents字段
  } else { // 不包含native修饰符
    events = el.events || (el.events = {}) // 为el添加events字段
  }

  // 创建一个新handler，并设置item的起始点、终点
  const newHandler: any = rangeSetItem({ value: value.trim(), dynamic }, range)
  if (modifiers !== emptyObject) {
    // 修饰符不为空对象则将修饰符赋值给新的handler
    newHandler.modifiers = modifiers
  }

  const handlers = events[name]
  /* istanbul ignore if */
  if (Array.isArray(handlers)) {
    // handlers为数组时，如果属性为重要属性则放到第一位，否则放到最后
    important ? handlers.unshift(newHandler) : handlers.push(newHandler)
  } else if (handlers) {
    // handlers不为数组，且不为空，将events[name]置为数组
    // 如果属性为重要属性则放到第一位，否则放到最后
    events[name] = important ? [newHandler, handlers] : [handlers, newHandler]
  } else {
    // handlers不存在，则events[name]赋值为newHandler
    events[name] = newHandler
  }

  // 纯元素标志为false
  el.plain = false
}

// 返回指定的属性值
export function getRawBindingAttr (
  el: ASTElement,
  name: string
) {
  // 1、优先取动态属性，:、v-bind:
  // 2、最后取静态属性
  return el.rawAttrsMap[':' + name] ||
    el.rawAttrsMap['v-bind:' + name] ||
    el.rawAttrsMap[name]
}

// 获取绑定的属性对象
// 例：:class、v-bind:class
export function getBindingAttr (
  el: ASTElement,
  name: string,
  getStatic?: boolean
): ?string {
  // 移除对应的属性对象
  const dynamicValue =
    getAndRemoveAttr(el, ':' + name) ||
    getAndRemoveAttr(el, 'v-bind:' + name)
  if (dynamicValue != null) {
    return parseFilters(dynamicValue)
  } else if (getStatic !== false) {
    // 如果不存在动态name属性，且设置获取静态属性
    // 则再次通过静态属性去匹配并移除
    const staticValue = getAndRemoveAttr(el, name)
    if (staticValue != null) {
      // 移除成功则返回静态属性字符串
      return JSON.stringify(staticValue)
    }
  }
}

// note: this only removes the attr from the Array (attrsList) so that it
// doesn't get processed by processAttrs.
// By default it does NOT remove it from the map (attrsMap) because the map is
// needed during codegen.
// 从AST元素对象中移除指定的属性，并将移除的属性对象返回
export function getAndRemoveAttr (
  el: ASTElement, // AST属性元素
  name: string, // 要移除的属性名
  removeFromMap?: boolean // 是否也从map（attrsMap）中移除
): ?string {
  let val
  // 从attrsMap中取对应的value，遍历attrsList匹配name并移除
  if ((val = el.attrsMap[name]) != null) {
    const list = el.attrsList
    for (let i = 0, l = list.length; i < l; i++) {
      if (list[i].name === name) {
        list.splice(i, 1)
        break
      }
    }
  }
  // removeFromMap为true，则将attrsMap对应的字段也删除
  if (removeFromMap) {
    delete el.attrsMap[name]
  }
  return val
}

// 通过正则，从attrsList中移除指定的属性，并返回该属性
export function getAndRemoveAttrByRegex (
  el: ASTElement,
  name: RegExp
) {
  const list = el.attrsList // 从attrsList中移除
  for (let i = 0, l = list.length; i < l; i++) {
    const attr = list[i]
    if (name.test(attr.name)) { // 正则匹配
      list.splice(i, 1)
      return attr
    }
  }
}

// 设置item的起始点、终点
function rangeSetItem (
  item: any,
  range?: { start?: number, end?: number }
) {
  // 只有range存在时再赋值
  if (range) {
    if (range.start != null) {
      item.start = range.start
    }
    if (range.end != null) {
      item.end = range.end
    }
  }
  return item
}
