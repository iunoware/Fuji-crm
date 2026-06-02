"use client"

import { useState, useEffect, Suspense } from 'react';
// import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  Search, Bell, Plus, Phone, ArrowRight, Eye, Edit2, FileText, Trash2, X, AlertCircle, XOctagon
} from 'lucide-react';

const STATUS_FLOW = ['Lead', 'Converted', 'Quote', 'Quote Approved'];

function LeadsContent() {
  const { currentUser } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const autofillName = searchParams.get('autofillName');
  const autofillPlatform = searchParams.get('autofillPlatform');

  const [isLoading, setIsLoading] = useState(true);
  const [leads, setLeads] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals State
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDescModal, setShowDescModal] = useState(false);
  const [showLossModal, setShowLossModal] = useState(false);
  
  const [activeLead, setActiveLead] = useState<any>(null);
  const [descText, setDescText] = useState('');
  const [lossReason, setLossReason] = useState('');
  
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', city_id: '', pincode: '', source: 'Manual Entry'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (currentUser) {
      fetchLeadsData();
      if (autofillName) {
        setFormData(prev => ({ 
          ...prev, 
          name: autofillName, 
          source: autofillPlatform === 'instagram' || autofillPlatform === 'facebook' ? 'Meta Ads' : 'Manual Entry' 
        }));
        setShowLeadModal(true);
        // Clear query parameters
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [currentUser, autofillName, autofillPlatform]);

  const fetchLeadsData = async () => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      if (currentUser.role === 'Super Admin' && cities.length === 0) {
        const { data: cityData } = await supabase.from('cities').select('*');
        if (cityData) {
          setCities(cityData);
          setFormData(prev => ({ ...prev, city_id: cityData[0]?.id || '' }));
        }
      } else if (currentUser.role !== 'Super Admin') {
        setFormData(prev => ({ ...prev, city_id: String(currentUser.city_id || '') }));
      }

      let leadQuery = supabase.from('leads').select(`*, cities(name)`).order('created_at', { ascending: false });
      
      if (currentUser.role === 'City Admin' || currentUser.role === 'Staff') {
        leadQuery = leadQuery.eq('city_id', currentUser.city_id);
      }

      const { data: leadData } = await leadQuery;
      if (leadData) {
        setLeads(leadData);
      }
    } catch (error) {
      console.error("Error fetching leads:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const openAddModal = () => {
    if (!currentUser) return;
    setActiveLead(null);
    setFormData({ name: '', email: '', phone: '', city_id: String(cities[0]?.id || currentUser.city_id || ''), pincode: '', source: 'Manual Entry' });
    setShowLeadModal(true);
  };

  const openEditModal = (lead: any) => {
    setActiveLead(lead);
    setFormData({
      name: lead.name || '',
      email: lead.email || '',
      phone: lead.phone || '',
      city_id: String(lead.city_id || ''),
      pincode: lead.pincode || '',
      source: lead.source || 'Manual Entry'
    });
    setShowLeadModal(true);
  };

  const handleSaveLead = async () => {
    if (!currentUser) return;
    if (!formData.name || !formData.phone) return alert("Name and Phone are required.");
    setIsSubmitting(true);
    
    try {
      const payload = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        city_id: parseInt(formData.city_id || String(currentUser.city_id || '')),
        source: formData.source,
        pincode: formData.pincode
      };

      if (activeLead) {
        await supabase.from('leads').update({ ...payload }).eq('id', activeLead.id);
      } else {
        await supabase.from('leads').insert([{ ...payload, status: 'Lead' }]);
      }
      
      setShowLeadModal(false);
      fetchLeadsData();
    } catch (error) {
      console.error("Error saving lead:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLead = async (leadId: string | number) => {
    if (!window.confirm("Are you sure you want to permanently delete this lead?")) return;
    try {
      await supabase.from('leads').delete().eq('id', leadId);
      fetchLeadsData();
    } catch (error) {
      console.error("Error deleting lead:", error);
    }
  };

  const handleArrowClick = async (lead: any) => {
    if (lead.status === 'Lost' || lead.status === 'Transferred') return;
    
    let currentIndex = STATUS_FLOW.indexOf(lead.status);
    if (currentIndex === -1) currentIndex = 0;
    
    if (currentIndex < STATUS_FLOW.length - 1) {
      const nextStatus = STATUS_FLOW[currentIndex + 1];
      await supabase.from('leads').update({ status: nextStatus }).eq('id', lead.id);
      fetchLeadsData();
    } else if (currentIndex === STATUS_FLOW.length - 1) {
      if (!window.confirm("Transfer this lead to the Customers module?")) return;
      
      try {
        const { data, error } = await supabase.from('customers').insert([{
          name: lead.name,
          phone: lead.phone,
          email: lead.email,
          city_id: lead.city_id,
          status: 'Invoice',
          product: null,
          units: 0
        }]).select();

        await supabase.from('leads').update({ status: 'Transferred' }).eq('id', lead.id);
        fetchLeadsData();
        
        if (error || !data || data.length === 0) {
          console.error("Transfer DB error (using fallback):", error);
          const fallback = { ...lead, id: Date.now(), status: 'Invoice', product: '', units: 0 };
          const localStr = localStorage.getItem('offline_customers');
          const localCustomers = localStr ? JSON.parse(localStr) : [];
          localCustomers.push(fallback);
          localStorage.setItem('offline_customers', JSON.stringify(localCustomers));
          router.push(`/customers?fallbackCustomerId=${fallback.id}`);
        } else {
          router.push(`/customers?editCustomerId=${data[0].id}`);
        }
      } catch (err) {
        console.error("Transfer error", err);
        await supabase.from('leads').update({ status: 'Transferred' }).eq('id', lead.id);
        const fallback = { ...lead, id: Date.now(), status: 'Invoice', product: '', units: 0 };
        const localStr = localStorage.getItem('offline_customers');
        const localCustomers = localStr ? JSON.parse(localStr) : [];
        localCustomers.push(fallback);
        localStorage.setItem('offline_customers', JSON.stringify(localCustomers));
        router.push(`/customers?fallbackCustomerId=${fallback.id}`);
      }
    }
  };

  const handleSaveDescription = async () => {
    if (!descText.trim() || !activeLead) return;
    setIsSubmitting(true);
    
    let descriptions: Record<string, string> = {};
    try {
      if (activeLead.loss_reason && activeLead.loss_reason.startsWith('{')) {
        descriptions = JSON.parse(activeLead.loss_reason);
      }
    } catch(e) {}
    
    const bullets = descText.split('\n').filter(t => t.trim() !== '');
    const formattedDesc = bullets.map(b => `• ${b.trim()}`).join('\n');
    descriptions[activeLead.status] = formattedDesc;
    
    await supabase.from('leads').update({ loss_reason: JSON.stringify(descriptions) }).eq('id', activeLead.id);
    
    setShowDescModal(false);
    setDescText('');
    setIsSubmitting(false);
    fetchLeadsData();
  };

  const handleProcessLoss = async () => {
    if (!lossReason || !activeLead) return alert("Please provide a reason.");
    setIsSubmitting(true);
    
    let descriptions: Record<string, string> = {};
    try {
      if (activeLead.loss_reason && activeLead.loss_reason.startsWith('{')) {
        descriptions = JSON.parse(activeLead.loss_reason);
      }
    } catch(e) {}
    
    descriptions['Lost'] = lossReason;
    
    await supabase.from('leads').update({ status: 'Lost', loss_reason: JSON.stringify(descriptions) }).eq('id', activeLead.id);
    setShowLossModal(false);
    setLossReason('');
    setIsSubmitting(false);
    fetchLeadsData();
  };

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = lead.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (lead.phone && lead.phone.includes(searchQuery));
    return matchesSearch;
  });

  if (!currentUser) return null;

  return (
    <main className="flex-1 block h-screen overflow-y-auto overflow-x-hidden bg-[#f8fafc]">
      <header className="flex items-center justify-between h-[72px] px-6 bg-[#f8fafc] shrink-0 sticky top-0 z-50 border-b border-[#e5e7eb] max-[768px]:pl-[70px] max-[768px]:justify-end">
        <div className="flex items-center gap-2.5 w-[400px] text-gray-400 bg-white border border-[#e5e7eb] rounded-lg px-3.5 py-2.5 max-[768px]:hidden">
          <Search size={18} color="#9ca3af" />
          <input 
            type="text" 
            placeholder="Search leads..." 
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
          <h1 className="m-0 text-3xl font-extrabold text-gray-900 tracking-tight">Leads Directory</h1>
          <div className="bg-[#bbf7d0] text-[#166534] px-3 py-1.5 rounded-full flex flex-col items-center leading-none">
            <span className="text-base font-extrabold">{filteredLeads.length}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider mt-0.5">Total</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {currentUser.role !== 'Staff' && (
            <button 
              onClick={openAddModal} 
              className="bg-[#16a34a] hover:bg-[#15803d] text-white border-none p-2 px-4 rounded-lg text-sm font-semibold flex items-center gap-1.5 cursor-pointer shadow-md hover:-translate-y-0.5 transition-all duration-300"
            >
              <Plus size={16} /> <span className="max-[768px]:hidden">New Lead</span>
            </button>
          )}
        </div>
      </div>

      <div className="px-6 pb-6 overflow-x-auto">
        <div className="bg-white rounded-2xl border border-[#e5e7eb] shadow-sm min-w-[1100px] overflow-hidden">
          <div 
            style={{ gridTemplateColumns: '1.5fr 1.5fr 1fr 1fr 0.8fr 1.2fr 1.5fr 2fr' }}
            className="grid px-6 py-4 bg-[#f0fdf4] border-b border-[#e5e7eb] text-xs font-bold text-gray-500 tracking-wider"
          >
            <span>NAME</span>
            <span>EMAIL</span>
            <span>PHONE</span>
            <span>CITY</span>
            <span>PINCODE</span>
            <span>RECEIVED FROM</span>
            <span>STATUS</span>
            <span className="text-right">ACTIONS</span>
          </div>

          {filteredLeads.length === 0 ? (
            <div className="py-16 text-center text-gray-500 text-sm">No leads found.</div>
          ) : (
            filteredLeads.map((lead, index) => {
              const isLost = lead.status === 'Lost';
              const isTransferred = lead.status === 'Transferred';
              const isReadOnly = isLost || isTransferred;
              
              let displayLossReason = lead.loss_reason;
              try {
                if (displayLossReason && displayLossReason.startsWith('{')) {
                  const parsed = JSON.parse(displayLossReason);
                  displayLossReason = parsed['Lost'] || 'Unknown reason';
                }
              } catch(e) {}

              return (
                <div 
                  key={lead.id} 
                  style={{ gridTemplateColumns: '1.5fr 1.5fr 1fr 1fr 0.8fr 1.2fr 1.5fr 2fr' }}
                  className={`grid px-6 py-4 items-center bg-white hover:bg-slate-50 transition-colors border-b ${
                    index === filteredLeads.length - 1 ? 'border-b-0' : 'border-b-gray-100'
                  }`}
                >
                  <div><h4 className="m-0 text-sm font-bold text-gray-900">{lead.name}</h4></div>
                  <div className="text-xs text-gray-600 truncate pr-2">{lead.email || '-'}</div>
                  <div className="text-sm text-gray-600 flex items-center gap-1.5"><Phone size={14} className="text-gray-400" /> {lead.phone}</div>
                  <div className="text-xs text-gray-600">{lead.cities?.name || 'Unknown'}</div>
                  <div className="text-xs text-gray-600">{lead.pincode || '-'}</div>
                  <div><span className="bg-gray-100 text-gray-600 p-1 px-2.5 rounded text-xs font-semibold">{lead.source}</span></div>
                  
                  <div>
                    {isLost ? (
                      <div className="flex flex-col">
                        <span className="text-red-600 text-sm font-bold">Lost</span>
                        <span className="text-red-500 text-[11px] mt-0.5">{displayLossReason}</span>
                      </div>
                    ) : isTransferred ? (
                      <span className="text-[#10b981] text-sm font-bold">Transferred</span>
                    ) : (
                      <span className="text-blue-600 text-sm font-bold">{lead.status}</span>
                    )}
                  </div>

                  <div className="flex gap-1.5 justify-end">
                    <button onClick={() => { setActiveLead(lead); setShowViewModal(true); }} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 border-none cursor-pointer text-gray-600" title="View Details"><Eye size={16}/></button>
                    
                    {!isReadOnly && (
                      <>
                        {currentUser.role !== 'Staff' && (
                          <button onClick={() => openEditModal(lead)} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 border-none cursor-pointer text-gray-600" title="Edit"><Edit2 size={16}/></button>
                        )}
                        <button onClick={() => handleArrowClick(lead)} className="p-2 rounded-lg bg-blue-50 hover:bg-blue-100 border-none cursor-pointer text-blue-600" title="Advance Status"><ArrowRight size={16}/></button>
                        <button onClick={() => { setActiveLead(lead); setShowDescModal(true); }} className="p-2 rounded-lg bg-amber-50 hover:bg-amber-100 border-none cursor-pointer text-amber-600" title="Add Description"><FileText size={16}/></button>
                        <button onClick={() => { setActiveLead(lead); setShowLossModal(true); }} className="p-2 rounded-lg bg-red-50 hover:bg-red-100 border-none cursor-pointer text-red-600" title="Mark as Lost"><XOctagon size={16}/></button>
                      </>
                    )}
                    
                    {currentUser.role !== 'Staff' && (
                      <button onClick={() => handleDeleteLead(lead.id)} className="p-2 rounded-lg bg-red-50 hover:bg-red-100 border-none cursor-pointer text-red-600" title="Delete"><Trash2 size={16}/></button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* --- ADD / EDIT MODAL --- */}
      {showLeadModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-[600px] shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5 border-b border-gray-100 pb-3">
              <h3 className="text-lg font-bold text-gray-900 m-0">{activeLead ? 'Edit Lead' : 'Add New Lead'}</h3>
              <button onClick={() => setShowLeadModal(false)} className="bg-none border-none cursor-pointer text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="col-span-2">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Lead Name *</label>
                <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-2.5 rounded-lg border border-gray-300 outline-none text-sm focus:border-brand-red" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Email</label>
                <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full p-2.5 rounded-lg border border-gray-300 outline-none text-sm focus:border-brand-red" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Phone *</label>
                <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full p-2.5 rounded-lg border border-gray-300 outline-none text-sm focus:border-brand-red" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Pincode</label>
                <input type="text" value={formData.pincode} onChange={e => setFormData({...formData, pincode: e.target.value})} className="w-full p-2.5 rounded-lg border border-gray-300 outline-none text-sm focus:border-brand-red" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Received From</label>
                <select value={formData.source} onChange={e => setFormData({...formData, source: e.target.value})} className="w-full p-2.5 rounded-lg border border-gray-300 outline-none text-sm bg-white focus:border-brand-red">
                  <option value="Manual Entry">Manual Entry</option>
                  <option value="Meta Ads">Meta Ads</option>
                  <option value="Google Ads">Google Ads</option>
                  <option value="Referral">Referral</option>
                </select>
              </div>
              {currentUser.role === 'Super Admin' && (
                <div>
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">City</label>
                  <select value={formData.city_id} onChange={e => setFormData({...formData, city_id: e.target.value})} className="w-full p-2.5 rounded-lg border border-gray-300 outline-none text-sm bg-white focus:border-brand-red">
                    {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
              <button className="px-4 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-lg text-sm cursor-pointer" onClick={() => setShowLeadModal(false)}>Cancel</button>
              <button className="px-4 py-2 bg-[#16a34a] hover:bg-[#15803d] text-white font-semibold rounded-lg text-sm border-none cursor-pointer shadow-sm" onClick={handleSaveLead} disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Save Lead'}</button>
            </div>
          </div>
        </div>
      )}

      {/* --- VIEW / HISTORY MODAL --- */}
      {showViewModal && activeLead && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-[600px] shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5 border-b border-gray-100 pb-3">
              <h3 className="text-lg font-bold text-gray-900 m-0">Lead Summary</h3>
              <button onClick={() => setShowViewModal(false)} className="bg-none border-none cursor-pointer text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-xl mb-6 grid grid-cols-2 gap-4">
              <div><span className="text-[10px] font-bold text-gray-400 block tracking-wider">NAME</span><div className="text-sm font-semibold text-gray-900">{activeLead.name}</div></div>
              <div><span className="text-[10px] font-bold text-gray-400 block tracking-wider">PHONE</span><div className="text-sm text-gray-700">{activeLead.phone}</div></div>
              <div><span className="text-[10px] font-bold text-gray-400 block tracking-wider">EMAIL</span><div className="text-sm text-gray-700">{activeLead.email || '-'}</div></div>
              <div><span className="text-[10px] font-bold text-gray-400 block tracking-wider">CITY / PINCODE</span><div className="text-sm text-gray-700">{activeLead.cities?.name || '-'} / {activeLead.pincode || '-'}</div></div>
              <div><span className="text-[10px] font-bold text-gray-400 block tracking-wider">RECEIVED FROM</span><div className="text-sm text-gray-700">{activeLead.source}</div></div>
              <div><span className="text-[10px] font-bold text-gray-400 block tracking-wider">CURRENT STATUS</span><div className="text-sm font-bold text-blue-600">{activeLead.status}</div></div>
            </div>

            <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-3 border-b border-gray-150 pb-2">Status Notes</h4>
            <div className="flex flex-col gap-4">
              {(() => {
                let parsedNotes: Record<string, string> = {};
                try {
                  if (activeLead.loss_reason && activeLead.loss_reason.startsWith('{')) {
                    parsedNotes = JSON.parse(activeLead.loss_reason);
                  }
                } catch(e) {}
                
                const statuses = Object.keys(parsedNotes);
                if (statuses.length === 0) {
                  return <div className="text-xs text-gray-400 text-center py-5">No notes recorded.</div>;
                }
                
                return statuses.map(status => (
                  <div key={status} className="bg-white border border-gray-200 p-3.5 rounded-xl shadow-sm">
                    <div className="flex justify-between mb-1">
                      <span className={`text-xs font-bold ${status === 'Lost' ? 'text-red-600' : 'text-blue-600'}`}>{status}</span>
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
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">Add notes for the current status ({activeLead?.status}). Each line will become a bullet point.</p>
            
            <textarea 
              value={descText} 
              onChange={e => setDescText(e.target.value)} 
              placeholder="Met with client&#10;They requested a new quote&#10;Follow up next week"
              className="w-full h-32 p-3.5 rounded-lg border border-gray-300 outline-none text-xs bg-white focus:border-brand-red resize-none box-border mb-5"
            />
            
            <div className="flex justify-end gap-3">
              <button className="px-4 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-lg text-xs cursor-pointer" onClick={() => { setShowDescModal(false); setDescText(''); }}>Cancel</button>
              <button className="px-4 py-2 bg-brand-red hover:bg-brand-red-hover text-white font-semibold rounded-lg text-xs border-none cursor-pointer shadow-sm" onClick={handleSaveDescription} disabled={isSubmitting}>Save Notes</button>
            </div>
          </div>
        </div>
      )}

      {/* --- LOSS REASON MODAL --- */}
      {showLossModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-[400px] shadow-2xl">
            <h3 className="text-lg font-bold text-red-600 m-0 mb-2 flex items-center gap-2"><AlertCircle size={20}/> Mark Lead as Lost</h3>
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">Please provide a reason why <strong>{activeLead?.name}</strong> did not convert.</p>
            
            <textarea 
              value={lossReason} 
              onChange={e => setLossReason(e.target.value)} 
              placeholder="e.g. Price too high, chose competitor..."
              className="w-full h-24 p-3.5 rounded-lg border border-gray-300 outline-none text-xs bg-white focus:border-red-500 resize-none box-border mb-5"
            />
            
            <div className="flex justify-end gap-3">
              <button className="px-4 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-lg text-xs cursor-pointer" onClick={() => { setShowLossModal(false); setLossReason(''); }}>Cancel</button>
              <button className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg text-xs border-none cursor-pointer shadow-sm" onClick={handleProcessLoss} disabled={isSubmitting}>Confirm Loss</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function Leads() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen w-screen bg-brand-bg">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-brand-red"></div>
      </div>
    }>
      <LeadsContent />
    </Suspense>
  );
}
