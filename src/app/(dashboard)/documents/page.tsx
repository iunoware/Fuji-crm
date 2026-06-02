"use client"

import { useState, useEffect } from 'react';
// import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { 
  Search, Bell, FileText, Download, Upload, 
  Folder, Trash2, ShieldCheck, Loader2, X, HardDrive,
  CheckCircle, Check, Plus, Clock, Lock
} from 'lucide-react';
import Link from 'next/link';

const FOLDERS = [
  'Site Inspections',
  'Permits & Approvals',
  'Technical Designs',
  'Client Agreements',
  'Installation Photos'
];

const MAX_STORAGE_BYTES = 1 * 1024 * 1024 * 1024; // 1.0 GB

interface ChecklistItem {
  id: number;
  text: string;
  completed: boolean;
}

interface ProjectTask {
  id: number;
  client_name: string;
  status: string;
  document_checklist: ChecklistItem[] | string;
  users?: {
    name: string;
  } | null;
}

interface DocumentItem {
  id: number;
  file_name: string;
  file_url: string;
  file_size: number;
  folder: string;
  city_id: number;
  uploaded_by: number;
  created_at: string;
  users?: {
    name: string;
  } | null;
}

interface City {
  id: number;
  name: string;
}

export default function Documents() {
  const { currentUser } = useAuth();
  
  // Timer lock (target date is May 14, 2026 3 PM IST)
  const TARGET_DATE = new Date('2026-05-14T15:00:00+05:30').getTime();
  
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
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [activeProjects, setActiveProjects] = useState<ProjectTask[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [activeFolder, setActiveFolder] = useState('All');
  
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadData, setUploadData] = useState<{
    file: File | null;
    folder: string;
    city_id: string;
  }>({ file: null, folder: FOLDERS[0], city_id: '' });

  const [reqInputs, setReqInputs] = useState<Record<number, string>>({});

  useEffect(() => {
    if (currentUser && timeLeft <= 0) fetchVaultData();
  }, [currentUser, timeLeft]);

  const fetchVaultData = async () => {
    if (!currentUser) return;
    setIsLoading(true);
    
    try {
      if (currentUser.role === 'Super Admin') {
        const { data: cityData } = await supabase.from('cities').select('*');
        if (cityData) {
          setCities(cityData as City[]);
          setUploadData(prev => ({ ...prev, city_id: String(cityData[0]?.id || '') }));
        }
      } else {
        setUploadData(prev => ({ ...prev, city_id: String(currentUser.city_id || '') }));
      }
    } catch (e) { console.error("City fetch error:", e); }

    try {
      let taskQuery = supabase.from('tasks').select(`id, client_name, status, document_checklist, users(name)`);
      if (currentUser.role === 'City Admin') taskQuery = taskQuery.eq('city_id', currentUser.city_id);
      else if (currentUser.role === 'Staff') taskQuery = taskQuery.eq('assigned_to', currentUser.id);
      
      const { data: taskData } = await taskQuery;
      if (taskData) {
        setActiveProjects((taskData as any[]).filter(t => t.status !== 'Completed'));
      }
    } catch (e) { console.error("Tasks fetch error:", e); }

    try {
      let docQuery = supabase.from('documents').select(`*, users(name)`).order('created_at', { ascending: false });
      if (currentUser.role !== 'Super Admin') docQuery = docQuery.eq('city_id', currentUser.city_id);
      
      const { data: docData } = await docQuery;
      if (docData) setDocuments(docData as DocumentItem[]);
    } catch (e) { console.error("Docs fetch error:", e); }

    setIsLoading(false);
  };

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

  const handleAddRequirement = async (taskId: number, currentChecklist: any) => {
    const text = reqInputs[taskId]?.trim();
    if (!text) return;

    const newChecklist = [...getSafeChecklist(currentChecklist), { id: Date.now(), text, completed: false }];
    
    setActiveProjects(prev => prev.map(p => p.id === taskId ? { ...p, document_checklist: newChecklist } : p));
    setReqInputs(prev => ({ ...prev, [taskId]: '' }));

    await supabase.from('tasks').update({ 
      document_checklist: newChecklist, 
      updated_at: new Date().toISOString() 
    }).eq('id', taskId);
  };

  const handleDeleteRequirement = async (taskId: number, itemIndex: number, currentChecklist: any) => {
    const newChecklist = getSafeChecklist(currentChecklist).filter((_, i) => i !== itemIndex);
    setActiveProjects(prev => prev.map(p => p.id === taskId ? { ...p, document_checklist: newChecklist } : p));
    await supabase.from('tasks').update({ 
      document_checklist: newChecklist, 
      updated_at: new Date().toISOString() 
    }).eq('id', taskId);
  };

  const handleChecklistToggle = async (taskId: number, itemIndex: number, currentChecklist: any) => {
    const newChecklist = [...getSafeChecklist(currentChecklist)];
    newChecklist[itemIndex].completed = !newChecklist[itemIndex].completed;
    setActiveProjects(prev => prev.map(p => p.id === taskId ? { ...p, document_checklist: newChecklist } : p));
    await supabase.from('tasks').update({ 
      document_checklist: newChecklist, 
      updated_at: new Date().toISOString() 
    }).eq('id', taskId);
  };

  const handleFileUpload = async () => {
    if (!uploadData.file || !currentUser) return alert("Please select a file.");
    setIsUploading(true);

    try {
      const file = uploadData.file;
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${uploadData.folder}/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, file);
      if (uploadError) throw new Error(uploadError.message || "Storage upload failed");

      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath);
      
      const { error: dbError } = await supabase.from('documents').insert([{
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_size: file.size, 
        folder: uploadData.folder,
        city_id: parseInt(uploadData.city_id),
        uploaded_by: currentUser.id
      }]);

      if (dbError) throw new Error(dbError.message || "Database insert failed");

      setShowUploadModal(false);
      setUploadData({ ...uploadData, file: null });
      fetchVaultData();
    } catch (error: any) {
      console.error("Upload failed:", error);
      alert(`Upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteFile = async (id: number) => {
    if (!window.confirm("Delete this document permanently?")) return;
    try {
      await supabase.from('documents').delete().eq('id', id);
      fetchVaultData();
    } catch (error) {
      console.error("Delete failed:", error);
    }
  };

  const filteredDocs = activeFolder === 'All' ? documents : documents.filter(d => d.folder === activeFolder);
  const totalBytesUsed = documents.reduce((acc, doc) => acc + Number(doc.file_size || 0), 0);
  const usedGB = (totalBytesUsed / (1024 * 1024 * 1024)).toFixed(4);
  const storagePercentage = Math.min((totalBytesUsed / MAX_STORAGE_BYTES) * 100, 100);
  const getFolderCount = (folderName: string) => documents.filter(d => d.folder === folderName).length;

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
          <div className="w-20 h-20 bg-red-50 text-brand-red rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
            <Lock size={40} />
          </div>
          
          <h1 className="text-2xl font-black text-gray-900 mb-3 tracking-tight">Secure Vault Locked</h1>
          <p className="text-sm text-gray-500 leading-relaxed mb-8">
            The Documents module will automatically unlock and reveal itself after aggregation.
          </p>
          <div className="flex justify-center gap-4 mb-6">
            <div className="bg-slate-50 p-4 rounded-xl min-w-20 border border-slate-100">
              <span className="block text-3xl font-extrabold text-brand-red">{hours.toString().padStart(2, '0')}</span>
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Hours</span>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl min-w-20 border border-slate-100">
              <span className="block text-3xl font-extrabold text-brand-red">{minutes.toString().padStart(2, '0')}</span>
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Minutes</span>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl min-w-20 border border-slate-100">
              <span className="block text-3xl font-extrabold text-brand-red">{seconds.toString().padStart(2, '0')}</span>
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
  // SCENARIO 2: DOCUMENT VAULT REVEALED
  // ==========================================
  return (
    <main className="flex-1 block h-screen overflow-y-auto overflow-x-hidden bg-brand-bg">
      {/* Topbar */}
      <header className="flex items-center justify-between h-[72px] px-6 bg-white border-b border-[#e5e7eb] sticky top-0 z-50 shrink-0 max-[768px]:pl-[70px] max-[768px]:justify-end">
        <div className="flex items-center gap-2.5 w-[400px] text-gray-400 bg-[#f9f8fc] border border-[#e5e4e7] rounded-lg px-3.5 py-2.5 max-[768px]:hidden">
          <Search size={18} />
          <input type="text" placeholder="Search contracts, CAD files, or surveys..." className="border-none bg-transparent outline-none flex-1 text-sm text-brand-text" />
        </div>
        <div className="flex items-center gap-3">
          <Link href="/remainder" className="text-gray-500 relative flex items-center justify-center p-2 rounded-lg border border-[#e5e7eb] bg-white hover:bg-gray-50 transition-colors">
            <Bell size={20} className="text-gray-600" />
          </Link>
        </div>
      </header>

      {/* Header section */}
      <div className="flex justify-between items-center px-6 py-6 pb-2 max-[768px]:flex-col max-[768px]:items-start max-[768px]:gap-4">
        <div>
          <h1 className="text-3xl font-extrabold m-0 tracking-tight text-gray-900 flex items-center gap-2">
            Document Vault <ShieldCheck size={28} className="text-green-500" />
          </h1>
          <p className="text-sm text-gray-500 m-0 mt-1">Secure storage and document collection tracking.</p>
        </div>
        <div>
          {currentUser.role !== 'Staff' && (
            <button 
              onClick={() => setShowUploadModal(true)} 
              className="bg-brand-red hover:bg-brand-red-hover text-white px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 cursor-pointer shadow-md transition-all border-none"
            >
              <Upload size={16} /> Upload File
            </button>
          )}
        </div>
      </div>

      {/* Folder Widgets */}
      <div className="grid grid-cols-5 max-[1024px]:grid-cols-3 max-sm:grid-cols-2 gap-4 px-6 py-4">
        {FOLDERS.map((folder, idx) => {
          const colors = ['#eff6ff', '#fef3c7', '#dcfce7', '#f3e8ff', '#ffe4e6'];
          const iconColors = ['#3b82f6', '#d97706', '#10b981', '#8b5cf6', '#e11d48'];
          return (
            <div 
              key={folder} 
              onClick={() => setActiveFolder(folder)} 
              style={{ borderColor: activeFolder === folder ? iconColors[idx] : '#e5e7eb' }}
              className="bg-white border rounded-2xl p-5 cursor-pointer shadow-sm hover:translate-y-[-2px] hover:shadow transition-all"
            >
              <div style={{ color: iconColors[idx] }} className="mb-3">
                <Folder size={32} fill={colors[idx]} />
              </div>
              <h3 className="text-sm font-bold text-gray-950 m-0 mb-1 leading-tight truncate">{folder}</h3>
              <p className="text-xs text-gray-500 m-0">{getFolderCount(folder)} Files</p>
            </div>
          );
        })}
      </div>

      {/* Vault grid layout */}
      <div className="grid grid-cols-[280px_1fr] max-[900px]:grid-cols-1 gap-6 px-6 py-4">
        {/* Sidebar Directory */}
        <div className="flex flex-col gap-6">
          <div className="bg-white border border-[#e5e7eb] rounded-2xl p-5 shadow-sm">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-4">Directory</h3>
            <div className="flex flex-col gap-1">
              <button 
                onClick={() => setActiveFolder('All')} 
                className={`flex justify-between items-center w-full p-2.5 rounded-lg border-none cursor-pointer text-sm transition-all ${
                  activeFolder === 'All' ? 'bg-slate-100 font-bold text-gray-950' : 'bg-transparent text-gray-600 hover:bg-slate-50'
                }`}
              >
                <span className="flex items-center gap-2"><HardDrive size={18} className="text-gray-400" /> All Files</span>
                <span className="text-xs font-semibold text-gray-400">{documents.length}</span>
              </button>
            </div>

            <div className="mt-8 bg-slate-50 p-4.5 rounded-2xl border border-slate-100">
              <h4 className="text-xs font-bold text-gray-900 m-0 mb-2">Vault Storage Usage</h4>
              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden mb-2">
                <div 
                  style={{ width: `${storagePercentage}%` }} 
                  className={`h-full ${storagePercentage > 90 ? 'bg-red-500' : 'bg-green-600'}`}
                ></div>
              </div>
              <span className="text-xs text-gray-500 block">{usedGB} GB of 1.0 GB used</span>
            </div>
          </div>
        </div>

        {/* Vault Document Trackers & File Table */}
        <div className="flex flex-col gap-6">
          {/* Document Checklist for Active Projects */}
          <div className="bg-white border border-[#e5e7eb] rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-bold text-gray-950 m-0 mb-4 flex items-center gap-2">
              <FileText size={18} className="text-blue-600" /> Project Document Checklist
            </h3>
            
            <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-4">
              {activeProjects.map(task => (
                <div key={task.id} className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex flex-col justify-between">
                  <div className="flex justify-between items-center mb-3 border-b border-slate-200/60 pb-2">
                    <span className="font-extrabold text-sm text-gray-900">{task.client_name}</span>
                    <span className="text-xs text-gray-500 font-medium">{task.users?.name || 'Unassigned'}</span>
                  </div>
                  
                  <div className="flex flex-col gap-2.5 mb-4">
                    {getSafeChecklist(task.document_checklist).length > 0 ? (
                      getSafeChecklist(task.document_checklist).map((item, idx) => (
                        <div key={item.id} className="flex items-center justify-between gap-2.5">
                          <div className="flex items-center gap-2.5">
                            <div 
                              onClick={() => handleChecklistToggle(task.id, idx, task.document_checklist)}
                              className={`flex-shrink-0 w-4.5 h-4.5 rounded border-2 flex items-center justify-center cursor-pointer transition-all ${
                                item.completed ? 'border-green-500 bg-green-500 text-white' : 'border-gray-300 bg-white hover:border-gray-400'
                              }`}
                            >
                              {item.completed && <Check size={12} strokeWidth={4} />}
                            </div>
                            <span className={`text-xs ${item.completed ? 'text-slate-400 line-through' : 'text-gray-700 font-semibold'}`}>
                              {item.text}
                            </span>
                          </div>
                          
                          {currentUser.role !== 'Staff' && (
                            <button 
                              onClick={() => handleDeleteRequirement(task.id, idx, task.document_checklist)} 
                              className="bg-transparent border-none text-red-500 hover:text-red-750 cursor-pointer p-0.5 flex"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      ))
                    ) : (
                      <span className="text-xs text-gray-400 italic">No documents requested yet.</span>
                    )}
                  </div>

                  {currentUser.role !== 'Staff' && (
                    <div className="flex gap-2 mt-auto">
                      <input 
                        type="text" 
                        value={reqInputs[task.id] || ''}
                        onChange={(e) => setReqInputs(prev => ({ ...prev, [task.id]: e.target.value }))}
                        placeholder="e.g. Identity Proof" 
                        className="flex-1 p-2 border border-gray-300 rounded-lg text-xs outline-none focus:border-brand-red"
                        onKeyDown={(e) => { if(e.key === 'Enter') handleAddRequirement(task.id, task.document_checklist) }}
                      />
                      <button 
                        onClick={() => handleAddRequirement(task.id, task.document_checklist)} 
                        className="bg-brand-red hover:bg-brand-red-hover text-white border-none py-1.5 px-3 rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1 shrink-0 shadow-sm"
                      >
                        <Plus size={13}/> Add
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {activeProjects.length === 0 && (
                <span className="text-xs text-gray-400 italic py-4 col-span-2">No active projects available.</span>
              )}
            </div>
          </div>

          {/* Files List Table */}
          <div className="bg-white border border-[#e5e7eb] rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-[#e5e7eb]">
              <h3 className="text-base font-bold text-gray-950 m-0">
                {activeFolder === 'All' ? 'All Files' : `${activeFolder} Files`}
              </h3>
            </div>
            
            {isLoading ? (
              <div className="py-12 text-center">
                <Loader2 className="animate-spin text-brand-red mx-auto" size={30} />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="border-b border-[#e5e7eb] text-gray-500 text-xs font-extrabold tracking-wider uppercase">
                      <th className="px-6 py-3.5">File Name</th>
                      <th className="px-6 py-3.5">Folder</th>
                      <th className="px-6 py-3.5">Uploaded By</th>
                      <th className="px-6 py-3.5">Date</th>
                      <th className="px-6 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f3f4f6]">
                    {filteredDocs.map(doc => (
                      <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="bg-slate-100 text-gray-600 p-2 rounded-lg shrink-0">
                              <FileText size={16}/>
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-gray-950 m-0 mb-0.5">{doc.file_name}</h4>
                              <span className="text-xs text-gray-500">{formatSize(doc.file_size)}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-semibold text-gray-700">{doc.folder}</span>
                        </td>
                        <td className="px-6 py-4 text-xs font-medium text-gray-700">
                          {doc.users?.name || 'System'}
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-500">
                          {new Date(doc.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <a 
                              href={doc.file_url} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="p-2 rounded bg-blue-50 hover:bg-blue-100 text-blue-600 border-none cursor-pointer flex transition-all"
                            >
                              <Download size={14} />
                            </a>
                            {currentUser.role !== 'Staff' && (
                              <button 
                                onClick={() => handleDeleteFile(doc.id)} 
                                className="p-2 rounded bg-red-50 hover:bg-red-100 text-red-700 border-none cursor-pointer flex transition-all"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredDocs.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-gray-400 text-xs italic">
                          No files found inside this directory.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* UPLOAD MODAL */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[999] p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 w-full max-w-[500px] shadow-2xl relative animate-scale-up">
            <button 
              onClick={() => setShowUploadModal(false)} 
              className="absolute top-4 right-4 bg-transparent border-none cursor-pointer text-gray-400 hover:text-gray-650"
            >
              <X size={20} />
            </button>
            <h3 className="text-lg font-bold text-gray-900 m-0 mb-5">Upload Document</h3>
            
            <div className="flex flex-col gap-4 mb-6">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1.5">Select File *</label>
                <input 
                  type="file" 
                  onChange={e => setUploadData({...uploadData, file: e.target.files?.[0] || null})} 
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-slate-50 focus:border-brand-red outline-none" 
                />
              </div>
              
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1.5">Target Folder</label>
                <select 
                  value={uploadData.folder} 
                  onChange={e => setUploadData({...uploadData, folder: e.target.value})} 
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:border-brand-red outline-none"
                >
                  {FOLDERS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>

              {currentUser.role === 'Super Admin' && (
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1.5">Branch Association</label>
                  <select 
                    value={uploadData.city_id} 
                    onChange={e => setUploadData({...uploadData, city_id: e.target.value})} 
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:border-brand-red outline-none"
                  >
                    {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button 
                onClick={() => setShowUploadModal(false)} 
                className="px-4 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-lg text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={handleFileUpload} 
                disabled={isUploading || !uploadData.file} 
                className="px-4 py-2 bg-brand-red hover:bg-brand-red-hover text-white font-semibold rounded-lg text-xs border-none cursor-pointer shadow-sm flex items-center justify-center min-w-[100px]"
              >
                {isUploading ? <Loader2 className="animate-spin" size={16}/> : 'Upload Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
