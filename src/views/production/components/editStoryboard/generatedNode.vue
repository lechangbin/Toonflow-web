<template>
  <div class="generatedNode">
    <Handle type="target" :position="Position.Left" />
    <div class="data" @click="selectedFn">
      <div class="title ac">
        <i-pic theme="outline" size="16" fill="#000000" />
        <span class="title-text">图片生成</span>
      </div>
      <div class="image">
        <div v-if="generating" class="imageLoading">
          <div class="loadingSpinner"></div>
          <span class="loadingText">生成中...</span>
        </div>
        <div v-else class="imageWrapper">
          <t-image :src="data.generatedImage" fit="cover" :class="['nodeImage', { selected }]" />
        </div>
      </div>
    </div>
    <div v-if="selected" class="parameter">
      <div class="image-refs f">
        <div v-for="(item, index) in data.references" :key="index" class="ref-thumb">
          <t-image :src="item.image" fit="cover" class="ref-img" />
        </div>
      </div>
      <div class="text w">
        <div class="textareaWrapper">
          <div
            ref="editorRef"
            class="promptEditor"
            contenteditable="true"
            :data-placeholder="editorContent.length === 0 ? '描述任何你想要生成的内容，按@引用素材' : ''"
            @input="handleInput"
            @keydown="handleKeydown"
            @blur="handleBlur"
            @mousedown.stop></div>
          <div v-if="showReferences" class="references-popup" :style="{ left: popupPosition.left + 'px', top: popupPosition.top + 'px' }">
            <div class="references-list">
              <div
                v-for="(item, index) in data.references"
                :key="index"
                class="reference-item"
                :class="{ active: activeIndex === index }"
                @mousedown.prevent="selectReference(index)">
                <t-image :src="item.image" fit="cover" class="ref-popup-img" />
                <span class="reference-label">图{{ index + 1 }}</span>
              </div>
              <div v-if="!data.references?.length" class="no-references">暂无可引用的图片</div>
            </div>
          </div>
        </div>
      </div>
      <div class="operate ac">
        <t-select v-model="data.model" class="paramSelect" size="small" placeholder="模型">
          <t-option value="banana-pro" label="Banana Pro" />
          <t-option value="other" label="Other" />
        </t-select>
        <t-select v-model="data.ratio" class="paramSelect ml-5" size="small" placeholder="比例">
          <t-option value="16:9" label="16:9" />
          <t-option value="9:16" label="9:16" />
          <t-option value="1:1" label="1:1" />
        </t-select>
        <t-select v-model="data.quality" class="paramSelect ml-5" size="small" placeholder="质量">
          <t-option value="1K" label="1K" />
          <t-option value="2K" label="2K" />
        </t-select>
        <t-button theme="primary" size="small" class="generateBtn" :disabled="generating" :loading="generating" @click="handleGenerate">
          <template #icon><i-arrow-up /></template>
        </t-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Handle, Position } from "@vue-flow/core";

const selected = ref(false);
const editorRef = ref<HTMLDivElement | null>(null);
const showReferences = ref(false);
const activeIndex = ref(0);
const popupPosition = ref({ left: 0, top: 0 });
const generating = ref(false);
const editorContent = ref("");

// 保存 @ 触发时的范围，用于后续替换
let savedRange: Range | null = null;

const props = defineProps<{
  id: string;
  data: {
    generatedImage?: string;
    references?: { image: string }[];
    prompt?: string;
    model?: string;
    ratio?: string;
    quality?: string;
    steps?: number;
  };
}>();

function selectedFn() {
  selected.value = !selected.value;
}

// 获取光标前的文本内容
function getTextBeforeCursor(): string {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return "";

  const range = sel.getRangeAt(0);
  const node = range.startContainer;
  if (node.nodeType === Node.TEXT_NODE) {
    return (node as Text).textContent?.substring(0, range.startOffset) ?? "";
  }
  return "";
}

// 获取弹窗位置（基于光标位置）
function getCursorPopupPosition(): { left: number; top: number } {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return { left: 0, top: 24 };

  const range = sel.getRangeAt(0).cloneRange();
  range.collapse(true);
  const rect = range.getBoundingClientRect();
  const editorRect = editorRef.value!.getBoundingClientRect();

  return {
    left: Math.max(0, rect.left - editorRect.left),
    top: rect.bottom - editorRect.top + 4,
  };
}

// 处理输入事件
function handleInput() {
  editorContent.value = editorRef.value?.textContent || "";
  syncPrompt();

  const text = getTextBeforeCursor();
  const lastAt = text.lastIndexOf("@");

  if (lastAt !== -1 && !text.substring(lastAt + 1).includes(" ")) {
    showReferences.value = true;
    activeIndex.value = 0;
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedRange = sel.getRangeAt(0).cloneRange();
    }
    nextTick(() => {
      popupPosition.value = getCursorPopupPosition();
    });
    return;
  }

  showReferences.value = false;
  savedRange = null;
}

// 处理键盘事件
function handleKeydown(e: KeyboardEvent) {
  if (!showReferences.value || !props.data.references?.length) return;

  const maxIndex = props.data.references.length - 1;
  switch (e.key) {
    case "ArrowDown":
      e.preventDefault();
      activeIndex.value = Math.min(activeIndex.value + 1, maxIndex);
      break;
    case "ArrowUp":
      e.preventDefault();
      activeIndex.value = Math.max(activeIndex.value - 1, 0);
      break;
    case "Enter":
    case "Tab":
      e.preventDefault();
      selectReference(activeIndex.value);
      break;
    case "Escape":
      showReferences.value = false;
      break;
  }
}

// 选择引用 —— 将 @ 及后面的输入替换为 tag 节点
function selectReference(index: number) {
  if (!editorRef.value || !savedRange) return;

  // 找到光标所在文本节点，从最后一个 @ 开始删除
  const sel = window.getSelection();
  if (!sel) return;

  // 恢复到触发 @ 时的范围
  const range = savedRange.cloneRange();
  const textNode = range.startContainer as Text;
  const cursorOffset = range.startOffset;
  const fullText = textNode.textContent || "";
  const lastAt = fullText.lastIndexOf("@", cursorOffset - 1);

  if (lastAt === -1) return;

  // 删除从 @ 到当前光标之间的文本（含 @）
  const deleteRange = document.createRange();
  deleteRange.setStart(textNode, lastAt);
  deleteRange.setEnd(textNode, cursorOffset);
  deleteRange.deleteContents();

  // 创建 tag span 节点（图标 + 文字）
  const tag = document.createElement("span");
  tag.className = "reference-tag";
  tag.contentEditable = "false";
  tag.dataset.refIndex = String(index);

  // 图标：使用 SVG 内联（iconpark pic outline）
  const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 48 48" fill="none" style="display:inline-block;vertical-align:middle;flex-shrink:0">
    <rect x="6" y="6" width="36" height="36" rx="3" ry="3" stroke="currentColor" stroke-width="3" fill="none"/>
    <circle cx="18" cy="18" r="4" stroke="currentColor" stroke-width="3" fill="none"/>
    <path d="M6 32l10-10 8 8 6-6 12 12" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </svg>`;
  tag.innerHTML = iconSvg + `Image ${index + 1}`;

  // 在光标处插入 tag
  const insertRange = document.createRange();
  insertRange.setStart(textNode, lastAt);
  insertRange.collapse(true);
  insertRange.insertNode(tag);

  // 在 tag 后插入零宽空格，供光标停留
  const space = document.createTextNode("\u200B");
  tag.after(space);

  // 将光标移到零宽空格后
  const newRange = document.createRange();
  newRange.setStart(space, 1);
  newRange.collapse(true);
  sel.removeAllRanges();
  sel.addRange(newRange);

  showReferences.value = false;
  savedRange = null;

  editorContent.value = editorRef.value?.textContent || "";
  syncPrompt();
}

// 将编辑器内容同步回 data.prompt（纯文本，tag 转为 @图X）
function syncPrompt() {
  if (!editorRef.value) return;
  let result = "";
  editorRef.value.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      // 去掉零宽空格
      result += (node.textContent || "").replace(/\u200B/g, "");
    } else if ((node as HTMLElement).classList?.contains("reference-tag")) {
      // 只取文字部分（跳过 SVG），格式为 @Image X
      const refIndex = (node as HTMLElement).dataset.refIndex;
      result += `图${Number(refIndex) + 1}`;
    }
  });
  props.data.prompt = result;
}

// 处理失焦
function handleBlur() {
  setTimeout(() => {
    showReferences.value = false;
  }, 150);
}

// 生成
function handleGenerate() {
  generating.value = true;
  //拿到 prompt、model、ratio、quality 等参数，调用接口生成图片，接口返回后更新 data.generatedImage
  console.log("%c Line:263 🎂 props.data", "background:#2eafb0", props.data);
  setTimeout(() => {
    generating.value = false;
  }, 3000);
}
</script>

<style lang="scss" scoped>
.generatedNode {
  width: 320px;
  display: flex;
  flex-direction: column;
  align-items: center;

  .data {
    width: 100%;
    cursor: pointer;

    .title {
      height: 30px;
      padding: 5px;

      .title-text {
        margin-left: 5px;
        color: #4b4b4b;
      }
    }

    .image {
      height: 320px;
      width: 100%;

      .imageLoading {
        width: 100%;
        height: 100%;
        background-color: #e8e8e8;
        border-radius: 10px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;

        .loadingSpinner {
          width: 36px;
          height: 36px;
          border: 3px solid #d0d0d0;
          border-top-color: #5bccb3;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        .loadingText {
          font-size: 14px;
          color: #666;
        }
      }

      .imageWrapper {
        position: relative;
        width: 100%;
        height: 100%;

        :deep(.nodeImage) {
          width: 100%;
          height: 100%;
          border-radius: 10px;
          border: 3px solid transparent;
          box-sizing: border-box;

          &.selected {
            border-color: #000;
          }
        }
      }
    }
  }

  .parameter {
    margin-top: 10px;
    width: 500px;
    height: 200px;
    border: 1px solid #d4d4d4;
    background-color: #fff;
    border-radius: 10px;

    .image-refs {
      height: 50px;
      padding: 10px;

      .ref-thumb {
        margin-left: 8px;

        .ref-img {
          width: 45px;
          height: 45px;
          border-radius: 10px;
        }
      }
    }

    .text {
      height: 100px;
      display: flex;
      position: relative;

      .textareaWrapper {
        width: 100%;
        height: 100%;
        position: relative;
      }

      .promptEditor {
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        border: none;
        outline: none;
        padding: 10px;
        overflow-y: auto;
        font-size: 13px;
        line-height: 1.6;
        color: #333;
        white-space: pre-wrap;
        word-break: break-all;
        margin-left: 5px;
        margin-top: 5px;
        cursor: text;

        &:empty::before {
          content: attr(data-placeholder);
          color: #aaa;
          pointer-events: none;
        }
      }

      .references-popup {
        position: absolute;
        z-index: 99999;
        min-width: 160px;
        max-height: 200px;
        overflow-y: auto;
        background: #fff;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);

        .references-list {
          padding: 4px 0;
        }

        .reference-item {
          display: flex;
          align-items: center;
          padding: 8px 12px;
          cursor: pointer;
          transition: background-color 0.2s;

          &.active {
            background-color: #f0faf8;
          }

          .ref-popup-img {
            width: 36px;
            height: 36px;
            border-radius: 6px;
          }

          .reference-label {
            margin-left: 10px;
            font-size: 14px;
            font-weight: 500;
            color: #333;
          }
        }

        .no-references {
          padding: 12px;
          text-align: center;
          color: #999;
          font-size: 13px;
        }
      }
    }

    .operate {
      padding: 10px;
      height: 50px;

      .paramSelect {
        width: 100px;
      }

      .ml-5 {
        margin-left: 5px;
      }

      .generateBtn {
        margin-left: auto;
        --td-brand-color: #5bccb3;
        --td-brand-color-hover: #4ab8a0;
      }
    }
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
:deep(.reference-tag) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #e6f7f4;
  color: #3aaa91;
  border: 1px solid #b2e5da;
  border-radius: 999px;
  padding: 1px 6px 1px 4px;
  font-size: 11px;
  font-weight: 500;
  line-height: 16px;
  margin: 0 2px;
  user-select: all;
  cursor: default;
  white-space: nowrap;
  vertical-align: middle;
  gap: 2px;

  svg {
    flex-shrink: 0;
    vertical-align: middle;
  }
}
</style>
