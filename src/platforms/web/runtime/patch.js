/* @flow */

import * as nodeOps from 'web/runtime/node-ops'
import { createPatchFunction } from 'core/vdom/patch'
import baseModules from 'core/vdom/modules/index'
import platformModules from 'web/runtime/modules/index'

// the directive module should be applied last, after all
// built-in modules have been applied.
const modules = platformModules.concat(baseModules)
// nodeOps为dom操作函数集合
// platformModules为attrs, klass, events, domProps, style, transition操作
// baseModules为ref, directives操作
export const patch: Function = createPatchFunction({ nodeOps, modules })
