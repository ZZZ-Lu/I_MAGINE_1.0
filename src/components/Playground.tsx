import React, { useState, useEffect, useRef } from 'react';
import { Play, Sparkles, AlertCircle, RefreshCw, Film, Image as ImageIcon, Music, Download, Clipboard, Check, ChevronRight, History, X } from 'lucide-react';

interface GenerationHistory {
  id: string;
  url: string;
  prompt: string;
  timestamp: number;
}

export default function Playground() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('Playground_apiKey') || '');
  const [prompt, setPrompt] = useState(() => localStorage.getItem('Playground_prompt') || 'A stunning cinematic portrait of actress Go YounJung in neon-lit cyberpunk Seoul streets, masterwork, 8k resolution');
  const [model, setModel] = useState(() => localStorage.getItem('Playground_model') || 'gpt-image-2');
  const [quality, setQuality] = useState(() => localStorage.getItem('Playground_quality') || 'auto');
  const [aspectRatio, setAspectRatio] = useState(() => localStorage.getItem('Playground_aspectRatio') || '16:9');
  const [resolution, setResolution] = useState(() => localStorage.getItem('Playground_resolution') || '2k');
  const [refImagePreview, setRefImagePreview] = useState<string | null>(() => localStorage.getItem('Playground_refImagePreview') || null);
  
  const [logs, setLogs] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultImg, setResultImg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [history, setHistory] = useState<GenerationHistory[]>(() => {
    try {
      const saved = localStorage.getItem('Playground_history');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  useEffect(() => { localStorage.setItem('Playground_apiKey', apiKey); }, [apiKey]);
  useEffect(() => { localStorage.setItem('Playground_prompt', prompt); }, [prompt]);
  useEffect(() => { localStorage.setItem('Playground_model', model); }, [model]);
  useEffect(() => { localStorage.setItem('Playground_quality', quality); }, [quality]);
  useEffect(() => { localStorage.setItem('Playground_aspectRatio', aspectRatio); }, [aspectRatio]);
  useEffect(() => { localStorage.setItem('Playground_resolution', resolution); }, [resolution]);
  useEffect(() => { localStorage.setItem('Playground_history', JSON.stringify(history)); }, [history]);

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setRefImagePreview(result);
      try {
        localStorage.setItem('Playground_refImagePreview', result);
      } catch (err) {
        console.warn("Could not save image to localStorage, size might be too large");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRefImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        processFile(file);
      }
    }
  };

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, msg]);
  };

  const executeApiTest = async () => {
    if (!apiKey) {
      alert('Please enter your API Key');
      return;
    }
    
    setIsGenerating(true);
    setLogs([]);
    setResultImg(null);
    
    try {
      addLog(`Starting test for ${model}...`);
      
      const sizeMap: Record<string, string> = {
        "1:1-1k": "1024x1024", "1:1-2k": "2048x2048", "1:1-4k": "2880x2880",
        "16:9-1k": "1280x720", "16:9-2k": "2560x1440", "16:9-4k": "3840x2160",
        "9:16-1k": "720x1280", "9:16-2k": "1440x2560", "9:16-4k": "2160x3840"
      };
      const sizeStr = sizeMap[`${aspectRatio}-${resolution}`] || "1024x1024";

      addLog(`Calculated Size: ${sizeStr}`);
      addLog(`Quality: ${quality}`);
      
      let imageBlob: Blob;
      let filename: string;

      if (refImagePreview) {
        addLog(`Using uploaded reference image...`);
        try {
          const fetchRes = await fetch(refImagePreview);
          imageBlob = await fetchRes.blob();
          filename = 'reference.png';
        } catch (e) {
          addLog(`Failed to load reference image blob, using blank canvas.`);
          const canvas = document.createElement("canvas");
          canvas.width = 1024;
          canvas.height = 1024;
          const ctx = canvas.getContext("2d");
          if(ctx) {
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, 1024, 1024);
          }
          const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
          if (!blob) throw new Error("Failed to create blank image");
          imageBlob = blob;
          filename = 'image_0.png';
        }
      } else {
        addLog(`No reference image provided. Generating 1024x1024 blank canvas.`);
        const canvas = document.createElement("canvas");
        canvas.width = 1024;
        canvas.height = 1024;
        const ctx = canvas.getContext("2d");
        if(ctx) {
          ctx.fillStyle = "white";
          ctx.fillRect(0, 0, 1024, 1024);
        }
        
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
        if (!blob) throw new Error("Failed to create blank image");
        imageBlob = blob;
        filename = 'image_0.png';
      }

      const formData = new FormData();
      formData.append('prompt', prompt);
      formData.append('model', model);
      formData.append('n', '1');
      formData.append('quality', quality);
      formData.append('size', sizeStr);
      formData.append('image', imageBlob, filename);
      
      addLog(`Sending POST /v1/images/edits?async=true...`);
      
      const res = await fetch('/api/t8star/v1/images/edits?async=true', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        },
        body: formData
      });
      
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        addLog(`Failed to parse response: ${text.substring(0, 150)}`);
        throw new Error("Invalid JSON response");
      }
      
      addLog(`Response Status: ${res.status}`);
      addLog(`Response: ${JSON.stringify(data).substring(0, 200)}...`);
      
      if (!res.ok) {
        throw new Error(`API Error: ${data.message || data.error?.message || res.statusText}`);
      }
      
      const taskId = data.task_id || data.data;
      if (!taskId) {
        throw new Error('No task ID returned');
      }
      
      addLog(`Task submitted. ID: ${taskId}`);
      
      let attempts = 0;
      while (attempts < 60) {
        attempts++;
        await new Promise(r => setTimeout(r, 5000));
        addLog(`Polling status... (Attempt ${attempts})`);
        
        const statusRes = await fetch(`/api/t8star/v1/images/tasks/${taskId}`, {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        
        const statusText = await statusRes.text();
        let statusData;
        try {
          statusData = JSON.parse(statusText);
        } catch(e) {
          addLog("Parsing error in status response");
          continue;
        }

        const inner = statusData.data || {};
        const state = inner.status;
        addLog(`Status: ${state} | Progress: ${inner.progress || '0%'}`);
        
        if (state === 'SUCCESS') {
          addLog("SUCCESS! Resolving Image...");
          const resData = inner.data?.data?.[0];
          if (resData && resData.url) {
            setResultImg(resData.url);
            addLog(`Final URL: ${resData.url}`);
            
            // Add to history
            const newHistoryItem: GenerationHistory = {
              id: taskId,
              url: resData.url,
              prompt: prompt,
              timestamp: Date.now()
            };
            setHistory(prev => [newHistoryItem, ...prev].slice(0, 50)); // keep last 50
          } else {
             addLog(`Unexpected Data structure: ${JSON.stringify(inner.data).substring(0, 200)}`);
          }
          break;
        } else if (state === 'FAILURE') {
          addLog(`Task failed: ${inner.fail_reason}`);
          break;
        }
      }

    } catch (err: any) {
      addLog(`Error: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      {zoomedImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 md:p-8 cursor-zoom-out"
          onClick={() => setZoomedImage(null)}
        >
          <img 
            src={zoomedImage} 
            alt="Zoomed output" 
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl mix-blend-screen"
          />
          <button 
            className="absolute top-6 right-6 text-zinc-400 hover:text-white bg-zinc-900/50 p-2 rounded-full transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setZoomedImage(null);
            }}
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      <div className="col-span-1 lg:col-span-5 bg-zinc-950/80 border border-zinc-800 rounded-xl p-5 space-y-6 text-left">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 font-mono">Real API Tester</h3>
          <h2 className="text-lg font-semibold text-zinc-100 mt-1">Zhenzhen Live Test</h2>
        </div>

        <div className="space-y-4 pt-3 border-t border-zinc-950">
          <div className="space-y-1.5">
            <span className="text-[10px] font-mono text-zinc-500 uppercase">API Key</span>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="w-full bg-zinc-950 border border-zinc-800 focus:border-violet-500 focus:outline-none rounded-lg p-2.5 text-xs font-mono text-zinc-300"
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] font-mono text-zinc-500 uppercase">Prompt (STRING)</span>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              className="w-full bg-zinc-950 border border-zinc-800 focus:border-violet-500 rounded-lg p-3 text-xs font-mono text-zinc-300"
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] font-mono text-zinc-500 uppercase">Reference Image (Optional)</span>
            {refImagePreview ? (
              <div className="relative inline-block mt-2">
                <img 
                  src={refImagePreview} 
                  alt="Reference Preview" 
                  className="w-24 h-24 object-cover rounded-lg border border-zinc-800 cursor-pointer" 
                  onClick={() => setZoomedImage(refImagePreview)}
                />
                <button
                  onClick={() => {
                    setRefImagePreview(null);
                    localStorage.removeItem('Playground_refImagePreview');
                  }}
                  className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 w-5 h-5 flex items-center justify-center text-[10px] shadow-lg hover:bg-red-500"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div 
                className={`flex items-center justify-center w-full h-24 border-2 border-dashed rounded-lg transition-colors cursor-pointer relative overflow-hidden ${
                  isDragging ? 'border-violet-500 bg-violet-500/10' : 'border-zinc-800 hover:border-violet-500/50'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="flex flex-col items-center justify-center text-zinc-500 pointer-events-none">
                  <ImageIcon className={`w-6 h-6 mb-2 ${isDragging ? 'text-violet-400' : ''}`} />
                  <span className="text-xs font-mono">{isDragging ? 'Drop here' : 'Click or Drag Image'}</span>
                </div>
                <input type="file" accept="image/*" onChange={handleRefImageChange} className="absolute inset-0 opacity-0 cursor-pointer" />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono text-zinc-500 uppercase">Model</span>
              <select value={model} onChange={(e) => setModel(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 p-2.5 rounded-lg text-xs font-mono">
                <option value="gpt-image-2">gpt-image-2</option>
                <option value="gpt-image-2-all">gpt-image-2-all</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono text-zinc-500 uppercase">Quality</span>
              <select value={quality} onChange={(e) => setQuality(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 p-2.5 rounded-lg text-xs font-mono">
                <option value="auto">auto</option>
                <option value="high">high</option>
                <option value="hd">hd</option>
                <option value="standard">standard</option>
                <option value="medium">medium</option>
                <option value="low">low</option>
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono text-zinc-500 uppercase">Aspect Ratio</span>
              <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 p-2.5 rounded-lg text-xs font-mono">
                <option value="1:1">1:1</option>
                <option value="16:9">16:9</option>
                <option value="9:16">9:16</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono text-zinc-500 uppercase">Resolution</span>
              <select value={resolution} onChange={(e) => setResolution(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 p-2.5 rounded-lg text-xs font-mono">
                <option value="1k">1k</option>
                <option value="2k">2k</option>
                <option value="4k">4k</option>
              </select>
            </div>
          </div>
        </div>

        <button
          onClick={executeApiTest}
          disabled={isGenerating}
          className="w-full py-3 px-4 rounded-lg font-mono text-xs font-semibold cursor-pointer text-zinc-100 flex items-center justify-center space-x-2 bg-violet-600 hover:bg-violet-500"
        >
          {isGenerating ? <RefreshCw className="h-4 w-4 animate-spin text-violet-400" /> : <Sparkles className="h-4 w-4 text-violet-300" />}
          <span>{isGenerating ? 'Testing API...' : 'Run Test'}</span>
        </button>
      </div>

      <div className="col-span-1 lg:col-span-7 space-y-6">
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl flex flex-col" style={{ minHeight: '400px' }}>
          <div className="bg-zinc-900/50 border-b border-zinc-800/80 p-4 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className={`h-2.5 w-2.5 rounded-full ${isGenerating ? 'bg-amber-500 animate-pulse' : 'bg-zinc-700'}`}></div>
              <span className="font-mono text-xs text-zinc-300 font-semibold uppercase">API Terminal</span>
            </div>
          </div>

          <div className="p-4 font-mono text-[10px] text-zinc-400 bg-zinc-950 space-y-1.5 text-left overflow-y-auto max-h-[300px]">
            {logs.map((log, idx) => (
              <div key={idx} className="flex gap-2">
                <span className="text-zinc-600">[{new Date().toLocaleTimeString()}]</span>
                <span className={log.includes('Error') || log.includes('failed') ? 'text-red-400' : log.includes('SUCCESS') ? 'text-green-400' : ''}>{log}</span>
              </div>
            ))}
            {resultImg && (
              <div className="mt-4 p-2 bg-zinc-900 border border-zinc-800 rounded-lg flex justify-center">
                <img 
                  src={resultImg} 
                  alt="result" 
                  className="max-h-64 object-contain rounded cursor-zoom-in" 
                  onClick={() => setZoomedImage(resultImg)}
                />
              </div>
            )}
          </div>
        </div>

        {/* History Panel */}
        <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-5 text-left">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2 text-zinc-400">
              <History className="w-4 h-4" />
              <h3 className="text-xs font-semibold uppercase tracking-wider font-mono">Generation History</h3>
            </div>
            {history.length > 0 && (
              <button 
                onClick={() => setHistory([])}
                className="text-[10px] font-mono text-zinc-500 hover:text-red-400 transition-colors"
              >
                Clear All
              </button>
            )}
          </div>
          
          {history.length === 0 ? (
            <div className="text-center py-8 text-zinc-600 text-xs font-mono border border-dashed border-zinc-800 rounded-lg">
              No generations yet. Images will be saved here automatically.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {history.map((item) => (
                <div key={item.id} className="group relative aspect-square bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden flex-shrink-0 cursor-zoom-in" onClick={() => setZoomedImage(item.url)}>
                  <img src={item.url} alt={item.prompt} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                    <p className="text-[10px] text-white font-mono line-clamp-2" title={item.prompt}>{item.prompt}</p>
                    <p className="text-[9px] text-zinc-400 font-mono mt-1">{new Date(item.timestamp).toLocaleTimeString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
