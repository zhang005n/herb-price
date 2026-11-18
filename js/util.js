/* 格式化小工具（与小程序版 utils/format.js 保持一致） */
(function (g) {
  'use strict'

  function toNum(v) {
    var n = Number(v)
    return isFinite(n) ? n : null
  }

  function latestPoint(points) {
    if (!points || !points.length) return null
    var p = points[points.length - 1]
    var v = toNum(p[1])
    if (v === null) return null
    return { date: p[0], value: v }
  }

  function changeOf(points, backMonths) {
    if (!points || points.length < 2) return null
    var lastIdx = points.length - 1
    var baseIdx = lastIdx - backMonths
    if (baseIdx < 0) baseIdx = 0
    var from = toNum(points[baseIdx][1])
    var to = toNum(points[lastIdx][1])
    if (from === null || to === null || from === 0) return null
    var abs = to - from
    return {
      baseDate: points[baseIdx][0],
      baseValue: from,
      lastDate: points[lastIdx][0],
      lastValue: to,
      months: lastIdx - baseIdx,
      abs: abs,
      pct: (abs / from) * 100
    }
  }

  function statsOf(points) {
    if (!points || !points.length) return null
    var vals = []
    for (var i = 0; i < points.length; i++) {
      var v = toNum(points[i][1])
      if (v !== null) vals.push(v)
    }
    if (!vals.length) return null
    var min = vals[0]
    var max = vals[0]
    var sum = 0
    for (var j = 0; j < vals.length; j++) {
      if (vals[j] < min) min = vals[j]
      if (vals[j] > max) max = vals[j]
      sum += vals[j]
    }
    return { min: min, max: max, avg: sum / vals.length, count: vals.length }
  }

  function sliceLast(points, n) {
    if (!points || !points.length) return []
    if (!n || n >= points.length) return points.slice()
    return points.slice(points.length - n)
  }

  function fmtPrice(v) {
    var n = toNum(v)
    if (n === null) return '--'
    return (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, '')
  }

  function fmtPct(v) {
    var n = toNum(v)
    if (n === null) return '--'
    return (n > 0 ? '+' : '') + n.toFixed(1) + '%'
  }

  function fmtAbs(v) {
    var n = toNum(v)
    if (n === null) return '--'
    return (n > 0 ? '+' : '') + (Math.round(n * 10) / 10).toFixed(1)
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

  function dirOf(v) {
    var n = toNum(v)
    if (n === null || n === 0) return 'flat'
    return n > 0 ? 'up' : 'down'
  }

  g.HerbFmt = {
    toNum: toNum,
    latestPoint: latestPoint,
    changeOf: changeOf,
    statsOf: statsOf,
    sliceLast: sliceLast,
    fmtPrice: fmtPrice,
    fmtPct: fmtPct,
    fmtAbs: fmtAbs,
    shortMonth: shortMonth,
    cnMonth: cnMonth,
    dirOf: dirOf
  }
})(window)
