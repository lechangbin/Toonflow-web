# Agent Harness T18 · 跨入口兼容（阶段进度）

Issue：`lechangbin/Toonflow-app#74`。此 Web 分支叠在 T17 生产试用分支上，当前只完成 Script Harness 的服务端 Run 历史恢复切片；T18 的旧 Socket 所有权迁移、跨仓浏览器流程、bundle 清单和回滚验收尚未完成。

Script Harness 试用入口现在每次刷新先读取认证 Project 的 `list`，展示服务端最多 20 条近期 Run，再按选中的 Run ID 调用 `inspect`。刷新/重连时，选中的 Run 若仍在服务端最近窗口则保留；若已离开窗口，回到当前 Run 或最新一条。创建 Run 后的本地快照仅用于即时展示，后续状态仍由 HTTP 重新读取，不从旧 Socket 消息推断成功。Project 切换清空当前选中、最近 Run 和审批/授权状态，并重新按新 Project 查询；异步旧请求用 epoch/sequence 丢弃。

生产 Harness 试用面板也使用同一个近期 Run 选择函数，限制为服务端最多 20 条，并在当前选中不再位于近期窗口时回退到当前 Run 或最新一条。两侧都在选出 ID 后调用各自 scope 的 HTTP inspect；共享的是状态选择规则，不是角色授权或审批权限。

生产 Harness 试用面板此前已有当前与最近 Run 列表，此切片让 Script 入口具备对应的历史查看基础与共同选择规则，但两者还不是统一组件，也没有跨入口证据抽屉。旧 Script Socket 入口仍并行，不能声称其生命周期归属已移除。

定向验证：`tests/harnessRecentRuns.test.ts` 的 2 例覆盖保留选中、超出 20 条回退和空列表，`tests/scriptHarnessContract.test.ts` 的 2 例覆盖 HTTP 身份/版本化请求；非声明式 Vue 类型检查通过。未运行全量测试、构建、浏览器、真实 Provider 或 bundle 重建；这些依约留到所有阶段完成后的 T21 最终验收。

旧 Socket 止损切片：共用 `useChat.stopGenerate` 过去一发送 `stop` 就把消息本地标成 stop、清空当前消息并将界面状态置 idle；即使 Socket 未连接，也会产生虚假的已停止展示。现在仅发送停止请求，消息完成状态由服务端 `message:update` 决定。2 个定向单测验证已连接请求保持 streaming、断线发送失败不改消息；Vue 类型检查通过。这没有把旧 Socket 变成持久 Run，也未证明服务端必定回执；长时间无回执仍需要后续 T18/T21 处理。

迟到事件投影补强：旧消息进入 `complete`、`error` 或 `stop` 终态后，Web 不再接受它的后续状态/内容更新；旧消息的 `streaming` 更新也不能改变当前另一条消息的全局生成状态。3 个 `useChatStopBoundary` 定向测试与非声明式 Vue 类型检查通过。这是显示层防回跳，不能证明供应商副作用取消或服务端持久状态。

生成中指示修正：消息终态优先于内容块的残留 `streaming` 状态，收到服务端 stop 后不因旧内容块继续显示生成中。`useChatStopBoundary` 相关 4 例和 Vue 类型检查通过；上一段的 3 例是该修正前的阶段记录。

共享证据抽屉切片：Script 与 Production Harness 试用入口现在复用一个按需打开的 `agentTraceEvidenceDrawer`，只按当前选中 Project/Run 调用 Owner-only `/agentRuns/traceEvidence`。客户端拒绝 Run/Project 不匹配或无脱敏通过标志的响应，界面仅展示最近 100 条事件的序号、类型和 Run/Step 状态，不直接渲染诊断/原始 Prompt；切换 Run 会清空旧证据并丢弃迟到响应。2 个专用合约单测与近期 Run 定向用例、非声明式 Vue 类型检查通过。真实浏览器展示、5000 条长期性能和跨仓完整证据核验留到 T21。旧 Socket 仍并行，不能称 T18 完成。

Video 证据字段联动：App 安全导出加入格式受限的视频请求/媒体 ID 后，共享抽屉仅展示这两个 ID，不展示媒体 URL、路径或原始供应商回包；客户端拒绝伪造成 URL 的 ID。2 个证据合约单测及非声明式 Vue 类型检查通过。旧段“仅展示事件状态”是前一切片记录，当前可从事件定位视频原请求，但真实浏览器和对账仍未验收。

2026-09-26 跨阶段预验收补强：旧单资产图片测试还在寻找已移除的 `handleGenerate`，暴露新计费审批面板在可能阻塞的 Vendor POST 期间因 `busy` 停止轮询。现在提交前立即读取权威请求状态，并在提交仍在途时保持 5 秒轮询；旧直接生成入口的测试改为约束受控面板接线。修复从 Web T09 逐级合并到 T18。T18 合并时将两套同名 Trace 类型与测试合并：保留 T18 的 Project/Run 与视频 ID 安全校验，也保留因果链、失败分类和保留策略字段。相关定向测试 19/19，通过全量 Web Node 测试 125/125；`vite build` 成功。工作树 `node_modules` 是指向原仓库的 junction，直接 `yarn type-check` 出现 5 个 TS2742 跨路径命名错误；原仓库同命令通过，工作树 `vue-tsc --noEmit -p tsconfig.app.json --preserveSymlinks` 通过。这是验收环境差异，不代表已完成 T18 浏览器、恢复与旧 Socket 迁移门槛。

面试追问：为什么“最近 20 条”要从服务端读，而不是依赖当前页面保留的消息？页面卸载、刷新或 Socket 断线会丢失本地消息；持久 Run 的状态与审批效果在服务端。选择 ID 只表示浏览位置，不能代替 `inspect` 的 Owner 校验与版本化状态。这个切片只证明定向合约，不证明浏览器重连体验。
