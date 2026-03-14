<template>
  <t-card class="storyboardTable">
    <Handle id="storyboardTable" type="source" :position="Position.Left" />
    <div class="title c">分镜表</div>
    <div class="content">
      <t-table bordered hover stripe size="small" table-layout="auto" row-key="id" :columns="columns" :data="data">
        <!-- <template #multiLine="{ col, row }">
          <t-tooltip :content="row[col.colKey]" placement="top">
            <div class="multi-line-cell">{{ row[col.colKey] }}</div>
          </t-tooltip>
        </template> -->
      </t-table>
    </div>
  </t-card>
</template>

<script setup lang="ts">
import { Handle, Position } from "@vue-flow/core";

const columns = ref<Record<string, unknown>[]>([
  { colKey: "id", title: "编号", align: "center" },
  { colKey: "act", title: "幕",   align: "center" },
  { colKey: "scene", title: "场景", cell: "multiLine" },
  { colKey: "description", title: "画面描述", width: 150, cell: "multiLine" },
  { colKey: "camera", title: "镜头/运镜", width: 150, cell: "multiLine" },
  { colKey: "prompt", title: "分镜图提示词", width: 150, cell: "multiLine" },
]);

const data = ref([
  {
    id: 1,
    act: "一",
    scene: "雨夜巷口",
    description: "主角撑伞站在霓虹下，远处警笛闪烁，地面积水映出倒影。",
    camera: "中景推进，轻微手持抖动",
    prompt: "cinematic rainy alley, neon reflection, young male with umbrella, police siren bokeh, moody blue tone",
  },
  {
    id: 2,
    act: "一",
    scene: "旧仓库外",
    description: "铁门半开，风吹动警戒线，女主从阴影中谨慎探头。",
    camera: "低机位仰拍，慢速摇移",
    prompt: "abandoned warehouse gate, caution tape fluttering, female detective in shadow, dramatic contrast lighting",
  },
  {
    id: 3,
    act: "二",
    scene: "仓库内部",
    description: "手电光束扫过木箱，尘埃颗粒在光柱中漂浮，脚步声回响。",
    camera: "POV跟拍，横向平移",
    prompt: "flashlight beam in dark warehouse, floating dust particles, wooden crates, suspense atmosphere, pov shot",
  },
  {
    id: 4,
    act: "二",
    scene: "控制室",
    description: "监控墙突然亮起，多个画面同时出现主角背影，气氛骤紧。",
    camera: "广角定机后快速推近",
    prompt: "surveillance control room, multiple monitors on, protagonist back silhouette, thriller style, wide angle",
  },
  {
    id: 5,
    act: "三",
    scene: "天台对峙",
    description: "清晨逆光下两人对峙，风掀起风衣下摆，城市天际线在远方。",
    camera: "远景拉近到近景，环绕半圈",
    prompt: "rooftop standoff at dawn, backlight silhouette, trench coat fluttering, city skyline, cinematic drama",
  },
  {
    id: 6,
    act: "三",
    scene: "天台边缘",
    description: "反派一步步后退到边缘，主角伸手劝阻，情绪达到顶点。",
    camera: "特写切换，快速推拉",
    prompt: "emotional climax on rooftop edge, villain stepping back, hero reaching out, intense facial close-up",
  },
  {
    id: 7,
    act: "尾声",
    scene: "医院走廊",
    description: "白色走廊尽头，女主靠墙长舒一口气，晨光透过百叶窗。",
    camera: "长焦压缩空间，静态镜头",
    prompt: "hospital corridor morning light through blinds, exhausted female lead, calm after storm, soft realistic tone",
  },
  {
    id: 8,
    act: "尾声",
    scene: "城市街道",
    description: "主角独自走入人群，镜头抬升俯瞰，故事以开放式结尾收束。",
    camera: "跟拍转航拍上升",
    prompt: "hero walking into crowd, urban street, camera crane up to aerial view, open ending, film still",
  },
]);
</script>

<style lang="scss" scoped>
.storyboardTable {
  min-width: 300px;
  .title {
    background-color: #000;
    width: fit-content;
    padding: 5px 10px;
    color: #fff;
    border-radius: 8px 0;
    font-size: 16px;
  }
  .multi-line-cell {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    overflow: hidden;
    text-overflow: ellipsis;
    word-break: break-all;
    line-height: 1.4;
    max-height: 4.2em;
    white-space: normal;
  }
  .content {
    margin-top: 8px;
  }
}
</style>
