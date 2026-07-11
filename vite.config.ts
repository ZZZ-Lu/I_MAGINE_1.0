import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // 项目使用 tsx + middlewareMode 启动，HMR 与之冲突会占用 24678 端口并频繁重连，
      // 导致输入框光标/状态异常。直接关闭 HMR，改代码手动刷新即可。
      // watch 保持开启，让 Vite 监听文件变化并自动失效编译缓存，刷新即可拿到新代码。
      hmr: false,
    },
  };
});
