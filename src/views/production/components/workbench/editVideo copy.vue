<template>
  <div class="editVideo">
    视频剪辑
    <ReactTimeline :editorData="editorData" :effects="effects" :onChange="onChange" />
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { Timeline } from "@xzdarcy/react-timeline-editor";
import "@xzdarcy/react-timeline-editor/dist/react-timeline-editor.css";
import { applyReactInVue } from "veaury";
import { createRoot } from "react-dom/client";

const ReactTimeline = applyReactInVue(Timeline, {
  react: {
    createRoot,
  },
});

const editorData = ref([
  {
    id: "0",
    actions: [
      {
        id: "action00",
        start: 0,
        end: 2,
        effectId: "effect0",
      },
    ],
  },
  {
    id: "1",
    actions: [
      {
        id: "action10",
        start: 1.5,
        end: 5,
        effectId: "effect1",
      },
    ],
  },
]);
const effects = ref({
  effect0: {
    id: "effect0",
    name: "效果0",
  },
  effect1: {
    id: "effect1",
    name: "效果1",
  },
});

const onChange = (data: any) => {
  editorData.value = data;
};
</script>

<style lang="scss" scoped></style>
<style>
.timeline-editor {
  height: 400px;
}
</style>
