import { createI18n } from "vue-i18n";
import { useLocalStorage } from "@vueuse/core";
import zhCN from "./language/zh-CN.json";
import en from "./language/en.json";

const languageList = [
  { label: "简体中文", tips: "Chinese (Simplified)", value: "zh-CN" },
  { label: "English", tips: "English", value: "en" },
];

const cachedLocale = useLocalStorage("locale", "zh-CN");

const i18n = createI18n({
  legacy: false,
  locale: cachedLocale.value,
  fallbackLocale: "en",
  messages: {
    "zh-CN": zhCN,
    en,
  },
});

export { languageList, cachedLocale };
export default i18n;
