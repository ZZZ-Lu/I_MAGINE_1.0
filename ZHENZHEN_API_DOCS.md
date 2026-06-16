# ZhenZhen (gpt-image-2) API Integration Guide
**Target Audience**: AI Coding Agents & Developers
**Purpose**: Build a robust integration for the `gpt-image-2` / `gpt-image-2-all` models to ensure that reference images, quality settings, and aspect ratios remain strictly respected, preventing the upstream server from unpredictably routing the request to fallback models (which results in a loss of quality control).

## ⚠️ Core Architecture Requirements (CRITICAL)

The secret to perfectly preserving `quality` and preventing model-drifting is **how the endpoint is called**. 

1. **Endpoint Choice**: You MUST use the **`/v1/images/edits?async=true`** endpoint. Do NOT use `/v1/images/generations` if you want to support reference images natively with the `quality` param.
2. **Payload Format**: You MUST use `multipart/form-data`. JSON payloads will drop the reference image and might ignore the `quality` parameter.
3. **The Blank Canvas Trick**: If the user **does not** provide a reference image, you MUST dynamically generate a **1024x1024 blank white image** on the client (or backend) and pass it into the `image` field. If you omit the `image` field entirely in `/edits`, the API will fail or route incorrectly.

---

## 1. Request Structure

**URL:** `POST https://ai.t8star.org/v1/images/edits?async=true`
**Headers:**
- `Authorization: Bearer <API_KEY>`
- *(Do not explicitly set `Content-Type`, let the FormData/fetch API set it with the correct boundary)*

**FormData Parameters:**

| Field Name | Type | Description |
| :--- | :--- | :--- |
| `prompt` | String | The generation prompt. |
| `model` | String | Exactly `"gpt-image-2"` or `"gpt-image-2-all"`. |
| `n` | String | `"1"` (Number of images). |
| `quality` | String | Exact string value: `"auto"`, `"high"`, `"hd"`, `"standard"`, `"medium"`, or `"low"`. |
| `size` | String | Dimensions constructed from aspect ratio and resolution pairs (e.g., `"1024x1024"`, `"2560x1440"`, `"1440x2560"`). |
| `image` | File/Blob | **Crucial:** The reference image. If none exists, pass a 1024x1024 white PNG File/Blob named `image_0.png`. |

---

## 2. Standard Implementation (JavaScript / TypeScript)

### Generating the Blank Image (Fallback)
If the user didn't upload a reference image, use this to build a blank blob:
```typescript
async function getBlankImageBlob(): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, 1024, 1024);
  }
  return await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
}
```

### Building and Sending the FormData
```typescript
const formData = new FormData();
formData.append('prompt', "A stunning portrait...");
formData.append('model', "gpt-image-2"); // or "gpt-image-2-all"
formData.append('n', "1");
formData.append('quality', "auto"); // "high", "medium", "low", etc.
formData.append('size', "2560x1440"); // Mapped from user's aspect ratio choice

// If user uploaded an image, use it. Otherwise, use the blank canvas.
const imageBlob = userReferenceBlob || await getBlankImageBlob();
formData.append('image', imageBlob, 'image.png');

// 1. Submit the task
const response = await fetch('https://ai.t8star.org/v1/images/edits?async=true', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${API_KEY}`
  },
  body: formData
});

const uploadData = await response.json();
const taskId = uploadData.task_id || uploadData.data;
```

---

## 3. Asynchronous Polling

The initial request returns immediately with a `task_id`. You MUST poll the endpoint to get the final image URL.

**Polling URL:** `GET https://ai.t8star.org/v1/images/tasks/{task_id}`

**Polling Logic:**
1. Delay for 5 seconds between each request.
2. Check `data.data.status`.
3. If `"SUCCESS"`, extract the image URL.
4. If `"FAILURE"`, extract `data.data.fail_reason` and throw an error.

```typescript
let maxAttempts = 60; // 5 minutes timeout
while (maxAttempts > 0) {
  await new Promise(res => setTimeout(res, 5000));
  
  const statusRes = await fetch(`https://ai.t8star.org/v1/images/tasks/${taskId}`, {
    headers: { 'Authorization': `Bearer ${API_KEY}` }
  });
  
  const statusData = await statusRes.json();
  const inner = statusData.data || {};
  const state = inner.status;
  
  if (state === 'SUCCESS') {
    const finalUrl = inner.data?.data?.[0]?.url;
    return finalUrl; // Done!
  } else if (state === 'FAILURE') {
    throw new Error(`Generation Failed: ${inner.fail_reason}`);
  }
  
  maxAttempts--;
}
```

## 4. Size Mapping Reference
Map the user's aspect ratio and resolution intent to exact dimensions required by `size`:
- `1:1` -> "1024x1024" (1k), "2048x2048" (2k), "2880x2880" (4k)
- `16:9` -> "1280x720" (1k), "2560x1440" (2k), "3840x2160" (4k)
- `9:16` -> "720x1280" (1k), "1440x2560" (2k), "2160x3840" (4k)
