/* @flow */

import { mergeOptions } from '../util/index'

// mixin方法初始化
export function initMixin (Vue: GlobalAPI) {
  Vue.mixin = function (mixin: Object) {
    this.options = mergeOptions(this.options, mixin)
    return this
  }
}
