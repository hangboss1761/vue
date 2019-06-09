/* @flow */

import { toArray } from '../util/index'

export function initUse (Vue: GlobalAPI) {
  // use方法定义
  Vue.use = function (plugin: Function | Object) {
    // 如果没有_installedPlugins字段，则将_installedPlugins初始化为空数组
    const installedPlugins = (this._installedPlugins || (this._installedPlugins = []))
    // 如果已经安装过则返回，保证每个plugin只安装过一次
    if (installedPlugins.indexOf(plugin) > -1) {
      return this
    }

    // additional parameters
    const args = toArray(arguments, 1)
    // 这将Vue放到第一个参数
    args.unshift(this)
    if (typeof plugin.install === 'function') {
      // 如果plugin提供了install方法则直接调用install
      plugin.install.apply(plugin, args)
    } else if (typeof plugin === 'function') {
      // 如果plugin直接就是一个方法则直接调用
      plugin.apply(null, args)
    }
    // 将当前的plugin放到已安装队列中
    installedPlugins.push(plugin)
    return this
  }
}
