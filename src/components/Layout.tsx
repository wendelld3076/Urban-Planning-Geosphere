import React from 'react';
import { useDeviceType } from '../hooks/useDeviceType';

export interface LayoutProps {
  children: React.ReactNode;
  sidebarTheme?: 'light' | 'dark';
}

export function Layout({ children, sidebarTheme = 'dark' }: LayoutProps) {
  const { isTablet, isMobile, width } = useDeviceType();
  const isCompactLayout = isTablet || isMobile || width < 1024;

  return (
    <div
      id="app-layout-container"
      data-device-compact={isCompactLayout}
      className={`w-full h-screen flex overflow-hidden font-sans antialiased relative ${
        sidebarTheme === 'light' ? 'bg-slate-100 text-slate-900' : 'bg-[#05070a] text-slate-100'
      }`}
    >
      {children}
    </div>
  );
}

export default Layout;
