/* @flow */

import {
  isDef,
  isUndef
} from 'shared/util'

import {
  concat,
  stringifyClass,
  genClassForVnode
} from 'web/util/index'

// 更新class属性
function updateClass (oldVnode: any, vnode: any) {
  const el = vnode.elm
  const data: VNodeData = vnode.data
  const oldData: VNodeData = oldVnode.data
  if (
    isUndef(data.staticClass) &&
    isUndef(data.class) && (
      isUndef(oldData) || (
        isUndef(oldData.staticClass) &&
        isUndef(oldData.class)
      )
    )
  ) {
    // 1、新vnode的staticClass未定义（class属性）
    // 2、新vnode的class未定义（:class属性）
    // 3、旧vnode未定义 或 （旧vnode的staticClass未定义 和 旧vnode的class未定义）
    // 直接返回
    return
  }

  let cls = genClassForVnode(vnode) // 返回拼接后的class字符串

  // handle transition classes
  const transitionClass = el._transitionClasses
  if (isDef(transitionClass)) { // 拼接transitionClass
    cls = concat(cls, stringifyClass(transitionClass))
  }

  // set the class
  if (cls !== el._prevClass) { // 新的class属性与上一次一致不做改变
    el.setAttribute('class', cls) // 更新class属性
    el._prevClass = cls // dom元素备份上一次的class字符串
  }
}

export default {
  create: updateClass,
  update: updateClass
}
