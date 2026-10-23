# Duck Rush SEO 上线说明

更新日期：2026-10-23。当前实现以仓库根目录的 Duck Rush 为准；`archive/duck-circuit` 中的内容只作为历史研究背景。

图形化版本：[SEO 上线作战图](seo-launch-visual.html)。该页面是项目内的 `noindex` 可视化交付，不属于公开 SEO 页面范围。

## 定位与首轮验证市场

首轮验证市场是菲律宾英语搜索用户，产品仍提供通用英文与中文页面，不生成菲律宾区域页，也不扩展越南语、印尼语或其他语言。

OpenSEO 在 2026-10-23 对菲律宾英语的估算如下。这些是供应商估算，不是可获得流量，也不能把近义词搜索量直接相加；KD 0 不表示没有竞争。

| 查询 | 月搜索量估算 | KD | 用途 |
| --- | ---: | ---: | --- |
| duck race name picker | 1,300 | 2 | 英文主页主关键词 |
| duck race randomizer | 2,400 | 0 | 英文主页自然相关表达 |
| duck race online | 720 | 5 | 英文主页场景表达 |
| duck race simulator | 390 | 1 | 玩法与规则中的准确相关表达 |
| duck race game | 3,600 | 10 | 宽泛相关词，不作为页面主定位 |
| random name picker | 4,400 | 41 | 竞争更高的宽泛词，不单独造页 |

这些结果与 2026-10-21 的研究一致，不代表两天内增长。越南 `đua vịt chọn tên` 约 3,600/月，只记录为后续市场机会；当前没有越南语页面，也不在正文或元数据中堆砌越南语关键词。

障碍、physics、custom track 等精确词没有可用指标。这表示数据缺失，不表示零需求。3D、山地漂流、障碍和瀑布是已实现的体验卖点，不被描述成自带大量搜索需求或独有创新。

历史研究记录的 RandomDuckRace 排名来自美国英语索引：`duck race` 第 9、`duck race randomizer` 第 5、`duck race generator` 第 4。它们不是菲律宾排名。竞品已覆盖 3D、名单、分享、多语言和课堂场景，因此 Duck Rush 不使用“首个”“唯一”“最公平”等表述。

## 页面与关键词映射

| URL | 页面目的 | 主表达 | 索引 |
| --- | --- | --- | --- |
| `/` | 手动语言选择，`x-default` | Duck Rush 品牌与语言入口 | 是，不进入 sitemap |
| `/en/` | 英文游戏主页 | duck race name picker | 是 |
| `/zh/` | 中文游戏主页 | 名单鸭子竞速器、名单可视化 | 是 |
| `/en/how-to-play/` | 英文玩法、规则与公平性边界 | duck race rules / simulator behavior | 是 |
| `/zh/how-to-play/` | 中文玩法、规则与公平边界 | 玩法规则、自动竞速 | 是 |
| `/en/privacy/` | 英文数据处理说明 | Duck Rush privacy | 是 |
| `/zh/privacy/` | 中文数据处理说明 | 隐私说明 | 是 |
| `/404.html` | 无效地址的真实错误页 | 不承接关键词 | `noindex` |

第一轮不建立课堂页，因为当前没有与主页明显不同的课堂功能和内容。不为 name picker、randomizer、generator 分别创建近似页面，不生成国家页、薄内容博客或未经验证的竞品对比页。

## 页面内容边界

主页和玩法页只描述源码中已核实的能力：

- 每轮 2–12 个不重复名字，一人一鸭；
- 浏览器安全随机源把姓名独立分配给小鸭物理编号；
- 水流、河道、碰撞、障碍、瀑布、腾空和落水影响实际冲线顺序；
- 公开构建只有自动竞速，不渲染语音入口，也不注册能够控制小鸭的键盘输入；跟随功能只改变观看镜头；
- 显示和复制完整排名，最近 10 场完成记录保存在当前浏览器；
- 不宣称认证公平、防篡改、所有模式胜率相同或大规模活动支持。

## 核心 SEO 叙事

Googlebot 与用户在英文、中文主页都应直接看到同一组可验证价值：

1. **设置简单 / Simple setup**：粘贴 2–12 个名字，几秒完成；无需账号，当前代码没有内置名单上传 API。
2. **3D 赛道刺激 / Exciting 3D course**：急流、弯道、障碍、碰撞、瀑布、腾空与落水真实改变比赛。
3. **自动结果透明 / Transparent automatic results**：浏览器安全随机源分配姓名；无预设赢家、无基于姓名的物理差异或隐藏追赶加速；实际仿真决定冲线顺序。
4. **名单默认本地 / Names stay local by default**：当前代码没有账号、远程名单数据库、内置名单上传接口或已配置的远程分析目的地；姓名和最近 10 场历史保存在当前浏览器。

“公平”只用于说明自动竞速的可验证规则边界，不能扩大为“所有物理编号、所有浏览器胜率完全相同”或“经过认证的公平抽签”。“所有数据永不离开设备”“绝无后门”仍不是可验证的 SEO 承诺，因为托管商会处理常规网络请求。对外使用更准确、更强的表述：**公开版本仅自动竞速、无预设赢家、无姓名偏置、名单默认不上传、当前代码无内置名单上传或远程分析目的地**。

人工拨水和语音控制只保留在本机专用构建：`npm run dev:manual` / `npm run build:manual` 读取 Git 忽略的 `.env.manual.local`。默认 `npm run build` 不渲染麦克风或语音日志、不请求麦克风权限、不注册拨水按键。人工模式不得出现在公开 SEO 文案、结构化数据或部署产物中。

公开隐私说明聚焦浏览器内存与 `localStorage`：姓名和最近 10 场历史默认留在当前浏览器。公开上线前仍需补充运营主体、托管商、联系渠道和实际分析服务。

## URL、canonical 与 hreflang

- 英文与中文使用可独立访问、刷新和分享的 `/en/`、`/zh/`。
- 每个内容页包含自身语言的 canonical 与双向 hreflang；根语言选择页是 `x-default`。
- 英文使用通用 `en`，中文使用 `zh-CN`，不制造没有独立内容的区域版本。
- `SITE_URL` 是唯一生产域名配置。构建时只有设置真实 HTTPS origin 才输出 absolute canonical、hreflang、社交图片 URL 和 `sitemap.xml`。
- 未设置 `SITE_URL` 时，构建会明确 Warn，并移除这些 absolute 标签，避免把 localhost、示例域名或占位符发布为生产 URL。

示例配置不提供虚假域名：

```bash
cp .env.example .env
# 在 .env 的 SITE_URL= 后填写实际 HTTPS origin
npm run build
```

## 参数与索引策略

`track` 和 `seed` 是同一语言主页的可分享状态，语言切换时会保留。canonical 始终指向不含查询参数的语言主页。

`track`、`seed`、`debug`、`inspect`、个人比赛状态和未来的临时诊断参数都不进入 sitemap。当前不通过 URL 传递参与者姓名。托管层不应把这些参数组合生成独立静态页面，也不应对整个游戏入口设置 `noindex`。

只有当未来某条赛道具有独立搜索意图、完整独立内容和长期维护价值时，才考虑建立独立页面；仅仅换一个参数不构成新页面。

## 抓取与静态输出

- `/en/` 与 `/zh/` 的初始 HTML 包含对应 title、description、lang、H1、副标题、使用步骤、规则、FAQ、内部链接和 `WebApplication` JSON-LD。
- WebGL/JavaScript 未启动时仍显示真实产品预览、H1、启动说明，并可阅读游戏下方全部说明以及独立玩法和隐私页。
- Three.js 只替换 `#app` 游戏区域，不覆盖游戏下方的静态正文。
- 根路径是手动语言选择页，不按 IP 强制跳转。
- `404.html` 包含返回中英文主页的正常链接，并声明 `noindex,follow`。托管平台必须为未知地址返回该文件和 HTTP 404，不能把所有未知地址以 HTTP 200 重写到游戏主页。

结构化数据使用 `WebApplication`，只列出页面可见且已实现的能力。没有评分、评论、价格、用户数或组织信息，也不承诺任何富媒体搜索结果。

## 分享资源

- favicon：ImageGen 生成源文件保存在 `assets/brand/favicon-imagegen-v1.png`，发布使用 `public/favicon-16.png`、`favicon-32.png`、`favicon.png` 与 `apple-touch-icon.png`；均保留透明背景。
- Open Graph 图片：`public/social/duck-rush-og.jpg`，1200×630 JPEG，来自项目真实雪山赛道截图。
- Open Graph/Twitter absolute 图片 URL 只在 `SITE_URL` 已配置时输出。

## 性能基线与改动

2026-10-23 修改前生产构建：

- 应用 JS：144.50 kB，gzip 54.27 kB；
- Three.js chunk：639.14 kB，gzip 164.65 kB；
- 13 个 GLB：合计约 7.2 MB；
- CSS：17.02 kB，gzip 4.69 kB；
- 另有首次访问 Google Fonts 的外部请求。

本轮构建后：

- 初始 entry JS：约 5.37 kB，gzip约 2.36 kB；
- 主游戏与 Three.js 改为首屏静态壳首次绘制后的动态加载；
- 13 个 GLB 在程序化可玩场景建立后，使用 idle callback 延后加载并逐步替换回退模型；
- 移除 Google Fonts 外部请求，使用系统字体；
- 游戏主 chunk 与 Three.js 体积基本不变，因此低端手机 GPU、网络耗时和长期发热仍需真机测量。

本机生产预览实测：桌面无网络/CPU 限速时 FCP 约 116 ms、LCP 约 996 ms、CLS 0；390×844、4× CPU、约 1.6 Mbps/100 ms 延迟的模拟移动环境中，FCP 约 568 ms、LCP 约 2.32 s、CLS 0，程序化 3D 场景约 7.66 s 可用，开始按钮约 37 ms 进入倒计时，此时 GLB 批次仍可在后台继续加载。这些是本机模拟结果，不是线上真实用户 Core Web Vitals，也不替代 Android/iPhone 真机测试。

静态壳给场景预留完整尺寸，避免 Three.js 接管时产生明显布局位移。动态加载失败或 WebGL 不可用时，正文和帮助链接仍可使用。

## 观测与隐私约束

`src/observability.ts` 提供无供应商依赖的适配层。当前默认写入分级 console 日志；如果生产环境注入 `window.duckRushTelemetry.track`，可接到已有观测系统。

已预留事件：

- `page_view`：语言和赛道；
- `language_switch`；
- `game_load_started`、`game_ready`；
- `race_started`：语言、赛道、汇总参与人数；
- `race_finished`：汇总人数与耗时；本机人工构建另外记录不含身份信息的控制布尔值；
- `asset_load_finished`、`asset_failed`；
- `web_vital`：FCP、LCP、CLS 与最长交互事件耗时（浏览器支持时）；只作为现场诊断，线上判断仍以真实用户监测和 Search Console Core Web Vitals 为准。

严禁适配层上传真实名单、复制结果、抽签结果明细或未经筛选的完整 URL/查询参数。若以后新增远程分析、错误追踪或会话回放，必须先更新隐私说明并评估同意机制。

## 上线检查清单

- [ ] 确定真实生产域名并设置 `SITE_URL`，重新运行 `npm run build`。
- [ ] 只部署默认 `npm run build` 的 `dist/`；不得部署 `npm run build:manual` 产物，并确认 `window.__DUCK_RUSH__.manualMode === false`。
- [ ] 检查产物中的 canonical、hreflang、Open Graph URL、`robots.txt` 与 `sitemap.xml` 均使用同一 HTTPS origin。
- [ ] 配置静态托管的目录索引，使 `/en/`、`/zh/`、玩法页和隐私页可直接访问并刷新。
- [ ] 配置未知路径返回 `404.html` 且 HTTP 状态为 404；不要使用全站 SPA 200 回退。
- [ ] 配置长期缓存：带 hash 的 `/assets/` 可 immutable；HTML、`robots.txt`、`sitemap.xml` 使用较短缓存并可更新。
- [ ] 补充隐私页中的运营主体、联系渠道、托管商与实际保留策略。
- [ ] 在真实 Android 与 iPhone 上测量加载、开始比赛耗时、交互响应、布局稳定性、帧率、发热和声音/麦克风权限。
- [ ] 在生产域名检查 WebGL/模型失败降级、CSP、MIME、压缩、HTTPS 和安全响应头。
- [ ] 验证分享图在常用社交平台的抓取与裁切。
- [ ] 接入 Search Console，提交 sitemap，检查中英文页索引、国家、查询、页面曝光和点击。
- [ ] 把 Search Console 数据与不含姓名的开赛/完赛事件结合评估，不把曝光当作开赛，也不保证排名或流量。

当前没有生产域名、托管规则、Search Console 权限、线上真实用户数据或线上 Core Web Vitals，因此这些项目均未宣称已验证。
