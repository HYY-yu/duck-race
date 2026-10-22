# 调研索引与已知边界

日期：2026-10-21。研究来自用户当前 OpportunityRadar 会话，事实与产品假设分开记录。

## 需求信号

东南亚六国手动种子研究共 145 个关键词×市场组合、112 条指标、8 个移动 SERP。菲律宾 duck race name picker 估算 1,300/月、duck race online 720/月；马来西亚前者 390/月。大词 duck race 混合 App、视频与真实比赛，不等于网页工具可获流量。完整内容见归档的东南亚报告及证据 JSON。

RandomDuckRace 的项目原生竞品关键词分析：小游戏雷达 → 关键词研究 → 竞品关键词，快照 #5、任务 #13662；美国 2840/en，47 词、2 页面；首页 ETV 728.408，duck race 第 9、duck race randomizer 第 5、duck race generator 第 4。预估 $0.048，实际 $0.0299。这不是东南亚排名或全站实测流量。来源归档保留截图。

## 后续市场研究的新证据（父任务核查，公开说明未完整实测）

- [inemtsev/duck-race](https://github.com/inemtsev/duck-race)：开源项目公开 2D 物理、石头、浮木、漩涡、水流、种子与终点回放。因此障碍与可重放不是独有功能；本原型没有复制该仓库代码。
- [DuckPark.io](https://www.crazygames.com/game/duckpark-io)：3D 鸭子滑道竞速，属于玩家操控玩法，与输入名单自动观看不同。
- [Outing](https://outing.vn/dua-vit/)：官网宣传 3D 鸭子越障碍、20–120 秒、Excel 名单；父任务实玩免费版 30 个示例名字一轮，实际观感为平面卡通鸭/水草，未证实真 3D 或碰撞决定排名，Pro 未测试；Free 最多 60 人，Pro 宣传 110,000 VND/PIN、800 鸭、品牌定制及结果导出，PIN 激活 48 小时。只是当日官网声称，未验证销量、实际付费流程和性能。
- [RandomDuckRace changelog](https://randomduckrace.com/changelog/)：2026-10-12 v2.0 宣布 currents/rapids/slipstreams；2026-10-18 宣布 no more rapids，保留 current/slipstream。日志也有低端机与 GPU 优化，但不能推断移除急流的原因就是性能。

结论：“鸭子＋障碍”并非蓝海或唯一创新。可验证假设是让每次超越原因清晰、手机流畅、设置简单，形成更好的自动观赛体验。复杂赛道与低端设备之间的取舍必须实测。

## 用户确认的方向

鸭子使用相同推进规则，障碍自然影响名次。修订早先“先抽出赢家后播动画”的建议；当前原型实际模拟障碍，不预定胜者。复杂浮力不是首版必要条件，简化碰撞可以先验证体验。

“大部分竞品来自同一开源项目”“只有 RandomDuckRace 真 3D”是用户观察，尚未做源码及许可证归属审查，不能当作核实结论。

## 本轮进一步研究

已归档 [鸭子＋障碍市场研究](2026-10-21-duck-obstacle-market.md) 与对应 evidence.json、Outing 免费版截图。新数据：越南 đua vịt chọn tên 3,600/月、KD 1，trò chơi đua vịt trả bài 880/月；菲律宾 duck race randomizer 2,400/月、KD 0，duck race simulator 390/月、KD 1。四国障碍/physics/custom track 等精确词未返回记录，表示当前供应商缺失，不能解释成零需求。场景词比障碍功能词更适合首轮流量验证。
