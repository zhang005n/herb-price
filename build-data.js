/**
 * 把小程序项目里的数据同步成浏览器能直接用的 js/data.js
 *
 * 数据只维护一份 —— 就在 herb-price-miniapp/data/ 里。
 * 改完价格后跑一次这个脚本，网页版就同步了：
 *
 *   node build-data.js
 *
 * 可选参数：指定小程序数据目录
 *   node build-data.js ../herb-price-miniapp/data
 */

const fs = require('fs')
const path = require('path')

const dataDir = path.resolve(__dirname, process.argv[2] || '../herb-price-miniapp/data')

const herbs = require(path.join(dataDir, 'herbs.js'))
const prices = require(path.join(dataDir, 'prices.js'))

// 校验：每个品种都要有价格，日期要递增
const problems = []
herbs.forEach((h) => {
  const arr = prices[h.id]
  if (!Array.isArray(arr) || !arr.length) {
    problems.push(`品种 ${h.name}(${h.id}) 没有对应的价格数组`)
    return
  }
  for (let i = 1; i < arr.length; i++) {
    if (arr[i][0] <= arr[i - 1][0]) {
      problems.push(`${h.name} 的日期不是递增：${arr[i - 1][0]} -> ${arr[i][0]}`)
      break
    }
  }
})

if (problems.length) {
  console.error('数据有问题，已中止：')
  problems.forEach((p) => console.error('  - ' + p))
  process.exit(1)
}

const payload = {
  generatedAt: new Date().toISOString().slice(0, 10),
  herbs: herbs,
  prices: prices
}

const header =
  '// 自动生成，请勿手改。\n' +
  '// 源文件：herb-price-miniapp/data/herbs.js 与 prices.js\n' +
  '// 重新生成：node build-data.js\n\n'

const out = path.join(__dirname, 'js', 'data.js')
fs.writeFileSync(out, header + 'window.HERB_DATA = ' + JSON.stringify(payload, null, 2) + ';\n', 'utf-8')

console.log('已写入 ' + out)
herbs.forEach((h) => {
  console.log(`  ${h.name}: ${prices[h.id].length} 个点`)
})
