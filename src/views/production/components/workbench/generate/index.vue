<template>
  <div class="index">
    <div class="referenceImage"></div>
    <div class="generate">
      <div class="prompt"></div>
      <div class="video"></div>
    </div>
    <div class="track">
      <newTrack />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import newTrack from "./components/track.vue";
</script>

<style lang="scss" scoped>
.index {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 120px);
  gap: 16px;
  overflow: hidden;
  .data {
    height: 80%;
    width: 100%;
    .prompt {
      width: 50%;
    }
    .video {
      width: 50%;
    }
  }
  .track {
  }
}
</style>
