<template>
  <t-card class="script">
    <div class="title c">剧本</div>
    <div class="block pr" :style="{ '--block-color': colors[index % colors.length] }" v-for="(item, index) in data" :key="index">
      <pre>{{ item.blockScript }}</pre>
      <Handle :style="{ background: colors[index % colors.length] }" :id="`blockScript-${index}`" type="source" :position="Position.Right" />
    </div>
  </t-card>
</template>

<script setup lang="ts">
import { Handle, Position, useVueFlow } from "@vue-flow/core";

const data = ref([
  {
    blockScript: `# 第2集：真相大白，背叛之心
※ 青云宗，宗门大殿
△ 凌玄心脏猛地一缩，瞳孔骤缩
苏晚卿冷笑："还有你当宝贝的青云令"
"若不是我趁你养伤时，偷偷在令牌上动了手脚"
"让你没法引动令牌力量，我们怎么能这么容易逼你交出来？"
△ 凌玄盯着她，声音在抖："你什么意思？"
苏晚卿语气平静，像在说别人的事
"当年是我故意把妖兽引去黑风岭，又假装被困"
"让你不得不为了救我，硬接妖兽三道致命攻击"
"清辞当时修炼遇到瓶颈，需要你的青云宗本源灵力"
"可你修为太高，只有让你重伤废修，他才能取走本源"
"至于青云令，我早就用秘法削弱了令牌和你的感应"
"你以为你还能靠这令牌反抗？"
△ 凌玄气血逆流，再次一口鲜血喷出`,
  },
  {
    blockScript: `【特效】鲜血在青石上晕开刺目的红
"苏晚卿！！！"
"我待你掏心掏肺，你为什么要这么害我？"
"连我视若性命的青云令，你都要算计！"
△ 苏晚卿像是听到大笑话
"清辞才是真心对我，他能给我想要的大道"
"而你只会让我困在这宗门里，做个有名无实的夫人！"
△ 几个以前受过凌玄恩惠的长老突然开口
长老甲："凌玄，识时务者为俊杰！"
长老乙："你现在修为全废，青云令也没用了"
长老丙："早就不配管青云宗，不如乖乖交出令牌，还能保住一条命！"`,
  },
  {
    blockScript: `△ 凌玄看着这些人，心里凉得厉害
△ 沈清辞搂住苏晚卿的腰，笑得更加嚣张
"听到了吗？现在宗门上下都站在我们这边"
"你识相点，就现在把青云令交出来"
"要是敢反抗，我就废了你最后一点修为"
"把你扔去妖兽谷，让你尝尝被妖兽分食的滋味！"
△ 凌玄浑身颤抖，眼中血丝密布
△ 指着苏晚卿，指尖疯狂颤抖
【独白】她的真面目...我全看清楚了
【卡黑】
`,
  },
]);

const colors = ["#f87171", "#fbbf24", "#34d399", "#60a5fa", "#a78bfa"];
</script>

<style lang="scss" scoped>
.script {
  width: fit-content;
  .title {
    background-color: #000;
    width: fit-content;
    padding: 5px 10px;
    color: #fff;
    border-radius: 8px 0;
    font-size: 16px;
  }
  .block {
    margin-top: 8px;
    padding: 12px;
    border: 1px solid color-mix(in srgb, var(--block-color) 50%, transparent);
    border-left: 4px solid var(--block-color);
    background-image: linear-gradient(150deg, color-mix(in srgb, var(--block-color) 1%, transparent), #fff);
    border-radius: 8px;
    pre {
      margin: 0;
      font-family: "Source Code Pro", monospace;
      line-height: 1.8;
      font-size: 14px;
      white-space: pre-wrap;
      :deep(.script-line) {
        display: block;
      }
      :deep(.line-note) {
        width: fit-content;
        background: color-mix(in srgb, var(--block-color) 18%, #fff);
        border-radius: 4px;
        padding: 0 4px;
      }
      :deep(.line-triangle) {
        opacity: 0.6;
      }
      :deep(.line-bracket) {
        background: color-mix(in srgb, var(--block-color) 25%, #fff);
        border-radius: 4px;
        padding: 0 4px;
      }
      :deep(.line-title) {
        text-decoration: underline;
        text-underline-offset: 2px;
      }
    }
  }
}

$handelSize: 12px;

:deep(.source) {
  height: $handelSize;
  width: $handelSize;
  right: calc(var(--td-comp-paddingLR-xl) * -1 + -1px);
}
:deep(.target) {
  height: $handelSize;
  width: $handelSize;
}
</style>
