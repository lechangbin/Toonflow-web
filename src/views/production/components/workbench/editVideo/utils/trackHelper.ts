import { generateId } from "vue-clip-track";

const TRACK_NAMES: Record<string, string> = {
  video: "视频",
  image: "图片",
  audio: "音频",
  subtitle: "字幕",
  text: "文本",
  sticker: "贴纸",
  filter: "滤镜",
  effect: "特效",
};

const DEFAULT_DURATIONS: Record<string, number> = {
  video: 5,
  image: 5,
  audio: 30,
  subtitle: 3,
  text: 3,
  sticker: 3,
  filter: 3,
  effect: 3,
  transition: 3,
};

/** 根据素材类型获取默认时长 */
export function getDefaultDuration(mediaType: string, mediaData: any): number {
  if (mediaData.duration && mediaData.duration > 0) {
    return mediaData.duration;
  }
  return DEFAULT_DURATIONS[mediaType] || 3;
}

/** 检查轨道在指定时间范围是否有足够空间（不重叠） */
export function hasSpaceInTrack(track: any, startTime: number, duration: number): boolean {
  const endTime = startTime + duration;
  for (const clip of track.clips) {
    if (clip.type === "transition") continue;
    if (startTime < clip.endTime && endTime > clip.startTime) {
      return false;
    }
  }
  return true;
}

/** 查找或创建匹配类型且有足够空间的轨道 */
export function findOrCreateTrackWithSpace(
  tracksStore: any,
  mediaType: string,
  startTime: number,
  duration: number,
  preferredTrackId?: string,
): { track: any; isNew: boolean } {
  if (preferredTrackId) {
    const preferredTrack = tracksStore.tracks.find((t: any) => t.id === preferredTrackId);
    if (preferredTrack && preferredTrack.type === mediaType) {
      if (hasSpaceInTrack(preferredTrack, startTime, duration)) {
        return { track: preferredTrack, isNew: false };
      }
    }
  }

  const sameTypeTracks = tracksStore.sortedTracks.filter((t: any) => t.type === mediaType && !t.isMain);
  for (const track of sameTypeTracks) {
    if (hasSpaceInTrack(track, startTime, duration)) {
      return { track, isNew: false };
    }
  }

  const trackCount = tracksStore.getTrackCountByType(mediaType);
  const newTrack = {
    id: generateId("track-"),
    type: mediaType,
    name: `${TRACK_NAMES[mediaType] || mediaType}${trackCount + 1}`,
    visible: true,
    locked: false,
    clips: [],
    order: tracksStore.tracks.length,
  };

  tracksStore.addTrack(newTrack);
  return { track: newTrack, isNew: true };
}
