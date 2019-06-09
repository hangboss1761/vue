/* @flow */

import {
  no,
  noop,
  identity
} from 'shared/util'

import { LIFECYCLE_HOOKS } from 'shared/constants'

export type Config = {
  // user
  optionMergeStrategies: { [key: string]: Function };
  silent: boolean;
  productionTip: boolean;
  performance: boolean;
  devtools: boolean;
  errorHandler: ?(err: Error, vm: Component, info: string) => void;
  warnHandler: ?(msg: string, vm: Component, trace: string) => void;
  ignoredElements: Array<string | RegExp>;
  keyCodes: { [key: string]: number | Array<number> };

  // platform
  isReservedTag: (x?: string) => boolean;
  isReservedAttr: (x?: string) => boolean;
  parsePlatformTagName: (x: string) => string;
  isUnknownElement: (x?: string) => boolean;
  getTagNamespace: (x?: string) => string | void;
  mustUseProp: (tag: string, type: ?string, name: string) => boolean;

  // private
  async: boolean;

  // legacy
  _lifecycleHooks: Array<string>;
};

export default ({
  /**
   * Option merge strategies (used in core/util/options)
   */
  // $flow-disable-line
  // 自定义合并策略的选项
  // https://cn.vuejs.org/v2/api/#optionMergeStrategies
  optionMergeStrategies: Object.create(null),

  /**
   * Whether to suppress warnings.
   */
  // 取消 Vue 所有的日志与警告
  // https://cn.vuejs.org/v2/api/#silent
  silent: false,

  /**
   * Show production mode tip message on boot?
   */
  // 设置为 false 以阻止 vue 在启动时生成生产提示
  // https://cn.vuejs.org/v2/api/#productionTip
  productionTip: process.env.NODE_ENV !== 'production',

  /**
   * Whether to enable devtools
   */
  // 配置是否允许 vue-devtools 检查代码
  // 是否可以使用devtools（非生产环境中）
  // https://cn.vuejs.org/v2/api/#devtools
  devtools: process.env.NODE_ENV !== 'production',

  /**
   * Whether to record perf
   */
  // 是否开启性能监控
  // https://cn.vuejs.org/v2/api/#performance
  performance: false,

  /**
   * Error handler for watcher errors
   */
  // 错误处理函数
  // https://cn.vuejs.org/v2/api/#errorHandler
  errorHandler: null,

  /**
   * Warn handler for watcher warns
   */
  // 警告处理函数
  // https://cn.vuejs.org/v2/api/#warnHandler
  warnHandler: null,

  /**
   * Ignore certain custom elements
   */
  // 忽略自定义元素
  // https://cn.vuejs.org/v2/api/#ignoredElements
  ignoredElements: [],

  /**
   * Custom user key aliases for v-on
   */
  // $flow-disable-line
  // 给 v-on 自定义键位别名
  // https://cn.vuejs.org/v2/api/#keyCodes
  keyCodes: Object.create(null),

  /**
   * Check if a tag is reserved so that it cannot be registered as a
   * component. This is platform-dependent and may be overwritten.
   */
  // 是否为保留标签（不同平台下可能会被重写）
  isReservedTag: no,

  /**
   * Check if an attribute is reserved so that it cannot be used as a component
   * prop. This is platform-dependent and may be overwritten.
   */
  // 是否为保留标签属性（不同平台下可能会被重写）
  isReservedAttr: no,

  /**
   * Check if a tag is an unknown element.
   * Platform-dependent.
   */
  // 是否为未知元素
  isUnknownElement: no,

  /**
   * Get the namespace of an element
   */
  // 获取标签的命名空间（默认为空函数）
  getTagNamespace: noop,

  /**
   * Parse the real tag name for the specific platform.
   */
  parsePlatformTagName: identity,

  /**
   * Check if an attribute must be bound using property, e.g. value
   * Platform-dependent.
   */
  // 检查一个属性是否必须被绑定
  mustUseProp: no,

  /**
   * Perform updates asynchronously. Intended to be used by Vue Test Utils
   * This will significantly reduce performance if set to false.
   */
  async: true,

  /**
   * Exposed for legacy reasons
   */
  // 全部声明周期hooks
  _lifecycleHooks: LIFECYCLE_HOOKS
}: Config)
