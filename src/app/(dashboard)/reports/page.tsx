"use client"

import { useState, useEffect } from 'react';
// import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { 
  BarChart2, PieChart, TrendingUp, Package, CheckCircle, 
  Clock, Lock, Loader2, Search, Bell, AlertTriangle, ShieldCheck, Briefcase 
} from 'lucide-react';
import Link from 'next/link';

interface Task {
  id: number;
  project_name: string;
  client_name: string;
  location: string;
  status: string;
  due_date: string;
  assigned_to: number | null;
  city_id: number;
}

interface InventoryItem {
  id: number;
  available_units: number;
  total_units: number;
  components_master?: {
    item_name: string;
  } | null;
}

interface City {
  id: number;
  name: string;
}

export default function Reports() {
  const { currentUser } = useAuth();

  // Reports generating countdown (May 15, 2026 2:00 PM IST)
  const TARGET_DATE = new Date('2026-05-15T14:00:00+05:30').getTime();
  
  const calculateTimeLeft = () => {
    const now = new Date().getTime();
    const difference = TARGET_DATE - now;
    return difference > 0 ? Math.floor(difference / 1000) : 0;
  };

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft()); 

  useEffect(() => {
    if (timeLeft <= 0) return;
    const timerId = setInterval(() => setTimeLeft(calculateTimeLeft()), 1000);
    return () => clearInterval(timerId);
  }, [timeLeft]);

  const [isLoading, setIsLoading] = useState(true);
  const [cities, setCities] = useState<City[]>([]);
  const [filterCity, setFilterCity] = useState('All');

  // Metrics State
  const [tasksData, setTasksData] = useState<Task[]>([]);
  const [inventoryData, setInventoryData] = useState<InventoryItem[]>([]);

  useEffect(() => {
    if (currentUser && timeLeft <= 0) {
      fetchReportData();
    }
  }, [currentUser, timeLeft, filterCity]);

  const fetchReportData = async () => {
    if (!currentUser) return;
    setIsLoading(true);
    
    try {
      // 1. Fetch Cities (Only needed for Super Admin filtering)
      if (currentUser.role === 'Super Admin' && cities.length === 0) {
        const { data: cityData } = await supabase.from('cities').select('*');
        if (cityData) setCities(cityData as City[]);
      }

      // 2. Fetch Tasks Data based on RBAC
      let taskQuery = supabase.from('tasks').select('*');
      
      if (currentUser.role === 'Staff') {
        taskQuery = taskQuery.eq('assigned_to', currentUser.id);
      } else if (currentUser.role === 'City Admin') {
        taskQuery = taskQuery.eq('city_id', currentUser.city_id);
      } else if (currentUser.role === 'Super Admin' && filterCity !== 'All') {
        taskQuery = taskQuery.eq('city_id', parseInt(filterCity));
      }
      
      const { data: fetchedTasks } = await taskQuery;
      
      let finalTasks: Task[] = fetchedTasks ? (fetchedTasks as Task[]) : [];

      // Local storage sync fallback
      const localTasksStr = localStorage.getItem('offline_tasks');
      if (localTasksStr) {
        try {
          const localTasks = JSON.parse(localTasksStr) as Task[];
          let filteredLocal = localTasks;
          if (currentUser.role === 'Staff') {
            filteredLocal = localTasks.filter(t => t.assigned_to === currentUser.id);
          } else if (currentUser.role === 'City Admin') {
            filteredLocal = localTasks.filter(t => t.city_id === currentUser.city_id);
          } else if (currentUser.role === 'Super Admin' && filterCity !== 'All') {
            filteredLocal = localTasks.filter(t => t.city_id === parseInt(filterCity));
          }
          const remoteIds = new Set(finalTasks.map(t => t.id));
          filteredLocal.forEach(lt => {
            if (!remoteIds.has(lt.id)) {
              finalTasks.push(lt);
            }
          });
        } catch (e) {}
      }

      setTasksData(finalTasks);

      // 3. Fetch Inventory Data (Blocked entirely for Staff)
      if (currentUser.role !== 'Staff') {
        let invQuery = supabase.from('inventory_stock').select(`*, components_master (item_name)`);
        
        if (currentUser.role === 'City Admin') {
          invQuery = invQuery.eq('city_id', currentUser.city_id);
        } else if (currentUser.role === 'Super Admin' && filterCity !== 'All') {
          invQuery = invQuery.eq('city_id', parseInt(filterCity));
        }

        const { data: fetchedInv } = await invQuery;
        if (fetchedInv) setInventoryData(fetchedInv as any[]);
      }

    } catch (error) {
      console.error("Error fetching reports:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!currentUser) return null;

  // ==========================================
  // SCENARIO 1: COUNTDOWN TIMER VIEW
  // ==========================================
  if (timeLeft > 0) {
    const hours = Math.floor(timeLeft / 3600);
    const minutes = Math.floor((timeLeft % 3600) / 60);
    const seconds = timeLeft % 60;

    return (
      <main className="flex-1 flex flex-col items-center justify-center h-screen bg-slate-100">
        <div className="text-center bg-white p-12 rounded-3xl shadow-xl max-w-md w-full border border-slate-200">
          <div className="w-20 h-20 bg-indigo-50 text-indigo-650 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
            <Lock size={40} />
          </div>

          <h1 className="text-2xl font-black text-gray-900 mb-3 tracking-tight">Analytics Generating</h1>
          <p className="text-sm text-gray-500 leading-relaxed mb-8">
            The Advanced Reporting module is currently aggregating historical data. It will automatically unlock in:
          </p>

          <div className="flex justify-center gap-4 mb-6">
            <div className="bg-slate-50 p-4 rounded-xl min-w-20 border border-slate-100">
              <span className="block text-3xl font-extrabold text-indigo-650">{hours.toString().padStart(2, '0')}</span>
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Hours</span>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl min-w-20 border border-slate-100">
              <span className="block text-3xl font-extrabold text-indigo-650">{minutes.toString().padStart(2, '0')}</span>
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Minutes</span>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl min-w-20 border border-slate-100">
              <span className="block text-3xl font-extrabold text-indigo-650">{seconds.toString().padStart(2, '0')}</span>
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Seconds</span>
            </div>
          </div>
          
          <span className="flex items-center justify-center gap-1.5 text-xs text-gray-400 font-medium">
            <Clock size={14} /> Page will automatically refresh
          </span>
        </div>
      </main>
    );
  }

  // ==========================================
  // SCENARIO 2: REPORTS REVEALED
  // ==========================================
  const totalTasks = tasksData.length;
  const completedTasks = tasksData.filter(t => t.status === 'Completed').length;
  const inProgressTasks = tasksData.filter(t => t.status === 'In Progress').length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const lowStockItems = inventoryData.filter(item => item.available_units < 10);

  return (
    <main className="flex-1 block h-screen overflow-y-auto overflow-x-hidden bg-brand-bg">
      {/* Topbar */}
      <header className="flex items-center justify-between h-[72px] px-6 bg-white border-b border-[#e5e7eb] sticky top-0 z-50 shrink-0 max-[768px]:pl-[70px] max-[768px]:justify-end">
        <div className="flex items-center gap-2.5 w-[400px] text-gray-400 bg-[#f9f8fc] border border-[#e5e4e7] rounded-lg px-3.5 py-2.5 max-[768px]:hidden">
          <Search size={18} />
          <input type="text" placeholder="Search analytics..." className="border-none bg-transparent outline-none flex-1 text-sm text-brand-text" />
        </div>
        <div className="flex items-center gap-3">
          <Link href="/remainder" className="text-gray-500 relative flex items-center justify-center p-2 rounded-lg border border-[#e5e7eb] bg-white hover:bg-gray-50 transition-colors">
            <Bell size={20} className="text-gray-600" />
          </Link>
        </div>
      </header>

      {/* Header Section */}
      <div className="flex justify-between items-center px-6 py-6 pb-4 max-[768px]:flex-col max-[768px]:items-start max-[768px]:gap-4">
        <div>
          <h1 className="text-3xl font-extrabold m-0 tracking-tight text-gray-900 flex items-center gap-2">
            Performance Reports <BarChart2 size={26} className="text-indigo-700" />
          </h1>
          <p className="text-sm text-gray-500 m-0 mt-1">
            {currentUser.role === 'Staff' 
              ? 'Your personal KPI and performance overview.' 
              : 'Data-driven insights for operations and inventory.'}
          </p>
        </div>

        {/* Super Admin City Filter */}
        {currentUser.role === 'Super Admin' && (
          <div>
            <select 
              value={filterCity} 
              onChange={(e) => setFilterCity(e.target.value)}
              className="p-2.5 rounded-lg border border-gray-300 outline-none font-semibold text-sm text-gray-700 bg-white cursor-pointer hover:border-gray-400 shadow-sm transition-colors"
            >
              <option value="All">Global (All Branches)</option>
              {cities.map(c => <option key={c.id} value={c.id}>{c.name} Branch</option>)}
            </select>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-[50vh]">
          <Loader2 className="animate-spin text-indigo-700" size={40} />
        </div>
      ) : (
        <>
          {/* Metrics Grid */}
          <div className="grid grid-cols-4 max-[1024px]:grid-cols-2 max-[768px]:grid-cols-1 gap-4 px-6 py-4">
            
            <div className="bg-white p-5 rounded-xl border border-[#e5e4e7] overflow-hidden flex items-center gap-4 shadow-sm">
              <div className="bg-indigo-50 p-4 rounded-xl text-indigo-700 shrink-0">
                <Briefcase size={24}/>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 m-0 mb-1">
                  {currentUser.role === 'Staff' ? 'Assigned Projects' : 'Total Projects'}
                </p>
                <h2 className="text-2xl font-bold m-0 text-gray-900">{totalTasks}</h2>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-[#e5e4e7] overflow-hidden flex items-center gap-4 shadow-sm">
              <div className="bg-green-50 p-4 rounded-xl text-green-700 shrink-0">
                <CheckCircle size={24}/>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 m-0 mb-1">Completed</p>
                <h2 className="text-2xl font-bold m-0 text-green-700">{completedTasks}</h2>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-[#e5e4e7] overflow-hidden flex items-center gap-4 shadow-sm">
              <div className="bg-indigo-50 p-4 rounded-xl text-indigo-600 shrink-0">
                <TrendingUp size={24}/>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 m-0 mb-1">Completion Rate</p>
                <h2 className="text-2xl font-bold m-0 text-gray-900">{completionRate}%</h2>
              </div>
            </div>

            {/* Admins only: Inventory Health Metric */}
            {currentUser.role !== 'Staff' && (
              <div className={`bg-white p-5 rounded-xl border overflow-hidden flex items-center gap-4 shadow-sm ${
                lowStockItems.length > 0 ? 'border-red-200 bg-red-50/20' : 'border-[#e5e4e7]'
              }`}>
                <div className={`p-4 rounded-xl shrink-0 ${
                  lowStockItems.length > 0 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'
                }`}>
                  {lowStockItems.length > 0 ? <AlertTriangle size={24} /> : <Package size={24}/>}
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 m-0 mb-1">Low Stock Alerts</p>
                  <h2 className={`text-2xl font-bold m-0 ${lowStockItems.length > 0 ? 'text-red-650' : 'text-gray-900'}`}>{lowStockItems.length}</h2>
                </div>
              </div>
            )}
          </div>

          <div className="px-6 py-4">
            {/* STAFF SPECIFIC WORKLOAD (Option B) */}
            {currentUser.role === 'Staff' && (
              <div className="bg-white border border-[#e5e7eb] rounded-xl p-5 shadow-sm">
                <h3 className="text-base font-bold text-gray-950 m-0 mb-4">My Active Workload</h3>
                {inProgressTasks > 0 ? (
                  <div className="flex flex-col gap-3">
                    {tasksData.filter(t => t.status !== 'Completed').map(task => (
                      <div key={task.id} className="flex justify-between items-center p-4 bg-slate-50 border border-slate-100 rounded-xl">
                        <div>
                          <h4 className="text-sm font-bold text-gray-950 m-0 mb-1">{task.client_name}</h4>
                          <span className="text-xs text-gray-500">Due: {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'N/A'}</span>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          task.status === 'In Progress' ? 'bg-blue-50 text-blue-750' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {task.status}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center text-gray-400 text-sm italic">
                    You have no pending projects. Great job!
                  </div>
                )}
              </div>
            )}

            {/* ADMIN PERFORMANCE CHARTS */}
            {currentUser.role !== 'Staff' && (
              <div className="grid grid-cols-2 max-[1024px]:grid-cols-1 gap-6">
                {/* Pipeline Status Progress */}
                <div className="bg-white border border-[#e5e7eb] rounded-xl p-5 shadow-sm">
                  <h3 className="text-sm font-bold text-gray-950 m-0 mb-6 flex items-center gap-2">
                    <PieChart size={18} className="text-gray-500" /> Pipeline Status
                  </h3>
                  
                  <div className="flex flex-col gap-5">
                    <div>
                      <div className="flex justify-between mb-1.5 text-xs font-semibold text-gray-700">
                        <span>Pending Initiation</span>
                        <span>{tasksData.filter(t => t.status === 'Pending').length} Projects</span>
                      </div>
                      <div className="w-full h-2 bg-amber-50 rounded-full overflow-hidden">
                        <div 
                          style={{ width: `${(tasksData.filter(t => t.status === 'Pending').length / (totalTasks || 1)) * 100}%` }} 
                          className="h-full bg-amber-500 transition-all duration-500"
                        ></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between mb-1.5 text-xs font-semibold text-gray-700">
                        <span>Active Installs (In Progress)</span>
                        <span>{inProgressTasks} Projects</span>
                      </div>
                      <div className="w-full h-2 bg-blue-50 rounded-full overflow-hidden">
                        <div 
                          style={{ width: `${(inProgressTasks / (totalTasks || 1)) * 100}%` }} 
                          className="h-full bg-blue-600 transition-all duration-500"
                        ></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between mb-1.5 text-xs font-semibold text-gray-700">
                        <span>Successfully Completed</span>
                        <span>{completedTasks} Projects</span>
                      </div>
                      <div className="w-full h-2 bg-green-50 rounded-full overflow-hidden">
                        <div 
                          style={{ width: `${(completedTasks / (totalTasks || 1)) * 100}%` }} 
                          className="h-full bg-green-500 transition-all duration-500"
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Critical Inventory Restocks */}
                <div className="bg-white border border-[#e5e7eb] rounded-xl p-5 shadow-sm flex flex-col">
                  <h3 className="text-sm font-bold text-gray-950 m-0 mb-6 flex items-center gap-2">
                    <ShieldCheck size={18} className="text-gray-500" /> Critical Inventory Alerts
                  </h3>
                  
                  {lowStockItems.length > 0 ? (
                    <div className="flex flex-col gap-3 max-h-[220px] overflow-y-auto pr-1">
                      {lowStockItems.map(item => (
                        <div key={item.id} className="flex justify-between items-center p-3 bg-red-50 border border-red-150 rounded-xl">
                          <div>
                            <h4 className="text-xs font-bold text-red-900 m-0 mb-0.5">{item.components_master?.item_name || 'Generic Item'}</h4>
                            <span className="text-[10px] font-bold text-red-600 uppercase tracking-wide">RESTOCK REQUIRED</span>
                          </div>
                          <div className="bg-white px-3 py-1 rounded-full text-xs font-black text-red-700 border border-red-200">
                            {item.available_units} left
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 px-4 text-center bg-green-50 border border-green-200 rounded-xl flex-1 flex flex-col items-center justify-center">
                      <CheckCircle size={32} className="text-green-600 mb-2" />
                      <h4 className="text-sm font-bold text-green-800 m-0 mb-1">Inventory Healthy</h4>
                      <p className="text-xs text-green-700 m-0">All components have sufficient stock levels.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </main>
  );
}
