/* @flow */
/* globals MutationObserver */

import { noop } from 'shared/util'
import { handleError } from './error'
import { isIE, isIOS, isNative } from './env'

// isIE 为判断是否为IE环境
// isIOS 为判断是否为iOS环境
// isNative 为判断传入参数是否为内置函数

// 是否使用微任务标志（默认为false）
export let isUsingMicroTask = false

const callbacks = []
let pending = false

// 清空执行回调
function flushCallbacks () {
  pending = false
  const copies = callbacks.slice(0) // 所有的回调函数浅拷贝
  callbacks.length = 0 // 清空回调函数队列
  for (let i = 0; i < copies.length; i++) {
    copies[i]() // 依次执行回调函数
  }
}

// Here we have async deferring wrappers using microtasks.
// In 2.5 we used (macro) tasks (in combination with microtasks).
// However, it has subtle problems when state is changed right before repaint
// (e.g. #6813, out-in transitions).
// Also, using (macro) tasks in event handler would cause some weird behaviors
// that cannot be circumvented (e.g. #7109, #7153, #7546, #7834, #8109).
// So we now use microtasks everywhere, again.
// A major drawback of this tradeoff is that there are some scenarios
// where microtasks have too high a priority and fire in between supposedly
// sequential events (e.g. #4521, #6690, which have workarounds)
// or even between bubbling of the same event (#6566).
let timerFunc

// The nextTick behavior leverages the microtask queue, which can be accessed
// via either native Promise.then or MutationObserver.
// MutationObserver has wider support, however it is seriously bugged in
// UIWebView in iOS >= 9.3.3 when triggered in touch event handlers. It
// completely stops working after triggering a few times... so, if native
// Promise is available, we will use it:
/* istanbul ignore next, $flow-disable-line */

// 优先判断Promise是否存在（非undefined & 必须为内置函数）
if (typeof Promise !== 'undefined' && isNative(Promise)) {
  const p = Promise.resolve() // 初始化一个Promise对象（fulfilled）
  timerFunc = () => {
    p.then(flushCallbacks)
    // In problematic UIWebViews, Promise.then doesn't completely break, but
    // it can get stuck in a weird state where callbacks are pushed into the
    // microtask queue but the queue isn't being flushed, until the browser
    // needs to do some other work, e.g. handle a timer. Therefore we can
    // "force" the microtask queue to be flushed by adding an empty timer.

    // iOS中在一些异常的webview中，promise结束后任务队列并没有刷新
    // 所以强制执行setTimeout刷新任务队列
    if (isIOS) setTimeout(noop)
  }
  isUsingMicroTask = true // 重置使用微任务标示为true
} else if (!isIE && typeof MutationObserver !== 'undefined' && (
  isNative(MutationObserver) ||
  // PhantomJS and iOS 7.x
  MutationObserver.toString() === '[object MutationObserverConstructor]'
)) {
  // Use MutationObserver where native Promise is not available,
  // e.g. PhantomJS, iOS7, Android 4.4
  // (#6466 MutationObserver is unreliable in IE11)

  // 在android、iOS、PhantomJS使用MutationObserver
  // MutationObserver接口提供了监视对DOM树所做更改的能力
  // 参考地址：https://developer.mozilla.org/zh-CN/docs/Web/API/MutationObserver
  let counter = 1
  // 实例化新的MutationObserver对象
  // 在实例化的时候传入flushCallbacks为变化时回调
  // MutationObserver回调为微任务！
  const observer = new MutationObserver(flushCallbacks)
  // 创建一个文本节点
  const textNode = document.createTextNode(String(counter))
  // 对创建的文本节点监听
  // 参考地址：https://developer.mozilla.org/zh-CN/docs/Web/API/MutationObserver/observe
  observer.observe(textNode, {
    characterData: true // 在文本节点变化时，记录更新前的值
  })
  timerFunc = () => {
    counter = (counter + 1) % 2
    textNode.data = String(counter) // 更新文本节点内容
  }
  isUsingMicroTask = true // 重置使用微任务标示为true
} else if (typeof setImmediate !== 'undefined' && isNative(setImmediate)) {
  // Fallback to setImmediate.
  // Techinically it leverages the (macro) task queue,
  // but it is still a better choice than setTimeout.

  // 使用setImmediate（只有IE支持，宏任务但是优先级比setTimeout高）
  // 参考文档：https://developer.mozilla.org/zh-CN/docs/Web/API/Window/setImmediate
  timerFunc = () => {
    setImmediate(flushCallbacks)
  }
} else {
  // Fallback to setTimeout.

  // 上述方案均不可行时使用setTimeout方法
  timerFunc = () => {
    setTimeout(flushCallbacks, 0)
  }
}

// 对外暴露的nextTick方法
export function nextTick (cb?: Function, ctx?: Object) {
  // cb为用户传入的回调函数
  // ctx为当前vue实例（this）
  let _resolve
  // 在回调队列中加入回调函数
  callbacks.push(() => {
    if (cb) {
      try {
        cb.call(ctx) // 执行回调函数并绑定this
      } catch (e) {
        handleError(e, ctx, 'nextTick') // 异常处理
      }
    } else if (_resolve) {
      // 如果cb无效且_resolve已经置为promise.resolve
      // 则执行一次
      _resolve(ctx)
    }
  })
  if (!pending) {
    // 将pending置为true并开始执行回调队列
    pending = true
    timerFunc()
  }
  // $flow-disable-line

  // 当cb不存在时，将_resolve置为promise.resolve
  // 并返回promise对象
  if (!cb && typeof Promise !== 'undefined') {
    return new Promise(resolve => {
      _resolve = resolve
    })
  }
}
