import { createApp } from "vue";
import { createPinia } from "pinia";
import piniaPluginPersistedstate from "pinia-plugin-persistedstate";
import App from "./App.vue";
import router from "./router";
import { install } from "@icon-park/vue-next/es/all";
import "@icon-park/vue-next/styles/index.css";

import "tdesign-vue-next/es/style/index.css";

import "./assets/main.scss";

import "@/utils/global";

import { createRoot } from "react-dom/client";
import { setVeauryOptions } from "veaury";
setVeauryOptions({ react: { createRoot } });

const app = createApp(App);
install(app, "i");
app.use(createPinia().use(piniaPluginPersistedstate));
app.use(router);
app.mount("#app");
