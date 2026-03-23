import type { Ref } from "vue";
import { computed } from "vue";

// ==================== 固定节点 ID ====================
const NODE_IDS = {
  script: "script",
  scriptPlan: "scriptPlan",
  assets: "assets",
  storyboardTable: "storyboardTable",
  storyboard: "storyboard",
  workbench: "workbench",
  poster: "poster",
} as const;

type NodeId = (typeof NODE_IDS)[keyof typeof NODE_IDS];

// ==================== 类型定义 ====================
interface DeriveAsset {
  id: number;
  assetsId: string;
  name: string;
  desc: string;
  src: string;
  state: "未生成" | "生成中" | "已完成" | "生成失败";
}

interface AssetItem {
  assetsId: string;
  name: string;
  desc: string;
  src: string;
  derive: DeriveAsset[];
}

interface Storyboard {
  id: number;
  title: string;
  description: string;
  camera: string;
  duration: number;
  frameMode: "firstFrame" | "endFrame" | "linesSoundEffects";
  prompt: string;
  lines: string | null;
  sound: string | null;
  associateAssetsIds: number[];
  src: string | null;
}

interface WorkbenchData {
  name: string;
  duration: string;
  resolution: string;
  fps: string;
  cover?: string;
  gradient?: string;
}

interface PosterItem {
  id: number;
  image: string;
}

export interface FlowData {
  script: string;
  scriptPlan: string;
  assets: AssetItem[];
  storyboardTable: string;
  storyboard: Storyboard[];
  workbench: WorkbenchData;
  poster: {
    items: PosterItem[];
  };
}

export type NodePositions = Record<string, { x: number; y: number }>;

// 边样式
const edgeStyle = {
  stroke: "#00000",
  strokeWidth: 4,
};

const TOPO_ORDER = [
  NODE_IDS.script,
  NODE_IDS.scriptPlan,
  NODE_IDS.assets,
  NODE_IDS.storyboardTable,
  NODE_IDS.storyboard,
  NODE_IDS.workbench,
  NODE_IDS.poster,
] as const;

const NODE_DEPENDENCIES: Record<NodeId, NodeId[]> = {
  [NODE_IDS.script]: [],
  [NODE_IDS.scriptPlan]: [NODE_IDS.script],
  [NODE_IDS.assets]: [NODE_IDS.script],
  [NODE_IDS.storyboardTable]: [NODE_IDS.scriptPlan],
  [NODE_IDS.storyboard]: [NODE_IDS.storyboardTable],
  [NODE_IDS.workbench]: [NODE_IDS.storyboard],
  [NODE_IDS.poster]: [NODE_IDS.workbench],
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

const hasDataByNode: Record<NodeId, (data: FlowData) => boolean> = {
  [NODE_IDS.script]: (data) => isNonEmptyString(data.script),
  [NODE_IDS.scriptPlan]: (data) => isNonEmptyString(data.scriptPlan),
  [NODE_IDS.assets]: (data) => Array.isArray(data.assets) && data.assets.length > 0,
  [NODE_IDS.storyboardTable]: (data) => isNonEmptyString(data.storyboardTable),
  [NODE_IDS.storyboard]: (data) => Array.isArray(data.storyboard) && data.storyboard.length > 0,
  [NODE_IDS.workbench]: (data) =>
    [
      data.workbench?.name,
      data.workbench?.duration,
      data.workbench?.resolution,
      data.workbench?.fps,
      data.workbench?.cover,
      data.workbench?.gradient,
    ].some(isNonEmptyString),
  [NODE_IDS.poster]: (data) => Array.isArray(data.poster?.items) && data.poster.items.length > 0,
};

function hasNodeData(id: NodeId, data: FlowData): boolean {
  return hasDataByNode[id](data);
}

function getVisibleNodeIds(data: FlowData) {
  const visibleNodeIds = new Set<NodeId>();

  // 按拓扑顺序判断：当前节点有数据且所有前置节点可见，才允许显示。
  TOPO_ORDER.forEach((id) => {
    const dependencies = NODE_DEPENDENCIES[id] || [];
    const allDependenciesVisible = dependencies.every((depId) => visibleNodeIds.has(depId));

    if (hasNodeData(id, data) && allDependenciesVisible) {
      visibleNodeIds.add(id);
    }
  });

  return visibleNodeIds;
}

// ==================== 构建函数 ====================
export function useFlowBuilder(flowData: Ref<FlowData>, nodePositions: Ref<NodePositions>) {
  const visibleNodeIds = computed(() => getVisibleNodeIds(flowData.value));

  const nodes = computed(() => {
    const data = flowData.value;
    const positions = nodePositions.value;
    const ids = NODE_IDS;
    const visibleIds = visibleNodeIds.value;

    const allNodes = [
      // 1. Script 节点
      {
        id: ids.script,
        type: "script",
        dragHandle: ".dragHandle",
        position: positions[ids.script] || { x: 0, y: 0 },
        data: {
          script: data.script,
          handleIds: {
            assets: `${ids.script}-assets`,
            source: `${ids.script}-source`,
          },
        },
      },
      // 1.5 ScriptPlan 节点
      {
        id: ids.scriptPlan,
        type: "scriptPlan",
        dragHandle: ".dragHandle",
        position: positions[ids.scriptPlan] || { x: 0, y: 0 },
        data: {
          scriptPlan: data.scriptPlan,
          handleIds: {
            target: `${ids.scriptPlan}-target`,
            source: `${ids.scriptPlan}-source`,
          },
        },
      },
      // 2. Assets 节点
      {
        id: ids.assets,
        type: "assets",
        dragHandle: ".dragHandle",
        position: positions[ids.assets] || { x: 0, y: 0 },
        data: {
          assets: data.assets,
          handleIds: {
            target: `${ids.assets}-target`,
          },
        },
      },
      // 3. StoryboardTable 节点
      {
        id: ids.storyboardTable,
        type: "storyboardTable",
        dragHandle: ".dragHandle",
        position: positions[ids.storyboardTable] || { x: 0, y: 0 },
        data: {
          storyboardTable: data.storyboardTable,
          handleIds: {
            target: `${ids.storyboardTable}-target`,
            source: `${ids.storyboardTable}-source`,
          },
        },
      },
      // 4. Storyboard 节点
      {
        id: ids.storyboard,
        type: "storyboard",
        dragHandle: ".dragHandle",
        position: positions[ids.storyboard] || { x: 0, y: 0 },
        data: {
          storyboard: data.storyboard,
          handleIds: {
            target: `${ids.storyboard}-target`,
            source: `${ids.storyboard}-source`,
          },
        },
      },
      // 5. Workbench 节点
      {
        id: ids.workbench,
        type: "workbench",
        dragHandle: ".dragHandle",
        position: positions[ids.workbench] || { x: 0, y: 0 },
        data: {
          ...data.workbench,
          handleIds: {
            target: `${ids.workbench}-target`,
            source: `${ids.workbench}-source`,
          },
        },
      },
      // 6. Poster 节点
      {
        id: ids.poster,
        type: "poster",
        dragHandle: ".dragHandle",
        position: positions[ids.poster] || { x: 0, y: 0 },
        data: {
          items: data.poster?.items ?? [],
          handleIds: {
            target: `${ids.poster}-target`,
          },
        },
      },
    ];

    return allNodes.filter((node) => visibleIds.has(node.id as NodeId));
  });

  const edges = computed(() => {
    const ids = NODE_IDS;
    const visibleIds = visibleNodeIds.value;

    const allEdges = [
      // Script -> Assets
      {
        id: `${ids.script}-${ids.assets}`,
        source: ids.script,
        target: ids.assets,
        sourceHandle: `${ids.script}-assets`,
        targetHandle: `${ids.assets}-target`,
        animated: true,
        style: edgeStyle,
      },
      // Script -> StoryboardTable
      {
        id: `${ids.script}-${ids.scriptPlan}`,
        source: ids.script,
        target: ids.scriptPlan,
        sourceHandle: `${ids.script}-source`,
        targetHandle: `${ids.scriptPlan}-target`,
        animated: true,
        style: edgeStyle,
      },
      // ScriptPlan -> StoryboardTable
      {
        id: `${ids.scriptPlan}-${ids.storyboardTable}`,
        source: ids.scriptPlan,
        target: ids.storyboardTable,
        sourceHandle: `${ids.scriptPlan}-source`,
        targetHandle: `${ids.storyboardTable}-target`,
        animated: true,
        style: edgeStyle,
      },
      // StoryboardTable -> Storyboard
      {
        id: `${ids.storyboardTable}-${ids.storyboard}`,
        source: ids.storyboardTable,
        target: ids.storyboard,
        sourceHandle: `${ids.storyboardTable}-source`,
        targetHandle: `${ids.storyboard}-target`,
        animated: true,
        style: edgeStyle,
      },
      // Storyboard -> Workbench
      {
        id: `${ids.storyboard}-${ids.workbench}`,
        source: ids.storyboard,
        target: ids.workbench,
        sourceHandle: `${ids.storyboard}-source`,
        targetHandle: `${ids.workbench}-target`,
        animated: true,
        style: edgeStyle,
      },
      // Workbench -> Poster
      {
        id: `${ids.workbench}-${ids.poster}`,
        source: ids.workbench,
        target: ids.poster,
        sourceHandle: `${ids.workbench}-source`,
        targetHandle: `${ids.poster}-target`,
        animated: true,
        style: edgeStyle,
      },
    ];

    return allEdges.filter((edge) => visibleIds.has(edge.source as NodeId) && visibleIds.has(edge.target as NodeId));
  });

  return { nodes, edges };
}
