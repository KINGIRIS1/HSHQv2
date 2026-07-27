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

  const formatDateDDMMYYYY = (dateStr?: string | null) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const day = d.getDate().toString().padStart(2, '0');
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return dateStr;
    }
  };

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
      <div className="bg-white px-3 sm:px-6 py-3 border-b border-slate-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row gap-2.5 items-center justify-between">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Tìm tên khách hàng, mã hồ sơ, SĐT..." 
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={filterWard}
              onChange={(e) => setFilterWard(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 sm:flex-none"
            >
              <option value="all">Tất cả Xã/Phường</option>
              {Array.from(new Set(records.map(r => r.ward).filter((w): w is string => !!w))).map(w => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
            <div className="text-xs font-bold text-slate-500 whitespace-nowrap px-2 bg-slate-100 py-2 rounded-xl border border-slate-200">
              {filtered.length} hồ sơ
            </div>
          </div>
        </div>
      </div>

      {/* Record List Grid */}
      <div className="p-3 sm:p-6 flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          {paginatedRecords.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                {paginatedRecords.map((record) => (
                  <div 
                    key={record.id} 
                    className="bg-white rounded-2xl shadow-sm hover:shadow-md border border-slate-100 p-3.5 sm:p-4 active:scale-[0.99] transition-all flex flex-col justify-between cursor-pointer"
                    onClick={() => onViewRecord(record)}
                  >
                    <div>
                      <div className="flex justify-between items-start gap-2 mb-2.5">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-slate-800 text-sm sm:text-base leading-snug line-clamp-1">{record.customerName}</h3>
                          <p className="text-[11px] text-slate-500 font-mono mt-0.5">{record.code}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border uppercase tracking-wider shrink-0 whitespace-nowrap ${getStatusColor(record.status)}`}>
                          {STATUS_LABELS[record.status]}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-y-1.5 gap-x-2 mb-3 text-slate-600 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <MapPin size={13} className="shrink-0 text-slate-400" />
                          <span className="text-[11px] sm:text-xs truncate font-medium">{record.ward || 'Chưa rõ'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Phone size={13} className="shrink-0 text-slate-400" />
                          {record.phoneNumber ? (
                            <a 
                              href={`tel:${record.phoneNumber}`} 
                              onClick={(e) => e.stopPropagation()} 
                              className="text-[11px] sm:text-xs font-semibold text-blue-600 hover:underline truncate"
                            >
                              {record.phoneNumber}
                            </a>
                          ) : (
                            <span className="text-[11px] text-slate-400">N/A</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Calendar size={13} className="shrink-0 text-blue-500" />
                          <span className="text-[11px] font-semibold text-slate-700">{formatDateDDMMYYYY(record.receivedDate)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <User size={13} className="shrink-0 text-slate-400" />
                          <span className="text-[11px] truncate font-medium">
                            {record.assignedTo ? (employees.find(e => e.id === record.assignedTo)?.name || 'N/A') : 'Chưa giao'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-2.5 border-t border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-100">
                          Tờ: {record.mapSheet || '-'}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-100">
                          Thửa: {record.landPlot || '-'}
                        </span>
                      </div>
                      <button className="text-blue-600 hover:text-blue-800 flex items-center gap-0.5 text-xs font-bold transition-colors">
                        Chi tiết <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination Controls */}
              {hasMore && (
                <div className="pt-6 pb-8 flex flex-col items-center gap-3">
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleLoadMore(); }}
                    className="w-full max-w-sm py-3 bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 rounded-xl font-bold text-xs sm:text-sm shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    Xem thêm {filtered.length - paginatedRecords.length} hồ sơ còn lại
                  </button>
                  <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">
                    Trang {currentPage} / {totalPages}
                  </p>
                </div>
              )}

              {!hasMore && filtered.length > itemsPerPage && (
                <div className="py-8 text-center">
                  <p className="text-xs text-slate-400 font-medium italic">Đã xem toàn bộ {filtered.length} hồ sơ</p>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Search size={48} className="mb-4 opacity-20" />
              <p className="text-sm font-medium">Không tìm thấy hồ sơ nào phù hợp</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MobileRecordList;
