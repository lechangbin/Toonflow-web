<template>
  <div class="skillManagement">
    <div class="toolbar">
      <div class="leftTools">
        <t-button theme="danger" @click="scanSkills">
          <template #icon><t-icon name="refresh" /></template>
          扫描Skills
        </t-button>
        <t-button theme="primary" @click="addSkill()">
          <template #icon><t-icon name="add" /></template>
          新增 Skill
        </t-button>
        <t-button theme="default" variant="outline" @click="showImportSkill = !showImportSkill" v-if="false">
          <template #icon><t-icon name="upload" /></template>
          Toonflow-Hub 导入
        </t-button>
      </div>
      <div class="rightTools">
        <t-input v-model="searchText" placeholder="按名称搜索 skill" clearable style="width: 220px" @enter="getData" />
        <t-button theme="default" @click="getData">
          <template #icon><t-icon name="search" /></template>
          查询
        </t-button>
      </div>
    </div>

    <div class="table">
      <div class="info">共 {{ pagination.total }} 条 Skill</div>
      <div class="item" v-for="(item, index) in tableData" :key="index">
        <div class="topInfo f ac jb">
          <div class="f ac">
            <div class="name">{{ item.name }}</div>
            <div class="type f">
              <t-tag size="small" v-if="item.type == 'main'" theme="danger">核心</t-tag>
              <t-tag size="small" v-if="item.type == 'references'" theme="success">技法</t-tag>
              <t-tag size="small" v-for="(attr, index) in item.attributions" :key="index" style="margin-right: 4px">{{ attr }}</t-tag>
            </div>
          </div>
          <div class="state">
            <t-tag size="small" v-if="item.state == 1" theme="success">正常</t-tag>
            <t-tag size="small" v-else-if="item.state == 0" theme="warning">生成描述中</t-tag>
            <t-tag size="small" v-else-if="item.state == -1" theme="danger">描述为空</t-tag>
            <t-tag size="small" v-else-if="item.state == -2" theme="danger">归属异常</t-tag>
            <t-tag size="small" v-else-if="item.state == -3" theme="danger">MD5变动，建议更新描述</t-tag>
          </div>
        </div>
        <div class="md5">MD5：{{ item.md5 }}</div>
        <div class="path">路径：{{ item.path }}</div>
        <div class="description">{{ item.description || "⚠️描述为空将会影响技能调用" }}</div>
        <div class="flootInfo f ac jb">
          <div class="createTime">{{ dayjs(item.createTime).format("YYYY-MM-DD HH:mm:ss") }}</div>
          <div class="btnList">
            <t-button variant="text" size="small">
              <template #icon><t-icon name="edit" /></template>
              编辑
            </t-button>
            <t-button theme="danger" variant="text" size="small">
              <template #icon><t-icon name="delete" /></template>
              删除
            </t-button>
          </div>
        </div>
      </div>
    </div>
    <t-pagination
      v-model:current="pagination.current"
      v-model:pageSize="pagination.pageSize"
      class="paginationWrap"
      :total="pagination.total"
      show-sizer
      @current-change="getData"
      @page-size-change="getData" />
  </div>
  <t-dialog placement="top" header="从 Toonflow-Hub 导入" v-model:visible="showImportSkill">
    <div class="inputBox f ac">
      <span class="title">分享链接</span>
      <t-input v-model="shareUrl"></t-input>
    </div>
    <div class="tips" @click="jumpToonflowHub">
      Toonflow-Hub
      <i-share theme="outline" />
    </div>
  </t-dialog>
</template>

<script setup lang="ts">
import dayjs from "dayjs";
import axios from "@/utils/axios";

const searchText = ref(""); //搜索值
const shareUrl = ref(""); //分享链接

const loading = ref(false);
const showImportSkill = ref(false);

const pagination = ref({
  current: 1,
  pageSize: 10,
  total: 0,
});

type SkillAttribution =
  | "production_agent_decision.md"
  | "production_agent_execution.md"
  | "production_agent_supervision.md"
  | "script_agent_decision.md"
  | "script_agent_execution.md"
  | "script_agent_supervision.md"
  | "universal-agent.md";

interface SkillListItem {
  id: string;
  md5: string;
  path: string;
  type: string;
  name: string;
  description: string;
  attributions: SkillAttribution[];
  state: number;
  createTime: number;
}

const tableData = ref<SkillListItem[]>([]);

async function scanSkills() {
  await axios.post("/setting/skillManagement/scanSkills");
  window.$message.success("生成描述成功");
  getData();
}

async function getData() {
  loading.value = true;
  try {
    const { data }: { data: { list: SkillListItem[]; total: number } } = await axios.post("/setting/skillManagement/getSkillList", {
      page: pagination.value.current,
      limit: pagination.value.pageSize,
      search: searchText.value,
    });

    tableData.value = data.list;
    pagination.value.total = Number(data.total);
  } catch (error: any) {
    window.$message.error(error?.message || "获取 skill 列表失败");
    tableData.value = [];
    pagination.value.total = 0;
  } finally {
    loading.value = false;
  }
}

function addSkill() {
  window.$message.info("敬请期待");
}

function jumpToonflowHub() {
  window.open("https://hub.toonflow.net/skills");
}

onMounted(() => {
  getData();
});
</script>

<style lang="scss" scoped>
.skillManagement {
  .toolbar {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    .leftTools {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .rightTools {
      display: flex;
      gap: 8px;
      align-items: center;
    }
  }
  .table {
    margin-top: 1rem;
    border: 1px solid var(--td-component-border);
    border-radius: var(--td-radius-default);
    .info {
      background: #f6f6f6;
      padding: 1rem;
      border-bottom: 1px solid var(--td-component-border);
    }
    .item {
      border-bottom: 1px solid var(--td-component-border);
      height: 100%;
      max-height: 200px;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      .topInfo {
        .name {
          font-weight: bold;
        }
        .type {
          margin-left: 0.5rem;
        }
      }
      .md5 {
        font-size: 12px;
      }
      .path {
        opacity: 0.7;
        font-size: 12px;
      }
      .description {
        margin-top: 0.5rem;
        margin-bottom: 0.5rem;
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 4;
      }
      .flootInfo {
        .createTime {
          font-size: 12px;
        }
        .btnList {
          display: flex;
          gap: 4px;
        }
      }
    }
  }
  .paginationWrap {
    margin-top: 1rem;
  }
  .inputBox {
    .title {
      white-space: nowrap;
      margin-right: 1rem;
      font-size: 16px;
      font-weight: 500;
      color: #000;
    }
  }
  .tips {
    cursor: pointer;
    margin-top: 1rem;
    color: #339af0;
    &:hover {
      text-decoration: underline;
      color: #4263eb;
    }
  }
}
</style>
