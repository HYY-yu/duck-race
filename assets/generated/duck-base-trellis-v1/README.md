# 基础鸭子：TRELLIS.2 对比样品

2026-10-22，用户不满意 SAM，要求使用先前备用模型生成一次对比。沿用 `../duck-base-sam-v1/reference.png`，没有重新生图或增加其他资产。

## 生成与费用

- 模型：`wavespeed-ai/trellis-2/image-to-3d`。
- 参数见 `inputs.json`：resolution 512、texture_size 1024、target_face_count 10000、remove_background true、seed 42。
- 任务：`a6c276b4b4bc4fa380c71585657504eb`，推理约 33.317 秒；原件保存在 `raw/1.glb`，未修改。
- 实际扣费 **$0.10**，账单状态 `done`；加此前 SAM 的 $0.024，累计 **$0.124**，$1 预算剩余 **$0.876**。凭据见 `billing.json`，已去除账户及 API key 标识。
- 模型和输出记录见 `generation.json`；当前阶段只有一次 TRELLIS.2 付费任务。

## 体积与结构

| 样品 | 三角面 | 顶点 | 体积 | 颜色 |
| --- | ---: | ---: | ---: | --- |
| SAM 原件 | 874,180 | 437,106 | 16.68 MiB | 顶点色 |
| SAM 本地减面 | 4,000 | 2,016 | 79.70 KiB | 顶点色 |
| TRELLIS.2 原件 | 10,000 | 7,096 | 1,111,944 B / 1.06 MiB | UV 与 PBR 贴图 |

TRELLIS.2 包含一个材质、两张 1024×1024 PNG：baseColor 428,954 B、metallicRoughness 419,461 B。贴图约占文件 76%。未做本地减面、纹理压缩、骨骼动画或游戏接入。源 GLB 没有法线属性。

## 查看与判断

运行项目现有 Vite 服务，访问：

`http://127.0.0.1:5183/assets/generated/duck-base-trellis-v1/preview.html`

左侧同一参考图，中间 SAM 4,000 面本地减面版，右侧 TRELLIS.2 10,000 面原件。这是两种候选交付效果对比，不是相同面数下的算法质量实验；页面链接可查看 SAM 原件。

同一灯光、相机和最大包围盒尺寸；SAM 使用顶点色非金属材质，TRELLIS.2 保留原始贴图及 PBR 材质。预览为缺少法线的网格计算顶点法线，并关闭 flatShading，未修改原始 GLB。不同来源的颜色表示、材质和贴图烘焙也会影响观感。

斜前方、侧面、背面均可正常显示。TRELLIS.2 嘴唇和翅膀分层更明确，但颜色明显偏橙、嘴偏红，眼睛贴图有斑点，高光和局部面感不均，侧面也有细小纹理痕迹；不能视为已达到精致成品。背面未见明显缺失或悬浮零件。截图见 `preview-comparison.png`、`preview-side.png`、`preview-back.png`。

GLB 头部/块长度、bufferView 边界、三角索引范围、PNG 尺寸检查通过，实际 Three.js GLTFLoader 加载通过。统计及 SHA256 见 `stats.json`。没有做完整 Khronos 验证、移动端性能测试或游戏内验收。
