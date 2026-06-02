"use client"

import { useState, useEffect } from 'react';
// import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Search, Bell, Plus, Download, Upload, AlertCircle, Loader2, Edit2, Trash2, X, Sliders } from 'lucide-react';
import Link from 'next/link';
import Papa from 'papaparse';

export default function Inventory() {
  const { currentUser } = useAuth();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cities, setCities] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [unitsList, setUnitsList] = useState<any[]>([]); 
  const [activeCityTab, setActiveCityTab] = useState<string | number>('All');
  
  // Search State
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddStockModal, setShowAddStockModal] = useState(false);
  const [showUnitsModal, setShowUnitsModal] = useState(false); 
  
  // Custom Modal
  const [modal, setModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'info' | 'error' | 'confirm';
    onConfirm: (() => void) | null;
  }>({ isOpen: false, title: '', message: '', type: 'info', onConfirm: null });

  // Form States
  const [newItem, setNewItem] = useState({ item_name: '', category: '', unit: '', rate: '', initial_stock: '', city_id: '' });
  const [editItem, setEditItem] = useState<any>(null);
  const [activeStockItem, setActiveStockItem] = useState<any>(null);
  const [stockToAdd, setStockToAdd] = useState('');

  // Units Form States
  const [newUnitName, setNewUnitName] = useState('');
  const [editingUnitId, setEditingUnitId] = useState<number | null>(null);
  const [editUnitName, setEditUnitName] = useState('');

  useEffect(() => {
    if (currentUser) {
      if (currentUser.role !== 'Super Admin') {
        setActiveCityTab(String(currentUser.city_id || ''));
      }
      fetchData(true);
      const liveInterval = setInterval(() => {
        fetchData(false);
      }, 10000);
      
      return () => clearInterval(liveInterval);
    }
  }, [currentUser]);

  const fetchData = async (showSpinner = true) => {
    if (!currentUser) return;
    if (showSpinner) setIsLoading(true);
    
    try {
      const { data: cityData } = await supabase.from('cities').select('*');
      if (cityData) {
        setCities(cityData);
        const defaultCityId = currentUser.role === 'Super Admin' ? cityData[0]?.id : currentUser.city_id;
        setNewItem(prev => ({ ...prev, city_id: prev.city_id || String(defaultCityId || '') })); 
      }

      const { data: fetchedUnits } = await supabase.from('units').select('*').order('id', { ascending: true });
      if (fetchedUnits) {
        setUnitsList(fetchedUnits);
        setNewItem(prev => ({ ...prev, unit: prev.unit || fetchedUnits[0]?.unit_name || '' }));
      }

      const { data: stockData } = await supabase
        .from('inventory_stock')
        .select(`
          id, total_units, available_units, city_id,
          components_master (id, item_name, category, unit, rate),
          cities (name)
        `)
        .order('id', { ascending: false });
        
      if (stockData) setInventory(stockData);
    } catch (error) {
      console.error("Fetch error:", error);
    } finally {
      if (showSpinner) setIsLoading(false);
    }
  };

  const closeModal = () => setModal(prev => ({ ...prev, isOpen: false }));
  const showSuccess = (msg: string) => setModal({ isOpen: true, title: 'Success', message: msg, type: 'info', onConfirm: null });
  const showError = (msg: string) => setModal({ isOpen: true, title: 'Error', message: msg, type: 'error', onConfirm: null });
  const showConfirm = (title: string, msg: string, onConfirmAction: () => void) => setModal({ isOpen: true, title, message: msg, type: 'confirm', onConfirm: onConfirmAction });

  const filteredInventory = inventory.filter(item => {
    const matchesCity = activeCityTab === 'All' || String(item.city_id) === String(activeCityTab);
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = item.components_master && (
      (item.components_master.item_name && item.components_master.item_name.toLowerCase().includes(searchLower)) ||
      (item.components_master.category && item.components_master.category.toLowerCase().includes(searchLower))
    );
    return matchesCity && matchesSearch;
  });

  // --- UNIT CRUD ---
  const handleAddUnit = async () => {
    if (!newUnitName.trim()) return showError("Unit name cannot be empty.");
    try {
      await supabase.from('units').insert([{ unit_name: newUnitName.trim().toUpperCase() }]);
      setNewUnitName('');
      await fetchData(false); 
    } catch (err) {
      showError("Failed to add unit. It might already exist.");
    }
  };

  const handleUpdateUnit = async (id: number) => {
    if (!editUnitName.trim()) return;
    try {
      await supabase.from('units').update({ unit_name: editUnitName.trim().toUpperCase() }).eq('id', id);
      setEditingUnitId(null);
      await fetchData(false);
    } catch (err) {
      showError("Update failed.");
    }
  };

  const handleDeleteUnit = async (id: number, name: string) => {
    showConfirm("Delete Unit", `Are you sure you want to delete '${name}'?`, async () => {
      try {
        await supabase.from('units').delete().eq('id', id);
        await fetchData(false);
        closeModal();
      } catch (err) {
        showError("Failed to delete unit.");
      }
    });
  };

  // --- ADD NEW ITEM ---
  const handleAddNewItem = async () => {
    if (!currentUser) return;
    if (!newItem.item_name || !newItem.rate) return showError("Item name and rate are required!");
    setIsSubmitting(true);
    try {
      const { data: componentData, error: compError } = await supabase.from('components_master').insert([{
        item_name: newItem.item_name, category: newItem.category, unit: newItem.unit, rate: parseFloat(newItem.rate)
      }]).select().single();
      
      if (compError) throw compError;

      const stockQty = parseInt(newItem.initial_stock) || 0;
      let targetCityId = currentUser.role === 'Super Admin' ? parseInt(newItem.city_id) : currentUser.city_id;
      if (!targetCityId && cities.length > 0) targetCityId = cities[0].id; 

      const { error: stockError } = await supabase.from('inventory_stock').insert([{
        component_id: componentData.id, city_id: targetCityId, total_units: stockQty, available_units: stockQty
      }]);

      if (stockError) throw stockError;

      setShowAddModal(false);
      setNewItem({ 
        item_name: '', category: '', unit: unitsList[0]?.unit_name || 'NOS', 
        rate: '', initial_stock: '', 
        city_id: currentUser.role === 'Super Admin' ? String(cities[0]?.id || '') : String(currentUser.city_id || '') 
      });
      
      if (currentUser.role === 'Super Admin' && activeCityTab !== 'All' && String(activeCityTab) !== String(targetCityId)) {
        setActiveCityTab(targetCityId);
      }
      
      await fetchData(false);
      showSuccess("New item added to inventory successfully!");
    } catch (error) {
      showError("Failed to add new item.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- EDIT ITEM ---
  const handleEditItemSubmit = async () => {
    if (!editItem?.components_master?.item_name) return showError("Item name is required!");
    setIsSubmitting(true);
    try {
      await supabase.from('components_master').update({
        item_name: editItem.components_master.item_name, category: editItem.components_master.category,
        unit: editItem.components_master.unit, rate: parseFloat(editItem.components_master.rate)
      }).eq('id', editItem.components_master.id);

      const newStockVal = parseInt(editItem.available_units) || 0;
      await supabase.from('inventory_stock').update({
        available_units: newStockVal, total_units: newStockVal 
      }).eq('id', editItem.id);

      setShowEditModal(false);
      await fetchData(false);
      showSuccess("Component details and stock updated successfully!");
    } catch (error) {
      showError("Failed to update item.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- ADD EXISTING STOCK ---
  const handleAddExistingStock = async () => {
    const qty = parseInt(stockToAdd);
    if (!qty || qty <= 0) return showError("Please enter a valid quantity to add.");
    setIsSubmitting(true);
    try {
      await supabase.from('inventory_stock').update({
        total_units: activeStockItem.total_units + qty,
        available_units: activeStockItem.available_units + qty
      }).eq('id', activeStockItem.id);

      setShowAddStockModal(false);
      setStockToAdd('');
      await fetchData(false);
      showSuccess(`Successfully added ${qty} units to stock!`);
    } catch (error) {
      showError("Failed to update stock quantity.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- DELETE STOCK ---
  const handleDeleteStock = (stockId: number, itemName: string) => {
    showConfirm("Delete Item", `Are you sure you want to permanently delete '${itemName}' from this warehouse?`, async () => {
      try {
        await supabase.from('inventory_stock').delete().eq('id', stockId);
        await fetchData(false);
        closeModal();
      } catch (error) {
        showError("Failed to delete item.");
      }
    });
  };

  // --- IMPORT CSV ---
  const downloadTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8,Item Name,Category,Unit,Rate,Initial Stock\nSolar Panel 540W,Panels,NOS,12000,50";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "fuji_solar_inventory_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentUser) return;

    Papa.parse(file, {
      header: true,
      complete: async (results) => {
        setIsLoading(true);
        try {
          const rows = results.data as any[];
          let addedCount = 0;
          const targetCityId = currentUser.role === 'Super Admin' ? (activeCityTab === 'All' ? cities[0].id : parseInt(String(activeCityTab))) : currentUser.city_id; 

          for (let row of rows) {
            if (!row['Item Name']) continue;
            let componentId;
            const { data: existingComponent } = await supabase.from('components_master').select('id').eq('item_name', row['Item Name']).single();
            
            if (existingComponent) {
              componentId = existingComponent.id;
            } else {
              const { data: newComponent } = await supabase.from('components_master').insert([{
                item_name: row['Item Name'], category: row['Category'] || 'General', unit: row['Unit'] || 'NOS', rate: parseFloat(row['Rate']) || 0
              }]).select().single();
              componentId = newComponent.id;
            }

            const stockQty = parseInt(row['Initial Stock']) || 0;
            const { data: existingStock } = await supabase.from('inventory_stock').select('*').eq('component_id', componentId).eq('city_id', targetCityId).single();

            if (existingStock) {
              await supabase.from('inventory_stock').update({ total_units: existingStock.total_units + stockQty, available_units: existingStock.available_units + stockQty }).eq('id', existingStock.id);
            } else {
              await supabase.from('inventory_stock').insert([{ component_id: componentId, city_id: targetCityId, total_units: stockQty, available_units: stockQty }]);
            }
            addedCount++;
          }
          setShowImportModal(false);
          await fetchData(false);
          showSuccess(`Successfully imported ${addedCount} items to the warehouse!`);
        } catch (error) {
          showError("There was an error processing your file. Please check the format.");
        } finally {
          setIsLoading(false);
        }
      }
    });
  };

  if (!currentUser) return null;

  return (
    <main className="flex-1 block h-screen overflow-y-auto overflow-x-hidden bg-brand-bg">
      <header className="flex items-center justify-between h-[72px] px-6 bg-white border-b border-[#e5e7eb] sticky top-0 z-50 shrink-0 max-[768px]:pl-[70px] max-[768px]:justify-end">
        <div className="flex items-center gap-2.5 w-[400px] text-gray-400 bg-[#f9f8fc] border border-[#e5e4e7] rounded-lg px-3.5 py-2.5 max-[768px]:hidden">
          <Search size={18} />
          <input type="text" placeholder="Search by name or category..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="border-none bg-transparent outline-none flex-1 text-sm text-brand-text" />
        </div>
        <div className="flex items-center gap-4">
          <Link href="/remainder" className="text-gray-500 relative flex items-center justify-center p-2 rounded-lg border border-[#e5e7eb] bg-white hover:bg-gray-50 transition-colors">
            <Bell size={20} className="text-gray-600" />
          </Link>
        </div>
      </header>

      <div className="px-6 py-6 pb-[10px] flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Warehouse Inventory</h1>
          <p className="text-sm text-gray-500 mt-1">Manage solar components and stock levels.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="bg-transparent border border-gray-300 hover:bg-gray-50 text-gray-700 py-2 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm" onClick={() => setShowImportModal(true)}>
            <Upload size={16} /> <span className="max-[768px]:hidden">Import</span>
          </button>
          <button className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 py-2 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm" onClick={() => setShowUnitsModal(true)}>
            <Sliders size={16} /> <span className="max-[768px]:hidden">Add Units</span>
          </button>
          <button onClick={() => setShowAddModal(true)} className="bg-brand-red hover:bg-brand-red-hover text-white border-none py-2 px-4 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-md">
            <Plus size={16} /> <span className="max-[768px]:hidden">Add New Item</span>
          </button>
        </div>
      </div>

      {/* RBAC TABS */}
      <div className="px-6 border-b border-gray-200 flex gap-6 overflow-x-auto whitespace-nowrap select-none">
        {currentUser.role === 'Super Admin' ? (
          <>
            <button onClick={() => setActiveCityTab('All')} className={`py-3 px-0 text-sm font-semibold cursor-pointer border-b-2 transition-colors ${activeCityTab === 'All' ? 'text-brand-red border-brand-red' : 'text-gray-500 border-transparent'}`}>All Branches</button>
            {cities.map(city => (
              <button key={city.id} onClick={() => setActiveCityTab(city.id)} className={`py-3 px-0 text-sm font-semibold cursor-pointer border-b-2 transition-colors ${activeCityTab === city.id ? 'text-brand-red border-brand-red' : 'text-gray-500 border-transparent'}`}>
                {city.name} Warehouse
              </button>
            ))}
          </>
        ) : (
           <button className="py-3 px-0 text-sm font-semibold border-b-2 border-brand-red text-brand-red cursor-default">
              {cities.find(c => c.id === currentUser.city_id)?.name || 'Your'} Warehouse
           </button>
        )}
      </div>

      {/* INVENTORY TABLE */}
      <div className="p-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-0">
          {isLoading ? (
             <div className="py-16 text-center"><Loader2 className="animate-spin text-brand-red mx-auto" size={30} /></div>
          ) : (
            <div className="overflow-x-auto">
              <div 
                style={{ gridTemplateColumns: '2fr 1.5fr 1fr 1.2fr 1fr 1fr 1fr' }}
                className="grid px-6 py-4 bg-slate-50 border-b border-slate-200 text-xs font-bold text-gray-500 tracking-wider min-w-[900px]"
              >
                <span>ITEM NAME</span><span>CATEGORY</span><span>BRANCH</span><span>UNIT PRICE</span><span>AVAILABLE</span><span>STATUS</span><span>ACTIONS</span>
              </div>
              {filteredInventory.map(item => (
                <div 
                  key={item.id} 
                  style={{ gridTemplateColumns: '2fr 1.5fr 1fr 1.2fr 1fr 1fr 1fr' }}
                  className="grid px-6 py-4 items-center bg-white border-b border-slate-100 hover:bg-slate-50 transition-colors min-w-[900px] last:border-b-0"
                >
                  <h4 className="m-0 text-sm font-semibold text-gray-900">{item.components_master?.item_name || 'Unknown'}</h4>
                  <div className="text-xs text-gray-500 font-medium">{item.components_master?.category || 'Uncategorized'}</div>
                  <div className="text-xs font-bold text-gray-800">{item.cities?.name || 'N/A'}</div>
                  <div className="text-xs text-gray-500 font-medium">₹{item.components_master?.rate || 0} / {item.components_master?.unit || 'NOS'}</div>
                  <div className="text-sm font-bold text-gray-950">{item.available_units}</div>
                  <div>
                    {item.available_units > 10 ? (
                      <span className="text-xs px-2.5 py-1 rounded bg-green-50 text-green-700 font-bold border border-green-200">In Stock</span>
                    ) : (
                      <span className="text-xs px-2.5 py-1 rounded bg-red-50 text-red-700 font-bold border border-red-200 inline-flex items-center gap-1"><AlertCircle size={12}/> Low Stock</span>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <button onClick={() => { setEditItem(JSON.parse(JSON.stringify(item))); setShowEditModal(true); }} className="bg-slate-100 hover:bg-slate-200 border-none p-1.5 rounded-lg text-gray-600 cursor-pointer flex items-center justify-center" title="Edit Details & Override Stock"><Edit2 size={15} /></button>
                    <button onClick={() => { setActiveStockItem(item); setShowAddStockModal(true); }} className="bg-indigo-50 hover:bg-indigo-100 border-none p-1.5 rounded-lg text-indigo-700 cursor-pointer flex items-center justify-center" title="Quick Add Stock"><Plus size={15} /></button>
                    <button onClick={() => handleDeleteStock(item.id, item.components_master?.item_name)} className="bg-red-50 hover:bg-red-100 border-none p-1.5 rounded-lg text-red-600 cursor-pointer flex items-center justify-center" title="Delete Item"><Trash2 size={15} /></button>
                  </div>
                </div>
              ))}
              {filteredInventory.length === 0 && (
                 <div className="py-16 text-center text-gray-500 text-sm">No stock found matching your criteria.</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ALL MODALS */}
      {showUnitsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-[500px] shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-100 shrink-0">
              <h3 className="text-lg font-bold text-gray-900 m-0">Manage Measurement Units</h3>
              <button onClick={() => setShowUnitsModal(false)} className="bg-none border-none cursor-pointer text-gray-400 hover:text-gray-650"><X size={20} /></button>
            </div>

            <div className="flex gap-2 mb-4 shrink-0">
              <input type="text" value={newUnitName} onChange={e => setNewUnitName(e.target.value)} placeholder="New Unit (e.g. LTR)" className="flex-1 p-2.5 rounded-lg border border-gray-300 outline-none text-sm focus:border-brand-red bg-white" />
              <button onClick={handleAddUnit} className="bg-brand-red hover:bg-brand-red-hover text-white border-none px-4 rounded-lg text-sm font-semibold cursor-pointer">Add</button>
            </div>

            <div className="flex-1 overflow-y-auto border border-gray-200 rounded-xl">
              {unitsList.map(u => (
                <div key={u.id} className="flex justify-between items-center p-3 px-4 border-b border-gray-200 last:border-b-0 bg-white">
                  {editingUnitId === u.id ? (
                    <div className="flex gap-2 w-full">
                      <input type="text" value={editUnitName} onChange={e => setEditUnitName(e.target.value)} className="flex-1 p-1.5 rounded border border-gray-300 outline-none text-xs focus:border-brand-red bg-white" />
                      <button onClick={() => handleUpdateUnit(u.id)} className="bg-green-100 text-green-800 border-none px-3 py-1.5 rounded text-xs font-semibold cursor-pointer">Save</button>
                      <button onClick={() => setEditingUnitId(null)} className="bg-slate-100 text-slate-700 border-none px-3 py-1.5 rounded text-xs font-semibold cursor-pointer">Cancel</button>
                    </div>
                  ) : (
                    <>
                      <span className="font-bold text-gray-800 text-sm">{u.unit_name}</span>
                      <div className="flex gap-2">
                        <button onClick={() => { setEditingUnitId(u.id); setEditUnitName(u.unit_name); }} className="bg-none border-none text-gray-400 hover:text-blue-605 cursor-pointer p-1"><Edit2 size={16} /></button>
                        <button onClick={() => handleDeleteUnit(u.id, u.unit_name)} className="bg-none border-none text-gray-400 hover:text-red-600 cursor-pointer p-1"><Trash2 size={16} /></button>
                      </div>
                    </>
                  )}
                </div>
              ))}
              {unitsList.length === 0 && <div className="p-4 text-center text-gray-400 text-xs">No units found.</div>}
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-[600px] shadow-2xl">
            <div className="flex justify-between items-center mb-5 border-b border-gray-100 pb-3">
              <h3 className="text-lg font-bold text-gray-900 m-0">Add New Component</h3>
              <button onClick={() => setShowAddModal(false)} className="bg-none border-none cursor-pointer text-gray-400 hover:text-gray-650"><X size={20} /></button>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div><label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Item Name *</label><input type="text" value={newItem.item_name} onChange={e => setNewItem({...newItem, item_name: e.target.value})} className="w-full p-2.5 rounded-lg border border-gray-300 outline-none text-sm focus:border-brand-red" placeholder="e.g. 540W Panel" /></div>
              <div><label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Category</label><input type="text" value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})} className="w-full p-2.5 rounded-lg border border-gray-300 outline-none text-sm focus:border-brand-red" placeholder="e.g. Solar Panels" /></div>
              <div><label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Price Rate (₹) *</label><input type="number" value={newItem.rate} onChange={e => setNewItem({...newItem, rate: e.target.value})} className="w-full p-2.5 rounded-lg border border-gray-300 outline-none text-sm focus:border-brand-red" placeholder="0.00" /></div>
              
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Measurement Unit</label>
                <select value={newItem.unit} onChange={e => setNewItem({...newItem, unit: e.target.value})} className="w-full p-2.5 rounded-lg border border-gray-300 outline-none text-sm bg-white focus:border-brand-red">
                  {unitsList.map(u => <option key={u.id} value={u.unit_name}>{u.unit_name}</option>)}
                </select>
              </div>
              
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Branch Warehouse</label>
                <select value={newItem.city_id} onChange={e => setNewItem({...newItem, city_id: e.target.value})} disabled={currentUser.role !== 'Super Admin'} className="w-full p-2.5 rounded-lg border border-gray-300 outline-none text-sm bg-white focus:border-brand-red disabled:bg-gray-100 disabled:cursor-not-allowed">
                  {cities.map(city => <option key={city.id} value={city.id}>{city.name}</option>)}
                </select>
              </div>
              <div><label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Initial Stock Quantity</label><input type="number" value={newItem.initial_stock} onChange={e => setNewItem({...newItem, initial_stock: e.target.value})} className="w-full p-2.5 rounded-lg border border-gray-300 outline-none text-sm focus:border-brand-red" placeholder="0" /></div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
              <button className="px-4 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-lg text-xs cursor-pointer" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button className="px-4 py-2 bg-brand-red hover:bg-brand-red-hover text-white font-semibold rounded-lg text-xs border-none cursor-pointer shadow-sm flex items-center justify-center min-w-[90px]" onClick={handleAddNewItem} disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin" size={16}/> : 'Create Item'}</button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && editItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-[600px] shadow-2xl">
            <div className="flex justify-between items-center mb-5 border-b border-gray-100 pb-3">
              <h3 className="text-lg font-bold text-gray-900 m-0">Edit Component & Stock</h3>
              <button onClick={() => setShowEditModal(false)} className="bg-none border-none cursor-pointer text-gray-400 hover:text-gray-650"><X size={20} /></button>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div><label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Item Name</label><input type="text" value={editItem.components_master?.item_name || ''} onChange={e => setEditItem({...editItem, components_master: {...editItem.components_master, item_name: e.target.value}})} className="w-full p-2.5 rounded-lg border border-gray-300 outline-none text-sm focus:border-brand-red" /></div>
              <div><label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Category</label><input type="text" value={editItem.components_master?.category || ''} onChange={e => setEditItem({...editItem, components_master: {...editItem.components_master, category: e.target.value}})} className="w-full p-2.5 rounded-lg border border-gray-300 outline-none text-sm focus:border-brand-red" /></div>
              <div><label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Price Rate (₹)</label><input type="number" value={editItem.components_master?.rate || ''} onChange={e => setEditItem({...editItem, components_master: {...editItem.components_master, rate: e.target.value}})} className="w-full p-2.5 rounded-lg border border-gray-300 outline-none text-sm focus:border-brand-red" /></div>
              
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Measurement Unit</label>
                <select value={editItem.components_master?.unit || ''} onChange={e => setEditItem({...editItem, components_master: {...editItem.components_master, unit: e.target.value}})} className="w-full p-2.5 rounded-lg border border-gray-300 outline-none text-sm bg-white focus:border-brand-red">
                  {unitsList.map(u => <option key={u.id} value={u.unit_name}>{u.unit_name}</option>)}
                </select>
              </div>
              
              <div className="col-span-2">
                <label className="text-[11px] font-bold text-brand-red uppercase tracking-wider flex items-center gap-1 mb-1"><AlertCircle size={14}/> Override Available Stock ({editItem.cities?.name})</label>
                <input type="number" value={editItem.available_units} onChange={e => setEditItem({...editItem, available_units: e.target.value})} className="w-full p-2.5 rounded-lg border border-gray-300 outline-none text-sm bg-red-50/50 focus:border-brand-red" />
                <span className="text-[10px] text-gray-400 mt-1 block">Use this field to manually correct stock discrepancies. Use the "+" button for regular restocks.</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
              <button className="px-4 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-lg text-xs cursor-pointer" onClick={() => setShowEditModal(false)}>Cancel</button>
              <button className="px-4 py-2 bg-brand-red hover:bg-brand-red-hover text-white font-semibold rounded-lg text-xs border-none cursor-pointer shadow-sm flex items-center justify-center min-w-[90px]" onClick={handleEditItemSubmit} disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin" size={16}/> : 'Save Changes'}</button>
            </div>
          </div>
        </div>
      )}

      {showAddStockModal && activeStockItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-[400px] shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 m-0 mb-1">Quick Add Stock</h3>
            <p className="text-xs text-gray-400 mb-5">Adding stock for <strong>{activeStockItem.components_master?.item_name}</strong> in {activeStockItem.cities?.name} warehouse.</p>
            
            <div className="mb-6">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Quantity to Add (+)</label>
              <input type="number" value={stockToAdd} onChange={e => setStockToAdd(e.target.value)} placeholder="e.g. 5" className="w-full p-3 rounded-lg border border-gray-300 outline-none text-base focus:border-brand-red bg-white" autoFocus />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
              <button className="px-4 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-lg text-xs cursor-pointer" onClick={() => setShowAddStockModal(false)}>Cancel</button>
              <button className="px-4 py-2 bg-brand-red hover:bg-brand-red-hover text-white font-semibold rounded-lg text-xs border-none cursor-pointer shadow-sm flex items-center justify-center min-w-[90px]" onClick={handleAddExistingStock} disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin" size={16}/> : 'Add Quantity'}</button>
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-[400px] shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 m-0 mb-1">Import Stock via CSV</h3>
            <p className="text-xs text-gray-400 mb-5">Download the template, fill in your stock, and upload it to add bulk components.</p>
            
            <div className="mb-6">
              <button className="w-full bg-white hover:bg-slate-50 border border-slate-350 p-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 cursor-pointer text-slate-700 mb-3" onClick={downloadTemplate}><Download size={16} /> Download CSV Template</button>
              <label className="flex flex-col items-center p-6 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
                <Upload size={24} className="text-gray-400 mb-2" />
                <span className="text-xs text-gray-500 font-semibold">Click to upload CSV</span>
                <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100"><button className="px-4 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-lg text-xs cursor-pointer" onClick={() => setShowImportModal(false)}>Close</button></div>
          </div>
        </div>
      )}

      {modal.isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-[400px] shadow-2xl">
            <h3 className={`text-lg font-bold m-0 mb-2 ${modal.type === 'error' ? 'text-red-600' : 'text-gray-900'}`}>{modal.title}</h3>
            <p className="text-xs text-gray-500 mb-5 leading-relaxed">{modal.message}</p>
            <div className="flex justify-end gap-3">
              {modal.type === 'confirm' ? (
                <>
                  <button className="px-4 py-2 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-lg text-xs cursor-pointer" onClick={closeModal}>Cancel</button>
                  <button className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg text-xs border-none cursor-pointer shadow-sm animate-pulse" onClick={() => { if (modal.onConfirm) modal.onConfirm(); closeModal(); }}>Delete</button>
                </>
              ) : (
                <button className="px-4 py-2 bg-brand-red hover:bg-brand-red-hover text-white font-semibold rounded-lg text-xs border-none cursor-pointer shadow-sm" onClick={closeModal}>OK</button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
