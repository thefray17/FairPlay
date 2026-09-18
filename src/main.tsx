import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {Root} from './Root.tsx';
import {ErrorBoundary} from './components/common/ErrorBoundary';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary fallbackTitle="FairPlay Club Session">
      <Root />
    </ErrorBoundary>
  </StrictMode>,
);

