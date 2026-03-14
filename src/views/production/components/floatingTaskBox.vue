<template>
  <div class="floatingTaskBox">
    <div class="box">
      <div class="head jb ac">
        <span>Untitled</span>
        <div>
          <i-click-to-fold
            theme="outline"
            size="17"
            fill="#000000"
            style="cursor: pointer"
            @click="
              () => {
                openShowVisible = false;
              }
            " />
        </div>
      </div>
      <div class="content">
        <div class="caht">12</div>
        <div class="inputBox">
          <t-textarea v-model="needData" placeholder="请输入你的设计需求" name="description" :autosize="{ minRows: 3, maxRows: 3 }" />
          <div class="send c" @click="sendFn">
            <i-arrow-up theme="outline" size="16" fill="#fff" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const openShowVisible = defineModel({
  type: Boolean,
  default: false,
});
//输入框内容
const needData = ref("");
function sendFn() {}
</script>

<style lang="scss" scoped>
.floatingTaskBox {
  position: absolute;
  top: 60px;
  right: 10px;
  bottom: 10px;
  display: flex;
  flex-direction: column;
  .box {
    width: 350px;
    height: 100%;
    border-radius: 10px;
    border: 1px solid #919191;
    overflow-y: auto;
    .head {
      height: 40px;
      line-height: 40px;
      padding: 0 10px;
      span {
        font-size: 14px;
        font-weight: 900;
        color: #000;
      }
    }
    .content {
      padding: 10px;
      font-size: 14px;
      height: calc(100% - 40px);
      position: relative;
      .caht {
        height: calc(100% - 130px);
        overflow-y: auto;
        background-color: red;
      }
      .inputBox {
        position: absolute;
        bottom: 10px;
        left: 10px;
        right: 10px;
        height: 120px;
        border-radius: 10px;
        border: 1px solid #d1d0d0;
        padding: 5px;
        :deep(.t-textarea) {
          flex: 1;
          border: none;
          .t-textarea__inner {
            border: none;
            box-shadow: none;
          }
        }
        .send {
          position: absolute;
          right: 5px;
          bottom: 5px;
          width: 28px;
          height: 28px;
          cursor: pointer;
          border-radius: 50%;
          background-color: #b6b9bf;
          border-color: #b6b9bf;
        }
      }
    }
  }
}
</style>
