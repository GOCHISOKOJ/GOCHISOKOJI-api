import React from 'react';
import { BottomNav } from '@/components/BottomNav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BottomNav />
      {children}
    </>
  );
}


