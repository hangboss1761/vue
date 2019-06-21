/* @flow */

import { parse } from './parser/index'
import { optimize } from './optimizer'
import { generate } from './codegen/index'
import { createCompilerCreator } from './create-compiler'

// `createCompilerCreator` allows creating compilers that use alternative
// parser/optimizer/codegen, e.g the SSR optimizing compiler.
// Here we just export a default compiler using the default parts.
export const createCompiler = createCompilerCreator(function baseCompile (
  template: string,
  options: CompilerOptions
): CompiledResult {
  // 解析html并生成astElement树
  const ast = parse(template.trim(), options)
  console.log(ast)
  if (options.optimize !== false) {
    optimize(ast, options)
  }

  // 根据astElement树转成生成vnode的代码
  const code = generate(ast, options)
  console.log(code.render)
  return {
    ast,
    render: code.render,
    staticRenderFns: code.staticRenderFns
  }
})
