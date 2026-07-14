/**
 * 共享生图服务 —— 提取自 Playground.tsx 的 Zhenzhen Live Test 流程。
 * 生图列 (GenerationColumns) 直接复用此逻辑，不再内部重复实现。
 * 
 * 收图流程：并行下载 → 缩略图秒出 → 全图后台替换 → IndexedDB 持久化。
 */

export interface GenerateImageParams {
  apiKey: string;
  prompt: string;
  model: string;
  quality: string;
  sizeStr: string;
  imageBlobs: { blob: Blob; name: string }[];
  signal?: AbortSignal;
  tag?: string;
}

export interface GenerateImageCallbacks {
  onLog?: (msg: string) => void;
  onStatus?: (status: string, progress?: string) => void;
}

/**
 * 生成白图占位 Blob（无参考图时的兜底）
 */
export async function generateWhiteImageBlob(w: number, h: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, w, h);
  }
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Failed to create white placeholder image');
  return blob;
}

/**
 * 核心生图流程 —— 提交异步任务 + 轮询返回图片 URL。
 * 完全遵循 Playground.tsx Zhenzhen Live Test 的 else 分支逻辑。
 */
export async function runAsyncImageGeneration(
  params: GenerateImageParams,
  callbacks: GenerateImageCallbacks = {}
): Promise<string> {
  const { apiKey, prompt, model, quality, sizeStr, imageBlobs, signal, tag } = params;
  const { onLog, onStatus } = callbacks;
  const prefix = tag ? `[${tag}] ` : '';

  // 1. 构造 FormData
  const formData = new FormData();
  formData.append('prompt', prompt);
  formData.append('model', model);
  formData.append('n', '1');
  formData.append('quality', quality);
  formData.append('size', sizeStr);
  imageBlobs.forEach(item => {
    formData.append('image', item.blob, item.name);
  });

  // 2. 提交任务
  onLog?.(`${prefix}POST /v1/images/edits?async=true (model: ${model})...`);
  const res = await fetch('/api/t8star/v1/images/edits?async=true', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
    signal,
  });

  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`${prefix}Invalid JSON response`);
  }
  onLog?.(`${prefix}Response Status: ${res.status}`);

  if (!res.ok) {
    throw new Error(`${prefix}API Error: ${data.message || data.error?.message || res.statusText}`);
  }

  // 3. 提取 task_id
  const taskId = data.task_id || data.data;
  if (!taskId) {
    throw new Error(`${prefix}No task ID returned`);
  }
  onLog?.(`${prefix}Task submitted. ID: ${taskId}`);

  // 4. 轮询任务状态（最多 60 次，每 5 秒一次）
  let attempts = 0;
  while (attempts < 60) {
    if (signal?.aborted) throw new DOMException(`${prefix}Aborted`, 'AbortError');
    attempts++;
    await new Promise(r => setTimeout(r, 5000));
    if (signal?.aborted) throw new DOMException(`${prefix}Aborted`, 'AbortError');
    onLog?.(`${prefix}Polling status... (Attempt ${attempts})`);

    const statusRes = await fetch(`/api/t8star/v1/images/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal,
    });

    const statusText = await statusRes.text();
    let statusData: any;
    try {
      statusData = JSON.parse(statusText);
    } catch {
      onLog?.(`${prefix}Parsing error in status response`);
      continue;
    }

    const inner = statusData.data || {};
    const state = inner.status;
    const progress = inner.progress || '0%';
    onLog?.(`${prefix}Status: ${state} | Progress: ${progress}`);
    onStatus?.(state, progress);

    if (state === 'SUCCESS') {
      onLog?.(`${prefix}SUCCESS! Resolving Image...`);
      const resData = inner.data?.data?.[0];
      if (resData && resData.url) {
        onLog?.(`${prefix}Final URL: ${resData.url}`);
        return resData.url;
      }
      throw new Error(`${prefix}Unexpected response structure`);
    } else if (state === 'FAILURE') {
      throw new Error(`${prefix}Task failed: ${inner.fail_reason}`);
    }
  }

  throw new Error(`${prefix}Timeout (60 attempts)`);
}

// ═══════════════════════════════════════════
// 收图流程工具函数：下载、缩略图、持久化
// ═══════════════════════════════════════════

/** 带重试的 fetch Blob */
export async function fetchBlobWithRetry(url: string, retries = 3, authHeader?: string): Promise<Blob> {
  let lastErr: Error | null = null;
  for (let i = 0; i < retries; i++) {
    try {
      const headers: Record<string, string> = {};
      if (authHeader) headers['Authorization'] = authHeader;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.blob();
    } catch (err: any) {
      lastErr = err;
      if (i < retries - 1) await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw lastErr || new Error('Failed to fetch blob');
}

/** Blob → base64 DataURL */
export function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (reader.result) resolve(reader.result as string);
      else reject(new Error('Failed to convert blob to data URL'));
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** 生成缩略图 base64（最大边不超过 maxSize px） */
export async function createThumbnail(dataUrl: string, maxSize = 320): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width;
      let h = img.height;
      const ratio = maxSize / Math.max(w, h);
      if (ratio < 1) { w = Math.round(w * ratio); h = Math.round(h * ratio); }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas context failed')); return; }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => reject(new Error('Thumbnail generation failed'));
    img.src = dataUrl;
  });
}

export interface ReceiveImageResult {
  /** 缩略图 DataURL（秒出） */
  thumbnailUrl: string;
  /** 全图 Blob URL（用于渲染） */
  blobUrl: string;
  /** 原始 Blob（用于 IndexedDB 持久化） */
  blob: Blob;
}

/**
 * 核心收图流程 —— 并行下载 + 缩略图 + Blob 直显。
 * 遵循另一个项目的优化方案：缩略图先出，全图后台替换，IndexedDB 由调用方自行持久化。
 */
export async function receiveImage(
  imageUrl: string,
  apiKey?: string,
  maxThumbSize = 320
): Promise<ReceiveImageResult> {
  // 1. 通过 CORS 代理下载原图 Blob（带重试）
  const fetchUrl = imageUrl.startsWith('http')
    ? `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`
    : imageUrl;
  const authHeader = apiKey ? `Bearer ${apiKey}` : undefined;
  const blob = await fetchBlobWithRetry(fetchUrl, 3, authHeader);

  // 2. Blob → DataURL → 缩略图
  const fullDataUrl = await blobToDataURL(blob);
  const thumbnailUrl = await createThumbnail(fullDataUrl, maxThumbSize);

  // 3. 创建全图 Blob URL
  const blobUrl = URL.createObjectURL(blob);

  return { thumbnailUrl, blobUrl, blob };
}
