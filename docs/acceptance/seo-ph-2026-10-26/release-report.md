# 联合发布记录 — 2026-10-26

用户于04:25 UTC明确批准6个首页文件及现有提交一起正常推送上线。本轮没有更改已验收代码，提交前完整diff与起始patch逐字相等；fetch后确认main相对真实origin/main领先1笔、落后0笔，无新冲突或未识别代码差异。

## 提交和远端

- 分支：main。
- 新提交：`352c61aa99260c32d1d128ba3f20840e094062a5` — Improve English duck race picker homepage for PH search intent。
- 精确6文件：en/index.html、src/main.ts（仅英文介绍一句）、src/style.css、scripts/check-seo-build.mjs、tests/seo.test.ts、docs/SEO.md。67 additions / 15 deletions。
- 普通push成功：`0897d80..352c61a main -> main`，包含现有`9818d04`比赛验收提交；用户游戏提交`f76c405`、`0897d80`已在此前远端历史中并保留。
- push后`git ls-remote origin refs/heads/main`确认等于完整352c61a SHA；04:27:28 UTC记录。
- 未force push、未手动部署、未新增依赖或修改权限/凭据。

## Cloudflare自动发布

[精确提交](https://github.com/HYY-yu/duck-race/commit/352c61aa99260c32d1d128ba3f20840e094062a5)的GitHub检查为success，1/1通过。检查名称：Workers Builds: duckracepicker；提供方Cloudflare Workers and Pages。

- [检查详情](https://github.com/HYY-yu/duck-race/runs/121398096933)。
- 成功时间：**2026-10-26T04:27:42Z**（检查页面relative-time datetime实际值；不是以提交时间代替）。
- Build ID：`f4c1895d-1285-4057-913a-cff9cba949c9`。
- Version ID：`446870ee-9b68-4c29-b924-3ec57e60713f`。
- [Cloudflare构建链接](https://dash.cloudflare.com/24cfcc8e4a76c21639a4c186326aac7a/workers/services/view/duckracepicker/production/builds/f4c1895d-1285-4057-913a-cff9cba949c9)。
- 原始摘要与截图：[release-summary.txt](release-summary.txt)、[release-summary.jpg](release-summary.jpg)、[release-checks.jpg](release-checks.jpg)。

GitHub匿名API因rate limit返回403；本机wrangler deployments list因没有可用的CLOUDFLARE_API_TOKEN失败。没有登录、建立新凭据或使用temporary账户。后续通过GitHub公开网页的精确提交检查获得上述成功证据，发布确认没有因此悬而未决。普通urllib读取正式站也返回403，已改用实际浏览器确认页面；不把该HTTP客户端403误报成站点发布失败。

## 最小线上核验

[正式英文页](https://duckracepicker.com/en/)：title为Free Online Duck Race Name Picker – 2–12 Names | Duck Rush；运行时intro为Free in your browser. Add 2–12 unique names, race in 3D, and copy the full finishing order.。虚构输入与排名摘录正确显示，包括Illustrative example及Made-up names and ranking, not a recorded draw.。canonical为https://duckracepicker.com/en/。

[正式中文页](https://duckracepicker.com/zh/)：title、H1名单鸭子竞速器及原介绍保留，默认6人和待开始状态正常；canonical为https://duckracepicker.com/zh/。两页hreflang均为en→/en/、zh-CN→/zh/、x-default→/。

真实3D canvas加载正常；通过跟随Sunny近看，小鸭黄、粉、蓝紫、薄荷、橙、天蓝颜色与配件正常，无白模/黑贴图。没有线上开赛或复制/再抽。线上控制台未见error，出现PostHog RemoteConfig disabled/falling back to local config的配置提示，未修改分析配置。

真实浏览器Network.requestWillBeSent的redirectResponse证明：

- `/x?seed=discarded` → 302 → `/en/?utm_source=x&utm_medium=social&utm_campaign=duck_rush_launch_2026_10`。
- `/t?track=discarded` → 302 → `/en/?utm_source=tiktok&utm_medium=social&utm_campaign=duck_rush_launch_2026_10`。

额外输入未传递到目标；见[live-redirects.json](live-redirects.json)。线上截图：[英文首页](live-en.jpg)、[模型颜色](live-model.jpg)、[示例](live-example.jpg)、[中文首页](live-zh.jpg)。

## 分析排除与Google抓取状态

线上浏览器核验UTC窗口：**2026-10-26T04:28:46Z–04:30:12Z**。来源为本会话用户Mac内置浏览器，依次访问/en/、/zh/、/x?seed=discarded、/t?track=discarded；后两页使用真实固定X/TikTok三参数。页面及模型加载可能产生production page_view/game_load_started/game_ready/asset/web_vital事件，应按该窗口及渠道排除本次测试；没有race_started、race_finished、results_copied或race_replayed操作。匿名内存身份不提供跨访问识别，本记录不宣称精确事件数量。

工具目录搜索没有可用GSC/URL Inspection连接；**未取得本轮lastCrawlTime，新版Google抓取状态未知**。先前“英文页已收录”是旧证据，不能证明04:27:42 UTC部署的新版本已被抓取。28/42天观察仍未起算，需之后取得新版抓取证据；本轮未创建自动提醒或付费查询。

## 范围与清理

代码与本地验收内容未改，沿用已完成135/135测试及类型/生产构建检查；未无故重跑。本次线上只核验最小页面与模型，不扩展为生产比赛、全种子、移动真机、其他浏览器或全球CDN一致性保证。

本轮两个浏览器临时标签已关闭。工作树只剩未跟踪的docs/acceptance/seo-ph-2026-10-26/，原13文件约1.2MiB证据保留本地，本次新增发布报告/截图也只在该目录。没有stage或push该目录、没有stage dist，没有触碰用户其他进程。
