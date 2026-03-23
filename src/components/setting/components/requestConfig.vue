<template>
  <div class="requestConfig">
    <t-alert style="margin-bottom: 1rem" theme="warning" message="如非特殊情况，不需要修改或者配置"></t-alert>
    <t-form :data="formData" labelAlign="top" :rules="formRules">
      <t-form-item label="API 地址" name="baseUrl">
        <t-input v-model="formData.baseUrl" placeholder="请输入 API 请求地址" clearable>
          <template #prefix-icon>
            <t-icon name="link" />
          </template>
        </t-input>
      </t-form-item>
      <t-form-item>
        <t-space size="small">
          <t-button theme="primary" type="submit" @click="handleSubmit">保存</t-button>
          <t-button theme="default" @click="handleReset">重置</t-button>
        </t-space>
      </t-form-item>
    </t-form>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { MessagePlugin, type FormRules } from "tdesign-vue-next";
import useSettingStore from "@/stores/setting";

interface RequestForm {
  baseUrl: string;
}

const settingStore = useSettingStore();

const formData = ref<RequestForm>({
  baseUrl: "",
});

const formRules: FormRules<RequestForm> = {
  baseUrl: [
    { required: true, message: "请输入 API 地址", trigger: "blur" },
    {
      pattern: /^https?:\/\/.+/,
      message: "请输入有效的 HTTP/HTTPS 地址",
      trigger: "blur",
    },
  ],
};

function loadSettings() {
  formData.value.baseUrl = settingStore.baseUrl;
}

function handleSubmit() {
  settingStore.baseUrl = formData.value.baseUrl;
  MessagePlugin.success("请求地址保存成功");
}

function handleReset() {
  formData.value.baseUrl = "http://localhost:60000";
  settingStore.baseUrl = formData.value.baseUrl;
  MessagePlugin.success("已重置为默认地址");
}

onMounted(() => {
  loadSettings();
});
</script>

<style lang="scss" scoped></style>
