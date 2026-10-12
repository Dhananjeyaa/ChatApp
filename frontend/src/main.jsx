import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Initialize Theme & Wallpaper from localStorage immediately upon app load
(() => {
  const savedTheme = localStorage.getItem('chat_theme') || 'light';
  if (savedTheme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }

  const savedWallpaper = localStorage.getItem('chat_wallpaper') || 'classic';
  const wallpaperColors = {
    classic: '#efeae2',
    'dark-doodle': '#0b141a',
    sage: '#d1e7dd',
    sky: '#cfe2ff',
    slate: '#e2e3e5',
    rose: '#f8d7da',
    teal: '#12393d',
  };
  const color = wallpaperColors[savedWallpaper] || (savedTheme === 'dark' ? '#0b141a' : '#efeae2');
  document.documentElement.style.setProperty('--chat-wallpaper-color', color);
})();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
