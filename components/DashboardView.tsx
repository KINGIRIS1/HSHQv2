
import React, { useMemo, useState, useEffect } from 'react';
import { RecordFile, RecordStatus } from '../types';
import { getNormalizedWard, getShortRecordType } from '../constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { FileText, RotateCcw, CheckCircle, ArchiveX, MapPin, Layers, CalendarRange, Filter, CalendarDays, Calendar, SlidersHorizontal, ArrowLeft, ArrowRight, Eye, EyeOff, RefreshCw } from 'lucide-react';

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
        const counts: Record<string, number> = {};
        filteredRecords.forEach(r => {
            const w = getNormalizedWard(r.ward) || 'Khác';
            counts[w] = (counts[w] || 0) + 1;
        });
        return Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value); 
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

    // Render Role-based dashboard for Employees and Team Leaders
    if (currentUser && (currentUser.role === 'EMPLOYEE' || currentUser.role === 'TEAM_LEADER')) {
        const modules = [
            {
                id: 'personal_profile',
                label: 'Hồ sơ cá nhân',
                description: 'Xem thông tin cá nhân, chức vụ, địa bàn quản lý, lịch sử hồ sơ và thống kê hiệu suất công việc.',
                icon: FileText,
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
                icon: FileText,
                color: 'text-indigo-600 bg-indigo-50/50 border-indigo-100 hover:border-indigo-300 hover:bg-indigo-50',
            }
        ];

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
                <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 rounded-xl p-4 md:p-5 text-white shadow-lg border border-slate-800 shrink-0">
                    <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
                    <div className="absolute left-1/3 bottom-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>
                    
                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-1.5">
                                <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                                    🛡️ {currentUser.role === 'TEAM_LEADER' ? 'Nhóm trưởng' : 'Nhân viên'}
                                </span>
                                {linkedEmployee?.department && (
                                    <span className="bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                        {linkedEmployee.department}
                                    </span>
                                )}
                            </div>
                            <h1 className="text-xl md:text-2xl font-black tracking-tight text-white mb-1">
                                Xin chào, {currentUser.name}!
                            </h1>
                            <p className="text-slate-400 text-xs max-w-xl leading-relaxed">
                                Chào mừng bạn quay trở lại hệ thống quản lý. Tại đây, bạn có thể nhanh chóng truy cập các tính năng chuyên môn được phân bổ theo vai trò làm việc của mình.
                            </p>
                        </div>
                        
                        {linkedEmployee && (
                            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-lg p-3 w-full md:w-auto shrink-0 md:min-w-[200px]">
                                <h3 className="text-[10px] font-bold text-blue-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                    👤 Thông tin liên kết
                                </h3>
                                <div className="space-y-1 text-[11px]">
                                    <p className="flex justify-between text-slate-300"><span className="text-slate-500">Chức danh:</span> <span className="font-semibold text-slate-100">{linkedEmployee.position || 'Chuyên viên'}</span></p>
                                    <p className="flex justify-between text-slate-300"><span className="text-slate-500">Bộ phận:</span> <span className="font-semibold text-slate-100">{linkedEmployee.department}</span></p>
                                    {linkedEmployee.managedWards && linkedEmployee.managedWards.length > 0 && (
                                        <div className="pt-1 border-t border-white/5 mt-1">
                                            <span className="text-slate-500 block mb-0.5">Địa bàn quản lý:</span>
                                            <div className="flex flex-wrap gap-1">
                                                {linkedEmployee.managedWards.map((w: string) => (
                                                    <span key={w} className="bg-blue-500/10 text-blue-300 text-[9px] px-1 py-0.5 rounded border border-blue-500/20">{w}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Dashboard grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:flex-1 lg:min-h-0">
                    <div className="flex flex-col space-y-3 lg:min-h-0">
                        <h2 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-1.5 shrink-0">
                            <span>Phân hệ công việc của bạn</span>
                        </h2>
                        <div className="space-y-3 lg:overflow-y-auto lg:flex-1 pr-1 custom-scrollbar">
                            {modules.map(mod => {
                                const Icon = mod.icon;
                                return (
                                    <div 
                                        key={mod.id} 
                                        onClick={() => setCurrentView?.(mod.id)}
                                        className={`group cursor-pointer bg-white p-4 rounded-xl border border-slate-100 transition-all duration-300 flex items-start gap-4 hover:-translate-y-0.5 hover:shadow-md ${mod.color}`}
                                    >
                                        <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-sm transition-transform duration-300 group-hover:scale-105 shrink-0">
                                            <Icon size={22} className="text-slate-700" />
                                        </div>
                                        <div className="flex-1 space-y-1 min-w-0">
                                            <div className="flex justify-between items-center">
                                                <h3 className="font-bold text-slate-800 text-sm tracking-tight truncate">{mod.label}</h3>
                                                <ArrowRight size={14} className="text-slate-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300" />
                                            </div>
                                            <p className="text-[11px] text-slate-500 leading-relaxed truncate md:line-clamp-2 md:whitespace-normal">{mod.description}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Hướng dẫn và thông tin bảo mật */}
                    <div className="flex flex-col space-y-3 lg:min-h-0">
                        <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm lg:flex-1 flex flex-col lg:min-h-0 justify-between">
                            <div className="space-y-3 lg:min-h-0 flex flex-col">
                                <h2 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-1.5 border-b border-slate-50 pb-2 shrink-0">
                                    📜 Chính sách phân quyền
                                </h2>
                                <div className="text-[11px] text-slate-600 leading-relaxed space-y-2 lg:overflow-y-auto lg:flex-1 custom-scrollbar pr-1">
                                    <p>
                                        Hệ thống áp dụng cơ chế <strong>Phân quyền dựa trên vai trò và bộ phận làm việc (RBAC)</strong> để tối ưu hóa quy trình làm việc và bảo mật dữ liệu đất đai.
                                    </p>
                                    
                                    <div className="bg-amber-50 border border-amber-200/60 rounded-lg p-2.5 flex gap-2 text-[10px] text-amber-800 shrink-0">
                                        <div className="shrink-0 text-amber-600 font-bold text-base">🔒</div>
                                        <div>
                                            <h4 className="font-bold text-amber-900 mb-0.5">Giới hạn truy cập chủ động</h4>
                                            <p className="leading-relaxed">
                                                Tài khoản của bạn có vai trò <strong>{currentUser.role === 'TEAM_LEADER' ? 'Nhóm trưởng' : 'Nhân viên'}</strong>, các phân hệ ngoài thẩm quyền chuyên môn sẽ được thu gọn để tránh chồng chéo nghiệp vụ.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <h4 className="font-bold text-slate-700">Quyền hạn và chức năng khả dụng:</h4>
                                        <ul className="list-disc list-inside space-y-0.5 text-slate-500 pl-1">
                                            <li>Cập nhật tiến độ bản vẽ và nộp trình ký kiểm tra.</li>
                                            <li>Quản lý thông tin hồ sơ cá nhân và theo dõi hiệu suất làm việc.</li>
                                            <li>Đổi mật khẩu tài khoản và cập nhật thông tin bảo mật.</li>
                                            <li>Sử dụng các công cụ chuyển đổi bản đồ, tính toán trễ hạn phục vụ chuyên môn.</li>
                                            {currentUser.role === 'TEAM_LEADER' && (
                                                <li>Quản lý và phê duyệt hồ sơ nghiệp vụ trực thuộc tổ chuyên môn của mình.</li>
                                            )}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Thống kê nhanh của nhân viên */}
                        <div className="bg-blue-600 text-white rounded-xl p-4 shadow-md space-y-2 relative overflow-hidden shrink-0">
                            <div className="absolute right-0 bottom-0 translate-x-8 translate-y-8 w-24 h-24 bg-white/5 rounded-full blur-xl pointer-events-none"></div>
                            <h3 className="font-bold text-xs tracking-tight">Hỗ trợ kỹ thuật</h3>
                            <p className="text-[11px] text-blue-100 leading-relaxed">
                                Nếu phát hiện sai lệch thông tin liên kết tổ chuyên môn hoặc cần điều chỉnh quyền hạn, vui lòng báo cáo Lãnh đạo hoặc Quản trị viên (Admin).
                            </p>
                            <div className="flex gap-4 pt-1.5 text-[10px] text-blue-200">
                                <div>
                                    <span className="block text-[9px] text-blue-300">Hotline kỹ thuật</span>
                                    <span className="font-bold text-white">0271.xxxx.xxx</span>
                                </div>
                                <div className="border-l border-blue-500 pl-4">
                                    <span className="block text-[9px] text-blue-300">Email quản trị</span>
                                    <span className="font-bold text-white font-mono">admin.honquan@vpdk.gov.vn</span>
                                </div>
                            </div>
                        </div>
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
                        <h2 className="text-base font-bold text-gray-800">Tổng quan tình hình</h2>
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
                        className={`px-2.5 py-1 h-7 rounded-lg border text-[11px] font-bold transition-all flex items-center gap-1 ${showConfig ? 'bg-blue-50 border-blue-200 text-blue-600 shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800'}`}
                        title="Tùy chỉnh các thẻ tổng quan"
                    >
                        <SlidersHorizontal size={12} />
                        <span>Cấu hình thẻ</span>
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
                {/* CHART 1: Thống kê theo Địa bàn */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col h-[260px] lg:h-auto min-h-0">
                    <h3 className="text-xs font-bold text-gray-800 mb-2 shrink-0 flex items-center gap-1.5 uppercase tracking-wide border-b border-slate-50 pb-2">
                        <MapPin size={16} className="text-blue-600" /> Phân bố theo địa bàn ({getTitle()})
                    </h3>
                    <div className="flex-1 min-h-0 w-full relative">
                        {wardData.length > 0 ? (
                            <div className="absolute inset-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={wardData} layout="vertical" margin={{ top: 5, right: 15, left: 20, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e5e7eb" />
                                        <XAxis type="number" fontSize={10} tickLine={false} axisLine={false} />
                                        <YAxis dataKey="name" type="category" width={90} fontSize={10} tick={{fill: '#4b5563', fontWeight: 600}} tickLine={false} axisLine={false} />
                                        <Tooltip 
                                            cursor={{ fill: '#f3f4f6' }} 
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '11px' }} 
                                        />
                                        <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={16} name="Số lượng" />
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

                {/* CHART 2: Phân loại Hồ sơ */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col h-[260px] lg:h-auto min-h-0">
                    <h3 className="text-xs font-bold text-gray-800 mb-2 shrink-0 flex items-center gap-1.5 uppercase tracking-wide border-b border-slate-50 pb-2">
                        <Layers size={16} className="text-purple-600" /> Loại hình hồ sơ ({getTitle()})
                    </h3>
                    <div className="w-full flex-1 min-h-0 relative">
                        {typeData.length > 0 ? (
                            <div className="absolute inset-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie 
                                            data={typeData} 
                                            cx="45%" 
                                            cy="50%" 
                                            innerRadius={45} 
                                            outerRadius={80} 
                                            paddingAngle={2} 
                                            dataKey="value"
                                        >
                                            {typeData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '11px' }} />
                                        <Legend 
                                            layout="vertical" 
                                            verticalAlign="middle" 
                                            align="right"
                                            wrapperStyle={{ fontSize: '10px', fontWeight: 500, color: '#4b5563' }}
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
        </div>
    );
};

export default DashboardView;
