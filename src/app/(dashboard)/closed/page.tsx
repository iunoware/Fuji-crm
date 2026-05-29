"use client"

import { Search, Bell } from 'lucide-react';
import Link from 'next/link';

export default function Closed() {
  return (
    <main className="flex-1 block h-screen overflow-y-auto overflow-x-hidden bg-brand-bg">
      {/* Topbar */}
      <header className="flex items-center justify-between h-[72px] px-6 bg-white border-b border-[#e5e7eb] sticky top-0 z-50 shrink-0 max-[768px]:pl-[70px] max-[768px]:justify-end">
        <div className="flex items-center gap-2.5 w-[400px] text-gray-400 bg-[#f9f8fc] border border-[#e5e4e7] rounded-lg px-3.5 py-2.5 max-[768px]:hidden">
          <Search size={18} />
          <input type="text" placeholder="Search closed items..." className="border-none bg-transparent outline-none flex-1 text-sm text-brand-text" />
        </div>
        <div className="flex items-center gap-3">
          <Link href="/remainder" className="text-gray-500 relative flex items-center justify-center p-2 rounded-lg border border-[#e5e7eb] bg-white hover:bg-gray-50 transition-colors">
            <Bell size={20} className="text-gray-600" />
          </Link>
        </div>
      </header>

      {/* Header section */}
      <div className="px-6 py-6 pb-2">
        <h1 className="text-3xl font-extrabold m-0 tracking-tight text-gray-900">Closed Records</h1>
        <p className="text-sm text-gray-500 m-0 mt-1">All closed entries are tracked here. This page is independent and does not route into other modules.</p>
      </div>

      {/* Placeholder Grid */}
      <div className="px-6 py-4">
        <div className="bg-white p-6 rounded-xl border border-[#e5e7eb] shadow-sm">
          <p className="text-sm text-gray-550 m-0">This section is reserved for closed module reporting.</p>
        </div>
      </div>
    </main>
  );
}
