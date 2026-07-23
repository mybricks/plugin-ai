/**
 * clean-mhtml.ts
 * 深度清理 MHTML 文件，保留页面 1:1 还原所需的最小内容集。
 * 浏览器兼容版本（无 Node.js 依赖）。
 *
 * 清理策略（按收益由大到小）：
 * 1. 删除 JS / 字体 part 整块
 * 2. CSS 规则过滤（含 @media 内部递归过滤，删除 dark/print/reduced-motion 等无用媒体查询）
 * 3. 移除 @keyframes 动画块
 * 4. 移除图片（含 SVG）base64 part 整块
 * 5. 移除内联 data URI base64
 * 6. 删除 HTML <script> 标签内容、HTML 注释、框架 data-* 噪音属性
 * 7. CSS 注释 + 多余空白行压缩
 * 8. MHTML 外层头部去噪（From / Snapshot-Content-Location / Subject / Date）
 * 9. Part 头部去噪（Content-ID / Content-Transfer-Encoding）
 * 10. HTML head 精简（冗余 meta / 所有 link / 加载策略属性）
 * 11. 完整解码 QP（软换行 + =XX 十六进制）
 * 12. pt 单位转换为 px（1pt = 96/72px）
 */

/** 对静态还原无贡献、可整块删除的 part Content-Type 前缀 */
const REMOVABLE_PART_CT_PREFIXES = [
  'text/javascript',
  'application/javascript',
  'application/x-javascript',
  'font/woff',
  'font/woff2',
  'font/ttf',
  'font/otf',
  'application/font-woff',
  'application/font-woff2',
  'application/x-font-woff',
  'application/vnd.ms-fontobject',
]

function decodeQP(text: string): string {
  const unwrapped = text.replace(/=\r\n/g, '').replace(/=\n/g, '')
  return unwrapped.replace(/((?:=[0-9A-Fa-f]{2})+)/g, (match) => {
    const bytes: number[] = []
    for (let i = 0; i < match.length; i += 3) {
      bytes.push(parseInt(match.slice(i + 1, i + 3), 16))
    }
    try {
      return new TextDecoder('utf-8').decode(new Uint8Array(bytes))
    } catch {
      return match
    }
  })
}

function stripDataUris(text: string): { result: string; count: number } {
  let count = 0
  // url("data:...") — 保留 SVG data URI（通常是小图标，去掉会导致图标丢失）
  const s1 = text.replace(
    /url\(\s*["']?(data:[^"')]+;base64,[A-Za-z0-9+/=\s]*)["']?\s*\)/gs,
    (full, dataUri: string) => {
      if (dataUri.startsWith('data:image/svg')) return full
      count++
      return 'url("")'
    },
  )
  // href/src="data:..." — 同样保留 SVG
  const s2 = s1.replace(
    /((?:xlink:)?href|src)\s*(?:=3D|=)\s*["']?(data:[^"'\s>]*;base64,[A-Za-z0-9+/=\s]*)["']?/gs,
    (full: string, attr: string, dataUri: string) => {
      if (dataUri.startsWith('data:image/svg')) return full
      count++
      return `${attr}=""`
    },
  )
  return { result: s2, count }
}

function removeAtBlocks(css: string, pattern: RegExp): { result: string; removed: number } {
  let result = ''
  let i = 0
  let removed = 0
  while (i < css.length) {
    const m = css.slice(i).match(pattern)
    if (m && m.index === 0) {
      let j = i + m[0].length
      while (j < css.length && css[j] !== '{') j++
      if (j < css.length) {
        let depth = 0
        while (j < css.length) {
          if (css[j] === '{') depth++
          else if (css[j] === '}') {
            depth--
            if (depth === 0) { j++; break }
          }
          j++
        }
        removed++
        i = j
        while (i < css.length && /[\r\n ]/.test(css[i])) i++
        continue
      }
    }
    result += css[i++]
  }
  return { result, removed }
}

function convertPtToPx(text: string): string {
  return text.replace(/(\d*\.?\d+)pt\b/g, (_: string, num: string) => {
    const px = parseFloat(num) * 96 / 72
    const rounded = Math.round(px * 10) / 10
    return (rounded % 1 === 0 ? Math.round(rounded) : rounded) + 'px'
  })
}

/** 删除 CSS 注释并压缩多余空白行 */
function cleanCssWhitespace(css: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\n{3,}/g, '\n\n')
}

/**
 * 清理 HTML 中的噪音：
 * - <script> 标签及其内容
 * - HTML 注释
 */
function cleanHtmlNoise(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
}

/**
 * 清理 HTML 中的框架噪音 data-* 属性：
 * 原有 data-fp/cn/en + 扩展 Vue data-v-*, React reactid/reactroot, testid 等
 */
function cleanHtmlAttrs(html: string): string {
  return html.replace(
    /\s+data-(?:fp|cn|en|v-[a-f0-9]+|reactid|reactroot|testid|zone-[a-z-]+|com-[a-z-]+|node-[a-z-]+|w-id)(?:=["'][^"']*["'])?/g,
    '',
  )
}

/**
 * 清理 MHTML 外层头部（parts[0]）：
 * 删除 From / Snapshot-Content-Location / Subject / Date 行及其折叠续行，
 * 保留 MIME-Version 和 Content-Type（含 boundary）。
 */
function stripMhtmlOuterHeaders(outerPart: string): string {
  const SKIP_FIELDS = /^(From|Snapshot-Content-Location|Subject|Date)\s*:/i
  const useCRLF = outerPart.includes('\r\n')
  const lines = outerPart.split(/\r?\n/)
  const result: string[] = []
  let skipping = false

  for (const line of lines) {
    // 续行（以空格或制表符开头）跟随上一个头字段
    if (/^[ \t]/.test(line)) {
      if (!skipping) result.push(line)
      continue
    }
    skipping = SKIP_FIELDS.test(line)
    if (!skipping) result.push(line)
  }

  return result.join(useCRLF ? '\r\n' : '\n')
}

/**
 * 清理 part 头部字符串：
 * 删除 Content-ID 和 Content-Transfer-Encoding 行（body 已解码为明文，这两行无用）。
 */
function cleanPartHeaders(headers: string, lb: string): string {
  const SKIP_FIELDS = /^(Content-ID|Content-Transfer-Encoding)\s*:/i
  const lines = headers.split(/\r?\n/)
  const result: string[] = []
  let skipping = false

  for (const line of lines) {
    if (/^[ \t]/.test(line)) {
      if (!skipping) result.push(line)
      continue
    }
    skipping = SKIP_FIELDS.test(line)
    if (!skipping) result.push(line)
  }

  return result.join(lb)
}

/**
 * 清理 HTML head 中对 AI 还原无用的标签和属性：
 * - 删除决策性 meta 标签（keywords/description/viewport/og/twitter 等）
 * - 删除所有 link 标签（CSS 已内嵌为 MHTML parts，icon/preload/manifest 等均无用）
 * - 清除加载策略噪音属性（crossorigin/integrity/referrerpolicy/nonce 等）
 */
function cleanHtmlHead(html: string): string {
  const REMOVABLE_META_NAMES =
    /^(viewport|keywords|description|author|generator|theme-color|referrer|robots|cdn_public_path|format-detection|csrf.?token)$/i
  const REMOVABLE_META_PROPS = /^(og:|twitter:)/i
  const REMOVABLE_META_HTTPEQUIV = /^(X-UA-Compatible|Content-Security-Policy|refresh)$/i

  let work = html

  // 删除决策性 <meta> 标签（保留 charset 和 http-equiv="Content-Type"）
  work = work.replace(/<meta\b[^>]*\/?>/gi, (tag) => {
    const nameMatch = tag.match(/\bname\s*=\s*["']([^"']*)["']/i)
    const propMatch = tag.match(/\bproperty\s*=\s*["']([^"']*)["']/i)
    const httpEquivMatch = tag.match(/\bhttp-equiv\s*=\s*["']([^"']*)["']/i)

    if (nameMatch && REMOVABLE_META_NAMES.test(nameMatch[1])) return ''
    if (propMatch && REMOVABLE_META_PROPS.test(propMatch[1])) return ''
    if (httpEquivMatch && REMOVABLE_META_HTTPEQUIV.test(httpEquivMatch[1])) return ''
    return tag
  })

  // 删除无用 <link> 标签：icon/preload/manifest/dns-prefetch 等
  // 保留所有 stylesheet（cid: 和 https: 均保留）：
  //   - cid: stylesheet → 引用 MHTML 内嵌的 CSS part，浏览器据此加载本地 CSS
  //   - https: stylesheet → 同样有对应 Content-Location 的 MHTML CSS part，
  //     浏览器会从 MHTML 内部命中而非发起网络请求，必须保留否则该 part 永远不被加载
  work = work.replace(/<link\b[^>]*\/?>/gi, (tag) => {
    const relMatch = tag.match(/\brel\s*=\s*["']([^"']*)["']/i)
    const rel = relMatch ? relMatch[1].toLowerCase() : ''
    // 保留所有 stylesheet link（cid: 和 https: 都留）
    if (rel.includes('stylesheet')) return tag
    // 删除 icon/preload/manifest/dns-prefetch/canonical 等无关 link
    return ''
  })

  // 清除加载策略噪音属性
  work = work.replace(
    /\s+(?:data-cdn-hooked|data-assets-retry-hooked|crossorigin|integrity|referrerpolicy|nonce)(?:=["'][^"']*["'])?/gi,
    '',
  )

  return work
}

interface HtmlTokens {
  classes: Set<string>
  classesLower: Set<string>
  ids: Set<string>
  tags: Set<string>
}

function extractHtmlTokens(htmlText: string): HtmlTokens {
  const classes = new Set<string>()
  const ids = new Set<string>()
  const tags = new Set<string>()

  const classRe = /class(?:=3D|=)["']([^"']+)["']/gi
  let m: RegExpExecArray | null
  while ((m = classRe.exec(htmlText)) !== null) {
    m[1].split(/\s+/).forEach(c => c && classes.add(c))
  }

  const idRe = /\bid(?:=3D|=)["']([^"']+)["']/gi
  while ((m = idRe.exec(htmlText)) !== null) {
    ids.add(m[1].trim())
  }

  const tagRe = /<([a-z][a-z0-9-]*)/gi
  while ((m = tagRe.exec(htmlText)) !== null) {
    tags.add(m[1].toLowerCase())
  }

  const classesLower = new Set([...classes].map(c => c.toLowerCase()))
  return { classes, classesLower, ids, tags }
}

interface CssRule {
  selector: string
  body: string
  full: string
}

function splitCssRules(css: string): CssRule[] {
  const rules: CssRule[] = []
  let i = 0
  const len = css.length

  while (i < len) {
    while (i < len && /\s/.test(css[i])) i++
    if (i >= len) break

    if (css[i] === '@') {
      const atStart = i
      while (i < len && css[i] !== '{' && css[i] !== ';') i++
      if (i >= len) break

      if (css[i] === ';') {
        i++
        rules.push({ selector: css.slice(atStart, i).trim(), body: '', full: css.slice(atStart, i) })
        continue
      }

      const selector = css.slice(atStart, i).trim()
      const blockStart = i
      let depth = 0
      while (i < len) {
        if (css[i] === '{') depth++
        else if (css[i] === '}') { depth--; if (depth === 0) { i++; break } }
        i++
      }
      rules.push({ selector, body: css.slice(blockStart, i), full: css.slice(atStart, i) })
      continue
    }

    const selStart = i
    while (i < len && css[i] !== '{' && css[i] !== ';') i++
    if (i >= len) break

    if (css[i] === ';') {
      i++
      continue
    }

    const selector = css.slice(selStart, i).trim()
    const blockStart = i
    let depth = 0
    while (i < len) {
      if (css[i] === '{') depth++
      else if (css[i] === '}') { depth--; if (depth === 0) { i++; break } }
      i++
    }
    rules.push({ selector, body: css.slice(blockStart, i), full: css.slice(selStart, i) })
  }

  return rules
}

/** 判断 @media 是否对静态视觉还原无用（直接丢弃） */
function isUselessMedia(selector: string): boolean {
  return (
    /\bprint\b/i.test(selector) ||
    /prefers-color-scheme\s*:\s*dark/i.test(selector) ||
    /prefers-reduced-motion/i.test(selector) ||
    /\bspeech\b/i.test(selector) ||
    /\baural\b/i.test(selector)
  )
}

function selectorMatches(selector: string, tokens: HtmlTokens): boolean {
  const { classes, ids, classesLower } = tokens
  const selLower = selector.toLowerCase()

  if (
    selLower.startsWith('@font-face') ||
    selLower.startsWith('@charset') ||
    selLower.startsWith('@import') ||
    selLower.startsWith('@layer') ||
    selLower.startsWith('@supports') ||
    selector.includes(':root') ||
    selector.includes('*') ||
    selLower.includes('html') ||
    selLower.includes('body')
  ) return true

  // @media 由 filterCss 直接递归处理，不在此处决策
  // 其余有块的 @rule 整体保留
  if (selector.startsWith('@')) return true

  const selectorClasses = [...selector.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map(m => m[1])
  const selectorIds = [...selector.matchAll(/#([a-zA-Z0-9_-]+)/g)].map(m => m[1])

  if (selectorClasses.length === 0 && selectorIds.length === 0) return true

  for (const sc of selectorClasses) {
    const scLower = sc.toLowerCase()
    if (classes.has(sc)) return true
    if (classesLower.has(scLower)) return true
    for (const pc of classes) {
      const pcLower = pc.toLowerCase()
      if (pcLower.startsWith(scLower) || scLower.startsWith(pcLower)) return true
    }
  }

  for (const sid of selectorIds) {
    if (ids.has(sid) || ids.has(sid.toLowerCase())) return true
  }

  return false
}

function filterCss(css: string, tokens: HtmlTokens): string {
  const rules = splitCssRules(css)
  let kept = ''
  for (const rule of rules) {
    const selLower = rule.selector.toLowerCase()

    // @media 块：先判断是否为无用媒体类型，再递归过滤内部规则
    if (selLower.startsWith('@media')) {
      if (isUselessMedia(rule.selector)) continue
      // body 为 "{ ... }"，去掉外层括号取内部 CSS
      const innerCss = rule.body.slice(1, rule.body.length - 1)
      const filteredInner = filterCss(innerCss, tokens)
      if (filteredInner.trim()) {
        kept += `${rule.selector} {\n${filteredInner}}\n`
      }
      continue
    }

    if (selectorMatches(rule.selector, tokens)) {
      kept += rule.full + '\n'
    }
  }
  return kept
}

/**
 * 对 MHTML 文件内容进行深度精简，返回清理后的字符串。
 * 若内容不是合法 MHTML（找不到 boundary），原样返回。
 * @param content MHTML 文件原始文本
 */
export function cleanMhtml(content: string): string {
  const boundaryMatch = content.match(/boundary="([^"]+)"/)
  if (!boundaryMatch) return content

  const boundary = boundaryMatch[1]
  const partSeparator = `--${boundary}`
  const parts = content.split(partSeparator)

  // 第一遍：提取主 HTML 的 tokens，用于 CSS 规则过滤
  let htmlTokens: HtmlTokens | null = null
  const htmlPart = parts
    .filter(p => /Content-Type:\s*text\/html/i.test(p))
    .sort((a, b) => b.length - a.length)[0]

  if (htmlPart) {
    const splitIdx = htmlPart.indexOf('\r\n\r\n') !== -1
      ? htmlPart.indexOf('\r\n\r\n') + 4
      : htmlPart.indexOf('\n\n') + 2
    const htmlBody = htmlPart.slice(splitIdx)
    const encMatch = htmlPart.match(/Content-Transfer-Encoding:\s*([^\r\n]+)/i)
    const enc = encMatch ? encMatch[1].trim().toLowerCase() : ''
    const decoded = enc === 'quoted-printable' ? decodeQP(htmlBody) : htmlBody
    htmlTokens = extractHtmlTokens(decoded)
  }

  // 第二遍：逐 part 处理
  const cleanedParts = parts.map((part, index) => {
    // 外层头部（boundary 前的 MHTML 元信息）
    if (index === 0) return stripMhtmlOuterHeaders(part)

    const trimmed = part.trim()
    if (trimmed === '--' || trimmed === '-') return part

    let headerBodySplit = part.indexOf('\r\n\r\n')
    let lb = '\r\n'
    if (headerBodySplit === -1) { headerBodySplit = part.indexOf('\n\n'); lb = '\n' }
    if (headerBodySplit === -1) return part

    const rawHeaders = part.slice(0, headerBodySplit)
    const body = part.slice(headerBodySplit + lb.length * 2)

    const ctMatch = rawHeaders.match(/Content-Type:\s*([^\r\n;]+)/i)
    const encMatch = rawHeaders.match(/Content-Transfer-Encoding:\s*([^\r\n]+)/i)
    const locMatch = rawHeaders.match(/Content-Location:\s*([^\r\n]+)/i)

    const ct = ctMatch ? ctMatch[1].trim().toLowerCase() : ''
    const enc = encMatch ? encMatch[1].trim().toLowerCase() : ''
    const loc = locMatch ? locMatch[1].trim() : ''

    // 精简 part 头部（删 Content-ID / Content-Transfer-Encoding）
    const headers = cleanPartHeaders(rawHeaders, lb)

    // 删除 JS / 字体 part 整块
    if (REMOVABLE_PART_CT_PREFIXES.some(p => ct.startsWith(p))) {
      return `${headers}${lb}${lb}[part removed: ${ct} — URL: ${loc}]${lb}`
    }

    // 移除 base64 图片整块（含 SVG base64）
    if (
      (ct.startsWith('image/png') || ct.startsWith('image/jpeg') ||
        ct.startsWith('image/gif') || ct.startsWith('image/webp') ||
        ct.startsWith('image/svg')) &&
      enc === 'base64'
    ) {
      return `${headers}${lb}${lb}[base64 image removed — URL: ${loc}]${lb}`
    }

    const isText = ct.startsWith('text/') || ct.startsWith('image/svg') || ct === ''
    if (!isText) return part

    const isQP = enc === 'quoted-printable'
    let work = isQP ? decodeQP(body) : body
    // headers 已精简，视为已变更
    let changed = isQP || headers !== rawHeaders

    // 清除内联 data URI base64
    if (work.includes('base64,')) {
      const { result, count } = stripDataUris(work)
      if (count > 0) {
        work = result
        changed = true
      }
    }

    // CSS 处理
    if (ct.startsWith('text/css')) {
      // CSS 注释 + 空白压缩
      const cleaned = cleanCssWhitespace(work)
      if (cleaned !== work) { work = cleaned; changed = true }

      // 移除 @keyframes
      const kf = removeAtBlocks(work, /^@(?:-webkit-|-moz-|-o-)?keyframes\s/)
      if (kf.removed > 0) { work = kf.result; changed = true }

      // 按 HTML token 过滤规则（含 @media 内部递归，阈值降至 5KB）
      if (htmlTokens && work.length / 1024 > 5) {
        work = filterCss(work, htmlTokens)
        changed = true
      }
    }

    // HTML：清理脚本、注释、噪音属性、冗余 head 标签
    if (ct.startsWith('text/html')) {
      const noNoise = cleanHtmlNoise(work)
      if (noNoise !== work) { work = noNoise; changed = true }

      const noAttrs = cleanHtmlAttrs(work)
      if (noAttrs !== work) { work = noAttrs; changed = true }

      const noHead = cleanHtmlHead(work)
      if (noHead !== work) { work = noHead; changed = true }
    }

    // 全局：pt → px
    if (work.includes('pt')) {
      const converted = convertPtToPx(work)
      if (converted !== work) { work = converted; changed = true }
    }

    if (changed) return `${headers}${lb}${lb}${work}`
    return part
  })

  return cleanedParts.join(partSeparator)
}
