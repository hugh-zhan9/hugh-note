import './styles/index.css';
import '@/site/site.css';
import Header from './components/Header';
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { ActivitiesProvider } from './contexts/ActivitiesContext';
import { LoadingSections } from '@/site/LoadingShell';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { resetActivityIndex } from '@/core/activityIndex';

const Index = lazy(() => import('./pages/index'));
const HomePage = lazy(() => import('./pages/total'));
const SummaryRoutePage = lazy(() => import('./pages/summary'));
const NotFound = lazy(() => import('./pages/404'));

function ClassicRoutes() {
  const story = /^\/summary\/\d{4}(?:\/|$)/.test(useLocation().pathname);
  return (
    <>
      {!story && <Header />}
      <ErrorBoundary onRetry={resetActivityIndex}>
        <Suspense fallback={<LoadingSections />}>
          <ActivitiesProvider>
            <Routes>
              <Route path="summary/:year" element={<SummaryRoutePage />} />
              <Route path="/" element={<Index />} />
              <Route path="summary" element={<HomePage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </ActivitiesProvider>
        </Suspense>
      </ErrorBoundary>
    </>
  );
}

export default function ClassicTheme() {
  return (
    <HelmetProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <ClassicRoutes />
      </BrowserRouter>
    </HelmetProvider>
  );
}
