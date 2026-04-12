<template>
  <div class="modelMap">
    <div></div>
  </div>
</template>

<script setup lang="ts">
import axios from "@/utils/axios";
interface ImageModel {
  name: string;
  modelName: string;
  type: "image";
  mode: ("text" | "singleImage" | "multiReference")[];
}

interface VideoModel {
  name: string;
  modelName: string;
  type: "video";
  mode: (
    | "singleImage"
    | "startEndRequired"
    | "endFrameOptional"
    | "startFrameOptional"
    | "text"
    | (`videoReference:${number}` | `imageReference:${number}` | `audioReference:${number}`)[]
  )[];
  audio: "optional" | false | true;
  durationResolutionMap: { duration: number[]; resolution: string[] }[];
}

function handleModelChange() {
  axios
    .post("/modelSelect/getModelList", { type: "all" })
    .then(({ data }) => {})
    .catch((error) => {
      console.error($t("components.modelSelect.msg.fetchModelFailed"), error);
    });
}
</script>

<style lang="scss" scoped>
.modelMap {
  width: 100%;
  height: 100%;
}
</style>
