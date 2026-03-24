import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import LoadingState from '@/components/common/LoadingState';
import { lazy, Suspense } from 'react';

const Landing = lazy(() => import('@/pages/Landing'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const TopUp = lazy(() => import('@/pages/TopUp'));
const Reports = lazy(() => import('@/pages/Reports'));
const TrendCompare = lazy(() => import('@/pages/TrendCompare'));

function PageLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <LoadingState message="Loading page..." />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Landing />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/topup" element={<TopUp />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/compare" element={<TrendCompare />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
