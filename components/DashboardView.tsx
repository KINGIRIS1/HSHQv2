
import React, { useMemo, useState, useEffect } from 'react';
import { RecordFile, RecordStatus } from '../types';
import { getNormalizedWard, getShortRecordType } from '../constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { FileText, RotateCcw, CheckCircle, ArchiveX, MapPin, Layers, CalendarRange, Filter, CalendarDays, Calendar, SlidersHorizontal, ArrowLeft, ArrowRight, Eye, EyeOff, RefreshCw, HelpCircle, Shield, Headphones, X, CheckCircle2, Phone, Mail, Clock, MessageSquare, UserCheck, FolderInput, BarChart3, User } from 'lucide-react';

interface DashboardViewProps {
    records: RecordFile[];
    currentUser?: any;
    employees?: any[];
    setCurrentView?: (view: string) => void;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6'];

const DashboardView: React.FC<DashboardViewProps> = ({ records, currentUser, employees, setCurrentView }) => {
    // --- KHAI BÁO TẤT CẢ HOOKS Ở ĐẦU COMPONENT (Rules of Hooks) ---
    const linkedEmployee = useMemo(() => {
        if (!currentUser?.employeeId || !employees) return null;
        return employees.find(e => e.id === currentUser.employeeId);
    }, [currentUser, employees]);

    // Modal Trợ giúp & Phân quyền
    const [showHelpModal, setShowHelpModal] = useState(false);

    // State chọn chế độ xem: Năm, Tháng, Tuần
    const [viewMode, setViewMode] = useState<'year' | 'month' | 'week'>('year');
    
    // State chọn năm (cho chế độ Year)
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

    // 1. Tự động xác định danh sách các năm có trong dữ liệu
    const availableYears = useMemo(() => {
        const years = new Set<number>();
        const currentYear = new Date().getFullYear();
        years.add(currentYear); // Luôn thêm năm hiện tại

        records.forEach(r => {
            if (r.receivedDate) {
                const y = new Date(r.receivedDate).getFullYear();
                if (!isNaN(y)) years.add(y);
            }
        });
        return Array.from(years).sort((a, b) => b - a);
    }, [records]);

    // 2. Lọc dữ liệu theo chế độ xem
    const filteredRecords = useMemo(() => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        
        return records.filter(r => {
            if (!r.receivedDate) return false;
            const rDate = new Date(r.receivedDate);
            
            if (viewMode === 'year') {
                return rDate.getFullYear() === selectedYear;
            } else if (viewMode === 'month') {
                // Tháng này (của năm hiện tại)
                return rDate.getFullYear() === currentYear && rDate.getMonth() === currentMonth;
            } else if (viewMode === 'week') {
                // Tuần này (Tính từ Thứ 2 đầu tuần)
                const day = now.getDay();
                const diff = now.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
                const monday = new Date(now);
                monday.setHours(0,0,0,0);
                monday.setDate(diff);
                
                const nextSunday = new Date(monday);
                nextSunday.setDate(monday.getDate() + 6);
                nextSunday.setHours(23,59,59,999);
                
                return rDate >= monday && rDate <= nextSunday;
            }
            return false;
        });
    }, [records, selectedYear, viewMode]);

    // 3. Tính toán thống kê
    const total = filteredRecords.length;
    const completed = filteredRecords.filter(r => r.status === RecordStatus.HANDOVER || r.status === RecordStatus.RETURNED || r.status === RecordStatus.REJECTED).length;
    const withdrawn = filteredRecords.filter(r => r.status === RecordStatus.WITHDRAWN).length;
    const processing = total - completed - withdrawn;

    // --- Cấu hình Custom Dashboard (Thứ tự & Hiển thị thẻ) ---
    const [cardOrder, setCardOrder] = useState<string[]>(() => {
        const saved = localStorage.getItem('dashboard_card_order');
        return saved ? JSON.parse(saved) : ['total', 'processing', 'completed', 'withdrawn'];
    });

    const [cardVisibility, setCardVisibility] = useState<Record<string, boolean>>(() => {
        const saved = localStorage.getItem('dashboard_card_visibility');
        return saved ? JSON.parse(saved) : { total: true, processing: true, completed: true, withdrawn: true };
    });

    const [showConfig, setShowConfig] = useState<boolean>(false);

    const cardsConfig = useMemo(() => [
        {
            id: 'total',
            title: 'Tổng nhận',
            value: total,
            subText: 'Hồ sơ',
            subTextClass: 'text-blue-600',
            icon: FileText,
            bgLight: 'bg-blue-50',
            textClass: 'text-blue-600',
            borderClass: 'border-blue-100',
            iconBg: 'text-blue-600'
        },
        {
            id: 'processing',
            title: 'Đang xử lý',
            value: processing,
            subText: `Chiếm ${total > 0 ? Math.round((processing / total) * 100) : 0}%`,
            subTextClass: 'text-yellow-600',
            icon: RotateCcw,
            bgLight: 'bg-yellow-50',
            textClass: 'text-yellow-600',
            borderClass: 'border-yellow-100',
            iconBg: 'text-yellow-600'
        },
        {
            id: 'completed',
            title: 'Đã hoàn thành',
            value: completed,
            subText: `Chiếm ${total > 0 ? Math.round((completed / total) * 100) : 0}%`,
            subTextClass: 'text-green-600',
            icon: CheckCircle,
            bgLight: 'bg-green-50',
            textClass: 'text-green-600',
            borderClass: 'border-green-100',
            iconBg: 'text-green-600'
        },
        {
            id: 'withdrawn',
            title: 'Đã rút / Trả lại',
            value: withdrawn,
            subText: 'Hồ sơ',
            subTextClass: 'text-slate-500',
            icon: ArchiveX,
            bgLight: 'bg-slate-100',
            textClass: 'text-slate-600',
            borderClass: 'border-slate-200',
            iconBg: 'text-slate-600'
        }
    ], [total, processing, completed, withdrawn]);

    const orderedVisibleCards = useMemo(() => {
        return cardOrder
            .map(id => cardsConfig.find(c => c.id === id))
            .filter((c): c is typeof cardsConfig[number] => !!c && cardVisibility[c.id]);
    }, [cardOrder, cardVisibility, cardsConfig]);

    // --- Data cho Biểu đồ Địa bàn (Xã/Phường) ---
    const wardData = useMemo(() => {
        const map: Record<string, { name: string; total: number; completed: number; processing: number }> = {};
        filteredRecords.forEach(r => {
            const w = getNormalizedWard(r.ward) || 'Khác';
            if (!map[w]) {
                map[w] = { name: w, total: 0, completed: 0, processing: 0 };
            }
            map[w].total += 1;
            if (r.status === RecordStatus.HANDOVER || r.status === RecordStatus.RETURNED || r.status === RecordStatus.REJECTED) {
                map[w].completed += 1;
            } else if (r.status !== RecordStatus.WITHDRAWN) {
                map[w].processing += 1;
            }
        });
        return Object.values(map).sort((a, b) => b.total - a.total); 
    }, [filteredRecords]);

    // --- Data cho Biểu đồ Loại hồ sơ ---
    const typeData = useMemo(() => {
        const counts: Record<string, number> = {};
        filteredRecords.forEach(r => {
            const t = getShortRecordType(r.recordType);
            counts[t] = (counts[t] || 0) + 1;
        });
        return Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [filteredRecords]);

    // Render Role-based dashboard for Employees, Team Leaders and OneDoor
    if (currentUser && (currentUser.role === 'EMPLOYEE' || currentUser.role === 'TEAM_LEADER' || currentUser.role === 'ONEDOOR')) {
        const modules = [
            {
                id: 'personal_profile',
                label: 'Hồ sơ cá nhân',
                description: 'Xem thông tin cá nhân, chức vụ, địa bàn quản lý, lịch sử hồ sơ và thống kê hiệu suất công việc.',
                icon: UserCheck,
                color: 'text-blue-600 bg-blue-50/50 border-blue-100 hover:border-blue-300 hover:bg-blue-50',
            },
            {
                id: 'work_schedule',
                label: 'Lịch công tác',
                description: 'Theo dõi lịch làm việc tuần, tháng của cơ quan, nhận phân công nhiệm vụ và lịch trực tại một cửa.',
                icon: CalendarDays,
                color: 'text-emerald-600 bg-emerald-50/50 border-emerald-100 hover:border-emerald-300 hover:bg-emerald-50',
            },
            {
                id: 'reports',
                label: 'Báo cáo & Thống kê',
                description: 'Báo cáo tổng hợp số liệu thụ lý hồ sơ, tỷ lệ hoàn thành công việc và biểu đồ trực quan cá nhân.',
                icon: BarChart3,
                color: 'text-indigo-600 bg-indigo-50/50 border-indigo-100 hover:border-indigo-300 hover:bg-indigo-50',
            }
        ];

        // Thêm quyền Chuyên môn cho Một cửa
        if (currentUser.role === 'ONEDOOR') {
            modules.unshift({
                id: 'receive_record',
                label: 'Tiếp nhận hồ sơ',
                description: 'Tiếp nhận hồ sơ đầu vào từ người dân, kiểm tra tính hợp lệ và luân chuyển về các tổ chuyên môn.',
                icon: FolderInput,
                color: 'text-amber-600 bg-amber-50/50 border-amber-100 hover:border-amber-300 hover:bg-amber-50',
            });
            modules.push({
                id: 'registration_records',
                label: 'Tra cứu hồ sơ',
                description: 'Tra cứu thông tin hồ sơ, tiến độ giải quyết và kết quả trả cho công dân.',
                icon: FileText,
                color: 'text-rose-600 bg-rose-50/50 border-rose-100 hover:border-rose-300 hover:bg-rose-50',
            });
        }

        // Thêm quyền Chuyên môn cho Team Leader dựa theo phòng ban
        if (currentUser.role === 'TEAM_LEADER') {
            const dept = linkedEmployee?.department?.toLowerCase() || '';
            if (dept.includes('đo đạc') || dept.includes('ky thuat')) {
                modules.push({
                    id: 'all_records',
                    label: 'Quản lý Hồ sơ Đo đạc',
                    description: 'Phân công nhiệm vụ, ký kiểm duyệt bản vẽ, theo dõi tiến độ đo đạc thực địa và giao hồ sơ cho bộ phận một cửa.',
                    icon: FileText,
                    color: 'text-rose-600 bg-rose-50/50 border-rose-100 hover:border-rose-300 hover:bg-rose-50',
                });
            } else if (dept.includes('đăng ký') || dept.includes('cap giay')) {
                modules.push({
                    id: 'registration_records',
                    label: 'Quản lý Hồ sơ Đăng ký',
                    description: 'Kiểm tra, xét duyệt hồ sơ đăng ký biến động, cấp giấy chứng nhận quyền sử dụng đất, đăng ký thế chấp.',
                    icon: FileText,
                    color: 'text-purple-600 bg-purple-50/50 border-purple-100 hover:border-purple-300 hover:bg-purple-50',
                });
            } else if (dept.includes('lưu trữ') || dept.includes('thông tin') || dept.includes('van thu')) {
                modules.push({
                    id: 'archive_records',
                    label: 'Quản lý Hồ sơ Lưu trữ',
                    description: 'Phục vụ tra cứu tư liệu đất đai, khai thác bản đồ, trích lục hồ sơ và lưu trữ công văn đến/đi.',
                    icon: Layers,
                    color: 'text-teal-600 bg-teal-50/50 border-teal-100 hover:border-teal-300 hover:bg-teal-50',
                });
            }
        }

        return (
            <div className="w-full flex flex-col p-4 max-w-7xl mx-auto space-y-4 lg:h-full lg:overflow-hidden">
                {/* Banner chào mừng */}
                <div className="relative overflow-hidden bg-gradient-to-r from-blue-700 via-indigo-600 to-sky-600 rounded-xl p-4 md:p-5 text-white shadow-md border border-blue-400/30 shrink-0">
                    <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
                    <div className="absolute left-1/3 bottom-0 w-64 h-64 bg-sky-300/10 rounded-full blur-3xl pointer-events-none"></div>
                    
                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex-1 min-w-0">
                            <h1 className="text-xl md:text-2xl font-black tracking-tight text-white mb-1">
                                Xin chào, {currentUser.name}!
                            </h1>
                            <p className="text-blue-100 text-xs leading-relaxed max-w-none">
                                Chào mừng bạn quay trở lại hệ thống quản lý. Tại đây, bạn có thể nhanh chóng truy cập các tính năng chuyên môn được phân bổ theo vai trò làm việc của mình.
                            </p>
                        </div>
                        
                    </div>
                </div>

                {/* Dashboard grid */}
                <div className="flex flex-col space-y-3 lg:flex-1 lg:min-h-0">
                    <h2 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-1.5 shrink-0">
                        <span>Phân hệ công việc của bạn</span>
                    </h2>
                    <div className="grid grid-cols-1 w-full gap-2.5 lg:overflow-y-auto lg:flex-1 pr-1 custom-scrollbar">
                        {modules.map(mod => {
                            const Icon = mod.icon;
                            return (
                                <div 
                                    key={mod.id} 
                                    onClick={() => setCurrentView?.(mod.id)}
                                    className={`group cursor-pointer bg-white p-3.5 md:p-4 rounded-xl border border-slate-100 transition-all duration-200 flex items-center justify-between gap-4 hover:-translate-y-0.5 hover:shadow-md ${mod.color}`}
                                >
                                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                                        <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-sm transition-transform duration-200 group-hover:scale-105 shrink-0">
                                            <Icon size={20} className="text-slate-700" />
                                        </div>
                                        <div className="space-y-0.5 min-w-0 flex-1">
                                            <h3 className="font-bold text-slate-800 text-sm tracking-tight truncate">{mod.label}</h3>
                                            <p className="text-[11px] text-slate-500 leading-normal line-clamp-1">{mod.description}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <ArrowRight size={16} className="text-slate-400 group-hover:text-slate-700 group-hover:translate-x-1 transition-all duration-200" />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    }

    const handleMoveCard = (index: number, direction: number) => {
        const newOrder = [...cardOrder];
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= newOrder.length) return;
        
        // Hoán đổi vị trí
        const temp = newOrder[index];
        newOrder[index] = newOrder[targetIndex];
        newOrder[targetIndex] = temp;
        
        setCardOrder(newOrder);
        localStorage.setItem('dashboard_card_order', JSON.stringify(newOrder));
    };

    const handleToggleVisibility = (id: string) => {
        const newVisibility = { ...cardVisibility, [id]: !cardVisibility[id] };
        
        // Đảm bảo ít nhất 1 thẻ được hiển thị
        const visibleCount = Object.values(newVisibility).filter(Boolean).length;
        if (visibleCount === 0) {
            alert("Bạn cần giữ lại ít nhất 1 thẻ hiển thị!");
            return;
        }
        
        setCardVisibility(newVisibility);
        localStorage.setItem('dashboard_card_visibility', JSON.stringify(newVisibility));
    };

    const handleResetConfig = () => {
        const defaultOrder = ['total', 'processing', 'completed', 'withdrawn'];
        const defaultVisibility = { total: true, processing: true, completed: true, withdrawn: true };
        
        setCardOrder(defaultOrder);
        setCardVisibility(defaultVisibility);
        
        localStorage.removeItem('dashboard_card_order');
        localStorage.removeItem('dashboard_card_visibility');
    };

    const getGridColsClass = (count: number) => {
        if (count === 4) return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";
        if (count === 3) return "grid-cols-1 sm:grid-cols-3";
        if (count === 2) return "grid-cols-1 sm:grid-cols-2";
        return "grid-cols-1";
    };

    const getTitle = () => {
        if (viewMode === 'week') return "Tuần này";
        if (viewMode === 'month') return `Tháng ${new Date().getMonth() + 1}/${new Date().getFullYear()}`;
        return `Năm ${selectedYear}`;
    };

    return (
        <div className="w-full space-y-3 p-3 flex flex-col lg:h-full lg:overflow-hidden bg-slate-50/20">
            
            {/* HEADER */}
            <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-3 shrink-0 sticky top-0 z-10">
                <div className="flex items-center gap-2.5 w-full md:w-auto">
                    <div className="bg-blue-600 text-white p-1.5 rounded-lg shadow-blue-200 shadow-md">
                        <CalendarRange size={20} />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-gray-800">Tổng quan</h2>
                        <p className="text-[10px] text-gray-500 font-medium">Thống kê dữ liệu: <span className="text-blue-600 font-bold">{getTitle()}</span></p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto justify-end">
                    <div className="flex items-center gap-1.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                        <button 
                            onClick={() => setViewMode('week')}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 ${viewMode === 'week' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <CalendarDays size={12} /> Tuần này
                        </button>
                        <button 
                            onClick={() => setViewMode('month')}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 ${viewMode === 'month' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <Calendar size={12} /> Tháng này
                        </button>
                        <div className="h-3 w-px bg-slate-300 mx-1"></div>
                        <div className="flex items-center gap-1 px-1">
                            <span className={`text-[11px] font-bold ${viewMode === 'year' ? 'text-blue-600' : 'text-slate-500'}`} onClick={() => setViewMode('year')}>Năm:</span>
                            <select 
                                value={selectedYear} 
                                onChange={(e) => { setSelectedYear(parseInt(e.target.value)); setViewMode('year'); }}
                                className="bg-transparent border-none text-[11px] font-bold text-slate-700 outline-none cursor-pointer hover:text-blue-600 transition-colors"
                            >
                                {availableYears.map(year => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <button 
                        onClick={() => setShowConfig(!showConfig)}
                        className={`p-1.5 h-7 w-7 rounded-lg border transition-all flex items-center justify-center ${showConfig ? 'bg-blue-50 border-blue-200 text-blue-600 shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800'}`}
                        title="Cấu hình thẻ tổng quan"
                    >
                        <SlidersHorizontal size={14} />
                    </button>
                </div>
            </div>

            {/* CONFIGURATION PANEL */}
            {showConfig && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2 shrink-0">
                    <div className="flex justify-between items-center pb-1.5 border-b border-slate-200">
                        <div className="flex items-center gap-1.5">
                            <SlidersHorizontal size={12} className="text-slate-600" />
                            <h4 className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Tùy chỉnh thẻ tổng quan cá nhân</h4>
                        </div>
                        <button 
                            onClick={handleResetConfig}
                            className="text-[10px] text-blue-600 hover:text-blue-800 font-bold flex items-center gap-0.5 transition-colors"
                            title="Khôi phục thứ tự và trạng thái hiển thị mặc định"
                        >
                            <RefreshCw size={10} /> Khôi phục mặc định
                        </button>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                        {cardOrder.map((id, index) => {
                            const config = cardsConfig.find(c => c.id === id);
                            if (!config) return null;
                            const isVisible = cardVisibility[id];
                            const CardIcon = config.icon;
                            
                            return (
                                <div key={id} className={`p-2 bg-white rounded-lg border flex items-center justify-between shadow-sm transition-all ${isVisible ? 'border-slate-200' : 'border-dashed border-slate-200 bg-slate-50 opacity-60'}`}>
                                    <div className="flex items-center gap-2 min-w-0">
                                        <div className={`p-1 rounded-md ${isVisible ? config.bgLight + ' ' + config.textClass : 'bg-slate-100 text-slate-400'}`}>
                                            <CardIcon size={12} />
                                        </div>
                                        <div className="truncate">
                                            <p className="text-[11px] font-bold text-slate-700 leading-tight">{config.title}</p>
                                            <p className="text-[9px] text-slate-400 font-medium">Vị trí: {index + 1}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-0.5 shrink-0">
                                        {/* Toggle hiển thị */}
                                        <button 
                                            onClick={() => handleToggleVisibility(id)}
                                            className={`p-0.5 rounded transition-colors ${isVisible ? 'text-blue-600 hover:bg-blue-50' : 'text-slate-400 hover:bg-slate-100'}`}
                                            title={isVisible ? 'Ẩn thẻ' : 'Hiển thị thẻ'}
                                        >
                                            {isVisible ? <Eye size={12} /> : <EyeOff size={12} />}
                                        </button>
                                        
                                        {/* Di chuyển trái/lên */}
                                        <button 
                                            onClick={() => handleMoveCard(index, -1)}
                                            disabled={index === 0}
                                            className="p-0.5 rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                            title="Di chuyển sang trái"
                                        >
                                            <ArrowLeft size={12} />
                                        </button>
                                        
                                        {/* Di chuyển phải/xuống */}
                                        <button 
                                            onClick={() => handleMoveCard(index, 1)}
                                            disabled={index === cardOrder.length - 1}
                                            className="p-0.5 rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                            title="Di chuyển sang phải"
                                        >
                                            <ArrowRight size={12} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* CARDS: THỐNG KÊ CHI TIẾT */}
            <div className={`grid gap-4 shrink-0 ${getGridColsClass(orderedVisibleCards.length)}`}>
                {orderedVisibleCards.map((card) => {
                    const CardIcon = card.icon;
                    return (
                        <div key={card.id} className="bg-white p-4 lg:p-5 rounded-xl border border-slate-100 flex items-center justify-between relative overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md group">
                            <div className={`absolute -bottom-4 -right-4 opacity-10 group-hover:opacity-20 transition-all duration-300 transform rotate-12 z-0 ${card.iconBg}`}>
                                <CardIcon size={64} />
                            </div>
                            <div className="relative z-10">
                                <p className="text-slate-400 text-[10px] lg:text-[11px] font-bold uppercase tracking-wider">{card.title}</p>
                                <h3 className={`text-2xl lg:text-3xl font-black mt-1 tracking-tight ${card.id === 'total' ? 'text-slate-800' : card.textClass}`}>{card.value}</h3>
                                <p className={`text-[10px] font-medium mt-0.5 ${card.subTextClass}`}>{card.subText}</p>
                            </div>
                            <div className={`relative z-10 p-2.5 rounded-xl shadow-sm border transition-transform duration-300 group-hover:scale-105 ${card.bgLight} ${card.textClass} ${card.borderClass}`}>
                                <CardIcon size={20} />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* CHARTS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:flex-1 lg:min-h-0">
                {/* CHART 1: Thống kê nhận & xử lý hồ sơ theo Địa bàn (Xã/Phường) */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col min-h-[320px] lg:min-h-[340px]">
                    <h3 className="text-xs font-bold text-gray-800 mb-2 shrink-0 flex items-center justify-between uppercase tracking-wide border-b border-slate-50 pb-2">
                        <span className="flex items-center gap-1.5"><MapPin size={16} className="text-blue-600" /> Nhận & Xử lý hồ sơ theo Xã/Phường ({getTitle()})</span>
                    </h3>
                    <div className="flex-1 min-h-[260px] w-full relative">
                        {wardData.length > 0 ? (
                            <div className="absolute inset-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={wardData} margin={{ top: 10, right: 15, left: 0, bottom: 40 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                        <XAxis dataKey="name" fontSize={10} interval={0} angle={-25} textAnchor="end" tick={{ fill: '#4b5563', fontWeight: 600 }} />
                                        <YAxis fontSize={10} tick={{ fill: '#4b5563' }} />
                                        <Tooltip 
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '11px' }} 
                                        />
                                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '5px' }} />
                                        <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Tổng nhận" barSize={18} />
                                        <Bar dataKey="completed" fill="#10b981" radius={[4, 4, 0, 0]} name="Đã hoàn thành" barSize={18} />
                                        <Bar dataKey="processing" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Đang xử lý" barSize={18} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 text-xs">
                                <p>Chưa có dữ liệu {getTitle()}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* CHART 2: Phân loại Hồ sơ (Hình tròn phóng lớn) */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col min-h-[320px] lg:min-h-[340px]">
                    <h3 className="text-xs font-bold text-gray-800 mb-2 shrink-0 flex items-center gap-1.5 uppercase tracking-wide border-b border-slate-50 pb-2">
                        <Layers size={16} className="text-purple-600" /> Tỷ lệ phân bổ Loại hình hồ sơ ({getTitle()})
                    </h3>
                    <div className="w-full flex-1 min-h-[260px] relative">
                        {typeData.length > 0 ? (
                            <div className="absolute inset-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie 
                                            data={typeData} 
                                            cx="40%" 
                                            cy="50%" 
                                            innerRadius={55} 
                                            outerRadius={100} 
                                            paddingAngle={3} 
                                            dataKey="value"
                                            nameKey="name"
                                            label={false}
                                        >
                                            {typeData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '11px' }} formatter={(val: any) => [`${val} hồ sơ`, 'Số lượng']} />
                                        <Legend 
                                            layout="vertical" 
                                            verticalAlign="middle" 
                                            align="right"
                                            wrapperStyle={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 text-xs">
                                <p>Chưa có dữ liệu {getTitle()}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* MODAL TRỢ GIÚP - CHÍNH SÁCH PHÂN QUYỀN & HỖ TRỢ KỸ THUẬT */}
            {showHelpModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 p-4 text-white flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-500/20 rounded-xl border border-blue-400/30 text-blue-300">
                                    <HelpCircle size={22} />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-white tracking-wide">
                                        Trung Tâm Trợ Giúp & Quyền Hệ Thống
                                    </h2>
                                    <p className="text-xs text-slate-300">
                                        Thông tin chính sách phân quyền vai trò và kênh hỗ trợ kỹ thuật
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowHelpModal(false)}
                                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Body - Combined Permissions & Support */}
                        <div className="p-5 overflow-y-auto flex-1 space-y-6 text-sm text-slate-700">
                            {/* SECTION 1: PHÂN QUYỀN VAI TRÒ */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                                    <Shield size={18} className="text-blue-600" />
                                    <h3 className="font-bold text-sm text-slate-800 uppercase tracking-wide">
                                        1. Chính sách phân quyền vai trò
                                    </h3>
                                </div>

                                {/* Current User Banner */}
                                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 flex items-center gap-3">
                                    <div className="p-2 bg-blue-600 text-white rounded-lg shrink-0">
                                        <UserCheck size={20} />
                                    </div>
                                    <div className="text-xs">
                                        <div className="text-blue-900 font-bold">
                                            Tài khoản đang đăng nhập: <span className="text-blue-700 font-black">{currentUser?.name}</span>
                                        </div>
                                        <div className="text-blue-800">
                                            Vai trò hệ thống: <span className="font-bold uppercase text-blue-900">{currentUser?.role === 'ADMIN' ? 'Administrator' : currentUser?.role === 'SUBADMIN' ? 'Phó quản trị' : currentUser?.role === 'TEAM_LEADER' ? 'Nhóm trưởng' : currentUser?.role === 'ONEDOOR' ? 'Một cửa' : 'Nhân viên'}</span>
                                            {linkedEmployee?.department ? ` • Bộ phận: ${linkedEmployee.department}` : ''}
                                        </div>
                                    </div>
                                </div>

                                {/* List of Roles */}
                                <div className="space-y-2.5">
                                    {/* Role 1: Admin */}
                                    <div className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-purple-300 transition-colors shadow-xs">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-bold text-xs">
                                                ADMINISTRATOR (Quản trị viên)
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-600 leading-relaxed">
                                            Toàn quyền truy cập và cấu hình toàn bộ hệ thống. Quản lý danh mục người dùng, phân quyền vai trò, cấu hình bảng giá sản phẩm/dịch vụ, kiểm toán dữ liệu ngày tháng, xem và xuất tất cả báo cáo thống kê.
                                        </p>
                                    </div>

                                    {/* Role 2: SubAdmin */}
                                    <div className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 transition-colors shadow-xs">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold text-xs">
                                                PHÓ QUẢN TRỊ (SubAdmin)
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-600 leading-relaxed">
                                            Hỗ trợ quản trị dữ liệu hồ sơ, theo dõi tình trạng xử lý trên toàn địa bàn, kiểm tra và chuẩn hóa ngày tháng, truy cập báo cáo tổng hợp và thực hiện các tác vụ quản trị được phân công.
                                        </p>
                                    </div>

                                    {/* Role 3: Team Leader */}
                                    <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/30 hover:border-blue-300 transition-colors shadow-xs">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold text-xs">
                                                NHÓM TRƯỞNG / TỔ TRƯỞNG CHUYÊN MÔN
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-600 leading-relaxed">
                                            Quản lý và phân công hồ sơ cho chuyên viên trong nhóm/tổ, đôn đốc tiến độ hạn xử lý, duyệt hoàn thành công việc, tra cứu tư liệu đất đai trích lục, và theo dõi báo cáo hiệu suất làm việc của tổ chuyên môn.
                                        </p>
                                    </div>

                                    {/* Role 4: OneDoor */}
                                    <div className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-amber-300 transition-colors shadow-xs">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-xs">
                                                BỘ PHẬN MỘT CỬA (OneDoor)
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-600 leading-relaxed">
                                            Tiếp nhận và đăng ký hồ sơ đầu vào từ người dân/doanh nghiệp, lập giấy hẹn, thu phí/lệ phí và tiền tạm ứng, xuất danh sách bàn giao hồ sơ sang bộ phận chuyên môn, và thực hiện trả kết quả.
                                        </p>
                                    </div>

                                    {/* Role 5: Employee */}
                                    <div className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 transition-colors shadow-xs">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-xs">
                                                NHÂN VIÊN / CHUYÊN VIÊN
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-600 leading-relaxed">
                                            Thực hiện đo đạc, thẩm định và xử lý nghiệp vụ các hồ sơ được phân công. Cập nhật tiến độ xử lý, đính kèm file bản vẽ/tài liệu kết quả, và báo cáo hoàn tất tác vụ cho Nhóm trưởng.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* SECTION 2: HỖ TRỢ KỸ THUẬT */}
                            <div className="space-y-4 pt-2">
                                <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                                    <Headphones size={18} className="text-emerald-600" />
                                    <h3 className="font-bold text-sm text-slate-800 uppercase tracking-wide">
                                        2. Hỗ trợ kỹ thuật & Liên hệ
                                    </h3>
                                </div>

                                {/* Tech Support Header Banner */}
                                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs space-y-2">
                                    <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                                        <Headphones className="text-emerald-600" size={18} />
                                        Đơn vị Quản trị & Hỗ trợ Kỹ thuật Hệ thống
                                    </div>
                                    <p className="text-emerald-800 leading-relaxed">
                                        Bộ phận Kỹ thuật luôn sẵn sàng hỗ trợ cán bộ giải quyết các sự cố phần mềm, khôi phục dữ liệu, hướng dẫn thao tác hoặc tiếp nhận yêu cầu điều chỉnh phân quyền tài khoản.
                                    </p>
                                </div>

                                {/* Contact Info Cards Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="p-3.5 bg-white border border-slate-200 rounded-xl flex items-start gap-3 shadow-xs">
                                        <div className="p-2.5 bg-blue-100 text-blue-700 rounded-lg shrink-0">
                                            <Phone size={18} />
                                        </div>
                                        <div className="text-xs">
                                            <div className="font-bold text-slate-800">Hotline / Zalo Kỹ thuật</div>
                                            <div className="font-mono text-sm font-bold text-blue-600 my-0.5">0976354944</div>
                                            <div className="text-slate-500">Hỗ trợ trực tiếp qua Zalo hoặc Cuộc gọi</div>
                                        </div>
                                    </div>

                                    <div className="p-3.5 bg-white border border-slate-200 rounded-xl flex items-start gap-3 shadow-xs">
                                        <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-lg shrink-0">
                                            <Mail size={18} />
                                        </div>
                                        <div className="text-xs">
                                            <div className="font-bold text-slate-800">Email Tiếp nhận Sự cố</div>
                                            <div className="font-mono text-xs font-bold text-emerald-700 my-0.5">Ngtaitinh@gmail.com</div>
                                            <div className="text-slate-500">Phản hồi trong thời gian sớm nhất</div>
                                        </div>
                                    </div>

                                    <div className="p-3.5 bg-white border border-slate-200 rounded-xl flex items-start gap-3 shadow-xs">
                                        <div className="p-2.5 bg-amber-100 text-amber-700 rounded-lg shrink-0">
                                            <Clock size={18} />
                                        </div>
                                        <div className="text-xs">
                                            <div className="font-bold text-slate-800">Thời gian làm việc</div>
                                            <div className="font-semibold text-slate-700 my-0.5">07:30 - 17:00 (Thứ 2 - Thứ 6)</div>
                                            <div className="text-slate-500">Thứ 7: 08:00 - 11:30</div>
                                        </div>
                                    </div>

                                    <div className="p-3.5 bg-white border border-slate-200 rounded-xl flex items-start gap-3 shadow-xs">
                                        <div className="p-2.5 bg-purple-100 text-purple-700 rounded-lg shrink-0">
                                            <MessageSquare size={18} />
                                        </div>
                                        <div className="text-xs">
                                            <div className="font-bold text-slate-800">Quy trình báo lỗi nhanh</div>
                                            <div className="text-slate-600 my-0.5">Chụp màn hình + Gửi Mã hồ sơ bị lỗi</div>
                                            <div className="text-slate-500">Kèm mô tả chi tiết thao tác vừa thực hiện</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Additional Notes */}
                                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1.5">
                                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                                        <CheckCircle2 size={15} className="text-blue-600" /> Lưu ý dành cho Cán bộ sử dụng:
                                    </div>
                                    <ul className="list-disc list-inside space-y-1 text-slate-600 pl-1">
                                        <li>Tuyệt đối không chia sẻ mật khẩu tài khoản cán bộ cho người khác.</li>
                                        <li>Nếu phát hiện sai lệch số liệu doanh thu hoặc ngày tháng, sử dụng công cụ **Kiểm toán ngày tháng** trong Cấu hình hệ thống.</li>
                                        <li>Mọi thao tác chỉnh sửa, xóa hồ sơ đều được lưu nhật ký (Audit Log) để đảm bảo tính minh bạch.</li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-3 bg-slate-100 border-t border-slate-200 flex justify-end shrink-0">
                            <button
                                onClick={() => setShowHelpModal(false)}
                                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs transition-all shadow-sm cursor-pointer"
                            >
                                Đóng cửa sổ
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DashboardView;
