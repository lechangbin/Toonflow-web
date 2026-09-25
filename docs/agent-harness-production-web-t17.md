# T17 生产 Harness Web 接线（阶段记录）

App 后端的 `production-harness-v1` 与旧生产 Socket 路径并行。此 Web 分支在生产聊天侧栏增加显式“受控 Run（试用）”入口，不隐式接管旧聊天。新入口使用 HTTP start/inspect/list/cancel/effects：创建 Run 后从服务端重新读取当前 Run 与最近 Run，并分别展示来源于持久子审批的图片与派生资产效果状态；不根据聊天文本或 Socket 断连推断效果成功。Owner 可在新面板对待处理图片候选明确批准/拒绝；批准范围后还需第二次确认才会提交供应商。派生资产候选展示经后端校验的完整待审 payload；缺 payload 时禁用批准，Owner 的版本化批准会立即触发 T08 本地写入。命令失败均不自动重试。图片取消、媒体修复和人工核对仍在资产配置中的既有“受控单资产生图”面板完成。

定向验证：`tests/productionHarnessContract.test.ts` 的 4 个用例覆盖版本化请求、Project ID、取消 affordance、两类效果读取、图片审批/提交分离、派生资产批准缺失 payload 时拒绝；`vue-tsc --noEmit --declaration false --composite false --project tsconfig.app.json` 通过。常规 `yarn type-check` 因共享 `node_modules` 工作树下已有 Socket 类型 TS2742 的跨目录声明推断失败，不能声称该构建检查通过。本阶段未执行全量前端测试、构建或浏览器验收。

兼容入口中的旧 T08 派生审批卡片也同步展示已校验的完整 payload；若后端未返回 payload，即使 allowedActions 包含 approve，前端仍禁用批准但保留拒绝能力。相关 2 个定向单测与上述 4 个合约单测共 6 个通过。该 UI 防误操作层不能替代服务端冻结 payload、Owner 身份与目标状态校验。

试用面板增加三项独立生产 grant 的 Owner 快照和按版本开启/撤销控件。读取经 `/agentRuns/getProductionGrants`，写入仍走各自原有 Owner-only 命令；客户端拒绝无变化或无效版本，不做失败自动重试。最近一次相关 Web 定向单测为 7 个，通过；非声明式 Vue 类型检查通过。是否在真实浏览器中可用仍待 T21。

旧 Socket 分镜兼容接缝同步修正：不再在后端写入前向本地分镜数组乐观追加。处理器先调用旧批量写入路由，再重读后端 Project 数据才回 `{success:true}`；任一环节失败只重读一次、不重发写入，回 `{success:false}` 并提示“结果不确定”。三个定向单测验证写入/重读顺序、失败不重放、重读失败不报成功，非声明式 Vue 类型检查通过。旧批量路由的部分提交、断线无回调和完整浏览器体验仍待后续迁移与 T21 验收。

边界：这是受控生产入口的状态展示接缝，不等于旧 Socket 生命周期已移除。T18 仍需把当前/近期 Run、审批和证据展示统一到所有 Agent 入口，并在真实 App/Web 浏览器流程中验证刷新、重连、批准、拒绝、停止、恢复和兼容回退；T21 才执行最终全量验收。

单条分镜补充：试用面板现在单独展示 `storyboardEffects` 的持久子审批、精确待审载荷与提交后的分镜 ID，并提供版本化批准/拒绝；四项生产 grant 中的 `storyboardProposal` 与图片、派生资产互不借权。模型只提出候选，Owner 点击确认后才由 App 在事务中写入已有空 Video Track 的一条分镜；该操作不会生成图片或视频。最近一次相关 Web 合约测试 6 个通过，非声明式 Vue 类型检查通过；没有做浏览器验收，也未接管旧批量 Socket 路径。前文 4/6/7 个用例数字是对应历史切片，不应相加当作当前全量测试数量。

面试追问：为什么显示“指导 Run 成功”时仍要单列图片效果？因为模型文本 Step 的完成和供应商付费效果属于两个持久生命周期；子审批可能仍 pending、结果未知或取消后迟到。前端以 HTTP 效果投影呈现这些区别，旧 Socket 消息不能覆盖服务端结果。证据是 `src/utils/productionHarnessContract.ts`、`src/views/production/components/rightChatBox/productionHarnessPanel.vue` 与上述定向单测；真实交互体验和长期运行指标仍待测。

Video 试用接线：生产 grant 增加独立 `videoProposal` 开关，父 Run 的 `videoEffects` 显示子审批、精确候选与本地费用估算，Owner 可版本化批准/拒绝。批准后卡片仍标为“供应商尚未提交”；第二次明确确认才调用独立 Video execute，客户端在过期或已有原请求时拒绝再次提交。后端执行入口默认关闭；HTTP 404、超时或其他不确定结果只提示核对原请求，不自动重试。此面板暂未提供 Video 本地取消、Artifact 修复或报价策略设置，因此不能称视频操作闭环。`productionHarnessContract.test.ts` 的 7 个定向用例和非声明式 Vue 类型检查通过；未做浏览器、真实 Provider 或全量验收。

视频工作台的当前文生视频选型现可由 Owner 读取并按 expectedRevision 配置本地费用估算；目标精确包含 Project、Vendor、Model、能力、输出时长/分辨率/画幅和音频。仅无图片输入的文生视频轨道可打开此控件，改选型后必须重新读取，提交前另有人工确认；服务端再次核对 Owner、选型 schema 和版本。它不保存 Prompt、不批准候选、不提交 Vendor，也不是实际报价。`videoQuotePolicyClient.test.ts` 的 2 个合约定向用例和相关 Web 7 例通过，非声明式 Vue 类型检查通过。当前 UI 未做浏览器验收，原段“无报价设置”是上一切片状态；Video 本地取消/媒体恢复 UI 仍未实现。

Video 原请求操作补充：试用面板对持久请求状态单独显示本地取消意图、停止本地追踪、待写媒体本地恢复和已观察媒体采纳，均要求对原 requestId 显式二次确认；状态不匹配时客户端禁用，后端继续核对 Owner、Run version、审批和证据。取消/停止不代表供应商已停或免计费，恢复不重新调用供应商，采纳前仍需服务器事务校验。默认关闭的执行路由同时关闭这些操作，因此 UI 可能收到 404；不能因此推断原请求没有外部效果。相关 Web 8 个生产合约与 2 个报价合约定向用例及非声明式 Vue 类型检查通过，未跑浏览器、真实 Provider 或全量测试。前段“无取消/媒体恢复 UI”是历史切片状态，由此更新。
