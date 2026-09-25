# Agent Harness T18 · 跨入口兼容（阶段进度）

Issue：`lechangbin/Toonflow-app#74`。此 Web 分支叠在 T17 生产试用分支上，当前只完成 Script Harness 的服务端 Run 历史恢复切片；T18 的旧 Socket 所有权迁移、跨仓浏览器流程、bundle 清单和回滚验收尚未完成。

Script Harness 试用入口现在每次刷新先读取认证 Project 的 `list`，展示服务端最多 20 条近期 Run，再按选中的 Run ID 调用 `inspect`。刷新/重连时，选中的 Run 若仍在服务端最近窗口则保留；若已离开窗口，回到当前 Run 或最新一条。创建 Run 后的本地快照仅用于即时展示，后续状态仍由 HTTP 重新读取，不从旧 Socket 消息推断成功。Project 切换清空当前选中、最近 Run 和审批/授权状态，并重新按新 Project 查询；异步旧请求用 epoch/sequence 丢弃。

生产 Harness 试用面板也使用同一个近期 Run 选择函数，限制为服务端最多 20 条，并在当前选中不再位于近期窗口时回退到当前 Run 或最新一条。两侧都在选出 ID 后调用各自 scope 的 HTTP inspect；共享的是状态选择规则，不是角色授权或审批权限。

生产 Harness 试用面板此前已有当前与最近 Run 列表，此切片让 Script 入口具备对应的历史查看基础与共同选择规则，但两者还不是统一组件，也没有跨入口证据抽屉。旧 Script Socket 入口仍并行，不能声称其生命周期归属已移除。

定向验证：`tests/harnessRecentRuns.test.ts` 的 2 例覆盖保留选中、超出 20 条回退和空列表，`tests/scriptHarnessContract.test.ts` 的 2 例覆盖 HTTP 身份/版本化请求；非声明式 Vue 类型检查通过。未运行全量测试、构建、浏览器、真实 Provider 或 bundle 重建；这些依约留到所有阶段完成后的 T21 最终验收。

旧 Socket 止损切片：共用 `useChat.stopGenerate` 过去一发送 `stop` 就把消息本地标成 stop、清空当前消息并将界面状态置 idle；即使 Socket 未连接，也会产生虚假的已停止展示。现在仅发送停止请求，消息完成状态由服务端 `message:update` 决定。2 个定向单测验证已连接请求保持 streaming、断线发送失败不改消息；Vue 类型检查通过。这没有把旧 Socket 变成持久 Run，也未证明服务端必定回执；长时间无回执仍需要后续 T18/T21 处理。

面试追问：为什么“最近 20 条”要从服务端读，而不是依赖当前页面保留的消息？页面卸载、刷新或 Socket 断线会丢失本地消息；持久 Run 的状态与审批效果在服务端。选择 ID 只表示浏览位置，不能代替 `inspect` 的 Owner 校验与版本化状态。这个切片只证明定向合约，不证明浏览器重连体验。
