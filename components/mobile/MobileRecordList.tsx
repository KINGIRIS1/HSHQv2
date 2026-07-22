import React, { useState } from 'react';
import { RecordFile, RecordStatus, Employee } from '../../types';
import { STATUS_LABELS } from '../../constants';
import { 
  Search, 
  Filter, 
  ChevronRight, 
  MapPin, 
  User, 
  Phone, 
  Calendar,
  MoreVertical,
  Plus
} from 'lucide-react';

interface MobileRecordListProps {
  records: RecordFile[];
  employees: Employee[];
  onViewRecord: (r: RecordFile) => void;
  onEditRecord: (r: RecordFile) => void;
  onDeleteRecord: (r: RecordFile) => void;
  onAddRecord: () => void;
}

const MobileRecordList: React.FC<MobileRecordListProps> = ({ 
  records, 
  employees, 
  onViewRecord, 
  onEditRecord, 
  onDeleteRecord,
  onAddRecord
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterWard, setFilterWard] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Reset page when filtering
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterWard]);

  const filtered = records.filter(r => {
    const matchesSearch = 
      r.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.phoneNumber && r.phoneNumber.includes(searchTerm));
    const matchesWard = filterWard === 'all' || r.ward === filterWard;
    return matchesSearch && matchesWard;
  });

  // Pagination logic
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedRecords = filtered.slice(0, currentPage * itemsPerPage);
  const hasMore = currentPage < totalPages;

  const handleLoadMore = () => {
    if (hasMore) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const getStatusColor = (status: RecordStatus) => {
    switch (status) {
      case RecordStatus.RECEIVED: return 'bg-blue-100 text-blue-700 border-blue-200';
      case RecordStatus.ASSIGNED: return 'bg-orange-100 text-orange-700 border-orange-200';
      case RecordStatus.IN_PROGRESS: return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case RecordStatus.COMPLETED_WORK: return 'bg-purple-100 text-purple-700 border-purple-200';
      case RecordStatus.PENDING_SIGN: return 'bg-pink-100 text-pink-700 border-pink-200';
      case RecordStatus.SIGNED: return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      case RecordStatus.HANDOVER: return 'bg-green-100 text-green-700 border-green-200';
      case RecordStatus.RETURNED: return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case RecordStatus.WITHDRAWN: return 'bg-slate-100 text-slate-700 border-slate-200';
      case RecordStatus.REJECTED: return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search & Filter Bar */}
      <div className="bg-white px-4 py-3 border-b border-slate-100 sticky top-0 z-10 shadow-sm">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Tìm tên, mã, SĐT..." 
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="w-10 h-10 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center text-slate-600">
            <Filter size={18} />
          </button>
        </div>
      </div>

      {/* Record List */}
      <div className="p-4 space-y-3 flex-1 overflow-y-auto">
        {paginatedRecords.length > 0 ? (
          <>
            {paginatedRecords.map((record) => (
              <div 
                key={record.id} 
                className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 active:scale-[0.98] transition-all"
                onClick={() => onViewRecord(record)}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-800 text-base truncate">{record.customerName}</h3>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">{record.code}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-lg text-[10px] font-bold border uppercase tracking-wider ${getStatusColor(record.status)}`}>
                    {STATUS_LABELS[record.status]}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-y-2 gap-x-4 mb-4">
                  <div className="flex items-center gap-2 text-slate-500">
                    <MapPin size={14} className="shrink-0" />
                    <span className="text-xs truncate">{record.ward || 'Chưa rõ'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-500">
                    <Phone size={14} className="shrink-0" />
                    <span className="text-xs">{record.phoneNumber || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-500">
                    <Calendar size={14} className="shrink-0" />
                    <span className="text-xs">{record.receivedDate || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-500">
                    <User size={14} className="shrink-0" />
                    <span className="text-xs truncate">
                      {record.assignedTo ? (employees.find(e => e.id === record.assignedTo)?.name || 'N/A') : 'Chưa giao'}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-slate-50">
                  <div className="flex -space-x-2">
                    {/* Visual indicator of progress or something */}
                    <div className="w-6 h-6 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center text-[8px] font-bold text-blue-600">
                      {record.mapSheet || '?'}
                    </div>
                    <div className="w-6 h-6 rounded-full bg-green-100 border-2 border-white flex items-center justify-center text-[8px] font-bold text-green-600">
                      {record.landPlot || '?'}
                    </div>
                  </div>
                  <button className="text-blue-600 flex items-center gap-1 text-xs font-bold">
                    Chi tiết <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            ))}

            {/* Pagination Controls */}
            {hasMore && (
              <div className="pt-4 pb-8 flex flex-col items-center gap-3">
                <button 
                  onClick={(e) => { e.stopPropagation(); handleLoadMore(); }}
                  className="w-full py-3 bg-white border border-blue-200 text-blue-600 rounded-xl font-bold text-sm shadow-sm active:bg-blue-50 transition-colors flex items-center justify-center gap-2"
                >
                  Xem thêm hồ sơ
                  <span className="text-[10px] bg-blue-100 px-2 py-0.5 rounded-full">
                    {filtered.length - paginatedRecords.length} còn lại
                  </span>
                </button>
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">
                  Trang {currentPage} / {totalPages}
                </p>
              </div>
            )}

            {!hasMore && filtered.length > itemsPerPage && (
              <div className="py-8 text-center">
                <p className="text-xs text-slate-400 font-medium italic">Bạn đã xem hết danh sách ({filtered.length} hồ sơ)</p>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Search size={48} className="mb-4 opacity-20" />
            <p className="text-sm font-medium">Không tìm thấy hồ sơ nào</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileRecordList;
