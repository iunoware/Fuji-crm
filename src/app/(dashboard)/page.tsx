"use client"

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import {
  Search, Bell, Users, UserCheck, CreditCard, Camera, Clock,
  Loader2, ArrowRight, CheckCircle
} from 'lucide-react';

interface Task {
  id: string | number;
  client_name?: string;
  project_name?: string;
  location?: string;
  assigned_to?: string | number;
  status?: string;
  due_date?: string;
  users?: {
    id: string | number;
    name: string;
    avatar: string;
  } | null;
}

interface Lead {
  id: string | number;
  status: string;
  created_at: string;
  cities?: {
    name: string;
  } | null;
}

interface Customer {
  id: string | number;
  name: string;
  status: string;
  price?: string | number;
  paid?: string | number;
  pending_amount?: string | number;
  created_at: string;
  cities?: {
    name: string;
  } | null;
}

export default function Dashboard() {
  const { currentUser } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [upcomingTasks, setUpcomingTasks] = useState<Task[]>([]);
  const [allLeads, setAllLeads] = useState<any[]>([]);
  const [allCustomers, setAllCustomers] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState('All months');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [monthOptions, setMonthOptions] = useState<string[]>(['All months']);
  const [yearOptions, setYearOptions] = useState<string[]>([new Date().getFullYear().toString()]);
  const [dashboardStats, setDashboardStats] = useState({
    leads: 0,
    customers: 0,
    revenue: 0,
    pending: 0,
    closed: 0,
    remainder: 0
  });
  const [pipelineStats, setPipelineStats] = useState({
    totalLeads: 0,
    convertedLeads: 0,
    initial: 0,
    quote: 0,
    invoice: 0,
    won: 0,
    conversionRate: '0',
    totalRevenue: 0,
    totalPaid: 0
  });
  const [chartData, setChartData] = useState<Record<string, Record<string, number>>>({});

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const getMonthYearKey = (dateString: string) => {
    if (!dateString) return { month: '', year: '' };
    const safeDateString = dateString.includes('Z') || dateString.includes('+') ? dateString : `${dateString}Z`;
    const date = new Date(safeDateString);
    return {
      month: date.toLocaleString('en-US', { month: 'long' }),
      year: String(date.getFullYear())
    };
  };

  const computeDashboardStats = () => {
    const filteredLeads = allLeads.filter((lead) => {
      if (selectedMonth !== 'All months') {
        const { month, year } = getMonthYearKey(lead.created_at);
        if (month !== selectedMonth || year !== selectedYear) return false;
      }
      return true;
    });

    const filteredCustomers = allCustomers.filter((customer) => {
      if (selectedMonth !== 'All months') {
        const { month, year } = getMonthYearKey(customer.created_at);
        if (month !== selectedMonth || year !== selectedYear) return false;
      }
      return true;
    });

    let revenue = 0;
    let pending = 0;
    
    filteredCustomers.forEach(customer => {
      revenue += parseFloat(customer.price) || 0;
      pending += customer.pending_amount !== undefined ? parseFloat(customer.pending_amount) : (parseFloat(customer.price) || 0);
    });
    
    const closedLeads = filteredLeads.filter(lead => {
      const s = lead.status?.toLowerCase() || '';
      return s.includes('converted') || s.includes('transferred');
    }).length;
    
    const closedCustomers = filteredCustomers.filter(cust => {
      const s = cust.status?.toLowerCase() || '';
      return s.includes('installation') || s.includes('project');
    }).length;
    
    const closedCount = closedLeads + closedCustomers;

    setDashboardStats({
      leads: filteredLeads.length,
      customers: filteredCustomers.length,
      revenue,
      pending: Math.max(0, pending),
      closed: closedCount,
      remainder: upcomingTasks.length
    });
  };

  useEffect(() => {
    computeDashboardStats();
  }, [allLeads, allCustomers, upcomingTasks, selectedMonth, selectedYear]);

  useEffect(() => {
    if (currentUser) {
      fetchDashboardData(true);
      const liveUpdateInterval = setInterval(() => {
        fetchDashboardData(false);
      }, 10000);
      return () => clearInterval(liveUpdateInterval);
    }
  }, [currentUser]);

  const fetchDashboardData = async (showSpinner = true) => {
    if (!currentUser) return;
    if (showSpinner) setIsLoading(true);

    try {
      // 1. Fetch Upcoming Tasks
      let taskQuery = supabase.from('tasks')
        .select(`*, users (id, name, avatar)`)
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(50);

      if (currentUser.role === 'City Admin' && currentUser.city_id) {
        taskQuery = taskQuery.eq('city_id', currentUser.city_id);
      } else if (currentUser.role === 'Staff') {
        taskQuery = taskQuery.eq('assigned_to', currentUser.id);
      }

      const { data: taskData, error: taskError } = await taskQuery;

      if (!taskError && taskData) {
        const activeTasks = (taskData as any[]).filter(t => t.status !== 'Completed').slice(0, 6);
        setUpcomingTasks(activeTasks);
      }

      // 2. Fetch Customers for dashboard card counts
      let customerQuery = supabase.from('customers').select(`*, cities (name)`);
      if (currentUser.role === 'City Admin' && currentUser.city_id) {
        customerQuery = customerQuery.eq('city_id', currentUser.city_id);
      } else if (currentUser.role === 'Staff') {
        customerQuery = customerQuery.eq('assigned_to', currentUser.id);
      }
      
      let fetchedCusts: any[] = [];
      try {
        const { data: customerData, error: customerError } = await customerQuery;
        if (!customerError && customerData) fetchedCusts = customerData;
      } catch (e) {}

      // Add local offline customers
      const localStr = localStorage.getItem('offline_customers');
      let localCusts = localStr ? JSON.parse(localStr) : [];
      if (currentUser.role === 'City Admin' && currentUser.city_id) {
        localCusts = localCusts.filter((c: any) => c.city_id == currentUser.city_id);
      }
      
      const allCustsCombined = [...localCusts, ...fetchedCusts];
      setAllCustomers(allCustsCombined);

      // 3. Fetch Pipeline Data (from leads)
      let leadQuery = supabase.from('leads').select('status, created_at, cities(name)');
      if (currentUser.role === 'Staff') {
        leadQuery = leadQuery.eq('assigned_to', currentUser.id);
      } else if (currentUser.role === 'City Admin' && currentUser.city_id) {
        leadQuery = leadQuery.eq('city_id', currentUser.city_id);
      }

      const { data: leadData, error: leadError } = await leadQuery;
      if (!leadError && leadData) {
        setAllLeads(leadData);

        let initial = 0;
        let quote = 0;
        let invoice = 0;
        let won = 0;
        let convertedLeadsCount = 0;
        let totalRevenue = 0;
        let totalPaid = 0;

        const monthlyStats: Record<string, Record<string, number>> = {};
        const monthSet = new Set(['All months']);
        const yearSet = new Set([new Date().getFullYear().toString()]);

        const allPipelineItems = [...leadData, ...allCustsCombined];

        allPipelineItems.forEach(item => {
          const stage = item.status;

          let funnelLevel = 0;
          if (stage === 'Lead' || stage === 'Lost') funnelLevel = 1;
          else if (stage === 'Converted' || stage === 'Quote') funnelLevel = 2;
          else if (stage === 'Quote Approved' || stage === 'Invoice') funnelLevel = 3;
          else if (stage === 'Payment' || stage === 'Installation' || stage === 'Transferred to Project' || stage === 'Transferred') funnelLevel = 4;

          if (funnelLevel === 1) initial++;
          if (funnelLevel === 2) quote++;
          if (funnelLevel === 3) invoice++;
          if (funnelLevel === 4) {
            won++;
            convertedLeadsCount++;
          }

          if (item.price) {
            totalRevenue += parseFloat(item.price) || 0;
            totalPaid += parseFloat(item.paid) || 0;
          }

          if (item.created_at && item.cities) {
            const date = new Date(item.created_at);
            const monthStr = date.toLocaleString('en-US', { month: 'short' });
            if (!monthlyStats[monthStr]) monthlyStats[monthStr] = {};
            const cityName = item.cities.name;
            monthlyStats[monthStr][cityName] = (monthlyStats[monthStr][cityName] || 0) + 1;
          }

          if (item.created_at) {
            const { month, year } = getMonthYearKey(item.created_at);
            monthSet.add(month);
            yearSet.add(year);
          }
        });

        setMonthOptions(Array.from(monthSet));
        setYearOptions(Array.from(yearSet).sort());

        const total = allPipelineItems.length;
        const conversionRate = total > 0 ? ((convertedLeadsCount / total) * 100).toFixed(1) : '0';

        setPipelineStats({
          totalLeads: total,
          convertedLeads: convertedLeadsCount,
          initial, quote, invoice, won,
          conversionRate,
          totalRevenue,
          totalPaid
        });
        setChartData(monthlyStats);
      }

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      if (showSpinner) setIsLoading(false);
    }
  };

  if (!currentUser) return null;

  const selectedLabel = selectedMonth === 'All months' ? 'All months' : `${selectedMonth} ${selectedYear}`;

  return (
    <main className="flex-1 block h-screen overflow-y-auto overflow-x-hidden bg-brand-bg">
      <div className="flex items-center justify-between h-[72px] px-6 bg-white border-b border-[#e5e7eb] sticky top-0 z-50 shrink-0 max-[768px]:pl-[70px] max-[768px]:justify-end">
        <div className="flex items-center gap-2.5 w-[400px] text-gray-400 bg-[#f9f8fc] border border-[#e5e4e7] rounded-lg px-3.5 py-2.5 max-[768px]:hidden">
          <Search size={18} />
          <input type="text" placeholder="Search dashboard..." className="border-none bg-transparent outline-none flex-1 text-sm text-brand-text" />
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3.5 py-2.5 rounded-lg border border-[#e5e7eb] bg-white text-gray-700 font-semibold cursor-pointer outline-none text-sm"
          >
            {monthOptions.map((month) => (
              <option key={month} value={month}>{month}</option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="px-3.5 py-2.5 rounded-lg border border-[#e5e7eb] bg-white text-gray-700 font-semibold cursor-pointer outline-none text-sm"
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <div className="flex items-center gap-4">
            <Link href="/remainder" className="text-gray-500 relative flex items-center justify-center p-2 rounded-lg border border-[#e5e7eb] bg-white hover:bg-gray-50 transition-colors">
              <Bell size={20} className="text-gray-600" />
            </Link>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center px-6 py-6 pb-4 max-[768px]:flex-col max-[768px]:items-start max-[768px]:gap-4">
        <div>
          <h1 className="text-3xl font-extrabold m-0 tracking-tight text-gray-900">Dashboard Overview</h1>
          <p className="text-sm text-gray-500 m-0 mt-1">Showing {selectedLabel} performance across leads, customers, revenue, and handoffs.</p>
        </div>
      </div>

      <div className="grid grid-cols-3 max-[1024px]:grid-cols-2 max-[768px]:grid-cols-1 gap-4 px-6 py-4">
        <div className="bg-white p-5 rounded-xl border border-[#e5e4e7] overflow-hidden">
          <div className="flex justify-between items-start mb-4">
            <div className="w-11 h-11 rounded-[10px] flex items-center justify-center font-bold bg-[#ffebee] text-brand-red"><Users size={20} /></div>
            <span className="text-xs font-semibold px-2 py-1 rounded bg-[#ffebee] text-brand-red">Leads</span>
          </div>
          <p className="text-xs text-gray-500 m-0 mb-2">Leads</p>
          <h2 className="text-2xl font-bold m-0">{dashboardStats.leads}</h2>
        </div>
        <div className="bg-white p-5 rounded-xl border border-[#e5e4e7] overflow-hidden">
          <div className="flex justify-between items-start mb-4">
            <div className="w-11 h-11 rounded-[10px] flex items-center justify-center font-bold bg-[#fff9c4] text-[#f57f17]"><UserCheck size={20} /></div>
            <span className="text-xs font-semibold px-2 py-1 rounded bg-[#fff9c4] text-[#f57f17]">Customers</span>
          </div>
          <p className="text-xs text-gray-500 m-0 mb-2">Customers</p>
          <h2 className="text-2xl font-bold m-0">{dashboardStats.customers}</h2>
        </div>
        <div className="bg-white p-5 rounded-xl border border-[#e5e4e7] overflow-hidden">
          <div className="flex justify-between items-start mb-4">
            <div className="w-11 h-11 rounded-[10px] flex items-center justify-center font-bold bg-[#ffedd5] text-[#ea580c]"><CreditCard size={20} /></div>
            <span className="text-xs font-semibold px-2 py-1 rounded bg-[#ffedd5] text-[#ea580c]">Revenue</span>
          </div>
          <p className="text-xs text-gray-500 m-0 mb-2">Revenue</p>
          <h2 className="text-2xl font-bold m-0">{formatCurrency(dashboardStats.revenue)}</h2>
        </div>
        <div className="bg-white p-5 rounded-xl border border-[#e5e4e7] overflow-hidden">
          <div className="flex justify-between items-start mb-4">
            <div className="w-11 h-11 rounded-[10px] flex items-center justify-center font-bold bg-[#fee2e2] text-[#dc2626]"><Camera size={20} /></div>
            <span className="text-xs font-semibold px-2 py-1 rounded bg-[#fee2e2] text-[#dc2626]">Pending</span>
          </div>
          <p className="text-xs text-gray-500 m-0 mb-2">Pending</p>
          <h2 className="text-2xl font-bold m-0">{formatCurrency(dashboardStats.pending)}</h2>
        </div>
        <div className="bg-white p-5 rounded-xl border border-[#e5e4e7] overflow-hidden">
          <div className="flex justify-between items-start mb-4">
            <div className="w-11 h-11 rounded-[10px] flex items-center justify-center font-bold bg-[#ffebee] text-brand-red"><CheckCircle size={20} /></div>
            <span className="text-xs font-semibold px-2 py-1 rounded bg-[#ffebee] text-brand-red">Closed</span>
          </div>
          <p className="text-xs text-gray-500 m-0 mb-2">Closed</p>
          <h2 className="text-2xl font-bold m-0">{dashboardStats.closed}</h2>
        </div>
        <div className="bg-white p-5 rounded-xl border border-[#e5e4e7] overflow-hidden">
          <div className="flex justify-between items-start mb-4">
            <div className="w-11 h-11 rounded-[10px] flex items-center justify-center font-bold bg-[#fff9c4] text-[#f57f17]"><Clock size={20} /></div>
            <span className="text-xs font-semibold px-2 py-1 rounded bg-[#fff9c4] text-[#f57f17]">Remainder</span>
          </div>
          <p className="text-xs text-gray-500 m-0 mb-2">Remainder</p>
          <h2 className="text-2xl font-bold m-0">{dashboardStats.remainder}</h2>
        </div>
      </div>

      <div className="grid grid-cols-[2fr_1fr] max-[1024px]:grid-cols-1 gap-4 px-6 pb-6">
        <div className="bg-white p-5 rounded-xl border border-[#e5e4e7] overflow-x-auto">
          <div className="flex justify-between items-center mb-5 min-w-[300px]">
            <h3 className="text-base font-semibold m-0 text-gray-900">Leads by City</h3>
            <div className="flex gap-3 text-xs text-gray-500">
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#dc2626]"></div> Chennai</div>
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#f59e0b]"></div> Madurai</div>
            </div>
          </div>
          <div className="h-[180px] relative flex items-end justify-between px-5 mt-5 border-b border-gray-100 min-w-[400px]">
            <div className="absolute w-full left-0 bottom-0 border-b border-gray-200"></div>
            <div className="absolute w-full left-0 bottom-[50%] border-b border-dashed border-gray-200"></div>
            <div className="absolute w-full left-0 top-0 border-b border-dashed border-gray-200"></div>

            {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map((month) => {
              const chennaiCount = chartData[month]?.['Chennai'] || 0;
              const maduraiCount = chartData[month]?.['Madurai'] || 0;
              const maxScale = 15;
              const cHeight = `${Math.min(100, (chennaiCount / maxScale) * 100)}%`;
              const mHeight = `${Math.min(100, (maduraiCount / maxScale) * 100)}%`;

              return (
                <div key={month} className="flex flex-col items-center h-full z-10">
                  <div className="flex gap-1 items-end h-[calc(100%-30px)] w-6 justify-center">
                    <div style={{ height: cHeight }} className="w-2 bg-[#dc2626] rounded-t transition-all duration-1000 ease-out"></div>
                    <div style={{ height: mHeight }} className="w-2 bg-[#f59e0b] rounded-t transition-all duration-1000 ease-out delay-100"></div>
                  </div>
                  <span className="text-xs text-gray-500 mt-auto font-semibold">{month}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-[#e5e4e7] overflow-x-auto flex flex-col justify-between">
          <h3 className="text-base font-semibold m-0 mb-4 text-gray-900">Sales Pipeline</h3>
          
          <div className="flex flex-col gap-4">
            <div className="flex flex-col">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-gray-500 font-medium">Initial Lead</span>
                <strong className="font-semibold text-gray-800">{pipelineStats.initial}</strong>
              </div>
              <div className="h-2 bg-[#e5e4e7] rounded-full overflow-hidden">
                <div style={{ width: `${pipelineStats.totalLeads > 0 ? (pipelineStats.initial / pipelineStats.totalLeads) * 100 : 0}%` }} className="h-full bg-red-500 transition-all duration-300"></div>
              </div>
            </div>
            
            <div className="flex flex-col">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-gray-500 font-medium">Quote Sent</span>
                <strong className="font-semibold text-gray-800">{pipelineStats.quote}</strong>
              </div>
              <div className="h-2 bg-[#e5e4e7] rounded-full overflow-hidden">
                <div style={{ width: `${pipelineStats.totalLeads > 0 ? (pipelineStats.quote / pipelineStats.totalLeads) * 100 : 0}%` }} className="h-full bg-red-500 transition-all duration-300"></div>
              </div>
            </div>

            <div className="flex flex-col">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-gray-500 font-medium">Invoice Sent</span>
                <strong className="font-semibold text-gray-800">{pipelineStats.invoice}</strong>
              </div>
              <div className="h-2 bg-[#e5e4e7] rounded-full overflow-hidden">
                <div style={{ width: `${pipelineStats.totalLeads > 0 ? (pipelineStats.invoice / pipelineStats.totalLeads) * 100 : 0}%` }} className="h-full bg-red-500 transition-all duration-300"></div>
              </div>
            </div>

            <div className="flex flex-col">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-gray-500 font-medium">Closed Won</span>
                <strong className="font-semibold text-gray-800">{pipelineStats.won}</strong>
              </div>
              <div className="h-2 bg-[#e5e4e7] rounded-full overflow-hidden">
                <div style={{ width: `${pipelineStats.totalLeads > 0 ? (pipelineStats.won / pipelineStats.totalLeads) * 100 : 0}%` }} className="h-full bg-red-700 transition-all duration-300"></div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-[#e5e4e7] text-xs text-brand-red font-bold text-center">
            Conversion Rate: {pipelineStats.conversionRate}%
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 px-6 pb-6">
        <div className="bg-white p-6 rounded-xl border border-[#e5e4e7] overflow-x-auto">
          <div className="flex justify-between items-center mb-6 min-w-[400px]">
            <h3 className="text-base font-semibold m-0 text-gray-900 flex items-center gap-2">
              <CheckCircle size={18} className="text-brand-red" /> Upcoming Tasks
            </h3>
            <Link href="/tasks" className="flex items-center gap-1.5 text-xs text-brand-red font-bold hover:underline">
              View All <ArrowRight size={14} />
            </Link>
          </div>

          {isLoading ? (
            <div className="py-10 text-center">
              <Loader2 className="animate-spin text-brand-red mx-auto" size={30} />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr] py-3.5 border-b border-[#e5e7eb] text-gray-500 text-xs font-bold min-w-[500px]">
                <span>CLIENT NAME</span>
                <span>CLIENT LOCATION</span>
                <span>STAFF ASSIGNED</span>
                <span>STATUS</span>
              </div>

              {upcomingTasks.map((task) => (
                <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr] items-center py-4 border-b border-[#f9fafb] min-w-[500px] last:border-b-0" key={task.id}>
                  <div>
                    <h4 className="m-0 text-sm font-semibold text-gray-900">{task.client_name || task.project_name || 'Unknown Client'}</h4>
                    <span className="text-[11px] text-gray-500 font-mono">ID: #FJT-{task.id}</span>
                  </div>

                  <div className="text-xs text-gray-700 font-medium">{task.location || 'No Location'}</div>

                  <div className="flex items-center gap-2">
                    {task.users ? (
                      <>
                        <img src={task.users.avatar || 'https://i.pravatar.cc/150'} className="w-7 h-7 rounded-full object-cover shrink-0" alt="staff" />
                        <span className="text-xs font-semibold text-gray-700">{task.users.name || 'Unassigned'}</span>
                      </>
                    ) : (
                      <span className="text-xs text-gray-400 italic">Unassigned</span>
                    )}
                  </div>

                  <div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      task.status === 'Completed' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {task.status || 'Pending'}
                    </span>
                  </div>
                </div>
              ))}

              {upcomingTasks.length === 0 && (
                <div className="py-10 text-center text-gray-500 text-sm">
                  All caught up! No pending or active tasks.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
