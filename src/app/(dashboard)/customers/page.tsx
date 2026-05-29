"use client"

import { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Search, Bell, Eye, Edit2, ArrowRight, FileText, Trash2, X, IndianRupee, CreditCard } from 'lucide-react';

const CUSTOMER_STAGES = ['Invoice', 'Payment', 'Installation'];

function CustomersContent() {
  const { currentUser } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const editCustomerId = searchParams.get('editCustomerId');
  const fallbackCustomerId = searchParams.get('fallbackCustomerId');

  const [customers, setCustomers] = useState<any[]>([]);
  const [inventoryMap, setInventoryMap] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDescModal, setShowDescModal] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  
  const [activeCustomer, setActiveCustomer] = useState<any>(null);
  const [descText, setDescText] = useState('');
  const [tempPrice, setTempPrice] = useState('');
  const [tempPaymentAmount, setTempPaymentAmount] = useState('');
  
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', product: '', units: 0
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => { 
    if (currentUser) {
      fetchCustomersAndInventory().then((allCusts) => {
        const targetId = editCustomerId || fallbackCustomerId;
        if (targetId) {
          const targetIdStr = String(targetId);
          const cust = allCusts?.find(c => String(c.id) === targetIdStr);
          if (cust) {
            setActiveCustomer(cust);
            setFormData({
              name: cust.name || '',
              email: cust.email || '',
              phone: cust.phone || '',
              product: cust.product || '',
              units: cust.units || 0
            });
            setShowEditModal(true);
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        }
      });
    }
  }, [currentUser, editCustomerId, fallbackCustomerId]);

  const fetchCustomersAndInventory = async () => {
    if (!currentUser) return [];
    let dbCustomers: any[] = [];
    try {
      let custQuery = supabase.from('customers').select('*').order('created_at', { ascending: false });
      if (currentUser.role === 'City Admin' || currentUser.role === 'Staff') {
          custQuery = custQuery.eq('city_id', currentUser.city_id);
      }
      const { data } = await custQuery;
      if (data) dbCustomers = data;
    } catch(e) {}
    
    const localStr = localStorage.getItem('offline_customers');
    let localCustomers = localStr ? JSON.parse(localStr) : [];
    if (currentUser.role === 'City Admin' && currentUser.city_id) {
        localCustomers = localCustomers.filter((c: any) => c.city_id == currentUser.city_id);
      }
    
    const combined = [...localCustomers, ...dbCustomers];
    setCustomers(combined);
    
    try {
      let invQuery = supabase.from('inventory_stock').select('id, city_id, components_master(item_name), available_units');
      if (currentUser.role === 'City Admin' && currentUser.city_id) {
          invQuery = invQuery.eq('city_id', currentUser.city_id);
      }
      const { data: invData } = await invQuery;
      if (invData) setInventoryMap(invData);
    } catch(e) {}
    
    return combined;
  };

  const handleArrowClick = async (customer: any) => {
    if (!currentUser) return;
    if (customer.status === 'Transferred to Project') return;

    const currentIndex = CUSTOMER_STAGES.indexOf(customer.status);
    
    // Validations
    if (customer.status === 'Invoice') {
      if (!customer.product || !customer.units) {
        alert("Please set Product and Units by editing before advancing from Invoice.");
        return;
      }
      const stock = inventoryMap.find(i => i.id === parseInt(customer.product));
      if (!stock || stock.available_units < customer.units) {
        alert(`Not enough inventory! Available: ${stock ? stock.available_units : 0}`);
        return;
      }
      
      setActiveCustomer(customer);
      setTempPrice(customer.price || '');
      setShowPriceModal(true);
      return;
    }

    if (currentIndex < CUSTOMER_STAGES.length - 1) {
      const nextStatus = CUSTOMER_STAGES[currentIndex + 1];
      const isLocal = customer.id.toString().length > 10;
      
      if (isLocal) {
        const localStr = localStorage.getItem('offline_customers');
        let localCustomers = localStr ? JSON.parse(localStr) : [];
        localCustomers = localCustomers.map((c: any) => c.id === customer.id ? { ...c, status: nextStatus } : c);
        localStorage.setItem('offline_customers', JSON.stringify(localCustomers));
      } else {
        await supabase.from('customers').update({ status: nextStatus }).eq('id', customer.id);
      }
      fetchCustomersAndInventory();
    } else if (currentIndex === CUSTOMER_STAGES.length - 1) {
      // Transfer to Projects
      const isLocal = customer.id.toString().length > 10;
      
      try {
        // 1. Fetch available staff in customer's city
        const { data: staffData } = await supabase.from('users').select('id').eq('role', 'Staff').eq('city_id', customer.city_id);
        const staffIds = staffData?.map(s => s.id) || [];
        
        // 2. Fetch all active tasks to see who is assigned
        const { data: tasksData } = await supabase.from('tasks').select('assigned_to').neq('status', 'Completed');
        const assignedStaffIds = new Set(tasksData?.map(t => t.assigned_to).filter(Boolean));
        
        // 3. Find unassigned staff
        const availableStaff = staffIds.find(id => !assignedStaffIds.has(id));
        
        await supabase.from('tasks').insert([{
          client_name: customer.name, 
          project_name: `${customer.name} Installation`,
          location: 'Unknown',
          city_id: parseInt(customer.city_id) || null,
          status: 'Pending', 
          assigned_to: availableStaff || null,
          due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        }]);
      } catch (err) {}
      
      if (isLocal) {
        const localStr = localStorage.getItem('offline_customers');
        let localCustomers = localStr ? JSON.parse(localStr) : [];
        localCustomers = localCustomers.map((c: any) => c.id === customer.id ? { ...c, status: 'Transferred to Project' } : c);
        localStorage.setItem('offline_customers', JSON.stringify(localCustomers));
      } else {
        await supabase.from('customers').update({ status: 'Transferred to Project' }).eq('id', customer.id);
      }
      fetchCustomersAndInventory();
      router.push('/projects');
    }
  };

  const openPriceModal = (customer: any) => {
    setActiveCustomer(customer);
    setTempPrice(customer.price || '');
    setShowPriceModal(true);
  };

  const handleConfirmPrice = async () => {
    if (!activeCustomer) return;
    const priceVal = parseFloat(tempPrice) || 0;
    if (priceVal <= 0) {
      alert("Please enter a valid project price.");
      return;
    }
    
    const isLocal = activeCustomer.id.toString().length > 10;
    const currentPaid = parseFloat(activeCustomer.paid) || 0;
    const pendingVal = Math.max(0, priceVal - currentPaid);
    
    if (activeCustomer.status === 'Invoice') {
      const stock = inventoryMap.find(i => i.id === parseInt(activeCustomer.product));
      if (stock) {
        await supabase.from('inventory_stock').update({ available_units: stock.available_units - activeCustomer.units }).eq('id', stock.id);
      }
      
      const nextStatus = 'Payment';
      if (isLocal) {
        const localStr = localStorage.getItem('offline_customers');
        let localCustomers = localStr ? JSON.parse(localStr) : [];
        localCustomers = localCustomers.map((c: any) => c.id === activeCustomer.id ? { 
          ...c, 
          status: nextStatus,
          price: priceVal,
          pending_amount: pendingVal
        } : c);
        localStorage.setItem('offline_customers', JSON.stringify(localCustomers));
      } else {
        await supabase.from('customers').update({ 
          status: nextStatus,
          price: priceVal,
          pending_amount: pendingVal
        }).eq('id', activeCustomer.id);
      }
    } else {
      if (isLocal) {
        const localStr = localStorage.getItem('offline_customers');
        let localCustomers = localStr ? JSON.parse(localStr) : [];
        localCustomers = localCustomers.map((c: any) => c.id === activeCustomer.id ? { 
          ...c, 
          price: priceVal,
          pending_amount: pendingVal
        } : c);
        localStorage.setItem('offline_customers', JSON.stringify(localCustomers));
      } else {
        await supabase.from('customers').update({ 
          price: priceVal,
          pending_amount: pendingVal
        }).eq('id', activeCustomer.id);
      }
    }
    
    setShowPriceModal(false);
    setTempPrice('');
    fetchCustomersAndInventory();
  };

  const handleSavePayment = async () => {
    if (!activeCustomer) return;
    const amountVal = parseFloat(tempPaymentAmount) || 0;
    if (amountVal <= 0) {
      alert("Please enter a valid payment amount.");
      return;
    }
    
    const currentPrice = parseFloat(activeCustomer.price) || 0;
    const currentPaid = parseFloat(activeCustomer.paid) || 0;
    const newPaid = currentPaid + amountVal;
    const pendingVal = Math.max(0, currentPrice - newPaid);
    
    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const newPayment = {
      amount: amountVal,
      timestamp: timestamp
    };
    const updatedPayments = [...(activeCustomer.payments || []), newPayment];
    
    const isLocal = activeCustomer.id.toString().length > 10;
    
    if (isLocal) {
      const localStr = localStorage.getItem('offline_customers');
      let localCustomers = localStr ? JSON.parse(localStr) : [];
      localCustomers = localCustomers.map((c: any) => c.id === activeCustomer.id ? { 
        ...c, 
        paid: newPaid,
        pending_amount: pendingVal,
        payments: updatedPayments
      } : c);
      localStorage.setItem('offline_customers', JSON.stringify(localCustomers));
    } else {
      await supabase.from('customers').update({ 
        paid: newPaid,
        pending_amount: pendingVal,
        payments: updatedPayments
      }).eq('id', activeCustomer.id);
    }
    
    setShowPaymentModal(false);
    setTempPaymentAmount('');
    fetchCustomersAndInventory();
  };

  const openEditModal = (customer: any) => {
    setActiveCustomer(customer);
    setFormData({
      name: customer.name || '',
      email: customer.email || '',
      phone: customer.phone || '',
      product: customer.product || '',
      units: customer.units || 0
    });
    setShowEditModal(true);
  };

  const handleSaveCustomer = async () => {
    if (!activeCustomer) return;
    setIsSubmitting(true);
    
    const updatePayload = { 
      name: formData.name, email: formData.email, phone: formData.phone, 
      product: formData.product, units: parseInt(String(formData.units)) || 0
    };
    
    const isLocal = activeCustomer.id.toString().length > 10;
    if (isLocal) {
      const localStr = localStorage.getItem('offline_customers');
      let localCustomers = localStr ? JSON.parse(localStr) : [];
      localCustomers = localCustomers.map((c: any) => c.id === activeCustomer.id ? { ...c, ...updatePayload } : c);
      localStorage.setItem('offline_customers', JSON.stringify(localCustomers));
    } else {
      await supabase.from('customers').update(updatePayload).eq('id', activeCustomer.id);
    }
    
    setShowEditModal(false);
    fetchCustomersAndInventory();
    setIsSubmitting(false);
  };

  const handleSaveDescription = async () => {
    if (!descText.trim() || !activeCustomer) return;
    setIsSubmitting(true);
    
    const bullets = descText.split('\n').filter(t => t.trim() !== '');
    const formattedDesc = bullets.map(b => `• ${b.trim()}`).join('\n');
    
    const key = `cust_desc_${activeCustomer.id}`;
    const existing = JSON.parse(localStorage.getItem(key) || '{}');
    existing[activeCustomer.status] = formattedDesc;
    localStorage.setItem(key, JSON.stringify(existing));
    
    setShowDescModal(false);
    setDescText('');
    setIsSubmitting(false);
    fetchCustomersAndInventory();
  };

  const isReadOnly = (status: string) => status === 'Transferred to Project';

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (c.phone && c.phone.includes(searchQuery))
  );

  if (!currentUser) return null;

  return (
    <main className="flex-1 block h-screen overflow-y-auto overflow-x-hidden bg-[#f8fafc]">
      <header className="flex items-center justify-between h-[72px] px-6 bg-[#f8fafc] shrink-0 sticky top-0 z-50 border-b border-[#e5e7eb] max-[768px]:pl-[70px] max-[768px]:justify-end">
        <div className="flex items-center gap-2.5 w-[400px] text-gray-400 bg-white border border-[#e5e7eb] rounded-lg px-3.5 py-2.5 max-[768px]:hidden">
          <Search size={18} color="#9ca3af" />
          <input 
            type="text" 
            placeholder="Search customers..." 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            className="border-none bg-transparent outline-none flex-1 text-sm text-brand-text"
          />
        </div>
        <div className="flex items-center gap-4">
          <Link href="/remainder" className="text-gray-500 relative flex items-center justify-center p-2 rounded-lg border border-[#e5e7eb] bg-white hover:bg-gray-50 transition-colors">
            <Bell size={20} color="#4b5563" />
          </Link>
        </div>
      </header>

      <div className="px-6 py-6 pb-4 flex justify-between items-center flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <h1 className="m-0 text-3xl font-extrabold text-gray-900 tracking-tight">Customers Pipeline</h1>
          <div className="bg-[#dbeafe] text-[#1e40af] px-3 py-1.5 rounded-full flex flex-col items-center leading-none">
            <span className="text-base font-extrabold">{filteredCustomers.length}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider mt-0.5">Total</span>
          </div>
        </div>
      </div>

      <div className="px-6 pb-6 overflow-x-auto">
        <div className="bg-white rounded-2xl border border-[#e5e7eb] shadow-sm min-w-[1100px] overflow-hidden">
          <div 
            style={{ gridTemplateColumns: '1.2fr 1.2fr 0.9fr 1.2fr 0.6fr 1fr 1fr 1fr 2fr' }}
            className="grid px-6 py-4 bg-[#eff6ff] border-b border-[#e5e7eb] text-xs font-bold text-gray-500 tracking-wider"
          >
            <span>NAME</span>
            <span>EMAIL</span>
            <span>PHONE</span>
            <span>PRODUCT</span>
            <span>UNITS</span>
            <span>PRICE</span>
            <span>PENDING</span>
            <span>STATUS</span>
            <span className="text-right">ACTIONS</span>
          </div>

          {filteredCustomers.length === 0 ? (
            <div className="py-16 text-center text-gray-500 text-sm">No customers found.</div>
          ) : (
            filteredCustomers.map((cust, index) => {
              const readOnly = isReadOnly(cust.status);
              return (
                <div 
                  key={cust.id} 
                  style={{ gridTemplateColumns: '1.2fr 1.2fr 0.9fr 1.2fr 0.6fr 1fr 1fr 1fr 2fr' }}
                  className={`grid px-6 py-4 items-center bg-white hover:bg-slate-50 transition-colors border-b ${
                    index === filteredCustomers.length - 1 ? 'border-b-0' : 'border-b-gray-100'
                  }`}
                >
                  <div><h4 className="m-0 text-sm font-bold text-gray-900">{cust.name}</h4></div>
                  <div className="text-xs text-gray-600 truncate pr-2">{cust.email || '-'}</div>
                  <div className="text-sm text-gray-600">{cust.phone}</div>
                  <div className="text-xs text-brand-red font-bold truncate pr-2">
                    {inventoryMap.find(i => String(i.id) === String(cust.product))?.components_master?.item_name || 'Not Set'}
                  </div>
                  <div className="text-sm font-bold text-gray-700">{cust.units || 0}</div>
                  <div className="text-sm font-bold text-blue-800">{cust.price ? `₹${cust.price}` : '-'}</div>
                  <div className="text-sm font-bold text-red-600">{cust.pending_amount !== undefined ? `₹${cust.pending_amount}` : '-'}</div>
                  
                  <div>
                    {readOnly ? (
                      <span className="text-[#10b981] text-sm font-bold">Transferred</span>
                    ) : (
                      <span className="text-blue-600 text-sm font-bold">{cust.status}</span>
                    )}
                  </div>

                  <div className="flex gap-1.5 justify-end">
                    <button onClick={() => { setActiveCustomer(cust); setShowViewModal(true); }} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 border-none cursor-pointer text-gray-600" title="View"><Eye size={16}/></button>
                    
                    {!readOnly && (
                      <>
                        {currentUser.role !== 'Staff' && (
                          <button onClick={() => openEditModal(cust)} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 border-none cursor-pointer text-gray-600" title="Edit"><Edit2 size={16}/></button>
                        )}
                        <button onClick={() => handleArrowClick(cust)} className="p-2 rounded-lg bg-blue-50 hover:bg-blue-100 border-none cursor-pointer text-blue-600" title="Advance Status"><ArrowRight size={16}/></button>
                        <button onClick={() => openPriceModal(cust)} className="p-2 rounded-lg bg-[#e0e7ff] hover:bg-[#c7d2fe] border-none cursor-pointer text-[#4338ca]" title="Project Price"><IndianRupee size={16}/></button>
                        
                        {(cust.status === 'Payment' || cust.status === 'Installation') && (
                          <button onClick={() => { setActiveCustomer(cust); setTempPaymentAmount(''); setShowPaymentModal(true); }} className="p-2 rounded-lg bg-green-50 hover:bg-green-100 border-none cursor-pointer text-green-600" title="Record Payment"><CreditCard size={16}/></button>
                        )}
                        
                        <button onClick={() => { setActiveCustomer(cust); setShowDescModal(true); }} className="p-2 rounded-lg bg-amber-50 hover:bg-amber-100 border-none cursor-pointer text-amber-600" title="Add Description"><FileText size={16}/></button>
                      </>
                    )}
                    
                    {currentUser.role !== 'Staff' && (
                      <button 
                        onClick={async () => { 
                          if(window.confirm('Are you sure you want to permanently delete this record?')) { 
                            const isLocal = cust.id.toString().length > 10;
                            if (isLocal) {
                              const localStr = localStorage.getItem('offline_customers');
                              let localCustomers = localStr ? JSON.parse(localStr) : [];
                              localCustomers = localCustomers.filter((c: any) => c.id !== cust.id);
                              localStorage.setItem('offline_customers', JSON.stringify(localCustomers));
                            } else {
                              await supabase.from('customers').delete().eq('id', cust.id); 
                            }
                            fetchCustomersAndInventory(); 
                          } 
                        }} 
                        className="p-2 rounded-lg bg-red-50 hover:bg-red-100 border-none cursor-pointer text-red-600" 
                        title="Delete"
                      >
                        <Trash2 size={16}/>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* --- EDIT MODAL --- */}
      {showEditModal && activeCustomer && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-[600px] shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5 border-b border-gray-100 pb-3">
              <h3 className="text-lg font-bold text-gray-900 m-0">Edit Customer Details</h3>
              <button onClick={() => setShowEditModal(false)} className="bg-none border-none cursor-pointer text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="col-span-2">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Name</label>
                <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-2.5 rounded-lg border border-gray-300 outline-none text-sm focus:border-brand-red" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Email</label>
                <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full p-2.5 rounded-lg border border-gray-300 outline-none text-sm focus:border-brand-red" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Phone</label>
                <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full p-2.5 rounded-lg border border-gray-300 outline-none text-sm focus:border-brand-red" />
              </div>
              <div className="col-span-2">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Product Selection</label>
                <select value={formData.product} onChange={e => setFormData({...formData, product: e.target.value})} className="w-full p-2.5 rounded-lg border border-gray-300 outline-none text-sm bg-white focus:border-brand-red">
                  <option value="">-- Select Product --</option>
                  {inventoryMap.filter(inv => inv.city_id == activeCustomer?.city_id).map(inv => (
                    <option key={inv.id} value={inv.id}>{inv.components_master.item_name} (Stock: {inv.available_units})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Units Required</label>
                <input type="number" min="0" value={formData.units} onChange={e => setFormData({...formData, units: parseInt(e.target.value) || 0})} className="w-full p-2.5 rounded-lg border border-gray-300 outline-none text-sm focus:border-brand-red" />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
              <button className="px-4 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-lg text-sm cursor-pointer" onClick={() => setShowEditModal(false)}>Cancel</button>
              <button className="px-4 py-2 bg-blue-800 hover:bg-blue-900 text-white font-semibold rounded-lg text-sm border-none cursor-pointer shadow-sm" onClick={handleSaveCustomer} disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Save Customer'}</button>
            </div>
          </div>
        </div>
      )}

      {/* --- VIEW / HISTORY MODAL --- */}
      {showViewModal && activeCustomer && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-[600px] shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5 border-b border-gray-100 pb-3">
              <h3 className="text-lg font-bold text-gray-900 m-0">Customer Summary</h3>
              <button onClick={() => setShowViewModal(false)} className="bg-none border-none cursor-pointer text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-xl mb-6 grid grid-cols-2 gap-4">
              <div><span className="text-[10px] font-bold text-gray-400 block tracking-wider">NAME</span><div className="text-sm font-semibold text-gray-900">{activeCustomer.name}</div></div>
              <div><span className="text-[10px] font-bold text-gray-400 block tracking-wider">PHONE</span><div className="text-sm text-gray-700">{activeCustomer.phone}</div></div>
              <div><span className="text-[10px] font-bold text-gray-400 block tracking-wider">EMAIL</span><div className="text-sm text-gray-700">{activeCustomer.email || '-'}</div></div>
              <div><span className="text-[10px] font-bold text-gray-400 block tracking-wider">PRODUCT</span><div className="text-sm text-gray-700">{inventoryMap.find(i => String(i.id) === String(activeCustomer.product))?.components_master?.item_name || 'Not Set'}</div></div>
              <div><span className="text-[10px] font-bold text-gray-400 block tracking-wider">UNITS</span><div className="text-sm text-gray-700">{activeCustomer.units || 0}</div></div>
              <div><span className="text-[10px] font-bold text-gray-400 block tracking-wider">CURRENT STATUS</span><div className="text-sm font-bold text-blue-600">{activeCustomer.status}</div></div>
            </div>

            <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-3 border-b border-gray-150 pb-2">Pricing & Payments</h4>
            <div className="bg-[#f0fdf4] p-4 rounded-xl mb-6 grid grid-cols-3 gap-4">
              <div><span className="text-[10px] font-bold text-green-700 block tracking-wider">TOTAL PRICE</span><div className="text-sm font-bold text-green-800">{activeCustomer.price ? `₹${activeCustomer.price}` : 'Not Set'}</div></div>
              <div><span className="text-[10px] font-bold text-green-700 block tracking-wider">TOTAL PAID</span><div className="text-sm font-bold text-green-600">₹{activeCustomer.paid || 0}</div></div>
              <div><span className="text-[10px] font-bold text-red-800 block tracking-wider">PENDING AMOUNT</span><div className="text-sm font-bold text-red-600">₹{activeCustomer.pending_amount !== undefined ? activeCustomer.pending_amount : (activeCustomer.price || 0)}</div></div>
            </div>

            <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-3 border-b border-gray-150 pb-2">Payment History Logs</h4>
            <div className="flex flex-col gap-2.5 mb-6">
              {activeCustomer.payments && activeCustomer.payments.length > 0 ? (
                activeCustomer.payments.map((p: any, idx: number) => (
                  <div key={idx} className="bg-white border border-gray-200 p-3 rounded-lg flex justify-between items-center shadow-sm">
                    <span className="text-xs font-bold text-green-600">+ ₹{p.amount}</span>
                    <span className="text-xs text-gray-500">Provided on: {p.timestamp}</span>
                  </div>
                ))
              ) : (
                <div className="text-xs text-gray-400 text-center py-4 bg-gray-50 rounded-lg">No payment logs recorded.</div>
              )}
            </div>

            <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-3 border-b border-gray-150 pb-2">Status Notes</h4>
            <div className="flex flex-col gap-4">
              {(() => {
                const key = `cust_desc_${activeCustomer.id}`;
                const parsedNotes = JSON.parse(localStorage.getItem(key) || '{}');
                const statuses = Object.keys(parsedNotes);
                
                if (statuses.length === 0) {
                  return <div className="text-xs text-gray-400 text-center py-5">No notes recorded.</div>;
                }
                
                return statuses.map(status => (
                  <div key={status} className="bg-white border border-gray-200 p-3.5 rounded-xl shadow-sm">
                    <div className="flex justify-between mb-1">
                      <span className="text-xs font-bold text-blue-600">{status}</span>
                    </div>
                    <div className="bg-gray-50 p-2.5 rounded-lg text-xs text-gray-700 white-space-pre-wrap mt-1 leading-relaxed">
                      {parsedNotes[status]}
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {/* --- ADD DESCRIPTION MODAL --- */}
      {showDescModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-[400px] shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 m-0 mb-2 flex items-center gap-2"><FileText size={20}/> Add Description</h3>
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">Add notes for the current status ({activeCustomer?.status}).</p>
            
            <textarea 
              value={descText} 
              onChange={e => setDescText(e.target.value)} 
              placeholder="Sent invoice to client&#10;Waiting for payment"
              className="w-full h-32 p-3.5 rounded-lg border border-gray-300 outline-none text-xs bg-white focus:border-brand-red resize-none box-border mb-5"
            />
            
            <div className="flex justify-end gap-3">
              <button className="px-4 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-lg text-xs cursor-pointer" onClick={() => { setShowDescModal(false); setDescText(''); }}>Cancel</button>
              <button className="px-4 py-2 bg-brand-red hover:bg-brand-red-hover text-white font-semibold rounded-lg text-xs border-none cursor-pointer shadow-sm" onClick={handleSaveDescription} disabled={isSubmitting}>Save Notes</button>
            </div>
          </div>
        </div>
      )}

      {/* --- PROJECT PRICE MODAL --- */}
      {showPriceModal && activeCustomer && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-[400px] shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 m-0 mb-2 flex items-center gap-2">
              <IndianRupee size={20} /> Project Price
            </h3>
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              Enter the total project price for <strong>{activeCustomer.name}</strong> to advance status to Payment.
            </p>
            
            <input 
              type="number" 
              value={tempPrice} 
              onChange={e => setTempPrice(e.target.value)} 
              placeholder="e.g. 150000"
              className="w-full p-2.5 rounded-lg border border-gray-300 outline-none text-sm focus:border-brand-red mb-5"
            />
            
            <div className="flex justify-end gap-3">
              <button className="px-4 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-lg text-xs cursor-pointer" onClick={() => { setShowPriceModal(false); setTempPrice(''); }}>Cancel</button>
              <button className="px-4 py-2 bg-blue-800 hover:bg-blue-955 text-white font-semibold rounded-lg text-xs border-none cursor-pointer shadow-sm" onClick={handleConfirmPrice}>Save & Advance</button>
            </div>
          </div>
        </div>
      )}

      {/* --- RECORD PAYMENT MODAL --- */}
      {showPaymentModal && activeCustomer && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-[400px] shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 m-0 mb-2 flex items-center gap-2">
              <CreditCard size={20} /> Record Payment
            </h3>
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              Enter payment amount received from <strong>{activeCustomer.name}</strong>.
            </p>
            
            <div className="bg-gray-50 p-3 rounded-lg mb-4 text-xs flex flex-col gap-1">
              <div><strong>Project Price:</strong> ₹{activeCustomer.price || 0}</div>
              <div><strong>Pending Amount:</strong> ₹{activeCustomer.pending_amount !== undefined ? activeCustomer.pending_amount : (activeCustomer.price || 0)}</div>
            </div>
            
            <input 
              type="number" 
              value={tempPaymentAmount} 
              onChange={e => setTempPaymentAmount(e.target.value)} 
              placeholder="e.g. 50000"
              className="w-full p-2.5 rounded-lg border border-gray-300 outline-none text-sm focus:border-brand-red mb-5"
            />
            
            <div className="flex justify-end gap-3">
              <button className="px-4 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-lg text-xs cursor-pointer" onClick={() => { setShowPaymentModal(false); setTempPaymentAmount(''); }}>Cancel</button>
              <button className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg text-xs border-none cursor-pointer shadow-sm" onClick={handleSavePayment}>Save Payment</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function Customers() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen w-screen bg-brand-bg">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-brand-red"></div>
      </div>
    }>
      <CustomersContent />
    </Suspense>
  );
}
