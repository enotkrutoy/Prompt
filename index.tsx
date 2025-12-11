import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const RootComponent = () => {
  useEffect(() => {
    // Initialize Telegram Web App
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      
      // Notify Telegram that the app is ready
      tg.ready();
      
      // Expand to full height
      tg.expand();
      
      // Optional: Adapt colors based on Telegram theme
      // const themeParams = tg.themeParams;
      // if (themeParams) {
      //   document.body.style.backgroundColor = themeParams.bg_color || '#000000';
      //   document.body.style.color = themeParams.text_color || '#FFFFFF';
      // }
      
      // Handle viewport stability
      tg.enableClosingConfirmation();
    }
  }, []);

  return <App />;
};

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <RootComponent />
  </React.StrictMode>
);