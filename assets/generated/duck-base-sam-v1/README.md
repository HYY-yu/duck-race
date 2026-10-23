# 基础鸭子 SAM 样品 / Base duck SAM sample

2026-10-22，用户批准 WaveSpeed 总预算 $1，本阶段仅生成基础鸭子样品。

## 文件与费用 / Files and cost

| 文件 | 内容 | 体积 | 三角面 | 顶点 |
| --- | --- | ---: | ---: | ---: |
| `reference.png` | 内置 ImageGen 独立参考图 | 1,243,837 B | — | — |
| `raw/1.glb` | SAM 原始下载，未修改 | 17,484,844 B / 16.68 MiB | 874,180 | 437,106 |
| `duck-base-4k.glb` | 本地保色减面，含平滑顶点法线 | 81,612 B / 79.70 KiB | 4,000 | 2,016 |

- 模型：`wavespeed-ai/sam-3d-objects`，一次生成，实际扣费 **$0.024**，已查账确认 `done`；剩余预算 **$0.976**。内置参考图不计入 WaveSpeed 费用，其美元成本未由工具提供。
- Prediction：`3fbda8ba97104d52aa605a6dcb975a0f`。推理约 23.763 秒。
- `generation.json` 保存任务与输出 URL；`billing.json` 保存移除账户标识后的扣费记录。
- `reference-prompt.txt` 保存内置 ImageGen 完整提示词。SAM 提示词在 `generation.json`。

## 效果判断 / Assessment

单次低价生成能还原基础鸭子的主体、眼睛、嘴、翅膀和尾巴，侧面及背面未见明显缺失或悬浮附属物。原始网格非常重，不适合直接作为浏览器游戏资产。

本地减面版保留大体轮廓和眼睛颜色边界，体积约减少 99.53%。嘴唇细线、翅膀分层与局部轮廓有损失，适合作为下一步游戏尺寸验证的候选。白底预览采用统一灯光和材质，不能据此保证最终游戏内的外观或帧率。来源颜色是顶点色，没有 UV 或贴图；无骨骼和动画。原件未包含法线与材质，预览为其计算平滑法线并赋予非金属材质；减面 GLB 已包含这些内容。

## 查看与复现 / Preview and reproduce

运行现有 `npm run dev` 后打开：

`http://127.0.0.1:5183/assets/generated/duck-base-sam-v1/preview.html`

提供参考图、原始模型、减面模型并列预览，支持旋转、缩放以及正面/背面/侧面切换。`preview-comparison.png`、`preview-back.png`、`preview-side.png` 是检查截图。

离线复现减面：`node scripts/duck-sam-sample.mjs`。脚本使用现有 Three.js 和 meshoptimizer 0.22.0，无新增依赖、无付费调用；仅支持这份已检查的 SAM 原件布局。为保留眼睛/嘴的颜色边界，使用带顶点颜色权重的简化。保留来源 Y-up 坐标，尚未统一游戏内缩放、原点和朝向。

GLB 头部/块长度、bufferView 边界、三角索引范围检查通过；两个模型均通过实际 Three.js GLTFLoader 加载并检查斜前方、侧面及背面。数据见 `stats.json` 和 `validation.json`。没有做完整 Khronos 验证、移动端性能测试或游戏接入。本阶段未修改游戏运行时代码，未继续生成其他资产。
