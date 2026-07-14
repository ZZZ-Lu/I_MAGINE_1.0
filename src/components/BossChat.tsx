import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send } from 'lucide-react';
import { callAgent, AgentMessage } from '../services/agentService';

interface ChatMessage {
  id: string;
  sender: 'boss' | 'user';
  content: string;
  imageUrl?: string;
  timestamp: Date;
  status: 'sending' | 'sent' | 'read';
}

const BOSS_NAME = '老板';
const BOSS_AVATAR = '/assets/boss-avatar.png';
const USER_AVATAR = '/assets/user-avatar.png';

const BOSS_SYSTEM_PROMPT = `角色
你是用户的老板

背景
你的公司从事AI短剧行业
用户在一个生图应用中进行操作，用户会通过手机微信和你交流，完成任务

任务
你需要让用户帮你把"孙悟空"，"唐僧"，和"白骨精"三个角色的人设图确定下来

说话风格
短句表达，一句一句说。不要长篇大论。像聊天一样自然。符合微信表达习惯

提醒用户
当用户生成了图片后，提醒用户用鼠标把生好的图片从生图列拖拽到微信对话框中发给你看

你的初步想法
真人写实风格
制作一个AI视频，展示公司对与短剧的理解和制作水平
用三打白骨精的经典故事为基础，创作一段有点无厘头的短片，用唐僧屡屡被骗的经历表达对老年人反诈意识培养的重视
这些想法不是一成不变的，你可以进行迭代，和用户讨论

最终的目标
用户制作出了符合你要求的"孙悟空"，"唐僧"，和"白骨精"的人设图

`;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('BossChatDB', 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('messages')) {
        db.createObjectStore('messages');
      }
      if (!db.objectStoreNames.contains('memories')) {
        db.createObjectStore('memories');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function loadMessagesFromDB(): Promise<ChatMessage[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('messages', 'readonly');
      const store = tx.objectStore('messages');
      const req = store.get('chat_messages');
      req.onsuccess = () => {
        const data = req.result;
        if (data) {
          resolve(data.map((m: ChatMessage) => ({ ...m, timestamp: new Date(m.timestamp) })));
        } else {
          resolve([]);
        }
      };
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  } catch {
    return [];
  }
}

async function saveMessagesToDB(messages: ChatMessage[]): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('messages', 'readwrite');
      const store = tx.objectStore('messages');
      store.put(messages, 'chat_messages');
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    });
  } catch {}
}

// === Memory（记忆）系统 ===
interface BossMemory {
  id: string;
  content: string;
  createdAt: string;
}

async function loadMemoriesFromDB(): Promise<BossMemory[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('memories', 'readonly');
      const store = tx.objectStore('memories');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  } catch {
    return [];
  }
}

async function addMemoryToDB(content: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('memories', 'readwrite');
      const store = tx.objectStore('memories');
      const memory: BossMemory = { id: Date.now().toString(), content, createdAt: new Date().toISOString() };
      store.put(memory, memory.id);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    });
  } catch {}
}

// 记忆系统提示词片段（会被拼接到 BOSS_SYSTEM_PROMPT 尾部）
async function buildMemoryContext(): Promise<string> {
  const memories = await loadMemoriesFromDB();
  if (memories.length === 0) return '';
  return `\n\n你记录过的笔记：\n${memories.map(m => `- ${m.content}`).join('\n')}`;
}

// 微信风格消息音效（使用 Web Audio API 合成，无需加载外部文件）
function playWechatSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.type = 'sine';
    // 两个短促音：先高后低，模仿微信消息音
    oscillator.frequency.setValueAtTime(1200, ctx.currentTime);
    oscillator.frequency.setValueAtTime(800, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.2);
  } catch {}
}

// 老板可用的工具
const BOSS_TOOLS: import('../services/agentService').AgentToolParam[] = [
  {
    type: 'function',
    function: {
      name: 'save_memory',
      description: '保存一条笔记/想法到记忆中，以后每次对话都会自动看到它。用于记录重要信息、用户喜好、任务进度等。',
      parameters: {
        type: 'object',
        properties: {
          content: {
            type: 'string',
            description: '要记住的内容',
          },
        },
        required: ['content'],
      },
    },
  },
];

const DEFAULT_OPENING: { content: string }[] = [
  { content: '有个新项目' },
  { content: '西游，白骨精，老年人反诈题材' },
  { content: '需要先确定三个人设图' },
  { content: '孙悟空，唐僧，白骨精' },
  { content: '就用你那个 IMAGINE，不会用，就点击 鼠标右键 让 agent 帮你生' },
  { content: '你就说老板让你生个憨厚老实的唐僧，一看就容易被骗，无厘头的那种感觉' },
  { content: '生好了把图拖到下面的输入框发我看' },
];

export default function BossChat() {
  const [isOpen, setIsOpen] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [dbReady, setDbReady] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatBodyRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const openingStartedRef = useRef(false);

  // 消息变化时持久化到 IndexedDB
  useEffect(() => {
    if (!dbReady) return;
    saveMessagesToDB(messages);
  }, [messages, dbReady]);

  // 打开聊天或消息更新时自动滚到底部
  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // 每次打开聊天时：从 DB 加载消息 + 滚动到底部
  // 也负责首次挂载时的数据加载（isOpen 初始为 true）
  useEffect(() => {
    if (!isOpen) return;
    loadMessagesFromDB().then((data) => {
      if (data.length > 0) {
        setMessages(data);
        if (!dbReady) setDbReady(true);
      } else {
        if (openingStartedRef.current) return; // 防止 StrictMode 下重复执行
        openingStartedRef.current = true;
        setIsTyping(true);
        const timers: ReturnType<typeof setTimeout>[] = [];
        DEFAULT_OPENING.forEach((item, index) => {
          const timer = setTimeout(() => {
            // 播放微信风格的消息音效
            playWechatSound();
            setMessages(prev => [
              ...prev,
              {
                id: `opening_${index + 1}`,
                sender: 'boss',
                content: item.content,
                timestamp: new Date(),
                status: 'read',
              },
            ]);
            // 最后一条播放完毕
            if (index === DEFAULT_OPENING.length - 1) {
              setTimeout(() => {
                setIsTyping(false);
                if (!dbReady) setDbReady(true);
              }, 500);
            }
          }, index * 3000);
          timers.push(timer);
        });
        typingTimerRef.current = timers;
      }
    });
    scrollToBottom();

    // 清理定时器
    return () => {
      typingTimerRef.current.forEach(clearTimeout);
      typingTimerRef.current = [];
    };
  }, [isOpen, scrollToBottom]);

  const handleSend = useCallback(async (imageUrl?: string) => {
    if ((!inputValue.trim() && !imageUrl) || isLoading || isTyping) return;

    const text = inputValue.trim();
    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      sender: 'user',
      content: text || '[图片]',
      imageUrl,
      timestamp: new Date(),
      status: 'sending',
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    setTimeout(() => {
      setMessages(prev =>
        prev.map(m =>
          m.id === userMessage.id ? { ...m, status: 'sent' } : m
        )
      );
    }, 500);

    const apiKey = localStorage.getItem('agent_qwen_api_key') || '';
    
    if (!apiKey) {
      setTimeout(() => {
        const bossReply: ChatMessage = {
          id: `boss_${Date.now()}`,
          sender: 'boss',
          content: '抱歉，当前没有配置AI接口，请联系管理员设置。',
          timestamp: new Date(),
          status: 'read',
        };
        setMessages(prev => [...prev, bossReply]);
        setMessages(prev =>
          prev.map(m =>
            m.id === userMessage.id ? { ...m, status: 'read' } : m
          )
        );
        setIsLoading(false);
      }, 1000);
      return;
    }

    try {
      // 1) 构建对话历史（AgentMessage[]）
      // 注意：只给当前消息带 imageUrl，历史消息中的图片 data URL 不传给 API
      // 避免 data URL 累积撑爆 6MB 请求体限制
      const agentMessages: AgentMessage[] = [];
      for (const m of messages) {
        const role = m.sender === 'boss' ? 'assistant' : 'user';
        agentMessages.push({ role, content: m.imageUrl ? (m.content || '[图片]') : m.content });
      }
      agentMessages.push({
        role: 'user',
        content: text || '请分析这张图片',
        ...(imageUrl ? { imageUrl } : {}),
      });

      // 2) 加载记忆并拼接到系统提示词尾部
      const memoryCtx = await buildMemoryContext();
      const systemPrompt = BOSS_SYSTEM_PROMPT + memoryCtx;

      // 3) 创建老板回复的空气泡（流式更新）
      const bossReplyId = `boss_${Date.now()}`;
      const bossReply: ChatMessage = {
        id: bossReplyId,
        sender: 'boss',
        content: '',
        timestamp: new Date(),
        status: 'read',
      };
      setMessages(prev => [...prev, bossReply]);

      // 4) 多轮循环：支持工具调用
      let currentMessages = [...agentMessages];
      let rounds = 0;
      let hasToolCalls = true;
      const MAX_ROUNDS = 10;

      while (rounds < MAX_ROUNDS && hasToolCalls) {
        rounds++;
        const result = await callAgent(
          apiKey,
          currentMessages,
          BOSS_TOOLS,
          undefined,
          systemPrompt,
          rounds === 1 ? (delta: string) => {
            setMessages(prev =>
              prev.map(m =>
                m.id === bossReplyId ? { ...m, content: m.content + delta } : m
              )
            );
          } : undefined,
        );

        // 追加 assistant 回复到消息列表
        const assistantMsg: AgentMessage = {
          role: 'assistant',
          content: result.content,
          ...(result.toolCalls.length > 0 ? { tool_calls: result.toolCalls } : {}),
        };
        currentMessages.push(assistantMsg);

        if (result.toolCalls.length === 0) {
          hasToolCalls = false;
          break;
        }

        // 执行工具调用
        for (const tc of result.toolCalls) {
          if (tc.function.name === 'save_memory') {
            const args = JSON.parse(tc.function.arguments || '{}');
            const content = args.content || '';
            if (content) {
              await addMemoryToDB(content);
            }
            // 工具结果推回消息列表
            currentMessages.push({
              role: 'tool',
              content: `已保存笔记：${content}`,
              tool_call_id: tc.id,
            });
          }
        }
      }

      // 如果不是首轮且有tool call，把最终内容更新到气泡
      if (rounds > 1) {
        const lastAssistantMsg = [...currentMessages].reverse().find(m => m.role === 'assistant');
        if (lastAssistantMsg && lastAssistantMsg.content) {
          setMessages(prev =>
            prev.map(m =>
              m.id === bossReplyId ? { ...m, content: lastAssistantMsg.content } : m
            )
          );
        }
      }

      setMessages(prev =>
        prev.map(m =>
          m.id === userMessage.id ? { ...m, status: 'read' } : m
        )
      );
    } catch (error) {
      console.error('BossChat API error:', error);
      const bossReply: ChatMessage = {
        id: `boss_${Date.now()}`,
        sender: 'boss',
        content: '哎呀，网络有点问题，稍后再试一下吧！',
        timestamp: new Date(),
        status: 'read',
      };
      setMessages(prev => [...prev, bossReply]);
      setMessages(prev =>
        prev.map(m =>
          m.id === userMessage.id ? { ...m, status: 'read' } : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, isTyping, messages]);

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      handleSend(dataUrl);
    };
    reader.readAsDataURL(file);
    if (e.target) e.target.value = '';
  }, [handleSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 拖拽上传图片
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    // 读取拖入的图片：统一转为 data URL 再发送
    const readAndSend = (blob: Blob) => {
      const reader = new FileReader();
      reader.onload = () => handleSend(reader.result as string);
      reader.readAsDataURL(blob);
    };

    // 方式1：通过 DataTransferItem 获取文件（最可靠，支持文件系统拖拽）
    const items = e.dataTransfer.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].kind === 'file') {
          const f = items[i].getAsFile();
          if (f) { readAndSend(f); return; }
        }
      }
    }

    // 方式2：直接从 files 获取
    const file = e.dataTransfer.files?.[0];
    if (file) { readAndSend(file); return; }

    // 方式3：从 text/uri-list 或 text/plain 提取 URL
    // 注意：生图列 onDragStart 手动设置了 text/uri-list 和 text/plain，
    // 所以 files/items 中不会有文件数据，只能通过 URL 获取
    const uri = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    if (!uri) return;

    // blob URL → fetch 转为 data URL
    if (uri.startsWith('blob:')) {
      fetch(uri).then(r => r.blob()).then(readAndSend).catch(() => {});
      return;
    }

    // data URL → 直接发送
    if (uri.startsWith('data:')) {
      handleSend(uri);
      return;
    }

    // http/https URL → 直接发送给 API，API 可以访问
    if (/^https?:\/\//.test(uri)) {
      handleSend(uri);
      return;
    }
  }, [handleSend]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="fixed top-12 right-4 z-[150]" style={{ transform: 'scale(0.75)', transformOrigin: 'top right' }}>
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="w-14 h-14 rounded-[6px] bg-[#1AAD19] flex items-center justify-center shadow-xl hover:shadow-2xl transition-shadow"
        >
          <img src={BOSS_AVATAR} alt="张老板" className="w-11 h-11 rounded-[6px] object-cover" />
        </button>
      ) : (
        <div 
          className="relative bg-[#000000] rounded-[40px] shadow-2xl overflow-hidden"
          style={{ 
            width: '340px', 
            height: '700px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 0 0 3px rgba(255,255,255,0.1)',
          }}
        >
          <div 
            className="bg-white rounded-[35px] overflow-hidden h-full flex flex-col"
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="h-[27px] bg-black flex items-center justify-between px-6">
              <span className="text-white text-[15px] font-medium">9:41</span>
              <div className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                </svg>
                <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/>
                </svg>
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17 5H7c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-5 12c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm1-9H8v1h5V8z"/>
                </svg>
              </div>
            </div>
            <div className="h-[44px] bg-[#f7f7f7] flex items-center px-4 border-b border-[#e5e5e5]">
              <button
                className="w-10 h-10 flex items-center justify-center text-[#333333] rounded-[50%]"
              >
                <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <div className="flex-1 text-center">
                <p className="text-[17px] font-normal text-[#333333]">{BOSS_NAME}</p>
              </div>
              <button className="w-10 h-10 flex items-center justify-center text-[#333333] hover:bg-[#e5e5e5] rounded-[50%] transition-colors">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <circle cx="12" cy="5" r="1" />
                  <circle cx="12" cy="19" r="1" />
                  <circle cx="5" cy="12" r="1" />
                  <circle cx="19" cy="12" r="1" />
                  <circle cx="5" cy="5" r="0.5" />
                  <circle cx="19" cy="5" r="0.5" />
                  <circle cx="5" cy="19" r="0.5" />
                  <circle cx="19" cy="19" r="0.5" />
                </svg>
              </button>
            </div>

            <div
              className={`bg-[#EDEDED] p-4 flex-1 overflow-y-auto relative ${dragOver ? 'ring-2 ring-[#1AAD19] ring-inset' : ''} [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden`}
            >
              {/* 拖拽上传遮罩 */}
              {dragOver && (
                <div className="absolute inset-0 z-10 bg-[#1AAD19]/10 flex items-center justify-center pointer-events-none">
                  <div className="bg-white rounded-2xl px-6 py-4 shadow-lg text-center">
                    <svg className="w-8 h-8 text-[#1AAD19] mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="17 8 12 3 7 8"/>
                      <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    <p className="text-[13px] text-[#1AAD19] font-medium">拖入图片发送给老板</p>
                  </div>
                </div>
              )}
              <div className="text-center text-[11px] text-[#888888] my-3">今天 {new Date().toLocaleDateString('zh-CN')}</div>
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex items-start gap-3 mb-4 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  <img
                    src={msg.sender === 'boss' ? BOSS_AVATAR : USER_AVATAR}
                    alt={msg.sender === 'boss' ? BOSS_NAME : '我'}
                    className="w-[40px] h-[40px] rounded-[6px] object-cover flex-shrink-0"
                  />
                  <div className={`max-w-[70%] ${msg.sender === 'user' ? 'flex flex-col items-end' : ''}`}>
                    <div
                      className={`relative px-4 py-3 text-[16px] leading-[1.4] ${
                        msg.sender === 'boss'
                          ? 'bg-white text-[#333333]'
                          : 'bg-[#1AAD19] text-white'
                      }`}
                      style={{
                        borderRadius: msg.sender === 'boss' ? '0 12px 12px 12px' : '12px 0 12px 12px',
                        boxShadow: msg.sender === 'boss' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                      }}
                    >
                      {msg.imageUrl ? (
                        <img src={msg.imageUrl} alt="发送的图片" className="max-w-full rounded-lg" style={{ maxHeight: '200px' }} />
                      ) : null}
                      {msg.content}
                      <div
                        className={`absolute top-3 w-0 h-0 border-[6px] border-transparent ${
                          msg.sender === 'boss'
                            ? 'left-[-12px] border-right-[6px] border-right-white'
                            : 'right-[-12px] border-left-[6px] border-left-[#1AAD19]'
                        }`}
                      />
                    </div>
                    <div className={`flex items-center gap-1.5 mt-1.5 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>
                      <span className="text-[11px] text-[#888888]">
                        {formatTime(msg.timestamp)}
                      </span>
                      {msg.sender === 'user' && (
                        <svg
                          className={`w-[13px] h-[11px] ${msg.status === 'read' ? 'text-[#1AAD19]' : 'text-[#c7c7c7]'}`}
                          viewBox="0 0 52 40"
                          fill="currentColor"
                        >
                          <path d="M46.984 4.528a12.65 12.65 0 0 0-17.888 0L26 7.05l-3.096-2.522a12.65 12.65 0 0 0-17.888 0 12.824 12.824 0 0 0 0 18.144l20.976 17.008a1.6 1.6 0 0 0 2.048 0l20.976-17.008a12.824 12.824 0 0 0 0-18.144z" />
                        </svg>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {!isTyping && (
            <>
            <div className="bg-[#f7f7f7] px-3 py-2 flex items-end gap-1" onDrop={e => e.preventDefault()}>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageSelect}
              />
              <button
                onClick={() => imageInputRef.current?.click()}
                className="w-[44px] h-[44px] flex items-center justify-center text-[#888888] hover:bg-[#e5e5e5] rounded-[50%] transition-colors"
              >
                <svg className="w-[24px] h-[24px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
              </button>
              <div className="flex-1">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="发送消息..."
                  className="w-full bg-[#e5e5e5] border-none rounded-[6px] px-4 py-2 text-[16px] text-[#333333] placeholder:text-[#999999] focus:outline-none"
                />
              </div>
              <button
                onClick={handleSend}
                disabled={!inputValue.trim()}
                className={`w-[44px] h-[44px] flex items-center justify-center rounded-[50%] transition-colors ${
                  inputValue.trim()
                    ? 'bg-[#1AAD19] text-white hover:bg-[#169616]'
                    : 'bg-[#e5e5e5] text-[#cccccc]'
                }`}
              >
                <Send className="w-[20px] h-[20px]" />
              </button>
            </div>

            <div className="h-[18px] bg-[#f7f7f7] flex items-center justify-center">
              <div className="w-[130px] h-[3px] bg-[#d1d1d1] rounded-full" />
            </div>
            </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}