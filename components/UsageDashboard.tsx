import React, { useState, useEffect } from 'react';
import { User, UsageLog, UsageSummary } from '../types';
import { getUsageStats, getAllUsers } from '../services/googleBackend';
import { X, Calendar, Download, RefreshCcw, DollarSign, Image as ImageIcon, Search, Filter, AlertCircle } from 'lucide-react';

interface UsageDashboardProps {
  currentUser: User;
  onClose: () => void;
}

export const UsageDashboard: React.FC<UsageDashboardProps> = ({ currentUser, onClose }) => {
  // State
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  
  // Filters
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30); // Default last 30 days
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedUserId, setSelectedUserId] = useState<string>('ALL'); // 'ALL' or specific userID (Admin only)

  const isAdmin = currentUser.role === 'ADMIN';

  useEffect(() => {
    if (isAdmin) {
      loadUserList();
    }
    fetchData();
  }, []);

  const loadUserList = async () => {
    try {
      const res = await getAllUsers(currentUser.id);
      if (res.success && res.users) {
        setAllUsers(res.users);
      }
    } catch (e) { console.error("Failed to load users for filter", e); }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // If admin selects "ALL", targetUserId is undefined to get everything (or handle in backend)
      // If admin selects specific user, pass that ID.
      // If normal user, targetUserId is ignored by backend (uses requester ID).
      
      const target = (isAdmin && selectedUserId !== 'ALL') ? selectedUserId : undefined;
      
      const res = await getUsageStats(currentUser.id, currentUser.role, startDate, endDate, target);
      
      if (res.success) {
        setLogs(res.logs || []);
        
        // Calculate summary client-side based on filtered logs to ensure consistency
        // OR use the summary returned from backend if it supports aggregation
        const currentLogs = res.logs || [];
        const totalCost = currentLogs.reduce((acc, log) => acc + (log.cost || 0), 0);
        const totalImages = currentLogs.reduce((acc, log) => acc + (log.quantity || 0), 0);
        
        setSummary({
          userId: target || currentUser.id,
          userName: target ? (allUsers.find(u => u.id === target)?.name || target) : currentUser.name,
          totalCost,
          totalImages,
          lastActive: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (logs.length === 0) return;
    
    const headers = ["Timestamp", "User ID", "Action", "Quantity", "Cost ($)", "Details"];
    const rows = logs.map(log => [
      new Date(log.timestamp).toLocaleString(),
      log.userId,
      log.actionType,
      log.quantity,
      log.cost.toFixed(4),
      `"${log.details || ''}"`
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `usage_report_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scale-in">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white flex-shrink-0">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
              <DollarSign className="text-green-600" /> 
              {isAdmin ? 'Financial & Usage Dashboard' : 'My Usage & Billing'}
            </h2>
            <p className="text-slate-500 text-sm mt-1">
              Track AI token consumption and estimated costs.
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition"><X size={24} className="text-slate-400" /></button>
        </div>

        {/* Filters Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row gap-4 items-center justify-between flex-shrink-0">
          
          <div className="flex flex-col md:flex-row gap-4 items-center w-full md:w-auto">
            {/* Admin User Filter */}
            {isAdmin && (
               <div className="relative group w-full md:w-64">
                 <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400"><Search size={16}/></div>
                 <select 
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm cursor-pointer appearance-none"
                 >
                    <option value="ALL">All Users (Global View)</option>
                    <option disabled>──────────</option>
                    {allUsers.map(u => (
                       <option key={u.id} value={u.id}>{u.name} (@{u.id})</option>
                    ))}
                 </select>
                 <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400"><Filter size={12}/></div>
               </div>
            )}

            {/* Date Range */}
            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-300 shadow-sm">
               <Calendar size={16} className="text-slate-500" />
               <input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)}
                  className="text-sm outline-none text-slate-700 bg-transparent"
               />
               <span className="text-slate-400">to</span>
               <input 
                  type="date" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)}
                  className="text-sm outline-none text-slate-700 bg-transparent"
               />
            </div>

            <button 
              onClick={fetchData} 
              className="px-4 py-2 bg-slate-800 text-white text-sm font-bold rounded-lg hover:bg-slate-700 transition flex items-center gap-2 shadow-sm"
            >
              <RefreshCcw size={14} className={loading ? "animate-spin" : ""} /> Apply
            </button>
          </div>

          <button 
            onClick={handleExportCSV}
            disabled={logs.length === 0}
            className="px-4 py-2 border border-slate-300 bg-white text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-50 transition flex items-center gap-2 disabled:opacity-50"
          >
            <Download size={16} /> Export CSV
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col bg-slate-50/50">
            
            {/* Summary Cards */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 flex-shrink-0">
               <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white shadow-lg shadow-slate-900/10">
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Total Estimated Cost</p>
                  <h3 className="text-4xl font-extrabold flex items-baseline gap-1">
                     ${summary?.totalCost.toFixed(4) || '0.0000'}
                  </h3>
                  <div className="mt-2 text-xs text-slate-400 bg-white/10 inline-block px-2 py-1 rounded">
                     {startDate} - {endDate}
                  </div>
               </div>

               <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Total Operations</p>
                  <h3 className="text-4xl font-extrabold text-slate-800 flex items-baseline gap-1">
                     {logs.length}
                  </h3>
                  <p className="text-xs text-slate-500 mt-2">API requests logged</p>
               </div>

               <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Images Generated</p>
                  <h3 className="text-4xl font-extrabold text-blue-600 flex items-baseline gap-1">
                     {summary?.totalImages || 0}
                  </h3>
                  <p className="text-xs text-slate-500 mt-2">Total creative assets</p>
               </div>
            </div>

            {/* Detailed Table */}
            <div className="flex-1 overflow-y-auto px-6 pb-6">
               <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[300px]">
                  <table className="w-full text-left text-sm">
                     <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                        <tr>
                           <th className="px-6 py-4">Timestamp</th>
                           <th className="px-6 py-4">User</th>
                           <th className="px-6 py-4">Action Type</th>
                           <th className="px-6 py-4 text-center">Qty</th>
                           <th className="px-6 py-4 text-right">Cost</th>
                           <th className="px-6 py-4">Details</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                        {loading ? (
                           <tr>
                              <td colSpan={6} className="px-6 py-20 text-center text-slate-400">
                                 <div className="flex flex-col items-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-4 border-slate-200 border-t-blue-600 mb-3"></div>
                                    Loading data...
                                 </div>
                              </td>
                           </tr>
                        ) : logs.length === 0 ? (
                           <tr>
                              <td colSpan={6} className="px-6 py-20 text-center text-slate-400">
                                 No usage records found for this period.
                              </td>
                           </tr>
                        ) : (
                           logs.map((log) => (
                              <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                                 <td className="px-6 py-3 text-slate-500 whitespace-nowrap">
                                    {new Date(log.timestamp).toLocaleString()}
                                 </td>
                                 <td className="px-6 py-3 font-medium text-slate-700">
                                    {log.userId}
                                 </td>
                                 <td className="px-6 py-3">
                                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider
                                       ${log.actionType === 'GENERATE_IMAGE' ? 'bg-purple-50 text-purple-700' : 
                                         log.actionType === 'BATCH_GENERATE' ? 'bg-orange-50 text-orange-700' : 
                                         'bg-blue-50 text-blue-700'}`}>
                                       {log.actionType.replace('_', ' ')}
                                    </span>
                                 </td>
                                 <td className="px-6 py-3 text-center text-slate-600">
                                    {log.quantity}
                                 </td>
                                 <td className="px-6 py-3 text-right font-mono font-bold text-slate-800">
                                    ${log.cost.toFixed(4)}
                                 </td>
                                 <td className="px-6 py-3 text-slate-400 text-xs truncate max-w-[200px]" title={log.details}>
                                    {log.details || '-'}
                                 </td>
                              </tr>
                           ))
                        )}
                     </tbody>
                  </table>
               </div>
            </div>
        </div>
      </div>
    </div>
  );
};
