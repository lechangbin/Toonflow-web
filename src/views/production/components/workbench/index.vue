<template>
  <t-dialog
    :header="false"
    :footer="false"
    :closeBtn="false"
    v-model:visible="visible"
    attach="body"
    width="80vw"
    placement="center"
    mode="full-screen"
    dialogClassName="noFooter"
    class="fullscreenDialog">
    <div class="closure">
      <i-close-small theme="outline" size="24" fill="#4a4a4a" @click="visible = false" />
    </div>
    <div class="topMenu f ac">
      <t-tooltip content="快速预览" placement="bottom" theme="light" destroyOnClose :showArrow="false">
        <div class="item fc c" :class="{ active: activeMenu === 'preview' }" @click="activeMenu = 'preview'">
          <i-blackboard class="icon" />
        </div>
      </t-tooltip>
      <t-tooltip content="视频生成" placement="bottom" theme="light" destroyOnClose :showArrow="false">
        <div class="item fc c" :class="{ active: activeMenu === 'generate' }" @click="activeMenu = 'generate'">
          <i-playback-progress class="icon" />
        </div>
      </t-tooltip>
      <t-tooltip content="视频剪辑" placement="bottom" theme="light" destroyOnClose :showArrow="false">
        <div class="item fc c" :class="{ active: activeMenu === 'editVideo' }" @click="activeMenu = 'editVideo'">
          <i-editing class="icon" />
        </div>
      </t-tooltip>
    </div>
    <div class="content">
      <preview v-show="activeMenu === 'preview'" />
      <!-- <generate v-show="activeMenu === 'generate'" /> -->
      <editVideo v-show="activeMenu === 'editVideo'" />
    </div>
  </t-dialog>
</template>

<script setup lang="ts">
import preview from "./preview.vue";
import editVideo from "./editVideo.vue";

const visible = defineModel("visible", {
  type: Boolean,
  default: false,
});

const activeMenu = ref("editVideo");
</script>

<style lang="scss" scoped>
.fullscreenDialog {
  :deep(.t-dialog__body) {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }
  .closure {
    position: absolute;
    top: var(--td-comp-paddingTB-xl);
    right: var(--td-comp-paddingLR-xxl);
    z-index: 9999;
    cursor: pointer;
  }
  .topMenu {
    padding-bottom: 1rem;
    width: fit-content;
    .item {
      margin-right: 4px;
      cursor: pointer;
      width: 50px;
      height: 50px;
      .icon {
        font-size: 24px;
      }
      .title {
        font-size: 10px;
        white-space: nowrap;
      }
      &:hover {
        background-color: #ecedef;
        border-radius: 16px;
      }
    }
    .active {
      background-color: #000 !important;
      color: #fff;
      border-radius: 16px;
    }
  }
  .content {
    flex: 1;
    overflow: hidden;
  }
  .editStoryboard {
    width: 100%;
    height: 75vh;
  }
}
</style>
