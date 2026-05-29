"use client"

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { 
  Search, Bell, Activity, CheckCircle, Clock, 
  ChevronLeft, ChevronRight, Package, Loader2, 
  Edit2, Trash2, X, Plus, Eye
} from 'lucide-react';

interface ChecklistItem {
  id: number;
  text: string;
  completed: boolean;
}

interface Task {
  id: number;
  project_name: string;
  client_name: string;
  location: string;
  city_id: number;
  assigned_to: number | null;
  due_date: string;
  status: string;
  checklist: ChecklistItem[] | string;
  product?: string;
  created_at?: string;
  updated_at?: string;
  users?: {
    id: number;
    name: string;
    avatar: string;
  } | null;
  cities?: {
    id: number;
    name: string;
  } | null;
}

interface InventoryItem {
  id: number;
  available_units: number;
  total_units: number;
  components_master?: {
    item_name: string;
    category: string;
  } | null;
}

interface City {
  id: number;
  name: string;
}

interface StaffMember {
  id: number;
  name: string;
  avatar: string;
  city_id: number;
}

export default function Projects() {
  const { currentUser } = useAuth();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [feedIndex, setFeedIndex] = useState(0);

  const [showProjectModal, setShowProjectModal] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [formData, setFormData] = useState({ 
    project_name: '', 
    client_name: '', 
    location: '', 
    city_id: '', 
    assigned_to: '', 
    due_date: '', 
    status: 'Pending' 
  });
  
  const [modal, setModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'info' | 'error' | 'confirm';
    onConfirm: (() => void) | null;
  }>({ isOpen: false, title: '', message: '', type: 'info', onConfirm: null });

  const [showChecklistModal, setShowChecklistModal] = useState(false);
  const [showCompletedModal, setShowCompletedModal] = useState(false);
  const [showViewCompletedModal, setShowViewCompletedModal] = useState(false);
  const [tempChecklist, setTempChecklist] = useState<ChecklistItem[]>([]);
  const [newItemText, setNewItemText] = useState('');

  useEffect(() => {
    if (currentUser) {
      fetchCommandCenterData(true);
      const liveInterval = setInterval(() => fetchCommandCenterData(false), 10000);
      return () => clearInterval(liveInterval);
    }
  }, [currentUser]);

  useEffect(() => {
    if (tasks.length === 0) return;
    const timer = setInterval(() => setFeedIndex((prev) => (prev + 1) % tasks.length), 5000);
    return () => clearInterval(timer);
  }, [tasks]);

  const getSafeChecklist = (list: any): ChecklistItem[] => {
    if (Array.isArray(list)) return list;
    if (typeof list === 'string') {
      try { 
        const parsed = JSON.parse(list); 
        return Array.isArray(parsed) ? parsed : []; 
      } catch (e) { 
        return []; 
      }
    }
    return [];
  };

  const fetchCommandCenterData = async (showSpinner = true) => {
    if (!currentUser) return;
    if (showSpinner) setIsLoading(true);
    
    try {
      // 1. Fetch Tasks Safely
      let taskQuery = supabase.from('tasks').select(`*, users (id, name, avatar), cities (id, name)`).order('created_at', { ascending: false });
      if (currentUser.role === 'City Admin') taskQuery = taskQuery.eq('city_id', currentUser.city_id);
      if (currentUser.role === 'Staff') taskQuery = taskQuery.eq('assigned_to', currentUser.id);
      const { data: taskData } = await taskQuery;
      
      let fetchedTasks: Task[] = taskData ? (taskData as any[]) : [];

      // Offline storage fallback check
      const localTasksStr = localStorage.getItem('offline_tasks');
      if (localTasksStr) {
        try {
          const localTasks = JSON.parse(localTasksStr) as Task[];
          let filteredLocal = localTasks;
          if (currentUser.role === 'City Admin') {
            filteredLocal = localTasks.filter(t => t.city_id === currentUser.city_id);
          } else if (currentUser.role === 'Staff') {
            filteredLocal = localTasks.filter(t => t.assigned_to === currentUser.id);
          }
          // Merge local tasks prioritizing remote DB
          const remoteIds = new Set(fetchedTasks.map(t => t.id));
          filteredLocal.forEach(lt => {
            if (!remoteIds.has(lt.id)) {
              fetchedTasks.push(lt);
            }
          });
        } catch (e) {}
      }

      setTasks(fetchedTasks);

      // 2. Fetch Inventory Safely
      let invQuery = supabase.from('inventory_stock').select(`id, available_units, total_units, components_master (item_name, category)`).order('available_units', { ascending: false });
      if (currentUser.role === 'City Admin') invQuery = invQuery.eq('city_id', currentUser.city_id);
      const { data: invData } = await invQuery;
      if (invData) setInventory(invData as any[]);

      // 3. Fetch Cities Safely
      const { data: cityData } = await supabase.from('cities').select('*');
      if (cityData) setCities(cityData as City[]);

      // 4. Fetch Staff Safely
      let staffQuery = supabase.from('users').select('id, name, avatar, city_id').eq('role', 'Staff');
      if (currentUser.role === 'City Admin') staffQuery = staffQuery.eq('city_id', currentUser.city_id);
      const { data: staffData } = await staffQuery;
      if (staffData) setStaff(staffData as StaffMember[]);

    } catch (error) {
      console.error("Error fetching project data:", error);
    } finally {
      if (showSpinner) setIsLoading(false);
    }
  };

  const openAddModal = () => {
    setActiveTask(null);
    setFormData({ 
      project_name: '', 
      client_name: '', 
      location: '', 
      city_id: currentUser.role === 'Super Admin' ? String(cities[0]?.id || '') : String(currentUser.city_id || ''), 
      assigned_to: '', 
      due_date: '', 
      status: 'Pending' 
    });
    setShowProjectModal(true);
  };

  const openEditModal = (task: Task) => {
    setActiveTask(task);
    setFormData({ 
      project_name: task.project_name || '', 
      client_name: task.client_name || '', 
      location: task.location || '', 
      city_id: String(task.city_id || ''), 
      assigned_to: String(task.assigned_to || ''), 
      due_date: task.due_date || '', 
      status: task.status || 'Pending' 
    });
    setShowProjectModal(true);
  };

  const handleSaveProject = async () => {
    if (!formData.client_name || !formData.location || !formData.due_date) {
      return setModal({ 
        isOpen: true, 
        title: 'Error', 
        message: 'Client Name, Location, and Due Date are required.', 
        type: 'error',
        onConfirm: null
      });
    }
    setIsSubmitting(true);
    try {
      const payload: any = {
        project_name: formData.project_name, 
        client_name: formData.client_name, 
        location: formData.location,
        city_id: currentUser.role === 'Super Admin' ? parseInt(formData.city_id) : currentUser.city_id,
        assigned_to: formData.assigned_to ? parseInt(formData.assigned_to) : null,
        due_date: formData.due_date, 
        status: formData.status,
        checklist: activeTask ? getSafeChecklist(activeTask.checklist) : []
      };

      let success = false;
      try {
        if (activeTask) {
          const { error } = await supabase.from('tasks').update(payload).eq('id', activeTask.id);
          if (!error) success = true;
        } else {
          const { error } = await supabase.from('tasks').insert([payload]);
          if (!error) success = true;
        }
      } catch (e) {
        console.warn("Direct Supabase update failed, attempting local fallback", e);
      }

      // Fallback local storage sync if DB write fails or client is offline
      if (!success) {
        const localTasksStr = localStorage.getItem('offline_tasks');
        let localTasks: Task[] = localTasksStr ? JSON.parse(localTasksStr) : [];
        if (activeTask) {
          localTasks = localTasks.map(t => t.id === activeTask.id ? { ...t, ...payload, updated_at: new Date().toISOString() } : t);
        } else {
          const newId = Date.now();
          const newTaskObj: Task = {
            id: newId,
            ...payload,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            users: staff.find(s => s.id === payload.assigned_to) || null,
            cities: cities.find(c => c.id === payload.city_id) || null
          };
          localTasks.push(newTaskObj);
        }
        localStorage.setItem('offline_tasks', JSON.stringify(localTasks));
      }

      setShowProjectModal(false);
      fetchCommandCenterData(false); 
      setModal({ isOpen: true, title: 'Success', message: 'Project saved successfully!', type: 'info', onConfirm: null });
    } catch (error) {
      setModal({ isOpen: true, title: 'Error', message: 'Failed to save project.', type: 'error', onConfirm: null });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProject = (taskId: number) => {
    setModal({
      isOpen: true, 
      title: 'Delete Project', 
      message: 'Are you sure you want to delete this project?', 
      type: 'confirm',
      onConfirm: async () => {
        let success = false;
        try {
          const { error } = await supabase.from('tasks').delete().eq('id', taskId);
          if (!error) success = true;
        } catch (e) {}

        // Local storage backup sync
        const localTasksStr = localStorage.getItem('offline_tasks');
        if (localTasksStr) {
          try {
            const localTasks = JSON.parse(localTasksStr) as Task[];
            const updated = localTasks.filter(t => t.id !== taskId);
            localStorage.setItem('offline_tasks', JSON.stringify(updated));
          } catch (e) {}
        }

        fetchCommandCenterData(false);
        setModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const closeModal = () => setModal(prev => ({ ...prev, isOpen: false }));

  const openChecklistModal = (task: Task) => {
    setActiveTask(task);
    setTempChecklist(getSafeChecklist(task.checklist));
    setShowChecklistModal(true);
  };

  const handleSaveChecklist = async () => {
    if (!activeTask) return;
    setIsSubmitting(true);
    try {
      const progress = calculateProgress(tempChecklist);
      const newStatus = progress === 100 ? 'Completed' : activeTask.status;

      let success = false;
      try {
        const { error } = await supabase.from('tasks').update({ 
          checklist: tempChecklist,
          status: newStatus,
          updated_at: new Date().toISOString()
        }).eq('id', activeTask.id);
        if (!error) success = true;
      } catch (e) {}

      if (!success) {
        const localTasksStr = localStorage.getItem('offline_tasks');
        if (localTasksStr) {
          try {
            const localTasks = JSON.parse(localTasksStr) as Task[];
            const updated = localTasks.map(t => t.id === activeTask.id ? { ...t, checklist: tempChecklist, status: newStatus, updated_at: new Date().toISOString() } : t);
            localStorage.setItem('offline_tasks', JSON.stringify(updated));
          } catch (e) {}
        }
      }

      setShowChecklistModal(false);
      fetchCommandCenterData(false);
    } catch(err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculateProgress = (checklist: ChecklistItem[]) => {
    const list = getSafeChecklist(checklist);
    if (list.length === 0) return 0;
    const completedCount = list.filter(item => item.completed).length;
    return Math.round((completedCount / list.length) * 100);
  };

  const nextFeed = () => setFeedIndex((prev) => (prev + 1) % (tasks.length || 1));
  const prevFeed = () => setFeedIndex((prev) => (prev - 1 + tasks.length) % (tasks.length || 1));

  const totalProjects = tasks.length;
  const inProgress = tasks.filter(t => t.status === 'In Progress').length;
  const completed = tasks.filter(t => t.status === 'Completed').length;

  const busyStaffIds = tasks.filter(t => t.status !== 'Completed' && t.assigned_to).map(t => t.assigned_to as number);

  if (!currentUser) return null;

  return (
    <main className="flex-1 block h-screen overflow-y-auto overflow-x-hidden bg-brand-bg">
      {/* Topbar */}
      <header className="flex items-center justify-between h-[72px] px-6 bg-white border-b border-[#e5e7eb] sticky top-0 z-50 shrink-0 max-[768px]:pl-[70px] max-[768px]:justify-end">
        <div className="flex items-center gap-2.5 w-[400px] text-gray-400 bg-[#f9f8fc] border border-[#e5e4e7] rounded-lg px-3.5 py-2.5 max-[768px]:hidden">
          <Search size={18} />
          <input type="text" placeholder="Search projects or documents..." className="border-none bg-transparent outline-none flex-1 text-sm text-brand-text" />
        </div>
        <div className="flex items-center gap-3">
          <Link href="/remainder" className="text-gray-500 relative flex items-center justify-center p-2 rounded-lg border border-[#e5e7eb] bg-white hover:bg-gray-50 transition-colors">
            <Bell size={20} className="text-gray-600" />
          </Link>
        </div>
      </header>

      {/* Header section */}
      <div className="flex justify-between items-center px-6 py-6 pb-4 max-[768px]:flex-col max-[768px]:items-start max-[768px]:gap-4">
        <div>
          <h1 className="text-3xl font-extrabold m-0 tracking-tight text-gray-900">Live Project Command Center</h1>
          <p className="text-sm text-gray-500 m-0 mt-1">Real-time execution, logistics, and field operations tracking.</p>
        </div>
        <div>
          {currentUser.role !== 'Staff' && (
            <button 
              onClick={openAddModal} 
              className="bg-brand-red hover:bg-brand-red-hover text-white px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 cursor-pointer shadow-md transition-all"
            >
              <Plus size={16} /> Add Project
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-[50vh]">
          <Loader2 className="animate-spin text-brand-red" size={40} />
        </div>
      ) : (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-3 max-[768px]:grid-cols-1 gap-4 px-6 py-4">
            <div className="bg-white p-5 rounded-xl border border-[#e5e4e7] overflow-hidden flex items-center gap-4 shadow-sm">
              <div className="bg-indigo-50 p-4 rounded-xl text-indigo-700 shrink-0">
                <Activity size={24}/>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 m-0 mb-1">Total Projects</p>
                <h2 className="text-2xl font-bold m-0 text-gray-900">{totalProjects}</h2>
              </div>
            </div>
            <div className="bg-white p-5 rounded-xl border border-[#e5e4e7] overflow-hidden flex items-center gap-4 shadow-sm">
              <div className="bg-blue-50 p-4 rounded-xl text-blue-700 shrink-0">
                <Clock size={24}/>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 m-0 mb-1">In Progress</p>
                <h2 className="text-2xl font-bold m-0 text-gray-900">{inProgress}</h2>
              </div>
            </div>
            <div 
              className="bg-green-50/50 p-5 rounded-xl border border-green-200 overflow-hidden flex items-center gap-4 cursor-pointer hover:bg-green-50 shadow-sm transition-all"
              onClick={() => setShowCompletedModal(true)}
            >
              <div className="bg-green-100 p-4 rounded-xl text-green-700 shrink-0">
                <CheckCircle size={24}/>
              </div>
              <div>
                <p className="text-xs font-semibold text-green-800 m-0 mb-1">Completed Projects</p>
                <h2 className="text-2xl font-bold m-0 text-green-800">{completed}</h2>
              </div>
            </div>
          </div>

          {/* Active Projects Table */}
          <div className="px-6 py-4">
            <div className="bg-white rounded-xl border border-[#e5e7eb] shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-[#e5e7eb]">
                <h3 className="text-base font-bold text-gray-950 m-0">Active Deployments</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[850px]">
                  <thead>
                    <tr className="border-b border-[#e5e7eb] text-gray-500 text-xs font-extrabold tracking-wider uppercase">
                      <th className="px-6 py-3.5">Product</th>
                      <th className="px-6 py-3.5">Customer</th>
                      <th className="px-6 py-3.5">Status & Progress</th>
                      <th className="px-6 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f3f4f6]">
                    {tasks.filter(t => t.status !== 'Completed').map(task => {
                      const progress = calculateProgress(getSafeChecklist(task.checklist));
                      return (
                        <tr key={task.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4.5">
                            <h4 className="text-sm font-bold text-brand-red m-0">
                              {inventory.find(i => i.id === Number(task.product))?.components_master?.item_name || 
                               (task.project_name ? task.project_name : 'Solar Installation')}
                            </h4>
                          </td>
                          <td className="px-6 py-4.5">
                            <h4 className="text-sm font-semibold text-gray-950 m-0">{task.client_name || 'Unknown'}</h4>
                            <span className="text-xs text-gray-500">{task.location}</span>
                          </td>
                          <td className="px-6 py-4.5">
                            <div className="flex items-center gap-3">
                              <div className="w-48 h-2 bg-gray-100 rounded-full overflow-hidden shrink-0">
                                <div 
                                  style={{ width: `${progress}%` }} 
                                  className={`h-full transition-all duration-500 ${progress === 100 ? 'bg-green-500' : 'bg-blue-600'}`}
                                ></div>
                              </div>
                              <span className="text-xs font-bold text-gray-700 w-10 text-right">{progress}%</span>
                            </div>
                          </td>
                          <td className="px-6 py-4.5 text-right">
                            <div className="flex justify-end gap-2.5">
                              <button 
                                onClick={() => openChecklistModal(task)} 
                                className="p-2 rounded bg-green-50 hover:bg-green-100 text-green-700 border-none cursor-pointer transition-colors"
                                title="Manage Checklist"
                              >
                                <CheckCircle size={15}/>
                              </button>
                              {currentUser.role !== 'Staff' && (
                                <>
                                  <button 
                                    onClick={() => openEditModal(task)} 
                                    className="p-2 rounded bg-gray-50 hover:bg-gray-100 text-gray-700 border-none cursor-pointer transition-colors"
                                    title="Edit"
                                  >
                                    <Edit2 size={15}/>
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteProject(task.id)} 
                                    className="p-2 rounded bg-red-50 hover:bg-red-100 text-red-700 border-none cursor-pointer transition-colors"
                                    title="Delete"
                                  >
                                    <Trash2 size={15}/>
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {tasks.filter(t => t.status !== 'Completed').length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-10 text-center text-gray-500 text-sm italic">
                          No active deployments at this time.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Widgets Grid */}
          <div className="grid grid-cols-3 max-[1024px]:grid-cols-1 gap-6 px-6 pb-6">
            {/* Warehouse Overview */}
            <div className="bg-white border border-[#e5e7eb] rounded-xl p-5 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-950 m-0 mb-4 flex items-center gap-2">
                  <Package size={16} className="text-brand-red" /> Warehouse Overview
                </h3>
                <div className="flex flex-col gap-4">
                  {inventory.slice(0, 4).map((item, index) => {
                    const stockPercentage = Math.min(Math.round((item.available_units / (item.total_units || 1)) * 100), 100);
                    return (
                      <div key={index}>
                        <div className="flex justify-between text-xs font-semibold mb-1 text-gray-800">
                          <span className="truncate max-w-[160px]">{item.components_master?.item_name || 'Generic Item'}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${stockPercentage > 20 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                            {item.available_units} left
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            style={{ width: `${stockPercentage}%` }} 
                            className={`h-full ${stockPercentage > 20 ? 'bg-blue-600' : 'bg-red-500'}`}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                  {inventory.length === 0 && (
                    <p className="text-xs text-gray-400 italic">No inventory tracked.</p>
                  )}
                </div>
              </div>
              <Link 
                href="/inventory" 
                className="w-full py-2 px-4 mt-6 text-center border border-green-600 text-green-600 bg-white hover:bg-green-50/50 rounded-lg text-xs font-bold transition-colors no-underline block"
              >
                Manage Inventory
              </Link>
            </div>

            {/* Available Staff */}
            <div className="bg-white border border-[#e5e7eb] rounded-xl p-5 shadow-sm flex flex-col">
              <h3 className="text-sm font-bold text-gray-950 m-0 mb-4 flex items-center gap-2">
                <Activity size={16} className="text-brand-red" /> Available Staff (Bench)
              </h3>
              <div className="flex flex-col gap-3 max-h-[220px] overflow-y-auto pr-1">
                {staff.filter(s => !busyStaffIds.includes(s.id)).length > 0 ? (
                  staff.filter(s => !busyStaffIds.includes(s.id)).map(s => (
                    <div key={s.id} className="flex items-center gap-3.5 p-3 border border-slate-100 bg-slate-50/50 rounded-xl hover:border-slate-200 transition-all">
                      <img src={s.avatar || 'https://i.pravatar.cc/150'} className="w-8 h-8 rounded-full object-cover shrink-0" alt="Avatar" />
                      <div>
                        <h4 className="text-xs font-bold text-gray-900 m-0 mb-0.5">{s.name}</h4>
                        <span className="text-[10px] font-bold text-green-600 uppercase tracking-wide">Ready for Assignment</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-gray-400 italic py-6 text-center">
                    All staff members are currently deployed to projects.
                  </div>
                )}
              </div>
            </div>

            {/* Live Feed */}
            <div className="bg-[#111827] text-white rounded-xl p-5 shadow-sm flex flex-col justify-between relative overflow-hidden">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-[11px] font-extrabold text-slate-400 tracking-wider uppercase flex items-center gap-2 m-0">
                    <Activity size={14} className="text-green-500 animate-pulse" /> LIVE FEED
                  </h3>
                  <div className="flex gap-1">
                    <button 
                      onClick={prevFeed} 
                      className="bg-white/10 hover:bg-white/20 border-none text-white p-1 rounded cursor-pointer transition-colors"
                    >
                      <ChevronLeft size={16}/>
                    </button>
                    <button 
                      onClick={nextFeed} 
                      className="bg-white/10 hover:bg-white/20 border-none text-white p-1 rounded cursor-pointer transition-colors"
                    >
                      <ChevronRight size={16}/>
                    </button>
                  </div>
                </div>
                {tasks.length > 0 ? (
                  <div className="flex flex-col">
                    <span className="text-[10px] text-green-400 font-extrabold uppercase tracking-wide mb-1.5">
                      UPDATE • {tasks[feedIndex]?.cities?.name || 'Global'}
                    </span>
                    <h4 className="text-base font-bold m-0 text-white mb-3">
                      {tasks[feedIndex]?.client_name} - <span className={tasks[feedIndex]?.status === 'Completed' ? 'text-green-400' : 'text-yellow-400'}>{tasks[feedIndex]?.status}</span>
                    </h4>
                    <div className="flex flex-col gap-0 max-h-[160px] overflow-y-auto pr-1">
                      {getSafeChecklist(tasks[feedIndex]?.checklist).length > 0 ? (
                        getSafeChecklist(tasks[feedIndex]?.checklist).map((item, idx, arr) => (
                          <div key={item.id} className="flex gap-3 relative pb-4 last:pb-0">
                            {idx !== arr.length - 1 && (
                              <div className={`absolute left-2 top-4 bottom-0 w-0.5 ${item.completed ? 'bg-green-500' : 'bg-slate-700'}`}></div>
                            )}
                            <div className={`w-4 h-4 rounded-full border-2 shrink-0 z-10 flex items-center justify-center ${
                              item.completed ? 'border-green-500 bg-green-500' : 'border-slate-600 bg-slate-900'
                            }`}>
                              {item.completed && <div className="w-1.5 h-1.5 rounded-full bg-white"></div>}
                            </div>
                            <span className={`text-[12px] ${item.completed ? 'text-slate-400 line-through' : 'text-slate-200'}`}>
                              {item.text}
                            </span>
                          </div>
                        ))
                      ) : (
                        <span className="text-xs text-slate-500 italic">No checklist items.</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 italic py-10 text-center">
                    Awaiting operational data...
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* --- ADD / EDIT PROJECT MODAL --- */}
      {showProjectModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[999] p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 w-full max-w-[600px] shadow-2xl relative">
            <button 
              onClick={() => setShowProjectModal(false)} 
              className="absolute top-4 right-4 bg-transparent border-none cursor-pointer text-gray-400 hover:text-gray-650"
            >
              <X size={20} />
            </button>
            <h3 className="text-lg font-bold text-gray-900 m-0 mb-5">{activeTask ? 'Edit Project Details' : 'Add New Project'}</h3>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="col-span-2">
                <label className="text-xs font-semibold text-gray-500 block mb-1.5">Project Name</label>
                <input 
                  type="text" 
                  value={formData.project_name} 
                  onChange={e => setFormData({...formData, project_name: e.target.value})} 
                  className="w-full p-2.5 rounded-lg border border-gray-300 outline-none text-sm focus:border-brand-red" 
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-gray-500 block mb-1.5">Customer / Client Name *</label>
                <input 
                  type="text" 
                  value={formData.client_name} 
                  onChange={e => setFormData({...formData, client_name: e.target.value})} 
                  className="w-full p-2.5 rounded-lg border border-gray-300 outline-none text-sm focus:border-brand-red" 
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-gray-500 block mb-1.5">Location / Address *</label>
                <input 
                  type="text" 
                  value={formData.location} 
                  onChange={e => setFormData({...formData, location: e.target.value})} 
                  className="w-full p-2.5 rounded-lg border border-gray-300 outline-none text-sm focus:border-brand-red" 
                />
              </div>

              {currentUser.role === 'Super Admin' && (
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1.5">Branch City</label>
                  <select 
                    value={formData.city_id} 
                    onChange={e => setFormData({...formData, city_id: e.target.value, assigned_to: ''})} 
                    className="w-full p-2.5 rounded-lg border border-gray-300 outline-none text-sm bg-white focus:border-brand-red"
                  >
                    {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}

              <div className={currentUser.role === 'Super Admin' ? 'col-span-1' : 'col-span-2'}>
                <label className="text-xs font-semibold text-gray-500 block mb-1.5">Assign Staff (Bench Only)</label>
                <select 
                  value={formData.assigned_to || ''} 
                  onChange={e => setFormData({...formData, assigned_to: e.target.value})} 
                  className="w-full p-2.5 rounded-lg border border-gray-300 outline-none text-sm bg-white focus:border-brand-red"
                >
                  <option value="">-- Leave Unassigned --</option>
                  {staff
                    .filter(s => currentUser.role === 'City Admin' ? true : s.city_id === parseInt(formData.city_id || cities[0]?.id.toString() || ''))
                    .filter(s => !busyStaffIds.includes(s.id) || s.id === parseInt(formData.assigned_to))
                    .map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1.5">Due Date *</label>
                <input 
                  type="date" 
                  value={formData.due_date} 
                  onChange={e => setFormData({...formData, due_date: e.target.value})} 
                  className="w-full p-2.5 rounded-lg border border-gray-300 outline-none text-sm focus:border-brand-red" 
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1.5">Status</label>
                <select 
                  value={formData.status} 
                  onChange={e => setFormData({...formData, status: e.target.value})} 
                  className="w-full p-2.5 rounded-lg border border-gray-300 outline-none text-sm bg-white focus:border-brand-red"
                >
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button 
                onClick={() => setShowProjectModal(false)} 
                className="px-4 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-lg text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveProject} 
                disabled={isSubmitting} 
                className="px-4 py-2 bg-brand-red hover:bg-brand-red-hover text-white font-semibold rounded-lg text-xs border-none cursor-pointer shadow-sm flex items-center justify-center min-w-[100px]"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={16}/> : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CHECKLIST MANAGEMENT MODAL --- */}
      {showChecklistModal && activeTask && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[999] p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 w-full max-w-[500px] shadow-2xl relative">
            <button 
              onClick={() => setShowChecklistModal(false)} 
              className="absolute top-4 right-4 bg-transparent border-none cursor-pointer text-gray-400 hover:text-gray-650"
            >
              <X size={20} />
            </button>
            <h3 className="text-lg font-bold text-gray-900 m-0 mb-1">Manage Checklist</h3>
            <p className="text-xs text-gray-500 mb-5">Checklist for <strong>{activeTask.client_name}</strong></p>

            <div className="flex gap-2 mb-4">
              <input 
                type="text" 
                value={newItemText} 
                onChange={e => setNewItemText(e.target.value)} 
                placeholder="e.g. Install mounting brackets" 
                className="flex-1 p-2.5 rounded-lg border border-gray-300 outline-none text-sm focus:border-brand-red"
                onKeyDown={e => { 
                  if(e.key === 'Enter' && newItemText.trim()) { 
                    setTempChecklist([...tempChecklist, { id: Date.now(), text: newItemText.trim(), completed: false }]); 
                    setNewItemText(''); 
                  } 
                }}
              />
              <button 
                onClick={() => { 
                  if(newItemText.trim()){ 
                    setTempChecklist([...tempChecklist, { id: Date.now(), text: newItemText.trim(), completed: false }]); 
                    setNewItemText(''); 
                  } 
                }} 
                className="px-4 py-2.5 bg-brand-red hover:bg-brand-red-hover text-white font-semibold rounded-lg text-xs border-none cursor-pointer shadow-sm shrink-0"
              >
                Add
              </button>
            </div>

            <div className="max-h-[250px] overflow-y-auto border border-gray-200 rounded-lg mb-5 divide-y divide-gray-200">
              {tempChecklist.map((item, idx) => (
                <div key={item.id} className="flex justify-between items-center p-3">
                  <div className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      checked={item.completed} 
                      onChange={() => { 
                        const updated = tempChecklist.map((c, i) => i === idx ? { ...c, completed: !c.completed } : c); 
                        setTempChecklist(updated); 
                      }} 
                      className="w-4 h-4 cursor-pointer accent-brand-red text-brand-red border-gray-300 rounded" 
                    />
                    <span className={`text-xs ${item.completed ? 'text-slate-400 line-through' : 'text-gray-800'}`}>{item.text}</span>
                  </div>
                  <button 
                    onClick={() => setTempChecklist(tempChecklist.filter(i => i.id !== item.id))} 
                    className="bg-transparent border-none text-red-500 hover:text-red-700 cursor-pointer p-1"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              {tempChecklist.length === 0 && (
                <div className="p-8 text-center text-gray-400 text-xs italic">No items yet. Add one above!</div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button 
                onClick={() => setShowChecklistModal(false)} 
                className="px-4 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-lg text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveChecklist} 
                disabled={isSubmitting} 
                className="px-4 py-2 bg-brand-red hover:bg-brand-red-hover text-white font-semibold rounded-lg text-xs border-none cursor-pointer shadow-sm flex items-center justify-center min-w-[100px]"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={16}/> : 'Save Checklist'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- FEEDBACK MODAL --- */}
      {modal.isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1000] p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-[400px] shadow-2xl relative">
            <h3 className={`text-lg font-bold m-0 mb-2 ${modal.type === 'error' ? 'text-red-600' : 'text-gray-900'}`}>{modal.title}</h3>
            <p className="text-xs text-gray-500 mb-5 leading-relaxed">{modal.message}</p>
            <div className="flex justify-end gap-3">
              {modal.type === 'confirm' ? (
                <>
                  <button className="px-4 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-lg text-xs cursor-pointer" onClick={closeModal}>Cancel</button>
                  <button className="px-4 py-2 bg-red-650 hover:bg-red-700 text-white font-semibold rounded-lg text-xs border-none cursor-pointer shadow-sm" onClick={modal.onConfirm || undefined}>Delete</button>
                </>
              ) : (
                <button className="px-4 py-2 bg-brand-red hover:bg-brand-red-hover text-white font-semibold rounded-lg text-xs border-none cursor-pointer shadow-sm" onClick={closeModal}>OK</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- COMPLETED PROJECTS LIST MODAL --- */}
      {showCompletedModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[999] p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 w-full max-w-[700px] max-h-[80vh] overflow-y-auto shadow-2xl relative">
            <button 
              onClick={() => setShowCompletedModal(false)} 
              className="absolute top-4 right-4 bg-transparent border-none cursor-pointer text-gray-400 hover:text-gray-650"
            >
              <X size={20} />
            </button>
            <h3 className="text-lg font-bold text-gray-900 m-0 mb-5">Completed Projects</h3>
            
            <div className="flex flex-col gap-3">
              {tasks.filter(t => t.status === 'Completed').map(task => (
                <div key={task.id} className="flex justify-between items-center p-4 border border-gray-200 rounded-xl hover:bg-slate-50 transition-colors">
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 m-0 mb-0.5">{task.client_name}</h4>
                    <span className="text-xs text-gray-500">
                      Completed on {task.updated_at ? new Date(task.updated_at).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => { setActiveTask(task); setShowViewCompletedModal(true); }} 
                      className="p-2 rounded bg-blue-50 hover:bg-blue-100 text-blue-750 border-none cursor-pointer transition-colors"
                      title="View Details"
                    >
                      <Eye size={15}/>
                    </button>
                    {currentUser.role !== 'Staff' && (
                      <button 
                        onClick={() => handleDeleteProject(task.id)} 
                        className="p-2 rounded bg-red-50 hover:bg-red-100 text-red-700 border-none cursor-pointer transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={15}/>
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {tasks.filter(t => t.status === 'Completed').length === 0 && (
                <p className="text-xs text-gray-400 italic text-center py-6">No completed projects yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- COMPLETED PROJECT DETAILS VIEWER --- */}
      {showViewCompletedModal && activeTask && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[1000] p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 w-full max-w-[600px] max-h-[85vh] overflow-y-auto shadow-2xl relative">
            <button 
              onClick={() => setShowViewCompletedModal(false)} 
              className="absolute top-4 right-4 bg-transparent border-none cursor-pointer text-gray-400 hover:text-gray-650"
            >
              <X size={20} />
            </button>
            <h3 className="text-lg font-bold text-gray-900 m-0 mb-4">Project Archive Details</h3>
            
            <div className="bg-slate-50 p-4.5 rounded-xl mb-6 grid grid-cols-2 gap-4 border border-slate-100">
              <div>
                <span className="text-[10px] font-extrabold text-gray-400 block mb-0.5">CLIENT NAME</span>
                <div className="text-sm font-bold text-gray-900">{activeTask.client_name}</div>
              </div>
              <div>
                <span className="text-[10px] font-extrabold text-gray-400 block mb-0.5">LOCATION</span>
                <div className="text-sm font-semibold text-gray-800">{activeTask.location}</div>
              </div>
              <div>
                <span className="text-[10px] font-extrabold text-gray-400 block mb-0.5">PROJECT NAME</span>
                <div className="text-sm text-gray-800">{activeTask.project_name || 'N/A'}</div>
              </div>
              <div>
                <span className="text-[10px] font-extrabold text-gray-400 block mb-0.5">ASSIGNED STAFF</span>
                <div className="text-sm text-gray-800">{activeTask.users?.name || 'Unassigned'}</div>
              </div>
              <div>
                <span className="text-[10px] font-extrabold text-gray-400 block mb-0.5">CREATED AT</span>
                <div className="text-sm text-gray-800">{activeTask.created_at ? new Date(activeTask.created_at).toLocaleString() : 'N/A'}</div>
              </div>
              <div>
                <span className="text-[10px] font-extrabold text-gray-400 block mb-0.5">COMPLETED AT</span>
                <div className="text-sm text-green-700 font-semibold">{activeTask.updated_at ? new Date(activeTask.updated_at).toLocaleString() : 'N/A'}</div>
              </div>
            </div>

            <h4 className="text-sm font-bold text-gray-950 m-0 mb-3 border-b border-gray-100 pb-2">Project Checklist</h4>
            <div className="flex flex-col gap-2 mb-6">
              {getSafeChecklist(activeTask.checklist).map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 p-2.5 bg-slate-50/50 rounded-lg border border-slate-100">
                  <CheckCircle size={15} className={item.completed ? 'text-green-500' : 'text-slate-300'} />
                  <span className={`text-xs ${item.completed ? 'text-slate-400 line-through' : 'text-gray-700'}`}>{item.text}</span>
                </div>
              ))}
              {getSafeChecklist(activeTask.checklist).length === 0 && (
                <span className="text-xs text-gray-400 italic">No checklist items.</span>
              )}
            </div>
            
            <h4 className="text-sm font-bold text-gray-950 m-0 mb-3 border-b border-gray-100 pb-2">Customer Handoff Notes</h4>
            <div className="flex flex-col gap-2">
              {(() => {
                 const localCustsStr = localStorage.getItem('offline_customers');
                 const localCusts = localCustsStr ? JSON.parse(localCustsStr) : [];
                 const matchCust = localCusts.find((c: any) => c.name === activeTask.client_name);
                 if (matchCust) {
                    const notes = JSON.parse(localStorage.getItem(`cust_desc_${matchCust.id}`) || '{}');
                    const statuses = Object.keys(notes);
                    if (statuses.length > 0) {
                      return statuses.map(s => (
                        <div key={s} className="bg-white border border-gray-250 p-3 rounded-lg">
                          <div className="text-xs font-bold text-blue-600 mb-1">{s}</div>
                          <div className="text-xs text-gray-700 whitespace-pre-wrap">{notes[s]}</div>
                        </div>
                      ));
                    }
                 }
                 return <span className="text-xs text-gray-400 italic">No customer notes found for this client.</span>;
              })()}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
