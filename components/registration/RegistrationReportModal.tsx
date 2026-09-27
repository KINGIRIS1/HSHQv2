import React, { useState, useEffect, useMemo, useRef } from 'react';
import { RecordFile, RecordStatus, Employee, User } from '../../types';
import { getNormalizedWard, STATUS_LABELS, getShortRecordType } from '../../constants';
import { isRecordOverdue, removeVietnameseTones, parseSafeDate, cleanSyncNotes } from '../../utils/appHelpers';
import { fetchDangkyRecords } from '../../services/apiRegistration';
import EmployeeStatsView from '../report/EmployeeStatsView';
import WardStatsView from '../report/WardStatsView';
import DailyStatsView from '../report/DailyStatsView';
import OverdueStatsView from '../report/OverdueStatsView';
import RevenueStatsView from '../report/RevenueStatsView';
import FlexibleDateInput from '../FlexibleDateInput';
import { BarChart3, FileSpreadsheet, Loader2, CalendarDays, Printer, Layout, FileText, ListFilter, CheckCircle2, Clock, AlertTriangle, X, MapPin, UserCheck, ChevronLeft, ChevronRight, PieChart, CheckCircle, CalendarRange, DollarSign, Search } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';

interface RegistrationReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    wards: string[];
    employees: Employee[];
    currentUser?: User;
}

export const RegistrationReportModal: React.FC<RegistrationReportModalProps> = ({ isOpen, onClose, wards, employees, currentUser }) => {
    const [records, setRecords] = useState<RecordFile[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const [fromDate, setFromDate] = useState<string>('1970-01-01');
    const [toDate, setToDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
    const [selectedWard, setSelectedWard] = useState<string>('all');
    const [selectedEmpId, setSelectedEmpId] = useState<string>('');
    const [reportType, setReportType] = useState<'today' | 'week' | 'month' | 'custom'>('custom');
    const [cardFilter, setCardFilter] = useState<'all' | 'completed' | 'processing' | 'overdue_pending' | 'overdue_completed' | null>(null);
    const [activeTab, setActiveTab] = useState<'list' | 'ward_stats' | 'revenue' | 'employee' | 'daily_stats' | 'overdue'>('list');

    const [searchTerm, setSearchTerm] = useState<string>('');
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [itemsPerPage, setItemsPerPage] = useState<number>(20);
    const [mobileVisibleCount, setMobileVisibleCount] = useState<number>(20);

    const [dailyStatsRecords, setDailyStatsRecords] = useState<RecordFile[]>([]);
    const [revenueStatsRecords, setRevenueStatsRecords] = useState<RecordFile[]>([]);
    const [overdueStatsRecords, setOverdueStatsRecords] = useState<RecordFile[]>([]);

    const previewRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            const loadData = async () => {
                setIsLoading(true);
                try {
                    const data = await fetchDangkyRecords();
                    setRecords(data);
                } catch (e) {
                    console.error("Error loading registration records for report modal", e);
                } finally {
                    setIsLoading(false);
                }
            };
            loadData();
        }
    }, [isOpen]);

    const isRevenueHidden = currentUser?.role === 'EMPLOYEE' || currentUser?.role === 'TEAM_LEADER';

    // Active employees for Registration
    const activeEmployees = useMemo(() => {
        if (currentUser?.role === 'EMPLOYEE' && currentUser.employeeId) {
            const found = employees.find(e => e.id === currentUser.employeeId);
            if (found) return [found];
        }
        return employees.filter(e => {
            const dept = (e.department || '').toLowerCase();
            const pos = (e.position || '').toLowerCase();
            const isExcluded = 
                dept.includes('đo đạc') || 
                dept.includes('kỹ thuật') || 
                dept.includes('lưu trữ') || 
                dept.includes('hành chính') || 
                dept.includes('ban giám đốc') ||
                pos.includes('giám đốc');
            if (isExcluded) return false;
            return dept.includes('cấp giấy') || dept.includes('đăng ký') || dept.includes('thẩm định') || dept.includes('đkđđ') || dept.includes('gcn');
        });
    }, [employees, currentUser]);

    const filteredData = useMemo(() => {
        const start = parseSafeDate(fromDate) || new Date(fromDate); start.setHours(0,0,0,0);
        const end = parseSafeDate(toDate) || new Date(toDate); end.setHours(23,59,59,999);

        return records.filter(r => {
            const rDate = parseSafeDate(r.receivedDate);
            if (!rDate) return false;
            rDate.setHours(12,0,0,0);
            const matchDate = rDate >= start && rDate <= end;

            let matchWard = true;
            if (selectedWard !== 'all') {
                const rWard = removeVietnameseTones(r.ward || '');
                const sWard = removeVietnameseTones(selectedWard);
                matchWard = rWard.includes(sWard);
            }

            let matchEmp = true;
            if (selectedEmpId) {
                const emp = employees.find(e => e.id === selectedEmpId);
                const empName = emp ? emp.name.trim().toLowerCase() : '';
                const assigned = (r.assignedTo || '').trim().toLowerCase();
                const checked = (r.checkedBy || '').trim().toLowerCase();
                const printed = (r.printStaffId || '').trim().toLowerCase();
                matchEmp = assigned === selectedEmpId.toLowerCase() || assigned === empName ||
                           checked === selectedEmpId.toLowerCase() || checked === empName ||
                           printed === selectedEmpId.toLowerCase() || printed === empName;
            }

            return matchDate && matchWard && matchEmp;
        });
    }, [records, fromDate, toDate, selectedWard, selectedEmpId, employees]);

    const finalFilteredData = useMemo(() => {
        let base = filteredData;
        if (cardFilter && cardFilter !== 'all') {
            base = base.filter(r => {
                const isDone = r.status === RecordStatus.HANDOVER || 
                               r.status === RecordStatus.RETURNED || 
                               r.status === RecordStatus.SIGNED ||
                               !!r.exportBatch || !!r.exportDate;
                if (cardFilter === 'completed') return isDone;
                if (cardFilter === 'processing') {
                    const isWithdrawn = r.status === RecordStatus.WITHDRAWN || r.status === RecordStatus.REJECTED;
                    return !isDone && !isWithdrawn;
                }
                if (cardFilter === 'overdue_pending') {
                    const isWithdrawn = r.status === RecordStatus.WITHDRAWN || r.status === RecordStatus.REJECTED;
                    return !isDone && !isWithdrawn && isRecordOverdue(r);
                }
                if (cardFilter === 'overdue_completed') {
                    if (!isDone) return false;
                    const d = parseSafeDate(r.deadline);
                    const c = parseSafeDate(r.completedDate || r.approvalDate);
                    if (!d || !c) return false;
                    d.setHours(0,0,0,0);
                    c.setHours(0,0,0,0);
                    return c > d;
                }
                return true;
            });
        }

        if (searchTerm.trim()) {
            const term = removeVietnameseTones(searchTerm.toLowerCase());
            base = base.filter(r => {
                const code = removeVietnameseTones(r.code || '').toLowerCase();
                const name = removeVietnameseTones(r.customerName || '').toLowerCase();
                const plot = removeVietnameseTones(String(r.landPlot || '')).toLowerCase();
                return code.includes(term) || name.includes(term) || plot.includes(term);
            });
        }

        return base;
    }, [filteredData, cardFilter, searchTerm]);

    const kpiMetrics = useMemo(() => {
        const sourceData = filteredData;
        const total = sourceData.length;
        let completed = 0;
        let withdrawn = 0;
        let overduePending = 0;
        let overdueCompleted = 0;

        sourceData.forEach(r => {
            const isDone = r.status === RecordStatus.HANDOVER || r.status === RecordStatus.RETURNED || r.status === RecordStatus.SIGNED || !!r.exportBatch;
            const isWithdrawn = r.status === RecordStatus.WITHDRAWN || r.status === RecordStatus.REJECTED;

            if (isWithdrawn) {
                withdrawn++;
                return;
            }

            if (isDone) {
                completed++;
                const d = parseSafeDate(r.deadline);
                const c = parseSafeDate(r.completedDate || r.approvalDate);
                if (d && c) {
                    d.setHours(0,0,0,0);
                    c.setHours(0,0,0,0);
                    if (c > d) overdueCompleted++;
                }
            } else {
                if (isRecordOverdue(r)) {
                    overduePending++;
                }
            }
        });

        const processing = total - completed - withdrawn;
        return { total, completed, withdrawn, overduePending, overdueCompleted, processing };
    }, [filteredData]);

    const totalPages = Math.ceil(finalFilteredData.length / itemsPerPage);
    const paginatedRecords = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return finalFilteredData.slice(start, start + itemsPerPage);
    }, [finalFilteredData, currentPage, itemsPerPage]);

    const handleQuickReport = (type: 'today' | 'week' | 'month' | 'all') => {
        const now = new Date();
        if (type === 'all') {
            setFromDate('1970-01-01');
            setToDate(now.toISOString().split('T')[0]);
            setReportType('custom');
            return;
        }
        let start = new Date();
        if (type === 'today') {
            start = new Date();
        } else if (type === 'week') {
            const day = now.getDay();
            const diff = now.getDate() - day + (day === 0 ? -6 : 1);
            start = new Date(now.setDate(diff));
        } else {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
        }
        setFromDate(start.toISOString().split('T')[0]);
        setToDate(new Date().toISOString().split('T')[0]);
        setReportType(type);
    };

    const handleExportExcel = () => {
        if (filteredData.length === 0) {
            alert("Không có dữ liệu để xuất Excel.");
            return;
        }

        const title = "BÁO CÁO KẾT QUẢ CÔNG TÁC CẤP GIẤY";
        const fileName = `Bao_Cao_Cap_Giay_${fromDate}_${toDate}.xlsx`;

        const headers = ["STT", "Mã Hồ Sơ", "Chủ Sử Dụng", "Xã/Phường", "Số Tờ/Thửa", "Loại Hồ Sơ", "Ngày Nhận", "Hẹn Trả", "Cán Bộ Thụ Lý", "Trạng Thái"];
        const dataRows = finalFilteredData.map((r, idx) => [
            idx + 1,
            r.code || "",
            r.customerName || "",
            r.ward || "",
            `${r.mapSheet || ''}/${r.landPlot || ''}`,
            r.recordType || "",
            r.receivedDate ? r.receivedDate.split('T')[0].split('-').reverse().join('/') : "",
            r.deadline ? r.deadline.split('T')[0].split('-').reverse().join('/') : "",
            r.assignedTo || "",
            STATUS_LABELS[r.status as RecordStatus] || r.status || ""
        ]);

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([]);

        const headerRows = [
            ["CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"],
            ["Độc lập - Tự do - Hạnh phúc"],
            [""],
            [title],
            [`Thời gian: Từ ngày ${fromDate.split('-').reverse().join('/')} đến ngày ${toDate.split('-').reverse().join('/')}`],
            [""]
        ];

        XLSX.utils.sheet_add_aoa(ws, headerRows, { origin: "A1" });
        XLSX.utils.sheet_add_aoa(ws, [headers, ...dataRows], { origin: `A${headerRows.length + 1}` });
        XLSX.writeFile(wb, fileName);
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
                    <title>Báo cáo Cấp giấy</title>
                    <style>
                        @page { size: A4 portrait; margin: 2cm; }
                        body { font-family: 'Times New Roman', serif; font-size: 13pt; line-height: 1.4; color: #000; }
                        .text-center { text-align: center; }
                        .font-bold { font-weight: bold; }
                        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                        th, td { border: 1px solid black; padding: 6px 8px; text-align: left; font-size: 11pt; }
                        th { text-align: center; font-weight: bold; background-color: #f2f2f2; }
                        .signatures { display: flex; justify-content: space-between; margin-top: 40px; text-align: center; }
                    </style>
                </head>
                <body>
                    <div class="text-center font-bold">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                    <div class="text-center font-bold" style="border-bottom: 1px solid black; display: inline-block; padding-bottom: 2px; margin-bottom: 15px; margin-left: auto; margin-right: auto;">Độc lập - Tự do - Hạnh phúc</div>
                    <h2 class="text-center" style="margin: 10px 0;">BÁO CÁO KẾT QUẢ CÔNG TÁC CẤP GIẤY</h2>
                    <div class="text-center" style="font-style: italic; margin-bottom: 20px;">Từ ngày ${fromDate.split('-').reverse().join('/')} đến ngày ${toDate.split('-').reverse().join('/')}</div>
                    
                    <div style="margin-bottom: 15px;">
                        <strong>Tổng số hồ sơ:</strong> ${kpiMetrics.total} | 
                        <strong>Đã hoàn thành:</strong> ${kpiMetrics.completed} | 
                        <strong>Đang giải quyết:</strong> ${kpiMetrics.processing} | 
                        <strong>Trễ hạn:</strong> ${kpiMetrics.overduePending}
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th>STT</th>
                                <th>Mã HS</th>
                                <th>Chủ sử dụng</th>
                                <th>Xã/Phường</th>
                                <th>Thửa/Tờ</th>
                                <th>Ngày nhận</th>
                                <th>Hẹn trả</th>
                                <th>Trạng thái</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${finalFilteredData.map((r, i) => `
                                <tr>
                                    <td class="text-center">${i + 1}</td>
                                    <td>${r.code || ''}</td>
                                    <td>${r.customerName || ''}</td>
                                    <td>${r.ward || ''}</td>
                                    <td class="text-center">${r.landPlot || ''}/${r.mapSheet || ''}</td>
                                    <td class="text-center">${r.receivedDate ? r.receivedDate.split('T')[0].split('-').reverse().join('/') : ''}</td>
                                    <td class="text-center">${r.deadline ? r.deadline.split('T')[0].split('-').reverse().join('/') : ''}</td>
                                    <td>${STATUS_LABELS[r.status as RecordStatus] || r.status || ''}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>

                    <div class="signatures">
                        <div>
                            <div class="font-bold">NGƯỜI LẬP BIỂU</div>
                            <div style="font-style: italic; font-size: 10pt;">(Ký, ghi rõ họ tên)</div>
                            <div style="height: 70px;"></div>
                            <div class="font-bold">${currentUser?.name || ''}</div>
                        </div>
                        <div>
                            <div class="font-bold">LÃNH ĐẠO ĐƠN VỊ</div>
                            <div style="font-style: italic; font-size: 10pt;">(Ký, đóng dấu, ghi rõ họ tên)</div>
                            <div style="height: 70px;"></div>
                            <div class="font-bold"></div>
                        </div>
                    </div>
                </body>
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

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-2 sm:p-4 backdrop-blur-xs animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl h-[94vh] flex flex-col overflow-hidden border border-slate-200">
                {/* Modal Header */}
                <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-600 rounded-xl text-white">
                            <BarChart3 size={22} />
                        </div>
                        <div>
                            <h2 className="text-lg font-black tracking-tight">Báo cáo Chuyên sâu Công tác Cấp giấy</h2>
                            <p className="text-xs text-slate-400">Phân tích toàn diện số liệu, tiến độ và doanh thu từ bảng <code className="text-blue-400">dangky_records</code></p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleExportExcel}
                            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                            title="Xuất file Excel báo cáo cấp giấy"
                        >
                            <FileSpreadsheet size={16} /> Xuất Excel
                        </button>
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                            title="In báo cáo A4"
                        >
                            <Printer size={16} /> In A4
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer ml-2"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* KPI Summary Cards Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4 bg-slate-100 border-b border-slate-200 shrink-0">
                    <div 
                        onClick={() => setCardFilter(cardFilter === 'all' ? null : 'all')}
                        className={`bg-white p-3 rounded-xl border shadow-2xs cursor-pointer transition-all hover:border-blue-400 ${cardFilter === 'all' ? 'border-blue-600 ring-2 ring-blue-500/20 bg-blue-50/50' : 'border-slate-200'}`}
                    >
                        <div className="text-[11px] font-bold text-slate-500 uppercase">Tổng tiếp nhận</div>
                        <div className="text-xl font-black text-slate-900 mt-1">{kpiMetrics.total}</div>
                    </div>
                    <div 
                        onClick={() => setCardFilter(cardFilter === 'completed' ? null : 'completed')}
                        className={`bg-white p-3 rounded-xl border shadow-2xs cursor-pointer transition-all hover:border-emerald-400 ${cardFilter === 'completed' ? 'border-emerald-600 ring-2 ring-emerald-500/20 bg-emerald-50/50' : 'border-slate-200'}`}
                    >
                        <div className="text-[11px] font-bold text-emerald-600 uppercase">Đã xong / Trả KQ</div>
                        <div className="text-xl font-black text-emerald-700 mt-1">{kpiMetrics.completed}</div>
                    </div>
                    <div 
                        onClick={() => setCardFilter(cardFilter === 'processing' ? null : 'processing')}
                        className={`bg-white p-3 rounded-xl border shadow-2xs cursor-pointer transition-all hover:border-blue-400 ${cardFilter === 'processing' ? 'border-blue-600 ring-2 ring-blue-500/20 bg-blue-50/50' : 'border-slate-200'}`}
                    >
                        <div className="text-[11px] font-bold text-blue-600 uppercase">Đang thụ lý</div>
                        <div className="text-xl font-black text-blue-700 mt-1">{kpiMetrics.processing}</div>
                    </div>
                    <div 
                        onClick={() => setCardFilter(cardFilter === 'overdue_pending' ? null : 'overdue_pending')}
                        className={`bg-white p-3 rounded-xl border shadow-2xs cursor-pointer transition-all hover:border-red-400 ${cardFilter === 'overdue_pending' ? 'border-red-600 ring-2 ring-red-500/20 bg-red-50/50' : 'border-slate-200'}`}
                    >
                        <div className="text-[11px] font-bold text-red-600 uppercase">Trễ chưa xong</div>
                        <div className="text-xl font-black text-red-700 mt-1">{kpiMetrics.overduePending}</div>
                    </div>
                    <div 
                        onClick={() => setCardFilter(cardFilter === 'overdue_completed' ? null : 'overdue_completed')}
                        className={`bg-white p-3 rounded-xl border shadow-2xs cursor-pointer transition-all hover:border-orange-400 ${cardFilter === 'overdue_completed' ? 'border-orange-600 ring-2 ring-orange-500/20 bg-orange-50/50' : 'border-slate-200'}`}
                    >
                        <div className="text-[11px] font-bold text-orange-600 uppercase">Xong trễ hạn</div>
                        <div className="text-xl font-black text-orange-700 mt-1">{kpiMetrics.overdueCompleted}</div>
                    </div>
                </div>

                {/* Sub-Tabs Bar */}
                <div className="flex bg-white border-b border-slate-200 px-4 gap-1 overflow-x-auto shrink-0">
                    <button 
                        onClick={() => setActiveTab('list')}
                        className={`px-4 py-3 text-xs md:text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${activeTab === 'list' ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                    >
                        <ListFilter size={16} /> Danh sách kết quả ({finalFilteredData.length})
                    </button>
                    <button 
                        onClick={() => setActiveTab('ward_stats')}
                        className={`px-4 py-3 text-xs md:text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${activeTab === 'ward_stats' ? 'border-teal-600 text-teal-600 bg-teal-50/50' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                    >
                        <PieChart size={16} /> Thống kê theo Xã
                    </button>
                    {!isRevenueHidden && (
                        <button 
                            onClick={() => setActiveTab('revenue')}
                            className={`px-4 py-3 text-xs md:text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${activeTab === 'revenue' ? 'border-emerald-600 text-emerald-600 bg-emerald-50/50' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                        >
                            <DollarSign size={16} /> Báo cáo Doanh thu
                        </button>
                    )}
                    <button 
                        onClick={() => setActiveTab('employee')}
                        className={`px-4 py-3 text-xs md:text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${activeTab === 'employee' ? 'border-orange-600 text-orange-600 bg-orange-50/50' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                    >
                        <UserCheck size={16} /> Thống kê nhân viên
                    </button>
                    <button 
                        onClick={() => setActiveTab('daily_stats')}
                        className={`px-4 py-3 text-xs md:text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${activeTab === 'daily_stats' ? 'border-pink-600 text-pink-600 bg-pink-50/50' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                    >
                        <CalendarDays size={16} /> Thống kê theo ngày
                    </button>
                    <button 
                        onClick={() => setActiveTab('overdue')}
                        className={`px-4 py-3 text-xs md:text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${activeTab === 'overdue' ? 'border-red-600 text-red-600 bg-red-50/50' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                    >
                        <AlertTriangle size={16} /> Thống kê hồ sơ trễ
                    </button>
                </div>

                {/* Toolbar Filter Bar */}
                <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                        <button 
                            onClick={() => handleQuickReport('all')} 
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${(fromDate === '1970-01-01') ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-blue-600'}`}
                        >
                            <CalendarRange size={13} /> Tất cả
                        </button>
                        <button onClick={() => handleQuickReport('week')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${reportType === 'week' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-blue-600'}`}>
                            <CalendarDays size={13} /> Tuần này
                        </button>
                        <button onClick={() => handleQuickReport('month')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${reportType === 'month' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-blue-600'}`}>
                            <Layout size={13} /> Tháng này
                        </button>
                        <button onClick={() => handleQuickReport('today')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${reportType === 'today' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-blue-600'}`}>
                            <Clock size={13} /> Hôm nay
                        </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {/* Select Ward */}
                        <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 border border-slate-300 rounded-xl shadow-2xs">
                            <MapPin size={15} className="text-slate-500" />
                            <select 
                                value={selectedWard} 
                                onChange={(e) => setSelectedWard(e.target.value)} 
                                className="text-xs outline-none bg-transparent text-slate-700 font-bold cursor-pointer border-none"
                            >
                                <option value="all">Toàn bộ địa bàn</option>
                                {wards.map(w => (
                                    <option key={w} value={w}>{getNormalizedWard(w)}</option>
                                ))}
                            </select>
                        </div>

                        {/* Select Employee */}
                        <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 border border-slate-300 rounded-xl shadow-2xs">
                            <UserCheck size={15} className="text-slate-500" />
                            <select 
                                value={selectedEmpId} 
                                onChange={(e) => setSelectedEmpId(e.target.value)} 
                                className="text-xs outline-none bg-transparent text-slate-700 font-bold cursor-pointer border-none max-w-[150px]"
                            >
                                <option value="">Tất cả cán bộ</option>
                                {activeEmployees.map(e => (
                                    <option key={e.id} value={e.id}>{e.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Date Range */}
                        <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-xl px-2 py-1 shadow-2xs text-xs font-bold text-slate-700">
                            <CalendarDays size={15} className="text-slate-500" />
                            <span>Từ:</span>
                            <FlexibleDateInput
                                value={fromDate === '1970-01-01' ? '' : fromDate}
                                onChange={(isoStr) => { setFromDate(isoStr || '1970-01-01'); setReportType('custom'); }}
                                placeholder="dd/mm/yyyy"
                                size="sm"
                                className="w-[85px]"
                                inputClassName="w-full text-xs font-semibold py-0 border-none bg-transparent"
                            />
                            <span>-</span>
                            <FlexibleDateInput
                                value={toDate}
                                onChange={(isoStr) => { setToDate(isoStr); setReportType('custom'); }}
                                placeholder="dd/mm/yyyy"
                                size="sm"
                                className="w-[85px]"
                                inputClassName="w-full text-xs font-semibold py-0 border-none bg-transparent"
                            />
                        </div>
                    </div>
                </div>

                {/* Tab Content Body */}
                <div className="flex-1 overflow-y-auto p-4 bg-white min-h-0">
                    {activeTab === 'list' && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="relative w-72">
                                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input 
                                        type="text"
                                        placeholder="Tìm kiếm mã hồ sơ, tên chủ sử dụng..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                                    />
                                </div>
                                <div className="text-xs text-slate-500 font-semibold">
                                    Hiển thị <strong>{paginatedRecords.length}</strong> / <strong>{finalFilteredData.length}</strong> hồ sơ
                                </div>
                            </div>

                            <div className="border border-slate-200 rounded-xl overflow-hidden">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead className="bg-slate-100 text-slate-600 uppercase text-[11px] font-black sticky top-0 z-10">
                                        <tr>
                                            <th className="p-3 text-center w-10">STT</th>
                                            <th className="p-3 w-28">Mã hồ sơ</th>
                                            <th className="p-3 w-48">Chủ sử dụng</th>
                                            <th className="p-3 w-32">Xã / Phường</th>
                                            <th className="p-3 text-center w-24">Thửa / Tờ</th>
                                            <th className="p-3 w-32">Loại hồ sơ</th>
                                            <th className="p-3 text-center w-24">Ngày nhận</th>
                                            <th className="p-3 text-center w-24">Hẹn trả</th>
                                            <th className="p-3 w-32">Cán bộ thụ lý</th>
                                            <th className="p-3 text-center w-28">Trạng thái</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-medium">
                                        {paginatedRecords.length > 0 ? (
                                            paginatedRecords.map((r, index) => {
                                                const isOverdue = isRecordOverdue(r);
                                                return (
                                                    <tr key={r.id} className={`hover:bg-slate-50 transition-colors ${isOverdue ? 'bg-red-50/40 border-l-4 border-l-red-500' : ''}`}>
                                                        <td className="p-3 text-center text-slate-400">{(currentPage - 1) * itemsPerPage + index + 1}</td>
                                                        <td className="p-3 font-mono font-bold text-blue-600">{r.code}</td>
                                                        <td className="p-3 font-bold text-slate-800">{r.customerName}</td>
                                                        <td className="p-3 text-slate-700">{getNormalizedWard(r.ward || '')}</td>
                                                        <td className="p-3 text-center text-slate-600">{r.landPlot || '---'}/{r.mapSheet || '---'}</td>
                                                        <td className="p-3 text-slate-700">{getShortRecordType(r.recordType)}</td>
                                                        <td className="p-3 text-center text-slate-600">{r.receivedDate ? r.receivedDate.split('T')[0].split('-').reverse().join('/') : '---'}</td>
                                                        <td className={`p-3 text-center font-bold ${isOverdue ? 'text-red-600' : 'text-slate-700'}`}>
                                                            {r.deadline ? r.deadline.split('T')[0].split('-').reverse().join('/') : '---'}
                                                            {isOverdue && <span className="block text-[10px] text-red-500 font-extrabold">(Trễ hạn)</span>}
                                                        </td>
                                                        <td className="p-3 text-slate-700">{r.assignedTo || '---'}</td>
                                                        <td className="p-3 text-center">
                                                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700">
                                                                {STATUS_LABELS[r.status as RecordStatus] || r.status}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        ) : (
                                            <tr>
                                                <td colSpan={10} className="p-8 text-center text-slate-400 italic">Không có hồ sơ nào phù hợp.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination Footer */}
                            {finalFilteredData.length > 0 && (
                                <div className="sticky bottom-0 z-20 shadow-md bg-white p-3 border border-slate-200 rounded-xl flex justify-between items-center text-xs text-slate-600">
                                    <span>Hiển thị <strong>{(currentPage - 1) * itemsPerPage + 1}</strong> - <strong>{Math.min(currentPage * itemsPerPage, finalFilteredData.length)}</strong> trên tổng <strong>{finalFilteredData.length}</strong> hồ sơ</span>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 border rounded hover:bg-slate-100 disabled:opacity-30 cursor-pointer">
                                            <ChevronLeft size={16} />
                                        </button>
                                        <span className="font-bold">Trang {currentPage} / {totalPages || 1}</span>
                                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1.5 border rounded hover:bg-slate-100 disabled:opacity-30 cursor-pointer">
                                            <ChevronRight size={16} />
                                        </button>
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
                            records={filteredData}
                            employees={activeEmployees}
                            fromDate={fromDate}
                            toDate={toDate}
                            selectedEmpId={selectedEmpId}
                            setSelectedEmpId={setSelectedEmpId}
                            defaultDeptFilter="registration"
                            isEmployee={currentUser?.role === 'EMPLOYEE'}
                        />
                    )}

                    {activeTab === 'daily_stats' && (
                        <DailyStatsView 
                            records={filteredData} 
                            employees={activeEmployees} 
                            wards={wards} 
                            selectedWard={selectedWard}
                            fromDate={fromDate}
                            toDate={toDate}
                            onFilteredRecordsChange={setDailyStatsRecords}
                            onResetDates={() => { setFromDate('1970-01-01'); setToDate(new Date().toISOString().split('T')[0]); }}
                        />
                    )}

                    {activeTab === 'overdue' && (
                        <OverdueStatsView 
                            records={filteredData}
                            employees={activeEmployees}
                            onFilteredRecordsChange={setOverdueStatsRecords}
                        />
                    )}

                    {!isRevenueHidden && activeTab === 'revenue' && (
                        <RevenueStatsView 
                            records={filteredData}
                            employees={activeEmployees}
                            wards={wards}
                            selectedWard={selectedWard}
                            fromDate={fromDate}
                            toDate={toDate}
                            onFilteredRecordsChange={setRevenueStatsRecords}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};
export default RegistrationReportModal;
