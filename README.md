# 本草行情 · PWA 版

小程序版的网页版，**同一个数据源、同一套图表逻辑**，但不需要微信、不需要备案、不需要审核。

- 双击 `index.html` 就能看，不需要装任何东西
- 手机上「添加到主屏幕」后，有独立图标、全屏打开，看起来和原生 App 一样
- 断网也能用（Service Worker 缓存）
- 整个应用 **约 90 KB**（不含图片）

---

## 一、三种打开方式

### 1. 电脑上直接看（10 秒）

双击 `index.html`。

功能全部正常。唯一区别是没有「添加到主屏幕」和离线缓存（`file://` 协议不支持 Service Worker，代码里已经做了跳过处理）。

### 2. 手机上看（同一个 WiFi，2 分钟）

在项目目录下开一个临时服务器：

```bash
# 有 Python
python -m http.server 8000

# 或者有 Node
npx serve -l 8000

# 或者有 pnpm
pnpm dlx serve -l 8000
```

然后查一下电脑的局域网 IP（Windows 下 `ipconfig`，看「IPv4 地址」，形如 `192.168.1.23`），
手机浏览器访问 `http://192.168.1.23:8000`。

> 注意：`http://` 下 Service Worker 不会注册，所以离线缓存不可用，
> 「添加到主屏幕」得到的也只是普通网页快捷方式（打开时带地址栏）。
> 想要真·App 体验，看下面第 3 种。

### 3. 部署到公网 → 变成真正的 App（推荐）

需要 HTTPS，Service Worker 才会生效。免费方案里最省事的是 GitHub Pages。

**步骤：**

1. 注册 <https://github.com>（免费）
2. 右上角「+」→ New repository
   - Repository name：`herb-price`（随便取）
   - 选 **Public**
   - 点 Create
3. 在新仓库页面点「uploading an existing file」
   - 把 `herb-price-pwa` 文件夹**里面的所有内容**拖进去
     （`index.html`、`css/`、`js/`、`icons/`、`manifest.webmanifest`、`sw.js`）
   - 点 Commit changes
4. 仓库页 → Settings → 左侧 Pages
   - Source 选 **Deploy from a branch**
   - Branch 选 **main**，目录选 **/ (root)**
   - 点 Save
5. 等 1~2 分钟，页面顶部会出现网址：
   `https://你的用户名.github.io/herb-price/`

手机浏览器打开这个网址，就可以安装了。

> 国内访问 GitHub Pages 有时较慢。如果嫌慢，可以换 Cloudflare Pages、Vercel、Netlify，
> 部署方式类似（都是「连仓库 → 自动构建静态站」）。自己的服务器 + 已备案域名当然最快。

---

## 二、装到手机主屏幕

**安卓（Chrome / Edge）**
打开网址 → 右上角「⋮」→ **「安装应用」** 或 **「添加到主屏幕」**。
如果看到「安装应用」，说明 PWA 生效了，会装成一个独立 App（有图标、全屏、无地址栏）。

**iPhone（Safari）**
打开网址 → 底部「分享」按钮 → **「添加到主屏幕」**。
注意必须用 Safari，微信内置浏览器不行。

装好后从桌面点开，就是全屏的，跟 App 一样。

---

## 三、数据怎么更新

**数据只维护一份**，就在小程序项目里：`herb-price-miniapp/data/prices.js`。

改完价格后，回到本目录跑一次：

```bash
node build-data.js
```

`js/data.js` 会被重新生成，网页版就同步了。

> 脚本会顺手校验：每个品种必须有价格数组、日期必须严格递增。有问题会直接报错并中止。

如果改的是代码（不是数据），记得把 `sw.js` 第一行的 `VERSION` 加 1：

```js
const VERSION = 'v2'   // 原来是 v1
```

否则手机会一直用缓存的旧版本。

---

## 四、文件结构

```
herb-price-pwa/
├── index.html              页面骨架
├── manifest.webmanifest    PWA 配置（名字、图标、全屏模式）
├── sw.js                   Service Worker（离线缓存）
├── css/style.css           全部样式
├── js/
│   ├── data.js             ★ 自动生成，别手改
│   ├── util.js             格式化工具
│   ├── chart.js            折线图（Canvas 2D，和小程序版同一套算法）
│   └── app.js              路由 + 视图
├── icons/                  192 / 512 / maskable / iOS 图标
├── build-data.js           从小程序项目同步数据
└── tools/
    ├── make_icons.py       重新生成图标
    └── smoke-test.js       自检脚本
```

---

## 五、换成你自己的图标

改 `tools/make_icons.py` 里的 `GREEN`（底色）和 `SHAPE`（折线形状，归一化坐标），然后：

```bash
python tools/make_icons.py
```

想用一张现成的图片？直接把图片转成 192/512/maskable 三个尺寸，覆盖 `icons/` 下的同名文件即可。

> maskable 图标要留安全区：安卓会把图标裁成圆形/水滴形，图形必须放在中间约 80% 的区域内，
> 否则边缘会被切掉。本项目的 `icon-maskable-512.png` 已经把图形缩到 68%。

---

## 六、常见问题

**Q：手机上打开还是旧版本？**
改 `sw.js` 里的 `VERSION`。改完刷新两次，或者把 App 删掉重装。

**Q：装了以后图标是白底/默认图标？**
`manifest.webmanifest` 里的图标路径要能访问到。检查部署后能不能直接打开
`https://你的域名/icons/icon-192.png`。

**Q：iPhone 上没有「安装应用」选项？**
iOS 只支持「添加到主屏幕」，且必须用 Safari。iOS 对 PWA 的支持比安卓弱一些（没有推送、没有后台同步），
但看图表完全够用。

**Q：图表滑动时页面跟着滚？**
图表已经设了 `touch-action: pan-y`：竖直滑动是滚页面，水平拖动才是查看数值。
如果你觉得不好用，可以在 `css/style.css` 里把 `#chart` 的 `touch-action` 改成 `none`（会锁死滚动）或 `auto`。

**Q：能离线看吗？**
部署到 HTTPS 后可以。第一次打开会把所有资源缓存，之后断网也能用。
（前提是数据已经打包进 `js/data.js`——本项目就是这么做的。）

---

## 七、和小程序版的关系

| | 小程序版 | PWA 版 |
|---|---|---|
| 数据源 | `herb-price-miniapp/data/` | 同一个（由 `build-data.js` 同步） |
| 图表算法 | `components/line-chart/` | `js/chart.js`（同一套布局和绘制逻辑） |
| 配色 | 同一套 CSS 变量 | 同一套 CSS 变量 |
| 发布 | 要认证 + 备案 + 审核 | 传到静态托管，1 分钟生效 |
| 分发 | 微信扫码 / 搜索 | 发网址 |

两边可以同时维护，改数据只需要动一处。

---

## 数据来源

| 品种 | 规格 | 参考来源 |
|---|---|---|
| 栀子 | 江西统货 | 药通网《栀子行情反弹》(2025-11)、中药材天地网、华夏药材网市场快讯 |
| 岗梅 | 广州阴阳混合统货 | 中药材天地网广东产地快讯、康美中药网「岗梅根价格」 |
| 粉防己 | 江西去皮野生个子统货 | 药通网《粉防己能否继续高升？》(2025-12)、中药材天地网 |
| 车前草 | 亳州全草统货 | 康美中药网亳州市场快讯、中药材天地网、药通网 |
| 吴茱萸 | 亳州江西中花 | 中药材天地网《吴茱萸价低引发投资关注》、康美中药网、药通网 |
| 蔓荆子 | 江西单叶蔓荆统货 | 中药材天地网《蔓荆子下滑明显》、康美中药网、药通网 |

> 吴茱萸（2018 年 4 月约 500 元）和蔓荆子（2018 年约 220 元）的历史峰值都早于数据起始月份，图中不含。
>
> 粉防己的 2024 年 8 月高点，药通网报 300 元、中药材天地网报 240 元，两个数据源口径不同，
> 本项目沿用药通网的连续序列。

> 价格为演示数据（锚点真实、中间月份为插值），仅供学习参考，不构成投资建议。
