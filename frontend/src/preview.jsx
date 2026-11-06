import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './styles/teal-tokens.css';
import './styles/premium-dashboard.css';
import RedesignPreview from './components/preview/RedesignPreview';

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <StrictMode>
      <RedesignPreview />
    </StrictMode>
  );
}
