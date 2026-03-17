<template>
  <div class="propertyPanel">
    <div class="panelHeader">
      <h3 class="panelTitle">属性</h3>
    </div>

    <div class="panelContent">
      <div v-if="!selectedClip" class="emptyState">
        <div class="emptyIcon">📋</div>
        <div class="emptyText">请选择一个 Clip 来查看属性</div>
      </div>

      <div v-else class="properties">
        <!-- 基础信息 -->
        <div class="section">
          <div class="sectionHeader">
            <span class="sectionIcon">{{ getClipIcon(selectedClip) }}</span>
            <span class="sectionTitle">基础信息</span>
          </div>
          <div class="sectionContent">
            <div class="row">
              <label class="label">名称</label>
              <input v-model="clipName" type="text" class="propInput" @change="handleUpdateClip('name', clipName)" />
            </div>
            <div class="row">
              <label class="label">类型</label>
              <div class="propValue">{{ getClipTypeName(selectedClip.type) }}</div>
            </div>
            <div class="row">
              <label class="label">开始时间</label>
              <div class="inputGroup">
                <input
                  :value="selectedClip.startTime.toFixed(2)"
                  type="number"
                  step="0.01"
                  class="propInput small"
                  @change="handleUpdateClip('startTime', parseFloat(($event.target as HTMLInputElement).value))" />
                <span class="unit">秒</span>
              </div>
            </div>
            <div class="row">
              <label class="label">结束时间</label>
              <div class="inputGroup">
                <input
                  :value="selectedClip.endTime.toFixed(2)"
                  type="number"
                  step="0.01"
                  class="propInput small"
                  @change="handleUpdateClip('endTime', parseFloat(($event.target as HTMLInputElement).value))" />
                <span class="unit">秒</span>
              </div>
            </div>
            <div class="row">
              <label class="label">时长</label>
              <div class="propValue highlight">{{ (selectedClip.endTime - selectedClip.startTime).toFixed(2) }}s</div>
            </div>
          </div>
        </div>

        <!-- 视频属性 -->
        <div v-if="selectedClip.type === 'video'" class="section">
          <div class="sectionHeader">
            <span class="sectionIcon">🎥</span>
            <span class="sectionTitle">视频属性</span>
          </div>
          <div class="sectionContent">
            <div class="row">
              <label class="label">不透明度</label>
              <div class="sliderGroup">
                <input
                  v-model.number="videoOpacity"
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  class="slider"
                  @input="handleUpdateClip('opacity', Math.round(videoOpacity) / 100)" />
                <span class="sliderValue">{{ Math.round(videoOpacity) }}%</span>
              </div>
            </div>
            <div class="row">
              <label class="label">音量</label>
              <div class="sliderGroup">
                <input
                  v-model.number="videoVolume"
                  type="range"
                  min="0"
                  max="200"
                  step="1"
                  class="slider"
                  @input="handleUpdateClip('volume', Math.round(videoVolume) / 100)" />
                <span class="sliderValue">{{ Math.round(videoVolume) }}%</span>
              </div>
            </div>
            <div class="row">
              <label class="label">速度</label>
              <div class="inputGroup">
                <input
                  v-model.number="videoSpeed"
                  type="number"
                  min="0.1"
                  max="10"
                  step="0.1"
                  class="propInput small"
                  @change="handleUpdatePlaybackRate(videoSpeed)" />
                <span class="unit">x</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 音频属性 -->
        <div v-if="selectedClip.type === 'audio'" class="section">
          <div class="sectionHeader">
            <span class="sectionIcon">🎵</span>
            <span class="sectionTitle">音频属性</span>
          </div>
          <div class="sectionContent">
            <div class="row">
              <label class="label">音量</label>
              <div class="sliderGroup">
                <input
                  v-model.number="audioVolume"
                  type="range"
                  min="0"
                  max="200"
                  step="1"
                  class="slider"
                  @input="handleUpdateClip('volume', Math.round(audioVolume) / 100)" />
                <span class="sliderValue">{{ Math.round(audioVolume) }}%</span>
              </div>
            </div>
            <div class="row">
              <label class="label">淡入时长</label>
              <div class="inputGroup">
                <input
                  v-model.number="audioFadeIn"
                  type="number"
                  min="0"
                  step="0.1"
                  class="propInput small"
                  @change="handleUpdateClip('fadeIn', audioFadeIn)" />
                <span class="unit">秒</span>
              </div>
            </div>
            <div class="row">
              <label class="label">淡出时长</label>
              <div class="inputGroup">
                <input
                  v-model.number="audioFadeOut"
                  type="number"
                  min="0"
                  step="0.1"
                  class="propInput small"
                  @change="handleUpdateClip('fadeOut', audioFadeOut)" />
                <span class="unit">秒</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 转场属性 -->
        <div v-if="selectedClip.type === 'transition'" class="section">
          <div class="sectionHeader">
            <span class="sectionIcon">🔀</span>
            <span class="sectionTitle">转场属性</span>
          </div>
          <div class="sectionContent">
            <div class="row">
              <label class="label">转场类型</label>
              <select v-model="transitionType" class="propSelect" @change="handleUpdateClip('transitionType', transitionType)">
                <option value="fade">淡入淡出</option>
                <option value="slide">滑动</option>
                <option value="wipe">擦除</option>
                <option value="dissolve">溶解</option>
                <option value="zoom">缩放</option>
                <option value="rotate">旋转</option>
              </select>
            </div>
            <div class="row">
              <label class="label">转场时长</label>
              <div class="inputGroup">
                <input
                  v-model.number="transitionDuration"
                  type="number"
                  min="0.1"
                  max="5"
                  step="0.1"
                  class="propInput small"
                  @change="handleUpdateTransitionDuration" />
                <span class="unit">秒</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 字幕属性 -->
        <div v-if="selectedClip.type === 'subtitle'" class="section">
          <div class="sectionHeader">
            <span class="sectionIcon">📝</span>
            <span class="sectionTitle">字幕属性</span>
          </div>
          <div class="sectionContent">
            <div class="row">
              <label class="label">文本内容</label>
              <textarea v-model="subtitleText" class="propTextarea" rows="3" @change="handleUpdateClip('text', subtitleText)"></textarea>
            </div>
            <div class="row">
              <label class="label">字体大小</label>
              <div class="inputGroup">
                <input
                  v-model.number="subtitleFontSize"
                  type="number"
                  min="12"
                  max="72"
                  class="propInput small"
                  @change="handleUpdateClip('fontSize', subtitleFontSize)" />
                <span class="unit">px</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="actions">
          <button class="btn danger" @click="handleDeleteClip">🗑️ 删除 Clip</button>
          <button class="btn" @click="handleDuplicateClip">📋 复制 Clip</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useTracksStore, useHistoryStore, type Clip } from "vue-clip-track";
import { getClipIcon, getClipTypeName } from "./utils/clipMeta";

const tracksStore = useTracksStore();
const historyStore = useHistoryStore();

// 选中的 Clip
const selectedClip = computed(() => {
  const selected = tracksStore.selectedClips;
  return selected.length === 1 ? selected[0] : null;
});

// 基础属性
const clipName = ref("");

// 视频属性
const videoOpacity = ref(100);
const videoVolume = ref(100);
const videoSpeed = ref(1);

// 音频属性
const audioVolume = ref(100);
const audioFadeIn = ref(0);
const audioFadeOut = ref(0);

// 转场属性
const transitionType = ref("fade");
const transitionDuration = ref(1);

// 字幕属性
const subtitleText = ref("");
const subtitleFontSize = ref(24);

// 监听选中 Clip 变化，更新属性值
watch(
  selectedClip,
  (clip) => {
    if (!clip) return;

    clipName.value = clip.name || "";

    if (clip.type === "video") {
      // 使用 Math.round 取整，避免显示小数
      videoOpacity.value = Math.round(((clip as any).opacity ?? 1) * 100);
      videoVolume.value = Math.round(((clip as any).volume ?? 1) * 100);
      // 读取 playbackRate 属性，默认为 1
      videoSpeed.value = (clip as any).playbackRate ?? 1;
    }

    if (clip.type === "audio") {
      // 使用 Math.round 取整，避免显示小数
      audioVolume.value = Math.round(((clip as any).volume ?? 1) * 100);
      audioFadeIn.value = (clip as any).fadeIn ?? 0;
      audioFadeOut.value = (clip as any).fadeOut ?? 0;
    }

    if (clip.type === "transition") {
      transitionType.value = (clip as any).transitionType ?? "fade";
      transitionDuration.value = (clip as any).transitionDuration ?? 1;
    }

    if (clip.type === "subtitle") {
      subtitleText.value = (clip as any).text ?? "";
      subtitleFontSize.value = (clip as any).fontSize ?? 24;
    }
  },
  { immediate: true },
);

function handleUpdateClip(key: string, value: any) {
  if (!selectedClip.value) return;

  tracksStore.updateClip(selectedClip.value.id, { [key]: value });
  historyStore.pushSnapshot(`更新 Clip ${key}`);
}

// 处理播放倍速更新
function handleUpdatePlaybackRate(newRate: number) {
  if (!selectedClip.value) return;

  // 验证倍速范围
  if (newRate < 0.1 || newRate > 10) {
    console.warn("播放倍速必须在 0.1 到 10 之间");
    return;
  }

  // 使用 setClipPlaybackRate 方法更新倍速
  const result = tracksStore.setClipPlaybackRate(selectedClip.value.id, newRate, {
    allowShrink: true,
    allowExpand: true,
    handleCollision: true,
    keepStartTime: true,
  });

  if (result.success) {
    historyStore.pushSnapshot(`更新播放倍速为 ${newRate}x`);
  } else {
    console.warn("更新播放倍速失败:", result.message);
  }
}

function handleUpdateTransitionDuration() {
  if (!selectedClip.value || selectedClip.value.type !== "transition") return;

  const clip = selectedClip.value as any;
  const oldDuration = clip.transitionDuration || 1;
  const newDuration = transitionDuration.value;
  const center = (clip.startTime + clip.endTime) / 2;

  // 更新转场时长，保持中心点不变
  tracksStore.updateClip(clip.id, {
    startTime: center - newDuration / 2,
    endTime: center + newDuration / 2,
    transitionDuration: newDuration,
  });

  historyStore.pushSnapshot("更新转场时长");
}

function handleDeleteClip() {
  if (!selectedClip.value) return;

  if (confirm("确定要删除这个 Clip 吗？")) {
    tracksStore.removeClips([selectedClip.value.id]);
    historyStore.pushSnapshot("删除 Clip");
  }
}

function handleDuplicateClip() {
  if (!selectedClip.value) return;

  const clip = selectedClip.value;
  const track = tracksStore.tracks.find((t) => t.id === clip.trackId);
  if (!track) return;

  // 创建副本，放在原 Clip 后面
  const newClip = {
    ...clip,
    id: `clip-${Date.now()}`,
    startTime: clip.endTime,
    endTime: clip.endTime + (clip.endTime - clip.startTime),
    selected: false,
  };

  tracksStore.addClip(track.id, newClip);
  historyStore.pushSnapshot("复制 Clip");
}
</script>

<style scoped lang="scss">
.propertyPanel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg-medium);
  border-left: 1px solid var(--color-border);
  overflow: hidden;
  transition: background-color var(--transition-base);

  .panelHeader {
    flex-shrink: 0;
    padding: 16px 12px 12px;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-bg-elevated);

    .panelTitle {
      margin: 0;
      font-size: 13px;
      font-weight: 600;
      color: var(--color-text-primary);
      letter-spacing: -0.01em;
    }
  }

  .panelContent {
    flex: 1;
    overflow-y: auto;
    padding: 12px;

    &::-webkit-scrollbar {
      width: 6px;
    }
    &::-webkit-scrollbar-track {
      background: transparent;
    }
    &::-webkit-scrollbar-thumb {
      background: var(--color-border);
      border-radius: 3px;
      &:hover {
        background: var(--color-border-light);
      }
    }

    .emptyState {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      gap: 16px;

      .emptyIcon {
        font-size: 56px;
        opacity: 0.2;
        filter: grayscale(1);
      }

      .emptyText {
        font-size: 13px;
        color: var(--color-text-tertiary);
        text-align: center;
        line-height: 1.5;
      }
    }

    .properties {
      display: flex;
      flex-direction: column;
      gap: 12px;

      .section {
        background: var(--color-bg-light);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        overflow: hidden;
        transition: all var(--transition-fast);

        &:hover {
          box-shadow: var(--shadow-sm);
        }

        .sectionHeader {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          background: var(--color-bg-lighter);
          border-bottom: 1px solid var(--color-border);

          .sectionIcon {
            font-size: 16px;
            line-height: 1;
          }

          .sectionTitle {
            font-size: 12px;
            font-weight: 600;
            color: var(--color-text-primary);
            letter-spacing: -0.01em;
          }
        }

        .sectionContent {
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 14px;

          .row {
            display: flex;
            flex-direction: column;
            gap: 8px;

            .label {
              font-size: 12px;
              font-weight: 500;
              color: var(--color-text-secondary);
              line-height: 1;
            }

            .inputGroup {
              display: flex;
              align-items: center;
              gap: 8px;
            }

            .unit {
              font-size: 12px;
              color: var(--color-text-tertiary);
              white-space: nowrap;
              font-weight: 500;
            }

            .propValue {
              font-size: 13px;
              color: var(--color-text-secondary);
              padding: 8px 10px;
              background: var(--color-bg-dark);
              border-radius: var(--radius-md);
              border: 1px solid var(--color-border);

              &.highlight {
                color: var(--color-primary);
                font-weight: 600;
                border-color: var(--color-primary);
                background: hsla(var(--theme-hue), var(--theme-saturation), var(--theme-lightness), 0.08);
              }
            }

            .sliderGroup {
              display: flex;
              align-items: center;
              gap: 10px;

              .slider {
                flex: 1;
                height: 4px;
                -webkit-appearance: none;
                appearance: none;
                background: var(--color-border);
                border-radius: 2px;
                outline: none;
                cursor: pointer;

                &::-webkit-slider-thumb {
                  -webkit-appearance: none;
                  appearance: none;
                  width: 16px;
                  height: 16px;
                  background: var(--color-primary);
                  border: 2px solid white;
                  border-radius: 50%;
                  cursor: pointer;
                  transition: all var(--transition-fast);
                  box-shadow: var(--shadow-md);

                  &:hover {
                    transform: scale(1.15);
                    box-shadow: var(--shadow-lg);
                  }
                }

                &::-moz-range-thumb {
                  width: 16px;
                  height: 16px;
                  background: var(--color-primary);
                  border: 2px solid white;
                  border-radius: 50%;
                  cursor: pointer;
                  transition: all var(--transition-fast);
                  box-shadow: var(--shadow-md);

                  &:hover {
                    transform: scale(1.15);
                    box-shadow: var(--shadow-lg);
                  }
                }
              }

              .sliderValue {
                font-size: 12px;
                font-weight: 600;
                color: var(--color-text-primary);
                min-width: 45px;
                text-align: right;
                font-family: "Courier New", monospace;
              }
            }
          }

          .propInput,
          .propSelect,
          .propTextarea {
            width: 100%;
            padding: 8px 10px;
            background: var(--color-bg-dark);
            border: 1px solid var(--color-border);
            border-radius: var(--radius-md);
            color: var(--color-text-primary);
            font-size: 13px;
            font-family: inherit;
            transition: all var(--transition-fast);

            &:hover {
              border-color: var(--color-border-light);
            }

            &:focus {
              outline: none;
              border-color: var(--color-primary);
              background: var(--color-bg-medium);
              box-shadow: 0 0 0 2px hsla(var(--theme-hue), var(--theme-saturation), var(--theme-lightness), 0.1);
            }

            &.small {
              width: auto;
              flex: 1;
            }
          }
        }
      }

      .actions {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 4px;

        .btn {
          padding: 10px 14px;
          background: var(--color-bg-light);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          color: var(--color-text-primary);
          font-size: 13px;
          font-weight: 400;
          cursor: pointer;
          transition: all var(--transition-fast);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;

          &:hover {
            background: var(--color-bg-lighter);
            border-color: var(--color-primary);
            color: var(--color-primary);
            box-shadow: var(--shadow-sm);
          }

          &:active {
            transform: scale(0.98);
          }

          &.danger {
            color: var(--color-danger);
            border-color: transparent;

            &:hover {
              background: rgba(255, 77, 79, 0.1);
              border-color: var(--color-danger);
              color: var(--color-danger);
            }
          }
        }
      }
    }
  }
}
</style>
