<template>
  <VueFlow class="flowMain" v-model="flowData" :min-zoom="0.01">
    <template #node-script="props">
      <scriptNode :id="props.id" :data="props.data" />
    </template>
    <template #node-assets="props">
      <div>2</div>
    </template>
    <template #node-storyboardTable="props">
      <div>3</div>
    </template>
    <template #node-storyboard="props">
      <div>4</div>
    </template>
    <template #node-preview="props">
      <div>5</div>
    </template>
    <template #node-poster="props">
      <div>6</div>
    </template>
    <!-- <Background :gap="100">
        <template #pattern>
          <svg :width="24 * viewport.zoom" :height="24 * viewport.zoom" viewBox="0 0 48 48">
            <path d="M14 14L34 34" :stroke="getCssColor('--mainColor')" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M14 34L34 14" :stroke="getCssColor('--mainColor')" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </template>
      </Background> -->
    <Background />
    <Controls />
  </VueFlow>
</template>

<script setup lang="ts">
import { VueFlow } from "@vue-flow/core";
import { Background } from "@vue-flow/background";
import { Controls } from "@vue-flow/controls";
import "@vue-flow/core/dist/style.css";
import "@vue-flow/core/dist/theme-default.css";
import "@vue-flow/controls/dist/style.css";
//子node组件
import scriptNode from "./node/script.vue";

const flowData = ref([
  {
    id: "1",
    type: "script",
    position: {
      x: 237,
      y: 79,
    },
  },
  {
    id: "2",
    type: "assets",
    position: {
      x: 368,
      y: 227,
    },
  },
  {
    id: "3",
    type: "storyboardTable",
    position: {
      x: 68,
      y: 345,
    },
  },
  {
    id: "4",
    type: "storyboard",
    position: {
      x: 190,
      y: 155,
    },
  },
  {
    id: "5",
    type: "preview",
    position: {
      x: 301,
      y: 328,
    },
  },
  {
    id: "6",
    type: "poster",
    position: {
      x: 92,
      y: 212,
    },
  },
  {
    id: "e1-2",
    source: "1",
    sourceHandle: "blockScript-0",
    target: "2",
    animated: true,
    style: { stroke: "#10b981", strokeWidth: 4 },
  },
]);
</script>

<style lang="scss" scoped></style>
