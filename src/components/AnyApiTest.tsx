import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Send, Image, Download, Copy, Check, AlertCircle, Loader2, X, Upload, RefreshCw } from 'lucide-react';

const SIZE_OPTIONS = [
  { value: '1024x1024', label: '1024x1024 (正方形)' },
  { value: '1536x1024', label: '1536x1024 (横版)' },
  { value: '1024x1536', label: '1024x1536 (竖版)' },
  { value: '2048x2048', label: '2048x2048 (2K正方形)' },
  { value: '2048x1152', label: '2048x1152 (2K横版)' },
  { value: '3840x2160', label: '3840x2160 (4K横版)' },
  { value: '2160x3840', label: '2160x3840 (4K竖版)' },
];

const QUALITY_OPTIONS = [
  { value: 'auto', label: 'auto (默认)' },
  { value: 'low', label: 'low' },
  { value: 'medium', label: 'medium' },
  { value: 'high', label: 'high' },
];

const MODEL_OPTIONS = [
  { value: 'gpt-image-2', label: 'gpt-image-2' },
  { value: 'gpt-image-2-all', label: 'gpt-image-2-all' },
  { value: 'gpt-image-2-2in1', label: 'gpt-image-2-2in1 (竞速)' },
];

export default function AnyApiTest({ onBack }: { onBack: () => void }) {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('AnyApi_key') || '');
  const [prompt, setPrompt] = useState(() => localStorage.getItem('AnyApi_prompt') || 'A children\'s book drawing of a veterinarian using a stethoscope to listen to the heartbeat of a baby otter.');
  const [n, setN] = useState(1);
  const [size, setSize] = useState('1024x1024');
  const [quality, setQuality] = useState('auto');
  const [model, setModel] = useState('gpt-image-2');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<{ url: string; id: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [refImages, setRefImages] = useState<{ file: File; preview: string }[]>([]);
  const [pollingStatus, setPollingStatus] = useState<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('AnyApi_key', apiKey);
  }, [apiKey]);

  useEffect(() => {
    localStorage.setItem('AnyApi_prompt', prompt);
  }, [prompt]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  const handleRefImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newImages: { file: File; preview: string }[] = [];
    Array.from(files).forEach(file => {
      const preview = URL.createObjectURL(file);
      newImages.push({ file, preview });
    });

    setRefImages(prev => [...prev, ...newImages]);
    e.target.value = '';
  }, []);

  const removeRefImage = useCallback((index: number) => {
    setRefImages(prev => {
      const newImages = [...prev];
      URL.revokeObjectURL(newImages[index].preview);
      return newImages.filter((_, i) => i !== index);
    });
  }, []);

  const generateWhiteImage = useCallback((targetW: number, targetH: number): Promise<Blob> => {
    return new Promise(resolve => {
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, targetW, targetH);
      }
      canvas.toBlob((blob) => {
        resolve(blob || new Blob());
      }, 'image/png');
    });
  }, []);

  const runSingle = useCallback(async (
    modelName: string,
    signal: AbortSignal,
    tag: string,
    imageBlobs: { blob: Blob; name: string }[],
    sizeStr: string
  ): Promise<string> => {
    const formData = new FormData();
    formData.append('prompt', prompt.trim());
    formData.append('model', modelName);
    formData.append('n', '1');
    formData.append('quality', quality);
    formData.append('size', sizeStr);
    imageBlobs.forEach(item => formData.append('image', item.blob, item.name));

    addLog(`[${tag}] POST /v1/images/edits?async=true (model: ${modelName})...`);
    const res = await fetch('/api/any/v1/images/edits?async=true', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
      signal,
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`[${tag}] Invalid JSON response`);
    }
    if (!res.ok) {
      throw new Error(`[${tag}] API Error: ${data.message || data.error?.message || res.statusText}`);
    }
    const taskId = data.task_id || data.data;
    if (!taskId) throw new Error(`[${tag}] No task ID`);
    addLog(`[${tag}] Task: ${taskId}`);

    let attempts = 0;
    while (attempts < 60) {
      if (signal.aborted) throw new DOMException(`[${tag}] Aborted`, 'AbortError');
      attempts++;
      setPollingStatus(`[${tag}] Polling ${attempts}/60...`);
      addLog(`[${tag}] Polling ${attempts}/60...`);
      await new Promise(r => setTimeout(r, 5000));
      if (signal.aborted) throw new DOMException(`[${tag}] Aborted`, 'AbortError');

      const statusRes = await fetch(`/api/any/v1/images/tasks/${taskId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal,
      });
      const statusText = await statusRes.text();
      let statusData;
      try {
        statusData = JSON.parse(statusText);
      } catch {
        continue;
      }
      const inner = statusData.data || {};
      const state = inner.status;
      setPollingStatus(`[${tag}] Status: ${state}`);
      addLog(`[${tag}] Status: ${state}`);

      if (state === 'SUCCESS') {
        const resData = inner.data?.data?.[0];
        if (resData && resData.url) return resData.url;
        throw new Error(`[${tag}] Unexpected response structure`);
      } else if (state === 'FAILURE') {
        throw new Error(`[${tag}] Failed: ${inner.fail_reason}`);
      }
    }
    throw new Error(`[${tag}] Timeout (60 attempts)`);
  }, [prompt, quality, apiKey, addLog]);

  const handleSubmit = useCallback(async () => {
    if (!apiKey) {
      setError('请输入 API Key');
      return;
    }
    if (!prompt.trim()) {
      setError('请输入提示词');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults([]);
    setLogs([]);
    setPollingStatus('');

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    addLog('准备请求...');

    const [wStr, hStr] = size.split('x');
    const targetW = parseInt(wStr, 10);
    const targetH = parseInt(hStr, 10);

    let imageBlobs: { blob: Blob; name: string }[] = [];
    if (refImages.length > 0) {
      addLog(`Loading ${refImages.length} reference image(s)...`);
      for (let i = 0; i < refImages.length; i++) {
        imageBlobs.push({ blob: refImages[i].file, name: `reference_${i}.png` });
      }
    }
    if (imageBlobs.length === 0) {
      addLog('No reference images, generating white placeholder image...');
      const blob = await generateWhiteImage(targetW, targetH);
      imageBlobs.push({ blob, name: 'image_0.png' });
    }

    try {
      let winnerUrl: string;

      if (model === 'gpt-image-2-2in1') {
        addLog('2in1 Racing: gpt-image-2 (A) vs gpt-image-2-all (B)...');

        const runSingleWithLog = async (modelName: string, signal: AbortSignal, tag: string): Promise<string> => {
          try {
            return await runSingle(modelName, signal, tag, imageBlobs, size);
          } catch (err: any) {
            if (err.name === 'AbortError') {
              addLog(`[${tag}] Cancelled (lost race)`);
            } else {
              addLog(`[${tag}] Failed: ${err.message}`);
            }
            throw err;
          }
        };

        winnerUrl = await Promise.any([
          runSingleWithLog('gpt-image-2', abortController.signal, 'A'),
          runSingleWithLog('gpt-image-2-all', abortController.signal, 'B'),
        ]);
        abortController.abort();
        addLog('2in1 Winner resolved.');
      } else {
        winnerUrl = await runSingle(model, abortController.signal, 'Main', imageBlobs, size);
      }

      addLog(`Success! Image URL: ${winnerUrl}`);
      setResults([{ url: winnerUrl, id: `img_${Date.now()}` }]);
      setPollingStatus('');
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        addLog(`Error: ${err.message}`);
        setError(err.message);
      }
      setPollingStatus('');
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [apiKey, prompt, n, size, quality, model, refImages, generateWhiteImage, runSingle, addLog]);

  const handleCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
      setPollingStatus('Cancelled');
      addLog('Request cancelled by user');
    }
  }, [addLog]);

  const handleDownload = useCallback((url: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `anyapi_${Date.now()}.jpg`;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  const copyToClipboard = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-mono text-sm">
      <header className="bg-zinc-900 border-b border-zinc-800 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#4f39f6] rounded-lg flex items-center justify-center">
              <Image className="w-4 h-4" />
            </div>
            <span className="font-semibold">Any API 测试</span>
          </div>
        </div>
        <span className="text-xs text-zinc-500">gpt-image-2</span>
      </header>

      <div className="p-4 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-4">
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5 uppercase font-semibold">API Key</label>
                  <input
                    type="text"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Bearer YOUR_API_KEY"
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#4f39f6] transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5 uppercase font-semibold">Model</label>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#4f39f6] transition-colors"
                  >
                    {MODEL_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5 uppercase font-semibold">Prompt</label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="输入提示词..."
                    rows={6}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#4f39f6] transition-colors resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5 uppercase font-semibold">Reference Images (optional)</label>
                  <div className="space-y-2">
                    {refImages.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {refImages.map((img, idx) => (
                          <div key={idx} className="relative group">
                            <img
                              src={img.preview}
                              alt={`Reference ${idx}`}
                              className="w-16 h-16 object-cover rounded-lg border border-zinc-700"
                            />
                            <button
                              onClick={() => removeRefImage(idx)}
                              className="absolute -top-1 -right-1 p-1 bg-red-500 hover:bg-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <label className="flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed border-zinc-700 rounded-lg cursor-pointer hover:border-[#4f39f6] transition-colors">
                      <Upload className="w-4 h-4" />
                      <span className="text-xs text-zinc-500">点击上传参考图</span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleRefImageChange}
                        className="hidden"
                      />
                    </label>
                    <p className="text-xs text-zinc-600">如果不上传参考图，系统将自动生成白图作为占位</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1.5 uppercase font-semibold">Size</label>
                    <select
                      value={size}
                      onChange={(e) => setSize(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#4f39f6] transition-colors"
                    >
                      {SIZE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-zinc-500 mb-1.5 uppercase font-semibold">Quality</label>
                    <select
                      value={quality}
                      onChange={(e) => setQuality(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#4f39f6] transition-colors"
                    >
                      {QUALITY_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleSubmit}
                    disabled={isLoading}
                    className="flex-1 flex items-center justify-center gap-2 bg-[#4f39f6] hover:bg-[#4338ca] disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-lg px-4 py-3 font-semibold transition-colors"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>生成中...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>生成图片</span>
                      </>
                    )}
                  </button>
                  {isLoading && (
                    <button
                      onClick={handleCancel}
                      className="flex items-center justify-center gap-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg px-4 py-3 font-semibold transition-colors"
                    >
                      <X className="w-4 h-4" />
                      <span>取消</span>
                    </button>
                  )}
                </div>

                {pollingStatus && (
                  <div className="flex items-center gap-2 text-xs text-zinc-400 bg-zinc-950 rounded-lg px-3 py-2">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>{pollingStatus}</span>
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-red-400 whitespace-pre-wrap">{error}</div>
                </div>
              </div>
            )}

            {logs.length > 0 && (
              <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
                <div className="text-xs text-zinc-500 mb-2 uppercase font-semibold">日志</div>
                <div className="space-y-1 text-xs text-zinc-400 max-h-[300px] overflow-y-auto font-mono">
                  {logs.map((log, idx) => (
                    <div key={idx}>{log}</div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
            <div className="text-xs text-zinc-500 mb-3 uppercase font-semibold">生成结果</div>
            {results.length === 0 ? (
              <div className="h-[600px] flex items-center justify-center text-zinc-600">
                <div className="text-center">
                  <Image className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">暂无结果</p>
                  <p className="text-xs text-zinc-700 mt-1">点击「生成图片」按钮开始</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 max-h-[600px] overflow-y-auto">
                {results.map((item) => (
                  <div key={item.id} className="space-y-2">
                    <div className="relative rounded-lg overflow-hidden bg-zinc-950">
                      <img
                        src={item.url}
                        alt={`Generated ${item.id}`}
                        className="w-full max-h-[400px] object-contain"
                      />
                      <div className="absolute bottom-2 right-2 flex gap-1">
                        <button
                          onClick={() => copyToClipboard(item.url, item.id)}
                          className="p-1.5 bg-black/60 hover:bg-black/80 rounded-lg transition-colors"
                          title="复制链接"
                        >
                          {copiedId === item.id ? (
                            <Check className="w-3.5 h-3.5 text-green-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDownload(item.url)}
                          className="p-1.5 bg-black/60 hover:bg-black/80 rounded-lg transition-colors"
                          title="下载"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-500 font-mono truncate flex-1 mr-2">{item.url}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
