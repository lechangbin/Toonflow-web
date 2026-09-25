import type { VideoAudioSelection, VideoOutputSelection,
  VideoSelection } from "@/videoContract";

export interface VideoQuoteTarget {
  projectId: number;
  vendorId: string;
  modelId: string;
  capabilityId: "text-to-video";
  output: VideoOutputSelection;
  audio: VideoAudioSelection;
}

export interface VideoQuoteSnapshot extends VideoQuoteTarget {
  estimatedMaxCostMicros: number;
  currency: string;
  revision: number;
  updatedAt: number;
}

type Post = <T>(path: string, body: unknown) => Promise<{ data: T }>;

export function videoQuoteTarget(projectId: number,
  selection: VideoSelection): VideoQuoteTarget {
  if (!Number.isSafeInteger(projectId) || projectId <= 0
    || selection.capabilityId !== "text-to-video"
    || !selection.vendorId || !selection.modelId) {
    throw new TypeError("Only a Project-scoped text-to-video selection can have a controlled estimate");
  }
  return { projectId, vendorId: selection.vendorId,
    modelId: selection.modelId, capabilityId: "text-to-video",
    output: selection.output, audio: selection.audio };
}

export function createVideoQuoteClient(post: Post) {
  return {
    async get(target: VideoQuoteTarget): Promise<VideoQuoteSnapshot | null> {
      const result = await post<{ quote: VideoQuoteSnapshot | null }>(
        "/agentRuns/videoQuote/get", target);
      return result.data.quote;
    },
    async set(target: VideoQuoteTarget, expectedRevision: number,
      estimatedMaxCostMicros: number, currency: string): Promise<VideoQuoteSnapshot> {
      if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0
        || !Number.isSafeInteger(estimatedMaxCostMicros)
        || estimatedMaxCostMicros <= 0 || estimatedMaxCostMicros > 1_000_000_000
        || !/^[A-Z]{3}$/u.test(currency)) {
        throw new TypeError("Video estimate or expected revision is invalid");
      }
      const result = await post<{ quote: VideoQuoteSnapshot }>(
        "/agentRuns/videoQuote/set", { ...target, expectedRevision,
          estimatedMaxCostMicros, currency });
      return result.data.quote;
    },
  };
}
