"use client";
import React from 'react';
import { usePathname } from 'next/navigation';
import { TopHeader } from './TopHeader';

export const AppHeader: React.FC = () => {
  const pathname = usePathname();
  // Hide global ticker/profile on the login (home) page
  if (pathname === '/') return null;
  return <TopHeader />;
};


