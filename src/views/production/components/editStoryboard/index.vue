<template>
  <t-dialog :footer="false" v-model:visible="visible" attach="body" width="80vw" placement="center">
    <VueFlow id="editStoryboard" class="editStoryboard" :nodes="nodes" :edges="edges" :min-zoom="0.01" fit-view-on-init @connect="onConnect">
      <template #node-upload="{ id, data }">
        <uploadNode :id="id" :data="data" />
      </template>

      <template #node-generated="{ id, data }">
        <generatedNode :id="id" :data="data" @generate="handleGenerate" />
      </template>

      <Background></Background>
      <Controls />

      <Panel position="top-right">
        <t-button theme="primary" shape="circle" @click="addUploadNode">
          <template #icon><i-plus /></template>
        </t-button>
      </Panel>
    </VueFlow>
  </t-dialog>
</template>

<script setup lang="ts">
import { VueFlow, useVueFlow, Panel } from "@vue-flow/core";
import { Background } from "@vue-flow/background";
import { Controls } from "@vue-flow/controls";
import uploadNode from "./uploadNode.vue";
import generatedNode from "./generatedNode.vue";
import "@vue-flow/core/dist/style.css";
import "@vue-flow/core/dist/theme-default.css";
import "@vue-flow/controls/dist/style.css";

const visible = defineModel("visible", {
  type: Boolean,
  default: false,
});

const { addEdges } = useVueFlow();

// 节点ID计数器
let nodeIdCounter = 3;

const nodes = ref([
  {
    id: "upload-1",
    type: "upload",
    position: { x: 100, y: 100 },
    data: {
      image: "https://picsum.photos/300/200?random=1",
    },
  },
  {
    id: "upload-2",
    type: "upload",
    position: { x: 100, y: 400 },
    data: {
      image: "https://picsum.photos/300/400?random=2",
    },
  },
  {
    id: "generated-1",
    type: "generated",
    position: { x: 500, y: 200 },
    data: {
      generatedImage: "https://picsum.photos/400/300?random=3",
      references: [{ image: "https://picsum.photos/60/60?random=4" }, { image: "https://picsum.photos/60/60?random=5" }],
      prompt: "将图二左侧的人换成图1",
      model: "banana-pro",
      ratio: "16:9",
      quality: "1K",
      steps: 49,
    },
  },
]);

const edges = ref([
  { id: "e-upload1-gen1", source: "upload-1", target: "generated-1", animated: true, style: { stroke: "#a3e635" } },
  { id: "e-upload2-gen1", source: "upload-2", target: "generated-1", animated: true, style: { stroke: "#a3e635" } },
]);

// 连接处理
const onConnect = (params: any) => {
  addEdges([{ ...params, animated: true, style: { stroke: "#a3e635" } }]);
};

// 添加新的上传节点
const addUploadNode = () => {
  const newNodeId = `upload-${nodeIdCounter++}`;
  const lastUploadNode = nodes.value.filter((n) => n.type === "upload").pop();
  const newY = lastUploadNode ? lastUploadNode.position.y + 350 : 100;

  nodes.value.push({
    id: newNodeId,
    type: "upload",
    position: { x: 100, y: newY },
    data: {
      image: `https://picsum.photos/300/200?random=${nodeIdCounter}`,
    },
  });
};

// 处理生成
const handleGenerate = (id: string) => {
  console.log("Generate for node:", id);
  // TODO: 实现生成逻辑
};
</script>

<style lang="scss" scoped>
.editStoryboard {
  width: 100%;
  height: 75vh;
}

// Vue Flow Handle 样式
:deep(.vue-flow__handle) {
  width: 12px;
  height: 12px;
  background: #a3e635;
  border: 2px solid #fff;
}

// Edge 样式
:deep(.vue-flow__edge-path) {
  stroke: #a3e635;
  stroke-width: 2px;
}
</style>
