<template>
  <t-card class="assets">
    <Handle :id="props.handleIds.target" type="target" :position="Position.Top" />
    <div class="titleBar dragHandle">
      <div class="title">衍生资产</div>
    </div>
    <div class="content">
      <div class="cardGrid">
        <div v-for="asset in assets" :key="asset.id" class="assetItemBox">
          <t-card class="assetCard">
            <div v-if="asset.src" class="assetImageWrap">
              <t-image :src="asset.src" fit="cover" class="assetImage" :preview="true" :lazy="true">
                <template #overlayContent>
                  <div class="imageToolsWrap show">
                    <ImageTools :src="asset.src" position="br" />
                  </div>
                </template>
              </t-image>
            </div>
            <div v-else class="assetImageWrap assetImagePlaceholder">
              <t-loading v-if="asset.state == '生成中'" size="small" />
              <span v-else-if="asset.state == '生成失败'" style="color: red">生成失败</span>
              <t-empty v-else size="small" title="未生成" />
            </div>
            <div class="cardInfo">
              <div class="cardName">
                <span class="nameText">{{ asset.name }}</span>
                <t-tag theme="success">原资产</t-tag>
              </div>
              <div class="cardDesc">{{ asset.desc }}</div>
            </div>
          </t-card>
          <div class="divider">
            <i-right size="32"></i-right>
          </div>
          <div class="deriveAssets">
            <t-card v-for="(item, index) in asset.derive" :key="index" class="assetCard" @click="generateAssetsImage(item)">
              <div v-if="item.src" class="assetImageWrap">
                <t-image :src="item.src" fit="contain" class="assetImage" :preview="true" :lazy="true">
                  <template #overlayContent>
                    <div class="imageToolsWrap show">
                      <ImageTools :src="item.src" position="br" />
                    </div>
                  </template>
                </t-image>
              </div>
              <div v-else class="assetImageWrap assetImagePlaceholder">
                <t-loading v-if="item.state == '生成中'" size="small" />
                <t-empty v-else size="small" title="未生成" />
              </div>
              <div class="cardInfo">
                <div class="cardName">
                  <span class="nameText">{{ item.name }}</span>
                  <t-tag theme="warning">衍生</t-tag>
                </div>
                <div class="cardDesc">{{ item.desc }}</div>
              </div>
            </t-card>
            <t-card v-if="asset.derive.length <= 0" class="assetCard emptyCard">
              <t-empty title="无衍生资产"></t-empty>
            </t-card>
          </div>
        </div>
      </div>
    </div>
    <editImage
      v-model:visible="visible"
      v-if="visible"
      :editData="currentRow"
      :getFlowDataFn="getAssetsFlowData"
      :saveFlowFn="saveOrUpdateFlowData" />
  </t-card>
</template>

<script setup lang="ts">
import axios from "@/utils/axios";
import { Handle, Position, type Edge } from "@vue-flow/core";
import editImage from "../components/editImage/index.vue";
import type { NodeType } from "../utils/editImageType";
import { images } from "mammoth";
import { type AssetItem, type DeriveAsset } from "../utils/flowBuilder";

const props = defineProps<{
  id: string;
  handleIds: {
    target: string;
  };
}>();

const assets = defineModel<AssetItem[]>({ required: true });
const currentRow = ref<{
  id: null | number;
  images: string[];
}>({
  images: [],
  id: null,
});
const visible = ref(false);
function generateAssetsImage(row: DeriveAsset) {
  console.log("生成图片", row);
  currentRow.value = { id: row.id, images: [row.src] };
  visible.value = true;
}

function getAssetsFlowData() {
  console.log("%c Line:103 🍩", "background:#2eafb0", "获取资产工作流数据");
  return null;
}

async function saveOrUpdateFlowData(data: { nodes: NodeType[]; edges: Edge<any, any, string>[]; imageUrl: string }) {
  const { nodes, edges, imageUrl } = data;
  if (currentRow.value?.id) {
    await axios.post("/production/editStoryboard/updateStoryboardFlow", {
      id: currentRow.value?.id,
      nodes: nodes,
      edges: edges,
      imageUrl,
    });
    console.log("%c Line:109 🍩", "background:#2eafb0", "更新分镜工作流数据");
  } else {
    await axios.post("/production/editStoryboard/saveStoryboardFlow", {
      nodes: nodes,
      edges: edges,
      imageUrl,
    });
    console.log("%c Line:112 🍩", "background:#2eafb0", "保存分镜工作流数据");
  }
}
</script>

<style lang="scss" scoped>
.assets {
  width: fit-content;
  user-select: text;
  cursor: default;

  .titleBar {
    cursor: grab;
    user-select: none;

    .title {
      background-color: #000;
      width: fit-content;
      padding: 5px 10px;
      color: #fff;
      border-radius: 8px 0;
      font-size: 16px;
    }
  }

  .content {
    margin-top: 8px;

    .cardGrid {
      display: flex;
      flex-direction: column;

      .assetItemBox {
        display: flex;
        align-items: stretch;
        gap: 12px;
        padding: 10px;

        &:not(:first-child) {
          margin-top: 8px;
        }

        .assetCard {
          width: 200px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;

          .assetImageWrap {
            width: 100%;
            aspect-ratio: 1 / 1;

            &.assetImagePlaceholder {
              display: flex;
              align-items: center;
              justify-content: center;
              background-color: var(--td-bg-color-container-hover, #f5f5f5);
              border-radius: 4px;
              overflow: hidden;
            }

            .assetImage {
              height: 100%;
              border-radius: 4px;

              .imageToolsWrap {
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.2s ease;
              }

              &:hover .imageToolsWrap {
                opacity: 1;
                pointer-events: auto;
              }
            }
          }

          .cardInfo {
            margin-top: 0.5rem;

            .cardName {
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 13px;
              font-weight: 600;
              color: #333;

              .nameText {
                text-overflow: ellipsis;
                white-space: nowrap;
                overflow: hidden;
                max-width: 120px;
              }
            }

            .cardDesc {
              font-size: 11px;
              color: #999;
              display: -webkit-box;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
              overflow: hidden;
            }
          }
        }

        .divider {
          display: flex;
          align-items: center;
          flex-shrink: 0;
        }

        .deriveAssets {
          display: flex;
          align-items: stretch;
          gap: 12px;

          .emptyCard {
            display: flex;
            align-items: center;
            justify-content: center;

            :deep(.t-card__body) {
              width: 100%;
              height: 100%;
              display: flex;
              align-items: center;
              justify-content: center;
            }
          }
        }
      }
    }
  }
}
</style>
