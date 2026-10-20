import { createRoot } from 'react-dom/client';
import App from '../frontend/src/App.tsx';
import { AuthProvider } from '../frontend/src/context/AuthContext.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <App />
  </AuthProvider>
);
