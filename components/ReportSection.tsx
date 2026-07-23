
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { BarChart3, FileSpreadsheet, Loader2, Sparkles, Download, CalendarDays, Printer, Layout, FileText, ListFilter, CheckCircle2, Clock, AlertTriangle, Settings, Key, X, Save, MapPin, UserCheck, ChevronLeft, ChevronRight, PieChart, CheckCircle, Ruler, FolderArchive, CalendarRange } from 'lucide-react';
import { RecordFile, RecordStatus, Employee, User } from '../types';
import { getNormalizedWard, STATUS_LABELS, getShortRecordType, isArchiveRecordType } from '../constants';
import { isRecordOverdue, removeVietnameseTones, isRecordApproaching, parseSafeDate } from '../utils/appHelpers';
import { saveGeminiKey, getGeminiKey } from '../services/geminiService';
import { fetchArchiveRecords } from '../services/apiArchive';
import EmployeeStatsView from './report/EmployeeStatsView';
import WardStatsView from './report/WardStatsView';
import DailyStatsView from './report/DailyStatsView';
import OverdueStatsView from './report/OverdueStatsView';

interface ReportSectionProps {
    reportContent: string;
    isGenerating: boolean;
    onGenerate: (fromDate: string, toDate: string, title?: string, data?: RecordFile[]) => void;
    onExportExcel: (fromDate: string, toDate: string, ward: string, title?: string, data?: RecordFile[]) => void;
    records: RecordFile[];
    wards: string[]; 
    employees: Employee[];
    currentUser?: User;
}

const getFormattedNotesAndDocs = (r: RecordFile): string => {
    const notesParts: string[] = [];
    if (r.notes) notesParts.push(r.notes);
    if (r.content && r.content !== r.notes) notesParts.push(r.content);
    return notesParts.join('; ') || '-';
};

const ReportSection: React.FC<ReportSectionProps> = ({ reportContent, isGenerating, onGenerate, onExportExcel, records, wards, employees, currentUser }) => {
    const [fromDate, setFromDate] = useState(() => {
        return '2025-01-01';
    });
    const [toDate, setToDate] = useState(() => {
        return new Date().toISOString().split('T')[0];
    });
    
    // State chọn xã phường
    const [selectedWard, setSelectedWard] = useState<string>('all');
    
    // State chọn nhân viên (Lifting state up)
    const [selectedEmpId, setSelectedEmpId] = useState<string>('');

    // Report Type State
    const [reportType, setReportType] = useState<'week' | 'month' | 'custom'>('custom');

    // Card filter state
    const [cardFilter, setCardFilter] = useState<'all' | 'completed' | 'processing' | 'overdue_pending' | 'overdue_completed' | null>(null);

    const [activeTab, setActiveTab] = useState<'list' | 'ward_stats' | 'ai' | 'employee' | 'daily_stats' | 'overdue'>('list');
    const previewRef = useRef<HTMLDivElement>(null);

    const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
    const [apiKey, setApiKey] = useState('');

    // Pagination States
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);

    const [dailyStatsRecords, setDailyStatsRecords] = useState<RecordFile[]>([]);

    // --- NEW LOGIC FOR MAIN TABS (Đo đạc vs Lưu trữ) ---
    // Tìm nhân sự ứng với tài khoản hiện tại
    const userEmployee = useMemo(() => {
        if (!currentUser || !currentUser.employeeId) return null;
        return employees.find(e => e.id === currentUser.employeeId);
    }, [currentUser, employees]);

    const userDept = userEmployee?.department || '';
    const userRole = currentUser?.role;

    // Quản trị viên (Admin/Subadmin) hoặc người thuộc Tổ Hành chính có quyền xem tất cả các tổ
    const isHanhChinhOrAdmin = useMemo(() => {
        if (!currentUser) return true;
        if (userRole === 'ADMIN' || userRole === 'SUBADMIN') return true;
        const deptLower = userDept.toLowerCase();
        return deptLower.includes('hành chính') || deptLower.includes('một cửa');
    }, [currentUser, userDept, userRole]);

    const [mainTab, setMainTab] = useState<'measurement' | 'archive'>('measurement');
    const [archiveRecords, setArchiveRecords] = useState<RecordFile[]>([]);
    const [isArchiveLoading, setIsArchiveLoading] = useState<boolean>(false);

    // Tự động chuyển tab chính nếu người dùng bị giới hạn quyền theo tổ
    useEffect(() => {
        if (!isHanhChinhOrAdmin && userDept) {
            const deptLower = userDept.toLowerCase();
            if (deptLower.includes('đo đạc') || deptLower.includes('kỹ thuật')) {
                setMainTab('measurement');
            } else if (deptLower.includes('lưu trữ')) {
                setMainTab('archive');
            }
        }
    }, [isHanhChinhOrAdmin, userDept]);

    // Reset card filter when other filters change
    useEffect(() => {
        setCardFilter(null);
    }, [fromDate, toDate, selectedWard, mainTab]);

    useEffect(() => {
        if (mainTab === 'archive') {
            const loadArchive = async () => {
                setIsArchiveLoading(true);
                try {
                    const [saoluc, vaoso, congvan] = await Promise.all([
                        fetchArchiveRecords('saoluc'),
                        fetchArchiveRecords('vaoso'),
                        fetchArchiveRecords('congvan')
                    ]);
                    const all = [...saoluc, ...vaoso, ...congvan];
                    
                    const mapStatus = (s: string): RecordStatus => {
                        switch(s) {
                            case 'draft': return RecordStatus.RECEIVED;
                            case 'assigned': return RecordStatus.ASSIGNED;
                            case 'executed': return RecordStatus.COMPLETED_WORK;
                            case 'pending_sign': return RecordStatus.PENDING_SIGN;
                            case 'signed': return RecordStatus.SIGNED;
                            case 'completed': return RecordStatus.RETURNED;
                            default: return RecordStatus.RECEIVED;
                        }
                    };

                    const mapped: RecordFile[] = all.map(r => {
                        const rawWard = r.data?.xa_phuong || r.data?.dia_danh || '';
                        const rawCode = r.data?.ma_ho_so || r.so_hieu || '';
                        const rawCustomer = r.data?.ten_chu_su_dung || r.noi_nhan_gui || '';
                        
                        return {
                            id: r.id,
                            code: rawCode,
                            customerName: String(rawCustomer).replace(/\n/g, ' '),
                            ward: rawWard,
                            mapSheet: r.data?.to_ban_do || r.data?.so_to || '',
                            landPlot: r.data?.thua_dat || r.data?.so_thua || '',
                            receivedDate: r.data?.ngay_nhan || r.ngay_thang || r.created_at,
                            deadline: r.data?.hen_tra || '',
                            status: mapStatus(r.status),
                            assignedTo: r.data?.assigned_to || '',
                            notes: r.trich_yeu || r.data?.loai_bien_dong || '',
                            recordType: r.data?.recordType || (r.type === 'saoluc' ? 'Sao lục' : r.type === 'vaoso' ? 'Vào sổ' : 'Công văn'),
                            address: rawWard,
                            phoneNumber: '',
                            content: r.trich_yeu || r.data?.loai_bien_dong || ''
                        } as RecordFile;
                    });
                    
                    const cungCapRecordsFromMain = records.filter(r => isArchiveRecordType(r.recordType));

                    setArchiveRecords([...mapped, ...cungCapRecordsFromMain]);
                } catch (e) {
                    console.error("Error loading archive records for report", e);
                } finally {
                    setIsArchiveLoading(false);
                }
            };
            loadArchive();
        }
    }, [mainTab, records]);

    const activeRecords = useMemo(() => {
        return mainTab === 'measurement' 
            ? records.filter(r => {
                const shortType = getShortRecordType(r.recordType);
                return !isArchiveRecordType(r.recordType) && !['CMD', 'Tòa án', 'Thi hành án'].includes(shortType);
            }) 
            : archiveRecords;
    }, [records, mainTab, archiveRecords]);

    const activeEmployees = useMemo(() => {
        if (mainTab === 'measurement') {
            return employees.filter(e => {
                const dept = e.department?.toLowerCase() || '';
                return dept.includes('đo đạc') || dept.includes('kỹ thuật');
            });
        } else {
            return employees.filter(e => {
                const dept = e.department?.toLowerCase() || '';
                return dept.includes('lưu trữ') || dept.includes('một cửa');
            });
        }
    }, [employees, mainTab]);

    useEffect(() => {
        if (isKeyModalOpen) {
            setApiKey(getGeminiKey());
        }
    }, [isKeyModalOpen]);

    const handleSaveKey = () => {
        saveGeminiKey(apiKey);
        setIsKeyModalOpen(false);
        alert("Đã lưu API Key thành công!");
    };

    // --- LOGIC TÍNH TOÁN DỮ LIỆU CHUNG (Theo ngày & xã) ---
    const filteredData = useMemo(() => {
        const start = parseSafeDate(fromDate) || new Date(fromDate); start.setHours(0,0,0,0);
        const end = parseSafeDate(toDate) || new Date(toDate); end.setHours(23,59,59,999);

        return activeRecords.filter(r => {
            const rDate = parseSafeDate(r.receivedDate);
            if (!rDate) return false;
            rDate.setHours(12,0,0,0); // Dùng giữa ngày để tránh lệch múi giờ
            const matchDate = rDate >= start && rDate <= end;
            
            let matchWard = true;
            if (selectedWard !== 'all') {
                const rWard = removeVietnameseTones(r.ward || '');
                const sWard = removeVietnameseTones(selectedWard);
                matchWard = rWard.includes(sWard);
            }

            return matchDate && matchWard;
        });
    }, [activeRecords, fromDate, toDate, selectedWard]);

    // Apply card-click filter to the list of records
    const finalFilteredData = useMemo(() => {
        if (!cardFilter || cardFilter === 'all') return filteredData;
        return filteredData.filter(r => {
            if (cardFilter === 'completed') {
                return r.status === RecordStatus.HANDOVER || 
                       r.status === RecordStatus.RETURNED || 
                       r.status === RecordStatus.SIGNED ||
                       !!r.exportBatch || !!r.exportDate;
            }
            if (cardFilter === 'processing') {
                const isDone = r.status === RecordStatus.HANDOVER || 
                               r.status === RecordStatus.RETURNED || 
                               r.status === RecordStatus.SIGNED ||
                               !!r.exportBatch || !!r.exportDate;
                return !isDone && r.status !== RecordStatus.WITHDRAWN && r.status !== RecordStatus.REJECTED;
            }
            if (cardFilter === 'overdue_pending') {
                if (r.status === RecordStatus.WITHDRAWN || r.status === RecordStatus.REJECTED || r.status === RecordStatus.HANDOVER || r.status === RecordStatus.RETURNED || r.status === RecordStatus.SIGNED || r.exportBatch) return false;
                return isRecordOverdue(r);
            }
            if (cardFilter === 'overdue_completed') {
                const isDone = r.status === RecordStatus.HANDOVER || r.status === RecordStatus.RETURNED || r.status === RecordStatus.SIGNED || !!r.exportBatch;
                if (!isDone) return false;
                const d = parseSafeDate(r.deadline);
                const c = parseSafeDate(r.completedDate);
                if (!d || !c) return false;
                d.setHours(0,0,0,0);
                c.setHours(0,0,0,0);
                return c > d;
            }
            return true;
        });
    }, [filteredData, cardFilter]);

    // Reset pagination when filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [fromDate, toDate, selectedWard, mainTab, cardFilter]);

    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return finalFilteredData.slice(start, start + itemsPerPage);
    }, [finalFilteredData, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(finalFilteredData.length / itemsPerPage);

    // --- STATS CHO CÁC TAB ---
    // Updated: Hỗ trợ lọc theo nhân viên khi ở tab Employee
    const generalStats = useMemo(() => {
        let sourceData = filteredData;

        // Nếu đang ở tab Thống kê theo ngày -> Lọc theo điều kiện của tab đó
        if (activeTab === 'daily_stats') {
            sourceData = dailyStatsRecords;
        }
        // Nếu đang ở tab Nhân viên và đã chọn nhân viên -> Lọc theo nhân viên đó
        else if (activeTab === 'employee' && selectedEmpId) {
            sourceData = filteredData.filter(r => r.assignedTo === selectedEmpId);
        }

        const total = sourceData.length;
        // Tính cả SIGNED là completed để đồng bộ logic
        const completed = sourceData.filter(r => 
            r.status === RecordStatus.HANDOVER || 
            r.status === RecordStatus.RETURNED || 
            r.status === RecordStatus.SIGNED ||
            !!r.exportBatch || !!r.exportDate // Đã xuất cũng tính là xong
        ).length;
        
        const withdrawn = sourceData.filter(r => r.status === RecordStatus.WITHDRAWN).length;
        const rejected = sourceData.filter(r => r.status === RecordStatus.REJECTED).length;
        
        // Logic overdue pending: Quá hạn và chưa xong (chưa xuất/chưa trả/chưa rút)
        const overduePending = sourceData.filter(r => {
            if (r.status === RecordStatus.WITHDRAWN || r.status === RecordStatus.REJECTED || r.status === RecordStatus.HANDOVER || r.status === RecordStatus.RETURNED || r.status === RecordStatus.SIGNED || r.exportBatch) return false;
            return isRecordOverdue(r);
        }).length;
        
        // Logic overdue completed: Đã xong nhưng bị trễ
        const overdueCompleted = sourceData.filter(r => {
            const isDone = r.status === RecordStatus.HANDOVER || r.status === RecordStatus.RETURNED || r.status === RecordStatus.SIGNED || !!r.exportBatch;
            if (!isDone) return false;
            const d = parseSafeDate(r.deadline);
            const c = parseSafeDate(r.completedDate);
            if (!d || !c) return false;
            d.setHours(0,0,0,0);
            c.setHours(0,0,0,0);
            return c > d;
        }).length;

        const processing = total - completed - withdrawn;
        
        return { total, completed, withdrawn, overduePending, overdueCompleted, processing };
    }, [filteredData, activeTab, selectedEmpId, dailyStatsRecords]);

    const handleQuickReport = (type: 'week' | 'month') => {
        const now = new Date();
        let start = new Date();
        if (type === 'week') {
            const day = now.getDay();
            const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Thứ 2
            start = new Date(now.setDate(diff));
        } else {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
        }
        
        const fromStr = start.toISOString().split('T')[0];
        const toStr = new Date().toISOString().split('T')[0];
        setFromDate(fromStr);
        setToDate(toStr);
        setReportType(type);
        if (activeTab === 'employee' || activeTab === 'ward_stats') {
            // Keep tab
        } else {
            setActiveTab('list');
        }
    };

    const handleGenerateClick = () => {
        if (!fromDate || !toDate) { alert("Vui lòng chọn đầy đủ thời gian."); return; }
        
        const currentKey = getGeminiKey();
        if (!currentKey && !process.env.API_KEY) {
            setIsKeyModalOpen(true);
            return;
        }

        setActiveTab('ai');
        
        let title = mainTab === 'measurement' ? "BÁO CÁO KẾT QUẢ CÔNG TÁC ĐO ĐẠC" : "BÁO CÁO KẾT QUẢ CÔNG TÁC LƯU TRỮ";
        if (reportType === 'week') title = mainTab === 'measurement' ? "BÁO CÁO KẾT QUẢ CÔNG TÁC ĐO ĐẠC TUẦN" : "BÁO CÁO KẾT QUẢ CÔNG TÁC LƯU TRỮ TUẦN";
        if (reportType === 'month') title = mainTab === 'measurement' ? "BÁO CÁO KẾT QUẢ CÔNG TÁC ĐO ĐẠC THÁNG" : "BÁO CÁO KẾT QUẢ CÔNG TÁC LƯU TRỮ THÁNG";

        // Pass filteredData to onGenerate
        onGenerate(fromDate, toDate, title, filteredData);
    };

    const handleExportExcelClick = () => {
        if (!fromDate || !toDate) { alert("Vui lòng chọn đầy đủ thời gian."); return; }
        let title = mainTab === 'measurement' ? "BÁO CÁO KẾT QUẢ CÔNG TÁC ĐO ĐẠC" : "BÁO CÁO KẾT QUẢ CÔNG TÁC LƯU TRỮ";
        if (reportType === 'week') title = mainTab === 'measurement' ? "BÁO CÁO KẾT QUẢ CÔNG TÁC ĐO ĐẠC TUẦN" : "BÁO CÁO KẾT QUẢ CÔNG TÁC LƯU TRỮ TUẦN";
        if (reportType === 'month') title = mainTab === 'measurement' ? "BÁO CÁO KẾT QUẢ CÔNG TÁC ĐO ĐẠC THÁNG" : "BÁO CÁO KẾT QUẢ CÔNG TÁC LƯU TRỮ THÁNG";
        
        onExportExcel(fromDate, toDate, selectedWard, title, filteredData);
    };

    const handlePrint = () => {
        if (!previewRef.current) return;
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow?.document;
        if (doc) {
            doc.open();
            doc.write(`
                <html>
                <head>
                    <title>Báo cáo</title>
                    <style>
                        @page { size: A4 portrait; margin: 2cm; }
                        body { font-family: 'Times New Roman', serif; font-size: 13pt; line-height: 1.3; }
                        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                        th, td { border: 1px solid black; padding: 5px; text-align: left; font-size: 11pt; }
                        th { text-align: center; font-weight: bold; background-color: #f0f0f0; }
                    </style>
                </head>
                <body>${reportContent}</body>
                </html>
            `);
            doc.close();
            setTimeout(() => {
                iframe.contentWindow?.focus();
                iframe.contentWindow?.print();
                document.body.removeChild(iframe);
            }, 500);
        }
    };

    const formatDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('vi-VN') : '-';

    return (
        <div className="flex flex-col h-full overflow-hidden relative bg-slate-50">
            {/* MAIN TAB SWITCHER */}
            <div className="bg-white border-b border-gray-200 flex px-4 pt-2 gap-1 shrink-0">
                {(isHanhChinhOrAdmin || (userDept && (userDept.toLowerCase().includes('đo đạc') || userDept.toLowerCase().includes('kỹ thuật')))) && (
                    <button 
                        onClick={() => setMainTab('measurement')}
                        className={`px-6 py-3 text-sm font-bold rounded-t-lg border-t border-l border-r transition-all flex items-center gap-2 ${mainTab === 'measurement' ? 'bg-blue-50 border-gray-200 text-blue-700 border-b-transparent relative top-[1px]' : 'bg-gray-50 border-transparent text-gray-500 hover:bg-gray-100'}`}
                    >
                        <Ruler size={18} /> Báo cáo Đo đạc
                    </button>
                )}
                {(isHanhChinhOrAdmin || (userDept && userDept.toLowerCase().includes('lưu trữ'))) && (
                    <button 
                        onClick={() => setMainTab('archive')}
                        className={`px-6 py-3 text-sm font-bold rounded-t-lg border-t border-l border-r transition-all flex items-center gap-2 ${mainTab === 'archive' ? 'bg-orange-50 border-gray-200 text-orange-700 border-b-transparent relative top-[1px]' : 'bg-gray-50 border-transparent text-gray-500 hover:bg-gray-100'}`}
                    >
                        <FolderArchive size={18} /> Báo cáo Lưu trữ
                    </button>
                )}
            </div>

            {/* Toolbar */}
            <div className={`p-4 border-b border-gray-200 shadow-sm flex flex-col gap-4 shrink-0 z-10 ${mainTab === 'measurement' ? 'bg-blue-50' : 'bg-orange-50'}`}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${mainTab === 'measurement' ? 'bg-blue-200 text-blue-700' : 'bg-orange-200 text-orange-700'}`}>
                            <BarChart3 size={24} />
                        </div>
                        <div>
                            <h2 className={`font-bold text-lg flex items-center gap-2 ${mainTab === 'measurement' ? 'text-blue-900' : 'text-orange-900'}`}>
                                <span>{mainTab === 'measurement' ? 'Thống kê Hồ sơ Đo đạc' : 'Thống kê Hồ sơ Lưu trữ'}</span>
                                {!isHanhChinhOrAdmin && userDept && (
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 font-sans border border-slate-300">
                                        Bộ phận: {userDept}
                                    </span>
                                )}
                                {isHanhChinhOrAdmin && currentUser?.role && (
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-sans border border-indigo-200">
                                        Quyền: Toàn quyền (Hành chính/Quản trị)
                                    </span>
                                )}
                            </h2>
                            <p className="text-xs text-gray-500">
                                {mainTab === 'measurement' ? 'Dữ liệu từ Tổ đo đạc & Kỹ thuật' : 'Dữ liệu từ Tổ thông tin lưu trữ'}
                            </p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg border border-slate-200">
                        <button 
                            onClick={() => {
                                setFromDate('2025-01-01');
                                setToDate(new Date().toISOString().split('T')[0]);
                                setReportType('custom');
                            }} 
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${(fromDate === '2025-01-01' && reportType === 'custom') ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-blue-600'}`}
                        >
                            <CalendarRange size={14} /> Từ 2025 đến nay
                        </button>
                        <button onClick={() => handleQuickReport('week')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${reportType === 'week' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-blue-600'}`}>
                            <CalendarDays size={14} /> Tuần này
                        </button>
                        <button onClick={() => handleQuickReport('month')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${reportType === 'month' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-blue-600'}`}>
                            <Layout size={14} /> Tháng này
                        </button>
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                        {/* SELECT WARD */}
                        <div className="flex items-center gap-2 bg-white px-2 py-1.5 border border-gray-300 rounded-lg shadow-sm">
                            <MapPin size={16} className="text-gray-500" />
                            <select 
                                value={selectedWard} 
                                onChange={(e) => setSelectedWard(e.target.value)} 
                                className="text-sm outline-none bg-transparent text-gray-700 font-medium cursor-pointer border-none focus:ring-0 max-w-[150px]"
                            >
                                <option value="all">Toàn bộ địa bàn</option>
                                {wards.map(w => (
                                    <option key={w} value={w}>{w}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-2 py-1 shadow-sm">
                            <input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setReportType('custom'); }} className="text-sm outline-none text-gray-700 font-medium" />
                            <span className="text-gray-400">➜</span>
                            <input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setReportType('custom'); }} className="text-sm outline-none text-gray-700 font-medium" />
                        </div>
                        
                        <button onClick={handleExportExcelClick} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-bold text-sm shadow-sm transition-colors" title="Xuất Excel">
                            <FileSpreadsheet size={18} /> Xuất Excel
                        </button>
                    </div>
                </div>
            </div>

            {/* Content Tabs */}
            <div className="flex bg-white border-b border-gray-200 px-4">
                <button 
                    onClick={() => setActiveTab('list')}
                    className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'list' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <ListFilter size={16}/> Danh sách kết quả ({filteredData.length})
                </button>
                <button 
                    onClick={() => setActiveTab('ward_stats')}
                    className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'ward_stats' ? 'border-teal-600 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <PieChart size={16}/> Thống kê theo Xã
                </button>
                <button 
                    onClick={() => setActiveTab('employee')}
                    className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'employee' ? 'border-orange-600 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <UserCheck size={16}/> Thống kê nhân viên
                </button>
                <button 
                    onClick={() => setActiveTab('daily_stats')}
                    className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'daily_stats' ? 'border-pink-600 text-pink-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <CalendarDays size={16}/> Thống kê theo ngày
                </button>
                <button 
                    onClick={() => setActiveTab('overdue')}
                    className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'overdue' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <AlertTriangle size={16}/> Thống kê hồ sơ trễ
                </button>
                <button 
                    onClick={() => setActiveTab('ai')}
                    className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'ai' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <Sparkles size={16}/> Văn bản Báo cáo (AI)
                </button>
            </div>

            {/* STATS CARDS: HIỂN THỊ DƯỚI CONTENT TABS (Tránh chồng nội dung không cần thiết & hỗ trợ click lọc trực tiếp) */}
            <div className="p-4 bg-slate-50 border-b border-gray-200 shrink-0">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in">
                    {/* Thẻ: Tổng hồ sơ */}
                    <div 
                        onClick={() => {
                            setCardFilter(cardFilter === 'all' ? null : 'all');
                            setActiveTab('list');
                        }}
                        className={`p-3 rounded-xl flex items-center gap-3 shadow-sm cursor-pointer transition-all duration-200 border ${
                            (cardFilter === 'all' || cardFilter === null)
                                ? 'bg-blue-100/80 border-blue-400 ring-2 ring-blue-500 scale-[1.02] shadow-md font-semibold' 
                                : 'bg-blue-50/50 border-blue-100 hover:border-blue-300 hover:bg-blue-50 hover:scale-[1.01]'
                        }`}
                        title="Click để xem tất cả hồ sơ"
                    >
                        <div className="bg-blue-200 p-2 rounded-lg text-blue-700 shrink-0"><ListFilter size={20}/></div>
                        <div>
                            <div className="text-2xl font-bold text-blue-800">{generalStats.total}</div>
                            <div className="text-xs text-blue-600 uppercase font-bold whitespace-nowrap">Tổng hồ sơ</div>
                        </div>
                    </div>

                    {/* Thẻ: Đã xong */}
                    <div 
                        onClick={() => {
                            setCardFilter(cardFilter === 'completed' ? null : 'completed');
                            setActiveTab('list');
                        }}
                        className={`p-3 rounded-xl flex items-center gap-3 shadow-sm cursor-pointer transition-all duration-200 border ${
                            cardFilter === 'completed'
                                ? 'bg-green-100 border-green-400 ring-2 ring-green-500 scale-[1.02] shadow-md font-semibold' 
                                : 'bg-green-50/50 border-green-100 hover:border-green-300 hover:bg-green-50 hover:scale-[1.01]'
                        }`}
                        title="Click để lọc hồ sơ đã hoàn thành"
                    >
                        <div className="bg-green-200 p-2 rounded-lg text-green-700 shrink-0"><CheckCircle2 size={20}/></div>
                        <div>
                            <div className="text-2xl font-bold text-green-800">{generalStats.completed}</div>
                            <div className="text-xs text-green-600 uppercase font-bold whitespace-nowrap">Đã xong</div>
                        </div>
                    </div>

                    {/* Thẻ: Đang xử lý */}
                    <div 
                        onClick={() => {
                            setCardFilter(cardFilter === 'processing' ? null : 'processing');
                            setActiveTab('list');
                        }}
                        className={`p-3 rounded-xl flex items-center gap-3 shadow-sm cursor-pointer transition-all duration-200 border ${
                            cardFilter === 'processing'
                                ? 'bg-orange-100 border-orange-400 ring-2 ring-orange-500 scale-[1.02] shadow-md font-semibold' 
                                : 'bg-orange-50/50 border-orange-100 hover:border-orange-300 hover:bg-orange-50 hover:scale-[1.01]'
                        }`}
                        title="Click để lọc hồ sơ đang xử lý"
                    >
                        <div className="bg-orange-200 p-2 rounded-lg text-orange-700 shrink-0"><Clock size={20}/></div>
                        <div>
                            <div className="text-2xl font-bold text-orange-800">{generalStats.processing}</div>
                            <div className="text-xs text-orange-600 uppercase font-bold whitespace-nowrap">Đang xử lý</div>
                        </div>
                    </div>

                    {/* Thẻ: Tổng trễ hạn */}
                    <div 
                        onClick={() => {
                            setCardFilter(cardFilter === 'overdue_pending' ? null : 'overdue_pending');
                            setActiveTab('list');
                        }}
                        className={`p-3 rounded-xl flex items-center gap-3 shadow-sm cursor-pointer transition-all duration-200 border ${
                            (cardFilter === 'overdue_pending' || cardFilter === 'overdue_completed')
                                ? 'bg-red-100 border-red-400 ring-2 ring-red-500 scale-[1.02] shadow-md' 
                                : 'bg-red-50/50 border-red-100 hover:border-red-300 hover:bg-red-50 hover:scale-[1.01]'
                        }`}
                        title="Click để lọc hồ sơ trễ hạn"
                    >
                        <div className="bg-red-200 p-2 rounded-lg text-red-700 shrink-0"><AlertTriangle size={20}/></div>
                        <div className="flex-1 min-w-0">
                            <div 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setCardFilter(cardFilter === 'overdue_pending' ? null : 'overdue_pending');
                                    setActiveTab('list');
                                }}
                                className={`flex justify-between items-center text-red-800 px-1 rounded transition-colors ${
                                    cardFilter === 'overdue_pending' ? 'bg-red-200/70 font-bold border border-red-300' : 'hover:bg-red-100/50'
                                }`}
                                title="Lọc hồ sơ trễ chưa xong"
                            >
                                <span className="text-xs font-semibold">Chưa xong:</span>
                                <span className="text-base font-bold">{generalStats.overduePending}</span>
                            </div>
                            <div 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setCardFilter(cardFilter === 'overdue_completed' ? null : 'overdue_completed');
                                    setActiveTab('list');
                                }}
                                className={`flex justify-between items-center text-red-600/70 mt-0.5 px-1 rounded transition-colors ${
                                    cardFilter === 'overdue_completed' ? 'bg-red-200/50 font-bold border border-red-300' : 'hover:bg-red-100/30'
                                }`}
                                title="Lọc hồ sơ trễ đã xong"
                            >
                                <span className="text-xs font-semibold">Đã xong:</span>
                                <span className="text-xs font-bold">{generalStats.overdueCompleted}</span>
                            </div>
                            <div className="text-[10px] text-red-600 uppercase font-bold text-center mt-1 pt-0.5 border-t border-red-200">
                                Tổng trễ hạn
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* TAB CONTENT */}
            <div className="flex-1 overflow-hidden bg-slate-100 p-0">
                {activeTab === 'list' && (
                    <div className="bg-white rounded-none h-full overflow-hidden flex flex-col animate-fade-in-up p-4">
                        <div className="flex-1 overflow-auto rounded-xl border border-gray-200">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 text-xs text-gray-500 uppercase font-bold sticky top-0 shadow-sm z-10">
                                    <tr>
                                        <th className="p-3 w-10 text-center">#</th>
                                        <th className="p-3 w-32">Mã HS</th>
                                        <th className="p-3 w-48">Chủ sử dụng</th>
                                        <th className="p-3 w-32">Xã/Phường</th>
                                        <th className="p-3 w-16 text-center">Tờ</th>
                                        <th className="p-3 w-16 text-center">Thửa</th>
                                        <th className="p-3 w-24">Ngày nhận</th>
                                        <th className="p-3 w-24">Hẹn trả</th>
                                        <th className="p-3 w-24">Hoàn thành</th>
                                        <th className="p-3 w-32">NV Xử lý</th>
                                        <th className="p-3 w-32 text-center">Trạng thái</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {paginatedData.length > 0 ? paginatedData.map((r, i) => {
                                        const emp = employees.find(e => e.id === r.assignedTo);
                                        const isOverdue = isRecordOverdue(r);
                                        const rowIndex = (currentPage - 1) * itemsPerPage + i + 1;
                                        
                                        let isCompletedLate = false;
                                        if (r.status === RecordStatus.HANDOVER || r.status === RecordStatus.RETURNED) {
                                            if (r.deadline && r.completedDate) {
                                                const d = new Date(r.deadline); d.setHours(0,0,0,0);
                                                const c = new Date(r.completedDate); c.setHours(0,0,0,0);
                                                if (c > d) isCompletedLate = true;
                                            }
                                        }

                                        return (
                                        <tr key={r.id} className="hover:bg-blue-50/50 transition-colors">
                                            <td className="p-3 text-center text-gray-400">{rowIndex}</td>
                                            <td className="p-3 font-medium text-blue-600">{r.code}</td>
                                            <td className="p-3 font-medium">{r.customerName}</td>
                                            <td className="p-3 text-gray-600">{getNormalizedWard(r.ward)}</td>
                                            <td className="p-3 text-center text-gray-600">{r.mapSheet || '-'}</td>
                                            <td className="p-3 text-center text-gray-600">{r.landPlot || '-'}</td>
                                            <td className="p-3 text-gray-600">{formatDate(r.receivedDate)}</td>
                                            <td className={`p-3 font-medium ${isOverdue ? 'text-red-600' : 'text-gray-600'}`}>{formatDate(r.deadline)}</td>
                                            <td className={`p-3 font-medium ${isCompletedLate ? 'text-orange-600' : 'text-green-700'}`}>
                                                {formatDate(r.completedDate)}
                                            </td>
                                            <td className="p-3 text-gray-600 text-xs truncate" title={emp?.name}>{emp ? emp.name : '-'}</td>
                                            <td className="p-3 text-center">
                                                <span className={`px-2 py-1 rounded text-xs border ${
                                                    r.status === RecordStatus.HANDOVER || r.status === RecordStatus.RETURNED ? 'bg-green-100 text-green-700 border-green-200' : 
                                                    r.status === RecordStatus.WITHDRAWN ? 'bg-gray-100 text-gray-600 border-gray-200' :
                                                    r.status === RecordStatus.REJECTED ? 'bg-red-100 text-red-700 border-red-200' :
                                                    isOverdue ? 'bg-red-100 text-red-700 border-red-200 font-bold' :
                                                    'bg-blue-50 text-blue-700 border-blue-100'
                                                }`}>
                                                    {STATUS_LABELS[r.status]}
                                                </span>
                                            </td>

                                        </tr>
                                    )}) : (
                                        <tr><td colSpan={10} className="p-8 text-center text-gray-400">Không có dữ liệu trong khoảng thời gian này.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {/* Pagination Footer */}
                        {filteredData.length > 0 && (
                            <div className="border-t border-gray-200 p-3 bg-gray-50 flex justify-between items-center shrink-0 rounded-b-xl">
                                <span className="text-xs text-gray-500">
                                    Hiển thị <strong>{(currentPage - 1) * itemsPerPage + 1}</strong> - <strong>{Math.min(currentPage * itemsPerPage, filteredData.length)}</strong> trên tổng <strong>{filteredData.length}</strong>
                                </span>
                                <div className="flex items-center gap-1">
                                    <div className="flex items-center mr-4 gap-2">
                                        <span className="text-xs text-gray-500">Số lượng:</span>
                                        <select 
                                            value={itemsPerPage} 
                                            onChange={(e) => setItemsPerPage(Number(e.target.value))} 
                                            className="border border-gray-300 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                                        >
                                            <option value={20}>20</option>
                                            <option value={50}>50</option>
                                            <option value={100}>100</option>
                                            <option value={500}>500</option>
                                        </select>
                                    </div>
                                    <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronLeft size={16} /></button>
                                    <span className="text-xs font-medium mx-2">Trang {currentPage} / {totalPages}</span>
                                    <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronRight size={16} /></button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'ward_stats' && (
                    <WardStatsView records={filteredData} />
                )}

                {activeTab === 'employee' && (
                    <EmployeeStatsView 
                        records={activeRecords}
                        employees={activeEmployees}
                        fromDate={fromDate}
                        toDate={toDate}
                        selectedEmpId={selectedEmpId}
                        setSelectedEmpId={setSelectedEmpId}
                    />
                )}

                {activeTab === 'ai' && (
                    <div className="h-full flex flex-col items-center p-4">
                        {/* AI Toolbar */}
                        <div className="w-full flex justify-between items-center mb-4 bg-white p-3 rounded-xl border border-gray-200 shadow-sm shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="text-sm text-gray-600">
                                    Sử dụng <strong>Gemini AI</strong> để viết báo cáo nhận xét tiến độ.
                                    {reportType !== 'custom' && <span className="ml-2 text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase">Chế độ: {reportType === 'week' ? 'Báo cáo Tuần' : 'Báo cáo Tháng'}</span>}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setIsKeyModalOpen(true)} className="flex items-center gap-1.5 bg-white text-gray-700 border border-gray-300 px-3 py-2 rounded-lg hover:bg-gray-50 font-medium text-sm shadow-sm transition-all" title="Cài đặt API Key">
                                    <Settings size={16} /> Cấu hình AI
                                </button>
                                <button onClick={handleGenerateClick} disabled={isGenerating} className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 font-bold text-sm shadow-md transition-all disabled:opacity-50">
                                    {isGenerating ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                                    Tạo báo cáo ngay
                                </button>
                                {reportContent && (
                                    <button onClick={handlePrint} className="flex items-center gap-2 bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 font-medium text-sm shadow-sm">
                                        <Printer size={16} /> In
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Preview */}
                        <div className="flex-1 w-full overflow-y-auto bg-slate-200 p-8 rounded-xl custom-scrollbar flex justify-center border border-slate-300 shadow-inner">
                            {reportContent ? (
                                <div className="bg-white shadow-2xl p-[20mm_15mm_20mm_25mm] w-[210mm] min-h-[297mm] animate-fade-in-up">
                                    <div ref={previewRef} style={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '13pt', lineHeight: 1.4 }} dangerouslySetInnerHTML={{ __html: reportContent }} />
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center text-slate-400 opacity-60">
                                    <FileText size={64} className="mb-4" />
                                    <p>Chưa có nội dung báo cáo.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'daily_stats' && (
                    <DailyStatsView 
                        records={activeRecords} 
                        employees={activeEmployees} 
                        wards={wards} 
                        onFilteredRecordsChange={setDailyStatsRecords}
                    />
                )}

                {activeTab === 'overdue' && (
                    <OverdueStatsView 
                        records={filteredData}
                        employees={activeEmployees}
                    />
                )}

            </div>

            {/* API Key Modal */}
            {isKeyModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md animate-fade-in-up">
                        <div className="p-5 border-b flex justify-between items-center">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <Key className="text-purple-600" size={20} /> Cấu hình Gemini API Key
                            </h3>
                            <button onClick={() => setIsKeyModalOpen(false)} className="text-gray-400 hover:text-red-500 transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg border border-blue-100">
                                Để sử dụng tính năng viết báo cáo tự động, bạn cần nhập Google Gemini API Key.
                                Key này sẽ được lưu trong trình duyệt của bạn.
                            </p>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">API Key</label>
                                <input 
                                    type="password" 
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                                    placeholder="Dán API Key vào đây..."
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button onClick={() => setIsKeyModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium text-sm">Hủy</button>
                                <button onClick={handleSaveKey} className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 font-bold text-sm shadow-sm">
                                    <Save size={16} /> Lưu Cấu Hình
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReportSection;
