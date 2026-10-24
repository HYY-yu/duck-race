# Duck Rush

基于 TypeScript、Three.js 和 Vite 的 3D 小鸭竞速抽签工具。输入名单，观看小鸭随水流竞速，按冲线顺序生成结果。

A 3D duck race name picker built with TypeScript, Three.js, and Vite. Enter names, watch the ducks race downstream, and get results in finish order.

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

部署前在 `.env` 中设置 `SITE_URL=https://你的域名`，然后构建并静态托管 `dist/`。
Before deploying, set `SITE_URL` to your HTTPS origin in `.env`, then build and serve `dist/` with a static host.

## 开源协议 / License

[MIT](LICENSE) © 2026 HYY-yu
