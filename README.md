# Duck Rush

基于 TypeScript、Three.js 和 Vite 的 3D 小鸭竞速抽签工具。输入名单，观看小鸭随水流竞速，按冲线顺序生成结果。

A 3D duck race name picker built with TypeScript, Three.js, and Vite. Enter names, watch the ducks race downstream, and get results in finish order.

线上地址 / Live site: [https://duckracepicker.com](https://duckracepicker.com)

## 特性 / Features

- 支持 2–12 位参与者与自定义鸭子颜色 / 2–12 participants with custom duck colors
- 两条 3D 赛道，包含急流、瀑布与碰撞障碍 / Two 3D courses with rapids, waterfalls, and obstacles
- 全局与小鸭跟随镜头，支持暂停和音效 / Overview and follow cameras, pause controls, and sound effects
- 完整排名、结果复制与最近 10 场本地记录 / Full rankings, copyable results, and 10 recent races stored locally
- 中文和英文界面 / Chinese and English interfaces
- 手机端全宽画布与抽屉菜单（≤1000px），底部快捷开始／暂停；支持横竖屏 / Full-width mobile scene and drawer menu (≤1000px), with quick start/pause in portrait and landscape

## 启动 / Getting started

需要 Node.js 22.18+ 和 npm。Requires Node.js 22.18+ and npm.

```bash
npm ci
npm run dev
```

打开 / Open: [中文](http://127.0.0.1:5183/zh/) · [English](http://127.0.0.1:5183/en/)

```bash
npm test         # 运行测试 / Run tests
npm run build    # 构建到 dist/ / Build to dist/
npm run preview  # 预览构建 / Preview the build
```

## 手机性能 / Mobile performance

触屏设备比赛目标为 60fps，待机 30fps，暂停／菜单 15fps；拖动全局镜头时恢复 60fps。比赛仿真仍使用独立的 60Hz 固定步长。页面隐藏或游戏完全离开视口时停止渲染；进行中的比赛离屏会暂停，返回后点击继续。

Touch devices target 60fps during races and camera interaction, 30fps while idle, and 15fps while paused or in menus. Simulation keeps its independent 60Hz fixed timestep. Hidden/offscreen scenes stop rendering; an offscreen race pauses until resumed.

森林按空间分块剔除视野外实例，保留全部树木、模型、纹理、水面与 2048px 阴影。触屏阴影更新上限为比赛 30Hz、待机／暂停 15Hz；像素比上限仍为 1.75。`window.__DUCK_RUSH__.performance` 提供本地只读诊断（实际渲染帧率、目标帧率、主线程每帧工作时间和阴影更新计数），不代表 GPU 时间或设备温度。

Spatial tree batches preserve all scenery, assets, water shading, 2048px shadows and the 1.75 pixel-ratio cap. Mobile shadows update at up to 30Hz during races and 15Hz otherwise. Read-only local diagnostics in `window.__DUCK_RUSH__.performance` report render pacing and CPU work, not GPU time or temperature.

[Android 模拟器测试记录 / Android emulator measurements](docs/MOBILE-PERFORMANCE.md)

## 生产部署 / Production deployment

生产站点使用 Cloudflare Workers Static Assets，连接 GitHub 仓库 `HYY-yu/duck-race` 的 `main` 分支自动构建。公开构建只运行 `npm run build`，不会启用本机人工控制模式。

The production site uses Cloudflare Workers Static Assets and builds automatically from the `main` branch of `HYY-yu/duck-race`. Production runs only `npm run build`; the local manual-control mode is never enabled.

```text
SITE_URL=https://duckracepicker.com
Build command: npm run build
Deploy command: npx wrangler deploy --assets ./dist/ --name duckracepicker --compatibility-date 2026-10-24
```

`SITE_URL` 负责生成正式 canonical、hreflang、Open Graph URL、`robots.txt` 和 `sitemap.xml`。Cloudflare 的构建变量中已经配置该值；其他部署环境必须显式提供自己的 HTTPS origin。

`SITE_URL` generates production canonical, hreflang, Open Graph URLs, `robots.txt`, and `sitemap.xml`. It is configured as a Cloudflare build variable; other deployment environments must explicitly provide their own HTTPS origin.

## 产品分析 / Product analytics

PostHog 通过现有 `trackEvent` 入口上报 12 类事件，统一附加 `app=duck_rush` 与 `environment=production|development`。可与 JoyfulWords 共用项目；查看 Duck Rush 时始终添加 `app = duck_rush` 过滤条件，正式指标再加 `environment = production`。其他应用的全项目报表也需要相应的应用过滤条件。

PostHog receives the 12 event types through `trackEvent`, with `app=duck_rush` and `environment=production|development`. Shared-project reports must filter by app, and production reports should also filter by environment.

在 `.env.local` 配置以下变量；Cloudflare 自动构建也必须配置相同的 Key 和 host，然后重新构建才能生效。Project API Key 是公开客户端 token，不能使用 Personal API Key。真实配置不提交 Git。

Set these in `.env.local` and in Cloudflare build variables, then rebuild. Use the public project token, never a personal API key; keep real configuration out of Git.

```dotenv
VITE_POSTHOG_KEY=<public project token>
VITE_POSTHOG_HOST=<HTTPS ingestion host from project settings>
VITE_POSTHOG_ENABLE_DEV=false
```

开发模式默认关闭上报，临时设置 `VITE_POSTHOG_ENABLE_DEV=true` 可验证开发事件。无配置时不加载 SDK。启动队列最多保留 100 条；SDK 加载失败或发送失败会记录 Warn，比赛继续运行。

Development capture is off by default; opt in temporarily with `VITE_POSTHOG_ENABLE_DEV=true`. Missing configuration skips SDK loading. Startup queues up to 100 events; failures emit Warn logs without interrupting gameplay.

生产构建仅在浏览器真实 origin 精确为 `https://duckracepicker.com` 时初始化并发送 PostHog 分析；默认 HTTPS 443 端口等价。localhost、局域网、预览域、www、其他子域、HTTP 与非标准端口均禁用，即使带正式 token 或伪造事件环境字段也不例外。SSR/缺少 location 时同样禁用。开发构建仍须显式开启，事件固定标记为 development。本保护用于防止本应用的本地验收误报，不是阻止第三方伪造 capture 的认证机制；公开客户端 token 仍非秘密。

Production builds initialize and send PostHog analytics only when the browser's actual origin is exactly `https://duckracepicker.com` (including the equivalent default HTTPS port). Local, preview and other origins are disabled before SDK loading, regardless of event properties or campaign tags. Opted-in development builds keep their development label. This prevents accidental reporting by this app; it does not authenticate third-party capture requests.

| 事件 / Event | 内容 / Properties |
| --- | --- |
| `page_view` | language, course |
| `language_switch` | from, to |
| `game_load_started` | language, reason, sinceNavigationMs |
| `game_ready` | language, renderer, course, sinceNavigationMs |
| `race_started` | language, course, entryCount |
| `race_replayed` | language, course, entryCount · 同名单再抽真正开始，每轮最多一次 / Actual start of a requested replay, once per round |
| `results_copied` | language, course, entryCount · 成功复制，每轮最多一次 / Successful clipboard write, once per round |
| `race_finished` | language, course, entryCount, durationMs, manual |
| `asset_load_finished` | loaded, failed, attachmentFailed, durationMs |
| `asset_stage_finished` | stage, requested, failed, durationMs |
| `asset_failed` | asset, phase, language（按失败点提供 / where available） |
| `web_vital` | language, metric, value |

自动采集、自动页面事件、会话回放、用户画像、自动错误采集均关闭。使用内存匿名 ID，刷新后会改变，因此独立用户数不代表跨访问人数。发送前按白名单移除 URL、来源、用户输入等属性；不采集名单、结果或语音文本。过滤 `app=duck_rush` 后可在 PostHog Activity 查看事件，并用 `page_view → game_load_started → game_ready → race_started → race_finished` 建漏斗。

Autocapture, automatic page events, replay, person profiles, and automatic exception capture are disabled. In-memory anonymous IDs reset on reload, so unique users do not measure returning visitors. A property allowlist excludes URLs, referrers, and user input, including names, results, and transcripts. Filter Activity by `app=duck_rush`; the event sequence above supports a launch-to-finish funnel. See [PostHog configuration](https://posthog.com/docs/libraries/js/config) and the site's bilingual privacy pages.

## 开源协议 / License

[MIT](LICENSE) © 2026 HYY-yu


## 首轮渠道标签 / Launch attribution

仅保留完整且唯一的固定组合：`utm_source=x|tiktok`、`utm_medium=social`、`utm_campaign=duck_rush_launch_2026_10`。source/medium/campaign 长度上限为 8/16/32，总查询字符串最多 2048 字符；未知、缺失、重复或超长的组合整体丢弃。不采集 utm_content 或任意其他 URL 参数。标签在页面入口读取一次，仅存于内存，附加到本次页面中的所有已允许事件；不读取 referrer、不更改匿名身份或写入分析存储。刷新后只重新读取当时链接，不恢复再抽/复制状态，不把刷新算重赛。

The three closed launch tags above are captured once per page load and attached to allowed events. Unknown, incomplete, duplicate or oversized tuples are dropped. No arbitrary URLs, referrers, names, results, or query values are collected. Memory-only identity stays unchanged.

- 再抽：完成后点“同名单再抽”只准备下一轮；用户实际点击开始且成功创建新一轮时发 `race_replayed`。普通重新开始或应用名单设置会取消待再抽标记。每轮不会因为重复开始点击重复计数。
- 复制：`results_copied` 只在剪贴板写入成功后发出，每轮最多一次；失败不计，允许重试；并发双击只进行一次写入。重新打开同一结果不会清除去重状态。
- 这些是匿名行为事件，不等于不同用户、跨访问留存或严格转化率。UTM 可以用来比较本次渠道标签下的事件，不能证明用户真实来自该平台。

待发布链接（发布前先由运营方确认并部署本改动）：

- X: `https://duckracepicker.com/en/?utm_source=x&utm_medium=social&utm_campaign=duck_rush_launch_2026_10`
- TikTok: `https://duckracepicker.com/en/?utm_source=tiktok&utm_medium=social&utm_campaign=duck_rush_launch_2026_10`


## 自有域名短入口 / Owned-domain short entrances

待发布：`https://duckracepicker.com/x`（X）与 `https://duckracepicker.com/t`（TikTok）。
`public/_redirects` 由 Vite 原样复制为 `dist/_redirects`，由 Cloudflare Workers Static Assets 原生处理 HTTP 302；沿用上方 main 自动发布流程，无需新服务或 Worker 脚本。
两条规则只匹配精确路径 `/x`、`/t`（不包含尾斜杠、子路径或大小写变体），目的地固定为 `/en/` 加现有白名单三参数。目的地已有查询串会替换入口传入的查询串，不能用追加参数覆盖渠道，不传递 seed、track 或任意额外输入；浏览器片段不参与服务器路由。目的地不匹配短入口，因此无重定向循环；`/en/` 地址栏保留原有统计参数，不额外清理。

These exact 302 rules use Cloudflare's native static asset redirects. Incoming query strings are replaced by the fixed destination query. No wildcard routes, new tracking fields, identity changes, or client redirects are added. Rules are checked in the built output; Vite dev and the basic `npm run preview` file server do not emulate Cloudflare redirects. For routing acceptance, use an isolated, telemetry-disabled build with local Wrangler assets mode. Deployment and production collection still require separate approval.
