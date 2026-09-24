# T17 生产 Harness Web 接线（阶段记录）

App 后端的 `production-harness-v1` 与旧生产 Socket 路径并行。此 Web 分支在生产聊天侧栏增加显式“受控 Run（试用）”入口，不隐式接管旧聊天。新入口使用 HTTP start/inspect/list/cancel/effects：创建 Run 后从服务端重新读取当前 Run 与最近 Run，并分别展示来源于持久子审批的图片与派生资产效果状态；不根据聊天文本或 Socket 断连推断效果成功。Owner 可在新面板对待处理图片候选明确批准/拒绝；批准范围后还需第二次确认才会提交供应商。派生资产候选展示经后端校验的完整待审 payload；缺 payload 时禁用批准，Owner 的版本化批准会立即触发 T08 本地写入。命令失败均不自动重试。图片取消、媒体修复和人工核对仍在资产配置中的既有“受控单资产生图”面板完成。

定向验证：`tests/productionHarnessContract.test.ts` 的 4 个用例覆盖版本化请求、Project ID、取消 affordance、两类效果读取、图片审批/提交分离、派生资产批准缺失 payload 时拒绝；`vue-tsc --noEmit --declaration false --composite false --project tsconfig.app.json` 通过。常规 `yarn type-check` 因共享 `node_modules` 工作树下已有 Socket 类型 TS2742 的跨目录声明推断失败，不能声称该构建检查通过。本阶段未执行全量前端测试、构建或浏览器验收。

兼容入口中的旧 T08 派生审批卡片也同步展示已校验的完整 payload；若后端未返回 payload，即使 allowedActions 包含 approve，前端仍禁用批准但保留拒绝能力。相关 2 个定向单测与上述 4 个合约单测共 6 个通过。该 UI 防误操作层不能替代服务端冻结 payload、Owner 身份与目标状态校验。

边界：这是受控生产入口的状态展示接缝，不等于旧 Socket 生命周期已移除。T18 仍需把当前/近期 Run、审批和证据展示统一到所有 Agent 入口，并在真实 App/Web 浏览器流程中验证刷新、重连、批准、拒绝、停止、恢复和兼容回退；T21 才执行最终全量验收。

面试追问：为什么显示“指导 Run 成功”时仍要单列图片效果？因为模型文本 Step 的完成和供应商付费效果属于两个持久生命周期；子审批可能仍 pending、结果未知或取消后迟到。前端以 HTTP 效果投影呈现这些区别，旧 Socket 消息不能覆盖服务端结果。证据是 `src/utils/productionHarnessContract.ts`、`src/views/production/components/rightChatBox/productionHarnessPanel.vue` 与上述定向单测；真实交互体验和长期运行指标仍待测。
