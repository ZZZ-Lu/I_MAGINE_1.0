import React, { createContext, useContext, useCallback, useRef } from 'react';

// 列内单张图片的完整信息
export interface ResultItemInfo {
  id: string;
  prompt: string;
  model: string;
  aspectRatio: string;
  resolution: string;
  quality: string;
  imageUrl?: string;
  errorMessage?: string;
  favorited: boolean;
  downloaded: boolean;
  refImages: string[];
}

// 列配置（完整版）
export interface ColumnInfo {
  id: string;
  name: string;
  model: string;
  aspectRatio: string;
  resolution: string;
  quality: string;
  prompt: string;
  refImages: string[];
  isGenerating: boolean;
  resultCount: number;
  selected: string[];
  results: ResultItemInfo[];
}

export interface AgentActions {
  /** 获取当前所有列的快照 */
  getColumns: () => ColumnInfo[];
  /** 在末尾新建一列 */
  addColumn: () => void;
  /** 删除指定列 */
  removeColumn: (id: string) => void;
  /** 更新列配置 */
  updateColumn: (id: string, patch: Record<string, unknown>) => void;
  /** 触发生成 */
  generateImage: (id: string) => void;
  /** 获取当前页面 */
  getPage: () => string;
  /** 切换页面 */
  setPage: (page: 'home' | 'sandbox') => void;
  /** 删除指定列中指定索引的图片 */
  deleteImage: (colId: string, imageIndex: number) => void;
  /** 收藏/取消收藏指定列中指定索引的图片 */
  toggleFavorite: (colId: string, imageIndex: number) => void;
  /** 中止指定列的所有生成中任务 */
  abortGenerate: (colId: string) => void;
  /** 从 URL 添加参考图 */
  addRefImage: (colId: string, url: string) => Promise<string>;
  /** 删除指定索引的参考图 */
  removeRefImage: (colId: string, index: number) => void;
  /** 加载预设参考图 */
  loadPresetRefImages: (colId: string) => Promise<string>;
  /** 将结果图作为参考图 */
  useResultAsRef: (colId: string, imageIndex: number) => Promise<string>;
  /** 下载结果图 */
  downloadImage: (colId: string, imageIndex: number) => void;
  /** 重试失败生成 */
  retryImage: (colId: string, imageIndex: number) => void;
  /** 清除列中所有报错卡片 */
  clearErrorCards: (colId: string) => void;
  /** 清空列配置（提示词+参考图） */
  clearColumnConfig: (colId: string) => void;
  /** 将结果卡片的配置应用到列 */
  applyCardConfig: (colId: string, imageIndex: number) => void;
  /** 在首部插入列 */
  createColumnAtStart: () => void;
  /** 在指定索引后插入列 */
  createColumnAt: (afterIndex: number) => void;
  /** 将图片 URL 添加到素材参考图面板 */
  addToGallery: (url: string, name?: string, origin?: string) => void;
  /** 清空素材参考图面板 */
  clearGallery: () => void;
  /** 获取暂存区图片列表 */
  getGalleryImages: () => { url: string; name: string; origin?: string }[];
  /** 将暂存区图片添加到指定列作为参考图 */
  addGalleryRef: (galleryIndex: number, columnIndex: number) => Promise<string>;
}

const AgentActionsContext = createContext<AgentActions | null>(null);

export function useAgentActions(): AgentActions {
  const ctx = useContext(AgentActionsContext);
  if (!ctx) throw new Error('useAgentActions must be used within AgentActionsProvider');
  return ctx;
}

export function AgentActionsProvider({
  children,
  actions,
}: {
  children: React.ReactNode;
  actions: AgentActions;
}) {
  return (
    <AgentActionsContext.Provider value={actions}>
      {children}
    </AgentActionsContext.Provider>
  );
}
