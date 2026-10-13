import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// In preview iframe, HMR WebSocket is disabled and can throw unhandled rejection.
// Ignore WebSocket closure errors per environment guidelines.
window.addEventListener('unhandledrejection', (event) => {
  if (
    event.reason?.message?.includes('WebSocket closed') ||
    event.reason?.message?.includes('failed to connect to websocket') ||
    String(event.reason).includes('WebSocket')
  ) {
    event.preventDefault();
  }
});

createRoot(document.getElementById('root')!).render(<App />);
