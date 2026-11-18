/* 路由 + 视图 */
(function () {
  'use strict'

  var DATA = window.HERB_DATA || { herbs: [], prices: {} }
  var F = window.HerbFmt

  var view = document.getElementById('view')
  var titleEl = document.getElementById('title')
  var backBtn = document.getElementById('back')
  var appbar = document.querySelector('.appbar')

  var chart = null

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    })
  }

  function setBar(title, showBack, hideBar) {
    titleEl.textContent = title
    document.title = title === '本草行情' ? '本草行情 · 中药材价格走势' : title
    backBtn.hidden = !showBack
    appbar.classList.toggle('has-back', !!showBack)
    appbar.classList.toggle('hide', !!hideBar)
    document.getElementById('app').classList.toggle('bar-hidden', !!hideBar)
  }

  function parseHash() {
    var h = (location.hash || '').replace(/^#/, '')
    var m = h.match(/^\/detail\/([\w-]+)/)
    if (m) return { name: 'detail', id: m[1] }
    if (h === '/about') return { name: 'about' }
    return { name: 'list' }
  }

  /* ---------------- 首页 ---------------- */

  function buildRow(herb) {
    var pts = DATA.prices[herb.id] || []
    var latest = F.latestPoint(pts)
    var ch = F.changeOf(pts, 12)
    return {
      herb: herb,
      price: latest ? F.fmtPrice(latest.value) : '--',
      date: latest ? F.cnMonth(latest.date) : '',
      pctText: ch ? F.fmtPct(ch.pct) : '--',
      dir: ch ? F.dirOf(ch.pct) : 'flat',
      since: pts.length ? F.shortMonth(pts[0][0]) : '',
      pool: [herb.name, herb.pinyin, herb.initials, herb.category]
        .concat(herb.alias || [])
        .join(' ')
        .toLowerCase()
    }
  }

  function cardHTML(row) {
    var h = row.herb
    var tags = (h.tags || [])
      .map(function (t) {
        return '<span class="tag">' + esc(t) + '</span>'
      })
      .join('')
    return (
      '<div class="herb-card card" data-id="' + esc(h.id) + '" role="button" tabindex="0">' +
      '<div class="row between">' +
      '<div class="herb-left">' +
      '<div><span class="herb-name">' + esc(h.name) + '</span>' +
      '<span class="herb-since">' + esc(row.since) + ' 起</span></div>' +
      '<div class="herb-spec">' + esc(h.spec) + '</div>' +
      '<div class="tag-row">' + tags + '</div>' +
      '</div>' +
      '<div class="herb-right">' +
      '<div><span class="herb-num">' + row.price + '</span>' +
      '<span class="herb-unit">' + esc(h.unit) + '</span></div>' +
      '<div class="herb-chg ' + row.dir + '">' + row.pctText +
      '<span class="lbl">近一年</span></div>' +
      '</div>' +
      '</div>' +
      '<div class="herb-foot row between">' +
      '<span class="herb-alias">' + esc((h.alias || []).join(' · ')) + '</span>' +
      '<span>' + esc(row.date) + '</span>' +
      '</div>' +
      '</div>'
    )
  }

  function renderList() {
    setBar('本草行情', false, true)

    var rows = DATA.herbs.map(buildRow)

    view.innerHTML =
      '<div class="hero">' +
      '<div class="hero-title">本草行情</div>' +
      '<div class="hero-sub">常见中草药 · 历史价格走势</div>' +
      '</div>' +
      '<div class="search">' +
      '<span class="search-icon">搜</span>' +
      '<input id="q" type="search" placeholder="品种名 / 拼音，例如 栀子、zz" ' +
      'autocomplete="off" autocorrect="off" spellcheck="false">' +
      '<button class="clear" id="clear" hidden aria-label="清空">✕</button>' +
      '</div>' +
      '<div id="list"></div>' +
      '<div class="footer">' +
      '<div>数据为演示样例，仅供参考，不构成投资建议</div>' +
      '<div><a href="#/about">数据来源与说明 →</a></div>' +
      '</div>'

    var listEl = view.querySelector('#list')
    var qEl = view.querySelector('#q')
    var clearEl = view.querySelector('#clear')

    function paint(list, kw) {
      if (!list.length) {
        listEl.innerHTML =
          '<div class="empty"><div>没有找到「' + esc(kw) + '」</div>' +
          '<div class="tiny muted">试试只输入品种名的一个字</div></div>'
        return
      }
      listEl.innerHTML = list.map(cardHTML).join('')
    }

    function filter(kw) {
      if (!kw) return rows
      var k = kw.toLowerCase()
      return rows.filter(function (r) {
        return r.pool.indexOf(k) !== -1
      })
    }

    qEl.addEventListener('input', function () {
      var kw = qEl.value.trim()
      clearEl.hidden = !kw
      paint(filter(kw), kw)
    })

    clearEl.addEventListener('click', function () {
      qEl.value = ''
      clearEl.hidden = true
      paint(rows, '')
      qEl.focus()
    })

    listEl.addEventListener('click', function (e) {
      var card = e.target.closest('.herb-card')
      if (card) location.hash = '#/detail/' + card.getAttribute('data-id')
    })

    listEl.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return
      var card = e.target.closest('.herb-card')
      if (card) {
        e.preventDefault()
        location.hash = '#/detail/' + card.getAttribute('data-id')
      }
    })

    paint(rows, '')
  }

  /* ---------------- 详情页 ---------------- */

  function renderDetail(id) {
    var herb = null
    for (var i = 0; i < DATA.herbs.length; i++) {
      if (DATA.herbs[i].id === id) {
        herb = DATA.herbs[i]
        break
      }
    }
    if (!herb) {
      location.hash = '#/'
      return
    }

    setBar(herb.name + ' · 价格走势', true)

    var all = DATA.prices[herb.id] || []

    view.innerHTML =
      '<div class="head card">' +
      '<div class="row"><span class="name">' + esc(herb.name) + '</span>' +
      '<span class="cat">' + esc(herb.category) + '</span></div>' +
      '<div class="alias">' + esc((herb.alias || []).join(' / ')) + '</div>' +
      '<div class="meta">' +
      '<div class="meta-item"><span class="meta-k">规格</span>' +
      '<span class="meta-v">' + esc(herb.spec) + '</span></div>' +
      '<div class="meta-item"><span class="meta-k">市场</span>' +
      '<span class="meta-v">' + esc(herb.market) + '</span></div>' +
      '<div class="meta-item"><span class="meta-k">主产</span>' +
      '<span class="meta-v">' + esc(herb.origin) + '</span></div>' +
      '</div></div>' +

      '<div class="price-panel card">' +
      '<div class="row between">' +
      '<div><div class="pp-label">最新报价 · <span id="dDate"></span></div>' +
      '<div><span class="pp-num" id="dPrice">--</span>' +
      '<span class="pp-unit">' + esc(herb.unit) + '</span></div></div>' +
      '<div class="pp-right"><div class="pp-chg" id="dPct">--</div>' +
      '<div class="tiny muted" id="dAbs"></div></div>' +
      '</div>' +
      '<div class="pp-range" id="dRange"></div>' +
      '</div>' +

      '<div class="tabs" id="tabs">' +
      '<button class="tab" data-range="1y">近1年</button>' +
      '<button class="tab" data-range="3y">近3年</button>' +
      '<button class="tab" data-range="all">全部</button>' +
      '</div>' +

      '<div class="chart-card card">' +
      '<canvas id="chart" width="300" height="220"></canvas>' +
      '<div class="chart-hint">按住图表左右拖动，可查看每个月的具体数值</div>' +
      '</div>' +

      '<div class="stats card">' +
      '<div class="stat"><div class="stat-k">区间最高</div>' +
      '<div class="stat-v up" id="dMax">--</div><div class="stat-d" id="dMaxDate"></div></div>' +
      '<div class="stat-line"></div>' +
      '<div class="stat"><div class="stat-k">区间最低</div>' +
      '<div class="stat-v down" id="dMin">--</div><div class="stat-d" id="dMinDate"></div></div>' +
      '<div class="stat-line"></div>' +
      '<div class="stat"><div class="stat-k">区间均价</div>' +
      '<div class="stat-v" id="dAvg">--</div><div class="stat-d">元/公斤</div></div>' +
      '</div>' +

      '<div class="intro card">' +
      '<div class="intro-title">品种说明</div>' +
      '<div class="intro-text">' + esc(herb.intro) + '</div>' +
      '</div>' +

      '<div class="dfoot">' +
      '<div>数据来源：' + esc(herb.source) + '</div>' +
      '<div>演示数据，仅供参考，不构成任何投资建议</div>' +
      '<div><a href="#/about">数据来源与说明 →</a></div>' +
      '</div>'

    var $ = function (sel) {
      return view.querySelector(sel)
    }

    chart = new window.PriceChart($('#chart'))

    function apply(range) {
      var pts =
        range === '1y' ? all.slice(-12) : range === '3y' ? all.slice(-36) : all.slice()

      var tabs = view.querySelectorAll('.tab')
      for (var i = 0; i < tabs.length; i++) {
        tabs[i].classList.toggle('on', tabs[i].getAttribute('data-range') === range)
      }

      if (pts.length < 2) {
        chart.setData([], { unit: herb.unit })
        return
      }

      var latest = F.latestPoint(pts)
      var ch = F.changeOf(pts, pts.length - 1)
      var st = F.statsOf(pts)

      var minP = { d: pts[0][0], v: Number(pts[0][1]) }
      var maxP = { d: pts[0][0], v: Number(pts[0][1]) }
      for (var j = 1; j < pts.length; j++) {
        var v = Number(pts[j][1])
        if (v < minP.v) minP = { d: pts[j][0], v: v }
        if (v > maxP.v) maxP = { d: pts[j][0], v: v }
      }

      $('#dPrice').textContent = F.fmtPrice(latest.value)
      $('#dDate').textContent = F.cnMonth(latest.date)
      $('#dRange').textContent =
        F.cnMonth(pts[0][0]) + ' — ' + F.cnMonth(pts[pts.length - 1][0]) +
        ' · 共 ' + pts.length + ' 个月'

      var pct = $('#dPct')
      pct.textContent = ch ? F.fmtPct(ch.pct) : '--'
      pct.className = 'pp-chg ' + (ch ? F.dirOf(ch.pct) : 'flat')

      $('#dAbs').textContent = '区间 ' + (ch ? F.fmtAbs(ch.abs) : '--') + ' 元'

      if (st) {
        $('#dMax').textContent = F.fmtPrice(st.max)
        $('#dMin').textContent = F.fmtPrice(st.min)
        $('#dAvg').textContent = F.fmtPrice(st.avg)
      }
      $('#dMaxDate').textContent = F.cnMonth(maxP.d)
      $('#dMinDate').textContent = F.cnMonth(minP.d)

      chart.setData(pts, { unit: herb.unit })
    }

    $('#tabs').addEventListener('click', function (e) {
      var btn = e.target.closest('.tab')
      if (!btn) return
      apply(btn.getAttribute('data-range'))
    })

    apply('all')
  }

  /* ---------------- 说明页 ---------------- */

  function renderAbout() {
    setBar('数据说明', true)
    view.innerHTML =
      '<div class="hero"><div class="hero-title">数据来源与说明</div>' +
      '<div class="hero-sub">最后更新 ' + esc(DATA.generatedAt || '') + ' · PWA 版</div></div>' +

      '<div class="sec card"><div class="sec-title">这是什么</div>' +
      '<p>本应用按月记录常见中草药的<span class="strong">市场报价</span>，并以折线图展示历史走势，' +
      '方便对比不同品种的价格变化节奏。所有价格单位为「元/公斤」。</p></div>' +

      '<div class="sec card"><div class="sec-title">行情数据来源</div>' +
      '<p>当前收录六个品种，价格锚点取自以下公开行情报道：</p>' +
      '<div class="src"><div class="src-name">栀子 · 江西统货</div>' +
      '<div class="src-desc">药通网《栀子行情反弹》（2025-11）；中药材天地网品种页；华夏药材网市场快讯</div></div>' +
      '<div class="src"><div class="src-name">岗梅 · 广州阴阳混合统货</div>' +
      '<div class="src-desc">中药材天地网广东各产地快讯；康美中药网「岗梅根价格」栏目</div></div>' +
      '<div class="src"><div class="src-name">粉防己 · 江西去皮野生个子统货</div>' +
      '<div class="src-desc">药通网《粉防己能否继续高升？》（2025-12）；中药材天地网产地追踪。' +
      '两个数据源对 2024 年 8 月高点的报价有差异（300 元 / 240 元），本应用沿用药通网的连续序列</div></div>' +
      '<div class="src"><div class="src-name">车前草 · 亳州全草统货</div>' +
      '<div class="src-desc">康美中药网亳州市场快讯；中药材天地网品种页；药通网。' +
      '注意「车前草」（全草）与「车前子」（种子）是两个独立商品，价格量级差十倍以上</div></div>' +
      '<div class="src"><div class="src-name">吴茱萸 · 亳州江西中花</div>' +
      '<div class="src-desc">中药材天地网《吴茱萸价低引发投资关注》；康美中药网；药通网。' +
      '历史峰值 2018 年 4 月约 500 元，早于本数据的起始月份，图中看不到</div></div>' +
      '<div class="src"><div class="src-name">蔓荆子 · 江西单叶蔓荆统货</div>' +
      '<div class="src-desc">中药材天地网《蔓荆子下滑明显——进口货源持续拖累着行情？》；' +
      '康美中药网；药通网。历史峰值 2018 年约 220 元，早于本数据的起始月份</div></div>' +
      '<div class="warn">注意：本版本为演示版本。锚点之间的月份由线性插值生成，用于展示图表形态，' +
      '<span class="strong">不是真实成交价</span>。正式使用前请用你自己核对过的行情数据替换。</div></div>' +

      '<div class="sec card"><div class="sec-title">重要声明</div>' +
      '<div class="item"><span class="idx">1</span>本应用仅提供历史价格记录与展示，不提供交易撮合或报价承诺。</div>' +
      '<div class="item"><span class="idx">2</span>本应用不提供用药建议、方剂推荐、疾病诊断等医疗服务内容。</div>' +
      '<div class="item"><span class="idx">3</span>价格受产地、规格、干湿度、批量等因素影响，实际成交价以当地市场为准。</div>' +
      '<div class="item"><span class="idx">4</span>数据不构成任何投资建议，据此操作风险自负。</div></div>' +

      '<div class="sec card"><div class="sec-title">怎么更新数据</div>' +
      '<p>价格只维护一份，在 <code>herb-price-miniapp/data/prices.js</code> 里。改完运行：</p>' +
      '<div class="codeblock">node build-data.js</div>' +
      '<p>网页版就会同步成最新数据。加新品种也是改那边两个文件，再跑一次脚本。</p></div>' +

      '<div class="dfoot">本草行情 · 个人学习项目</div>'
  }

  /* ---------------- 启动 ---------------- */

  function render() {
    if (chart) {
      chart.destroy()
      chart = null
    }
    var r = parseHash()
    if (r.name === 'detail') renderDetail(r.id)
    else if (r.name === 'about') renderAbout()
    else renderList()
    window.scrollTo(0, 0)
  }

  backBtn.addEventListener('click', function () {
    if (parseHash().name === 'list') return
    // 用 replace 而不是 push，避免「按返回 → 系统返回 → 又回到详情」来回横跳
    try {
      history.replaceState(null, '', location.pathname + location.search + '#/')
      render()
    } catch (e) {
      location.hash = '#/'
    }
  })

  window.addEventListener('hashchange', render)

  window.addEventListener(
    'scroll',
    function () {
      appbar.classList.toggle('scrolled', window.scrollY > 4)
    },
    { passive: true }
  )

  render()

  // 注册 Service Worker（file:// 打开时会自动跳过）
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {})
    })
  }
})()
