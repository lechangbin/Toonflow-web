<template>
  <div class="production">
    <t-tabs v-model="setData">
      <t-tab-panel v-for="(item, index) in setContent" :key="index" :value="index + ''" :label="item.title">
        <t-button style="margin-top: 10px" @click="addStoryboard">添加分镜</t-button>
      </t-tab-panel>
    </t-tabs>
    <storyboard v-model="storyboardShow"></storyboard>
  </div>
</template>

<script setup lang="ts">
import projectStore from "@/stores/project";
const { project } = storeToRefs(projectStore());
import storyboard from "./components/storyboard/index.vue";

//集标题
const setData = ref("0");
//集内容
const setContent = ref([
  {
    title: "第一集",
    storyboard: [
      {
        prompt: "这个是一个提示词1阿瑟地方撒放到水电费水电费水电费水电费水电费水电费水电撒旦法士大夫水电费水电费水电费费水电费",
        imageUrl: "https://tdesign.gtimg.com/demo/demo-image-1.png",
      },
      {
        prompt: "这个是一个提示词2",
        imageUrl: "https://tdesign.gtimg.com/demo/demo-image-1.png",
      },
      {
        prompt: "这个是一个提示词2",
        imageUrl: "https://tdesign.gtimg.com/demo/demo-image-1.png",
      },
      {
        prompt: "这个是一个提示词2",
        imageUrl: "https://tdesign.gtimg.com/demo/demo-image-1.png",
      },
    ],
    video: [
      {
        model: "doubao-seedance-1-5-pro-251215",
        mode: "endFrameOptional",
        images: [""],
        resolution: "1920x1080",
        aspectRatio: "16:9",
        duration: 5,
        prompt: "",
        videoUrl: "//v2.cri.cn/M00/02/C3/rBABDmblg6eADAXKBZHO91F1HZ0889.mp4",
        generateUrl: [
          "http://202508W24.ban.tools.codebook.ltd/js/player/CodeBookCore.html?url=https%3A%2F%2Fwww.lingyuzhao.top%2Fb%2Fshare%2Fdownload2%2FnoLogin%2Fshare%2F17c8d054513ae15059080dd0725df371c9145569eb1cb0a84c036d4cdd9acea5.mp4",
          "http://202508W24.ban.tools.codebook.ltd/js/player/CodeBookCore.html?url=https%3A%2F%2Fwww.lingyuzhao.top%2Fb%2Fshare%2Fdownload2%2FnoLogin%2Fshare%2F17c8d054513ae15059080dd0725df371c9145569eb1cb0a84c036d4cdea5.mp4",
        ],
      },
      {
        model: "doubao-seedance-1-0-lite-i2v-250428",
        mode: "endFrameOptional",
        images: [""],
        resolution: "1920x1080",
        aspectRatio: "16:9",
        duration: 5,
        prompt: "",
        videoUrl: "https://cms-emer-res.cctvnews.cctv.com/cctv/video/20240502/7d889b4dce894c60b26a96e3e9c6ee51_H264_3000K_MP4/20240502230635275.m3u8",
        generateUrl: [
          "http://202508W24.ban.tools.codebook.ltd/js/player/CodeBookCore.html?url=https%3A%2F%2Fwww.lingyuzhao.top%2Fb%2Fshare%2Fdownload2%2FnoLogin%2Fshare%2F17c8d054513ae15059080dd0725df371c9145569eb1cb0a84c036d4cdd9acea5.mp4",
        ],
      },
      {
        model: "doubao-seedance-1-5-pro-251215",
        mode: "endFrameOptional",
        images: [],
        resolution: "1920x1080",
        aspectRatio: "16:9",
        duration: 5,
        prompt: "",
        videoUrl: "",
        generateUrl: [],
      },
    ],
  },
  {
    title: "第二集",
    storyboard: [],
    video: [],
  },
]);
const storyboardShow = ref(true);
//添加分镜
function addStoryboard() {
  storyboardShow.value = true;
}
</script>

<style lang="scss" scoped>
.production {
}
</style>
