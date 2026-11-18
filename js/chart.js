/* 轻量折线图（浏览器 Canvas 2D）
   绘制逻辑和小程序版 components/line-chart 完全一致，只是把组件的生命周期
   换成了 class，并加了自适应宽高 + 指针事件。

   用法：
     const chart = new PriceChart(canvasEl)
     chart.setData([['2024-06', 65], ...], { unit: '元/公斤' })
*/

(function (g) {
  'use strict'

  var PAD = { l: 46, r: 14, t: 16, b: 26 }
  var FONT = '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif'

  function niceStep(raw) {
    if (!(raw > 0)) return 1
    var exp = Math.floor(Math.log10(raw))
    var base = Math.pow(10, exp)
    var f = raw / base
    var nf
    if (f <= 1) nf = 1
    else if (f <= 2) nf = 2
    else if (f <= 5) nf = 5
    else nf = 10
    return nf * base
  }

  function decOf(step) {
    if (step >= 1) return 0
    if (step >= 0.1) return 1
    return 2
  }

  function hexToRgba(hex, a) {
    var h = String(hex || '#2F7D5D').replace('#', '')
    if (h.length === 3) {
      h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2)
    }
    var n = parseInt(h, 16)
    if (!isFinite(n)) return 'rgba(47,125,93,' + a + ')'
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'
  }

  function roundRect(ctx, x, y, w, h, r) {
    var rr = Math.min(r, w / 2, h / 2)
    ctx.beginPath()
    ctx.moveTo(x + rr, y)
    ctx.arcTo(x + w, y, x + w, y + h, rr)
    ctx.arcTo(x + w, y + h, x, y + h, rr)
    ctx.arcTo(x, y + h, x, y, rr)
    ctx.arcTo(x, y, x + w, y, rr)
    ctx.closePath()
  }

  function shortMonth(s) {
    if (!s) return ''
    var p = String(s).split('-')
    if (p.length < 2) return String(s)
    return p[0].slice(2) + '.' + p[1]
  }

  function cnMonth(s) {
    if (!s) return ''
    var p = String(s).split('-')
    if (p.length < 2) return String(s)
    return p[0] + '年' + parseInt(p[1], 10) + '月'
  }

  function fmtPrice(v) {
    var n = Number(v)
    if (!isFinite(n)) return '--'
    return (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, '')
  }

  function PriceChart(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.points = []
    this.unit = '元/公斤'
    this.color = '#2F7D5D'
    this.active = null
    this.w = 0
    this.h = 0
    this._pressed = false
    this._bind()
    this.resize()
  }

  PriceChart.prototype._bind = function () {
    var self = this
    var c = this.canvas

    this._onMove = function (e) {
      var r = c.getBoundingClientRect()
      self.pick(e.clientX - r.left)
    }
    this._onDown = function (e) {
      self._pressed = true
      var r = c.getBoundingClientRect()
      self.pick(e.clientX - r.left)
    }
    this._onUp = function () {
      self._pressed = false
    }
    this._onLeave = function (e) {
      // 手指抬起也会触发 leave，所以只在鼠标时清除
      if (e.pointerType === 'mouse' && !self._pressed) {
        self.active = null
        self.draw()
      }
    }
    this._onResize = function () {
      self.resize()
    }

    c.addEventListener('pointerdown', this._onDown)
    c.addEventListener('pointermove', this._onMove)
    c.addEventListener('pointerup', this._onUp)
    c.addEventListener('pointercancel', this._onUp)
    c.addEventListener('pointerleave', this._onLeave)
    window.addEventListener('resize', this._onResize)

    if (g.ResizeObserver) {
      this._ro = new ResizeObserver(function () {
        self.resize()
      })
      this._ro.observe(c)
    }
  }

  PriceChart.prototype.setData = function (points, opts) {
    this.points = points || []
    if (opts) {
      if (opts.unit) this.unit = opts.unit
      if (opts.color) this.color = opts.color
    }
    this.active = null
    this.draw()
  }

  PriceChart.prototype.resize = function () {
    var rect = this.canvas.getBoundingClientRect()
    var w = Math.round(rect.width)
    var h = Math.round(rect.height)
    if (!w || !h) return
    var dpr = Math.min(g.devicePixelRatio || 1, 3)
    var cw = Math.round(w * dpr)
    var ch = Math.round(h * dpr)
    if (this.canvas.width !== cw || this.canvas.height !== ch) {
      this.canvas.width = cw
      this.canvas.height = ch
    }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.w = w
    this.h = h
    this.draw()
  }

  PriceChart.prototype.pick = function (x) {
    var n = this.points.length
    if (!n || !this.w) return
    var left = PAD.l
    var plotW = this.w - PAD.r - left
    if (plotW <= 0) return
    var rel = (x - left) / plotW
    if (rel < 0) rel = 0
    if (rel > 1) rel = 1
    var idx = Math.round(rel * (n - 1))
    if (idx === this.active) return
    this.active = idx
    this.draw()
  }

  PriceChart.prototype.draw = function () {
    var ctx = this.ctx
    var w = this.w
    var h = this.h
    if (!ctx || !w || !h) return

    var pts = []
    for (var i = 0; i < this.points.length; i++) {
      var p = this.points[i]
      if (p && p.length >= 2 && isFinite(Number(p[1]))) pts.push(p)
    }

    ctx.clearRect(0, 0, w, h)

    if (pts.length < 2) {
      ctx.fillStyle = '#B4BBB6'
      ctx.font = '12px ' + FONT
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('暂无足够数据', w / 2, h / 2)
      return
    }

    var vals = []
    for (var k = 0; k < pts.length; k++) vals.push(Number(pts[k][1]))

    var vmin = Math.min.apply(null, vals)
    var vmax = Math.max.apply(null, vals)
    if (vmax === vmin) vmax = vmin + Math.max(1, vmin * 0.1)
    var padV = (vmax - vmin) * 0.1
    vmin = vmin - padV
    vmax = vmax + padV
    if (vmin < 0) vmin = 0

    var step = niceStep((vmax - vmin) / 4)
    var lo = Math.floor(vmin / step) * step
    var hi = Math.ceil(vmax / step) * step
    var span = hi - lo || 1

    var left = PAD.l
    var right = w - PAD.r
    var top = PAD.t
    var bottom = h - PAD.b
    var plotW = right - left
    var plotH = bottom - top
    if (plotW <= 10 || plotH <= 10) return

    var xOf = function (idx) {
      return pts.length === 1 ? left + plotW / 2 : left + (plotW * idx) / (pts.length - 1)
    }
    var yOf = function (v) {
      return bottom - ((v - lo) / span) * plotH
    }

    var dec = decOf(step)

    // 横向网格 + Y 轴刻度
    var tickCount = Math.round(span / step)
    for (var t = 0; t <= tickCount; t++) {
      var v = lo + step * t
      var y = yOf(v)
      if (y < top - 0.5 || y > bottom + 0.5) continue
      ctx.beginPath()
      ctx.moveTo(left, y)
      ctx.lineTo(right, y)
      ctx.strokeStyle = t === 0 ? '#D8D6CE' : '#EFEEE8'
      ctx.lineWidth = 1
      ctx.stroke()

      ctx.fillStyle = '#98A0A6'
      ctx.font = '10px ' + FONT
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.fillText(Number(v).toFixed(dec), left - 8, y)
    }

    // 面积渐变
    var grad = ctx.createLinearGradient(0, top, 0, bottom)
    grad.addColorStop(0, hexToRgba(this.color, 0.24))
    grad.addColorStop(1, hexToRgba(this.color, 0.015))

    ctx.beginPath()
    ctx.moveTo(xOf(0), yOf(vals[0]))
    for (var a = 1; a < pts.length; a++) ctx.lineTo(xOf(a), yOf(vals[a]))
    ctx.lineTo(xOf(pts.length - 1), bottom)
    ctx.lineTo(xOf(0), bottom)
    ctx.closePath()
    ctx.fillStyle = grad
    ctx.fill()

    // 折线
    ctx.beginPath()
    ctx.moveTo(xOf(0), yOf(vals[0]))
    for (var b = 1; b < pts.length; b++) ctx.lineTo(xOf(b), yOf(vals[b]))
    ctx.strokeStyle = this.color
    ctx.lineWidth = 2
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.stroke()

    // 最新点
    var lastX = xOf(pts.length - 1)
    var lastY = yOf(vals[pts.length - 1])
    ctx.beginPath()
    ctx.arc(lastX, lastY, 4, 0, Math.PI * 2)
    ctx.fillStyle = '#FFFFFF'
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = this.color
    ctx.stroke()

    // X 轴标签
    var nLabel = 5
    if (pts.length < 24) nLabel = 4
    if (pts.length < 10) nLabel = pts.length
    var used = []
    for (var q = 0; q < nLabel; q++) {
      var idx = nLabel === 1 ? pts.length - 1 : Math.round((q * (pts.length - 1)) / (nLabel - 1))
      if (used.indexOf(idx) === -1) used.push(idx)
    }
    ctx.fillStyle = '#98A0A6'
    ctx.font = '10px ' + FONT
    ctx.textBaseline = 'top'
    for (var u = 0; u < used.length; u++) {
      var ii = used[u]
      var xx = xOf(ii)
      var align = 'center'
      if (ii === 0) align = 'left'
      else if (ii === pts.length - 1) align = 'right'
      ctx.textAlign = align
      ctx.fillText(shortMonth(pts[ii][0]), xx, bottom + 8)
    }

    // 气泡
    if (this.active !== null && this.active < pts.length) {
      this._drawTip(ctx, w, h, pts, vals, this.active, xOf, yOf, top, bottom)
    }
  }

  PriceChart.prototype._drawTip = function (ctx, w, h, pts, vals, idx, xOf, yOf, top, bottom) {
    var x = xOf(idx)
    var y = yOf(vals[idx])

    ctx.save()
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(x, top)
    ctx.lineTo(x, bottom)
    ctx.strokeStyle = 'rgba(47,125,93,0.45)'
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.restore()

    ctx.beginPath()
    ctx.arc(x, y, 4.5, 0, Math.PI * 2)
    ctx.fillStyle = '#FFFFFF'
    ctx.fill()
    ctx.lineWidth = 2.5
    ctx.strokeStyle = this.color
    ctx.stroke()

    var line1 = cnMonth(pts[idx][0])
    var line2 = fmtPrice(vals[idx]) + ' ' + this.unit

    ctx.font = '11px ' + FONT
    var w1 = ctx.measureText(line1).width
    ctx.font = 'bold 13px ' + FONT
    var w2 = ctx.measureText(line2).width
    var boxW = Math.max(w1, w2) + 22
    var boxH = 48

    var bx = x + 14
    if (bx + boxW > w - 2) bx = x - 14 - boxW
    if (bx < 2) bx = 2

    var by = y - boxH - 12
    if (by < 2) by = y + 14
    if (by + boxH > h - 2) by = h - boxH - 2

    ctx.save()
    ctx.shadowColor = 'rgba(31,42,36,0.10)'
    ctx.shadowBlur = 10
    ctx.shadowOffsetY = 3
    roundRect(ctx, bx, by, boxW, boxH, 10)
    ctx.fillStyle = 'rgba(255,255,255,0.98)'
    ctx.fill()
    ctx.restore()

    roundRect(ctx, bx, by, boxW, boxH, 10)
    ctx.strokeStyle = '#E6E4DC'
    ctx.lineWidth = 1
    ctx.stroke()

    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillStyle = '#8A948E'
    ctx.font = '11px ' + FONT
    ctx.fillText(line1, bx + 11, by + 9)

    ctx.fillStyle = '#1F2A24'
    ctx.font = 'bold 13px ' + FONT
    ctx.fillText(line2, bx + 11, by + 26)
  }

  PriceChart.prototype.destroy = function () {
    var c = this.canvas
    c.removeEventListener('pointerdown', this._onDown)
    c.removeEventListener('pointermove', this._onMove)
    c.removeEventListener('pointerup', this._onUp)
    c.removeEventListener('pointercancel', this._onUp)
    c.removeEventListener('pointerleave', this._onLeave)
    window.removeEventListener('resize', this._onResize)
    if (this._ro) {
      this._ro.disconnect()
      this._ro = null
    }
    this.points = []
  }

  g.PriceChart = PriceChart
})(window)
