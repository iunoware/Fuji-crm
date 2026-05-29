"use client"

import React from 'react';
import { AuthProvider } from '@/context/AuthContext';
import AppWrapper from '@/components/layout/AppWrapper';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AppWrapper>
        {children}
      </AppWrapper>
    </AuthProvider>
  );
}
