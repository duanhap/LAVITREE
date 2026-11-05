import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Be Vietnam Pro local font weights (400, 500, 600, 700 per ui-ux.md mục 3)
import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/500.css';
import '@fontsource/be-vietnam-pro/600.css';
import '@fontsource/be-vietnam-pro/700.css';

// Design tokens & Tailwind v4
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
