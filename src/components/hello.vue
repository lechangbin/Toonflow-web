<template>
  <t-dialog v-model:visible="show" :footer="false" :header="false" width="680px" :close-on-overlay-click="false" placement="center">
    <div class="helloGuide">
      <!-- 欢迎首页 -->
      <template v-if="currentStep === 0">
        <div class="welcomePage">
          <img src="@/assets/logo.png" alt="ToonFlow Logo" class="welcomeLogo" />
          <h1 class="welcomeTitle">欢迎使用 ToonFlow</h1>
          <p class="welcomeDesc">AI 驱动的漫画创作工作流平台，让我们花一分钟完成初始配置。</p>
          <t-button theme="primary" size="large" @click="currentStep = 1">开始配置</t-button>
          <t-button variant="text" size="small" style="margin-top: 12px" @click="handleSkip">跳过引导</t-button>
          <div class="langBtn">
            <t-dropdown :options="langOptions" trigger="click" @click="handleChangeLang" :maxColumnWidth="150">
              <t-button shape="circle" theme="default" size="large">
                <template #icon>
                  <i-translate theme="outline" size="20" />
                </template>
              </t-button>
            </t-dropdown>
          </div>
        </div>
      </template>

      <!-- 配置步骤 -->
      <template v-else>
        <t-steps :current="currentStep - 1" class="guideSteps">
          <t-step-item title="添加模型服务" />
          <t-step-item title="配置 Agent" />
          <t-step-item title="开始使用" />
        </t-steps>

        <div class="stepContent">
          <!-- Step 1: 配置模型服务 -->
          <div v-if="currentStep === 1" class="stepItem">
            <div class="stepIcon">
              <t-icon name="server" size="48px" />
            </div>
            <h2 class="stepTitle">添加模型服务供应商</h2>
            <p class="stepDesc">首先，你需要在设置中添加至少一个 AI 模型服务供应商（如 OpenAI、Claude 等），并填写对应的 API Key。</p>
            <div class="stepTip">
              <t-alert theme="info" message="点击下方按钮将打开设置页面的「模型服务」选项卡，添加供应商后回到此处继续。" />
            </div>
            <t-button theme="primary" size="large" @click="openVendorConfig">
              <template #icon><t-icon name="setting" /></template>
              前往配置模型服务
            </t-button>
          </div>

          <!-- Step 2: 配置 Agent -->
          <div v-if="currentStep === 2" class="stepItem">
            <div class="stepIcon">
              <t-icon name="relativity" size="48px" />
            </div>
            <h2 class="stepTitle">分配 Agent 模型</h2>
            <p class="stepDesc">接下来，在 Agent 配置中为各个功能模块分配模型，这样系统才知道调用哪个模型来完成任务。</p>
            <div class="stepTip">
              <t-alert theme="info" message="点击下方按钮将打开设置页面的「Agent 配置」选项卡，为各功能分配模型后回到此处。" />
            </div>
            <t-button theme="primary" size="large" @click="openAgentConfig">
              <template #icon><t-icon name="setting" /></template>
              前往配置 Agent
            </t-button>
          </div>

          <!-- Step 3: 完成 -->
          <div v-if="currentStep === 3" class="stepItem">
            <div class="stepIcon">
              <t-icon name="check-circle" size="48px" color="var(--td-success-color)" />
            </div>
            <h2 class="stepTitle">🎉 一切就绪！</h2>
            <p class="stepDesc">配置完成，现在你可以开始使用所有功能了。如需调整，随时可以在设置中修改。</p>
            <div class="qrcodeBox">
              <p class="qrcodeLabel">加入微信交流群，获取更多帮助：</p>
              <t-qrcode value="https://work.weixin.qq.com/u/vc36adcc89845edcbe?v=5.0.3.63936&bb=85b8d228e8" level="Q" type="svg" />
            </div>
            <div class="githubBox">
              <p class="qrcodeLabel">如果觉得好用，请给我们一个 ⭐ Star 吧！</p>
              <t-button theme="danger" size="large" @click="jumpGithub">
                <template #icon><t-icon name="logo-github" /></template>
                Star on GitHub
              </t-button>
            </div>
          </div>
        </div>

        <!-- 底部按钮 -->
        <div class="guideFooter">
          <t-button v-if="currentStep > 1" variant="outline" @click="currentStep--">上一步</t-button>
          <div class="footerRight">
            <t-button v-if="currentStep < 3" variant="text" @click="handleSkip">跳过引导</t-button>
            <t-button v-if="currentStep < 3" theme="primary" @click="currentStep++">下一步</t-button>
            <t-button v-if="currentStep === 3" theme="primary" @click="handleFinish">开始使用</t-button>
          </div>
        </div>
      </template>
    </div>
  </t-dialog>
</template>

<script setup lang="ts">
import { useLocalStorage } from "@vueuse/core";
import { useI18n } from "vue-i18n";
import JSConfetti from "js-confetti";
import settingStore from "@/stores/setting";
import { languageList, cachedLocale } from "@/locales";
const { showSetting, activeMenu, isElectron } = storeToRefs(settingStore());

const { locale } = useI18n();
const langOptions = languageList.map((item) => ({
  content: item.label,
  value: item.value,
}));
const handleChangeLang = (data: any) => {
  locale.value = data.value;
  cachedLocale.value = data.value;
};

const guideDone = useLocalStorage("helloGuideDone", false);
const show = ref(!guideDone.value);
const currentStep = ref(0);

function openVendorConfig() {
  activeMenu.value = "vendorConfig";
  showSetting.value = true;
}

function openAgentConfig() {
  activeMenu.value = "agentConfog";
  showSetting.value = true;
}

function handleSkip() {
  guideDone.value = true;
  show.value = false;
}

function handleFinish() {
  guideDone.value = true;
  show.value = false;
  const jsConfetti = new JSConfetti();
  jsConfetti.addConfetti();
}

async function jumpGithub() {
  if (isElectron.value) {
    await fetch("toonflow://getPort?url=https://github.com/HBAI-Ltd/Toonflow-app");
  } else {
    window.open("https://github.com/HBAI-Ltd/Toonflow-app");
  }
}
</script>

<style lang="scss" scoped>
.helloGuide {
  padding: 24px 16px;

  .welcomePage {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 40px 0 24px;
    position: relative;

    .langBtn {
      position: absolute;
      bottom: 0;
      right: 0;
    }

    .welcomeLogo {
      width: 120px;
      height: 120px;
      object-fit: contain;
      margin-bottom: 24px;
    }

    .welcomeTitle {
      font-size: 28px;
      font-weight: 700;
      margin: 0 0 12px;
    }

    .welcomeDesc {
      color: var(--td-text-color-secondary);
      font-size: 15px;
      margin: 0 0 32px;
    }
  }

  .guideSteps {
    margin-bottom: 32px;
  }

  .stepContent {
    min-height: 300px;
    display: flex;
    align-items: center;
    justify-content: center;

    .stepItem {
      text-align: center;
      max-width: 480px;

      .stepIcon {
        margin-bottom: 16px;
        color: var(--td-brand-color);
      }

      .stepTitle {
        font-size: 22px;
        font-weight: 600;
        margin: 0 0 12px;
      }

      .stepDesc {
        color: var(--td-text-color-secondary);
        font-size: 14px;
        line-height: 1.8;
        margin: 0 0 20px;
      }

      .stepTip {
        margin-bottom: 20px;
      }

      .qrcodeBox {
        margin-top: 16px;
        display: flex;
        flex-direction: column;
        align-items: center;

        .qrcodeLabel {
          color: var(--td-text-color-secondary);
          font-size: 13px;
          margin-bottom: 8px;
        }
      }

      .githubBox {
        margin-top: 20px;
        display: flex;
        flex-direction: column;
        align-items: center;
      }
    }
  }

  .guideFooter {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 24px;
    border-top: 1px solid var(--td-component-stroke);
    padding-top: 16px;

    .footerRight {
      display: flex;
      gap: 8px;
      margin-left: auto;
    }
  }
}
</style>
