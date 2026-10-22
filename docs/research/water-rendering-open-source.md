# 下降河网水体渲染：开源实现与素材许可

调研日期：2026-10-22。目标环境：现有 Three.js r180 `WebGLRenderer`，连续下降、分流和汇流的河道；不新增引擎或大型依赖。本文记录源码核查与技术取舍，不代表效果、性能或移动设备已经通过验收。

## 2026-10-22 瀑布样板更新

用户允许升级 Three.js 后，运行时已固定到 **0.186.1**，类型到 **0.186.0**；旧版 r180 Water2 仍是原流动法线算法的出处。新增 **three.quarks 0.17.1**，其 npm peer 要求 Three.js >=0.182.0；使用实际安装包核对了 MIT 许可。依赖 quarks.core 一并锁定，完整声明位于 `public/licenses/three-quarks-MIT.txt`、`quarks-core-MIT.txt` 和 `three-r186-MIT.txt`。

采用范围是下落水滴、水雾与鸭子入水爆发；使用其 ConeEmitter、BatchedRenderer、生命周期尺寸/颜色和 ApplyForce。水帘、岩壁、跌水潭和现有河面仍由本项目生成。没有声称 quarks 自带完整瀑布或真实水动力；没有移植 Waterways 或引入来源未核实的外部图片。

官方来源：[three.quarks](https://github.com/Alchemist0823/three.quarks)、[粒子演示](https://demo.quarks.art/)、[MIT](https://github.com/Alchemist0823/three.quarks/blob/master/LICENSE)。下文保留最初 r180 调研背景；当前运行版本与引入范围以上述更新为准。

## 结论与采用范围（原 r180 调研）

本轮采用 **Three.js r180 Water2 的双相流动法线算法**，保留现有河网几何和流场。用原创程序法线 `DataTexture` 提供波纹，把法线变换到各段河面的局部基底；折射使用 `MeshPhysicalMaterial` 内建 transmission 的半分辨率共享不透明场景颜色缓冲，厚度和吸收来自预计算的河道深度与距岸距离。这是针对非平面河网的适配方案，不是直接实例化 Water2 就能获得的效果。

实际实现没有在水体着色器中读取屏幕深度纹理，也没有按前景深度拒绝折射采样。渲染目标带深度附件不等于实现了这项功能；前景交界、画面边缘和离屏内容仍有屏幕空间采样限制。共享颜色加深度采样及前景拒绝是调研中的后续候选，不作为本轮完成项。

反射优先使用环境采样与菲涅耳混合；只有少数近似平坦的水池才适合完整的平面反射对象。不能为每条下降支流直接建立一个完整 Water2，并期待几何、反射裁剪和开销都自然正确。

本轮不引入 Waterways 的 Godot 工具链，也不复制来源尚未充分核实的两张官方示例法线图片。代码复用保留对应 MIT 声明，程序法线不需要外部图片下载。

## 源码比较

| 实现 | 已核实的能力 | 本项目的限制与取舍 | 许可 |
| --- | --- | --- | --- |
| [Three.js r180 Water2](https://github.com/mrdoob/three.js/blob/r180/examples/jsm/objects/Water2.js) | WebGLRenderer；双法线、双相位混合、flow map；反射/折射混合 | 复用流动法线核心；完整对象适合近似平面，每实例有两次离屏渲染 | [MIT，three.js authors](https://github.com/mrdoob/three.js/blob/r180/LICENSE) |
| [Three.js r180 Water](https://github.com/mrdoob/three.js/blob/r180/examples/jsm/objects/Water.js) | 平面反射、单张法线的多尺度采样、太阳高光 | 更偏平坦大水面；没有 Water2 的河流 flow map，不作为河网主材质 | 同上 |
| [Arnklit/Waterways](https://github.com/Arnklit/Waterways) | Godot 河流网格工具、流向/泡沫贴图、坡度影响、深度折射 | shader 依赖 Godot 内建变量与渲染流程；分合流不是现成解决方案，仅参考适用算法 | [MIT，Kasper Arnklit Frandsen，2021](https://github.com/Arnklit/Waterways/blob/main/LICENSE) |
| [mqnc/cheapwater](https://github.com/mqnc/cheapwater) | Three.js 标准材质上的滚动法线、环境反射、交互波纹贴图 | 源示例基于 r169、平面和对象空间法线；需适配 r180 shader chunk 与河道基底，不作为直接替换件 | [MIT，Mirko Kunze，2024](https://github.com/mqnc/cheapwater/blob/main/LICENSE) |

### Water2 的可直接复用部分与平面假设

Water2 将两次法线采样错开半个周期并交叉混合，避免流动 UV 重置时突变；可接 `flowMap`，或常量 `flowDirection`。这些 GLSL 与相位更新逻辑可以移入现有水材质。正常使用时需显式传入纹理，其默认图片 URL 是站点相对路径，不会因安装 npm 包就自动部署到应用。见 [r180 Water2 源码](https://github.com/mrdoob/three.js/blob/r180/examples/jsm/objects/Water2.js)。

其 [Reflector](https://github.com/mrdoob/three.js/blob/r180/examples/jsm/objects/Reflector.js) 和 [Refractor](https://github.com/mrdoob/three.js/blob/r180/examples/jsm/objects/Refractor.js) 都用对象变换和一个平面计算相机/裁剪面；不会跟随几何中逐点变化的河床坡度。Water2 的法线重组也使用水平水面的坐标假设。故弯曲、下降河道需要自己的切线/法线基底和光学采样方案。反射、折射不是水动力模拟，也不自动提供泡沫或岸边深度效果。

### Waterways 可借鉴但不能直接导入

[river.shader](https://github.com/Arnklit/Waterways/blob/main/addons/waterways/shaders/river.shader) 文件头明确为 MIT；双相流动、坡度泡沫、深度着色和拒绝前景误采样的折射处理值得借鉴。它使用 `SCREEN_TEXTURE`、`DEPTH_TEXTURE`、`TANGENT`、`BINORMAL` 等 Godot 接口，不能直接作为 Three.js shader 编译。项目 [README 的限制](https://github.com/Arnklit/Waterways/blob/main/README.md) 还说明没有实时反射，河流之间不交互，分流/汇流支持有限。本项目已有几何和分流规则，移植完整编辑器没有收益。

### cheapwater 的适用边界

[示例源码](https://github.com/mqnc/cheapwater/blob/main/index.html) 通过 `MeshStandardMaterial.onBeforeCompile` 叠加滚动法线，并用额外纹理渲染交互波纹。可用于校对高光和环境反射的视觉方向；但现有实现仍基于平面，不能直接处理河网曲面、岸边深度或上下游分支。其示例外部 HDR 图片也不能因代码 MIT 而自动按 MIT 复制。

## 两张 Three.js 示例法线的来源核查

Water2 默认引用的文件为 [Water_1_M_Normal.jpg](https://github.com/mrdoob/three.js/blob/r180/examples/textures/water/Water_1_M_Normal.jpg) 和 [Water_2_M_Normal.jpg](https://github.com/mrdoob/three.js/blob/r180/examples/textures/water/Water_2_M_Normal.jpg)。

已从第一张图片的 [官方文件历史](https://github.com/mrdoob/three.js/commits/r180/examples/textures/water/Water_1_M_Normal.jpg) 查到 Mugen87 于 2017-10-03 提交的 [Water: Initial Commit](https://github.com/mrdoob/three.js/commit/e9d3b672596e1f07b72c6d1dd108a0d7a79171c2)。这证明它进入 Three.js 仓库的来源；不等同于独立证明图片的最初作者和授权链。

Three.js r180 根目录许可证是 MIT，版权为 2010–2025 three.js authors。本次未查到这两张图片单独的原始素材许可声明，因此不将其标为 CC0，也不把“位于 MIT 仓库”写成已核实的图片原始授权。当前方案使用原创法线纹理，避免依赖这项未决信息。

## CC0 替代资源核查

[ambientCG 官方许可](https://docs.ambientcg.com/license/) 明确：下载素材文件及素材预览图为 CC0，可修改、商用和随游戏分发。通过 [官方素材 API](https://ambientcg.com/api/v2/full_json?q=water&type=Material&limit=50) 检索水相关材质；关键词匹配包括冰面、湿地、河床，不能直接把这些结果当成流动水波法线。当前未选定一张已验证合适的水波法线单图，不提供猜测的素材下载地址。

[Poly Haven 官方许可](https://polyhaven.com/license) 同样明确素材为 CC0；但本次 [water 纹理搜索](https://polyhaven.com/textures?s=water) 未返回可选水波纹理。因此不能承诺存在开箱可用的水法线。该站的 [Lakes HDRI](https://polyhaven.com/a/lakes) 有明确作者和 CC0 标注，可作为未来环境反射候选；HDRI 是环境照明素材，不能替代水面法线。本次没有下载或加入任何外部素材。

## 集成与验证约定

1. 共享河道几何按实际表面建立法线基底；UV 沿水流铺设，陡降处不继续使用世界水平法线。
2. 双相法线驱动高光与折射。泡沫只在陡降、碰撞/岸边等有依据的位置出现，避免用均匀白色条纹代替水体光学。
3. 本轮使用 Three.js 共享的不透明场景颜色缓冲，避免把水面自身再次采入；局部厚度来自河道数据。后续可评估额外采样屏幕深度、拒绝前景误采样，但本轮尚未实现，不能据此承诺消除岸石交界或离屏折射问题。
4. 贴图法线按线性数据读取；原创 DataTexture 的滤波、重复和法线方向需要实际画面验证。程序生成只解决素材与传输，不自动保证视觉质量。
5. 复制或改编 MIT 源码时保留完整版权及许可文本，并记录具体来源版本。MIT 不要求在游戏画面上显示作者，但分发内容必须附带适用声明；若仅参考而未复制 Waterways/cheapwater，不将其写成已引入依赖。
6. 浏览器验收覆盖浅水见底、侧视反光、陡坡、分流汇流、近岸交界、镜头切换和后台恢复；记录 shader/WebGL 错误与实际帧开销。本文调研不代替这些验收。

以上集成条目是结合本项目非平面河网提出的工程设计，不是声称任一上游库完整提供了这些能力。
