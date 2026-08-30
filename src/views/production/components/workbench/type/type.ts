import type {
  VideoAudioSelection,
  VideoCapabilityContract,
  VideoCapabilityId,
  VideoInputRole,
  VideoModelContract,
  VideoOutputSelection,
  VideoTrackActualSelection,
  VideoTrackInputProjection,
  VideoWorkbenchTrackProjection,
} from "@/videoContract";

declare global {
  interface VideoModel extends VideoModelContract {}

  interface UploadItemBase {
    fileType: "image" | "video" | "audio";
    id: number | null;
    src?: string;
    filePath?: string;
    prompt?: string;
    name?: string;
    inputRole?: VideoInputRole;
  }

  interface UploadItemStoryboard extends UploadItemBase {
    sources: "storyboard";
    index: number;
  }

  interface UploadItemAssets extends UploadItemBase {
    sources: "assets";
  }

  interface UploadItemUploaded extends UploadItemBase {
    sources: "uploaded-media";
    filePath: string;
  }

  type UploadItem = UploadItemStoryboard | UploadItemAssets | UploadItemUploaded;

  interface StoryboardItem {
    src: string;
    createTime?: number | null;
    duration?: string | null;
    flowId?: number | null;
    id: number;
    index: number;
    projectId?: number | null;
    prompt?: string | null;
    reason?: string | null;
    scriptId?: number | null;
    state?: string | null;
    trackId?: number | null;
    videoDesc?: string | null;
  }

  interface TrackItem extends Omit<VideoWorkbenchTrackProjection, "medias" | "videoList"> {
    promptRevisionId?: number | null;
    vendorId?: string | null;
    modelId?: string | null;
    capabilityId?: VideoCapabilityId | null;
    outputSelection?: VideoOutputSelection | null;
    audioSelection?: VideoAudioSelection | null;
    inputReferences?: VideoTrackInputProjection[];
    actual: VideoTrackActualSelection;
    medias: TrackMedia[];
    videoList: VideoItem[];
  }

  interface VideoItem {
    id: number;
    src: string;
    state: "未生成" | "生成中" | "已完成" | "生成失败" | "生成成功";
    errorReason?: string | null;
    generationTaskId?: number | null;
    artifactRevisionId?: number | null;
    artifactStatus?: "draft" | "generated" | "accepted" | "rejected" | null;
    artifactRevision?: import("@/videoContract").ArtifactRevision | null;
  }

  interface TrackMediaBase {
    src: string;
    id?: number;
    filePath?: string;
    prompt?: string;
    name?: string;
    fileType: "image" | "video" | "audio";
    inputRole?: VideoInputRole;
    index?: number;
  }

  interface TrackMediaStoryboard extends TrackMediaBase {
    sources: "storyboard";
  }

  interface TrackMediaAssets extends TrackMediaBase {
    sources: "assets";
  }

  interface TrackMediaUploaded extends TrackMediaBase {
    sources: "uploaded-media";
    filePath: string;
  }

  interface TrackMediaUnknown extends TrackMediaBase {
    sources?: string;
  }

  type TrackMedia = TrackMediaStoryboard | TrackMediaAssets | TrackMediaUploaded | TrackMediaUnknown;

  interface HistoryVideoItem {
    errorReason?: string | null;
    src: string;
    id: number;
    duration?: number | string | null;
    projectId?: number | null;
    scriptId?: number | null;
    state?: string | null;
    time?: number | null;
    videoTrackId?: number | null;
    artifactRevisionId?: number | null;
    artifactStatus?: string | null;
  }

  interface ModelSetting {
    modelSelection: string;
    model: VideoModel | null;
    capabilityId: VideoCapabilityId | "";
    capability: VideoCapabilityContract | null;
    output: VideoOutputSelection | null;
    audio: VideoAudioSelection;
  }
}

export {};
