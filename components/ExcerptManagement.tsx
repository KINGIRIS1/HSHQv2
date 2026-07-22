
import React, { useState, useEffect, useMemo } from 'react';
import { Search, PlusCircle, History, AlertCircle, CheckCircle, MapPin, Hash, BookOpen, Loader2, Settings, X, Save, Trash2, Plus, RotateCcw, LayoutGrid, CalendarRange, Copy, Check } from 'lucide-react';
import { User, UserRole, RecordFile } from '../types';
import { fetchExcerptHistory, saveExcerptRecord, fetchExcerptCounters, saveExcerptCounters, fetchTrichDoHistory, saveTrichDoRecord, fetchTrichDoCounters, saveTrichDoCounters } from '../services/api';
import { confirmAction } from '../utils/appHelpers';

interface ExcerptRecord {
  id: string;
  ward: string;
  mapSheet: string;
  landPlot: string;
  excerptNumber: number;
  createdAt: string;
  createdBy: string;
  linkedRecordCode?: string; 
}

interface ExcerptManagementProps {
  currentUser: User;
  records: RecordFile[];
  onUpdateRecord: (recordId: string, number: string, type: 'trichluc' | 'trichdo') => void;
  wards: string[];
  onAddWard: (ward: string) => void;
  onDeleteWard: (ward: string) => void;
  onResetWards: () => void;
}

const INITIAL_CONFIG: Record<string, number> = {
  'GLOBAL': 0
};

const ExcerptManagement: React.FC<ExcerptManagementProps> = ({ currentUser, records, onUpdateRecord, wards, onAddWard, onDeleteWard, onResetWards }) => {
  const [activeTab, setActiveTab] = useState<'trichluc' | 'trichdo'>('trichluc');
  const [selectedWard, setSelectedWard] = useState<string>('');
  const [mapSheet, setMapSheet] = useState<string>('');
  const [landPlot, setLandPlot] = useState<string>('');
  
  // State quản lý Năm: Mặc định lấy năm hiện tại của hệ thống
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());

  // DANH SÁCH NĂM ĐỘNG: Tự động sinh từ 2024 đến Năm hiện tại + 1
  const availableYears = useMemo(() => {
      const startYear = 2024;
      const thisYear = new Date().getFullYear();
      const years = [];
      // Tạo danh sách năm đến tương lai gần (năm sau) để chuẩn bị trước
      for (let y = startYear; y <= thisYear + 1; y++) {
          years.push(y);
      }
      return years;
  }, []);

  const [loading, setLoading] = useState(false);
  const [resultNumber, setResultNumber] = useState<number | null>(null);
  const [history, setHistory] = useState<ExcerptRecord[]>([]);
  const [counters, setCounters] = useState<Record<string, number>>(INITIAL_CONFIG);

  const [searchCode, setSearchCode] = useState('');
  const [linkedRecord, setLinkedRecord] = useState<RecordFile | null>(null);
  const [missingWard, setMissingWard] = useState<string | null>(null);
  
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [editingCounters, setEditingCounters] = useState<Record<string, number>>({});
  const [newWardName, setNewWardName] = useState('');

  // State cho nút Copy
  const [isCopied, setIsCopied] = useState(false);

  const hasAdminRights = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUBADMIN;

  useEffect(() => {
    loadServerData();
  }, [activeTab]);

  const loadServerData = async () => {
      if (activeTab === 'trichluc') {
          const serverHistory = await fetchExcerptHistory();
          setHistory(serverHistory);

          const serverCounters = await fetchExcerptCounters();
          setCounters(prev => ({ ...INITIAL_CONFIG, ...serverCounters }));
      } else {
          const serverHistory = await fetchTrichDoHistory();
          setHistory(serverHistory);

          const serverCounters = await fetchTrichDoCounters();
          setCounters(prev => ({ ...INITIAL_CONFIG, ...serverCounters }));
      }
  };

  // --- LOGIC PHÂN BIỆT KHÓA THEO NĂM ---
  // Sử dụng chung 1 số tổng cho tất cả các xã (yêu cầu từ người dùng)
  const getCounterKey = (year: number) => {
      if (year <= 2025) return 'GLOBAL';
      return `GLOBAL_${year}`;
  };

  const handleSearchRecord = () => {
    if (!searchCode.trim()) return;
    const record = records.find(r => r.code.toLowerCase() === searchCode.toLowerCase());
    
    setMissingWard(null);
    if (record) {
        setLinkedRecord(record);
        if (record.ward && wards.includes(record.ward)) {
             setSelectedWard(record.ward);
        } else if (record.ward) {
             setMissingWard(record.ward);
        }

        if (record.mapSheet) setMapSheet(record.mapSheet);
        if (record.landPlot) setLandPlot(record.landPlot);
        setResultNumber(null);
        setIsCopied(false);
    } else {
        alert('Không tìm thấy hồ sơ với mã này.');
        setLinkedRecord(null);
    }
  };

  const handleQuickAddWard = () => {
      if (missingWard) {
          onAddWard(missingWard);
          setSelectedWard(missingWard);
          setMissingWard(null);
          // Không cần tạo counter riêng cho xã mới vì dùng chung
      }
  };

  const handleGetNumber = async () => {
    if (!selectedWard || !mapSheet || !landPlot) {
      alert("Vui lòng nhập đầy đủ thông tin!");
      return;
    }

    setLoading(true);
    setResultNumber(null);
    setIsCopied(false);

    try {
        // Lấy lịch sử mới nhất từ server để tìm số lớn nhất đã được cấp (Cơ chế chống trùng lặp)
        const serverHistory = activeTab === 'trichluc' ? await fetchExcerptHistory() : await fetchTrichDoHistory();
        let maxNumberInHistory = 0;
        serverHistory.forEach(r => {
            const itemYear = new Date(r.createdAt).getFullYear();
            let yearMatch = false;
            if (currentYear <= 2025) {
                yearMatch = itemYear <= 2025;
            } else {
                yearMatch = itemYear === currentYear;
            }
            if (yearMatch && r.excerptNumber > maxNumberInHistory) {
                maxNumberInHistory = r.excerptNumber;
            }
        });

        // Lấy dữ liệu Counter mới nhất từ Server
        const serverCounters = activeTab === 'trichluc' ? await fetchExcerptCounters() : await fetchTrichDoCounters();
        
        // Xác định Key dựa theo Năm đang chọn (dùng chung cho mọi xã)
        const counterKey = getCounterKey(currentYear);

        // Tính số tiếp theo: Là số lớn nhất giữa Cấu hình Counter và Lịch sử thực tế
        const currentCountOnServer = serverCounters[counterKey] || 0;
        const nextCount = Math.max(currentCountOnServer, maxNumberInHistory) + 1;

        const newRecord: ExcerptRecord = {
          id: Math.random().toString(36).substr(2, 9),
          ward: selectedWard,
          mapSheet,
          landPlot,
          excerptNumber: nextCount,
          createdAt: new Date().toISOString(),
          createdBy: currentUser.name,
          linkedRecordCode: linkedRecord?.code
        };

        // Lưu lịch sử
        if (activeTab === 'trichluc') {
            await saveExcerptRecord(newRecord);
        } else {
            await saveTrichDoRecord(newRecord);
        }
        
        // Cập nhật lại counter lên Server
        const newCounters = { ...serverCounters, [counterKey]: nextCount };
        if (activeTab === 'trichluc') {
            await saveExcerptCounters(newCounters);
        } else {
            await saveTrichDoCounters(newCounters);
        }

        // Cập nhật UI
        setCounters(newCounters);
        setHistory(prev => [newRecord, ...prev]);
        setResultNumber(nextCount);

        if (linkedRecord) {
            onUpdateRecord(linkedRecord.id, nextCount.toString(), activeTab);
            setLinkedRecord(null);
            setSearchCode('');
            setMissingWard(null);
        }

        setMapSheet('');
        setLandPlot('');
    } catch (error) {
        console.error(error);
        alert("Lỗi kết nối. Vui lòng thử lại.");
    } finally {
        setLoading(false);
    }
  };

  // Hàm xử lý copy
  const handleCopyResult = () => {
      if (resultNumber) {
          navigator.clipboard.writeText(resultNumber.toString());
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2000);
      }
  };

  const openConfig = async () => {
      const latest = activeTab === 'trichluc' ? await fetchExcerptCounters() : await fetchTrichDoCounters();
      setCounters(prev => ({ ...prev, ...latest }));
      setEditingCounters({...latest});
      setNewWardName('');
      setIsConfigOpen(true);
  };

  const saveConfig = async () => {
      if (activeTab === 'trichluc') {
          await saveExcerptCounters(editingCounters);
      } else {
          await saveTrichDoCounters(editingCounters);
      }
      setCounters(editingCounters);
      setIsConfigOpen(false);
  };

  const handleAddNewWard = () => {
      const name = newWardName.trim();
      if(name) {
          if (wards.includes(name)) {
              alert(`Xã/Phường "${name}" đã tồn tại!`);
              return;
          }
          onAddWard(name);
          setNewWardName('');
      }
  };

  const handleDeleteWard = async (ward: string) => {
      if(await confirmAction(`Xóa xã "${ward}" khỏi danh sách?`)) {
          onDeleteWard(ward);
      }
  };

  const filteredHistory = useMemo(() => {
      return history.filter(h => {
          const itemYear = new Date(h.createdAt).getFullYear();
          let yearMatch = false;
          if (currentYear <= 2025) {
              yearMatch = itemYear <= 2025;
          } else {
              yearMatch = itemYear === currentYear;
          }
          const wardMatch = selectedWard ? h.ward === selectedWard : true;
          return yearMatch && wardMatch;
      });
  }, [history, selectedWard, currentYear]);

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${hh}:${mm} - ${d}/${m}/${y}`;
  };

  return (
    <div className="h-full flex flex-col space-y-4 animate-fade-in-up overflow-hidden">
      {/* TAB SELECTOR */}
      <div className="flex space-x-2 bg-white p-2 rounded-xl shadow-sm border border-gray-100 shrink-0">
        <button
          onClick={() => setActiveTab('trichluc')}
          className={`flex-1 py-2 px-4 rounded-lg font-bold text-sm transition-colors ${activeTab === 'trichluc' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
        >
          Số Trích Lục
        </button>
        <button
          onClick={() => setActiveTab('trichdo')}
          className={`flex-1 py-2 px-4 rounded-lg font-bold text-sm transition-colors ${activeTab === 'trichdo' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
        >
          Số Trích Đo
        </button>
      </div>

      {/* DASHBOARD TỔNG QUAN - FIXED */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 shrink-0">
         <div className="flex items-center justify-between mb-4 border-b pb-2">
             <div className="flex items-center gap-2 text-gray-700 font-bold">
                <LayoutGrid size={20} className="text-blue-600" />
                <h2>Theo dõi {activeTab === 'trichluc' ? 'Số Trích Lục' : 'Số Trích Đo'} (Theo Xã/Phường)</h2>
             </div>
             
             <div className="flex items-center gap-3">
                 <div className="flex items-center bg-blue-50 px-2 py-1 rounded-lg border border-blue-200">
                    <CalendarRange size={16} className="text-blue-600 mr-2" />
                    <span className="text-sm font-bold text-blue-800 mr-2">Năm:</span>
                    <select 
                        value={currentYear} 
                        onChange={(e) => { setCurrentYear(parseInt(e.target.value)); setResultNumber(null); setIsCopied(false); }}
                        className="bg-transparent text-sm font-bold text-blue-700 outline-none cursor-pointer"
                    >
                        {availableYears.map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                 </div>

                 <button onClick={loadServerData} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                    <RotateCcw size={12}/> Làm mới
                 </button>
             </div>
         </div>
         
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="col-span-1 md:col-span-2 rounded-lg p-6 border transition-all shadow-md bg-blue-50 border-blue-400 flex flex-col items-center justify-center gap-2">
                 <div className="text-sm text-gray-500 font-bold uppercase text-center">TỔNG CHUNG (TẤT CẢ CÁC XÃ)</div>
                 <div className="text-5xl font-black text-gray-800 font-mono">
                     {counters[getCounterKey(currentYear)] || 0}
                 </div>
                 <div className="flex items-center gap-2 text-xs text-blue-700 font-bold mt-2">
                     <span className="bg-blue-100 px-2 py-1 rounded">Sẽ lấy số tiếp theo là: {(counters[getCounterKey(currentYear)] || 0) + 1}</span>
                 </div>
             </div>
         </div>
      </div>

      {/* CONTENT SCROLLABLE */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* LEFT COLUMN: INPUT FORM */}
            <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 relative">
                {hasAdminRights && (
                    <button 
                        onClick={openConfig}
                        className="absolute top-6 right-6 text-gray-400 hover:text-blue-600 transition-colors"
                        title="Cấu hình số hiện tại (Admin)"
                    >
                        <Settings size={20} />
                    </button>
                )}

                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-4 border-b pb-2">
                <PlusCircle className="text-blue-600" />
                Cấp Số Mới ({currentYear})
                </h2>
                
                <div className="space-y-4">
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                    <label className="block text-xs font-bold text-blue-800 mb-1 uppercase">Lấy thông tin từ Hồ Sơ</label>
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            placeholder="Nhập mã hồ sơ..."
                            className="flex-1 text-sm border border-blue-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={searchCode}
                            onChange={(e) => setSearchCode(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearchRecord()}
                        />
                        <button 
                            onClick={handleSearchRecord}
                            className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-700"
                        >
                            Tìm
                        </button>
                    </div>
                    {linkedRecord && (
                        <div className="mt-2 space-y-2">
                            <div className="text-xs text-green-700 flex items-center gap-1 bg-green-50 p-1.5 rounded border border-green-200">
                                <CheckCircle size={12} />
                                <span>{linkedRecord.customerName}</span>
                                <button onClick={() => { setLinkedRecord(null); setSearchCode(''); setMissingWard(null); }} className="ml-auto text-gray-500 hover:text-red-500"><X size={12} /></button>
                            </div>
                            
                            {missingWard && (
                                <div className="text-xs text-orange-700 bg-orange-50 p-2 rounded border border-orange-200 flex flex-col gap-1">
                                    <div className="flex items-center gap-1">
                                        <AlertCircle size={12} />
                                        <span>Xã <b>{missingWard}</b> chưa có trong danh sách.</span>
                                    </div>
                                    <button 
                                        onClick={handleQuickAddWard}
                                        className="w-full bg-orange-200 text-orange-800 px-2 py-1 rounded text-xs font-bold hover:bg-orange-300"
                                    >
                                        + Thêm ngay vào danh sách
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Chọn Xã / Phường <span className="text-red-500">*</span></label>
                    <div className="relative">
                    <select
                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-white font-medium text-gray-800"
                        value={selectedWard}
                        onChange={(e) => { setSelectedWard(e.target.value); setResultNumber(null); setIsCopied(false); }}
                    >
                        <option value="">-- Chọn địa bàn để cấp số --</option>
                        {wards.map(w => (
                        <option key={w} value={w}>{w}</option>
                        ))}
                    </select>
                    <MapPin className="absolute right-3 top-3 text-gray-400 pointer-events-none" size={18} />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Số Tờ <span className="text-red-500">*</span></label>
                    <input
                        type="number"
                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Ví dụ: 10"
                        value={mapSheet}
                        onChange={(e) => setMapSheet(e.target.value)}
                    />
                    </div>
                    <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Số Thửa <span className="text-red-500">*</span></label>
                    <input
                        type="number"
                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Ví dụ: 155"
                        value={landPlot}
                        onChange={(e) => setLandPlot(e.target.value)}
                    />
                    </div>
                </div>

                <button
                    onClick={handleGetNumber}
                    disabled={loading || !selectedWard || !mapSheet || !landPlot}
                    className="w-full mt-2 bg-blue-600 text-white py-3 rounded-lg font-semibold shadow-md hover:bg-blue-700 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {loading ? <Loader2 className="animate-spin" /> : <BookOpen size={20} />}
                    Cấp số tiếp theo: {selectedWard ? ((counters[getCounterKey(currentYear)] || 0) + 1) : '?'}
                </button>
                </div>
                
                <div className="mt-6 bg-gray-50 p-4 rounded-lg border border-gray-200 text-sm text-gray-600">
                <p className="flex items-start gap-2">
                    <AlertCircle size={16} className="mt-0.5 shrink-0 text-blue-500" />
                    <span>Hệ thống đang cấp số cho năm <strong>{currentYear}</strong>. Số thứ tự sẽ tự động bắt đầu lại từ 1 khi chuyển sang năm mới.</span>
                </p>
                </div>
            </div>
            </div>

            {/* RIGHT COLUMN: RESULT & HISTORY */}
            <div className="lg:col-span-2 space-y-6">
                <div className={`bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl shadow-sm border border-orange-100 p-8 text-center transition-all duration-500 ${resultNumber ? 'opacity-100 scale-100' : 'opacity-50 scale-95 grayscale'}`}>
                    <h3 className="text-gray-500 font-medium uppercase tracking-wider text-sm mb-2">{activeTab === 'trichluc' ? 'Số trích lục' : 'Số trích đo'} vừa cấp ({currentYear})</h3>
                    <div className="flex items-center justify-center gap-4">
                        <div className="text-6xl font-black text-orange-600 drop-shadow-sm font-mono">
                            {resultNumber ? resultNumber : '---'}
                        </div>
                        {resultNumber && (
                            <button 
                                onClick={handleCopyResult}
                                className={`p-3 rounded-full transition-all shadow-sm ${isCopied ? 'bg-green-100 text-green-600' : 'bg-white text-orange-400 hover:text-orange-600 hover:bg-orange-50 hover:shadow-md'}`}
                                title={`Sao chép số ${activeTab === 'trichluc' ? 'trích lục' : 'trích đo'}`}
                            >
                                {isCopied ? <Check size={28} className="animate-bounce" /> : <Copy size={28} />}
                            </button>
                        )}
                    </div>
                    {resultNumber && (
                        <p className="mt-4 text-orange-800 font-medium animate-pulse">
                            Đã lưu cho xã {selectedWard} - Tờ {history[0]?.mapSheet} / Thửa {history[0]?.landPlot}
                        </p>
                    )}
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col h-[500px]">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl shrink-0">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            <History className="text-gray-500" />
                            {selectedWard ? `Lịch sử cấp số xã: ${selectedWard} (${currentYear})` : `Lịch sử cấp số năm ${currentYear}`}
                        </h3>
                        <div className="flex items-center gap-3">
                            {selectedWard && (
                                <button 
                                    onClick={() => setSelectedWard('')} 
                                    className="text-xs text-blue-600 hover:underline"
                                >
                                    Xem tất cả
                                </button>
                            )}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                <input 
                                    type="text" 
                                    placeholder="Tìm tờ/thửa..." 
                                    className="pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="overflow-auto flex-1">
                        <table className="w-full text-left border-collapse table-fixed">
                            <thead className="bg-white sticky top-0 shadow-sm z-10 text-xs font-semibold text-gray-500 uppercase">
                                <tr>
                                    <th className="p-3 border-b text-center w-20">STL</th>
                                    <th className="p-3 border-b w-[200px]">Xã / Phường</th>
                                    <th className="p-3 border-b text-center w-16">Tờ</th>
                                    <th className="p-3 border-b text-center w-16">Thửa</th>
                                    <th className="p-3 border-b w-[150px]">Hồ sơ liên kết</th>
                                    <th className="p-3 border-b w-[150px]">Thời gian</th>
                                    <th className="p-3 border-b w-[150px]">Người cấp</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                                {filteredHistory.length > 0 ? (
                                    filteredHistory.map((item) => (
                                        <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="p-3 text-center font-bold text-orange-600 bg-orange-50/50 align-middle">
                                                {item.excerptNumber}
                                            </td>
                                            <td className="p-3 font-medium truncate align-middle" title={item.ward}>{item.ward}</td>
                                            <td className="p-3 text-center font-mono align-middle">{item.mapSheet}</td>
                                            <td className="p-3 text-center font-mono align-middle">{item.landPlot}</td>
                                            <td className="p-3 truncate align-middle" title={item.linkedRecordCode}>
                                                {item.linkedRecordCode ? (
                                                    <span className="text-blue-600 font-medium text-xs bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                                        {item.linkedRecordCode}
                                                    </span>
                                                ) : <span className="text-gray-400 text-xs italic">--</span>}
                                            </td>
                                            <td className="p-3 text-gray-500 text-xs align-middle">{formatDate(item.createdAt)}</td>
                                            <td className="p-3 text-xs text-blue-600 font-medium align-middle">
                                                <div className="truncate w-full" title={item.createdBy}>{item.createdBy}</div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={7} className="p-10 text-center text-gray-400 italic">
                                            Chưa có dữ liệu lịch sử cho năm {currentYear}.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
      </div>

      {isConfigOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-lg animate-fade-in-up flex flex-col max-h-[90vh]">
                  <div className="flex justify-between items-center p-5 border-b">
                      <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                          <Settings className="text-blue-600" />
                          Cấu hình Xã Phường & Số {activeTab === 'trichluc' ? 'trích lục' : 'trích đo'} ({currentYear})
                      </h3>
                      <button onClick={() => setIsConfigOpen(false)} className="text-gray-500 hover:text-red-600">
                          <X size={24} />
                      </button>
                  </div>
                  
                  <div className="p-6 overflow-y-auto flex-1 bg-gray-50">
                      <p className="text-sm text-gray-600 mb-4 bg-yellow-50 p-3 rounded border border-yellow-200">
                          <AlertCircle size={14} className="inline mr-1 text-yellow-600" />
                          Điều chỉnh số hiện tại cho từng xã trong năm <strong>{currentYear}</strong>.
                      </p>

                      <div className="flex gap-2 mb-4">
                         <input 
                            type="text" 
                            className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="Nhập tên xã/phường mới..."
                            value={newWardName}
                            onChange={(e) => setNewWardName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddNewWard()}
                         />
                         <button 
                            onClick={handleAddNewWard}
                            disabled={!newWardName.trim()}
                            className="bg-green-600 text-white px-3 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
                         >
                             <Plus size={18} />
                         </button>
                      </div>

                       <button 
                          onClick={onResetWards}
                          className="text-xs text-blue-600 hover:underline flex items-center gap-1 mb-4 ml-auto w-fit"
                       >
                          <RotateCcw size={12} /> Khôi phục danh sách xã/phường mặc định
                       </button>
                      
                      <div className="space-y-3 mb-6">
                            <div className="flex justify-between items-center bg-white p-4 rounded-lg border-2 border-blue-200 shadow-sm">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-blue-800 uppercase">Tổng {activeTab === 'trichluc' ? 'số trích lục' : 'số trích đo'} hiện tại</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500 font-medium">Đã cấp đến số:</span>
                                    <input 
                                        type="number" 
                                        className="w-32 border border-gray-300 rounded-md px-3 py-2 text-right font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        value={editingCounters[getCounterKey(currentYear)] ?? 0}
                                        onChange={(e) => setEditingCounters({...editingCounters, [getCounterKey(currentYear)]: parseInt(e.target.value) || 0})}
                                    />
                                </div>
                            </div>
                      </div>

                      <h4 className="font-bold text-gray-700 text-sm mb-3">Danh sách địa bàn (chỉ để chọn)</h4>
                      <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar border rounded p-2 bg-white">
                          {wards.map(ward => (
                                <div key={ward} className="flex justify-between items-center p-2 rounded hover:bg-gray-50">
                                    <span className="text-sm font-medium text-gray-700">{ward}</span>
                                    <button 
                                        onClick={() => handleDeleteWard(ward)}
                                        className="text-gray-400 hover:text-red-500 p-1 hover:bg-red-50 rounded"
                                        title="Xóa xã này"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                          ))}
                      </div>
                  </div>

                  <div className="p-4 border-t bg-white flex justify-end gap-3 rounded-b-lg">
                      <button 
                          onClick={() => setIsConfigOpen(false)}
                          className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md"
                      >
                          Hủy bỏ
                      </button>
                      <button 
                          onClick={saveConfig}
                          className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-sm"
                      >
                          <Save size={18} /> Lưu cấu hình
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default ExcerptManagement;
