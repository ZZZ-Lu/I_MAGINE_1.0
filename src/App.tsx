import React, { useState, useCallback, useRef, useMemo } from 'react';
import GenerationColumns from './components/GenerationColumns';
import Playground from './components/Playground';
import FloatingAgentInput from './components/FloatingAgentInput';
import { AgentActionsProvider, ColumnInfo } from './services/AgentContext';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 20, fontFamily: 'monospace', fontSize: 14 }}>
          <h2 style={{ color: '#ff3b30' }}>渲染错误</h2>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#333' }}>{this.state.error.message}</pre>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#666', fontSize: 12, marginTop: 8 }}>{this.state.error.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [page, setPage] = useState<'home' | 'sandbox'>('home');
  const pageRef = useRef(page);
  pageRef.current = page;

  // 这些 ref 由 GenerationColumns 在 mount 时填充
  const genColumnsRef = useRef<{
    addColumn: () => void;
    removeColumn: (id: string) => void;
    updateColumn: (id: string, patch: Record<string, unknown>) => void;
    getColumns: () => ColumnInfo[];
    generateImage: (id: string) => void;
    deleteImage: (colId: string, imageIndex: number) => void;
    toggleFavorite: (colId: string, imageIndex: number) => void;
    abortGenerate: (colId: string) => void;
    addRefImage: (colId: string, url: string) => Promise<string>;
    removeRefImage: (colId: string, index: number) => void;
    loadPresetRefImages: (colId: string) => Promise<string>;
    useResultAsRef: (colId: string, imageIndex: number) => Promise<string>;
    downloadImage: (colId: string, imageIndex: number) => void;
    retryImage: (colId: string, imageIndex: number) => void;
    clearErrorCards: (colId: string) => void;
    clearColumnConfig: (colId: string) => void;
    applyCardConfig: (colId: string, imageIndex: number) => void;
    createColumnAtStart: () => void;
    createColumnAt: (afterIndex: number) => void;
    addToGallery: (url: string, name?: string) => void;
    clearGallery: () => void;
    addImageToGallery: (url: string) => void;
    getGalleryImages: () => { url: string; name: string }[];
    addGalleryRef: (galleryIndex: number, columnIndex: number) => Promise<string>;
  }>({
    addColumn: () => {},
    removeColumn: () => {},
    updateColumn: () => {},
    getColumns: () => [],
    generateImage: () => {},
    deleteImage: () => {},
    toggleFavorite: () => {},
    abortGenerate: () => {},
    addRefImage: async () => '',
    removeRefImage: () => {},
    loadPresetRefImages: async () => '',
    useResultAsRef: async () => '',
    downloadImage: () => {},
    retryImage: () => {},
    clearErrorCards: () => {},
    clearColumnConfig: () => {},
    applyCardConfig: () => {},
    createColumnAtStart: () => {},
    createColumnAt: () => {},
    addToGallery: () => {},
    clearGallery: () => {},
    addImageToGallery: () => {},
    getGalleryImages: () => [],
    addGalleryRef: async () => '',
  });

  const agentActions = useMemo(() => ({
    getColumns: () => genColumnsRef.current.getColumns(),
    addColumn: () => genColumnsRef.current.addColumn(),
    removeColumn: (id: string) => genColumnsRef.current.removeColumn(id),
    updateColumn: (id: string, patch: Record<string, unknown>) => genColumnsRef.current.updateColumn(id, patch),
    generateImage: (id: string) => genColumnsRef.current.generateImage(id),
    getPage: () => pageRef.current,
    setPage: (p: 'home' | 'sandbox') => setPage(p),
    deleteImage: (colId: string, imageIndex: number) => genColumnsRef.current.deleteImage(colId, imageIndex),
    toggleFavorite: (colId: string, imageIndex: number) => genColumnsRef.current.toggleFavorite(colId, imageIndex),
    abortGenerate: (colId: string) => genColumnsRef.current.abortGenerate(colId),
    addRefImage: (colId: string, url: string) => genColumnsRef.current.addRefImage(colId, url),
    removeRefImage: (colId: string, index: number) => genColumnsRef.current.removeRefImage(colId, index),
    loadPresetRefImages: (colId: string) => genColumnsRef.current.loadPresetRefImages(colId),
    useResultAsRef: (colId: string, imageIndex: number) => genColumnsRef.current.useResultAsRef(colId, imageIndex),
    downloadImage: (colId: string, imageIndex: number) => genColumnsRef.current.downloadImage(colId, imageIndex),
    retryImage: (colId: string, imageIndex: number) => genColumnsRef.current.retryImage(colId, imageIndex),
    clearErrorCards: (colId: string) => genColumnsRef.current.clearErrorCards(colId),
    clearColumnConfig: (colId: string) => genColumnsRef.current.clearColumnConfig(colId),
    applyCardConfig: (colId: string, imageIndex: number) => genColumnsRef.current.applyCardConfig(colId, imageIndex),
    createColumnAtStart: () => genColumnsRef.current.createColumnAtStart(),
    createColumnAt: (afterIndex: number) => genColumnsRef.current.createColumnAt(afterIndex),
    addToGallery: (url: string, name?: string) => genColumnsRef.current.addToGallery(url, name),
    clearGallery: () => genColumnsRef.current.clearGallery(),
    addImageToGallery: (url: string) => genColumnsRef.current.addImageToGallery(url),
    getGalleryImages: () => genColumnsRef.current.getGalleryImages ? genColumnsRef.current.getGalleryImages() : [],
    addGalleryRef: (galleryIndex: number, columnIndex: number) => genColumnsRef.current.addGalleryRef ? genColumnsRef.current.addGalleryRef(galleryIndex, columnIndex) : Promise.resolve(''),
  }), []);

  return (
    <ErrorBoundary>
    <AgentActionsProvider actions={agentActions}>
      {page === 'sandbox' ? (
        <Playground onBack={() => setPage('home')} />
      ) : (
        <GenerationColumns
          onOpenSandbox={() => setPage('sandbox')}
          agentActionsRef={genColumnsRef}
        />
      )}
      <FloatingAgentInput />
    </AgentActionsProvider>
    </ErrorBoundary>
  );
}
