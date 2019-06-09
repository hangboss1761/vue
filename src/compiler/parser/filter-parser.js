/* @flow */

const validDivisionCharRE = /[\w).+\-_$\]]/

// Unicode 表
// 0x7C |
// 0x5C \
// 0x2f /

// 解析Filter过滤器
export function parseFilters (exp: string): string {
  let inSingle = false
  let inDouble = false
  let inTemplateString = false
  let inRegex = false
  let curly = 0
  let square = 0
  let paren = 0
  let lastFilterIndex = 0
  let c, prev, i, expression, filters

  for (i = 0; i < exp.length; i++) {
    prev = c
    c = exp.charCodeAt(i)
    if (inSingle) {
      if (c === 0x27 && prev !== 0x5C) inSingle = false
    } else if (inDouble) {
      if (c === 0x22 && prev !== 0x5C) inDouble = false
    } else if (inTemplateString) {
      if (c === 0x60 && prev !== 0x5C) inTemplateString = false
    } else if (inRegex) {
      if (c === 0x2f && prev !== 0x5C) inRegex = false
    } else if (
      c === 0x7C && // pipe
      exp.charCodeAt(i + 1) !== 0x7C &&
      exp.charCodeAt(i - 1) !== 0x7C &&
      !curly && !square && !paren
    ) {
      // 1、当前字符为 |
      // 2、前一个字符不为 |
      // 3、后一个字符不为 |
      // 4、curly、square、paren都为false
      if (expression === undefined) {
        // first filter, end of expression
        lastFilterIndex = i + 1 // | 后第一个字符索引位置为第一个过滤器的起始位置
        expression = exp.slice(0, i).trim() // 取表达式，第一个|之前的部分
      } else {
        // 多个过滤器则放到过滤器队列中
        pushFilter()
      }
    } else {
      switch (c) {
        case 0x22: inDouble = true; break         // "
        case 0x27: inSingle = true; break         // '
        case 0x60: inTemplateString = true; break // `
        case 0x28: paren++; break                 // (
        case 0x29: paren--; break                 // )
        case 0x5B: square++; break                // [
        case 0x5D: square--; break                // ]
        case 0x7B: curly++; break                 // {
        case 0x7D: curly--; break                 // }
      }
      if (c === 0x2f) { // /
        let j = i - 1
        let p
        // find first non-whitespace prev char
        for (; j >= 0; j--) {
          p = exp.charAt(j)
          if (p !== ' ') break
        }
        if (!p || !validDivisionCharRE.test(p)) {
          inRegex = true
        }
      }
    }
  }

  if (expression === undefined) {
    // 如果上面for循环中没有匹配到则直接取全部字符串（去除两边空格）
    expression = exp.slice(0, i).trim()
  } else if (lastFilterIndex !== 0) {
    // 有匹配到的过滤器
    pushFilter()
  }

  function pushFilter () {
    // filters不存在则先初识化为空数组
    // 过滤器名为lastFilterIndex到当前索引i的位置
    // lastFilterIndex为|后第一个字符位置
    (filters || (filters = [])).push(exp.slice(lastFilterIndex, i).trim())
    // 更新lastFilterIndex索引
    lastFilterIndex = i + 1
  }

  if (filters) { // 存在过滤器
    for (i = 0; i < filters.length; i++) {
      // 对过滤器遍历，并将expression转义
      expression = wrapFilter(expression, filters[i])
    }
  }

  return expression
}

function wrapFilter (exp: string, filter: string): string {
  const i = filter.indexOf('(') // 获取过滤器(位置
  if (i < 0) {
    // _f: resolveFilter
    // 如果没有(则直接包裹
    // 例：a | b
    return `_f("${filter}")(${exp})`
  } else {
    // 有(开头
    // 例：a | b(c)
    const name = filter.slice(0, i) // 过滤器名
    const args = filter.slice(i + 1) // 过滤器参数
    return `_f("${name}")(${exp}${args !== ')' ? ',' + args : args}`
  }
}
