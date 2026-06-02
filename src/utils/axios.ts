import axios from "axios";
import router from "@/router/index";
import { storeToRefs } from "pinia";
import { MessagePlugin, NotifyPlugin, type TNode } from "tdesign-vue-next";
import settingStore from "@/stores/setting";
import { h } from "vue";
const instance = axios.create();

instance.interceptors.request.use(function (config) {
  const { baseUrl, otherSetting } = storeToRefs(settingStore());
  config.baseURL = baseUrl.value;
  config.timeout = otherSetting.value.axiosTimeOut;
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = token;
  }

  return config;
});

instance.interceptors.response.use(
  function (response) {
    return response.data;
  },
  function (error) {
    if (error.status === 401) {
      localStorage.removeItem("token");
      router.push("/login");
      MessagePlugin.error(window.$t("common.sessionExpired"));
    }
    //  TODO network error
    if (error.message.includes("Network Error") || error.response.data?.message === "Network Error") {
      NotifyPlugin.error({
        title: "Network Error",
        closeBtn: true,
        content: h("div", [
          h("div", [
            "请尝试安装 Visual C++ 运行库：",
            h("br"),
            h("a", { href: "https://aka.ms/vs/17/release/vc_redist.x86.exe", target: "_blank", rel: "noopener noreferrer" }, "32位系统下载"),
            h("br"),
            h("a", { href: "https://aka.ms/vs/17/release/vc_redist.x64.exe", target: "_blank", rel: "noopener noreferrer" }, "64位系统下载"),
          ]),
        ]) as unknown as TNode,
      });
    }

    return Promise.reject(error?.response?.data ?? error);
  },
);

export default instance;
