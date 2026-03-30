import axios from "@/utils/axios";
import projectStore from "@/stores/project";
import settingStore from "@/stores/setting";
import { useChat } from "@/utils/useChat";
import type { FlowData } from "@/views/production/utils/flowBuilder";

export default defineStore(
  "productionAgent",
  () => {
    const flowData = ref<FlowData>({
      script: "", // 剧本
      scriptPlan: "", //拍摄计划
      storyboardTable: "", //分镜表
      assets: [], // 衍生资产
      storyboard: [], //分镜面板
      workbench: { name: "", duration: "", resolution: "", fps: "" }, // 工作台数据
    });

    const episodesId = ref<number>(-1);

    const { connected, messages, chat, stopGenerate, socket, status } = useChat({
      url: `${settingStore().baseUrl}/socket/productionAgent`,
      auth: {
        isolationKey: `${projectStore().project?.id}:productionAgent:${episodesId.value}`,
        projectId: projectStore().project?.id,
        scriptId: episodesId.value,
      },
      manageLifecycle: false,
      autoConnect: true,
      xmlTags: [
        { tag: "script", keepInMessage: false },
        { tag: "scriptPlan", keepInMessage: false },
        { tag: "storyboardTable", keepInMessage: false },
      ],
      onXmlTag: (data) => {
        const { tag, value, children, attrs, status } = data;
        if (tag === "script") {
          flowData.value.script = value ?? "";
        } else if (tag === "scriptPlan") {
          flowData.value.scriptPlan = value ?? "";
        } else if (tag === "storyboardTable") {
          flowData.value.storyboardTable = value ?? "";
        }
      },
    });
    // 注册 getPlanData 事件（无需依赖组件生命周期）
    watch(
      socket,
      (s) => {
        if (s) {
          s.on("getFlowData", (_, callback) => {
            callback(flowData.value);
          });
          s.on("addDeriveAsset", async (data, callback) => {
            const assets = flowData.value.assets.find((a) => a.id === data.assetsId);
            if (!assets) return callback({ success: false, message: "资产不存在" });
            const deriveAssetList = assets.derive || [];
            const item = deriveAssetList.find((d) => d.id === data.id);
            if (item) {
              if (!item) return callback({ success: false, message: "衍生资产不存在" });
              item.name = data.name;
              item.type = data.type;
              callback({ success: true, message: "更新成功" });
            } else {
              deriveAssetList.push({
                assetsId: data.assetsId,
                id: data.id,
                name: data.name,
                type: data.type,
                desc: data.describe,
                prompt: "",
                state: "未生成",
                src: "",
              });
              callback({ success: true, message: "添加成功" });
            }
          });
          s.on("delDeriveAsset", async (data, callback) => {
            const assets = flowData.value.assets.find((a) => a.id === data.assetsId);
            if (!assets) return callback({ success: false, message: "资产不存在" });
            const deriveAssetList = assets.derive || [];
            const index = deriveAssetList.findIndex((d) => d.id === data.id);
            if (index === -1) return callback({ success: false, message: "衍生资产不存在" });
            deriveAssetList.splice(index, 1);
            callback({ success: true, message: "删除成功" });
          });
        }
      },
      { immediate: true },
    );

    async function setFlowData() {
      await axios.post("/productionAgent/setFlowData", { projectId: projectStore().project?.id, agentType: "productionAgent", data: flowData.value });
    }

    async function getFlowData() {
      const { data } = await axios.post("/production/getFlowData", {
        projectId: projectStore().project?.id,
        episodesId: episodesId.value,
      });
      flowData.value = data;
    }

    return { connected, messages, chat, stopGenerate, socket, status, flowData, setFlowData, getFlowData, episodesId };
  },
  { persist: false },
);
