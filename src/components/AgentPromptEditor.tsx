import React, { useState, useCallback } from 'react';
import { X, ChevronDown, ChevronRight, Save, Edit3, Bot, Brain, Image as ImageIcon, FileText, CheckCircle } from 'lucide-react';
import {
  ORCHESTRATOR_PROMPT,
  INTENT_PLANNER_PROMPT,
  VISUAL_ANALYST_PROMPT,
  PROMPT_ARCHITECT_PROMPT,
  RESULT_REVIEWER_PROMPT,
  setOrchestratorPrompt,
  setIntentPlannerPrompt,
  setVisualAnalystPrompt,
  setPromptArchitectPrompt,
  setResultReviewerPrompt,
} from '../services/agentService';

interface PromptEntry {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  getValue: () => string;
  setValue: (v: string) => void;
}

export default function AgentPromptEditor({ onClose }: { onClose: () => void }) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(['orchestrator']));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [savedId, setSavedId] = useState<string | null>(null);

  const prompts: PromptEntry[] = [
    {
      key: 'orchestrator',
      label: 'Orchestrator（主 Agent）',
      description: '与用户直接对话的主提示词，负责调度工具和子 Agent',
      icon: <Bot className="w-4 h-4 text-violet-500" />,
      getValue: () => ORCHESTRATOR_PROMPT,
      setValue: (v: string) => { setOrchestratorPrompt(v); },
    },
    {
      key: 'intent_planner',
      label: 'IntentPlanner（意图规划）',
      description: '判断用户意图、目标列、信息是否足够',
      icon: <Brain className="w-4 h-4 text-blue-500" />,
      getValue: () => INTENT_PLANNER_PROMPT,
      setValue: (v: string) => { setIntentPlannerPrompt(v); },
    },
    {
      key: 'visual_analyst',
      label: 'VisualAnalyst（视觉分析）',
      description: '分析参考图/结果图的视觉特征',
      icon: <ImageIcon className="w-4 h-4 text-green-500" />,
      getValue: () => VISUAL_ANALYST_PROMPT,
      setValue: (v: string) => { setVisualAnalystPrompt(v); },
    },
    {
      key: 'prompt_architect',
      label: 'PromptArchitect（提示词撰写）',
      description: '撰写高质量生图提示词',
      icon: <FileText className="w-4 h-4 text-amber-500" />,
      getValue: () => PROMPT_ARCHITECT_PROMPT,
      setValue: (v: string) => { setPromptArchitectPrompt(v); },
    },
    {
      key: 'result_reviewer',
      label: 'ResultReviewer（结果复核）',
      description: '复核生成结果是否满足需求',
      icon: <CheckCircle className="w-4 h-4 text-emerald-500" />,
      getValue: () => RESULT_REVIEWER_PROMPT,
      setValue: (v: string) => { setResultReviewerPrompt(v); },
    },
  ];

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const startEditing = useCallback((id: string) => {
    const entry = prompts.find(p => p.key === id);
    if (entry) {
      setEditValues(prev => ({ ...prev, [id]: entry.getValue() }));
      setEditingId(id);
    }
  }, []);

  const cancelEditing = useCallback((id: string) => {
    setEditingId(prev => prev === id ? null : prev);
    setEditValues(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const savePrompt = useCallback((id: string) => {
    const entry = prompts.find(p => p.key === id);
    const value = editValues[id];
    if (entry && value !== undefined) {
      entry.setValue(value);
      setEditingId(null);
      setSavedId(id);
      setTimeout(() => setSavedId(null), 1500);
    }
  }, [editValues]);

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-[820px] max-h-[85vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e5e5e7] flex-shrink-0">
          <div className="flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-[#4f39f6]" />
            <h3 className="text-[15px] font-semibold text-[#1d1d1f]">Agent 提示词编辑</h3>
            <span className="text-[11px] text-[#a1a1a6]">{prompts.length} 段提示词</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="text-[#86868b] hover:text-[#1d1d1f] p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="text-[12px] text-[#a1a1a6] mb-2 px-1">
            编辑后保存将立即更新到 Agent 对话中，下次对话生效。
          </div>
          {prompts.map(entry => {
            const isExpanded = expandedIds.has(entry.key);
            const isEditing = editingId === entry.key;
            const isSaved = savedId === entry.key;
            const currentValue = isEditing ? editValues[entry.key] : entry.getValue();

            return (
              <div key={entry.key} className="border border-[#e5e5e7] rounded-xl overflow-hidden">
                {/* Header */}
                <button
                  onClick={() => toggleExpand(entry.key)}
                  className="w-full flex items-center gap-2 px-4 py-2.5 bg-[#f9fafb] hover:bg-[#f1f5f9] transition-colors text-left"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-[#a1a1a6] flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-[#a1a1a6] flex-shrink-0" />
                  )}
                  {entry.icon}
                  <span className="flex-1 min-w-0">
                    <span className="text-[12px] text-[#1d1d1f] font-medium">{entry.label}</span>
                    {!isExpanded && (
                      <span className="text-[11px] text-[#a1a1a6] ml-2">
                        {currentValue.slice(0, 60).replace(/\n/g, ' ')}...
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] text-[#a1a1a6] flex-shrink-0">
                    {currentValue.length} 字
                  </span>
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="px-4 py-3 space-y-2">
                    <div className="text-[11px] text-[#86868b]">{entry.description}</div>

                    {isEditing ? (
                      <textarea
                        value={editValues[entry.key] || ''}
                        onChange={(e) => setEditValues(prev => ({ ...prev, [entry.key]: e.target.value }))}
                        className="w-full h-[200px] bg-[#f8f9fa] border border-[#e5e5e7] rounded-lg p-3 text-[12px] text-[#1d1d1f] font-mono leading-relaxed focus:outline-none focus:border-[#4f39f6] resize-y"
                        spellCheck={false}
                      />
                    ) : (
                      <div className="w-full max-h-[200px] overflow-y-auto bg-[#f8f9fa] rounded-lg p-3 text-[12px] text-[#1d1d1f] font-mono leading-relaxed whitespace-pre-wrap">
                        {currentValue}
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => cancelEditing(entry.key)}
                            className="px-3 py-1.5 rounded-lg text-[11px] text-[#86868b] bg-[#f1f5f9] hover:bg-[#e5e5e7] transition-colors"
                          >
                            取消
                          </button>
                          <button
                            onClick={() => savePrompt(entry.key)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] text-white bg-[#4f39f6] hover:bg-[#4338ca] transition-colors"
                          >
                            {isSaved ? (
                              <CheckCircle className="w-3 h-3" />
                            ) : (
                              <Save className="w-3 h-3" />
                            )}
                            {isSaved ? '已保存' : '保存'}
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => startEditing(entry.key)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] text-[#4f39f6] bg-[#f0edff] hover:bg-[#e0dbff] transition-colors"
                        >
                          <Edit3 className="w-3 h-3" />
                          编辑
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
