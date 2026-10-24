# 手机渲染性能 / Mobile rendering performance

2026-10-24：在 Android 模拟器完成基线与本地优化版对比。基线是 `42fd0fd`；两边均使用生产构建、相同设备参数和原有画质。此记录不代表真机温度、耗电或真机帧率验收。

Android emulator comparison against `42fd0fd`, preserving the existing visual settings. These measurements do not establish physical-device thermal, battery, or frame-rate behavior.

## 实测结果

| 场景 | 基线实际 FPS | 优化后实际 FPS | rAF P95 帧间隔 | 主场景三角形提交（单帧快照） |
| --- | ---: | ---: | --- | --- |
| 雪岭激流，6 人，同种子跟随镜头 | 43.13 | 60.07 | 33.4 → 16.7ms | 15,307,216 → 1,806,356 |
| 松风山谷，12 人，同种子跟随镜头 | 60.00 | 59.93 | 16.7 → 16.7ms | 1,995,938 → 1,281,730 |
| 雪岭激流，全局待机 | 39.07 | 30.07（主动限帧） | 不比较：优化后 rAF 回调仍为 60Hz | 15,404,630 → 11,595,306 |

每次采样 15 秒。雪岭比赛和松风比赛分别固定物理种子 `110225632`、`2146095206`，从比赛时间约 6.02 秒采至约 21.10 秒。只在 localhost 基准测试点击开始时临时替换随机源，随后立即恢复；产品随机源及生产逻辑未变。

- 待机 15 秒主线程 TaskDuration：2437 → 1507ms，减少约 **38%**。
- 松风 12 人比赛：4412 → 4168ms，减少约 **6%**。
- 雪岭比赛：2731 → 3654ms。实际输出帧数也从约 647 增至 901，每帧平均主线程工作量略降，但每秒 CPU 工作量增加，不能将 FPS 上升直接当作耗电下降。
- 暂停后实测约 **14.96fps**，浏览器 rAF 仍为约 60Hz；两者必须区分。
- 进行中的比赛完全离开视口后变为 `paused`；连续两秒新增渲染帧 **0**、比赛时间推进 **0**。
- 补测通过真实用户手势语义解锁音频，确认前台 `running` → 离屏 `suspended` → 返回 `running`，比赛仍为暂停等待继续。

三角形和 draw call 为采样终点快照。Three.js 在阴影阶段后重置 `renderer.info`，这里统计主场景及透射预通道，不含阴影开销；不能视作 GPU 时间。主线程 TaskDuration、每帧 CPU 工作时间也不能视作设备功耗。配对采样中的音频因浏览器自动播放限制未解锁。

[结构化记录 / Measurement data](performance/android-2026-10-24.json)

## 保留画面效果的实现

1. 树木按 32m 网格分成共享几何体／材质的实例批次，交由相机和阴影视锥正常剔除。树的数量、位置、原始序号对应的旋转、大小、颜色、模型和纹理全部保留；不做树木删减或模型降面。
2. 触屏设备比赛与交互目标 60fps，待机 30fps，暂停和菜单 15fps；桌面保持浏览器原生刷新节奏（包括高刷新率屏幕）。比赛模拟保持独立的 60Hz 固定步长，不用渲染帧率决定物理步长。
3. 保留 2048px 阴影、PCFSoft、抗锯齿、1.75 像素比上限和现有水面材质。触屏阴影更新上限改为比赛 30Hz、待机／暂停 15Hz，动态影子时间分辨率有所降低。
4. 重用每帧临时变换对象；粒子直接写入已有 TypedArray；比赛时间未变化时复用水花 GPU 数据，泡沫时钟未变化时避免重复计算／上传。
5. 缓存 resize 获得的画布尺寸，避免每帧为名字气泡读取布局尺寸。页面隐藏或场景完全离屏时停止场景更新和 GPU 绘制，离屏同步挂起环境音频；进行中的比赛暂停，返回后由用户继续。

新增测试覆盖 60/90/120Hz 刷新率下的限帧、活动切换、固定模拟步长、阴影预算、暂停粒子数据复用、分块前后树木变换／颜色一致性与视锥剔除。

## 模拟器与复测

- AVD：已有 `Medium_Phone_API_37.0`，API 37，4 核，4096MB RAM，1080×2400，420dpi。
- 宿主 GPU：Apple M4；有效后端为 host GLES，关闭 Vulkan 和 GuestAngle。Chrome 145，CSS 视口约 411×810，设备 DPR 2.625，游戏 DPR 1.75。
- 默认 host Vulkan 路径只有背景与 DOM 名字、Guest ANGLE 无法建立 WebGL2、SwiftShader 软件后端无法及时输出帧，这三组尝试均不纳入性能结论。切换兼容后端只影响本地模拟器，没有改动网站的图形兼容策略。

启动当前模拟器的命令：

```sh
/Volumes/GW/Library/AndroidSDK/emulator/emulator \
  -avd Medium_Phone_API_37.0 -gpu host \
  -feature -Vulkan,-GuestAngle -cores 4 -no-snapshot -no-audio
```

打开加载完成的 Duck Rush 页面，等待本地诊断 `generatedAssets.stage === 'complete'`，保持 Chrome 在前台，随后采样：

```sh
/Volumes/GW/Library/AndroidSDK/platform-tools/adb forward tcp:9222 localabstract:chrome_devtools_remote
node scripts/measure-android.mjs /tmp/duck-perf.json 15
```

脚本使用 Node 内置 fetch/WebSocket，不引入依赖，只读取 Chrome 的帧回调、游戏帧计数与 Performance 指标。旧基线没有帧计数器，旧版的 rAF FPS 只因其每次回调都渲染而可用作实际 FPS。优化版必须使用 `renderFps`，不能用 `rafFps` 报告游戏帧率。

补测期间 Chrome 前台进程曾一次被 `SIGKILL`（status 9），Android 没有提供 ANR 或崩溃栈，原因未确证。重开 Chrome 后音频补测通过，这次中断未纳入帧率样本；不能据此宣称长期稳定。

真实 Android 手机仍需用相同亮度、供电、音量、环境温度和赛道连续运行至少 10–15 分钟，记录实际 FPS、温度／功耗和是否降频，才能完成发热验收。本次未测量真实温度或电池电流，也未做长期内存／热稳定性验收。
