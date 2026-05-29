"use client"

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Rocket, ArrowLeft, Sparkles, Cpu } from "lucide-react";
import Link from 'next/link';

function ComingSoonContent() {
  const searchParams = useSearchParams();
  const moduleName = searchParams.get('module') || "This feature";

  return (
    <div className="text-center bg-white p-12 rounded-3xl shadow-xl max-w-lg w-full relative overflow-hidden border border-slate-200">
      {/* Decorative abstract shapes */}
      <div className="absolute top-[-30px] left-[-30px] text-[#fef2f2] z-0 -rotate-12">
        <Cpu size={120} />
      </div>
      <div className="absolute bottom-5 right-[-20px] text-[#fff1f2] z-0">
        <Sparkles size={80} />
      </div>

      <div className="relative z-10">
        {/* Glowing Rocket Icon */}
        <div className="w-20 h-20 bg-red-50 text-brand-red rounded-full flex items-center justify-center mx-auto mb-6 shadow-md shadow-red-100">
          <Rocket size={40} />
        </div>

        <h1 className="text-3xl font-black text-gray-900 mb-3 tracking-tight">
          Launching Soon!
        </h1>

        <p className="text-sm text-gray-600 leading-relaxed mb-8">
          We are currently handcrafting the <strong className="text-gray-900 font-bold">{moduleName}</strong> module. 
          It will be packed with powerful tools to boost your workflow and will be available in our next major update!
        </p>

        <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200/50">
          <Link 
            href="/" 
            className="flex items-center gap-2 bg-white text-gray-700 hover:text-gray-950 px-6 py-3 rounded-lg no-underline font-semibold transition-colors border border-gray-250/60 shadow-sm"
          >
            <ArrowLeft size={18} /> Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ComingSoon() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center h-screen bg-slate-100 p-4">
      <Suspense fallback={
        <div className="text-center bg-white p-12 rounded-3xl shadow-xl max-w-lg w-full border border-slate-250 flex items-center justify-center">
          <LoaderFallback />
        </div>
      }>
        <ComingSoonContent />
      </Suspense>
      <span className="mt-6 text-xs text-gray-400 font-medium">
        Fuji Solar • Command Center v1.0
      </span>
    </main>
  );
}

function LoaderFallback() {
  return (
    <div className="flex flex-col items-center justify-center py-6">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-red"></div>
      <span className="mt-3 text-xs text-gray-500 font-semibold">Loading Module Details...</span>
    </div>
  );
}
