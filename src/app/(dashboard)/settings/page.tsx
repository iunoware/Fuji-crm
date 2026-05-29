"use client"

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Search, Bell, User, Camera, Plus, Edit2, Trash2, Loader2, MapPin, Building, X } from 'lucide-react';
import Link from 'next/link';

export default function Settings() {
  const { currentUser, setCurrentUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [activeTab, setActiveTab] = useState('profile');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Profile Edit States
  const [profileData, setProfileData] = useState({
    name: currentUser?.name || '',
    password: '',
    avatar: currentUser?.avatar || '',
    designation: currentUser?.designation || ''
  });

  // User Management States
  const [users, setUsers] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  
  // Custom Modal States
  const [modal, setModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'info' | 'error' | 'confirm';
    onConfirm: (() => void) | null;
  }>({ isOpen: false, title: '', message: '', type: 'info', onConfirm: null });

  const [showAddUser, setShowAddUser] = useState(false);
  const [showAddBranch, setShowAddBranch] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  
  // Form States
  const [newUser, setNewUser] = useState({ name: '', username: '', password: '', role: 'Staff', city_id: '', designation: '' });
  const [editUserForm, setEditUserForm] = useState<any>(null);
  const [newBranchName, setNewBranchName] = useState('');

  useEffect(() => {
    if (currentUser) {
      setProfileData({ 
        name: currentUser.name, 
        password: '', 
        avatar: currentUser.avatar || '', 
        designation: currentUser.designation || '' 
      });
      if (currentUser.role === 'Super Admin') fetchUsersAndCities();
    }
  }, [currentUser]);

  const fetchUsersAndCities = async () => {
    try {
      const { data: cityData } = await supabase.from('cities').select('*');
      if (cityData) {
        setCities(cityData);
        setNewUser(prev => ({ ...prev, city_id: String(cityData[0]?.id || '') }));
      }
      const { data: userData } = await supabase.from('users').select(`*, cities(name)`).order('id', { ascending: true });
      if (userData) setUsers(userData);
    } catch (e) {}
  };

  // --- CUSTOM MODAL HELPERS ---
  const closeModal = () => setModal(prev => ({ ...prev, isOpen: false }));
  const showSuccess = (msg: string) => setModal({ isOpen: true, title: 'Success', message: msg, type: 'info', onConfirm: null });
  const showError = (msg: string) => setModal({ isOpen: true, title: 'Error', message: msg, type: 'error', onConfirm: null });
  const showConfirm = (title: string, msg: string, onConfirmAction: () => void) => setModal({ isOpen: true, title, message: msg, type: 'confirm', onConfirm: onConfirmAction });

  // ==========================================
  // PROFILE IMAGE UPLOAD (LOCAL TO SUPABASE)
  // ==========================================
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentUser) return;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentUser.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('profiles')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('profiles').getPublicUrl(filePath);
      
      setProfileData(prev => ({ ...prev, avatar: publicUrl }));
      showSuccess("Image uploaded! Click 'Save Profile' to apply changes.");

    } catch (error) {
      console.error(error);
      showError("Upload failed. Ensure you have created a public bucket named 'profiles' in Supabase Storage.");
    }
  };

  // ==========================================
  // UPDATE PERSONAL PROFILE
  // ==========================================
  const handleUpdateProfile = async () => {
    if (!currentUser) return;
    setIsSaving(true);
    try {
      const updatePayload: any = { name: profileData.name, avatar: profileData.avatar };
      if (profileData.password) updatePayload.password = profileData.password;
      if (currentUser.role === 'Super Admin') updatePayload.designation = profileData.designation;

      const { data, error } = await supabase.from('users').update(updatePayload).eq('id', currentUser.id).select('*, cities(name)').single();
      if (error) throw error;

      setCurrentUser(data); 
      localStorage.setItem('fuji_user', JSON.stringify(data));
      setIsEditingProfile(false);
      showSuccess("Your profile has been updated.");
    } catch (error) {
      showError("Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  // ==========================================
  // BRANCH MANAGEMENT
  // ==========================================
  const handleAddBranch = async () => {
    if (!newBranchName.trim()) return showError("Branch name cannot be empty.");
    try {
      const { error } = await supabase.from('cities').insert([{ name: newBranchName.trim() }]);
      if (error) throw error;
      await fetchUsersAndCities();
      setShowAddBranch(false);
      setNewBranchName('');
      showSuccess(`Branch '${newBranchName}' added successfully.`);
    } catch (error) {
      showError("Failed to add branch.");
    }
  };

  // ==========================================
  // USER CRUD OPERATIONS (SUPER ADMIN)
  // ==========================================
  const handleCreateUser = async () => {
    if (!newUser.name || !newUser.username || !newUser.password) return showError("Please fill in all required fields.");
    
    if (newUser.role === 'City Admin') {
      const existingAdmin = users.find(u => u.role === 'City Admin' && String(u.city_id) === String(newUser.city_id));
      if (existingAdmin) return showError(`This branch already has an admin (${existingAdmin.name}). Only one admin allowed per branch.`);
    }

    try {
      const { error } = await supabase.from('users').insert([{ 
        ...newUser, 
        city_id: newUser.city_id ? parseInt(newUser.city_id) : null 
      }]);
      if (error) throw error;
      setShowAddUser(false);
      setNewUser({ name: '', username: '', password: '', role: 'Staff', city_id: String(cities[0]?.id || ''), designation: '' });
      await fetchUsersAndCities();
      showSuccess("New user created successfully.");
    } catch (error) {
      showError("Failed to create user. Username might already exist.");
    }
  };

  const handleUpdateOtherUser = async () => {
    if (!editUserForm) return;
    try {
      const { error } = await supabase.from('users').update({
        name: editUserForm.name,
        username: editUserForm.username,
        password: editUserForm.password,
        role: editUserForm.role,
        city_id: editUserForm.city_id ? parseInt(editUserForm.city_id) : null,
        designation: editUserForm.designation
      }).eq('id', editUserForm.id);

      if (error) throw error;
      
      setShowEditUserModal(false);
      await fetchUsersAndCities();
      showSuccess(`Updated ${editUserForm.name}'s account.`);
    } catch (error) {
      showError("Failed to update user.");
    }
  };

  const handleDeleteUser = (id: string | number, name: string) => {
    if (!currentUser) return;
    if (id === currentUser.id) return showError("You cannot delete your own account.");
    showConfirm("Delete User", `Are you sure you want to permanently delete ${name}?`, async () => {
      try {
        const { error } = await supabase.from('users').delete().eq('id', id);
        if (error) throw error;
        await fetchUsersAndCities();
        closeModal();
      } catch (error) {
        showError("Failed to delete user.");
      }
    });
  };

  if (!currentUser) return null;

  return (
    <main className="flex-1 block h-screen overflow-y-auto overflow-x-hidden bg-brand-bg">
      <header className="flex items-center justify-between h-[72px] px-6 bg-white border-b border-[#e5e7eb] sticky top-0 z-50 shrink-0 max-[768px]:pl-[70px] max-[768px]:justify-end">
        <div className="flex items-center gap-2.5 w-[400px] text-gray-400 bg-[#f9f8fc] border border-[#e5e4e7] rounded-lg px-3.5 py-2.5 max-[768px]:hidden">
          <Search size={18} />
          <input type="text" placeholder="Search settings..." className="border-none bg-transparent outline-none flex-1 text-sm text-brand-text" />
        </div>
        <div className="flex items-center gap-4">
          <Link href="/remainder" className="text-gray-500 relative flex items-center justify-center p-2 rounded-lg border border-[#e5e7eb] bg-white hover:bg-gray-50 transition-colors">
            <Bell size={20} className="text-gray-600" />
          </Link>
        </div>
      </header>

      <div className="px-6 py-6 pb-0">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your profile and system preferences.</p>
        </div>
      </div>

      <div className="px-6 border-b border-gray-200 flex gap-6 mt-5 select-none max-sm:mx-4 overflow-x-auto whitespace-nowrap pb-1">
        <button 
          onClick={() => setActiveTab('profile')} 
          className={`py-3 px-0 text-sm font-semibold cursor-pointer border-b-2 transition-colors ${
            activeTab === 'profile' ? 'text-brand-red border-brand-red' : 'text-gray-500 border-transparent'
          }`}
        >
          My Profile
        </button>
        {currentUser.role === 'Super Admin' && (
          <button 
            onClick={() => setActiveTab('users')} 
            className={`py-3 px-0 text-sm font-semibold cursor-pointer border-b-2 transition-colors ${
              activeTab === 'users' ? 'text-brand-red border-brand-red' : 'text-gray-500 border-transparent'
            }`}
          >
            User Management
          </button>
        )}
      </div>

      <div className="p-6">
        {/* TAB 1: MY PROFILE */}
        {activeTab === 'profile' && (
          <div className="grid grid-cols-[1fr_2fr] max-[768px]:grid-cols-1 gap-6 max-w-[1000px]">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 flex flex-col items-center text-center shadow-sm">
              <div className="relative mb-4">
                <img 
                  src={profileData.avatar || 'https://i.pravatar.cc/150'} 
                  alt="Profile" 
                  className="w-[120px] height-[120px] w-30 h-30 rounded-full object-cover border border-slate-100 shadow-sm" 
                />
                {isEditingProfile && (
                  <>
                    <button 
                      onClick={() => fileInputRef.current?.click()} 
                      className="absolute bottom-0 right-0 bg-brand-red hover:bg-brand-red-hover text-white border-3 border-white w-9 h-9 rounded-full flex items-center justify-center cursor-pointer shadow"
                    >
                      <Camera size={16} />
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                  </>
                )}
              </div>
              <h3 className="m-0 text-lg font-bold text-gray-900 mb-1">{currentUser.name}</h3>
              <p className="m-0 text-sm text-gray-500">{currentUser.role} • {currentUser.cities?.name || 'N/A'}</p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-5 pb-1">
                <h3 className="m-0 text-base font-bold text-gray-900 flex items-center gap-2"><User size={18} /> Personal Information</h3>
                {!isEditingProfile && (
                  <button onClick={() => setIsEditingProfile(true)} className="bg-transparent border border-gray-300 hover:bg-gray-50 text-gray-700 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer">
                    <Edit2 size={14} /> Edit
                  </button>
                )}
              </div>
              
              <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-4 mb-6">
                <div>
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Full Name</label>
                  <input type="text" value={profileData.name} onChange={e => setProfileData({...profileData, name: e.target.value})} disabled={!isEditingProfile} className={`w-full p-2.5 rounded-lg border outline-none text-sm ${isEditingProfile ? 'bg-white border-gray-300 focus:border-brand-red' : 'bg-slate-50 border-gray-200 text-gray-700'}`} />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Username</label>
                  <input type="text" value={currentUser.username} disabled className="w-full p-2.5 rounded-lg border border-gray-200 outline-none text-sm bg-gray-100 text-gray-400 cursor-not-allowed" />
                </div>
                
                {isEditingProfile && (
                  <div>
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">New Password (Leave blank to keep current)</label>
                    <input type="password" value={profileData.password} onChange={e => setProfileData({...profileData, password: e.target.value})} className="w-full p-2.5 rounded-lg border border-gray-300 outline-none text-sm focus:border-brand-red" />
                  </div>
                )}

                <div>
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Designation</label>
                  <input type="text" value={profileData.designation} onChange={e => setProfileData({...profileData, designation: e.target.value})} disabled={!isEditingProfile || currentUser.role !== 'Super Admin'} className={`w-full p-2.5 rounded-lg border outline-none text-sm ${(isEditingProfile && currentUser.role === 'Super Admin') ? 'bg-white border-gray-300 focus:border-brand-red' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`} />
                </div>
              </div>
              
              {isEditingProfile && (
                <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                  <button onClick={() => { setIsEditingProfile(false); setProfileData({ name: currentUser.name, password: '', avatar: currentUser.avatar || '', designation: currentUser.designation || '' }); }} className="px-4 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-lg text-xs cursor-pointer">Cancel</button>
                  <button onClick={handleUpdateProfile} disabled={isSaving} className="px-4 py-2 bg-brand-red hover:bg-brand-red-hover text-white font-semibold rounded-lg text-xs border-none cursor-pointer shadow-sm flex items-center justify-center min-w-[100px]">{isSaving ? <Loader2 className="animate-spin" size={16} /> : 'Save Changes'}</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: USER MANAGEMENT (SUPER ADMIN) */}
        {activeTab === 'users' && currentUser.role === 'Super Admin' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm max-w-[1000px]">
            <div className="flex justify-between items-center mb-5 pb-1">
              <h3 className="m-0 text-base font-bold text-gray-900">Manage System Users</h3>
              <div className="flex gap-3">
                <button className="bg-transparent border border-gray-300 hover:bg-gray-50 text-gray-700 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm" onClick={() => setShowAddBranch(true)}><Building size={16} /> Add Branch</button>
                <button className="bg-gradient-to-r from-red-500 to-red-600 hover:opacity-95 text-white py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-md" onClick={() => setShowAddUser(true)}><Plus size={16} /> Add User</button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr] py-3.5 border-b border-[#e5e7eb] text-gray-500 text-xs font-bold min-w-[600px] tracking-wider uppercase">
                <span>NAME & DESIGNATION</span><span>ROLE</span><span>BRANCH</span><span>ACTIONS</span>
              </div>
              {users.map(user => (
                <div className="grid grid-cols-[2fr_1fr_1fr_1fr] items-center py-4 border-b border-[#f9fafb] min-w-[600px] last:border-b-0" key={user.id}>
                  <div>
                    <h4 className="m-0 text-sm font-semibold text-gray-950 mb-0.5">{user.name}</h4>
                    <p className="m-0 text-xs text-gray-500 font-medium">{user.designation || 'Staff Member'}</p>
                  </div>
                  <div>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                      user.role === 'Super Admin' 
                        ? 'bg-pink-100 text-pink-700' 
                        : user.role === 'City Admin' 
                          ? 'bg-sky-100 text-sky-700' 
                          : 'bg-gray-100 text-gray-700'
                    }`}>
                      {user.role}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-600 font-medium">
                    <MapPin size={14} className="text-gray-400" /> {user.cities?.name || 'N/A'}
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => { setEditUserForm(user); setShowEditUserModal(true); }} className="bg-none border-none text-gray-400 hover:text-blue-600 cursor-pointer p-1"><Edit2 size={16} /></button>
                    <button onClick={() => handleDeleteUser(user.id, user.name)} className="bg-none border-none text-gray-400 hover:text-red-600 cursor-pointer p-1"><Trash2 size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* GLOBAL FEEDBACK MODAL (Replaces Alerts) */}
      {modal.isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-[400px] shadow-2xl">
            <h3 className={`text-lg font-bold m-0 mb-2 ${modal.type === 'error' ? 'text-red-600' : 'text-gray-900'}`}>{modal.title}</h3>
            <p className="text-xs text-gray-500 mb-5 leading-relaxed">{modal.message}</p>
            <div className="flex justify-end gap-3">
              {modal.type === 'confirm' ? (
                <>
                  <button className="px-4 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-lg text-xs cursor-pointer" onClick={closeModal}>Cancel</button>
                  <button className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg text-xs border-none cursor-pointer shadow-sm" onClick={modal.onConfirm || undefined}>Confirm Delete</button>
                </>
              ) : (
                <button className="px-4 py-2 bg-brand-red hover:bg-brand-red-hover text-white font-semibold rounded-lg text-xs border-none cursor-pointer shadow-sm" onClick={closeModal}>OK</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ADD BRANCH MODAL */}
      {showAddBranch && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-[400px] shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 m-0 mb-2">Add New Branch</h3>
            <input type="text" placeholder="Branch City (e.g. Coimbatore)" value={newBranchName} onChange={e => setNewBranchName(e.target.value)} className="w-full p-2.5 rounded-lg border border-gray-300 outline-none text-sm focus:border-brand-red mb-5" />
            <div className="flex justify-end gap-3">
              <button className="px-4 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-lg text-xs cursor-pointer" onClick={() => setShowAddBranch(false)}>Cancel</button>
              <button className="px-4 py-2 bg-brand-red hover:bg-brand-red-hover text-white font-semibold rounded-lg text-xs border-none cursor-pointer shadow-sm" onClick={handleAddBranch}>Save Branch</button>
            </div>
          </div>
        </div>
      )}

      {/* ADD NEW USER MODAL */}
      {showAddUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-[600px] shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 m-0 mb-4 border-b border-gray-100 pb-2">Create New User</h3>
            <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-4 mb-6">
              <input type="text" placeholder="Full Name" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} className="p-2.5 rounded-lg border border-gray-300 outline-none text-sm focus:border-brand-red" />
              <input type="text" placeholder="Username" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} className="p-2.5 rounded-lg border border-gray-300 outline-none text-sm focus:border-brand-red" />
              <input type="text" placeholder="Password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} className="p-2.5 rounded-lg border border-gray-300 outline-none text-sm focus:border-brand-red" />
              <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})} className="p-2.5 rounded-lg border border-gray-300 outline-none text-sm bg-white focus:border-brand-red">
                <option value="Staff">Staff</option><option value="City Admin">City Admin</option>
              </select>
              <select value={newUser.city_id} onChange={e => setNewUser({...newUser, city_id: e.target.value})} className="p-2.5 rounded-lg border border-gray-300 outline-none text-sm bg-white focus:border-brand-red">
                {cities.map(city => <option key={city.id} value={city.id}>{city.name}</option>)}
              </select>
              <input type="text" placeholder="Designation" value={newUser.designation} onChange={e => setNewUser({...newUser, designation: e.target.value})} className="p-2.5 rounded-lg border border-gray-300 outline-none text-sm focus:border-brand-red" />
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
              <button className="px-4 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-lg text-xs cursor-pointer" onClick={() => setShowAddUser(false)}>Cancel</button>
              <button className="px-4 py-2 bg-brand-red hover:bg-brand-red-hover text-white font-semibold rounded-lg text-xs border-none cursor-pointer shadow-sm" onClick={handleCreateUser}>Create User</button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT OTHER USER MODAL */}
      {showEditUserModal && editUserForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-[600px] shadow-2xl">
            <div className="flex justify-between items-center mb-5 border-b border-gray-100 pb-3">
              <h3 className="text-lg font-bold text-gray-900 m-0">Edit User: {editUserForm.name}</h3>
              <button onClick={() => setShowEditUserModal(false)} className="bg-none border-none cursor-pointer text-gray-400 hover:text-gray-650"><X size={20} /></button>
            </div>
            <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-4 mb-6">
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Name</label>
                <input type="text" value={editUserForm.name} onChange={e => setEditUserForm({...editUserForm, name: e.target.value})} className="w-full p-2.5 rounded-lg border border-gray-300 outline-none text-sm focus:border-brand-red" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Username</label>
                <input type="text" value={editUserForm.username} onChange={e => setEditUserForm({...editUserForm, username: e.target.value})} className="w-full p-2.5 rounded-lg border border-gray-300 outline-none text-sm focus:border-brand-red" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Override Password</label>
                <input type="text" value={editUserForm.password || ''} onChange={e => setEditUserForm({...editUserForm, password: e.target.value})} className="w-full p-2.5 rounded-lg border border-gray-300 outline-none text-sm focus:border-brand-red" placeholder="Leave empty to keep" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Role</label>
                <select value={editUserForm.role} onChange={e => setEditUserForm({...editUserForm, role: e.target.value})} disabled={editUserForm.role === 'Super Admin'} className="w-full p-2.5 rounded-lg border border-gray-300 outline-none text-sm bg-white focus:border-brand-red disabled:bg-gray-100 disabled:cursor-not-allowed">
                  <option value="Staff">Staff</option><option value="City Admin">City Admin</option><option value="Super Admin">Super Admin</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Branch</label>
                <select value={editUserForm.city_id} onChange={e => setEditUserForm({...editUserForm, city_id: e.target.value})} className="w-full p-2.5 rounded-lg border border-gray-300 outline-none text-sm bg-white focus:border-brand-red">
                  {cities.map(city => <option key={city.id} value={city.id}>{city.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Designation</label>
                <input type="text" value={editUserForm.designation || ''} onChange={e => setEditUserForm({...editUserForm, designation: e.target.value})} className="w-full p-2.5 rounded-lg border border-gray-300 outline-none text-sm focus:border-brand-red" />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
              <button className="px-4 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-lg text-sm cursor-pointer" onClick={() => setShowEditUserModal(false)}>Cancel</button>
              <button className="px-4 py-2 bg-brand-red hover:bg-brand-red-hover text-white font-semibold rounded-lg text-sm border-none cursor-pointer shadow-sm" onClick={handleUpdateOtherUser}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
