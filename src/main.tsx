import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { useLabStore } from './store/useLabStore';
import './index.css';

window.addEventListener('error', (e) => {
  const stack = e.error?.stack ? String(e.error.stack).slice(0, 500) : '';
  document.title = 'ERR: ' + String(e.message).slice(0, 120) + ' @@ ' + stack.replace(/\n/g, ' ~ ');
});
window.addEventListener('unhandledrejection', (e) => {
  document.title = 'REJ: ' + String(e.reason).slice(0, 300);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// 测试钩子：供自动化验收驱动（等价于 Redux DevTools 的 window.__store）
(window as unknown as Record<string, unknown>).__lab = useLabStore;
