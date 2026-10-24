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

PostHog 通过现有 `trackEvent` 入口上报 10 类事件，统一附加 `app=duck_rush` 与 `environment=production|development`。可与 JoyfulWords 共用项目；查看 Duck Rush 时始终添加 `app = duck_rush` 过滤条件，正式指标再加 `environment = production`。其他应用的全项目报表也需要相应的应用过滤条件。

PostHog receives the 10 existing event types through `trackEvent`, with `app=duck_rush` and `environment=production|development`. Shared-project reports must filter by app, and production reports should also filter by environment.

在 `.env.local` 配置以下变量；Cloudflare 自动构建也必须配置相同的 Key 和 host，然后重新构建才能生效。Project API Key 是公开客户端 token，不能使用 Personal API Key。真实配置不提交 Git。

Set these in `.env.local` and in Cloudflare build variables, then rebuild. Use the public project token, never a personal API key; keep real configuration out of Git.

```dotenv
VITE_POSTHOG_KEY=<public project token>
VITE_POSTHOG_HOST=<HTTPS ingestion host from project settings>
VITE_POSTHOG_ENABLE_DEV=false
```

开发模式默认关闭上报，临时设置 `VITE_POSTHOG_ENABLE_DEV=true` 可验证开发事件。无配置时不加载 SDK。启动队列最多保留 100 条；SDK 加载失败或发送失败会记录 Warn，比赛继续运行。

Development capture is off by default; opt in temporarily with `VITE_POSTHOG_ENABLE_DEV=true`. Missing configuration skips SDK loading. Startup queues up to 100 events; failures emit Warn logs without interrupting gameplay.

| 事件 / Event | 内容 / Properties |
| --- | --- |
| `page_view` | language, course |
| `language_switch` | from, to |
| `game_load_started` | language, reason, sinceNavigationMs |
| `game_ready` | language, renderer, course, sinceNavigationMs |
| `race_started` | language, course, entryCount |
| `race_finished` | language, course, entryCount, durationMs, manual |
| `asset_load_finished` | loaded, failed, attachmentFailed, durationMs |
| `asset_stage_finished` | stage, requested, failed, durationMs |
| `asset_failed` | asset, phase, language（按失败点提供 / where available） |
| `web_vital` | language, metric, value |

自动采集、自动页面事件、会话回放、用户画像、自动错误采集均关闭。使用内存匿名 ID，刷新后会改变，因此独立用户数不代表跨访问人数。发送前按白名单移除 URL、来源、用户输入等属性；不采集名单、结果或语音文本。过滤 `app=duck_rush` 后可在 PostHog Activity 查看事件，并用 `page_view → game_load_started → game_ready → race_started → race_finished` 建漏斗。

Autocapture, automatic page events, replay, person profiles, and automatic exception capture are disabled. In-memory anonymous IDs reset on reload, so unique users do not measure returning visitors. A property allowlist excludes URLs, referrers, and user input, including names, results, and transcripts. Filter Activity by `app=duck_rush`; the event sequence above supports a launch-to-finish funnel. See [PostHog configuration](https://posthog.com/docs/libraries/js/config) and the site's bilingual privacy pages.

## 开源协议 / License

[MIT](LICENSE) © 2026 HYY-yu
