import React, { useState, useEffect, useCallback } from 'react';
import { X, Trash2, ChevronDown, ChevronRight, User, Bot, Wrench, Brain, Eye, FileText, ClipboardCheck } from 'lucide-react';
import { getLogs, clearLogs, subscribeLogs, LogRound, SubAgentRecord } from '../services/agentLogStore';
import type { AgentMessage } from '../services/agentService';

export default function AgentLogViewer({ onClose }: { onClose: () => void }) {
  const [logs, setLogs] = useState<LogRound[]>(getLogs);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const unsub = subscribeLogs(() => setLogs([...getLogs()]));
    return unsub;
  }, []);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const roleIcon = (role: string) => {
    switch (role) {
      case 'user': return <User className="w-3 h-3 text-blue-400" />;
      case 'assistant': return <Bot className="w-3 h-3 text-green-400" />;
      case 'tool': return <Wrench className="w-3 h-3 text-amber-400" />;
      default: return null;
    }
  };

  const roleLabel = (role: string) => {
    switch (role) {
      case 'user': return '用户';
      case 'assistant': return 'AI';
      case 'tool': return '工具';
      default: return role;
    }
  };

  const roleColor = (role: string) => {
    switch (role) {
      case 'user': return 'border-l-blue-400';
      case 'assistant': return 'border-l-green-400';
      case 'tool': return 'border-l-amber-400';
      default: return 'border-l-zinc-500';
    }
  };

  const subAgentIcon = (name: string) => {
    switch (name) {
      case 'IntentPlanner': return <Brain className="w-3 h-3 text-purple-500" />;
      case 'VisualAnalyst': return <Eye className="w-3 h-3 text-sky-500" />;
      case 'PromptArchitect': return <FileText className="w-3 h-3 text-orange-500" />;
      case 'ResultReviewer': return <ClipboardCheck className="w-3 h-3 text-emerald-500" />;
      default: return <Bot className="w-3 h-3 text-zinc-500" />;
    }
  };

  const subAgentColor = (name: string) => {
    switch (name) {
      case 'IntentPlanner': return 'border-l-purple-400 bg-purple-50/50';
      case 'VisualAnalyst': return 'border-l-sky-400 bg-sky-50/50';
      case 'PromptArchitect': return 'border-l-orange-400 bg-orange-50/50';
      case 'ResultReviewer': return 'border-l-emerald-400 bg-emerald-50/50';
      default: return 'border-l-zinc-400 bg-zinc-50/50';
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-[780px] max-h-[85vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e5e5e7] flex-shrink-0">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-[#4f39f6]" />
            <h3 className="text-[15px] font-semibold text-[#1d1d1f]">Agent 日志</h3>
            <span className="text-[11px] text-[#a1a1a6]">{logs.length} 条记录</span>
          </div>
          <div className="flex items-center gap-2">
            {logs.length > 0 && (
              <button
                onClick={() => {
                  clearLogs();
                  setLogs([]);
                  setExpandedIds(new Set());
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] text-[#ff3b30] hover:bg-[#fee2e2] transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                清空
              </button>
            )}
            <button onClick={onClose} className="text-[#86868b] hover:text-[#1d1d1f] p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {logs.length === 0 ? (
            <div className="text-center py-12 text-[#a1a1a6] text-sm">
              暂无日志。使用 Agent 进行对话后将显示在此处。
            </div>
          ) : (
            logs.map(log => {
              const isExpanded = expandedIds.has(log.id);
              return (
                <div key={log.id} className="border border-[#e5e5e7] rounded-xl overflow-hidden">
                  {/* Log Header */}
                  <button
                    onClick={() => toggleExpand(log.id)}
                    className="w-full flex items-center gap-2 px-4 py-2.5 bg-[#f9fafb] hover:bg-[#f1f5f9] transition-colors text-left"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-[#a1a1a6] flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-[#a1a1a6] flex-shrink-0" />
                    )}
                    <User className="w-3 h-3 text-[#a1a1a6] flex-shrink-0" />
                    <span className="flex-1 text-[12px] text-[#1d1d1f] truncate font-medium">
                      {log.userInput}
                    </span>
                    {log.subAgentOutputs && log.subAgentOutputs.length > 0 && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 flex-shrink-0 mr-2">
                        {log.subAgentOutputs.length} 子Agent
                      </span>
                    )}
                    <span className="text-[10px] text-[#a1a1a6] flex-shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </button>

                  {/* Expanded Messages */}
                  {isExpanded && (
                    <div className="divide-y divide-[#f0f0f2]">
                      {/* 子 Agent 输出 */}
                      {log.subAgentOutputs && log.subAgentOutputs.length > 0 && (
                        <div className="px-3 py-2 bg-[#fafafa] border-b border-[#f0f0f2]">
                          <div className="text-[10px] font-semibold text-[#a1a1a6] uppercase mb-2">
                            子 Agent 分析
                          </div>
                          <div className="space-y-1.5">
                            {log.subAgentOutputs.map((sa, i) => (
                              <div key={i} className={`pl-3 border-l-2 rounded ${subAgentColor(sa.name)}`}>
                                <div className="px-2.5 py-2">
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    {subAgentIcon(sa.name)}
                                    <span className="text-[10px] font-semibold text-[#52525b]">
                                      {sa.name}
                                    </span>
                                    <span className="text-[9px] text-[#a1a1a6]">{sa.prompt}</span>
                                  </div>
                                  <pre className="text-[11px] text-[#3f3f46] whitespace-pre-wrap leading-relaxed font-mono mt-1">
                                    {sa.output.length > 500 ? sa.output.slice(0, 500) + '\n...' : sa.output}
                                  </pre>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {log.messages.map((msg, idx) => (
                        <div key={idx} className={`pl-3 border-l-2 ${roleColor(msg.role)}`}>
                          <div className="px-3 py-2">
                            <div className="flex items-center gap-1.5 mb-1">
                              {roleIcon(msg.role)}
                              <span className="text-[10px] font-semibold text-[#a1a1a6] uppercase">
                                {roleLabel(msg.role)}
                              </span>
                              {msg.tool_calls && msg.tool_calls.length > 0 && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                                  {msg.tool_calls.map(tc => tc.function.name).join(', ')}
                                </span>
                              )}
                            </div>
                            <p className="text-[12px] text-[#1d1d1f] whitespace-pre-wrap leading-relaxed">
                              {msg.content}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
