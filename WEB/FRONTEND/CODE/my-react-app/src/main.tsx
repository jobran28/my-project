import React from 'react'; // ✅ This fixes the error
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(    <App />
);
