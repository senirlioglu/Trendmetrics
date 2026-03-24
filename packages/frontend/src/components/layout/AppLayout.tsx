import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import LoadingState from '@/components/common/LoadingState';
import { useAuthStore } from '@/stores/authStore';

export default function AppLayout() {
  const { loading, initialize } = useAuthStore();

  useEffect(() => {
    const unsubscribe = initialize();
    return unsubscribe;
  }, [initialize]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <LoadingState message="Initializing TrendMetrics..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <Navbar />
      <main>
        <Outlet />
      </main>
    </div>
  );
}
