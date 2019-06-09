/* @flow */

import { inBrowser } from 'core/util/env'
import { makeMap } from 'shared/util'

// 命名空间mmap
export const namespaceMap = {
  svg: 'http://www.w3.org/2000/svg',
  math: 'http://www.w3.org/1998/Math/MathML'
}

// HTML标签map
export const isHTMLTag = makeMap(
  'html,body,base,head,link,meta,style,title,' +
  'address,article,aside,footer,header,h1,h2,h3,h4,h5,h6,hgroup,nav,section,' +
  'div,dd,dl,dt,figcaption,figure,picture,hr,img,li,main,ol,p,pre,ul,' +
  'a,b,abbr,bdi,bdo,br,cite,code,data,dfn,em,i,kbd,mark,q,rp,rt,rtc,ruby,' +
  's,samp,small,span,strong,sub,sup,time,u,var,wbr,area,audio,map,track,video,' +
  'embed,object,param,source,canvas,script,noscript,del,ins,' +
  'caption,col,colgroup,table,thead,tbody,td,th,tr,' +
  'button,datalist,fieldset,form,input,label,legend,meter,optgroup,option,' +
  'output,progress,select,textarea,' +
  'details,dialog,menu,menuitem,summary,' +
  'content,element,shadow,template,blockquote,iframe,tfoot'
)

// this map is intentionally selective, only covering SVG elements that may
// contain child elements.
// svg标签map
export const isSVG = makeMap(
  'svg,animate,circle,clippath,cursor,defs,desc,ellipse,filter,font-face,' +
  'foreignObject,g,glyph,image,line,marker,mask,missing-glyph,path,pattern,' +
  'polygon,polyline,rect,switch,symbol,text,textpath,tspan,use,view',
  true
)

// 是否为pre标签
export const isPreTag = (tag: ?string): boolean => tag === 'pre'

// 判断是否为保留标签
export const isReservedTag = (tag: string): ?boolean => {
  // 返回参数是否在HTML标签与SVG标签的合集内
  return isHTMLTag(tag) || isSVG(tag)
}

// 返回标签命名空间
export function getTagNamespace (tag: string): ?string {
  if (isSVG(tag)) {
    // svg标签返回svg
    return 'svg'
  }
  // basic support for MathML
  // note it doesn't support other MathML elements being component roots
  if (tag === 'math') {
    return 'math'
  }
}

// 未知元素缓存
const unknownElementCache = Object.create(null)
// 判断是否为未知的元素
export function isUnknownElement (tag: string): boolean {
  /* istanbul ignore if */
  if (!inBrowser) {
    // 如果在非浏览器环境下则默认为未知元素
    return true
  }
  if (isReservedTag(tag)) {
    // 如果是保留保留标签则认为已知元素
    return false
  }
  // 转成全小写
  tag = tag.toLowerCase()
  /* istanbul ignore if */
  // 从缓存中取，如果存在则返回缓存的值
  if (unknownElementCache[tag] != null) {
    return unknownElementCache[tag]
  }
  // 创建一个对应对的元素
  const el = document.createElement(tag)
  if (tag.indexOf('-') > -1) {
    // HTMLUnknownElement
    // https://developer.mozilla.org/en-US/docs/Web/API/HTMLUnknownElement
    // http://stackoverflow.com/a/28210364/1070244
    // 如果标签含有 -
    // 判断元素是否为未知元素或者HTML元素
    return (unknownElementCache[tag] = (
      el.constructor === window.HTMLUnknownElement ||
      el.constructor === window.HTMLElement
    ))
  } else {
    // 调用.toString方法判断是否为未知元素
    return (unknownElementCache[tag] = /HTMLUnknownElement/.test(el.toString()))
  }
}

// 文本输入类型map
export const isTextInputType = makeMap('text,number,password,search,email,tel,url')
