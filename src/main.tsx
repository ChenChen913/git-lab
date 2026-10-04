import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { useLabStore } from './store/useLabStore';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// 测试钩子：供自动化验收驱动（等价于 Redux DevTools 的 window.__store）
(window as unknown as Record<string, unknown>).__lab = useLabStore;
