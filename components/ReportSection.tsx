
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { BarChart3, FileSpreadsheet, Loader2, Sparkles, Download, CalendarDays, Printer, Layout, FileText, ListFilter, CheckCircle2, Clock, AlertTriangle, Settings, Key, X, Save, MapPin, UserCheck, ChevronLeft, ChevronRight, PieChart, CheckCircle, Ruler, FolderArchive, CalendarRange, DollarSign, FileCheck } from 'lucide-react';
import { RecordFile, RecordStatus, Employee, User, UserRole, RolePermissions, DepartmentPermissions } from '../types';
import { getNormalizedWard, STATUS_LABELS, getShortRecordType, isArchiveRecordType } from '../constants';
import { isRecordOverdue, removeVietnameseTones, isRecordApproaching, parseSafeDate } from '../utils/appHelpers';
import { saveGeminiKey, getGeminiKey } from '../services/geminiService';
import { fetchArchiveRecords } from '../services/apiArchive';
import { hasUserPermission } from '../config/roleConfig';
import { exportOverdueStatsToExcel } from '../utils/excelExport';
import EmployeeStatsView from './report/EmployeeStatsView';
import WardStatsView from './report/WardStatsView';
import DailyStatsView from './report/DailyStatsView';
import OverdueStatsView from './report/OverdueStatsView';
import RevenueStatsView from './report/RevenueStatsView';
import FlexibleDateInput from './FlexibleDateInput';

interface ReportSectionProps {
    reportContent: string;
    isGenerating: boolean;
    onGenerate: (fromDate: string, toDate: string, title?: string, data?: RecordFile[]) => void;
    onExportExcel: (fromDate: string, toDate: string, ward: string, title?: string, data?: RecordFile[]) => void;
    records: RecordFile[];
    wards: string[]; 
    employees: Employee[];
    currentUser?: User;
    rolePermissions?: RolePermissions;
    departmentPermissions?: DepartmentPermissions;
}

const getFormattedNotesAndDocs = (r: RecordFile): string => {
    const notesParts: string[] = [];
    if (r.notes) notesParts.push(r.notes);
    if (r.content && r.content !== r.notes) notesParts.push(r.content);
    return notesParts.join('; ') || '-';
};

const formatDateDDMMYYYY = (isoStr?: string | null) => {
    if (!isoStr) return '';
    const cleanStr = isoStr.split('T')[0];
    const parts = cleanStr.split('-');
    if (parts.length === 3) {
        return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
    }
    return isoStr;
};

const ReportSection: React.FC<ReportSectionProps> = ({ reportContent, isGenerating, onGenerate, onExportExcel, records, wards, employees, currentUser, rolePermissions, departmentPermissions }) => {
    const [fromDate, setFromDate] = useState(() => {
        return '1970-01-01';
    });
    const [toDate, setToDate] = useState(() => {
        return new Date().toISOString().split('T')[0];
    });
    
    // State chọn xã phường
    const [selectedWard, setSelectedWard] = useState<string>('all');
    
    // State chọn nhân viên (Lifting state up)
    const [selectedEmpId, setSelectedEmpId] = useState<string>('');

    // Report Type State
    const [reportType, setReportType] = useState<'today' | 'week' | 'month' | 'custom'>('custom');

    // Card filter state
    const [cardFilter, setCardFilter] = useState<'all' | 'completed' | 'processing' | 'overdue_pending' | 'overdue_completed' | null>(null);

    const [activeTab, setActiveTab] = useState<'list' | 'ward_stats' | 'revenue' | 'ai' | 'employee' | 'daily_stats' | 'overdue'>('list');
    const previewRef = useRef<HTMLDivElement>(null);

    const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
    const [apiKey, setApiKey] = useState('');

    // Pagination States
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);

    const [dailyStatsRecords, setDailyStatsRecords] = useState<RecordFile[]>([]);
    const [revenueStatsRecords, setRevenueStatsRecords] = useState<RecordFile[]>([]);
    const [overdueStatsRecords, setOverdueStatsRecords] = useState<RecordFile[]>([]);

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

    const canSeeRegistrationTab = useMemo(() => {
        if (!currentUser) return true;
        if (userRole === UserRole.ADMIN || userRole === UserRole.SUBADMIN) return true;
        if (rolePermissions || departmentPermissions) {
            return hasUserPermission(currentUser, employees, 'REPORT_TAB_REGISTRATION', rolePermissions, departmentPermissions);
        }
        return true;
    }, [currentUser, employees, rolePermissions, departmentPermissions, userRole]);

    const canSeeMeasurementTab = useMemo(() => {
        if (!currentUser) return true;
        if (userRole === UserRole.ADMIN || userRole === UserRole.SUBADMIN) return true;
        if (rolePermissions || departmentPermissions) {
            return hasUserPermission(currentUser, employees, 'REPORT_TAB_MEASUREMENT', rolePermissions, departmentPermissions);
        }
        return true;
    }, [currentUser, employees, rolePermissions, departmentPermissions, userRole]);

    const canSeeArchiveTab = useMemo(() => {
        if (!currentUser) return true;
        if (userRole === UserRole.ADMIN || userRole === UserRole.SUBADMIN) return true;
        if (rolePermissions || departmentPermissions) {
            return hasUserPermission(currentUser, employees, 'REPORT_TAB_ARCHIVE', rolePermissions, departmentPermissions);
        }
        return true;
    }, [currentUser, employees, rolePermissions, departmentPermissions, userRole]);

    const canSeeRevenueTab = useMemo(() => {
        if (!currentUser) return true;
        if (userRole === UserRole.ADMIN || userRole === UserRole.SUBADMIN) return true;
        if (rolePermissions || departmentPermissions) {
            return hasUserPermission(currentUser, employees, 'REPORT_TAB_REVENUE', rolePermissions, departmentPermissions);
        }
        return true;
    }, [currentUser, employees, rolePermissions, departmentPermissions, userRole]);

    const [mainTab, setMainTab] = useState<'measurement' | 'registration' | 'archive' | 'revenue'>('measurement');
    const [archiveRecords, setArchiveRecords] = useState<RecordFile[]>([]);
    const [isArchiveLoading, setIsArchiveLoading] = useState<boolean>(false);

    // Tự động chuyển tab chính ban đầu theo phòng ban của nhân sự
    useEffect(() => {
        if (!isHanhChinhOrAdmin && userDept) {
            const deptLower = userDept.toLowerCase();
            if (deptLower.includes('đo đạc') || deptLower.includes('kỹ thuật')) {
                setMainTab('measurement');
            } else if (deptLower.includes('cấp giấy') || deptLower.includes('đăng ký')) {
                setMainTab('registration');
            } else if (deptLower.includes('lưu trữ')) {
                setMainTab('archive');
            }
        }
    }, [isHanhChinhOrAdmin, userDept]);

    // Reset date filters and search states to "Tất cả" when switching report tabs or main tabs
    useEffect(() => {
        setFromDate('1970-01-01');
        setToDate(new Date().toISOString().split('T')[0]);
        setReportType('custom');
        setSelectedWard('all');
        setSelectedEmpId('');
        setCardFilter(null);
        setCurrentPage(1);
    }, [activeTab, mainTab]);

    useEffect(() => {
        if (mainTab === 'archive' || mainTab === 'revenue') {
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

    const [tabVisibility, setTabVisibility] = useState<{
        registration: boolean;
        measurement: boolean;
        archive: boolean;
        revenue: boolean;
    }>(() => {
        try {
            const saved = localStorage.getItem('report_tab_visibility');
            if (saved) return JSON.parse(saved);
        } catch (e) {}
        return { registration: true, measurement: true, archive: true, revenue: true };
    });

    // Sub-team selection for Revenue tab
    const [revenueTeam, setRevenueTeam] = useState<'registration' | 'measurement' | 'archive' | 'total'>('total');

    const registrationRecords = useMemo(() => {
        return records.filter(r => {
            const shortType = getShortRecordType(r.recordType);
            if (isArchiveRecordType(r.recordType)) return false;

            const excludedCodes = ['1.1', '1.2', '2.1', '2.2', '2.3', '2.4', '2.5', '2.6'];
            if (excludedCodes.some(code => shortType.startsWith(code))) {
                return false;
            }

            const typeLower = (r.recordType || '').toLowerCase();
            if (typeLower.includes('trích đo') || 
                typeLower.includes('cắm mốc') || 
                typeLower.includes('tách thửa') || 
                typeLower.includes('hợp thửa') || 
                typeLower.includes('số thửa') || 
                typeLower.includes('sao lục') || 
                typeLower.includes('trích lục') ||
                typeLower.includes('công văn')) {
                return false;
            }

            return true;
        });
    }, [records]);

    const measurementRecords = useMemo(() => {
        return records.filter(r => {
            const shortType = getShortRecordType(r.recordType);
            if (isArchiveRecordType(r.recordType)) return false;

            const isMeasurementCode = ['2.3', '2.4', '2.5', '2.6'].some(code => shortType.startsWith(code));
            const typeLower = (r.recordType || '').toLowerCase();
            const isMeasurementKeyword = typeLower.includes('trích đo') || 
                                         typeLower.includes('cắm mốc') || 
                                         typeLower.includes('tách thửa') || 
                                         typeLower.includes('hợp thửa') || 
                                         typeLower.includes('số thửa') || 
                                         typeLower.includes('đo đạc');

            return isMeasurementCode || isMeasurementKeyword;
        });
    }, [records]);

    const activeRecords = useMemo(() => {
        if (mainTab === 'revenue') {
            if (revenueTeam === 'registration') return registrationRecords;
            if (revenueTeam === 'measurement') return measurementRecords;
            if (revenueTeam === 'archive') return archiveRecords;
            const recordMap = new Map<string, RecordFile>();
            registrationRecords.forEach(r => recordMap.set(r.id, r));
            measurementRecords.forEach(r => recordMap.set(r.id, r));
            archiveRecords.forEach(r => recordMap.set(r.id, r));
            return Array.from(recordMap.values());
        }
        if (mainTab === 'archive') {
            return archiveRecords;
        }
        if (mainTab === 'registration') {
            return registrationRecords;
        }
        // mainTab === 'measurement'
        return measurementRecords;
    }, [records, mainTab, archiveRecords, revenueTeam, registrationRecords, measurementRecords]);

    const activeEmployees = useMemo(() => {
        if (mainTab === 'revenue') {
            return employees;
        }
        if (mainTab === 'measurement') {
            return employees.filter(e => {
                const dept = e.department?.toLowerCase() || '';
                return dept.includes('đo đạc') || dept.includes('kỹ thuật');
            });
        } else if (mainTab === 'registration') {
            return employees.filter(e => {
                const dept = e.department?.toLowerCase() || '';
                return dept.includes('cấp giấy') || dept.includes('đăng ký');
            });
        } else {
            return employees.filter(e => {
                const dept = e.department?.toLowerCase() || '';
                return dept.includes('lưu trữ') && !dept.includes('một cửa') && !dept.includes('hành chính');
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
        let baseData = filteredData;
        if (activeTab === 'employee' && selectedEmpId) {
            baseData = filteredData.filter(r => r.assignedTo === selectedEmpId);
        }
        if (!cardFilter || cardFilter === 'all') return baseData;
        return baseData.filter(r => {
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
    }, [filteredData, cardFilter, activeTab, selectedEmpId]);

    // Reset pagination when filter changes
    const [mobileVisibleCount, setMobileVisibleCount] = useState(20);

    useEffect(() => {
        setCurrentPage(1);
        setMobileVisibleCount(20);
    }, [fromDate, toDate, selectedWard, mainTab, cardFilter, activeTab]);

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

    const handleQuickReport = (type: 'today' | 'week' | 'month') => {
        const now = new Date();
        let start = new Date();
        if (type === 'today') {
            start = new Date();
        } else if (type === 'week') {
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
        
        let teamName = "ĐO ĐẠC";
        if (mainTab === 'registration') teamName = "CẤP GIẤY";
        else if (mainTab === 'archive') teamName = "LƯU TRỮ";
        else if (mainTab === 'revenue') {
            if (revenueTeam === 'registration') teamName = "DOANH THU TỔ CẤP GIẤY";
            else if (revenueTeam === 'measurement') teamName = "DOANH THU TỔ ĐO ĐẠC";
            else if (revenueTeam === 'archive') teamName = "DOANH THU TỔ LƯU TRỮ";
            else teamName = "NGUỒN THU TỔNG HỢP";
        }

        let title = `BÁO CÁO KẾT QUẢ CÔNG TÁC ${teamName}`;
        if (reportType === 'today') title += " HÔM NAY";
        if (reportType === 'week') title += " TUẦN";
        if (reportType === 'month') title += " THÁNG";

        // Pass filteredData to onGenerate
        onGenerate(fromDate, toDate, title, filteredData);
    };

    // Compute dynamic count for shared Excel Export button
    const activeExportCount = useMemo(() => {
        if (mainTab === 'revenue') {
            return revenueStatsRecords.length || filteredData.length;
        }
        if (activeTab === 'daily_stats') {
            return dailyStatsRecords.length || filteredData.length;
        }
        if (activeTab === 'overdue') {
            return overdueStatsRecords.length || filteredData.length;
        }
        if (activeTab === 'employee' && selectedEmpId) {
            return filteredData.filter(r => r.assignedTo === selectedEmpId).length;
        }
        if (activeTab === 'list') {
            return finalFilteredData.length;
        }
        return filteredData.length;
    }, [activeTab, mainTab, dailyStatsRecords, revenueStatsRecords, overdueStatsRecords, filteredData, finalFilteredData, selectedEmpId]);

    const handleExportExcelClick = () => {
        if (!fromDate || !toDate) { alert("Vui lòng chọn đầy đủ thời gian."); return; }

        if (activeTab === 'overdue') {
            const dataToExport = overdueStatsRecords.length > 0 ? overdueStatsRecords : filteredData;
            exportOverdueStatsToExcel(dataToExport, activeEmployees, 'all');
            return;
        }
        
        let teamName = "ĐO ĐẠC";
        if (mainTab === 'registration') teamName = "CẤP GIẤY";
        else if (mainTab === 'archive') teamName = "LƯU TRỮ";
        else if (mainTab === 'revenue') {
            if (revenueTeam === 'registration') teamName = "DOANH THU TỔ CẤP GIẤY";
            else if (revenueTeam === 'measurement') teamName = "DOANH THU TỔ ĐO ĐẠC";
            else if (revenueTeam === 'archive') teamName = "DOANH THU TỔ LƯU TRỮ";
            else teamName = "NGUỒN THU TỔNG HỢP";
        }

        let title = `BÁO CÁO KẾT QUẢ CÔNG TÁC ${teamName}`;
        
        if (activeTab === 'daily_stats') {
            title += " - THỐNG KÊ THEO NGÀY";
        } else if (activeTab === 'ward_stats') {
            title += " - THỐNG KÊ THEO XÃ PHƯỜNG";
        } else if (activeTab === 'employee') {
            if (selectedEmpId) {
                const emp = employees.find(e => e.id === selectedEmpId);
                title += ` - CÁN BỘ: ${emp ? emp.name.toUpperCase() : ''}`;
            } else {
                title += " - TỔNG HỢP THEO NHÂN VIÊN";
            }
        } else if (mainTab === 'revenue') {
            title += " - BÁO CÁO NGUỒN THU";
        } else if (activeTab === 'overdue') {
            title += " - BÁO CÁO HỒ SƠ TRỄ HẠN";
        }

        if (reportType === 'today') title += " HÔM NAY";
        else if (reportType === 'week') title += " TUẦN NÀY";
        else if (reportType === 'month') title += " THÁNG NÀY";

        let dataToExport = finalFilteredData;
        if (mainTab === 'revenue' && revenueStatsRecords.length > 0) {
            dataToExport = revenueStatsRecords;
        } else if (activeTab === 'daily_stats' && dailyStatsRecords.length > 0) {
            dataToExport = dailyStatsRecords;
        }

        onExportExcel(fromDate, toDate, selectedWard, title, dataToExport);
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

    const formatDate = (d?: string | null) => d ? (formatDateDDMMYYYY(d) || '-') : '-';

    return (
        <div className="flex flex-col h-full overflow-y-auto md:overflow-hidden relative bg-slate-50">
            {/* MAIN TAB SWITCHER */}
            <div className="bg-white border-b border-gray-200 flex items-center justify-between px-4 pt-2 shrink-0">
                <div className="flex items-center gap-1 overflow-x-auto">
                    {(isHanhChinhOrAdmin || canSeeRegistrationTab || (userDept && (userDept.toLowerCase().includes('cấp giấy') || userDept.toLowerCase().includes('đăng ký')))) && (
                        <button 
                            onClick={() => setMainTab('registration')}
                            className={`px-5 py-2.5 text-sm font-bold rounded-t-lg border-t border-l border-r transition-all flex items-center gap-2 shrink-0 ${mainTab === 'registration' ? 'bg-purple-50 border-gray-200 text-purple-700 border-b-transparent relative top-[1px]' : 'bg-gray-50 border-transparent text-gray-500 hover:bg-gray-100'}`}
                        >
                            <FileCheck size={18} /> Báo cáo Cấp giấy
                        </button>
                    )}
                    {(isHanhChinhOrAdmin || canSeeMeasurementTab || (userDept && (userDept.toLowerCase().includes('đo đạc') || userDept.toLowerCase().includes('kỹ thuật')))) && (
                        <button 
                            onClick={() => setMainTab('measurement')}
                            className={`px-5 py-2.5 text-sm font-bold rounded-t-lg border-t border-l border-r transition-all flex items-center gap-2 shrink-0 ${mainTab === 'measurement' ? 'bg-blue-50 border-gray-200 text-blue-700 border-b-transparent relative top-[1px]' : 'bg-gray-50 border-transparent text-gray-500 hover:bg-gray-100'}`}
                        >
                            <Ruler size={18} /> Báo cáo Đo đạc
                        </button>
                    )}
                    {(isHanhChinhOrAdmin || canSeeArchiveTab || (userDept && userDept.toLowerCase().includes('lưu trữ'))) && (
                        <button 
                            onClick={() => setMainTab('archive')}
                            className={`px-5 py-2.5 text-sm font-bold rounded-t-lg border-t border-l border-r transition-all flex items-center gap-2 shrink-0 ${mainTab === 'archive' ? 'bg-orange-50 border-gray-200 text-orange-700 border-b-transparent relative top-[1px]' : 'bg-gray-50 border-transparent text-gray-500 hover:bg-gray-100'}`}
                        >
                            <FolderArchive size={18} /> Báo cáo Lưu trữ
                        </button>
                    )}
                    {(isHanhChinhOrAdmin || canSeeRevenueTab) && (
                        <button 
                            onClick={() => setMainTab('revenue')}
                            className={`px-5 py-2.5 text-sm font-bold rounded-t-lg border-t border-l border-r transition-all flex items-center gap-2 shrink-0 ${mainTab === 'revenue' ? 'bg-emerald-50 border-gray-200 text-emerald-700 border-b-transparent relative top-[1px]' : 'bg-gray-50 border-transparent text-gray-500 hover:bg-gray-100'}`}
                        >
                            <DollarSign size={18} /> Báo cáo Nguồn thu
                        </button>
                    )}
                </div>
            </div>

            {/* Toolbar */}
            <div className={`p-4 border-b border-gray-200 shadow-sm flex flex-col gap-4 shrink-0 z-10 ${mainTab === 'measurement' ? 'bg-blue-50' : mainTab === 'registration' ? 'bg-purple-50' : mainTab === 'archive' ? 'bg-orange-50' : 'bg-emerald-50'}`}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg border border-slate-200">
                        <button 
                            onClick={() => {
                                setFromDate('1970-01-01');
                                setToDate(new Date().toISOString().split('T')[0]);
                                setReportType('custom');
                            }} 
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${(fromDate === '1970-01-01' && reportType === 'custom') ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-blue-600'}`}
                        >
                            <CalendarRange size={14} /> Tất cả
                        </button>
                        <button onClick={() => handleQuickReport('week')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${reportType === 'week' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-blue-600'}`}>
                            <CalendarDays size={14} /> Tuần này
                        </button>
                        <button onClick={() => handleQuickReport('month')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${reportType === 'month' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-blue-600'}`}>
                            <Layout size={14} /> Tháng này
                        </button>
                        <button onClick={() => handleQuickReport('today')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${reportType === 'today' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-blue-600'}`}>
                            <Clock size={14} /> Hôm nay
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

                        <div className="flex items-center gap-1 bg-white border border-gray-300 rounded-lg px-2 py-1 shadow-xs shrink-0 whitespace-nowrap text-xs font-bold text-gray-700">
                            <CalendarDays size={16} className="text-slate-500 shrink-0" />
                            <span className="text-gray-500 text-xs shrink-0 font-bold">Từ:</span>
                            <FlexibleDateInput
                                value={fromDate === '1970-01-01' ? '' : fromDate}
                                onChange={(isoStr) => { setFromDate(isoStr || '1970-01-01'); setReportType('custom'); }}
                                placeholder="dd/mm/yyyy"
                                size="sm"
                                className="w-[85px] shrink-0"
                                inputClassName="w-full text-xs font-semibold tracking-tight py-0 px-0 border-none bg-transparent pr-3.5"
                            />
                            <span className="text-gray-400 font-bold text-xs">-</span>
                            <FlexibleDateInput
                                value={toDate}
                                onChange={(isoStr) => { setToDate(isoStr); setReportType('custom'); }}
                                placeholder="dd/mm/yyyy"
                                size="sm"
                                className="w-[85px] shrink-0"
                                inputClassName="w-full text-xs font-semibold tracking-tight py-0 px-0 border-none bg-transparent pr-3.5"
                            />
                        </div>
                        
                        <button 
                            onClick={handleExportExcelClick} 
                            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-lg font-bold text-xs md:text-sm shadow-sm transition-all cursor-pointer whitespace-nowrap active:scale-95" 
                            title="Xuất Báo Cáo Excel Dùng Chung"
                        >
                            <FileSpreadsheet size={18} className="shrink-0" /> 
                            <span>Xuất Excel</span>
                            {activeExportCount > 0 && (
                                <span className="bg-emerald-800 text-emerald-100 text-[10px] md:text-xs px-2 py-0.5 rounded-full font-extrabold ml-0.5">
                                    {activeExportCount}
                                </span>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Content Sub-Tabs */}
            {mainTab === 'revenue' ? (
                <div className="flex bg-white border-b border-gray-200 px-2 md:px-4 justify-start gap-1 overflow-x-auto no-scrollbar">
                    <button 
                        onClick={() => setRevenueTeam('total')}
                        className={`px-4 md:px-6 py-2.5 md:py-3 text-xs md:text-sm font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 shrink-0 ${revenueTeam === 'total' ? 'border-emerald-600 text-emerald-700 bg-emerald-50/60 rounded-t-lg' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        <DollarSign size={18}/> 
                        <span>Báo cáo nguồn thu tổng hợp</span>
                    </button>
                    <button 
                        onClick={() => setRevenueTeam('registration')}
                        className={`px-4 md:px-6 py-2.5 md:py-3 text-xs md:text-sm font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 shrink-0 ${revenueTeam === 'registration' ? 'border-purple-600 text-purple-700 bg-purple-50/60 rounded-t-lg' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        <FileCheck size={18}/> 
                        <span>Báo cáo doanh thu tổ Cấp giấy</span>
                    </button>
                    <button 
                        onClick={() => setRevenueTeam('measurement')}
                        className={`px-4 md:px-6 py-2.5 md:py-3 text-xs md:text-sm font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 shrink-0 ${revenueTeam === 'measurement' ? 'border-blue-600 text-blue-700 bg-blue-50/60 rounded-t-lg' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        <Ruler size={18}/> 
                        <span>Báo cáo doanh thu tổ Đo đạc</span>
                    </button>
                    <button 
                        onClick={() => setRevenueTeam('archive')}
                        className={`px-4 md:px-6 py-2.5 md:py-3 text-xs md:text-sm font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 shrink-0 ${revenueTeam === 'archive' ? 'border-orange-600 text-orange-700 bg-orange-50/60 rounded-t-lg' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        <FolderArchive size={18}/> 
                        <span>Báo cáo doanh thu tổ Lưu trữ</span>
                    </button>
                </div>
            ) : (
                <div className="flex bg-white border-b border-gray-200 px-2 md:px-4 justify-between md:justify-start gap-1 overflow-x-auto no-scrollbar">
                    <button 
                        onClick={() => setActiveTab('list')}
                        className={`px-3 md:px-6 py-2.5 md:py-3 text-xs md:text-sm font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 shrink-0 ${activeTab === 'list' ? 'border-blue-600 text-blue-600 bg-blue-50/60 md:bg-transparent rounded-t-lg md:rounded-none' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        title={`Danh sách kết quả (${filteredData.length})`}
                    >
                        <ListFilter size={18}/> 
                        <span className="hidden md:inline">Danh sách kết quả ({filteredData.length})</span>
                    </button>
                    <button 
                        onClick={() => setActiveTab('ward_stats')}
                        className={`px-3 md:px-6 py-2.5 md:py-3 text-xs md:text-sm font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 shrink-0 ${activeTab === 'ward_stats' ? 'border-teal-600 text-teal-600 bg-teal-50/60 md:bg-transparent rounded-t-lg md:rounded-none' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        title="Thống kê theo Xã"
                    >
                        <PieChart size={18}/> 
                        <span className="hidden md:inline">Thống kê theo Xã</span>
                    </button>
                    <button 
                        onClick={() => setActiveTab('employee')}
                        className={`px-3 md:px-6 py-2.5 md:py-3 text-xs md:text-sm font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 shrink-0 ${activeTab === 'employee' ? 'border-orange-600 text-orange-600 bg-orange-50/60 md:bg-transparent rounded-t-lg md:rounded-none' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        title="Thống kê nhân viên"
                    >
                        <UserCheck size={18}/> 
                        <span className="hidden md:inline">Thống kê nhân viên</span>
                    </button>
                    <button 
                        onClick={() => setActiveTab('daily_stats')}
                        className={`px-3 md:px-6 py-2.5 md:py-3 text-xs md:text-sm font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 shrink-0 ${activeTab === 'daily_stats' ? 'border-pink-600 text-pink-600 bg-pink-50/60 md:bg-transparent rounded-t-lg md:rounded-none' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        title="Thống kê theo ngày"
                    >
                        <CalendarDays size={18}/> 
                        <span className="hidden md:inline">Thống kê theo ngày</span>
                    </button>
                    <button 
                        onClick={() => setActiveTab('overdue')}
                        className={`px-3 md:px-6 py-2.5 md:py-3 text-xs md:text-sm font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 shrink-0 ${activeTab === 'overdue' ? 'border-red-600 text-red-600 bg-red-50/60 md:bg-transparent rounded-t-lg md:rounded-none' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        title="Thống kê hồ sơ trễ"
                    >
                        <AlertTriangle size={18}/> 
                        <span className="hidden md:inline">Thống kê hồ sơ trễ</span>
                    </button>
                    <button 
                        onClick={() => setActiveTab('ai')}
                        className={`px-3 md:px-6 py-2.5 md:py-3 text-xs md:text-sm font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 shrink-0 ${activeTab === 'ai' ? 'border-purple-600 text-purple-600 bg-purple-50/60 md:bg-transparent rounded-t-lg md:rounded-none' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        title="Văn bản Báo cáo (AI)"
                    >
                        <Sparkles size={18}/> 
                        <span className="hidden md:inline">Văn bản Báo cáo (AI)</span>
                    </button>
                </div>
            )}

            {/* Active Tab Subtitle Banner on Mobile */}
            <div className="md:hidden px-3 py-1.5 bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-700 flex justify-between items-center shrink-0">
                <span>
                    {mainTab === 'revenue' ? (
                        <>
                            {revenueTeam === 'registration' && 'Báo cáo Doanh thu - Tổ Cấp giấy'}
                            {revenueTeam === 'measurement' && 'Báo cáo Doanh thu - Tổ Đo đạc'}
                            {revenueTeam === 'archive' && 'Báo cáo Doanh thu - Tổ Lưu trữ'}
                            {revenueTeam === 'total' && 'Báo cáo Nguồn thu Tổng hợp'}
                        </>
                    ) : (
                        <>
                            {activeTab === 'list' && `Danh sách kết quả (${filteredData.length})`}
                            {activeTab === 'ward_stats' && 'Thống kê theo Xã/Phường'}
                            {activeTab === 'employee' && 'Thống kê Nhân viên'}
                            {activeTab === 'daily_stats' && 'Thống kê theo Ngày'}
                            {activeTab === 'overdue' && 'Thống kê Hồ sơ Trễ'}
                            {activeTab === 'ai' && 'Văn bản Báo cáo (AI)'}
                        </>
                    )}
                </span>
                <span className="text-[10px] text-slate-400 font-normal">Chạm icon trên để đổi</span>
            </div>

            {/* THỐNG KÊ DẠNG NÚT DẸP (PILL SEGMENTED CONTROLS) GỌN GÀNG DÙNG ĐỂ LỌC NHANH */}
            {activeTab === 'list' && (
                <div className="px-3 py-2 bg-slate-50 border-b border-gray-200 shrink-0">
                    <div className="inline-flex items-center bg-slate-200/80 p-1 rounded-xl gap-1 text-xs font-semibold overflow-x-auto max-w-full">
                        {/* Tất cả / Tổng hồ sơ */}
                        <button
                            type="button"
                            onClick={() => {
                                setCardFilter(cardFilter === 'all' ? null : 'all');
                                setActiveTab('list');
                            }}
                            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                                (cardFilter === 'all' || cardFilter === null)
                                    ? 'bg-white text-blue-700 shadow-xs font-bold'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <span>Tổng hồ sơ</span>
                            <span className="font-bold text-blue-600">({generalStats.total})</span>
                        </button>

                        {/* Đã xong */}
                        <button
                            type="button"
                            onClick={() => {
                                setCardFilter(cardFilter === 'completed' ? null : 'completed');
                                setActiveTab('list');
                            }}
                            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                                cardFilter === 'completed'
                                    ? 'bg-white text-emerald-700 shadow-xs font-bold'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <span>Đã xong</span>
                            <span className="font-bold text-emerald-600">({generalStats.completed})</span>
                        </button>

                        {/* Đang xử lý */}
                        <button
                            type="button"
                            onClick={() => {
                                setCardFilter(cardFilter === 'processing' ? null : 'processing');
                                setActiveTab('list');
                            }}
                            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                                cardFilter === 'processing'
                                    ? 'bg-white text-amber-700 shadow-xs font-bold'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <span>Đang xử lý</span>
                            <span className="font-bold text-amber-600">({generalStats.processing})</span>
                        </button>

                        {/* Trễ hạn */}
                        <button
                            type="button"
                            onClick={() => {
                                setCardFilter(cardFilter === 'overdue_pending' ? null : 'overdue_pending');
                                setActiveTab('list');
                            }}
                            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                                (cardFilter === 'overdue_pending' || cardFilter === 'overdue_completed')
                                    ? 'bg-white text-red-700 shadow-xs font-bold'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <span>Trễ hạn</span>
                            <span className="font-bold text-red-600">({generalStats.overduePending})</span>
                        </button>
                    </div>
                </div>
            )}

            {/* TAB CONTENT */}
            <div className="flex-1 overflow-y-auto md:overflow-hidden bg-slate-100 p-0">
                {activeTab === 'list' && (
                    <div className="bg-white rounded-none h-full overflow-hidden flex flex-col animate-fade-in-up p-2 md:p-4">
                        {/* DESKTOP TABLE VIEW */}
                        <div className="hidden md:block flex-1 overflow-auto rounded-xl border border-gray-200">
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

                        {/* MOBILE CARD LIST VIEW (Giống tab Tìm kiếm) */}
                        <div className="md:hidden flex-1 overflow-y-auto space-y-2.5 pb-2">
                            {finalFilteredData.length > 0 ? (
                                <>
                                    {finalFilteredData.slice(0, mobileVisibleCount).map((r, i) => {
                                        const emp = employees.find(e => e.id === r.assignedTo);
                                        const isOverdue = isRecordOverdue(r);
                                        const rowIndex = i + 1;
                                        let isCompletedLate = false;
                                        if (r.status === RecordStatus.HANDOVER || r.status === RecordStatus.RETURNED) {
                                            if (r.deadline && r.completedDate) {
                                                const d = new Date(r.deadline); d.setHours(0,0,0,0);
                                                const c = new Date(r.completedDate); c.setHours(0,0,0,0);
                                                if (c > d) isCompletedLate = true;
                                            }
                                        }

                                        return (
                                            <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm hover:shadow-md transition-all">
                                                <div className="flex justify-between items-start mb-2 gap-2">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded">#{rowIndex}</span>
                                                            <h3 className="font-bold text-slate-800 text-sm truncate">{r.customerName}</h3>
                                                        </div>
                                                        <div className="text-xs text-blue-600 font-semibold font-mono mt-0.5">{r.code}</div>
                                                    </div>
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase shrink-0 ${
                                                        r.status === RecordStatus.HANDOVER || r.status === RecordStatus.RETURNED ? 'bg-green-100 text-green-700 border-green-200' : 
                                                        r.status === RecordStatus.WITHDRAWN ? 'bg-gray-100 text-gray-600 border-gray-200' :
                                                        r.status === RecordStatus.REJECTED ? 'bg-red-100 text-red-700 border-red-200' :
                                                        isOverdue ? 'bg-red-100 text-red-700 border-red-200 font-bold' :
                                                        'bg-blue-50 text-blue-700 border-blue-100'
                                                    }`}>
                                                        {STATUS_LABELS[r.status]}
                                                    </span>
                                                </div>

                                                <div className="grid grid-cols-2 gap-1.5 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg">
                                                    <div>
                                                        <span className="text-slate-400">Địa bàn:</span> <span className="font-medium text-slate-800">{getNormalizedWard(r.ward)}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-400">Tờ/Thửa:</span> <span className="font-medium text-slate-800">{r.mapSheet || '-'}/{r.landPlot || '-'}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-400">Nhận:</span> <span className="font-medium text-slate-800">{formatDate(r.receivedDate)}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-400">Hẹn trả:</span> <span className={`font-medium ${isOverdue ? 'text-red-600 font-bold' : 'text-slate-800'}`}>{formatDate(r.deadline)}</span>
                                                    </div>
                                                    {r.completedDate && (
                                                        <div className="col-span-2">
                                                            <span className="text-slate-400">Hoàn thành:</span> <span className={`font-medium ${isCompletedLate ? 'text-orange-600' : 'text-green-700'}`}>{formatDate(r.completedDate)}</span>
                                                        </div>
                                                    )}
                                                    <div className="col-span-2 flex items-center justify-between pt-1 border-t border-slate-200/60 mt-0.5">
                                                        <span className="text-slate-400">NV xử lý:</span>
                                                        <span className="font-semibold text-slate-800">{emp ? emp.name : '-'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {finalFilteredData.length > mobileVisibleCount && (
                                        <div className="pt-3 pb-6 flex flex-col items-center gap-2">
                                            <button 
                                                onClick={() => setMobileVisibleCount(prev => prev + 20)}
                                                className="w-full max-w-sm py-2.5 bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 rounded-xl font-bold text-xs shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                                            >
                                                Xem thêm {finalFilteredData.length - mobileVisibleCount} hồ sơ
                                            </button>
                                            <p className="text-[10px] text-slate-400 font-medium">
                                                Đang hiển thị {Math.min(mobileVisibleCount, finalFilteredData.length)} / {finalFilteredData.length} hồ sơ
                                            </p>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="p-8 text-center text-slate-400 text-sm">Không có dữ liệu trong khoảng thời gian này.</div>
                            )}
                        </div>
                        {/* Pagination Footer (Desktop only) */}
                        {filteredData.length > 0 && (
                            <div className="hidden md:flex border-t border-gray-200 p-3 bg-gray-50 justify-between items-center shrink-0 rounded-b-xl">
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
                        employees={employees}
                        fromDate={fromDate}
                        toDate={toDate}
                        selectedEmpId={selectedEmpId}
                        setSelectedEmpId={setSelectedEmpId}
                        defaultDeptFilter={mainTab === 'archive' ? 'archive' : mainTab === 'measurement' ? 'measurement' : mainTab === 'registration' ? 'registration' : 'all'}
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
                        selectedWard={selectedWard}
                        fromDate={fromDate}
                        toDate={toDate}
                        onFilteredRecordsChange={setDailyStatsRecords}
                        onResetDates={() => {
                            setFromDate('1970-01-01');
                            setToDate(new Date().toISOString().split('T')[0]);
                            setReportType('custom');
                        }}
                    />
                )}

                {activeTab === 'overdue' && (
                    <OverdueStatsView 
                        records={filteredData}
                        employees={activeEmployees}
                        onFilteredRecordsChange={setOverdueStatsRecords}
                    />
                )}

                {mainTab === 'revenue' && (
                    <RevenueStatsView 
                        records={activeRecords}
                        employees={activeEmployees}
                        wards={wards}
                        selectedWard={selectedWard}
                        fromDate={fromDate}
                        toDate={toDate}
                        teamTitle={
                            revenueTeam === 'total' ? 'Báo cáo nguồn thu tổng hợp' :
                            revenueTeam === 'registration' ? 'Báo cáo doanh thu tổ Cấp giấy' :
                            revenueTeam === 'measurement' ? 'Báo cáo doanh thu tổ Đo đạc' :
                            'Báo cáo doanh thu tổ Lưu trữ'
                        }
                        onFilteredRecordsChange={setRevenueStatsRecords}
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
