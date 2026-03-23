interface NodeUploadData {
  type: "upload";
  id: string;
  position: { x: number; y: number };
  data: { image: string };
}
interface NodeGeneratedData {
  type: "generated";
  id: string;
  position: { x: number; y: number };
  data: {
    generatedImage?: string;
    references: { image: string }[];
    prompt: string;
    model?: string;
    ratio?: string;
    quality?: string;
    steps: number;
  };
}
export type NodeType = NodeUploadData | NodeGeneratedData;
