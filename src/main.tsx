import './pre-init';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress harmless Vite WebSocket HMR disconnection errors
window.addEventListener('unhandledrejection', (event) => {
  if (
    event.reason &&
    (event.reason.message === 'WebSocket closed without opened.' ||
     event.reason.toString().includes('WebSocket'))
  ) {
    event.preventDefault(); // Prevent logging as an unhandled crash
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

