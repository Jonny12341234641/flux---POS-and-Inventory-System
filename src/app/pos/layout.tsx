'use client';

import { useState, type ReactNode } from 'react';

import PosHeader from '../../components/pos/PosHeader';
import PosSidebar from '../../components/pos/PosSidebar';

export default function PosLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const handleCloseSidebar = () => setIsSidebarOpen(false);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-slate-950 text-slate-100 [height:100dvh]">
      <PosHeader
        onOpenSidebar={() => setIsSidebarOpen(true)}
        className="fixed inset-x-0 top-0 z-30"
      />
      <PosSidebar isOpen={isSidebarOpen} onClose={handleCloseSidebar} />
      {isSidebarOpen ? (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-x-0 bottom-0 top-14 z-40 bg-slate-900/40 md:hidden"
          onClick={handleCloseSidebar}
        />
      ) : null}
      <div className="flex h-full flex-col pt-14 md:pl-64">
        <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          <div className="px-4 py-6 md:px-6">{children}</div>
        </main>
      </div>
    </div>
  );
}