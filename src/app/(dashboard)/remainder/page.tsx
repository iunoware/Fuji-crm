"use client";

import { Settings } from "lucide-react";

export default function Remainder() {
  return (
    <main className="flex-1 flex items-center justify-center bg-slate-55 h-screen p-4">
      <div className="bg-white p-12 rounded-2xl border border-slate-200/80 shadow-lg text-center max-w-md w-full">
        <div className="w-20 h-20 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
          <Settings size={40} className="" />
        </div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-3 tracking-tight">
          Module Under Construction
        </h1>
        <p className="text-sm text-gray-500 leading-relaxed m-0">
          The Reminders module is currently being built. Check back soon for intelligent
          notifications and schedule management!
        </p>
      </div>
    </main>
  );
}
