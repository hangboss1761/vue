/* @flow */

/**
 * Expand input[v-model] with dyanmic type bindings into v-if-else chains
 * Turn this:
 *   <input v-model="data[type]" :type="type">
 * into this:
 *   <input v-if="type === 'checkbox'" type="checkbox" v-model="data[type]">
 *   <input v-else-if="type === 'radio'" type="radio" v-model="data[type]">
 *   <input v-else :type="type" v-model="data[type]">
 */

import {
  addRawAttr,
  getBindingAttr,
  getAndRemoveAttr
} from 'compiler/helpers'

import {
  processFor,
  processElement,
  addIfCondition,
  createASTElement
} from 'compiler/parser/index'

// 解析input标签（v-model）
function preTransformNode (el: ASTElement, options: CompilerOptions) {
  // 只解析input标签
  if (el.tag === 'input') {
    const map = el.attrsMap // 标签的所有属性map
    if (!map['v-model']) {
      // 如果没有v-model属性则返回
      return
    }

    let typeBinding
    if (map[':type'] || map['v-bind:type']) {
      // 属性map中包含:type或v-bind:type字段
      // 则将动态type属性从el中移除并返回属性值
      typeBinding = getBindingAttr(el, 'type')
    }
    if (!map.type && !typeBinding && map['v-bind']) {
      // 1、map中不包含type
      // 2、map中不包含:type或v-bind:type
      // 3、map中包含v-bind
      // 则为v-bind字段对应属性值的type值
      typeBinding = `(${map['v-bind']}).type`
    }

    if (typeBinding) {
      // 获取v-if属性对应的属性值，并从el的attrsMap、attrsList中移除该属性
      const ifCondition = getAndRemoveAttr(el, 'v-if', true)
      const ifConditionExtra = ifCondition ? `&&(${ifCondition})` : ``
      // 获取v-else属性对应的属性值
      // 并从el的attrsMap、attrsList中移除该属性
      // 并通过返回值判断是否存在v-else属性
      const hasElse = getAndRemoveAttr(el, 'v-else', true) != null
      // 获取v-else-if属性对应的属性值，并从el的attrsMap、attrsList中移除该属性
      const elseIfCondition = getAndRemoveAttr(el, 'v-else-if', true)
      // 1. checkbox
      // 拷贝一个新的ASTElement
      const branch0 = cloneASTElement(el)
      // process for on the main node
      processFor(branch0) // 解析v-for
      // 向el的attrsMap、attrsList添加type属性，属性值为checkbox
      addRawAttr(branch0, 'type', 'checkbox')
      // 对新的ASTElement的所有属性值解析
      processElement(branch0, options)
      // processed标记位true表示解析完成
      branch0.processed = true // prevent it from double-processed
      branch0.if = `(${typeBinding})==='checkbox'` + ifConditionExtra
      addIfCondition(branch0, {
        exp: branch0.if,
        block: branch0
      })
      // 2. add radio else-if condition
      // 拷贝一个新的ASTElement
      const branch1 = cloneASTElement(el)
      getAndRemoveAttr(branch1, 'v-for', true)
      addRawAttr(branch1, 'type', 'radio')
      processElement(branch1, options)
      addIfCondition(branch0, {
        exp: `(${typeBinding})==='radio'` + ifConditionExtra,
        block: branch1
      })
      // 3. other
      // 拷贝一个新的ASTElement
      const branch2 = cloneASTElement(el)
      getAndRemoveAttr(branch2, 'v-for', true)
      addRawAttr(branch2, ':type', typeBinding)
      processElement(branch2, options)
      addIfCondition(branch0, {
        exp: ifCondition,
        block: branch2
      })

      if (hasElse) {
        branch0.else = true
      } else if (elseIfCondition) {
        branch0.elseif = elseIfCondition
      }

      return branch0
    }
  }
}

// 克隆一个ASTElement
function cloneASTElement (el) {
  return createASTElement(el.tag, el.attrsList.slice(), el.parent)
}

export default {
  preTransformNode
}
