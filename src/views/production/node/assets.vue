<template>
  <t-card class="assets">
    <Handle :id="props.data.handleIds.target" type="target" :position="Position.Top" />
    <div class="titleBar dragHandle">
      <div class="title">衍生资产</div>
    </div>
    <div class="content">
      <div class="cardGrid f fc">
        <div v-for="asset in props.data.assets" :key="asset.assetsId" class="assetItemBox">
          <t-card class="rawAssets c fc">
            <div v-if="asset.src" class="assetImageWrap">
              <t-image :src="asset.src" fit="cover" class="assetImage" :preview="true" :lazy="true">
                <template #overlayContent>
                  <div class="imageToolsWrap show">
                    <ImageTools :src="asset.src" position="br" />
                  </div>
                </template>
              </t-image>
            </div>
            <div class="cardInfo">
              <div class="cardName jb ac">
                {{ asset.name }}
                <t-tag theme="success">原资产</t-tag>
              </div>
              <div class="cardDesc">{{ asset.desc }}</div>
            </div>
          </t-card>
          <div class="divider c" v-if="asset.derive?.length">
            <i-right size="32"></i-right>
          </div>
          <div v-if="asset.derive?.length" class="deriveAssets f pr">
            <t-card v-for="d in asset.derive" :key="d.assetsId" class="assetImageWrap">
              <div v-if="d.src" class="deriveImageWrap">
                <t-image :src="d.src" fit="contain" class="assetImage" :preview="true" :lazy="true">
                  <template #overlayContent>
                    <div class="imageToolsWrap show">
                      <ImageTools :src="d.src" position="br" />
                    </div>
                  </template>
                </t-image>
              </div>
              <div class="cardInfo">
                <div class="cardName jb ac">
                  {{ d.name }}
                  <t-tag theme="warning">衍生</t-tag>
                </div>
                <div class="cardDesc">{{ d.desc }}</div>
              </div>
            </t-card>
          </div>
        </div>
      </div>
    </div>
  </t-card>
</template>

<script setup lang="ts">
import { Handle, Position } from "@vue-flow/core";

interface DeriveAsset {
  assetsId: string;
  name: string;
  desc: string;
  src: string;
  image?: string;
}

interface AssetItem {
  assetsId: string;
  name: string;
  desc: string;
  src: string;
  derive?: DeriveAsset[];
}

const props = defineProps<{
  id: string;
  data: {
    assets: AssetItem[];
    handleIds: {
      target: string;
    };
  };
}>();
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

    .sectionTitle {
      font-size: 14px;
      font-weight: 600;
      color: #333;
      margin: 16px 0 12px;
      &:first-child {
        margin-top: 8px;
      }
    }

    .cardGrid {
      display: flex;
      .assetItemBox {
        display: flex;
        gap: 12px;
        padding: 10px;
        .cardInfo {
          margin-top: 0.5rem;
          .cardName {
            font-size: 13px;
            font-weight: 600;
            color: #333;
          }

          .cardDesc {
            font-size: 11px;
            color: #999;
          }
        }
        .divider {
          width: 0px;
        }
        .deriveAssets {
          .tag {
            position: absolute;
            top: 8px;
            left: 8px;
            background-color: rgba(255, 255, 255, 0.8);
            font-size: 10px;
            padding: 2px 6px;
          }
        }
        .assetImage {
          height: 150px;
          border-radius: 4px;
          .imageToolsWrap {
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.2s ease;
          }
          &:hover {
            .imageToolsWrap {
              opacity: 1;
              pointer-events: auto;
            }
          }
        }
        &:not(:first-child) {
          margin-top: 8px;
        }
      }
    }
  }
}
</style>
