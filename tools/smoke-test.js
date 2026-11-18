/**
 * PWA 版自检（不依赖浏览器）
 *   node tools/smoke-test.js
 *
 * 检查：
 *   1. data.js 数据结构、日期递增
 *   2. util.js 的格式化函数
 *   3. chart.js 在 82 点 / 12 点 / 空数据 / 带气泡 四种情况下绘制不报错
 *   4. manifest.webmanifest 合法，引用的图标都存在
 *   5. sw.js 里的缓存清单和磁盘上的文件一一对应
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
let failed = 0

function ok(m) {
  console.log('  ok   ' + m)
}
function bad(m) {
  failed++
  console.log('  FAIL ' + m)
}
function assert(c, m) {
  if (c) ok(m)
  else bad(m)
}

/* ---------- 假浏览器环境 ---------- */
const win = {}
global.window = win

/* ---------- 1. 数据 ---------- */
console.log('\n[1] data.js')
require(path.join(ROOT, 'js/data.js'))
const DATA = win.HERB_DATA

assert(!!DATA && Array.isArray(DATA.herbs), 'HERB_DATA.herbs 是数组')
assert(DATA.herbs.length >= 2, '品种数量 = ' + DATA.herbs.length)

DATA.herbs.forEach((h) => {
  const arr = DATA.prices[h.id]
  if (!Array.isArray(arr) || !arr.length) {
    bad(h.name + ' 没有价格数组')
    return
  }
  let asc = true
  let num = true
  for (let i = 0; i < arr.length; i++) {
    if (!/^\d{4}-\d{2}$/.test(arr[i][0])) asc = false
    if (i > 0 && arr[i][0] <= arr[i - 1][0]) asc = false
    if (typeof arr[i][1] !== 'number' || !(arr[i][1] > 0)) num = false
  }
  assert(asc, h.name + ' 日期递增，共 ' + arr.length + ' 点')
  assert(num, h.name + ' 价格均为正数')
})

/* ---------- 2. util ---------- */
console.log('\n[2] util.js')
require(path.join(ROOT, 'js/util.js'))
const F = win.HerbFmt

assert(!!F, 'HerbFmt 已挂到 window')
assert(F.fmtPrice(22.4) === '22.4', 'fmtPrice(22.4) = ' + F.fmtPrice(22.4))
assert(F.fmtPrice(70.0) === '70', 'fmtPrice(70.0) = ' + F.fmtPrice(70.0))
assert(F.fmtPct(30.16) === '+30.2%', 'fmtPct(30.16) = ' + F.fmtPct(30.16))
assert(F.fmtPct(-5) === '-5.0%', 'fmtPct(-5) = ' + F.fmtPct(-5))
assert(F.shortMonth('2024-06') === '24.06', 'shortMonth = ' + F.shortMonth('2024-06'))
assert(F.cnMonth('2024-06') === '2024年6月', 'cnMonth = ' + F.cnMonth('2024-06'))
assert(F.dirOf(0) === 'flat' && F.dirOf(1) === 'up' && F.dirOf(-1) === 'down', 'dirOf 三种方向')

const pts = DATA.prices[DATA.herbs[0].id]
const ch = F.changeOf(pts, 12)
assert(!!ch && isFinite(ch.pct), 'changeOf 近12个月 = ' + (ch && ch.pct.toFixed(1)) + '%')
const st = F.statsOf(pts)
assert(!!st && st.min <= st.avg && st.avg <= st.max, 'statsOf 最高/均价/最低 关系正确')

/* ---------- 3. 图表 ---------- */
console.log('\n[3] chart.js')
require(path.join(ROOT, 'js/chart.js'))
const PriceChart = win.PriceChart
assert(typeof PriceChart === 'function', 'PriceChart 已导出')

function fakeCtx() {
  const noop = function () {}
  const scale = function () {
    return { addColorStop: noop }
  }
  const c = {
    clearRect: noop,
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    arcTo: noop,
    arc: noop,
    closePath: noop,
    fill: noop,
    stroke: noop,
    save: noop,
    restore: noop,
    setLineDash: noop,
    setTransform: noop,
    fillText: noop,
    createLinearGradient: scale,
    measureText: function (t) {
      return { width: String(t).length * 6 }
    }
  }
  const props = [
    'fillStyle',
    'strokeStyle',
    'lineWidth',
    'font',
    'textAlign',
    'textBaseline',
    'lineJoin',
    'lineCap',
    'shadowColor',
    'shadowBlur',
    'shadowOffsetY'
  ]
  props.forEach(function (k) {
    let v = null
    Object.defineProperty(c, k, {
      get: function () {
        return v
      },
      set: function (x) {
        v = x
      }
    })
  })
  return c
}

function instance(points, active) {
  const inst = Object.create(PriceChart.prototype)
  inst.ctx = fakeCtx()
  inst.w = 343
  inst.h = 220
  inst.points = points
  inst.unit = '元/公斤'
  inst.color = '#2F7D5D'
  inst.active = active === undefined ? null : active
  return inst
}

DATA.herbs.forEach((h) => {
  const arr = DATA.prices[h.id]

  try {
    instance(arr).draw()
    ok(h.name + ' 全部 ' + arr.length + ' 点绘制正常')
  } catch (e) {
    bad(h.name + ' 全部绘制抛错: ' + e.message)
  }

  try {
    instance(arr.slice(-12)).draw()
    ok(h.name + ' 12 点绘制正常')
  } catch (e) {
    bad(h.name + ' 12 点绘制抛错: ' + e.message)
  }

  try {
    instance([]).draw()
    ok(h.name + ' 空数据不报错')
  } catch (e) {
    bad(h.name + ' 空数据抛错: ' + e.message)
  }

  try {
    instance(arr, 40).draw()
    ok(h.name + ' 带气泡绘制正常')
  } catch (e) {
    bad(h.name + ' 带气泡抛错: ' + e.message)
  }

  // pick 边界
  const i1 = instance(arr, null)
  i1.pick(46)
  const left = i1.active
  const i2 = instance(arr, null)
  i2.pick(343 - 14)
  const right = i2.active
  const i3 = instance(arr, null)
  i3.pick(180)
  const mid = i3.active
  assert(left === 0, h.name + ' 最左 -> 0（实际 ' + left + '）')
  assert(right === arr.length - 1, h.name + ' 最右 -> ' + (arr.length - 1) + '（实际 ' + right + '）')
  assert(mid > 0 && mid < arr.length - 1, h.name + ' 中间 -> ' + mid)
})

/* ---------- 4. manifest ---------- */
console.log('\n[4] manifest.webmanifest')
const mfPath = path.join(ROOT, 'manifest.webmanifest')
let mf = null
try {
  mf = JSON.parse(fs.readFileSync(mfPath, 'utf-8'))
  ok('JSON 解析通过')
} catch (e) {
  bad('JSON 解析失败: ' + e.message)
}

if (mf) {
  assert(mf.display === 'standalone', 'display = ' + mf.display)
  assert(!!mf.name && !!mf.short_name, 'name / short_name 存在')
  assert(mf.theme_color && mf.background_color, 'theme_color / background_color 存在')
  assert(Array.isArray(mf.icons) && mf.icons.length >= 2, 'icons 至少 2 个')
  mf.icons.forEach((ic) => {
    const p = path.join(ROOT, ic.src)
    assert(fs.existsSync(p), '图标存在: ' + ic.src)
  })
  assert(
    mf.icons.some((i) => (i.purpose || '') === 'maskable'),
    '包含 maskable 图标（安卓自适应图标用）'
  )
}

/* ---------- 5. Service Worker 缓存清单 ---------- */
console.log('\n[5] sw.js 缓存清单')
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf-8')
const assets = []
const re = /'(\.\/[^']*)'/g
let m
while ((m = re.exec(sw))) assets.push(m[1])

assert(assets.length > 0, '解析到 ' + assets.length + ' 个缓存资源')
const uniq = Array.from(new Set(assets))
uniq.forEach((a) => {
  const rel = a.replace(/^\.\//, '') || '.'
  const p = path.join(ROOT, rel)
  assert(fs.existsSync(p), '存在: ' + a)
})

// 反向检查：磁盘上的关键文件是否都被缓存了
const mustCache = ['index.html', 'css/style.css', 'js/data.js', 'js/util.js', 'js/chart.js', 'js/app.js']
mustCache.forEach((f) => {
  assert(uniq.indexOf('./' + f) !== -1, '已纳入缓存: ' + f)
})

/* ---------- 6. 页面渲染（用 DOM 桩把 app.js 真跑一遍） ---------- */
console.log('\n[6] app.js 渲染逻辑')

function stubEl(tag) {
  const el = {
    tagName: tag || 'div',
    className: '',
    textContent: '',
    hidden: false,
    style: {},
    width: 300,
    height: 220,
    _html: '',
    _reg: {},
    classList: {
      add: function () {},
      remove: function () {},
      toggle: function () {},
      contains: function () {
        return false
      }
    },
    addEventListener: function () {},
    removeEventListener: function () {},
    querySelector: function (sel) {
      if (!el._reg[sel]) el._reg[sel] = stubEl()
      return el._reg[sel]
    },
    querySelectorAll: function () {
      return []
    },
    getAttribute: function () {
      return ''
    },
    setAttribute: function () {},
    focus: function () {},
    getContext: function () {
      return fakeCtx()
    },
    getBoundingClientRect: function () {
      return { width: 350, height: 220, left: 16, top: 0 }
    }
  }
  Object.defineProperty(el, 'innerHTML', {
    get: function () {
      return el._html
    },
    set: function (v) {
      el._html = String(v)
      el._reg = {}
    }
  })
  return el
}

const viewEl = stubEl('main')
const titleNode = stubEl('h1')
const backNode = stubEl('button')
const appNode = stubEl('div')
const appbarNode = stubEl('header')

const listeners = {}
win.addEventListener = function (type, fn) {
  ;(listeners[type] = listeners[type] || []).push(fn)
}
win.removeEventListener = function () {}
win.scrollTo = function () {}
win.scrollY = 0
win.devicePixelRatio = 2

global.document = {
  title: '',
  getElementById: function (id) {
    if (id === 'view') return viewEl
    if (id === 'title') return titleNode
    if (id === 'back') return backNode
    if (id === 'app') return appNode
    return stubEl()
  },
  querySelector: function (sel) {
    return sel === '.appbar' ? appbarNode : stubEl()
  }
}
global.location = { hash: '', protocol: 'file:', pathname: '/app/index.html', search: '' }
global.history = {
  replaceState: function () {}
}
global.navigator = {}

require(path.join(ROOT, 'js/app.js'))

function fire(type) {
  ;(listeners[type] || []).forEach(function (fn) {
    fn({})
  })
}

// 首页
const homeHTML = viewEl.innerHTML
const listHTML = viewEl._reg['#list'] ? viewEl._reg['#list'].innerHTML : ''
assert(homeHTML.indexOf('hero-title') !== -1, '首页渲染出标题')
assert((listHTML.match(/herb-card/g) || []).length >= 2, '首页渲染出 2 张卡片')
assert(listHTML.indexOf('栀子') !== -1, '首页包含栀子')
assert(listHTML.indexOf('岗梅') !== -1, '首页包含岗梅')
assert(listHTML.indexOf('22.4') !== -1, '首页显示栀子最新价 22.4')
assert(listHTML.indexOf('+30.2%') !== -1, '首页显示近一年涨跌 +30.2%')

// 进入栀子详情
global.location.hash = '#/detail/zhizi'
fire('hashchange')

const h1 = viewEl.innerHTML
assert(h1.indexOf('江西统货') !== -1, '详情页渲染出规格')
assert(h1.indexOf('chart') !== -1, '详情页渲染出 canvas')
assert(titleNode.textContent === '栀子 · 价格走势', '顶栏标题 = ' + titleNode.textContent)
assert(viewEl._reg['#dPrice'].textContent === '22.4', '最新价 = ' + viewEl._reg['#dPrice'].textContent)
assert(viewEl._reg['#dDate'].textContent === '2026年10月', '日期 = ' + viewEl._reg['#dDate'].textContent)
assert(
  viewEl._reg['#dPct'].textContent === '+128.6%',
  '全部区间涨跌（9.8 → 22.4）= ' + viewEl._reg['#dPct'].textContent
)
assert(viewEl._reg['#dPct'].className.indexOf('up') !== -1, '涨跌配色 = ' + viewEl._reg['#dPct'].className)
assert(viewEl._reg['#dMax'].textContent === '68.9', '区间最高 = ' + viewEl._reg['#dMax'].textContent)
assert(viewEl._reg['#dMin'].textContent === '9.8', '区间最低 = ' + viewEl._reg['#dMin'].textContent)
assert(viewEl._reg['#dRange'].textContent.indexOf('82 个月') !== -1, '区间说明 = ' + viewEl._reg['#dRange'].textContent)

// 进入岗梅详情
global.location.hash = '#/detail/gangmei'
fire('hashchange')
assert(titleNode.textContent === '岗梅 · 价格走势', '切到岗梅，标题 = ' + titleNode.textContent)
assert(viewEl._reg['#dPrice'].textContent === '5.7', '岗梅最新价 = ' + viewEl._reg['#dPrice'].textContent)
assert(viewEl._reg['#dMin'].textContent === '3.7', '岗梅区间最低 = ' + viewEl._reg['#dMin'].textContent)

// 新增的两个品种也要能进详情页
;[
  { id: 'fangji', name: '粉防己' },
  { id: 'cheqiancao', name: '车前草' },
  { id: 'wuzhuyu', name: '吴茱萸' },
  { id: 'manjingzi', name: '蔓荆子' }
].forEach(function (it) {
  global.location.hash = '#/detail/' + it.id
  fire('hashchange')
  assert(
    titleNode.textContent.indexOf(it.name) === 0,
    it.name + ' 详情页标题 = ' + titleNode.textContent
  )
  assert(
    viewEl._reg['#dPrice'].textContent !== '--',
    it.name + ' 最新价 = ' + viewEl._reg['#dPrice'].textContent
  )
  assert(
    viewEl._reg['#dRange'].textContent.indexOf('82 个月') !== -1,
    it.name + ' 数据区间完整'
  )
})

// 说明页
global.location.hash = '#/about'
fire('hashchange')
assert(viewEl.innerHTML.indexOf('数据来源') !== -1, '说明页渲染出数据来源')
assert(viewEl.innerHTML.indexOf('不是真实成交价') !== -1, '说明页有演示数据提示')

// 回首页
global.location.hash = '#/'
fire('hashchange')
assert(viewEl.innerHTML.indexOf('hero-title') !== -1, '能回到首页')

// 不存在的品种不应该崩
global.location.hash = '#/detail/nope'
try {
  fire('hashchange')
  ok('不存在的品种没有抛错')
} catch (e) {
  bad('不存在的品种抛错: ' + e.message)
}

console.log('\n' + (failed === 0 ? '全部通过 ✅' : failed + ' 项失败 ❌'))
process.exit(failed === 0 ? 0 : 1)
