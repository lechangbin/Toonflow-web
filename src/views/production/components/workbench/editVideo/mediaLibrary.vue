<template>
  <div class="media-library">
    <div class="media-library__header">
      <h3 class="media-library__title">资源库</h3>
      <div class="media-library__tabs">
        <button v-for="tab in tabs" :key="tab.id" :class="['tab', { 'tab--active': activeTab === tab.id }]"
          @click="activeTab = tab.id">
          <span class="tab__icon">{{ tab.icon }}</span>
          <span class="tab__label">{{ tab.label }}</span>
        </button>
      </div>
    </div>

    <div class="media-library__content">
      <!-- 媒体素材 -->
      <div v-if="activeTab === 'media'" class="media-grid">
        <div v-for="item in mediaItems" :key="item.id" class="media-item" draggable="true"
          @dragstart="handleDragStart($event, item)" @dragend="handleDragEnd">
          <div class="media-item__preview" :style="{ background: item.color }">
            <img v-if="item.thumbnail" :src="item.thumbnail" class="media-item__thumbnail" alt="" />
            <span v-else class="media-item__icon">{{ item.icon }}</span>
            <div v-if="item.loading" class="media-item__loading">
              <span class="loading-spinner"></span>
            </div>
          </div>
          <div class="media-item__info">
            <div class="media-item__name">{{ item.name }}</div>
            <div class="media-item__duration">{{ formatDuration(item.duration) }}</div>
          </div>
        </div>
      </div>

      <!-- 转场效果 -->
      <div v-if="activeTab === 'transition'" class="transition-list">
        <div v-for="transition in transitionItems" :key="transition.id" class="transition-item" draggable="true"
          @dragstart="handleDragStart($event, transition)" @dragend="handleDragEnd">
          <div class="transition-item__preview">
            <span class="transition-item__icon">{{ transition.icon }}</span>
          </div>
          <div class="transition-item__name">{{ transition.name }}</div>
        </div>
      </div>

      <!-- 特效 -->
      <div v-if="activeTab === 'effect'" class="effect-list">
        <div v-for="effect in effectItems" :key="effect.id" class="effect-item" draggable="true"
          @dragstart="handleDragStart($event, effect)" @dragend="handleDragEnd">
          <div class="effect-item__preview" :style="{ background: effect.gradient }">
            <span class="effect-item__icon">{{ effect.icon }}</span>
          </div>
          <div class="effect-item__name">{{ effect.name }}</div>
        </div>
      </div>

      <!-- 滤镜 -->
      <div v-if="activeTab === 'filter'" class="filter-list">
        <div v-for="filter in filterItems" :key="filter.id" class="filter-item" draggable="true"
          @dragstart="handleDragStart($event, filter)" @dragend="handleDragEnd">
          <div class="filter-item__preview" :style="{ background: filter.gradient }">
            <span class="filter-item__icon">{{ filter.icon }}</span>
          </div>
          <div class="filter-item__name">{{ filter.name }}</div>
        </div>
      </div>

      <!-- 音频 -->
      <div v-if="activeTab === 'audio'" class="audio-list">
        <div v-for="audio in audioItems" :key="audio.id" class="audio-item" draggable="true"
          @dragstart="handleDragStart($event, audio)" @dragend="handleDragEnd">
          <div class="audio-item__icon-wrapper">
            <span class="audio-item__icon">🎵</span>
            <canvas v-if="audio.waveformData" ref="waveformCanvasRefs" class="audio-item__waveform-mini"
              :data-audio-id="audio.id" width="60" height="24"></canvas>
          </div>
          <div class="audio-item__info">
            <div class="audio-item__name">{{ audio.name }}</div>
            <div class="audio-item__duration">{{ formatDuration(audio.duration) }}</div>
          </div>
          <div v-if="audio.loading" class="audio-item__loading">
            <span class="loading-spinner loading-spinner--small"></span>
          </div>
        </div>
      </div>

      <!-- 字幕/文本 -->
      <div v-if="activeTab === 'text'" class="text-list">
        <div v-for="text in textItems" :key="text.id" class="text-item" draggable="true"
          @dragstart="handleDragStart($event, text)" @dragend="handleDragEnd">
          <div class="text-item__preview">
            <span class="text-item__content">{{ text.preview }}</span>
          </div>
          <div class="text-item__name">{{ text.name }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { extractVideoThumbnails, extractAudioWaveform } from 'vue-clip-track'
import {
  type MediaItem,
  type AudioItem,
  textItems as staticTextItems,
  transitionItems as staticTransitionItems,
  effectItems as staticEffectItems,
  filterItems as staticFilterItems,
  libraryTabs,
  formatDuration,
  drawMiniWaveform,
} from './utils/mediaData'

const props = withDefaults(defineProps<{
  initialMediaItems?: MediaItem[]
  initialAudioItems?: AudioItem[]
}>(), {
  initialMediaItems: () => [],
  initialAudioItems: () => [],
})

const activeTab = ref('media')

const tabs = libraryTabs

const mediaItems = ref<MediaItem[]>([...props.initialMediaItems])
const audioItems = ref<AudioItem[]>([...props.initialAudioItems])
const textItems = ref(staticTextItems)
const transitionItems = ref(staticTransitionItems)
const effectItems = ref(staticEffectItems)
const filterItems = ref(staticFilterItems)

// 加载视频缩略图和时长
async function loadVideoThumbnails() {
  for (const item of mediaItems.value) {
    try {
      const result = await extractVideoThumbnails(item.url, { count: 10, width: 120 })
      item.duration = result.duration
      item.thumbnails = result.thumbnails
      item.thumbnail = result.thumbnails[0] || ''
      item.loading = false
    } catch (error) {
      console.error(`Failed to load thumbnails for ${item.name}:`, error)
      item.loading = false
      item.duration = 5 // 默认时长
    }
  }
}

// 加载音频波形数据
async function loadAudioWaveforms() {
  for (const item of audioItems.value) {
    try {
      const result = await extractAudioWaveform(item.url, { samples: 50 })
      item.duration = result.duration
      item.waveformData = result.waveformData
      item.loading = false
      // 绘制迷你波形
      await nextTick()
      drawMiniWaveform(item.id, result.waveformData)
    } catch (error) {
      console.error(`Failed to load waveform for ${item.name}:`, error)
      item.loading = false
      item.duration = 30 // 默认时长
    }
  }
}

// 监听音频 tab 切换，重新绘制波形
watch(activeTab, async (newTab) => {
  if (newTab === 'audio') {
    await nextTick()
    for (const item of audioItems.value) {
      if (item.waveformData) {
        drawMiniWaveform(item.id, item.waveformData)
      }
    }
  }
})

function handleDragStart(event: DragEvent, item: any) {
  if (!event.dataTransfer) return

  // 设置拖拽数据，包含完整的媒体信息
  const dragData = {
    ...item,
    sourceUrl: item.url || item.id
  }
  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData('application/json', JSON.stringify(dragData))
  event.dataTransfer.setData('text/plain', item.name)

  // 添加拖拽样式
  if (event.target instanceof HTMLElement) {
    event.target.classList.add('dragging')
  }
}

function handleDragEnd(event: DragEvent) {
  if (event.target instanceof HTMLElement) {
    event.target.classList.remove('dragging')
  }
}

// 组件挂载时加载媒体数据
onMounted(() => {
  // 延迟加载，避免阻塞 UI
  setTimeout(() => {
    loadVideoThumbnails()
    loadAudioWaveforms()
  }, 100)
})
</script>

<style scoped>
.media-library {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg-medium);
  border-right: 1px solid var(--color-border);
  overflow: hidden;
  transition: background-color var(--transition-base);
}

.media-library__header {
  flex-shrink: 0;
  padding: 16px 12px 12px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-elevated);
}

.media-library__title {
  margin: 0 0 12px 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
  letter-spacing: -0.01em;
}

.media-library__tabs {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.tab {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 400;
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.tab:hover {
  background: var(--color-bg-light);
  color: var(--color-text-primary);
}

.tab--active {
  background: var(--color-primary);
  color: white;
  font-weight: 500;
}

.tab__icon {
  font-size: 14px;
  line-height: 1;
}

.tab__label {
  font-size: 12px;
  line-height: 1;
}

.media-library__content {
  flex: 1;
  overflow-y: auto;
  padding: 12px 8px;
}

/* 媒体网格 */
.media-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 10px;
}

.media-item {
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-lg);
  background: var(--color-bg-light);
  border: 1px solid transparent;
  overflow: hidden;
  cursor: grab;
  transition: all var(--transition-fast);
}

.media-item:hover {
  border-color: var(--color-primary);
  transform: translateY(-3px);
  box-shadow: var(--shadow-lg), var(--shadow-glow);
}

.media-item.dragging {
  opacity: 0.6;
  cursor: grabbing;
  transform: scale(0.95);
}

.media-item__preview {
  aspect-ratio: 16/9;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  position: relative;
}

.media-item__preview::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.2);
  opacity: 0;
  transition: opacity var(--transition-fast);
  pointer-events: none;
}

.media-item:hover .media-item__preview::after {
  opacity: 1;
}

.media-item__thumbnail {
  width: 100%;
  height: 100%;
  object-fit: cover;
  position: absolute;
  inset: 0;
}

.media-item__loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.loading-spinner--small {
  width: 16px;
  height: 16px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.media-item__info {
  padding: 8px;
  background: var(--color-bg-elevated);
}

.media-item__name {
  font-size: 12px;
  font-weight: 400;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
}

.media-item__duration {
  font-size: 11px;
  color: var(--color-text-tertiary);
  margin-top: 4px;
  line-height: 1;
}

/* 转场列表 */
.transition-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.transition-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: var(--color-bg-light);
  border: 1px solid transparent;
  border-radius: var(--radius-lg);
  cursor: grab;
  transition: all var(--transition-fast);
}

.transition-item:hover {
  border-color: var(--color-primary);
  background: var(--color-bg-lighter);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.transition-item.dragging {
  opacity: 0.6;
  cursor: grabbing;
  transform: scale(0.95);
}

.transition-item__preview {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: hsla(var(--theme-hue), var(--theme-saturation), var(--theme-lightness), 0.15);
  border-radius: var(--radius-md);
  font-size: 18px;
  flex-shrink: 0;
}

.transition-item__name {
  font-size: 12px;
  font-weight: 400;
  color: var(--color-text-primary);
  line-height: 1.4;
}

/* 特效列表 */
.effect-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.effect-item {
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-lg);
  background: var(--color-bg-light);
  border: 1px solid transparent;
  overflow: hidden;
  cursor: grab;
  transition: all var(--transition-fast);
}

.effect-item:hover {
  border-color: var(--color-primary);
  transform: translateY(-3px);
  box-shadow: var(--shadow-lg);
}

.effect-item.dragging {
  opacity: 0.6;
  cursor: grabbing;
  transform: scale(0.95);
}

.effect-item__preview {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  position: relative;
}

.effect-item__preview::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.15);
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.effect-item:hover .effect-item__preview::after {
  opacity: 1;
}

.effect-item__name {
  padding: 8px;
  font-size: 12px;
  font-weight: 400;
  color: var(--color-text-primary);
  text-align: center;
  background: var(--color-bg-elevated);
  line-height: 1.4;
}

/* 滤镜列表 */
.filter-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.filter-item {
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-lg);
  background: var(--color-bg-light);
  border: 1px solid transparent;
  overflow: hidden;
  cursor: grab;
  transition: all var(--transition-fast);
}

.filter-item:hover {
  border-color: var(--color-primary);
  transform: translateY(-3px);
  box-shadow: var(--shadow-lg);
}

.filter-item.dragging {
  opacity: 0.6;
  cursor: grabbing;
  transform: scale(0.95);
}

.filter-item__preview {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  position: relative;
}

.filter-item__preview::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.15);
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.filter-item:hover .filter-item__preview::after {
  opacity: 1;
}

.filter-item__name {
  padding: 8px;
  font-size: 12px;
  font-weight: 400;
  color: var(--color-text-primary);
  text-align: center;
  background: var(--color-bg-elevated);
  line-height: 1.4;
}

/* 音频列表 */
.audio-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.audio-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--color-bg-light);
  border: 1px solid transparent;
  border-radius: var(--radius-lg);
  cursor: grab;
  transition: all var(--transition-fast);
}

.audio-item:hover {
  border-color: var(--color-primary);
  background: var(--color-bg-lighter);
  box-shadow: var(--shadow-md);
}

.audio-item.dragging {
  opacity: 0.6;
  cursor: grabbing;
  transform: scale(0.98);
}

.audio-item__icon-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.audio-item__icon {
  font-size: 20px;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: hsla(var(--theme-hue), var(--theme-saturation), var(--theme-lightness), 0.15);
  border-radius: var(--radius-md);
  flex-shrink: 0;
}

.audio-item__waveform-mini {
  width: 60px;
  height: 24px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.2);
}

.audio-item__loading {
  margin-left: auto;
}

.audio-item__info {
  flex: 1;
  min-width: 0;
}

.audio-item__name {
  font-size: 12px;
  font-weight: 400;
  color: var(--color-text-primary);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.audio-item__duration {
  font-size: 11px;
  color: var(--color-text-tertiary);
  margin-top: 4px;
  line-height: 1;
}

/* 文本列表 */
.text-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.text-item {
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-lg);
  background: var(--color-bg-light);
  border: 1px solid transparent;
  overflow: hidden;
  cursor: grab;
  transition: all var(--transition-fast);
}

.text-item:hover {
  border-color: var(--color-primary);
  transform: translateY(-3px);
  box-shadow: var(--shadow-lg);
}

.text-item.dragging {
  opacity: 0.6;
  cursor: grabbing;
  transform: scale(0.95);
}

.text-item__preview {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary);
  position: relative;
}

.text-item__preview::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.15);
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.text-item:hover .text-item__preview::after {
  opacity: 1;
}

.text-item__content {
  font-size: 26px;
  font-weight: 700;
  color: white;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.text-item__name {
  padding: 8px;
  font-size: 12px;
  font-weight: 400;
  color: var(--color-text-primary);
  text-align: center;
  background: var(--color-bg-elevated);
  line-height: 1.4;
}

/* 滚动条样式 */
.media-library__content::-webkit-scrollbar {
  width: 6px;
}

.media-library__content::-webkit-scrollbar-track {
  background: transparent;
}

.media-library__content::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 3px;
}

.media-library__content::-webkit-scrollbar-thumb:hover {
  background: var(--color-text-tertiary);
}
</style>
