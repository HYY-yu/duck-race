# 菲律宾英文首页联合本地验收 — 2026-10-26

起始 HEAD：`9818d0433d5d6cc4526f5c9fa7ca5b2a91694f85`。新会话从当前文件重新读取、构建和验收，没有恢复旧会话。仓库及直接父目录无 AGENTS.md，仓库无 .agents；已读 README、package.json、SEO 文档和现有验收说明。参考 frontend-skill 保持现有布局，遵守本轮不增加动画的要求。

## 文件与保护

起始未提交文件共六个：`en/index.html`、`src/main.ts`、`src/style.css`、`docs/SEO.md`、`scripts/check-seo-build.mjs`、`tests/seo.test.ts`。完整起始差异见 [duck-seo-start.patch](duck-seo-start.patch)。本轮审阅后认为已有最小首页改动符合范围，未重写这六个文件，只新增本目录的验收记录与截图。`src/main.ts` 起始差异仅英文介绍；不能据此把整个文件或已提交游戏工作归属给首页任务。main/CSS/英文首页起始哈希复核全部一致。没有改物理、模型、材质、赛道、埋点、身份或隐私，没有回退用户工作，没有提交、push、部署或访问生产游戏。

首页改动清单：英文 HTML 的 title/meta/OG/Twitter、免费 WebApplication 标识、正文与 FAQ、虚构输入→完整排名摘录；main.ts 仅英文介绍与静态壳同步；共享 CSS 仅新增 `.draw-example` 样式与 600px 单列规则；SEO 测试和生产检查同步；SEO.md 记录 PH 证据及观察规则。

## 关键英文文案

- Title: Free Online Duck Race Name Picker – 2–12 Names | Duck Rush
- H1: Duck Race Name Picker
- Intro: Free in your browser. Add 2–12 unique names, race in 3D, and copy the full finishing order.
- Example: Illustrative example / Made-up names and ranking, not a recorded draw. Your race can finish differently.
- Fairness: not a certified draw or proof of identical physical odds on every course.

不新增同义词页、地域页或越南语入口。既有公平说明保留，不承诺等概率。实验针对 PH 词簇；GSC 已收录与当地 SERP 未见本站是不同证据。观察须在另行批准上线且确认新版被抓取后开始；28天100展示5点击、42天低于20展示是设计门槛，不是预测或统计显著性。不能将 GSC 点击拼接到全站 PostHog 完赛漏斗。

## 自动检查

- `npm test`：135/135 通过，0 失败、跳过或取消；[完整日志](duck-seo-tests.log)。
- `SITE_URL=https://duckracepicker.com npm run build`：通过；包含严格 `tsc` noEmit 类型检查、Vite 生产构建与 SEO 产物检查；[完整日志](duck-seo-build.log)。现有 Three.js chunk 超过500kB提示，不是构建失败，本轮未扩展性能改动。
- canonical/hreflang、单一 title/meta/H1、公开构建不含人工模式、短入口原样复制：生产检查通过。robots 允许抓取且 sitemap 指向正式域名，sitemap 仍为六个中英文主页/规则/隐私 URL，无新薄页。
- 本地缓存 Wrangler 4.152.0 静态资产模式实测：`/x?seed=bad&utm_source=other` 返回302与固定 X三参数；`/t?track=long` 返回302与固定TikTok三参数，传入查询未进入目标。

## Mac 浏览器验收

使用用户 Mac 上本会话新建的内置浏览器临时标签，生产 dist，独立端口5196。本地预览加响应头 `connect-src 'self' blob:; img-src 'self' data: blob:`，阻止外部分析连接、允许模型内嵌blob贴图；未改仓库服务或生产CSP。短入口在独立5197的原生 Wrangler 实例以HTTP响应验证，未加载生产游戏。初次沙箱内监听被系统EPERM阻止；经已授权本地验收的工具提权成功，没有未解决的拒绝。

桌面设置1440×900、窄屏设置391×844；Mac浏览器缩放后页面报告桌面innerWidth1309、窄屏355（innerHeight767），记录实际CSS尺寸，不将其冒充手机真机。可见场景、名单颜色与模型贴图正常；document scrollWidth 不大于 innerWidth（窄屏clientWidth342、scrollWidth342），菜单打开时内容在视口内；示例在窄屏为单列。通过Enter打开编辑、开始、复制及窄屏菜单，控件有可见键盘焦点。未做全站无障碍认证。

英文三人：UI录入 Alex/Sam/Robin→保存→Enter开赛→自然完成→结果弹窗→Enter复制→同名单再抽。结果 Robin(28.12s)、Sam(28.77s)、Alex(28.94s)，复制内容含相同完整顺序、ID与本地记录说明；再抽回到待开始并保留三人名单。抽签ID `DR-31db645001495400f32b4476de336c17`，race seed2119274694，track seed42。没有注入状态、替换随机数、加速仿真或使用inspect参数。

浏览器自动化有几次定位/时机失败：早期等待结果时比赛仍进行；再抽按钮在背景与结果弹窗各有一个，改用当前弹窗ID；中文保存后菜单自动关闭，额外关闭操作失败后按实际页面继续。这些不是测试通过证据，最终以可见结果与剪贴板内容为准。

中文窄屏双人也通过UI输入→开赛→自然完整排名→复制→同名单再抽。小陈28.90s、小林29.60s，UI总计时29.61s，ID `DR-e53b25b6d2b7992ac6f049bcb34514b0`，race seed4042578419，track seed42。复制顺序一致，见 [复制文本](duck-seo-zh-copy.txt)。中文桌面刷新后回到正常默认名单与待开始。英文桌面示例实测双栏、窄屏单栏；两轮浏览器warn/error日志均为空。未测移动真机、其他浏览器、全赛道及全部随机种子。

本轮临时标签已关闭、视口覆盖已重置。两个自建服务停止后复核，未动用户原有进程。

## 截图

- [英文桌面首屏](duck-seo-desktop.jpg)
- [英文完整结果](duck-seo-results.jpg)
- [英文窄屏虚构示例](duck-seo-example-narrow.jpg)
- [中文窄屏首屏](duck-seo-zh-narrow.jpg)

仅保证本轮实际覆盖的联合工作树与操作，不为用户游戏逻辑的全部随机种子或移动真机性能背书。没有发布授权，未上线；无收费接口或新增依赖。

- [英文桌面双栏示例](duck-seo-example-desktop.jpg)
- [中文窄屏完整结果](duck-seo-zh-results.jpg)
- [中文桌面首屏](duck-seo-zh-desktop.jpg)
