import axios from "@/utils/axios";
import projectStore from "@/stores/project";
import settingStore from "@/stores/setting";
import { useChat } from "@/utils/useChat";
import type { AssetImageState, FlowData, Storyboard } from "@/views/production/utils/flowBuilder";
import { isImageGenerationActiveState } from "@/utils/imageGenerationLifecycle";
import { reconcileLegacyStoryboardSubmission } from "@/utils/legacyStoryboardAcknowledgement";
import type { ChatMessagesData } from "@tdesign-vue-next/chat";
import { useThrottleFn } from "@vueuse/core";

function makeProductionAgentStore(projectId: string) {
  return defineStore(`productionAgent-${projectId}`, () => {
    const defMsg: ChatMessagesData[] = [
      {
        id: "welcome",
        role: "assistant",
        content: [
          { type: "text", status: "complete", data: $t("workbench.production.chatBox.welcomeMessage") },
          {
            type: "suggestion",
            status: "complete",
            data: [{ title: $t("workbench.production.chatBox.startMakingVideo"), prompt: $t("workbench.production.chatBox.startMakingVideoPrompt") }],
          },
        ],
      },
    ];
    onMounted(() => {
      if (messages.value.length <= 0) messages.value = [...defMsg, ...messages.value];
    });

    const flowData = ref<FlowData>({
      script: "", // 剧本
      scriptPlan: "", //导演计划
      storyboardTable: "", //分镜表
      assets: [], // 衍生资产
      storyboard: [], //分镜面板
      workbench: {
        videoList: [],
      }, // 工作台数据
    });

    const episodesId = ref<number>();

    const { connected, messages, chat, stopGenerate, socket, status, reconnect, connect, disconnect } = useChat({
      url: `${settingStore().baseUrl}/socket/productionAgent`,
      auth: () => ({
        isolationKey: `${projectId}:productionAgent:${episodesId.value}`,
        projectId: projectId,
        scriptId: episodesId.value,
      }),
      manageLifecycle: false,
      autoConnect: false,
      xmlTags: [
        { tag: "script", keepInMessage: false },
        { tag: "scriptPlan", keepInMessage: false },
        { tag: "storyboardTable", keepInMessage: false },
        { tag: "storyboardItem", keepInMessage: false },
      ],
      onXmlTag: async (data) => {
        const { tag, value, children, attrs, status } = data;
        if (tag === "script") {
          flowData.value.script = value ?? "";
        } else if (tag === "scriptPlan") {
          flowData.value.scriptPlan = value ?? "";
        } else if (tag === "storyboardTable") {
          flowData.value.storyboardTable = value ?? "";
        }
        // else if (tag === "storyboardItem") {
        //   if (status === "complete") {
        //     const prompt = attrs.prompt ?? "";
        //     const duration = Number(attrs.duration) || 0;
        //     const track = attrs.track || "";
        //     const shouldGenerateImage =
        //       (typeof attrs.shouldGenerateImage == "boolean" && attrs.shouldGenerateImage) ||
        //       String(attrs.shouldGenerateImage).toLowerCase() == "true"
        //         ? 1
        //         : 0;

        //     const videoDesc = attrs?.videoDesc ?? "";
        //     const existingIndex = flowData.value.storyboard.findIndex(
        //       (s) => s.prompt == prompt && s.duration == duration && videoDesc == s.videoDesc,
        //     );
        //     if (existingIndex !== -1) {
        //       // 已存在则更新 content，保留 id
        //       flowData.value.storyboard[existingIndex].prompt = prompt;
        //     } else {
        //       // 不存在则追加新条目
        //       flowData.value.storyboard.push({
        //         prompt: prompt || "",
        //         duration: Number(duration) || 0,
        //         state: "未生成" as "未生成" | "生成中" | "已完成" | "生成失败",
        //         src: null,
        //         associateAssetsIds: JSON.parse(attrs.associateAssetsIds) || [],
        //         videoDesc: videoDesc,
        //         shouldGenerateImage: shouldGenerateImage,
        //       });
        //       await addStoryboardInfo([
        //         {
        //           prompt: prompt || "",
        //           duration: Number(duration) || 0,
        //           track: track || "",
        //           state: "未生成" as "未生成" | "生成中" | "已完成" | "生成失败",
        //           src: null,
        //           videoDesc,
        //           shouldGenerateImage,
        //           associateAssetsIds: JSON.parse(attrs.associateAssetsIds) || [],
        //         },
        //       ]);
        //     }
        //   }
        // }
        if (status == "complete") {
          throttledFn();
        }
      },
    });

    // 实际的节流方法
    const throttledFn = useThrottleFn(
      () => {
        setFlowData(episodesId.value);
      },
      500,
      true,
      true,
    );
    // 注册 getPlanData 事件（无需依赖组件生命周期）
    watch(
      socket,
      (s) => {
        if (s) {
          s.on("connect", () => {
            getHistory();
          });
          s.on("getFlowData", (_, callback) => {
            const returnData = JSON.parse(JSON.stringify(flowData.value));
            returnData.assets.forEach((item: any) => {
              delete item.prompt;
              delete item.flowId;
              delete item.src;
              if (item.derive && item.derive.length) {
                item.derive.forEach((deriveItem: any) => {
                  delete deriveItem.prompt;
                  delete deriveItem.flowId;
                  delete deriveItem.src;
                });
              }
            });
            returnData.storyboard.forEach((item: any) => {
              delete item.prompt;
              delete item.src;
              delete item.flowId;
            });
            callback(returnData);
          });
          s.on("addDeriveAsset", async (data, callback) => {
            const assets = flowData.value.assets.find((a) => a.id === data.assetsId);
            if (!assets) return callback({ success: false, message: $t("storyboard.assets.notExist") });
            const deriveAssetList = assets.derive || [];
            const item = deriveAssetList.find((d) => d.id === data.id);
            if (item) {
              if (!item) return callback({ success: false, message: $t("storyboard.assets.notDerivativeExist") });
              item.name = data.name;
              item.type = assets.type;
              callback({ success: true, message: $t("storyboard.assets.derivativeUpdateSuccess") });
            } else {
              deriveAssetList.push({
                assetsId: data.assetsId,
                id: data.id,
                name: data.name,
                type: assets.type,
                desc: data.describe,
                prompt: "",
                state: "未生成" as "未生成" | "生成中" | "已完成" | "生成失败",
                src: "",
              });
              callback({ success: true, message: $t("storyboard.assets.derivativeAddSuccess") });
            }
          });
          s.on("delDeriveAsset", async (data, callback) => {
            const assets = flowData.value.assets.find((a) => a.id === data.assetsId);
            if (!assets) return callback({ success: false, message: $t("storyboard.assets.notExist") });
            const deriveAssetList = assets.derive || [];
            const index = deriveAssetList.findIndex((d) => d.id === data.id);
            if (index === -1) return callback({ success: false, message: $t("storyboard.assets.notDerivativeExist") });
            deriveAssetList.splice(index, 1);
            callback({ success: true, message: $t("storyboard.assets.derivativeDelSuccess") });
          });
          s.on("generateDeriveAsset", async (data, callback) => {
            const assetsData = await batchGenerateAssets(data.ids);
            if (assetsData === undefined) {
              return callback({ success: false, message: $t("workbench.imageLifecycle.errorGenerationFailed") });
            }
            callback({ success: true, message: assetsData });
          });
          s.on("generateStoryboard", async (data, callback) => {
            const storyData = await batchGenerateStoryboard(data.ids);
            callback({ success: true, message: storyData });
          });
          s.on("addStoryboard", async (data, callback) => {
            const insertVal = {
              prompt: data.prompt || "",
              duration: Number(data.duration) || 0,
              track: data.track || "",
              state: "未生成" as "未生成" | "生成中" | "已完成" | "生成失败",
              src: null,
              videoDesc: data.videoDesc,
              shouldGenerateImage:
                (typeof data.shouldGenerateImage == "boolean" && data.shouldGenerateImage) || String(data.shouldGenerateImage).toLowerCase() == "true"
                  ? 1
                  : 0,
              associateAssetsIds: data.associateAssetsIds || [],
            };
            const outcome = await reconcileLegacyStoryboardSubmission(
              () => addStoryboardInfo([insertVal]), getFlowData);
            if (outcome === "acknowledged") {
              throttledFn();
              callback({ success: true, message: $t("storyboard.assets.derivativeAddSuccess") });
            } else {
              callback({ success: false, message: "分镜提交结果不确定，请刷新分镜面板核对；不要自动重试。" });
            }
          });
        }
      },
      { immediate: true },
    );

    async function setFlowData(scriptId?: number) {
      await axios.post("/production/saveFlowData", {
        projectId: projectId,
        data: flowData.value,
        episodesId: scriptId || episodesId.value,
      });
    }

    async function getFlowData() {
      const { data } = await axios.post("/production/getFlowData", {
        projectId: projectId,
        episodesId: episodesId.value,
      });
      flowData.value = data;
    }
    async function batchGenerateStoryboard(allIds: number[], compulsory: boolean = false) {
      try {
        const { data } = await axios.post("/production/storyboard/batchGenerateImage", {
          scriptId: episodesId.value,
          projectId: projectId,
          storyboardIds: allIds,
          concurrentCount: settingStore().otherSetting.assetsBatchGenereateSize,
          compulsory,
        });
        if (data) {
          if (flowData.value.storyboard.length === 0) {
            flowData.value.storyboard = data;
            return data;
          } else {
            flowData.value.storyboard.forEach((item) => {
              const findData = data.find((i: any) => i.id == item.id);
              if (findData) {
                item.state = findData.state;
                item.src = findData.src;
              }
            });
          }
        }
        return data;
      } catch (e) {
        window.$message.error((e as any)?.message);
      }
    }
    async function batchGenerateAssets(allIds: number[]) {
      try {
        const { data } = await axios.post("/production/assets/batchGenerateAssetsImage", {
          assetIds: allIds,
          projectId: projectId,
          scriptId: episodesId.value,
          concurrentCount: settingStore().otherSetting.assetsBatchGenereateSize,
        });
        // 只登记后端已接受的 ID，展示状态由统一轮询契约回填。
        allIds.forEach(addAcceptedAssetImageId);
        void pollAssetsImages();
        return data;
      } catch (e) {
        // 拒绝必须给出可理解的提示，且不残留虚假“等待中”
        window.$message.error((e as any)?.message || $t("workbench.imageLifecycle.errorGenerationFailed"));
        return undefined;
      }
    }
    const acceptedAssetImageIds = ref<number[]>([]);
    function addAcceptedAssetImageId(id: number) {
      if (!acceptedAssetImageIds.value.includes(id)) acceptedAssetImageIds.value.push(id);
    }
    function removeAcceptedAssetImageId(id: number) {
      acceptedAssetImageIds.value = acceptedAssetImageIds.value.filter((candidate) => candidate !== id);
    }
    const assetsNotStateImageIds = computed(() => {
      const ids: number[] = [];
      flowData.value.assets.forEach((asset) => {
        if (asset.derive) {
          asset.derive.forEach((derive) => {
            if (isImageGenerationActiveState(derive.state)) {
              ids.push(derive.id);
            }
          });
        }
      });
      return [...new Set([...ids, ...acceptedAssetImageIds.value])];
    });
    const storyboardNotStateImageIds = computed(() => {
      const ids: number[] = [];
      flowData.value.storyboard.forEach((asset) => {
        if (asset.state == "生成中" && asset.id) {
          ids.push(asset.id);
        }
      });
      return ids;
    });
    // ---- 资产图片轮询 ----
    let assetsPollingTimer: number | null = null;
    let assetsPollingInFlight = false;

    async function pollAssetsImages() {
      const ids = assetsNotStateImageIds.value;
      if (ids.length === 0 || assetsPollingInFlight) return;
      assetsPollingInFlight = true;
      try {
        const { data } = await axios.post("/production/assets/pollingImage", {
          ids: ids,
        });
        if (!data || data.length === 0) return;
        // 后端对每个请求 id 都返回权威状态；state=null 表示记录缺失，
        // 置回“未生成”停止等待，不能无限轮询。
        const records = data as Array<{ id: number; state: string | null; src?: string | null; errorKind?: string | null; prompt?: string | null }>;
        records.forEach((record) => {
          removeAcceptedAssetImageId(record.id);
          flowData.value.assets.forEach((asset) => {
            if (!asset.derive) return;
            asset.derive.forEach((derive) => {
              if (derive.id === record.id) {
                derive.state = (record.state ?? "未生成") as AssetImageState;
                if (record.src) derive.src = record.src;
                derive.errorKind = record?.errorKind ?? "";
                derive.prompt = record?.prompt ?? "";
              }
            });
          });
        });
      } catch (e) {
        console.error("[assetsPolling] error", e);
      } finally {
        assetsPollingInFlight = false;
      }
    }

    function startAssetsPolling() {
      if (assetsPollingTimer) return;
      assetsPollingTimer = window.setInterval(async () => {
        if (assetsNotStateImageIds.value.length === 0) {
          stopAssetsPolling();
          return;
        }
        await pollAssetsImages();
      }, 5000);
      // 立即执行一次
      pollAssetsImages();
    }

    function stopAssetsPolling() {
      if (assetsPollingTimer) {
        clearInterval(assetsPollingTimer);
        assetsPollingTimer = null;
      }
    }

    watch(
      () => assetsNotStateImageIds.value,
      (ids) => {
        if (ids.length > 0) {
          startAssetsPolling();
        } else {
          stopAssetsPolling();
        }
      },
    );

    // ---- 分镜图片轮询 ----
    let storyboardPollingTimer: number | null = null;
    let storyboardPollingInFlight = false;

    async function pollStoryboardImages() {
      const ids = storyboardNotStateImageIds.value;
      if (ids.length === 0 || storyboardPollingInFlight) return;
      storyboardPollingInFlight = true;
      try {
        const { data } = await axios.post("/production/storyboard/pollingImage", {
          ids: ids,
        });
        if (!data || data.length === 0) return;
        const records = data as Array<{ id: number; state: string; src?: string; reason?: string }>;
        records.forEach((record) => {
          const item = flowData.value.storyboard.find((s) => s.id === record.id);
          if (item) {
            item.state = record.state as "未生成" | "生成中" | "已完成" | "生成失败";
            if (record.src) item.src = record.src;
            item.reason = record?.reason ?? "";
          }
        });
      } catch (e) {
        console.error("[storyboardPolling] error", e);
      } finally {
        storyboardPollingInFlight = false;
      }
    }

    function startStoryboardPolling() {
      if (storyboardPollingTimer) return;
      storyboardPollingTimer = window.setInterval(async () => {
        if (storyboardNotStateImageIds.value.length === 0) {
          stopStoryboardPolling();
          return;
        }
        await pollStoryboardImages();
      }, 5000);
      // 立即执行一次
      pollStoryboardImages();
    }

    function stopStoryboardPolling() {
      if (storyboardPollingTimer) {
        clearInterval(storyboardPollingTimer);
        storyboardPollingTimer = null;
      }
    }

    watch(
      () => storyboardNotStateImageIds.value,
      (ids) => {
        if (ids.length > 0) {
          startStoryboardPolling();
        } else {
          stopStoryboardPolling();
        }
      },
    );

    function updateContext() {
      if (episodesId.value! < 0) return;
      const ctx = {
        isolationKey: `${projectId}:productionAgent:${episodesId.value}`,
        projectId: projectId,
        scriptId: episodesId.value,
      };
      if (!connected.value) connect();
      socket.value!.emit("updateContext", ctx);
    }
    async function addStoryboardInfo(items: any[]) {
      const { data } = await axios.post("/production/storyboard/batchAddStoryboardInfo", {
        scriptId: episodesId.value,
        data: items,
        projectId: projectId,
      });

      return data;
    }

    const loadingHistory = ref(false);
    async function getHistory() {
      loadingHistory.value = true;
      const { data } = await axios.post(`/agents/getMemory`, {
        projectId: projectId,
        episodesId: episodesId.value,
        agentType: "productionAgent",
      });
      messages.value = [];
      messages.value = [...defMsg, ...data];
      loadingHistory.value = false;
    }

    const thinkLevel = ref(0);

    function updateThinkConfig(value: number) {
      thinkLevel.value = value;
      if (socket.value) {
        socket.value.emit("updateThinkConfig", { think: value > 0, thinlLevel: value });
      }
    }

    return {
      connected,
      messages,
      chat,
      stopGenerate,
      socket,
      status,
      flowData,
      setFlowData,
      getFlowData,
      episodesId,
      stopAssetsPolling,
      stopStoryboardPolling,
      updateContext,
      getHistory,
      loadingHistory,
      batchGenerateStoryboard,
      reconnect,
      thinkLevel,
      updateThinkConfig,
    };
  });
}

const storeMap = new Map<string, ReturnType<typeof makeProductionAgentStore>>();

function createProductionAgentStore(projectId: string) {
  if (!storeMap.has(projectId)) {
    storeMap.set(projectId, makeProductionAgentStore(projectId));
  }
  return storeMap.get(projectId)!;
}

export default function useProductionAgentStore() {
  const id = projectStore().project?.id;
  if (!id) throw new Error("No project selected");
  return createProductionAgentStore(id)();
}
