<template>
  <t-select
    :size="props.size"
    v-model="selectValue"
    :placeholder="props.placeholder ?? $t('components.modelSelect.placeholder')"
    @change="onChange"
    @popup-visible-change="onPopupVisibleChange">
    <t-option-group v-for="(list, index) in optionsData" :key="index" :label="list.group">
      <t-option v-for="item in list.children" :key="item.id" :value="`${item.id}:${item.value}`" :label="item.label">
        <div class="optionItem">
          <div class="optionMain">
            <t-avatar
              v-if="getProviderLogoByModel(item.label, item.value)"
              size="24px"
              shape="round"
              :image="getProviderLogoByModel(item.label, item.value)!" />
            <t-avatar v-else size="24px" shape="round" class="fallbackAvatar">{{ getFallbackText(item.label) }}</t-avatar>
            <div class="optionLabel">{{ item.label }}</div>
          </div>
          <span class="optionType">{{ item.type }}</span>
        </div>
      </t-option>
    </t-option-group>
    <!-- 无可用模型时，显示跳转设置的按钮 -->
    <template #empty>
      <div class="emptyActionWrap">
        <t-button class="emptyActionButton" size="small" variant="text" theme="primary" @click.stop="goVendorConfig">
          {{ $t("components.modelSelect.goSetting") }}
        </t-button>
      </div>
    </template>
  </t-select>
</template>

<script setup lang="ts">
import { providersLogo, modelProviderRules } from "@/utils/providersLogo";
import settingStore from "@/stores/setting";
import axios from "@/utils/axios";
import { getVideoCapabilityCatalog } from "@/utils/videoCapabilityCatalog";
import { findCatalogModel, type VideoModelContract } from "@/videoContract";

interface VendorChild {
  id: string | number;
  label: string;
  value: string;
  vendorId: string | number;
  type: string;
}

interface VendorOption {
  group: string;
  id: string | number;
  children: VendorChild[];
}
const selectValue = defineModel({
  type: String,
  default: "",
});

const selectValueLabel = defineModel("label");

const props = defineProps({
  type: {
    type: String as () => "text" | "image" | "all" | "video",
    default: "all",
  },
  size: {
    type: String as () => "small" | "medium" | "large",
    default: "medium",
  },
  placeholder: {
    type: String,
  },
  changeConfig: {
    type: Boolean,
    default: false,
  },
});
const emit = defineEmits<{
  change: [value: string, data?: any];
}>();

async function onChange(value: unknown, { option }: any) {
  const selected = String(value);
  selectValue.value = selected;
  selectValueLabel.value = option.label;
  if (props.changeConfig) {
    if (props.type === "video") {
      const model = findCatalogModel(await getVideoCapabilityCatalog(), selected).model;
      emit("change", selected, model satisfies VideoModelContract);
      return;
    }
    const { data } = await axios.post("/modelSelect/getModelDetail", {
      modelId: selected,
    });
    emit("change", selected, data);
  } else {
    emit("change", selected);
  }
}
const optionsData = ref<VendorOption[]>([]);
onMounted(() => {
  void handleModelChange();
});

function onPopupVisibleChange(visible: boolean) {
  if (visible) {
    void handleModelChange(props.type === "video");
  }
}
const titleMap = {
  image: $t("components.modelSelect.type.image"),
  text: $t("components.modelSelect.type.text"),
  video: $t("components.modelSelect.type.video"),
};
//获取模型选择API数据
async function handleModelChange(refreshVideoCatalog = false) {
  try {
    if (props.type === "video") {
      const catalog = await getVideoCapabilityCatalog(refreshVideoCatalog);
      optionsData.value = catalog.map((vendor) => ({
        group: vendor.name,
        id: vendor.id,
        children: vendor.models.map((model) => ({
          id: vendor.id,
          label: model.name,
          value: model.modelId,
          vendorId: vendor.id,
          type: titleMap.video,
        })),
      }));
    } else {
      const response = await axios.post("/modelSelect/getModelList", { type: props.type });
      const groupMap = new Map<string, VendorOption>();
      response.data.forEach((item: any) => {
        const groupKey = String(item.id);
        if (!groupMap.has(groupKey)) {
          groupMap.set(groupKey, {
            group: item.name,
            id: item.id,
            children: [],
          });
        }
        groupMap.get(groupKey)!.children.push({
          id: item.id,
          label: item.label,
          value: item.value,
          vendorId: item.vendorId,
          type: titleMap[item.type as "image" | "text" | "video"],
        });
      });
      optionsData.value = Array.from(groupMap.values());
    }

    const selectionExists = optionsData.value
      .flatMap((option) => option.children)
      .some((option) => `${option.id}:${option.value}` === selectValue.value);
    if (!selectionExists) selectValue.value = "";
  } catch (error) {
    console.error($t("components.modelSelect.msg.fetchModelFailed"), error);
  }
}

function getProviderLogoByModel(label?: string, value?: string) {
  const source = `${label || ""} ${value || ""}`.trim();
  if (!source) return null;
  const matchedRule = modelProviderRules.find((rule) => rule.pattern.test(source));
  return matchedRule ? providersLogo[matchedRule.provider] : null;
}

function getFallbackText(label: string) {
  return label?.slice(0, 1)?.toUpperCase() || "M";
}

function goVendorConfig() {
  const store = settingStore();
  store.activeMenu = "vendorConfig";
  store.showSetting = true;
}
</script>

<style lang="scss" scoped>
.optionItem {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.optionMain {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.optionLabel {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.optionType {
  color: var(--td-text-color-secondary);
  flex-shrink: 0;
}

.fallbackAvatar {
  background: var(--td-brand-color-light);
  color: var(--td-brand-color);
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}
.emptyActionWrap {
  display: flex;
  justify-content: center;
  padding: 8px 12px;
  .emptyActionButton {
    min-width: 140px;
    color: #339af0;
  }
}
</style>
