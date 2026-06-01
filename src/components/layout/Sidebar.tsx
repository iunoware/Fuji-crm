"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ReactNode } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
// import {
//   Menu,
//   Grid,
//   UserSearch,
//   Users,
//   MessageSquare,
//   Briefcase,
//   GitFork,
//   FileText,
//   Clipboard,
//   X,
//   Calendar,
// } from "lucide-react";
import {
  Grid,
  MessageSquare,
  UserSearch,
  Workflow,
  Users,
  Briefcase,
  FileText,
  Receipt,
  Warehouse,
  CreditCard,
  Package,
  CheckSquare,
  FolderOpen,
  Bell,
  BarChart3,
  Calendar,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

type NavLinks = {
  link: string;
  icon: ReactNode;
  title: string;
};

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
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Automatically close sidebar on mobile when a link is clicked
  const handleLinkClick = () => {
    if (isMobile) setIsCollapsed(true);
  };

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  // Standard active state for completed pages
  // const linkClass = (path: string) => {
  //   const active = pathname === path;
  //   return `flex items-center gap-3 px-4 py-3.5 rounded-xl no-underline transition-all text-[15px] border-l-4 ${
  //     active
  //       ? "bg-[#3d3d3d] text-white border-brand-red rounded-l-none rounded-r-xl"
  //       : "text-[#a8b1c2] border-transparent hover:bg-[#3d3d3d] hover:text-white"
  //   } ${isCollapsed ? "justify-center py-3.5 px-0" : ""}`;
  // };

  // const navLinks: NavLinks[] = [
  //   { link: "/", title: "Dashboard", icon: <Grid size={18} className="shrink-0" /> },
  //   {
  //     link: "/conversation",
  //     title: "Conversation",
  //     icon: <MessageSquare size={18} className="shrink-0" />,
  //   },
  //   {
  //     link: "/leads",
  //     title: "Leads",
  //     icon: <UserSearch size={18} className="shrink-0" />,
  //   },
  //   {
  //     link: "/pipeline",
  //     title: "Pipeline",
  //     icon: <GitFork size={18} className="shrink-0" />,
  //   },
  //   {
  //     link: "/customers",
  //     title: "Customers",
  //     icon: <Users size={18} className="shrink-0" />,
  //   },
  //   {
  //     link: "/projects",
  //     title: "Projects",
  //     icon: <Briefcase size={18} className="shrink-0" />,
  //   },
  //   {
  //     link: "/quotations",
  //     title: "Quotations",
  //     icon: <Users size={18} className="shrink-0" />,
  //   },
  //   {
  //     link: "/invoices",
  //     title: "Invoices",
  //     icon: <Users size={18} className="shrink-0" />,
  //   },
  //   {
  //     link: "/payments",
  //     title: "Payments",
  //     icon: <Users size={18} className="shrink-0" />,
  //   },
  //   {
  //     link: "/inventory",
  //     title: "Inventory",
  //     icon: <FileText size={18} className="shrink-0" />,
  //   },
  //   {
  //     link: "/tasks",
  //     title: "Tasks",
  //     icon: <FileText size={18} className="shrink-0" />,
  //   },
  //   {
  //     link: "/documents",
  //     title: "Documents",
  //     icon: <Clipboard size={18} className="shrink-0" />,
  //   },
  //   {
  //     link: "/notifications",
  //     title: "Notifications",
  //     icon: <Clipboard size={18} className="shrink-0" />,
  //   },
  //   {
  //     link: "/reports",
  //     title: "Reports",
  //     icon: <Clipboard size={18} className="shrink-0" />,
  //   },

  //   {
  //     link: "/remainder",
  //     title: "Remainder",
  //     icon: <Calendar size={18} className="shrink-0" />,
  //   },
  // ];

  const navLinks: NavLinks[] = [
    { link: "/", title: "Dashboard", icon: <Grid size={18} /> },
    { link: "/conversation", title: "Conversation", icon: <MessageSquare size={18} /> },
    { link: "/leads", title: "Leads", icon: <UserSearch size={18} /> },
    { link: "/pipeline", title: "Pipeline", icon: <Workflow size={18} /> },
    { link: "/customers", title: "Customers", icon: <Users size={18} /> },
    { link: "/projects", title: "Projects", icon: <Briefcase size={18} /> },
    { link: "/quotations", title: "Quotations", icon: <FileText size={18} /> },
    { link: "/invoices", title: "Invoices", icon: <Receipt size={18} /> },
    { link: "/payments", title: "Payments", icon: <CreditCard size={18} /> },
    { link: "/inventory", title: "Inventory", icon: <Package size={18} /> },
    { link: "/materials", title: "Materials", icon: <Warehouse size={18} /> },
    { link: "/tasks", title: "Tasks", icon: <CheckSquare size={18} /> },
    { link: "/documents", title: "Documents", icon: <FolderOpen size={18} /> },
    { link: "/notifications", title: "Notifications", icon: <Bell size={18} /> },
    { link: "/reports", title: "Reports", icon: <BarChart3 size={18} /> },
    { link: "/remainder", title: "Reminder", icon: <Calendar size={18} /> },
  ];

  return (
    <section>
      {/* 1. MOBILE FLOATING BUTTON - ALWAYS RENDERED, Tailwind media classes control visibility */}
      <button
        className={`fixed top-3.5 left-4 z-9999 bg-white text-text-brand border border-[#e5e7eb] rounded-lg p-2 cursor-pointer shadow-md items-center justify-center hidden max-[768px]:flex ${
          !isCollapsed ? "max-[768px]:hidden!" : ""
        }`}
        onClick={() => setIsCollapsed(false)}
      >
        <Menu size={24} />
      </button>

      {/* 2. MOBILE OVERLAY (Dark background that closes sidebar when clicked) */}
      {!isCollapsed && isMobile && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-[2px] z-9995 animate-[fadeIn_0.2s_ease-out_forwards]"
          onClick={() => setIsCollapsed(true)}
        ></div>
      )}

      {/* 3. THE SIDEBAR */}
      <aside
        className={`overflow-y-auto scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden fixed top-0 bottom-0 left-0 bg-linear-to-b from-[#2c2c2c] to-[#111111] p-4.5 flex flex-col shrink-0 transition-all duration-300 ease-in-out overflow-x-hidden whitespace-nowrap z-9998 md:sticky md:h-screen ${
          isCollapsed
            ? "w-20 px-3 max-[768px]:-translate-x-full max-[768px]:w-62.5"
            : "w-62.5"
        }`}
      >
        <div className="flex flex-col">
          <div
            className={`flex items-center gap-3 mb-8 transition-all duration-300 ${isCollapsed ? "flex-col gap-4.5 items-center max-[768px]:flex-row max-[768px]:gap-3" : ""}`}
          >
            <div className="relative w-10.5 h-10.5 rounded-[10px] bg-white overflow-hidden shrink-0 flex items-center justify-center">
              <Image
                fill
                src="/logos/logo.jpg"
                alt="Fuji Solar Logo"
                className="w-full h-full object-contain"
              />
            </div>

            <div
              className={`logo-text ${isCollapsed ? "hidden max-[768px]:block" : "block"}`}
            >
              <h2 className="text-white text-xl font-bold m-0 leading-tight">
                Fuji Solar
              </h2>
              <span className="text-[#8e9ab1] text-[11px] tracking-wider uppercase">
                CRM + ERP
              </span>
            </div>

            {/* Close button on mobile, expand/collapse on desktop */}
            <button
              className={`menu-toggle text-white border-none rounded-[10px] bg-white/8 cursor-pointer flex items-center justify-center shrink-0 transition-all hover:bg-white/15 ${
                isCollapsed
                  ? "m-0 w-8 h-8 max-[768px]:ml-auto max-[768px]:w-8.5 max-[768px]:h-8.5"
                  : "ml-auto w-8.5 h-8.5"
              }`}
              onClick={() => setIsCollapsed(!isCollapsed)}
            >
              {isMobile ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>

          {/* navigations */}
          <nav className="flex flex-col">
            {navLinks.map((nav, index) => {
              const isActive =
                nav.link === "/" ? pathname === "/" : pathname.startsWith(nav.link);

              return (
                <Link
                  key={index}
                  href={nav.link}
                  onClick={handleLinkClick}
                  className={`flex items-center gap-3 px-4 py-3.5 rounded-xl no-underline transition-all text-sm border-l-4 ${isActive ? "bg-[#3d3d3d] text-white border-brand-red rounded-l-none rounded-r-xl" : "text-[#a8b1c2] border-transparent hover:bg-gray-700 hover:text-white"}`}
                >
                  {nav.icon}
                  <span
                    className={` ${isCollapsed ? "hidden max-[768px]:inline justify-center py-3.5 px-0" : "inline"}`}
                  >
                    {nav.title}
                  </span>
                </Link>
              );
            })}
            {/* <Link href="/" className={linkClass("/")} onClick={handleLinkClick}>
              <Grid size={18} className="shrink-0" />
              <span
                className={`menu-text ${isCollapsed ? "hidden max-[768px]:inline" : "inline"}`}
              >
                Dashboard
              </span>
            </Link> */}
          </nav>
        </div>

        <div className="mt-10 flex flex-col gap-2">
          <Link
            href="/settings"
            className={`flex items-center gap-3 bg-white/5 p-3 rounded-[10px] no-underline cursor-pointer border border-transparent transition-all ${
              isCollapsed
                ? "p-0 py-3 justify-center max-[768px]:p-3 max-[768px]:justify-start"
                : ""
            }`}
            onClick={handleLinkClick}
          >
            <div className="relative w-7 h-7 bg-gray-50 rounded-full shrink-0"></div>

            <div
              className={`profile-info ${isCollapsed ? "hidden max-[768px]:block" : "block"}`}
            >
              <h4 className="text-xs font-semibold text-white m-0">
                {currentUser?.name || "Loading..."}
              </h4>
              <span className="text-[11px] text-[#a8b1c2]">
                {currentUser?.designation || currentUser?.role}
              </span>
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
    </section>
  );
}
