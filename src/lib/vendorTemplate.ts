// ==================== 类型定义 ====================
// 文本模型
interface TextModel {
  name: string; // 显示名称
  modelName: string;
  type: "text";
  multimodal: boolean; // 前端显示用
  tool: boolean; // 前端显示用
}

// 图像模型
interface ImageModel {
  name: string; // 显示名称
  modelName: string;
  type: "image";
  mode: ("text" | "singleImage" | "multiReference")[];
}

// 视频模型
interface VideoModel {
  name: string; // 显示名称
  modelName: string;
  type: "video";
  mode: (
    | "singleImage" // 单图
    | "multiImage" // 多图模式
    | "gridImage" // 网格单图（传入一张图片，但该图片是网格图）
    | "startEndRequired" // 首尾帧（两张都得有）
    | "endFrameOptional" // 首尾帧（尾帧可选）
    | "startFrameOptional" // 首尾帧（首帧可选）
    | "text" // 文本生视频
    | "audioReference" // 音频参考
    | "videoReference"
  )[]; // 视频参考 // 视频参考
  audio: "optional" | false | true; // 音频配置
  durationResolutionMap: { duration: number[]; resolution: string[] }[];
}

// 供应商配置
interface VendorConfig {
  version: number;
  icon?: string; //仅支持base64格式
  name: string;
  inputs: {
    key: string;
    label: string;
    type: "text" | "password" | "url";
    required: boolean;
    placeholder?: string;
  }[];
  inputValues: Record<string, string>;
  models: (TextModel | ImageModel | VideoModel)[];
}

// ==================== 供应商数据 ====================
const vendor: VendorConfig = {
  version: 1,
  name: "Toonflow官方中转平台",
  inputs: [
    { key: "apiKey", label: "API密钥", type: "password", required: true },
    { key: "text", label: "文本", type: "url", required: false },
    { key: "image", label: "图片任务创建", type: "url", required: false, placeholder: "如非必要请勿更改" },
    { key: "imageCreate", label: "异步图片任务创建", type: "url", required: false, placeholder: "如非必要请勿更改" },
    { key: "imageQuery", label: "异步图片任务查询", type: "url", required: false, placeholder: "如非必要请勿更改" },
    { key: "soraVideoCreate", label: "Sora视频任务创建", type: "url", required: false, placeholder: "如非必要请勿更改" },
    { key: "soraVideoQuery", label: "Sora视频任务查询", type: "url", required: false, placeholder: "如非必要请勿更改" },
    { key: "soraVideoDownload", label: "Sora视频文件下载", type: "url", required: false, placeholder: "如非必要请勿更改" },
    { key: "videoCreate", label: "通用视频任务创建", type: "url", required: false, placeholder: "如非必要请勿更改" },
    { key: "videoQuery", label: "通用视频任务查询", type: "url", required: false, placeholder: "如非必要请勿更改" },
  ],
  inputValues: {
    apiKey: "REMOVED_SECRET",
    baseUrl: "http://127.0.0.1:33332/v1",
    text: "http://127.0.0.1:33332/v1",
    image: "http://127.0.0.1:33332/v1/images/generations",
    imageCreate: "http://127.0.0.1:33332/imagegenerator/task",
    imageQuery: "http://127.0.0.1:33332/imagegenerator/task/{id}",
    soraVideoCreate: "http://127.0.0.1:33332/v1/videos",
    soraVideoQuery: "http://127.0.0.1:33332/v1/videos/{id}",
    soraVideoDownload: "http://127.0.0.1:33332/v1/videos/{id}/content",
    videoCreate: "http://127.0.0.1:33332/videogenerator/generate",
    videoQuery: "http://127.0.0.1:33332/videogenerator/generate/{id}",
  },
  models: [
    {
      name: "Sora 2",
      type: "video",
      modelName: "Sora-2-I2V",
      mode: ["singleImage", "text"],
      audio: "optional",
      durationResolutionMap: [{ duration: [4, 8, 12], resolution: ["720x1280", "1280x720", "1024x1792", "1792x1024"] }],
    },
    {
      name: "Doubao Seedream 5.0 Lite",
      type: "image",
      modelName: "Doubao-Seedream-5.0-Lite",
      mode: ["text", "singleImage", "multiReference"],
    },
    {
      name: "gpt-4.1",
      type: "text",
      modelName: "gpt-4.1",
      multimodal: true, // 前端显示用
      tool: true, // 前端显示用
    },
  ],
};
exports.vendor = vendor;

// ==================== 全局工具函数 ====================
//Axios实例
//压缩图片大小(1MB = 1 * 1024 * 1024)
declare const zipImage: (completeBase64: string, size: number) => Promise<string>;
//压缩图片分辨率
declare const zipImageResolution: (completeBase64: string, width: number, height: number) => Promise<string>;
//多图拼接乘单图 maxSize  最大输出大小，默认为 10mb
declare const mergeImages: (completeBase64: string[], maxSize?: string) => Promise<string>;
//Url转Base64
declare const urlToBase64: (url: string) => Promise<string>;
//轮询函数
declare const pollTask: (
  fn: () => Promise<{ completed: boolean; data?: string; error?: string }>,
  interval?: number,
  timeout?: number,
) => Promise<{ completed: boolean; data?: string; error?: string }>;

// ==================== 适配器函数 ====================

// 文本请求函数
const textRequest: (textModel: TextModel) => { url: string; model: string } = (textModel) => {
  if (!vendor.inputValues.apiKey) throw new Error("缺少API Key");
  const apiKey = vendor.inputValues.apiKey.replace("Bearer ", "");

  return createOpenAI({
    baseURL: vendor.inputValues.text || "http://127.0.0.1:33332/v1/chat/completions",
    apiKey: apiKey,
  }).chat(textModel.modelName);
};
exports.textRequest = textRequest;

//图片请求函数
interface ImageConfig {
  systemPrompt?: string; // 系统提示词
  prompt: string; //图片提示词
  imageBase64: string[]; //输入的图片提示词
  size: "1K" | "2K" | "4K"; // 图片尺寸
  aspectRatio: `${number}:${number}`; // 长宽比
}
const imageRequest = async (imageConfig: ImageConfig, imageModel: ImageModel) => {
  if (!vendor.inputValues.apiKey) throw new Error("缺少API Key");
  const apiKey = vendor.inputValues.apiKey.replace("Bearer ", "");

  if (imageModel.modelName == "Doubao-Seedream-5.0-Lite") {
    const size = imageConfig.size === "1K" ? "2K" : imageConfig.size;
    const sizeMap: Record<string, Record<string, string>> = {
      "16:9": {
        "2K": "2848x1600",
        "4K": "4096x2304",
      },
      "9:16": {
        "2K": "1600x2848",
        "4K": "2304x4096",
      },
    };
    const fullPrompt = imageConfig?.systemPrompt ? `${imageConfig.systemPrompt}\n\n${imageConfig.prompt}` : imageConfig.prompt;

    const body: Record<string, any> = {
      model: imageModel.modelName,
      prompt: fullPrompt,
      size: sizeMap[imageConfig.aspectRatio][size],
      response_format: "url",
      sequential_image_generation: "disabled",
      stream: false,
      watermark: false,
      ...(imageConfig.imageBase64 && { image: imageConfig.imageBase64 }),
    };

    const requestUrl = vendor.inputValues.image || "http://127.0.0.1:33332/v1/images/generations";

    const response = await fetch(requestUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const errorText = await response.text(); // 获取错误信息
      console.error("请求失败，状态码:", response.status, ", 错误信息:", errorText);
      throw new Error(`请求失败，状态码: ${response.status}, 错误信息: ${errorText}`);
    }
    const data = await response.json();
    return data.data[0].url;
  } else {
    const requestUrl = vendor.inputValues.imageCreate || "http://127.0.0.1:33332/v1/images/generations";
    const queryUrl = vendor.inputValues.imageQuery || "http://127.0.0.1:33332/imagegenerator/task/{id}";
    const response = await fetch(requestUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const { data } = await response.json();

    if (data.code != "success") throw new Error(`任务提交失败: ${data || "未知错误"}`);
    const res = await pollTask(async () => {
      const queryResponse = await fetch(queryUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ id: data.data.id }),
      });
      const queryData = await queryResponse.json();
      if (queryData.code != 0) throw new Error(`查询任务失败: ${queryData ? JSON.stringify(queryData, null, 2) : "未知错误"}`);
      const { status, results, error, failure_reason } = queryData.data || {};
      if (status === "failed") return { completed: false, error: failure_reason + "\n" + error || "图片生成失败" };
      if (status === "succeeded") return { completed: true, data: results?.[0].url };
      return { completed: false };
    });
    if (res.error) throw new Error(res.error);
  }
};
exports.imageRequest = imageRequest;

interface VideoConfig {
  duration: number;
  resolution: string;
  aspectRatio: "16:9" | "9:16";
  prompt: string;
  imageBase64?: string[];
  audio?: boolean;
  mode: "startEnd" | "multi" | "single" | "text";
  taskClass: string;
  name: string;
  projectId: number;
}

const videoRequest = async (videoConfig: VideoConfig, videoModel: VideoModel) => {
  if (!vendor.inputValues.apiKey) throw new Error("缺少API Key");
  const apiKey = vendor.inputValues.apiKey.replace("Bearer ", "");

  if (videoModel.modelName == "Sora-2-I2V") {
    const sizeMap: Record<string, string> = {
      "16:9": "1280x720",
      "9:16": "720x1280",
    };
    const body = new FormData();
    body.append("model", videoModel.modelName);
    body.append("prompt", videoConfig.prompt);
    body.append("seconds", String(videoConfig.duration));

    const size = sizeMap[videoConfig.aspectRatio] || "1280x720";
    body.append("size", size);
    if (videoConfig.imageBase64 && videoConfig.imageBase64.length) {
      const [width, height] = size.split("x").map(Number);
      const imageB64 = await zipImageResolution(videoConfig.imageBase64[0]!, width, height);
      body.append("input_reference", Buffer.from(imageB64, "base64"), { filename: "image.jpg", contentType: "image/jpeg" });
    }
    const requestUrl = vendor.inputValues.soraVideoCreate || "http://127.0.0.1:33332/v1/videos";
    const queryUrl = vendor.inputValues.soraVideoQuery || "http://127.0.0.1:33332/v1/videos/{id}";
    const downloadUrl = vendor.inputValues.soraVideoDownload || "http://127.0.0.1:33332/v1/videos/{id}/content";
    const response = await axios.post(requestUrl, body, {
      headers: { Authorization: `Bearer ${apiKey}`, ...body.getHeaders() },
    });
    const { data } = response;
    const taskId = data.id ?? data.taskId ?? data.task_id ?? data.data;
    if (!taskId) throw new Error(`任务提交失败: ${data ? JSON.stringify(data) : "未知错误"}`);

    const downloadVideo = async (url: string) => {
      const res = await fetch(downloadUrl.replace("{id}", url), {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) {
        const errorText = await res.text(); // 获取错误信息
        throw new Error(`HTTP error: Status:${res.status}；msg：${errorText}`);
      }
      return Buffer.from(await res.arrayBuffer());
    };

    const res = await pollTask(async () => {
      const queryResponse = await fetch(queryUrl.replace("{id}", taskId), {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      });
      if (!queryResponse.ok) {
        const errorText = await queryResponse.text(); // 获取错误信息
        console.error("请求失败，状态码:", queryResponse.status, ", 错误信息:", errorText);
        throw new Error(`请求失败，状态码: ${queryResponse.status}, 错误信息: ${errorText}`);
      }
      const queryData = await queryResponse.json();
      const status = queryData?.status ?? queryData?.data?.status;
      const fail_reason = queryData?.data?.fail_reason ?? queryData?.data;
      switch (status) {
        case "completed":
        case "SUCCESS":
        case "success":
          const buffer = await downloadVideo(taskId);
          return { completed: true, data: buffer.toString("base64") };
        case "FAILURE":
          return { completed: false, error: fail_reason || "视频生成失败" };
        default:
          return { completed: false };
      }
    });
    if (res.error) throw new Error(res.error);
    return res.data;
  }
};
exports.videoRequest = videoRequest;
