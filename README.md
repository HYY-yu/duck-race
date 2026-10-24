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

## 开源协议 / License

[MIT](LICENSE) © 2026 HYY-yu
