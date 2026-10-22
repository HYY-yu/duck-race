# Duck Rush

本仓库的主项目，使用 TypeScript、Three.js 和 Vite。原 `packages/duck-rush` 已于 2026-10-22 提升到仓库根目录。

## 启动 / Getting started

需要 Node.js 22.18+ 和 npm。在仓库根目录运行：

```bash
npm ci
npm run dev       # Duck Rush：http://127.0.0.1:5183
npm test
npm run build
```

`dist/` 可用于静态部署。保留 5183 端口及原有 localStorage 键，本机该地址的最近比赛记录继续可用。`dev:rush`、`build:rush`、`test:rush` 保留为主项目命令的兼容别名。

## 旧版参考 / Archived reference

旧版 Duck Circuit 的源码、测试、资源、文档和工具完整保存在 [archive/duck-circuit](archive/duck-circuit/README.md)，包含迁移前未提交的瀑布修改。后续默认开发根目录的 Duck Rush。

需要对照运行时，在仓库根目录另开终端：

```bash
npm --prefix archive/duck-circuit ci
npm run dev:legacy    # Duck Circuit：http://127.0.0.1:5181
npm run test:legacy
npm run build:legacy
```

两个版本保留独立依赖和锁文件。旧版设计、验收截图及市场调研保存在 `archive/duck-circuit/docs/`；归档 `.zcode` 中的任务简报和工具保留历史内容，其中旧绝对路径或端口需要按当前目录调整。

## 已实现

- 3–12 只无自身动力橡皮鸭；水流、鸭间斥力和接触决定比赛。
- 四类机关、窄道、内外弯速度差，以及两段立体瀑布。
- 水体透射与反射、流动法线、真实顶点起伏、水下河床与焦散、泡沫/水帘/喷雾。
- 鸭子离水重力下落、入水回弹、惯性俯仰/侧摇、碰撞反弹/旋转、与冲击强度关联的飞溅。
- 山脚连续湖面、自然地形岸线；完赛后继续漂流入湖，成绩与计时保持不变。
- 全局和任选鸭子跟随（较远、较高的侧后方视角）；双语 UI、实时名次、暂停/继续、最近 10 场本机记录。
- 程序化山谷、松林、飞鸟和兔子。无声音。

实现方法、参考来源、物理边界和调试入口：[水体与物理说明](docs/WATER-PHYSICS.md)。

迁移和既有功能的验证记录：[VALIDATION.md](VALIDATION.md)。

## 验证

运行 `npm test`：输入边界、不同数量/种子的完赛、可复现性、暂停、两次落水、弹道/入水/浮力收敛、碰撞角动量、波浪边界。

这是休闲竞速的轻量约束仿真，不是完整流体或通用刚体求解器。真实手机 GPU 性能尚未验收。外部字体不可用时回退系统字体。
