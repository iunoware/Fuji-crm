"use client"

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Sidebar from '@/components/layout/Sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { currentUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !currentUser) {
      router.push('/login');
    }
  }, [currentUser, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-brand-bg">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-brand-red"></div>
      </div>
    );
  }

  if (!currentUser) return null;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-brand-bg">
      {/* Sidebar is rendered inside the layout */}
      <Sidebar />
      {/* Pages render main-content wrapper inside */}
      {children}
    </div>
  );
}
