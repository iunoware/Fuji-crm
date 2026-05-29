"use client"

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Search, Bell, Download, Plus, Edit2, Trash2, X, CheckCircle, Clock, Check, Loader2, Users, Activity } from 'lucide-react';
import Link from 'next/link';

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

interface StaffMember {
  id: number;
  name: string;
  avatar: string;
  city_id: number;
}

interface City {
  id: number;
  name: string;
}

export default function Tasks() {
  const { currentUser } = useAuth();
  
  const [isLoading, setIsLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showChecklistModal, setShowChecklistModal] = useState(false);
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modal, setModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'info' | 'error' | 'confirm';
    onConfirm: (() => void) | null;
  }>({ isOpen: false, title: '', message: '', type: 'info', onConfirm: null });

  const [tempChecklist, setTempChecklist] = useState<ChecklistItem[]>([]);
  const [newItemText, setNewItemText] = useState('');

  useEffect(() => {
    if (currentUser) {
      fetchTasksData(true);
      const interval = setInterval(() => fetchTasksData(false), 10000);
      return () => clearInterval(interval);
    }
  }, [currentUser]);

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

  const fetchTasksData = async (showSpinner = true) => {
    if (!currentUser) return;
    if (showSpinner) setIsLoading(true);
    try {
      let query = supabase.from('tasks').select(`*, users (id, name, avatar), cities (id, name)`).order('due_date', { ascending: true });
      if (currentUser.role === 'City Admin') query = query.eq('city_id', currentUser.city_id);
      if (currentUser.role === 'Staff') query = query.eq('assigned_to', currentUser.id);
      const { data: taskData } = await query;
      
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
          const remoteIds = new Set(fetchedTasks.map(t => t.id));
          filteredLocal.forEach(lt => {
            if (!remoteIds.has(lt.id)) {
              fetchedTasks.push(lt);
            }
          });
        } catch (e) {}
      }

      setTasks(fetchedTasks);

      let staffQuery = supabase.from('users').select('id, name, avatar, city_id').eq('role', 'Staff');
      if (currentUser.role === 'City Admin') staffQuery = staffQuery.eq('city_id', currentUser.city_id);
      const { data: staffData } = await staffQuery;
      if (staffData) setStaff(staffData as StaffMember[]);

      const { data: cityData } = await supabase.from('cities').select('*');
      if (cityData) setCities(cityData as City[]);
      
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      if (showSpinner) setIsLoading(false);
    }
  };

  const busyStaffIds = tasks.filter(t => t.status !== 'Completed' && t.assigned_to).map(t => t.assigned_to as number);
  const benchStaff = staff.filter(s => !busyStaffIds.includes(s.id));
  const activeProjects = tasks.filter(t => t.status !== 'Completed');

  const handleStatusUpdate = async (taskId: number, newStatus: string) => {
    let success = false;
    try {
      const { error } = await supabase.from('tasks').update({ 
        status: newStatus, 
        updated_at: new Date().toISOString() 
      }).eq('id', taskId);
      if (!error) success = true;
    } catch (e) {}

    if (!success) {
      const localTasksStr = localStorage.getItem('offline_tasks');
      if (localTasksStr) {
        try {
          const localTasks = JSON.parse(localTasksStr) as Task[];
          const updated = localTasks.map(t => t.id === taskId ? { ...t, status: newStatus, updated_at: new Date().toISOString() } : t);
          localStorage.setItem('offline_tasks', JSON.stringify(updated));
        } catch (e) {}
      }
    }
    fetchTasksData(false);
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
    setShowTaskModal(true);
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
    setShowTaskModal(true);
  };

  const handleSaveTask = async () => {
    if (!formData.client_name || !formData.due_date) {
      return setModal({ isOpen: true, title: 'Error', message: 'Client name and due date required.', type: 'error', onConfirm: null });
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
        checklist: activeTask ? getSafeChecklist(activeTask.checklist) : [],
        updated_at: new Date().toISOString()
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
      } catch (e) {}

      if (!success) {
        const localTasksStr = localStorage.getItem('offline_tasks');
        let localTasks: Task[] = localTasksStr ? JSON.parse(localTasksStr) : [];
        if (activeTask) {
          localTasks = localTasks.map(t => t.id === activeTask.id ? { ...t, ...payload } : t);
        } else {
          const newId = Date.now();
          const newTaskObj: Task = {
            id: newId,
            ...payload,
            created_at: new Date().toISOString(),
            users: staff.find(s => s.id === payload.assigned_to) || null,
            cities: cities.find(c => c.id === payload.city_id) || null
          };
          localTasks.push(newTaskObj);
        }
        localStorage.setItem('offline_tasks', JSON.stringify(localTasks));
      }

      setShowTaskModal(false);
      fetchTasksData(false);
      setModal({ isOpen: true, title: 'Success', message: 'Task saved successfully!', type: 'info', onConfirm: null });
    } catch (error) {
      setModal({ isOpen: true, title: 'Error', message: 'Failed to save task.', type: 'error', onConfirm: null });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTask = (taskId: number) => {
    setModal({ 
      isOpen: true, 
      title: 'Confirm', 
      message: 'Delete this task completely?', 
      type: 'confirm', 
      onConfirm: async () => {
        let success = false;
        try {
          const { error } = await supabase.from('tasks').delete().eq('id', taskId);
          if (!error) success = true;
        } catch (e) {}

        const localTasksStr = localStorage.getItem('offline_tasks');
        if (localTasksStr) {
          try {
            const localTasks = JSON.parse(localTasksStr) as Task[];
            const updated = localTasks.filter(t => t.id !== taskId);
            localStorage.setItem('offline_tasks', JSON.stringify(updated));
          } catch (e) {}
        }

        fetchTasksData(false);
        setModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const downloadCSV = () => {
    const header = ["Project Name", "Client", "Location", "Due Date", "Status", "Assignee"];
    const rows = tasks.map(t => [t.project_name || '-', t.client_name, t.location, t.due_date, t.status, t.users?.name || 'Unassigned']);
    const csv = [header, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fuji_solar_tasks.csv';
    a.click();
  };

  const openChecklistModal = (task: Task) => {
    setActiveTask(task);
    setTempChecklist(getSafeChecklist(task.checklist));
    setShowChecklistModal(true);
  };

  const handleSaveChecklist = async () => {
    if (!activeTask) return;
    setIsSubmitting(true);
    try {
      let success = false;
      try {
        const { error } = await supabase.from('tasks').update({ 
          checklist: tempChecklist,
          updated_at: new Date().toISOString()
        }).eq('id', activeTask.id);
        if (!error) success = true;
      } catch (e) {}

      if (!success) {
        const localTasksStr = localStorage.getItem('offline_tasks');
        if (localTasksStr) {
          try {
            const localTasks = JSON.parse(localTasksStr) as Task[];
            const updated = localTasks.map(t => t.id === activeTask.id ? { ...t, checklist: tempChecklist, updated_at: new Date().toISOString() } : t);
            localStorage.setItem('offline_tasks', JSON.stringify(updated));
          } catch (e) {}
        }
      }

      setShowChecklistModal(false);
      fetchTasksData(false);
    } catch(err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleInlineChecklistItem = async (task: Task, itemIndex: number) => {
    const newChecklist = [...getSafeChecklist(task.checklist)];
    newChecklist[itemIndex].completed = !newChecklist[itemIndex].completed;
    
    let success = false;
    try {
      const { error } = await supabase.from('tasks').update({ 
        checklist: newChecklist, 
        updated_at: new Date().toISOString() 
      }).eq('id', task.id);
      if (!error) success = true;
    } catch (e) {}

    if (!success) {
      const localTasksStr = localStorage.getItem('offline_tasks');
      if (localTasksStr) {
        try {
          const localTasks = JSON.parse(localTasksStr) as Task[];
          const updated = localTasks.map(t => t.id === task.id ? { ...t, checklist: newChecklist, updated_at: new Date().toISOString() } : t);
          localStorage.setItem('offline_tasks', JSON.stringify(updated));
        } catch (e) {}
      }
    }
    fetchTasksData(false);
  };

  if (!currentUser) return null;

  return (
    <main className="flex-1 block h-screen overflow-y-auto overflow-x-hidden bg-brand-bg">
      {/* Topbar */}
      <header className="flex items-center justify-between h-[72px] px-6 bg-white border-b border-[#e5e7eb] sticky top-0 z-50 shrink-0 max-[768px]:pl-[70px] max-[768px]:justify-end">
        <div className="flex items-center gap-2.5 w-[400px] text-gray-400 bg-[#f9f8fc] border border-[#e5e4e7] rounded-lg px-3.5 py-2.5 max-[768px]:hidden">
          <Search size={18} />
          <input type="text" placeholder="Search tasks..." className="border-none bg-transparent outline-none flex-1 text-sm text-brand-text" />
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={downloadCSV} 
            className="px-3.5 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 bg-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Download size={14}/> Export CSV
          </button>
          <Link href="/remainder" className="text-gray-500 relative flex items-center justify-center p-2 rounded-lg border border-[#e5e7eb] bg-white hover:bg-gray-50 transition-colors">
            <Bell size={20} className="text-gray-600" />
          </Link>
        </div>
      </header>

      {/* Header section */}
      <div className="flex justify-between items-center px-6 py-6 pb-4 max-[768px]:flex-col max-[768px]:items-start max-[768px]:gap-4">
        <div>
          <h1 className="text-3xl font-extrabold m-0 tracking-tight text-gray-900">Task Management</h1>
          <p className="text-sm text-gray-500 m-0 mt-1">Dispatch, track, and complete field operations.</p>
        </div>
        <div>
          {currentUser.role !== 'Staff' && (
            <button 
              onClick={openAddModal} 
              className="bg-brand-red hover:bg-brand-red-hover text-white px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 cursor-pointer shadow-md transition-all border-none"
            >
              <Plus size={16} /> Assign Task
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
                <p className="text-xs font-semibold text-gray-500 m-0 mb-1">Total Tasks</p>
                <h2 className="text-2xl font-bold m-0 text-gray-900">{tasks.length}</h2>
              </div>
            </div>
            <div className="bg-white p-5 rounded-xl border border-[#e5e4e7] overflow-hidden flex items-center gap-4 shadow-sm">
              <div className="bg-amber-50 p-4 rounded-xl text-amber-700 shrink-0">
                <Clock size={24}/>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 m-0 mb-1">In Progress</p>
                <h2 className="text-2xl font-bold m-0 text-gray-900">{tasks.filter(t => t.status === 'In Progress').length}</h2>
              </div>
            </div>
            <div className="bg-green-50/50 p-5 rounded-xl border border-green-200 overflow-hidden flex items-center gap-4 shadow-sm">
              <div className="bg-green-100 p-4 rounded-xl text-green-700 shrink-0">
                <CheckCircle size={24}/>
              </div>
              <div>
                <p className="text-xs font-semibold text-green-800 m-0 mb-1">Completed</p>
                <h2 className="text-2xl font-bold m-0 text-green-800">{tasks.filter(t => t.status === 'Completed').length}</h2>
              </div>
            </div>
          </div>

          {/* Tasks Table */}
          <div className="px-6 py-4">
            <div className="bg-white rounded-xl border border-[#e5e7eb] shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[900px]">
                  <thead>
                    <tr className="border-b border-[#e5e7eb] text-gray-500 text-xs font-extrabold tracking-wider uppercase">
                      <th className="px-6 py-3.5 w-14"></th>
                      <th className="px-6 py-3.5">Client / Project</th>
                      <th className="px-6 py-3.5">Assignee</th>
                      <th className="px-6 py-3.5">Due Date</th>
                      <th className="px-6 py-3.5">Status</th>
                      <th className="px-6 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f3f4f6]">
                    {tasks.map(task => (
                      <tr key={task.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4.5 text-center">
                          <div 
                            className="cursor-pointer inline-block" 
                            onClick={() => handleStatusUpdate(task.id, task.status === 'Completed' ? 'Pending' : 'Completed')}
                          >
                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                              task.status === 'Completed' ? 'border-green-500 bg-green-500 text-white' : 'border-gray-300 bg-white hover:border-gray-400'
                            }`}>
                              {task.status === 'Completed' && <Check size={14} strokeWidth={3} />}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4.5">
                          <h4 className="text-sm font-semibold text-gray-950 m-0 mb-0.5">{task.client_name}</h4>
                          <span className="text-xs text-gray-500">
                            {task.project_name || 'N/A'} • {task.location}
                          </span>
                        </td>
                        <td className="px-6 py-4.5">
                          <div className="flex items-center gap-2">
                            {task.users ? (
                              <>
                                <img src={task.users.avatar || 'https://i.pravatar.cc/150'} className="w-7 h-7 rounded-full object-cover shrink-0" alt="avatar" />
                                <span className="text-xs font-semibold text-gray-800">{task.users.name}</span>
                              </>
                            ) : (
                              <span className="text-xs text-gray-400 italic">Unassigned</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4.5">
                          <span className="text-xs font-medium text-gray-700">
                            {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No Date'}
                          </span>
                        </td>
                        <td className="px-6 py-4.5">
                          <select 
                            value={task.status} 
                            onChange={(e) => handleStatusUpdate(task.id, e.target.value)}
                            className={`px-3 py-1 rounded-full text-xs font-bold border-none outline-none cursor-pointer ${
                              task.status === 'Completed' 
                                ? 'bg-green-50 text-green-700' 
                                : task.status === 'In Progress' 
                                  ? 'bg-blue-50 text-blue-700' 
                                  : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            <option value="Pending">Pending</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Completed">Completed</option>
                          </select>
                        </td>
                        <td className="px-6 py-4.5 text-right">
                          <div className="flex justify-end gap-2.5">
                            {currentUser.role !== 'Staff' && (
                              <>
                                <button 
                                  onClick={() => openChecklistModal(task)} 
                                  className="p-2 rounded bg-green-50 hover:bg-green-100 text-green-700 border-none cursor-pointer transition-colors" 
                                  title="Manage Checklist"
                                >
                                  <CheckCircle size={14}/>
                                </button>
                                <button 
                                  onClick={() => openEditModal(task)} 
                                  className="p-2 rounded bg-gray-50 hover:bg-gray-100 text-gray-700 border-none cursor-pointer transition-colors"
                                >
                                  <Edit2 size={14}/>
                                </button>
                                <button 
                                  onClick={() => handleDeleteTask(task.id)} 
                                  className="p-2 rounded bg-red-50 hover:bg-red-100 text-red-700 border-none cursor-pointer transition-colors"
                                >
                                  <Trash2 size={14}/>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {tasks.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-10 text-center text-gray-400 text-sm">No tasks found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Lower Grid: Active Project Checklists & Bench Staff */}
          <div className="grid grid-cols-2 max-[1024px]:grid-cols-1 gap-6 px-6 pb-6">
            {/* Checklist items */}
            <div className="bg-white border border-[#e5e7eb] rounded-xl p-5 shadow-sm">
              <h3 className="text-sm font-bold text-gray-950 m-0 mb-4 flex items-center gap-2">
                <Activity size={16} className="text-brand-red" /> Active Project Checklists
              </h3>
              <div className="flex flex-col gap-4 max-h-[350px] overflow-y-auto pr-1">
                {activeProjects.map(task => (
                  <div key={task.id} className="bg-slate-50/50 p-4 border border-slate-100 rounded-xl">
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-bold text-xs text-gray-900">{task.client_name}</span>
                      <span className="text-[11px] text-gray-500 font-medium">{task.users?.name || 'Unassigned'}</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {getSafeChecklist(task.checklist).length > 0 ? (
                        getSafeChecklist(task.checklist).map((item, index, arr) => (
                          <div key={item.id} className="flex gap-3.5 relative pb-3 last:pb-0">
                            {index !== arr.length - 1 && (
                              <div className={`absolute left-2.5 top-4.5 bottom-0 w-0.5 ${item.completed ? 'bg-green-500' : 'bg-slate-200'}`}></div>
                            )}
                            <div 
                              onClick={() => toggleInlineChecklistItem(task, index)}
                              className={`w-5 h-5 rounded-full border-2 shrink-0 z-10 flex items-center justify-center cursor-pointer transition-all ${
                                item.completed ? 'border-green-500 bg-green-500 text-white' : 'border-gray-300 bg-white hover:border-gray-400'
                              }`}
                            >
                              {item.completed && <Check size={11} strokeWidth={3} />}
                            </div>
                            <span className={`text-xs ${item.completed ? 'text-slate-400 line-through font-medium' : 'text-gray-700 font-semibold'}`}>
                              {item.text}
                            </span>
                          </div>
                        ))
                      ) : (
                        <span className="text-xs text-gray-400 italic">No checklist items.</span>
                      )}
                    </div>
                  </div>
                ))}
                {activeProjects.length === 0 && (
                  <span className="text-xs text-gray-400 italic py-4 text-center">No active projects.</span>
                )}
              </div>
            </div>

            {/* Available Staff (Bench) */}
            <div className="bg-white border border-[#e5e7eb] rounded-xl p-5 shadow-sm flex flex-col">
              <h3 className="text-sm font-bold text-gray-950 m-0 mb-4 flex items-center gap-2">
                <Users size={16} className="text-brand-red" /> Available Staff (Bench)
              </h3>
              <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-3 max-h-[350px] overflow-y-auto pr-1">
                {benchStaff.map(s => (
                  <div key={s.id} className="flex items-center gap-3 p-3 bg-slate-50/50 border border-slate-100 rounded-xl hover:border-slate-200 transition-all">
                    <img src={s.avatar || 'https://i.pravatar.cc/150'} className="w-8 h-8 rounded-full object-cover shrink-0" alt="Avatar" />
                    <div>
                      <h4 className="text-xs font-bold text-gray-900 m-0 mb-0.5">{s.name}</h4>
                      <span className="text-[10px] font-bold text-green-600 tracking-wide uppercase">• Ready</span>
                    </div>
                  </div>
                ))}
                {benchStaff.length === 0 && (
                  <div className="col-span-2 py-8 text-center text-gray-400 text-xs italic">
                    All staff are assigned to projects.
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* --- ADD / EDIT TASK MODAL --- */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[999] p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 w-full max-w-[600px] shadow-2xl relative animate-scale-up">
            <button 
              onClick={() => setShowTaskModal(false)} 
              className="absolute top-4 right-4 bg-transparent border-none cursor-pointer text-gray-400 hover:text-gray-650"
            >
              <X size={20} />
            </button>
            <h3 className="text-lg font-bold text-gray-900 m-0 mb-5">{activeTask ? 'Edit Task' : 'Assign New Task'}</h3>
            
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
                <label className="text-xs font-semibold text-gray-500 block mb-1.5">Client Name *</label>
                <input 
                  type="text" 
                  value={formData.client_name} 
                  onChange={e => setFormData({...formData, client_name: e.target.value})} 
                  className="w-full p-2.5 rounded-lg border border-gray-300 outline-none text-sm focus:border-brand-red" 
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-gray-500 block mb-1.5">Location / Address</label>
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
                onClick={() => setShowTaskModal(false)} 
                className="px-4 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-lg text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveTask} 
                disabled={isSubmitting} 
                className="px-4 py-2 bg-brand-red hover:bg-brand-red-hover text-white font-semibold rounded-lg text-xs border-none cursor-pointer shadow-sm flex items-center justify-center min-w-[100px]"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={16}/> : 'Save Task'}
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

      {/* --- MODAL DIALOGS --- */}
      {modal.isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1000] p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-[400px] shadow-2xl relative">
            <h3 className={`text-lg font-bold m-0 mb-2 ${modal.type === 'error' ? 'text-red-600' : 'text-gray-900'}`}>{modal.title}</h3>
            <p className="text-xs text-gray-500 mb-5 leading-relaxed">{modal.message}</p>
            <div className="flex justify-end gap-3">
              {modal.type === 'confirm' ? (
                <>
                  <button className="px-4 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-lg text-xs cursor-pointer" onClick={() => setModal(prev => ({...prev, isOpen: false}))}>Cancel</button>
                  <button className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg text-xs border-none cursor-pointer shadow-sm" onClick={modal.onConfirm || undefined}>Delete</button>
                </>
              ) : (
                <button className="px-4 py-2 bg-brand-red hover:bg-brand-red-hover text-white font-semibold rounded-lg text-xs border-none cursor-pointer shadow-sm" onClick={() => setModal(prev => ({...prev, isOpen: false}))}>OK</button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
