import { inBrowser } from './env'

export let mark
export let measure

if (process.env.NODE_ENV !== 'production') {
  // window.performance
  // https://developer.mozilla.org/zh-CN/docs/Web/API/Performance
  const perf = inBrowser && window.performance // 浏览器环境下返回window.performance
  /* istanbul ignore if */
  if (
    perf &&
    perf.mark &&
    perf.measure &&
    perf.clearMarks &&
    perf.clearMeasures
  ) {
    // 创建一个性能记录
    // https://developer.mozilla.org/zh-CN/docs/Web/API/Performance/mark
    mark = tag => perf.mark(tag)
    // 进行性能测量
    // https://developer.mozilla.org/zh-CN/docs/Web/API/Performance/measure
    measure = (name, startTag, endTag) => {
      perf.measure(name, startTag, endTag)
      perf.clearMarks(startTag)
      perf.clearMarks(endTag)
      // perf.clearMeasures(name)
    }
  }
}
