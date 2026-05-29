"use client"

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    Menu, Grid, User, Users, MessageSquare, Briefcase,
    FileText, Clipboard, X, Calendar
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function Sidebar() {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const pathname = usePathname();
    const router = useRouter();
    const { currentUser, logout } = useAuth();

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth <= 768) {
                setIsCollapsed(true);
                setIsMobile(true);
            } else if (window.innerWidth <= 900) {
                setIsCollapsed(true);
                setIsMobile(false);
            } else {
                setIsCollapsed(false);
                setIsMobile(false);
            }
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Automatically close sidebar on mobile when a link is clicked
    const handleLinkClick = () => {
        if (isMobile) setIsCollapsed(true);
    };

    const handleLogout = () => {
        logout();
        router.push('/login');
    };

    // Standard active state for completed pages
    const linkClass = (path: string) => {
        const active = pathname === path;
        return `flex items-center gap-3 px-4 py-3.5 rounded-xl no-underline transition-all text-[15px] border-l-4 ${
            active 
                ? 'bg-[#3d3d3d] text-white border-brand-red rounded-l-none rounded-r-xl' 
                : 'text-[#a8b1c2] border-transparent hover:bg-[#3d3d3d] hover:text-white'
        } ${isCollapsed ? 'justify-center py-3.5 px-0' : ''}`;
    };

    return (
        <>
            {/* 1. MOBILE FLOATING BUTTON - ALWAYS RENDERED, Tailwind media classes control visibility */}
            <button
                className={`fixed top-3.5 left-4 z-[9999] bg-white text-[#1f2937] border border-[#e5e7eb] rounded-lg p-2 cursor-pointer shadow-md items-center justify-center hidden max-[768px]:flex ${
                    !isCollapsed ? 'max-[768px]:!hidden' : ''
                }`}
                onClick={() => setIsCollapsed(false)}
            >
                <Menu size={24} />
            </button>

            {/* 2. MOBILE OVERLAY (Dark background that closes sidebar when clicked) */}
            {!isCollapsed && isMobile && (
                <div 
                    className="fixed inset-0 bg-black/50 backdrop-blur-[2px] z-[9995] animate-[fadeIn_0.2s_ease-out_forwards]" 
                    onClick={() => setIsCollapsed(true)}
                ></div>
            )}

            {/* 3. THE SIDEBAR */}
            <aside 
                className={`fixed top-0 bottom-0 left-0 bg-gradient-to-b from-[#2c2c2c] to-[#111111] p-[18px] flex flex-col shrink-0 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-x-hidden whitespace-nowrap z-[9998] md:sticky md:h-screen ${
                    isCollapsed ? 'w-20 px-3 max-[768px]:-translate-x-full max-[768px]:w-[250px]' : 'w-[250px]'
                }`}
            >
                <div className="flex flex-col">
                    <div className={`flex items-center gap-3 mb-8 transition-all duration-300 ${isCollapsed ? 'flex-col gap-[18px] items-center max-[768px]:flex-row max-[768px]:gap-3' : ''}`}>
                        <div className="w-[42px] h-[42px] rounded-[10px] bg-white overflow-hidden shrink-0 flex items-center justify-center">
                            <img src="/logos/logo.jpg" alt="Fuji Solar Logo" className="w-full h-full object-contain" />
                        </div>

                        <div className={`logo-text ${isCollapsed ? 'hidden max-[768px]:block' : 'block'}`}>
                            <h2 className="text-white text-xl font-bold m-0 leading-tight">Fuji Solar</h2>
                            <span className="text-[#8e9ab1] text-[11px] tracking-wider uppercase">CRM + ERP</span>
                        </div>

                        {/* Close button on mobile, expand/collapse on desktop */}
                        <button 
                            className={`menu-toggle text-white border-none rounded-[10px] bg-white/8 cursor-pointer flex items-center justify-center shrink-0 transition-all hover:bg-white/15 ${
                                isCollapsed ? 'm-0 w-8 h-8 max-[768px]:ml-auto max-[768px]:w-[34px] max-[768px]:h-[34px]' : 'ml-auto w-[34px] h-[34px]'
                            }`}
                            onClick={() => setIsCollapsed(!isCollapsed)}
                        >
                            {isMobile ? <X size={20} /> : <Menu size={20} />}
                        </button>
                    </div>

                    <nav className="flex flex-col gap-1">
                        <Link href="/" className={linkClass('/')} onClick={handleLinkClick}>
                            <Grid size={18} className="shrink-0" />
                            <span className={`menu-text ${isCollapsed ? 'hidden max-[768px]:inline' : 'inline'}`}>Dashboard</span>
                        </Link>

                        <Link href="/leads" className={linkClass('/leads')} onClick={handleLinkClick}>
                            <User size={18} className="shrink-0" />
                            <span className={`menu-text ${isCollapsed ? 'hidden max-[768px]:inline' : 'inline'}`}>Leads</span>
                        </Link>

                        <Link href="/customers" className={linkClass('/customers')} onClick={handleLinkClick}>
                            <Users size={18} className="shrink-0" />
                            <span className={`menu-text ${isCollapsed ? 'hidden max-[768px]:inline' : 'inline'}`}>Customers</span>
                        </Link>

                        <Link href="/conversation" className={linkClass('/conversation')} onClick={handleLinkClick}>
                            <MessageSquare size={18} className="shrink-0" />
                            <span className={`menu-text ${isCollapsed ? 'hidden max-[768px]:inline' : 'inline'}`}>Conversations</span>
                        </Link>

                        <Link href="/inventory" className={linkClass('/inventory')} onClick={handleLinkClick}>
                            <FileText size={18} className="shrink-0" />
                            <span className={`menu-text ${isCollapsed ? 'hidden max-[768px]:inline' : 'inline'}`}>Inventory</span>
                        </Link>

                        <Link href="/projects" className={linkClass('/projects')} onClick={handleLinkClick}>
                            <Briefcase size={18} className="shrink-0" />
                            <span className={`menu-text ${isCollapsed ? 'hidden max-[768px]:inline' : 'inline'}`}>Project</span>
                        </Link>

                        <Link href="/remainder" className={linkClass('/remainder')} onClick={handleLinkClick}>
                            <Calendar size={18} className="shrink-0" />
                            <span className={`menu-text ${isCollapsed ? 'hidden max-[768px]:inline' : 'inline'}`}>Remainder</span>
                        </Link>

                        <Link href="/documents" className={linkClass('/documents')} onClick={handleLinkClick}>
                            <Clipboard size={18} className="shrink-0" />
                            <span className={`menu-text ${isCollapsed ? 'hidden max-[768px]:inline' : 'inline'}`}>Documents</span>
                        </Link>
                    </nav>
                </div>

                <div className="mt-auto flex flex-col gap-2">
                    <Link 
                        href="/settings" 
                        className={`flex items-center gap-3 bg-white/5 p-3 rounded-[10px] no-underline cursor-pointer border border-transparent transition-all ${
                            isCollapsed ? 'p-0 py-3 justify-center max-[768px]:p-3 max-[768px]:justify-start' : ''
                        }`} 
                        onClick={handleLinkClick}
                    >
                        <img 
                            src={currentUser?.avatar || 'https://i.pravatar.cc/150'} 
                            alt="Profile" 
                            className="w-9 h-9 rounded-full shrink-0 object-cover"
                        />
                        <div className={`profile-info ${isCollapsed ? 'hidden max-[768px]:block' : 'block'}`}>
                            <h4 className="text-xs font-semibold text-white m-0">{currentUser?.name || "Loading..."}</h4>
                            <span className="text-[11px] text-[#a8b1c2]">{currentUser?.designation || currentUser?.role}</span>
                        </div>
                    </Link>
                    <button
                        onClick={handleLogout}
                        className="bg-transparent border border-white/10 text-red-500 py-2 rounded-lg cursor-pointer text-xs font-semibold hover:bg-white/5 transition-colors"
                    >
                        Logout
                    </button>
                </div>
            </aside>
        </>
    );
}
