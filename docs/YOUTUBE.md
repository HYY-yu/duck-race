# Duck Rush YouTube version

YouTube 专用竞速版本与官网名单抽签版本使用独立入口。当前为可本地验收的适配版本，尚未通过 YouTube Playables 认证。

The YouTube racing version has a separate entry from the website name picker. This is a locally testable adaptation, not a certified Playables release.

## 开发与构建 / Development and build

```sh
npm run dev:youtube       # http://127.0.0.1:5184/
npm run build:youtube     # dist-youtube/
npm run preview:youtube   # preview dist-youtube/ on port 5184
```

官网仍使用 `npm run dev`、`npm run build` 和 `dist/`。不要修改 Cloudflare 的构建或发布命令；不要把 `dist-youtube/` 发布到官网。YouTube 构建不读取官网环境配置，不复制官网路由、SEO 页面或重定向，仅打包独立页面、游戏脚本和本地 GLB。构建检查验证资源使用相对路径，并排除 PostHog、语音识别、本地存储与剪贴板能力。

The website continues to use its existing commands and `dist/`. Keep Cloudflare configuration unchanged. The YouTube build has its own environment, root and output, and packages only the game and local models.

## 玩法 / Gameplay

- 12 只固定颜色与编号小鸭，开赛前选择自己控制的小鸭；没有姓名输入、历史或复制结果。
- 按住触屏左右按钮，或使用 A/D、左右方向键控制所选小鸭横向拨水。水流仍提供前进速度，其他小鸭自动竞速。
- 同时按左右互相抵消；松手、取消触摸、失焦、暂停、重开及所选鸭冲线后清除输入。
- 全局和跟随镜头都可以操控同一只已选小鸭；比赛中不能更换控制对象。
- 支持中英文界面与内存中的切换；默认雪岭激流，沿用已有赛道物理、渲染和模型。
- 手机工具栏使用保留文字标签的图标按钮，交互区域至少 44px；窄屏使用四列选鸭，矮横屏使用紧凑侧栏。比赛期间显示触屏操作提示。
- 结算排名可独立滚动；“再来一场”先返回选鸭界面，可更换颜色与编号后再开赛。

Choose a duck by its fixed number and color, then hold touch controls or A/D / arrow keys to steer. The current propels all ducks. The selected duck stays fixed throughout the race. Overview and follow cameras share the same controls. Results show the full finishing order, without personal data entry or persistence.

Mobile toolbars use labeled icons with at least 44px targets. Narrow screens use four duck columns; short landscape screens use a compact side panel. Rankings scroll independently, and Race again returns to duck selection before the next start.

## 平台适配 / Platform integration

`youtube/index.html` 在游戏模块之前加载官方 SDK。实际 Playables 环境通过 SDK 处理首帧、可交互、暂停/恢复、音量与初始语言；平台暂停时停止主渲染循环、清除输入并挂起音频。浏览器可见性 API 仅在本地预览中使用。平台环境使用 YouTube 音量控制，本地预览额外提供音效开关。WebGL 上下文丢失时停止游戏、记录错误并提示重新加载。

The SDK is loaded before the game. Hosted Playables use SDK readiness, lifecycle, audio and language APIs. Local previews work without an active SDK. Console logs record lifecycle and numeric game state; SDK health receives errors. No external analytics adapter, microphone or voice recognition is installed.

## 发布前验收 / Before submission

在实际获准的 Playables 环境运行官方 Test Suite，并完成 YouTube 桌面、Android 和 iOS 真机验证，重点检查 SDK 生命周期、音频恢复、触摸取消、性能、加载时间和审核素材。共享场景的渐进模型加载任务与已发起的资源请求目前不提供取消接口，需在平台暂停测试中核对。未接入云存档或排行榜，目前没有需要持久保存的进度；若认证要求这些能力，需继续适配。仅本地测试不能证明已符合完整认证规范。

Run the official Test Suite and real YouTube desktop, Android and iOS acceptance before submission. Validate lifecycle, audio, multi-touch, performance, loading and required listing assets. Shared progressive model loading does not expose cancellation for pending tasks/requests and needs platform-pause validation. Cloud saves and leaderboards are not implemented; assess requirements during certification.

References: [SDK](https://developers.google.com/youtube/gaming/playables/reference/sdk), [Integration](https://developers.google.com/youtube/gaming/playables/certification/requirements_integration), [Privacy](https://developers.google.com/youtube/gaming/playables/certification/requirements_privacydata).
