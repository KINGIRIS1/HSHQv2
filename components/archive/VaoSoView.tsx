import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ArchiveRecord, fetchArchiveRecords, saveArchiveRecord, deleteArchiveRecord, importArchiveRecords, updateArchiveRecordsBatch } from '../../services/apiArchive';
import { useArchiveRealtime } from '../../hooks/useArchiveRealtime';
import { User } from '../../types';
import { Loader2, Plus, Search, Trash2, Upload, FileSpreadsheet, Send, CheckCircle2, X, History, Calendar, FileOutput, Settings, Hash, Edit, FileText } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { confirmAction, matchDepartmentKey } from '../../utils/appHelpers';
import { saveAs } from 'file-saver';
import { exportSoDiaChinh, generateSoDiaChinhBlob } from '../../utils/exportSoDiaChinh';
import { exportSoMucKe } from '../../utils/exportSoMucKe';
import { getSystemSetting, saveSystemSetting } from '../../services/apiSystem';
import { fetchEmployees } from '../../services/apiPeople';

// Định nghĩa các cột
const COLUMNS = [
    // Nhóm thông tin hồ sơ (Read-only by default)
    { key: 'ma_ho_so', label: 'Mã hồ sơ', width: '120px', readOnly: true },
    { key: 'group_chu_su_dung', label: 'Thông tin chủ sử dụng', width: '250px', readOnly: true },
    { key: 'group_thong_tin_ho_so', label: 'Thông tin hồ sơ', width: '200px', readOnly: true },
    { key: 'group_thua_dat', label: 'Thông tin thửa đất', width: '180px', readOnly: true },
    { key: 'dia_danh', label: 'Địa danh', width: '100px', readOnly: true },
    
    // Nhóm kết quả (Always editable or specific logic)
    { key: 'loai_gcn', label: 'Loại GCN', width: '120px' },
    { key: 'so_vao_so', label: 'Số vào sổ', width: '120px' }, // Thay vì 50px
    { key: 'so_phat_hanh', label: 'Số phát hành', width: '130px' }, // Thay vì 80px
    { key: 'ngay_ky_gcn', label: 'Ngày ký GCN', width: '120px', type: 'date' },
    { key: 'ngay_ky_phieu_tk', label: 'Chuyển Scan/1 Cửa', width: '120px', type: 'date' },
    { key: 'ghi_chu', label: 'GHI CHÚ', width: '200px' }
];

interface VaoSoViewProps {
    currentUser: User;
    wards: string[];
}

const VaoSoView: React.FC<VaoSoViewProps> = ({ currentUser, wards }) => {
    const [records, setRecords] = useState<ArchiveRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'scanned'>('all');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [savingId, setSavingId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;

    // Batch Modal State
    const [showBatchModal, setShowBatchModal] = useState(false);

    // Export Handover Modal State
    const [showExportHandoverModal, setShowExportHandoverModal] = useState(false);

    // Export So Dia Chinh Modal State
    const [showExportSoDiaChinhModal, setShowExportSoDiaChinhModal] = useState(false);
    const [exportSoDiaChinhRange, setExportSoDiaChinhRange] = useState({ from: '', to: '' });
    const [exportSoDiaChinhCriteria, setExportSoDiaChinhCriteria] = useState({ ward: '', month: '', splitByLetter: false, exportTocOnly: false });

    // Export So Muc Ke State
    const [showExportSoMucKeModal, setShowExportSoMucKeModal] = useState(false);
    const [exportSoMucKeParams, setExportSoMucKeParams] = useState({ ward: '', fromDate: '', toDate: '' });

    // Settings Modal State
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [currentBookNumber, setCurrentBookNumber] = useState<string>('000000');

    // Custom Button Permissions States
    const [rolePermissions, setRolePermissions] = useState<any>(null);
    const [departmentPermissions, setDepartmentPermissions] = useState<any>(null);
    const [employees, setEmployees] = useState<any[]>([]);

    const hasBatchPermission = () => {
        if (currentUser.role === 'ADMIN') return true;
        
        // Default permissions if not loaded yet
        if (!rolePermissions) {
            // Default: ALLOW for ADMIN, SUBADMIN, TEAM_LEADER, ONEDOOR, deny for EMPLOYEE
            return ['ADMIN', 'SUBADMIN', 'TEAM_LEADER', 'ONEDOOR'].includes(currentUser.role);
        }

        const rolePerms = rolePermissions[currentUser.role] || [];
        if (rolePerms.includes("*") || rolePerms.includes("BTN_CLOSE_BATCH"))
            return true;

        if (currentUser.employeeId && employees.length > 0) {
            const emp = employees.find((e) => e.id === currentUser.employeeId);
            if (emp && emp.department && departmentPermissions) {
                const matchingKey = Object.keys(departmentPermissions).find(
                    (k) => matchDepartmentKey(k, emp.department)
                );
                if (matchingKey) {
                    const deptPerms = departmentPermissions[matchingKey] || [];
                    if (deptPerms.includes("*") || deptPerms.includes("BTN_CLOSE_BATCH"))
                        return true;
                }
            }
        }
        return false;
    };

    // Filters
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [filterWard, setFilterWard] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'scanned'>('all');

    useArchiveRealtime('vaoso', setRecords);

    useEffect(() => {
        loadData();
    }, []);

    // Tự động bỏ tích và xóa chuỗi tìm kiếm khi người dùng chuyển đổi giữa các tab con
    useEffect(() => {
        setSelectedIds(new Set());
        setSearchTerm('');
    }, [activeTab]);

    const loadData = async () => {
        setLoading(true);
        const [data, savedPerms, savedDeptPerms, empData] = await Promise.all([
            fetchArchiveRecords('vaoso'),
            getSystemSetting('role_permissions'),
            getSystemSetting('department_permissions'),
            fetchEmployees()
        ]);
        setRecords(data || []);
        
        if (savedPerms) {
            try { setRolePermissions(JSON.parse(savedPerms)); } catch(e) {}
        }
        if (savedDeptPerms) {
            try { setDepartmentPermissions(JSON.parse(savedDeptPerms)); } catch(e) {}
        }
        if (empData) {
            setEmployees(empData);
        }
        
        // Calculate max book number from existing records
        let maxNum = 0;
        (data || []).forEach(r => {
            const val = r.data?.so_vao_so || '';
            if (val.startsWith('CN ')) {
                const numPart = val.replace('CN ', '');
                const num = parseInt(numPart);
                if (!isNaN(num) && num > maxNum) {
                    maxNum = num;
                }
            } else {
                 // Fallback for old format if just number
                 const num = parseInt(val);
                 if (!isNaN(num) && num > maxNum) {
                    maxNum = num;
                }
            }
        });
        
        // If local storage has a higher number, use it
        const stored = await getSystemSetting('vaoso_current_book_number');
        if (stored) {
            setCurrentBookNumber(stored);
        } else {
            setCurrentBookNumber(maxNum.toString().padStart(6, '0'));
        }
        
        setLoading(false);
    };

    const filteredRecords = useMemo(() => {
        let filtered = records;

        // Filter by Tab (Status)
        // If user selects status from dropdown, it overrides the tab logic or syncs with it.
        // Let's make the dropdown control the activeTab state for consistency.
        // But here we use activeTab directly.
        
        if (activeTab === 'all') {
            // Danh sách tổng: Hiển thị tối đa 1000 dòng mới nhất
            filtered = records.slice(0, 1000);
        } else if (activeTab === 'pending') {
            // Chờ chuyển Scan: Đã được đánh dấu chuyển scan NHƯNG chưa có đợt scan (chưa scan xong)
            filtered = records.filter(r => r.data?.is_pending_scan && !r.data?.is_scanned);
        } else if (activeTab === 'scanned') {
            // Đã chuyển Scan: Đã có đợt scan
            filtered = records.filter(r => r.data?.is_scanned);
        }

        // Filter by Date (Ngày nhận)
        if (fromDate) filtered = filtered.filter(r => r.data?.ngay_nhan >= fromDate);
        if (toDate) filtered = filtered.filter(r => r.data?.ngay_nhan <= toDate);

        // Filter by Ward (Địa danh)
        if (filterWard) filtered = filtered.filter(r => r.data?.dia_danh === filterWard);

        // Filter by Search
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            filtered = filtered.filter(r => 
                r.so_hieu?.toLowerCase().includes(lower) ||
                r.trich_yeu?.toLowerCase().includes(lower) ||
                JSON.stringify(r.data).toLowerCase().includes(lower)
            );
        }

        return filtered;
    }, [records, searchTerm, activeTab, fromDate, toDate, filterWard]);

    // Pagination
    const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
    const paginatedRecords = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredRecords.slice(start, start + itemsPerPage);
    }, [filteredRecords, currentPage]);

    // Reset page when tab or search changes
    useEffect(() => {
        setCurrentPage(1);
        setSelectedIds(new Set()); // Clear selection on tab change
    }, [activeTab, searchTerm]);

    const handleAddNew = async () => {
        const newRecord: Partial<ArchiveRecord> = {
            type: 'vaoso',
            status: 'completed',
            so_hieu: '',
            trich_yeu: '',
            ngay_thang: new Date().toISOString(),
            noi_nhan_gui: '',
            created_by: currentUser.username,
            data: {
                so_vao_so: '',
                ma_ho_so: '',
                ten_chu_su_dung: '',
                loai_bien_dong: '',
                loai_gcn: 'GCN mới',
                ngay_nhan: new Date().toISOString(),
                so_to: '',
                so_thua: '',
                tong_dien_tich: '',
                dien_tich_tho_cu: '',
                dia_danh: '',
                so_phat_hanh: '',
                ngay_ky_gcn: '',
                ngay_ky_phieu_tk: '',
                ghi_chu: ''
            }
        };
        
        const saved = await saveArchiveRecord(newRecord);
        if (saved) {
            setEditingId(saved.id);
            loadData();
        }
    };

    const handleDelete = async (id: string) => {
        if (await confirmAction("Bạn có chắc chắn muốn xóa hồ sơ này?")) {
            await deleteArchiveRecord(id);
            loadData();
        }
    };

    const handleCellChange = (id: string, key: string, value: string) => {
        setRecords(prev => prev.map(r => {
            if (r.id === id) {
                return { ...r, data: { ...r.data, [key]: value } };
            }
            return r;
        }));
    };

    const handleBlur = async (record: ArchiveRecord) => {
        setSavingId(record.id);
        await saveArchiveRecord(record);
        setSavingId(null);
    };

    const toggleEdit = (id: string) => {
        if (editingId === id) {
            setEditingId(null);
        } else {
            setEditingId(id);
        }
    };

    const incrementString = (str: string): string => {
        const num = parseInt(str);
        if (isNaN(num)) return str;
        const nextNum = num + 1;
        // Preserve length if original had leading zeros
        if (str.length > nextNum.toString().length) {
            return nextNum.toString().padStart(str.length, '0');
        }
        return nextNum.toString();
    };

    const handleGetBookNumber = async (record: ArchiveRecord) => {
        // Fetch latest to avoid conflicts if possible
        const latestStored = await getSystemSetting('vaoso_current_book_number');
        const baseNum = latestStored || currentBookNumber;
        const nextNumStr = incrementString(baseNum);
        const formattedNum = `CN ${nextNumStr}`;
        
        const updatedRecord = {
            ...record,
            data: { ...record.data, so_vao_so: formattedNum }
        };
        
        // Optimistic update
        setRecords(prev => prev.map(r => r.id === record.id ? updatedRecord : r));
        setCurrentBookNumber(nextNumStr);
        await saveSystemSetting('vaoso_current_book_number', nextNumStr);

        setSavingId(record.id);
        await saveArchiveRecord(updatedRecord);
        setSavingId(null);
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleDownloadTemplate = () => {
        const headers = [
            "Mã hồ sơ",
            "Tên chủ sử dụng",
            "CCCD",
            "Địa chỉ chủ",
            "Loại biến động",
            "Loại GCN",
            "Số vào sổ",
            "Ngày nhận",
            "Số tờ",
            "Số thửa",
            "Tổng diện tích",
            "Diện tích thổ cư",
            "Địa danh",
            "Số phát hành",
            "Ngày ký GCN",
            "Chuyển scan",
            "Ghi chú"
        ];
        
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers]);
        
        // Style headers
        const headerStyle = {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "008080" } }, // Teal
            alignment: { horizontal: "center", vertical: "center" },
            border: {
                top: { style: 'thin' },
                bottom: { style: 'thin' },
                left: { style: 'thin' },
                right: { style: 'thin' }
            }
        };
        
        for (let i = 0; i < headers.length; i++) {
            const cellRef = XLSX.utils.encode_cell({ r: 0, c: i });
            if (!ws[cellRef]) ws[cellRef] = { t: 's', v: headers[i] };
            ws[cellRef].s = headerStyle;
        }
        
        // Set column widths
        ws['!cols'] = [
            { wch: 15 }, // Mã hồ sơ
            { wch: 30 }, // Tên chủ sử dụng
            { wch: 15 }, // CCCD
            { wch: 40 }, // Địa chỉ chủ
            { wch: 20 }, // Loại biến động
            { wch: 15 }, // Loại GCN
            { wch: 15 }, // Số vào sổ
            { wch: 15 }, // Ngày nhận
            { wch: 10 }, // Số tờ
            { wch: 10 }, // Số thửa
            { wch: 15 }, // Tổng diện tích
            { wch: 15 }, // Diện tích thổ cư
            { wch: 20 }, // Địa danh
            { wch: 15 }, // Số phát hành
            { wch: 15 }, // Ngày ký GCN
            { wch: 15 }, // Chuyển scan
            { wch: 20 }  // Ghi chú
        ];
        
        XLSX.utils.book_append_sheet(wb, ws, "Template");
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, "Mau_Nhap_Vao_So_GCN.xlsx");
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const ab = evt.target?.result;
                const wb = XLSX.read(ab, { type: 'array' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

                // Tìm dòng tiêu đề
                let headerRowIdx = -1;
                for (let i = 0; i < Math.min(data.length, 10); i++) {
                    const rowStr = JSON.stringify(data[i]).toLowerCase();
                    if (rowStr.includes('mã hồ sơ') || rowStr.includes('chủ sử dụng')) {
                        headerRowIdx = i;
                        break;
                    }
                }

                if (headerRowIdx === -1) {
                    alert("Không tìm thấy dòng tiêu đề hợp lệ trong file Excel.");
                    return;
                }

                const rawHeaderRow = data[headerRowIdx] || [];
                const headers = Array.from(rawHeaderRow).map((h: any) => String(h || '').trim().toLowerCase());
                
                const rows = data.slice(headerRowIdx + 1);
                
                const newRecords: Partial<ArchiveRecord>[] = [];

                // Helper tìm index cột với loại trừ
                const findCol = (keywords: string[], excludes: string[] = []) => 
                    headers.findIndex(h => h && keywords.some(k => h.includes(k)) && !excludes.some(e => h.includes(e)));

                // Logic tìm cột Tên chủ sử dụng (Ưu tiên các từ khóa rõ ràng trước)
                let tenChuSuDungIdx = findCol(['bên nhận', 'người nhận', 'bên b', 'người được cấp', 'chủ mới']);
                if (tenChuSuDungIdx === -1) {
                    // Nếu không thấy, tìm các từ khóa chung nhưng loại trừ từ khóa chuyển nhượng
                    tenChuSuDungIdx = findCol(
                        ['tên chủ', 'người sử dụng', 'chủ sử dụng', 'họ tên', 'tên nsd', 'chủ hộ', 'được cấp', 'tên người'], 
                        ['chuyển quyền', 'chuyển nhượng', 'bên a', 'bên chuyển', 'người chuyển', 'chủ cũ']
                    );
                }

                const colMap = {
                    so_vao_so: findCol(['số vào sổ', 'svs', 'số vào']),
                    ma_ho_so: findCol(['mã hồ sơ', 'mã hs', 'số hồ sơ']),
                    ten_chu_su_dung: tenChuSuDungIdx,
                    cccd: findCol(['cccd', 'cmnd', 'căn cước']),
                    dia_chi_chu: findCol(['địa chỉ chủ', 'địa chỉ thường trú', 'nơi ở']),
                    loai_bien_dong: findCol(['biến động', 'loại hồ sơ', 'nội dung']),
                    loai_gcn: findCol(['loại gcn', 'gcn']),
                    ngay_nhan: findCol(['ngày nhận', 'ngày nộp']),
                    so_to: findCol(['tờ', 'số tờ']),
                    so_thua: findCol(['thửa', 'số thửa']),
                    tong_dien_tich: findCol(['tổng diện tích', 'dt', 'diện tích']),
                    dien_tich_tho_cu: findCol(['thổ cư', 'ont', 'odt']),
                    dia_danh: findCol(['địa danh', 'địa chỉ thửa', 'vị trí']),
                    so_phat_hanh: findCol(['số phát hành', 'số seri', 'seri']),
                    ngay_ky_gcn: findCol(['ký gcn', 'ngày ký giấy', 'ngày cấp']),
                    ngay_ky_phieu_tk: findCol(['phiếu tk', 'chuyển scan']),
                    ghi_chu: findCol(['ghi chú'])
                };

                rows.forEach(row => {
                    if (!row || row.length === 0) return;
                    if (!row[colMap.ma_ho_so] && !row[colMap.ten_chu_su_dung]) return;

                    const getValue = (idx: number) => {
                        if (idx === -1) return '';
                        let val = row[idx];
                        if (val === undefined || val === null) return '';
                        
                        // Xử lý ngày tháng Excel (serial number)
                        if (typeof val === 'number' && val > 20000 && val < 60000) {
                             const date = new Date(Math.round((val - 25569) * 86400 * 1000));
                             return date.toISOString().split('T')[0];
                        }
                        return String(val).trim();
                    };

                    let tenChu = getValue(colMap.ten_chu_su_dung);
                    let cccd = getValue(colMap.cccd);
                    let diaChiChu = getValue(colMap.dia_chi_chu);
                    
                    let combinedOwner = "";
                    if (tenChu && (tenChu.includes(' và ') || tenChu.includes('; CCCD:') || tenChu.includes('; CMND:'))) {
                        const owners = tenChu.split(/\s+và\s+/i);
                        const parsedOwners = owners.map(ownerStr => {
                            const parts = ownerStr.split(';').map(p => p.trim());
                            let name = parts[0];
                            let ownerCccd = '';
                            let ownerAddress = '';
                            
                            for (let i = 1; i < parts.length; i++) {
                                const p = parts[i];
                                if (p.toUpperCase().startsWith('CCCD:') || p.toUpperCase().startsWith('CMND:')) {
                                    ownerCccd = p.substring(5).trim();
                                } else if (p.toLowerCase().startsWith('địa chỉ:')) {
                                    ownerAddress = p.substring(8).trim();
                                }
                            }
                            
                            let res = name;
                            if (ownerCccd) res += `\nCCCD: ${ownerCccd}`;
                            if (ownerAddress) res += `\nĐịa chỉ: ${ownerAddress}`;
                            return res;
                        });
                        
                        if (parsedOwners.length === 1) {
                            let res = parsedOwners[0];
                            if (cccd && !res.includes('CCCD:')) res += `\nCCCD: ${cccd}`;
                            if (diaChiChu && !res.includes('Địa chỉ:')) res += `\nĐịa chỉ: ${diaChiChu}`;
                            combinedOwner = res;
                        } else {
                            combinedOwner = parsedOwners.join('\n\n');
                        }
                    } else {
                        combinedOwner = tenChu;
                        if (cccd) combinedOwner += `\nCCCD: ${cccd}`;
                        if (diaChiChu) combinedOwner += `\nĐịa chỉ: ${diaChiChu}`;
                    }

                    const recordData = {
                        so_vao_so: getValue(colMap.so_vao_so),
                        ma_ho_so: getValue(colMap.ma_ho_so),
                        ten_chu_su_dung: combinedOwner,
                        loai_bien_dong: getValue(colMap.loai_bien_dong),
                        loai_gcn: getValue(colMap.loai_gcn) || 'GCN mới',
                        ngay_nhan: getValue(colMap.ngay_nhan),
                        so_to: getValue(colMap.so_to),
                        so_thua: getValue(colMap.so_thua),
                        tong_dien_tich: getValue(colMap.tong_dien_tich),
                        dien_tich_tho_cu: getValue(colMap.dien_tich_tho_cu),
                        dia_danh: getValue(colMap.dia_danh),
                        so_phat_hanh: getValue(colMap.so_phat_hanh),
                        ngay_ky_gcn: getValue(colMap.ngay_ky_gcn),
                        ngay_ky_phieu_tk: getValue(colMap.ngay_ky_phieu_tk),
                        ghi_chu: getValue(colMap.ghi_chu),
                        is_pending_scan: false, // Mặc định chưa chuyển scan
                        is_scanned: false
                    };

                    newRecords.push({
                        type: 'vaoso',
                        status: 'completed',
                        so_hieu: recordData.ma_ho_so,
                        trich_yeu: `${recordData.loai_bien_dong} - ${recordData.ten_chu_su_dung}`,
                        ngay_thang: recordData.ngay_nhan || new Date().toISOString(),
                        created_by: currentUser.username,
                        data: recordData
                    });
                });

                if (newRecords.length > 0) {
                    await importArchiveRecords(newRecords);
                    alert(`Đã import thành công ${newRecords.length} hồ sơ.`);
                    loadData();
                } else {
                    alert("Không đọc được dữ liệu nào từ file.");
                }

            } catch (error) {
                console.error(error);
                alert("Lỗi khi đọc file Excel.");
            } finally {
                setLoading(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedIds(new Set(filteredRecords.map(r => r.id)));
        } else {
            setSelectedIds(new Set());
        }
    };

    const handleSelectRow = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    // Chuyển sang tab "Chờ chuyển Scan"
    const handleMoveToPending = async () => {
        if (selectedIds.size === 0) return;
        if (!await confirmAction(`Bạn có chắc muốn chuyển ${selectedIds.size} hồ sơ sang danh sách Chờ Scan?`)) return;

        setLoading(true);
        const updates = {
            data: { is_pending_scan: true }
        };
        await updateArchiveRecordsBatch(Array.from(selectedIds), updates);
        setLoading(false);
        setSelectedIds(new Set());
        loadData();
    };

    const handleMoveToPendingSingle = async (id: string) => {
        setLoading(true);
        const updates = {
            data: { is_pending_scan: true }
        };
        await updateArchiveRecordsBatch([id], updates);
        setLoading(false);
        loadData();
    };

    // Mở modal tạo đợt (từ tab Pending)
    const handleOpenBatchModal = () => {
        if (selectedIds.size === 0) return;
        setShowBatchModal(true);
    };

    // Xác nhận tạo đợt scan
    const handleConfirmBatch = async (batch: number, date: string) => {
        setLoading(true);
        const updates = {
            data: { 
                is_scanned: true,
                scan_batch_id: batch.toString(),
                scan_date: date,
                is_pending_scan: false // Đã scan xong thì bỏ cờ pending (hoặc giữ tùy logic, ở đây bỏ để biến mất khỏi tab pending)
            }
        };
        await updateArchiveRecordsBatch(Array.from(selectedIds), updates);
        setLoading(false);
        setSelectedIds(new Set());
        loadData();
    };

    const handleExportExcel = () => {
        const dataToExport = filteredRecords.map((r, idx) => {
            const row: any = {
                'STT': idx + 1,
                'Số vào sổ': r.data?.so_vao_so,
                'Mã hồ sơ': r.data?.ma_ho_so,
                'Tên chủ sử dụng': r.data?.ten_chu_su_dung,
                'Loại biến động': r.data?.loai_bien_dong,
                'Loại GCN': r.data?.loai_gcn,
                'Ngày nhận': r.data?.ngay_nhan,
                'Số tờ': r.data?.so_to,
                'Số thửa': r.data?.so_thua,
                'Tổng diện tích': r.data?.tong_dien_tich,
                'Diện tích thổ cư': r.data?.dien_tich_tho_cu,
                'Địa danh': r.data?.dia_danh,
                'Số phát hành': r.data?.so_phat_hanh,
                'Ngày ký GCN': r.data?.ngay_ky_gcn,
                'Ngày ký phiếu TK': r.data?.ngay_ky_phieu_tk,
                'Ghi chú': r.data?.ghi_chu
            };
            if (activeTab === 'scanned') {
                row['Ngày Scan'] = r.data?.scan_date;
                row['Đợt Scan'] = r.data?.scan_batch_id;
            }
            return row;
        });

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "DanhSach");
        XLSX.writeFile(wb, `VaoSo_${activeTab}_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const renderMultiInput = (value: string, onChange: (val: string) => void, onBlur: () => void, placeholder: string) => {
        const items = value ? value.split('\n') : [''];
        return (
            <div className="flex flex-col gap-1 w-full">
                {items.map((item, index) => (
                    <div key={index} className="flex items-center gap-1 w-full">
                        <input
                            type="text"
                            className="flex-1 min-w-0 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-teal-500 outline-none"
                            value={item}
                            placeholder={placeholder}
                            onChange={(e) => {
                                const newItems = [...items];
                                newItems[index] = e.target.value;
                                onChange(newItems.join('\n'));
                            }}
                            onBlur={onBlur}
                        />
                        {items.length > 1 && (
                            <button
                                onClick={() => {
                                    const newItems = items.filter((_, i) => i !== index);
                                    onChange(newItems.join('\n'));
                                    setTimeout(onBlur, 0);
                                }}
                                className="text-red-500 hover:text-red-700 p-1"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                ))}
                <button
                    onClick={() => {
                        onChange([...items, ''].join('\n'));
                        setTimeout(onBlur, 0);
                    }}
                    className="text-xs text-teal-600 hover:text-teal-800 flex items-center gap-1 self-start mt-1 bg-teal-50 px-2 py-1 rounded"
                >
                    <Plus size={12} /> Thêm mới
                </button>
            </div>
        );
    };

    const renderOwnerInput = (value: string, onChange: (val: string) => void, onBlur: () => void) => {
        const parseOwners = (val: string) => {
            if (!val) return [{ name: '', cccd: '', address: '' }];
            
            if (val.includes('\n\n') || val.includes('Địa chỉ:')) {
                return val.split('\n\n').map(block => {
                    const lines = block.split('\n');
                    let name = lines[0] || '';
                    let cccd = '';
                    let address = '';
                    
                    const cccdMatch = name.match(/^(.*?)\s+CCCD:\s*(.*)$/);
                    if (cccdMatch) {
                        name = cccdMatch[1];
                        cccd = cccdMatch[2];
                    }
                    
                    for (let i = 1; i < lines.length; i++) {
                        if (lines[i].startsWith('CCCD: ')) {
                            cccd = lines[i].substring(6);
                        } else if (lines[i].startsWith('Địa chỉ: ')) {
                            address = lines[i].substring(9);
                        }
                    }
                    return { name, cccd, address };
                });
            } else {
                return val.split('\n').map(line => {
                    let name = line;
                    let cccd = '';
                    let address = '';
                    const cccdMatch = line.match(/^(.*?)\s+CCCD:\s*(.*)$/);
                    if (cccdMatch) {
                        name = cccdMatch[1];
                        cccd = cccdMatch[2];
                    }
                    return { name, cccd, address };
                });
            }
        };

        const serializeOwners = (owners: any[]) => {
            return owners.map(o => {
                let str = o.name;
                if (o.cccd) str += `\nCCCD: ${o.cccd}`;
                if (o.address) str += `\nĐịa chỉ: ${o.address}`;
                return str;
            }).join('\n\n');
        };

        const owners = parseOwners(value);

        return (
            <div className="flex flex-col gap-2 w-full">
                {owners.map((owner, index) => (
                    <div key={index} className="flex flex-col gap-1 w-full border border-gray-200 p-1.5 rounded bg-gray-50">
                        <div className="flex items-center gap-1 w-full">
                            <input
                                type="text"
                                className="flex-1 min-w-0 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-teal-500 outline-none font-bold"
                                value={owner.name}
                                placeholder="Tên chủ sử dụng (VD: Bà Hà Thị Vân)"
                                onChange={(e) => {
                                    const newOwners = [...owners];
                                    newOwners[index].name = e.target.value;
                                    onChange(serializeOwners(newOwners));
                                }}
                                onBlur={onBlur}
                            />
                            {owners.length > 1 && (
                                <button
                                    onClick={() => {
                                        const newOwners = owners.filter((_, i) => i !== index);
                                        onChange(serializeOwners(newOwners));
                                        setTimeout(onBlur, 0);
                                    }}
                                    className="text-red-500 hover:text-red-700 p-1"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-1 w-full">
                            <input
                                type="text"
                                className="flex-1 min-w-0 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-teal-500 outline-none"
                                value={owner.cccd}
                                placeholder="Số CCCD"
                                onChange={(e) => {
                                    const newOwners = [...owners];
                                    newOwners[index].cccd = e.target.value;
                                    onChange(serializeOwners(newOwners));
                                }}
                                onBlur={onBlur}
                            />
                        </div>
                        <div className="flex items-center gap-1 w-full">
                            <input
                                type="text"
                                className="flex-1 min-w-0 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-teal-500 outline-none"
                                value={owner.address}
                                placeholder="Địa chỉ thường trú"
                                onChange={(e) => {
                                    const newOwners = [...owners];
                                    newOwners[index].address = e.target.value;
                                    onChange(serializeOwners(newOwners));
                                }}
                                onBlur={onBlur}
                            />
                        </div>
                    </div>
                ))}
                <button
                    onClick={() => {
                        const newOwners = [...owners, { name: '', cccd: '', address: '' }];
                        onChange(serializeOwners(newOwners));
                        setTimeout(onBlur, 0);
                    }}
                    className="text-xs text-teal-600 hover:text-teal-800 flex items-center gap-1 self-start mt-1 bg-teal-50 px-2 py-1 rounded"
                >
                    <Plus size={12} /> Thêm chủ sử dụng
                </button>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        Vào số GCN
                    </h2>
                    <div className="relative flex-1 sm:w-64 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input 
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" 
                            placeholder="Tìm kiếm..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                        />
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-3 items-center bg-gray-50 p-2 rounded-lg border border-gray-100">
                    <div className="flex items-center gap-2 bg-white px-2 py-1.5 rounded-md border border-gray-200 shadow-sm">
                        <Calendar size={16} className="text-gray-500"/>
                        <input type="date" className="text-sm outline-none bg-transparent text-gray-700 w-28" value={fromDate} onChange={e => setFromDate(e.target.value)} placeholder="Từ ngày" />
                        <span className="text-gray-400">-</span>
                        <input type="date" className="text-sm outline-none bg-transparent text-gray-700 w-28" value={toDate} onChange={e => setToDate(e.target.value)} placeholder="Đến ngày" />
                    </div>

                    <div className="flex items-center gap-2 bg-white px-2 py-1.5 rounded-md border border-gray-200 shadow-sm">
                        <Settings size={16} className="text-gray-500"/>
                        <select className="text-sm outline-none bg-transparent text-gray-700 font-medium cursor-pointer border-none focus:ring-0 min-w-[120px]" value={filterWard} onChange={e => setFilterWard(e.target.value)}>
                            <option value="">Tất cả Địa danh</option>
                            {wards.map(w => <option key={w} value={w}>{w}</option>)}
                        </select>
                    </div>

                    <div className="flex items-center gap-2 bg-white px-2 py-1.5 rounded-md border border-gray-200 shadow-sm">
                        <CheckCircle2 size={16} className="text-gray-500"/>
                        <select className="text-sm outline-none bg-transparent text-gray-700 font-medium cursor-pointer border-none focus:ring-0 min-w-[120px]" value={activeTab} onChange={e => setActiveTab(e.target.value as any)}>
                            <option value="all">Tất cả Trạng thái</option>
                            <option value="pending">Chờ chuyển Scan</option>
                            <option value="scanned">Đã chuyển Scan</option>
                        </select>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 bg-gray-50 p-2 rounded-lg relative">
                    <div className="flex bg-white rounded-md border border-gray-200 p-1 mr-2 shadow-sm">
                        <button 
                            onClick={() => setActiveTab('all')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${activeTab === 'all' ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                            Danh sách
                        </button>
                        <button 
                            onClick={() => setActiveTab('pending')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${activeTab === 'pending' ? 'bg-orange-100 text-orange-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                            Chờ chuyển Scan/1 Cửa
                        </button>
                        <button 
                            onClick={() => setActiveTab('scanned')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${activeTab === 'scanned' ? 'bg-green-100 text-green-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                            Đã chuyển Scan/1 Cửa
                        </button>
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                        {activeTab === 'all' && (
                            <>
                                <button 
                                    onClick={() => setShowSettingsModal(true)} 
                                    className="flex items-center gap-2 bg-gray-600 text-white px-3 py-1.5 rounded-md font-bold text-sm hover:bg-gray-700 shadow-sm"
                                    title="Cài đặt số vào sổ"
                                >
                                    <Settings size={16}/>
                                </button>
                                <button onClick={handleDownloadTemplate} className="flex items-center gap-2 bg-emerald-600 text-white px-3 py-1.5 rounded-md font-bold text-sm hover:bg-emerald-700 shadow-sm" title="Tải mẫu Excel">
                                    <FileSpreadsheet size={16}/> Tải mẫu
                                </button>
                                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx, .xls" className="hidden" />
                                <button onClick={handleImportClick} className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-md font-bold text-sm hover:bg-blue-700 shadow-sm">
                                    <Upload size={16}/> Import Excel
                                </button>
                                <button onClick={handleAddNew} className="flex items-center gap-2 bg-teal-600 text-white px-3 py-1.5 rounded-md font-bold text-sm hover:bg-teal-700 shadow-sm">
                                    <Plus size={16}/> Thêm mới
                                </button>
                                {selectedIds.size > 0 && (
                                    <button onClick={handleMoveToPending} className="flex items-center gap-2 bg-indigo-600 text-white px-3 py-1.5 rounded-md font-bold text-sm hover:bg-indigo-700 shadow-sm animate-pulse">
                                        <Send size={16}/> Chuyển Scan ({selectedIds.size})
                                    </button>
                                )}
                            </>
                        )}

                        {activeTab === 'pending' && selectedIds.size > 0 && hasBatchPermission() && (
                            <button onClick={handleOpenBatchModal} className="flex items-center gap-2 bg-orange-600 text-white px-3 py-1.5 rounded-md font-bold text-sm hover:bg-orange-700 shadow-sm animate-pulse">
                                <CheckCircle2 size={16}/> Tạo đợt ({selectedIds.size})
                            </button>
                        )}

                        {activeTab === 'scanned' && (
                            <button onClick={() => setShowExportHandoverModal(true)} className="flex items-center gap-2 bg-purple-600 text-white px-3 py-1.5 rounded-md font-bold text-sm hover:bg-purple-700 shadow-sm">
                                <FileOutput size={16}/> Xuất danh sách
                            </button>
                        )}

                        <button onClick={handleExportExcel} className="flex items-center gap-2 bg-green-600 text-white px-3 py-1.5 rounded-md font-bold text-sm hover:bg-green-700 shadow-sm">
                            <FileSpreadsheet size={16}/> Xuất Excel
                        </button>
                        <button onClick={() => {
                            if (selectedIds.size > 0) {
                                const selectedRecords = records.filter(r => selectedIds.has(r.id));
                                exportSoDiaChinh(selectedRecords);
                            } else {
                                setShowExportSoDiaChinhModal(true);
                            }
                        }} className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-md font-bold text-sm hover:bg-blue-700 shadow-sm">
                            <FileText size={16}/> Xuất Sổ địa chính
                        </button>
                        <button onClick={() => setShowExportSoMucKeModal(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-3 py-1.5 rounded-md font-bold text-sm hover:bg-indigo-700 shadow-sm">
                            <FileText size={16}/> Xuất Sổ mục kê
                        </button>
                    </div>
                </div>
            </div>

            {/* Table Container */}
            <div className="flex-1 overflow-auto relative flex flex-col">
                {loading ? (
                    <div className="flex items-center justify-center h-full text-gray-500 gap-2">
                        <Loader2 className="animate-spin" /> Đang xử lý...
                    </div>
                ) : (
                    <>
                    <div className="inline-block min-w-full align-middle flex-1 overflow-auto">
                        <table className="min-w-full table-fixed border-collapse">
                            <thead className="bg-gray-100 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="p-2 border-b border-r border-gray-200 w-10 text-center bg-gray-100 sticky left-0 z-20">
                                        <input type="checkbox" onChange={handleSelectAll} checked={filteredRecords.length > 0 && selectedIds.size === filteredRecords.length} />
                                    </th>
                                    <th className="p-2 border-b border-r border-gray-200 w-12 text-center bg-gray-100 sticky left-10 z-20">#</th>
                                    {COLUMNS.map(col => (
                                        <th key={col.key} className="p-2 border-b border-r border-gray-200 text-xs font-bold text-gray-600 uppercase text-center whitespace-nowrap" style={{ width: col.width, minWidth: col.width }}>
                                            {col.label}
                                        </th>
                                    ))}
                                    {activeTab === 'scanned' && (
                                        <>
                                            <th className="p-2 border-b border-r border-gray-200 w-32 text-xs font-bold text-gray-600 uppercase">Đợt Scan</th>
                                        </>
                                    )}
                                    <th className="p-2 border-b border-gray-200 w-24 text-center bg-gray-100 sticky right-0 z-20">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {paginatedRecords.length > 0 ? paginatedRecords.map((r, idx) => (
                                    <tr key={r.id} className={`hover:bg-teal-50/30 group ${selectedIds.has(r.id) ? 'bg-blue-50' : ''}`}>
                                        <td className="p-2 border-r border-gray-200 text-center bg-white sticky left-0 z-10 group-hover:bg-teal-50/30">
                                            <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => handleSelectRow(r.id)} />
                                        </td>
                                        <td className="p-2 border-r border-gray-200 text-center text-gray-500 text-xs bg-white sticky left-10 z-10 group-hover:bg-teal-50/30">
                                            {(currentPage - 1) * itemsPerPage + idx + 1}
                                            {savingId === r.id && <span className="block text-[9px] text-teal-600 animate-pulse">Lưu...</span>}
                                        </td>
                                        {COLUMNS.map(col => {
                                            const isEditing = editingId === r.id;
                                            const isReadOnly = col.readOnly && !isEditing;

                                            if (col.key === 'group_chu_su_dung') {
                                                return (
                                                    <td key={`${r.id}-${col.key}`} className="p-2 border-r border-gray-200 align-top">
                                                        <div className="flex flex-col gap-1">
                                                            <div className="text-xs text-teal-600 font-bold mb-1">Chủ sử dụng:</div>
                                                            {isEditing ? (
                                                                renderOwnerInput(r.data?.ten_chu_su_dung || '', (val) => handleCellChange(r.id, 'ten_chu_su_dung', val), () => handleBlur(r))
                                                            ) : (
                                                                <div className="text-sm font-bold text-teal-800 whitespace-pre-wrap">{r.data?.ten_chu_su_dung}</div>
                                                            )}
                                                        </div>
                                                    </td>
                                                );
                                            }
                                            if (col.key === 'group_thong_tin_ho_so') {
                                                return (
                                                    <td key={`${r.id}-${col.key}`} className="p-2 border-r border-gray-200 align-top">
                                                        <div className="text-xs text-gray-500 mb-0.5">Loại hồ sơ:</div>
                                                        {isEditing ? (
                                                            <input
                                                                type="text"
                                                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded mb-2 focus:ring-2 focus:ring-teal-500 outline-none"
                                                                value={r.data?.loai_bien_dong || ''}
                                                                onChange={(e) => handleCellChange(r.id, 'loai_bien_dong', e.target.value)}
                                                                onBlur={() => handleBlur(r)}
                                                            />
                                                        ) : (
                                                            <div className="text-sm font-medium text-blue-700 mb-2 whitespace-pre-wrap leading-tight">{r.data?.loai_bien_dong}</div>
                                                        )}
                                                        <div className="text-xs text-gray-500 mb-0.5">Ngày nhận:</div>
                                                        {isEditing ? (
                                                            <input
                                                                type="date"
                                                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-teal-500 outline-none"
                                                                value={r.data?.ngay_nhan || ''}
                                                                onChange={(e) => handleCellChange(r.id, 'ngay_nhan', e.target.value)}
                                                                onBlur={() => handleBlur(r)}
                                                            />
                                                        ) : (
                                                            <div className="text-sm font-bold text-gray-800 flex items-center gap-1">
                                                                <Calendar size={14} className="text-gray-400" />
                                                                {r.data?.ngay_nhan ? new Date(r.data.ngay_nhan).toLocaleDateString('vi-VN') : ''}
                                                            </div>
                                                        )}
                                                    </td>
                                                );
                                            }
                                            if (col.key === 'group_thua_dat') {
                                                return (
                                                    <td key={`${r.id}-${col.key}`} className="p-2 border-r border-gray-200 align-top">
                                                        {isEditing ? (
                                                            <div className="flex flex-col gap-2">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="flex-1">
                                                                        <div className="text-xs text-gray-500">Tờ bản đồ:</div>
                                                                        <input type="text" className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-teal-500 outline-none" value={r.data?.so_to || ''} onChange={(e) => handleCellChange(r.id, 'so_to', e.target.value)} onBlur={() => handleBlur(r)} />
                                                                    </div>
                                                                    <div className="flex-1">
                                                                        <div className="text-xs text-gray-500">Số thửa:</div>
                                                                        <input type="text" className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-teal-500 outline-none" value={r.data?.so_thua || ''} onChange={(e) => handleCellChange(r.id, 'so_thua', e.target.value)} onBlur={() => handleBlur(r)} />
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="flex-1">
                                                                        <div className="text-xs text-gray-500">Tổng DT:</div>
                                                                        <input type="text" className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-teal-500 outline-none" value={r.data?.tong_dien_tich || ''} onChange={(e) => handleCellChange(r.id, 'tong_dien_tich', e.target.value)} onBlur={() => handleBlur(r)} />
                                                                    </div>
                                                                    <div className="flex-1">
                                                                        <div className="text-xs text-gray-500">Đất ở:</div>
                                                                        <input type="text" className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-teal-500 outline-none" value={r.data?.dien_tich_tho_cu || ''} onChange={(e) => handleCellChange(r.id, 'dien_tich_tho_cu', e.target.value)} onBlur={() => handleBlur(r)} />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-xs border border-gray-200 whitespace-nowrap">Tờ: <b>{r.data?.so_to}</b></span>
                                                                    <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-xs border border-gray-200 whitespace-nowrap">Thửa: <b>{r.data?.so_thua}</b></span>
                                                                </div>
                                                                <div className="text-xs text-gray-600 mb-1">
                                                                    DT: <b>{r.data?.tong_dien_tich ? `${r.data.tong_dien_tich} m²` : ''}</b>
                                                                </div>
                                                                <div className="text-xs text-gray-600">
                                                                    Đất ở: <b>{r.data?.dien_tich_tho_cu ? `${r.data.dien_tich_tho_cu} m²` : ''}</b>
                                                                </div>
                                                            </>
                                                        )}
                                                    </td>
                                                );
                                            }

                                            return (
                                                <td key={`${r.id}-${col.key}`} className="p-0 border-r border-gray-200 relative">
                                                    {isReadOnly ? (
                                                        <div className="w-full h-full px-2 py-2 text-sm text-gray-700 whitespace-pre-wrap min-h-[40px] flex items-center">
                                                            {r.data?.[col.key] || ''}
                                                        </div>
                                                    ) : col.key === 'so_vao_so' ? (
                                                        <div className="flex h-full">
                                                            <input 
                                                                type="text"
                                                                className="flex-1 min-w-0 px-2 py-2 text-sm bg-transparent border-none focus:ring-2 focus:ring-inset focus:ring-teal-500 outline-none"
                                                                value={r.data?.[col.key] || ''}
                                                                onChange={(e) => handleCellChange(r.id, col.key, e.target.value)}
                                                                onBlur={() => handleBlur(r)}
                                                                readOnly={activeTab === 'scanned'} 
                                                            />
                                                            {activeTab === 'all' && (
                                                                <button 
                                                                    onClick={() => handleGetBookNumber(r)}
                                                                    className="px-2 bg-gray-100 hover:bg-blue-100 text-blue-600 border-l border-gray-200 transition-colors"
                                                                    title="Lấy số vào sổ tiếp theo"
                                                                >
                                                                    <Hash size={14} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ) : col.key === 'ten_chu_su_dung' ? (
                                                        <textarea
                                                            className="w-full h-full px-2 py-2 text-sm bg-transparent border-none focus:ring-2 focus:ring-inset focus:ring-teal-500 outline-none resize-none whitespace-pre-wrap"
                                                            value={r.data?.[col.key] || ''}
                                                            onChange={(e) => handleCellChange(r.id, col.key, e.target.value)}
                                                            onBlur={() => handleBlur(r)}
                                                            readOnly={activeTab === 'scanned'}
                                                            rows={2}
                                                            style={{ minHeight: '40px' }}
                                                        />
                                                    ) : col.key === 'loai_gcn' ? (
                                                        <select
                                                            className="w-full h-full px-2 py-2 text-sm bg-transparent border-none focus:ring-2 focus:ring-inset focus:ring-teal-500 outline-none"
                                                            value={r.data?.[col.key] || 'GCN mới'}
                                                            onChange={(e) => {
                                                                handleCellChange(r.id, col.key, e.target.value);
                                                                handleBlur({ ...r, data: { ...r.data, [col.key]: e.target.value } });
                                                            }}
                                                            disabled={activeTab === 'scanned'}
                                                        >
                                                            <option value="GCN mới">GCN mới</option>
                                                            <option value="GCN trang 4">GCN trang 4</option>
                                                        </select>
                                                    ) : col.key === 'so_phat_hanh' ? (
                                                        <div className="flex flex-col p-1 gap-1 min-w-[80px]">
                                                            {(r.data?.[col.key] || '').split('\n').map((val: string, idx: number, arr: string[]) => (
                                                                <div key={idx} className="flex items-center gap-1 group/input">
                                                                    <input 
                                                                        type="text"
                                                                        className="flex-1 min-w-0 px-2 py-1 text-sm bg-transparent border-b border-gray-200 focus:border-teal-500 outline-none"
                                                                        value={val}
                                                                        onChange={(e) => {
                                                                            const newArr = [...arr];
                                                                            newArr[idx] = e.target.value;
                                                                            handleCellChange(r.id, col.key, newArr.join('\n'));
                                                                        }}
                                                                        onBlur={() => handleBlur(r)}
                                                                        placeholder="Số phát hành..."
                                                                    />
                                                                    {arr.length > 1 && (
                                                                        <button 
                                                                            onClick={() => {
                                                                                const newArr = arr.filter((_, i) => i !== idx);
                                                                                const newVal = newArr.join('\n');
                                                                                handleCellChange(r.id, col.key, newVal);
                                                                                handleBlur({ ...r, data: { ...r.data, [col.key]: newVal } });
                                                                            }}
                                                                            className="text-gray-300 hover:text-red-500 p-1 opacity-0 group-hover/input:opacity-100 transition-opacity"
                                                                            tabIndex={-1}
                                                                            title="Xóa dòng này"
                                                                        >
                                                                            <X size={12} />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            ))}
                                                            <button 
                                                                onClick={() => {
                                                                    const current = r.data?.[col.key] || '';
                                                                    const newVal = current === '' ? '\n' : current + '\n';
                                                                    handleCellChange(r.id, col.key, newVal);
                                                                }}
                                                                className="flex items-center justify-center gap-1 text-[10px] bg-blue-50 text-blue-600 py-1.5 rounded hover:bg-blue-100 mt-1 font-bold transition-colors w-full"
                                                            >
                                                                <Plus size={12} /> Thêm số
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <input 
                                                            type={col.type || 'text'}
                                                            className="w-full h-full px-2 py-2 text-sm bg-transparent border-none focus:ring-2 focus:ring-inset focus:ring-teal-500 outline-none"
                                                            value={r.data?.[col.key] || ''}
                                                            onChange={(e) => handleCellChange(r.id, col.key, e.target.value)}
                                                            onBlur={() => handleBlur(r)}
                                                            readOnly={activeTab === 'scanned'} 
                                                        />
                                                    )}
                                                </td>
                                            );
                                        })}
                                        {activeTab === 'scanned' && (
                                            <>
                                                <td className="p-2 border-r border-gray-200 text-xs text-gray-600">
                                                    {r.data?.scan_batch_id}
                                                </td>
                                            </>
                                        )}
                                        <td className="p-2 text-center bg-white sticky right-0 group-hover:bg-teal-50/30 z-10 border-l border-gray-200">
                                            <div className="flex flex-col gap-2 items-center justify-center h-full w-full">
                                                {activeTab === 'all' && (
                                                    <>
                                                        <button 
                                                            onClick={() => toggleEdit(r.id)} 
                                                            className={`p-2 rounded-lg transition-colors shadow-sm border ${editingId === r.id ? 'text-green-600 bg-green-50 border-green-200 hover:bg-green-100' : 'text-gray-500 bg-white border-gray-200 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50'}`}
                                                            title={editingId === r.id ? "Xong" : "Sửa"}
                                                        >
                                                            {editingId === r.id ? <CheckCircle2 size={18}/> : <Edit size={18}/>}
                                                        </button>
                                                        <button 
                                                            onClick={() => handleMoveToPendingSingle(r.id)} 
                                                            className="p-2 text-indigo-600 bg-white border border-gray-200 hover:bg-indigo-50 hover:border-indigo-300 rounded-lg transition-colors shadow-sm" 
                                                            title="Chuyển Scan"
                                                        >
                                                            <Send size={18}/>
                                                        </button>
                                                    </>
                                                )}
                                                <button 
                                                    onClick={() => handleDelete(r.id)} 
                                                    className="p-2 text-gray-500 bg-white border border-gray-200 hover:text-red-600 hover:bg-red-50 hover:border-red-300 rounded-lg transition-colors shadow-sm" 
                                                    title="Xóa dòng này"
                                                >
                                                    <Trash2 size={18}/>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={COLUMNS.length + 5} className="p-8 text-center text-gray-400 italic">
                                            {activeTab === 'all' ? 'Chưa có dữ liệu. Nhấn "Import Excel" hoặc "Thêm mới".' : 
                                             activeTab === 'pending' ? 'Chưa có hồ sơ chờ chuyển scan.' :
                                             'Chưa có hồ sơ nào được chuyển Scan.'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="p-2 border-t border-gray-200 bg-gray-50 flex justify-between items-center sticky bottom-0 z-20">
                            <div className="text-xs text-gray-500">
                                Hiển thị {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredRecords.length)} trong tổng số {filteredRecords.length} dòng
                            </div>
                            <div className="flex gap-1">
                                <button 
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="px-2 py-1 bg-white border border-gray-300 rounded text-xs disabled:opacity-50 hover:bg-gray-100"
                                >
                                    Trước
                                </button>
                                <span className="px-2 py-1 text-xs font-medium">Trang {currentPage} / {totalPages}</span>
                                <button 
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="px-2 py-1 bg-white border border-gray-300 rounded text-xs disabled:opacity-50 hover:bg-gray-100"
                                >
                                    Sau
                                </button>
                            </div>
                        </div>
                    )}
                    </>
                )}
            </div>

            {/* Batch Modal */}
            <BatchModal 
                isOpen={showBatchModal}
                onClose={() => setShowBatchModal(false)}
                onConfirm={handleConfirmBatch}
                records={records}
                selectedCount={selectedIds.size}
            />

            {/* Export Handover Modal */}
            <ExportHandoverModal
                isOpen={showExportHandoverModal}
                onClose={() => setShowExportHandoverModal(false)}
                records={records}
                wards={wards}
            />

            {/* Export So Muc Ke Modal */}
            {showExportSoMucKeModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md animate-fade-in-up">
                        <div className="p-4 border-b bg-gray-50 flex justify-between items-center rounded-t-xl">
                            <h3 className="font-bold text-gray-800 text-lg">Xuất Sổ mục kê</h3>
                            <button onClick={() => setShowExportSoMucKeModal(false)} className="text-gray-500 hover:text-red-500 transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-600 mb-1">Xã/Phường</label>
                                <select 
                                    className="w-full border rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                    value={exportSoMucKeParams.ward}
                                    onChange={(e) => setExportSoMucKeParams(prev => ({ ...prev, ward: e.target.value }))}
                                >
                                    <option value="">Tất cả</option>
                                    {wards.map(w => (
                                        <option key={w} value={w}>{w}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-sm font-semibold text-gray-600 mb-1">Từ ngày (Ký GCN)</label>
                                    <input 
                                        type="date" 
                                        value={exportSoMucKeParams.fromDate}
                                        onChange={(e) => setExportSoMucKeParams(prev => ({ ...prev, fromDate: e.target.value }))}
                                        className="w-full border rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-sm font-semibold text-gray-600 mb-1">Đến ngày</label>
                                    <input 
                                        type="date" 
                                        value={exportSoMucKeParams.toDate}
                                        onChange={(e) => setExportSoMucKeParams(prev => ({ ...prev, toDate: e.target.value }))}
                                        className="w-full border rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="p-4 border-t bg-gray-50 flex justify-end gap-2 rounded-b-xl">
                            <button 
                                onClick={() => setShowExportSoMucKeModal(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                            >
                                Hủy
                            </button>
                            <button 
                                onClick={() => {
                                    let recordsToExport = [...records];
                                    
                                    // Filter by ward
                                    if (exportSoMucKeParams.ward) {
                                        recordsToExport = recordsToExport.filter(r => r.data?.dia_danh === exportSoMucKeParams.ward);
                                    }
                                    
                                    // Filter by date
                                    if (exportSoMucKeParams.fromDate) {
                                        const fromTime = new Date(exportSoMucKeParams.fromDate).getTime();
                                        recordsToExport = recordsToExport.filter(r => {
                                            if (!r.data?.ngay_ky_gcn) return false;
                                            return new Date(r.data.ngay_ky_gcn).getTime() >= fromTime;
                                        });
                                    }
                                    
                                    if (exportSoMucKeParams.toDate) {
                                        const toTime = new Date(exportSoMucKeParams.toDate).getTime();
                                        recordsToExport = recordsToExport.filter(r => {
                                            if (!r.data?.ngay_ky_gcn) return false;
                                            return new Date(r.data.ngay_ky_gcn).getTime() <= toTime;
                                        });
                                    }

                                    if (recordsToExport.length === 0) {
                                        alert("Không có hồ sơ nào thỏa mãn điều kiện.");
                                        return;
                                    }

                                    exportSoMucKe(recordsToExport, exportSoMucKeParams.ward, exportSoMucKeParams.fromDate, exportSoMucKeParams.toDate);
                                    setShowExportSoMucKeModal(false);
                                }}
                                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
                            >
                                Xuất file
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Export So Dia Chinh Modal */}
            {showExportSoDiaChinhModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl animate-fade-in-up">
                        <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                            <h3 className="font-bold text-gray-800 text-lg">Xuất Sổ địa chính</h3>
                            <button onClick={() => setShowExportSoDiaChinhModal(false)} className="text-gray-500 hover:text-red-500 transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <p className="text-sm text-gray-600 mb-2 font-medium">Xuất theo khoảng số (Ưu tiên):</p>
                                <div className="flex gap-4 items-center">
                                    <div className="flex-1">
                                        <label className="block text-xs font-semibold text-gray-600 mb-1">Từ số</label>
                                        <input 
                                            type="number" 
                                            value={exportSoDiaChinhRange.from}
                                            onChange={(e) => setExportSoDiaChinhRange(prev => ({ ...prev, from: e.target.value }))}
                                            className="w-full border rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                            placeholder="Ví dụ: 1"
                                        />
                                    </div>
                                    <span className="text-gray-400 font-bold mt-5">-</span>
                                    <div className="flex-1">
                                        <label className="block text-xs font-semibold text-gray-600 mb-1">Đến số</label>
                                        <input 
                                            type="number" 
                                            value={exportSoDiaChinhRange.to}
                                            onChange={(e) => setExportSoDiaChinhRange(prev => ({ ...prev, to: e.target.value }))}
                                            className="w-full border rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                            placeholder="Ví dụ: 100"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="border-t pt-4">
                                <p className="text-sm text-gray-600 mb-2 font-medium">Hoặc xuất theo tiêu chí:</p>
                                <div className="space-y-4">
                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <label className="block text-xs font-semibold text-gray-600 mb-1">Xã/Phường</label>
                                            <select 
                                                value={exportSoDiaChinhCriteria.ward}
                                                onChange={(e) => setExportSoDiaChinhCriteria(prev => ({ ...prev, ward: e.target.value }))}
                                                className="w-full border rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                            >
                                                <option value="">Tất cả</option>
                                                {wards.map(w => <option key={w} value={w}>{w}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-xs font-semibold text-gray-600 mb-1">Tháng / Năm</label>
                                            <div className="flex gap-2">
                                                <select
                                                    value={exportSoDiaChinhCriteria.month ? exportSoDiaChinhCriteria.month.split('-')[1] : ''}
                                                    onChange={(e) => {
                                                        const m = e.target.value;
                                                        const y = exportSoDiaChinhCriteria.month ? exportSoDiaChinhCriteria.month.split('-')[0] : new Date().getFullYear().toString();
                                                        setExportSoDiaChinhCriteria(prev => ({ ...prev, month: m ? `${y}-${m}` : '' }));
                                                    }}
                                                    className="w-1/2 border rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                                >
                                                    <option value="">Chọn tháng</option>
                                                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                                        <option key={m} value={m.toString().padStart(2, '0')}>Tháng {m}</option>
                                                    ))}
                                                </select>
                                                <input
                                                    type="number"
                                                    value={exportSoDiaChinhCriteria.month ? exportSoDiaChinhCriteria.month.split('-')[0] : new Date().getFullYear().toString()}
                                                    onChange={(e) => {
                                                        const y = e.target.value;
                                                        const m = exportSoDiaChinhCriteria.month ? exportSoDiaChinhCriteria.month.split('-')[1] : '';
                                                        if (m) {
                                                            setExportSoDiaChinhCriteria(prev => ({ ...prev, month: `${y}-${m}` }));
                                                        }
                                                    }}
                                                    placeholder="Năm"
                                                    className="w-1/2 border rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 mt-2">
                                        <input 
                                            type="checkbox" 
                                            id="splitByLetter"
                                            checked={exportSoDiaChinhCriteria.splitByLetter}
                                            onChange={(e) => setExportSoDiaChinhCriteria(prev => ({ ...prev, splitByLetter: e.target.checked }))}
                                            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                        />
                                        <label htmlFor="splitByLetter" className="text-sm font-medium text-gray-700 cursor-pointer">
                                            Xuất chia theo từng chữ cái đầu của tên chủ (A, B, C...)
                                        </label>
                                    </div>
                                    <div className="flex items-center gap-2 mt-2">
                                        <input 
                                            type="checkbox" 
                                            id="exportTocOnly"
                                            checked={exportSoDiaChinhCriteria.exportTocOnly || false}
                                            onChange={(e) => setExportSoDiaChinhCriteria(prev => ({ ...prev, exportTocOnly: e.target.checked }))}
                                            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                        />
                                        <label htmlFor="exportTocOnly" className="text-sm font-medium text-gray-700 cursor-pointer">
                                            Chỉ xuất mục lục
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 border-t bg-gray-50 flex justify-end gap-2 rounded-b-xl">
                            <button 
                                onClick={() => setShowExportSoDiaChinhModal(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                            >
                                Hủy
                            </button>
                            <button 
                                onClick={() => {
                                    const fromNum = parseInt(exportSoDiaChinhRange.from);
                                    const toNum = parseInt(exportSoDiaChinhRange.to);
                                    
                                    let recordsToExport = [];

                                    if (!isNaN(fromNum) && !isNaN(toNum) && fromNum <= toNum) {
                                        // Export by number range
                                        recordsToExport = records.filter(r => {
                                            const val = r.data?.so_vao_so || '';
                                            let num = NaN;
                                            if (val.startsWith('CN ')) {
                                                num = parseInt(val.replace('CN ', ''));
                                            } else {
                                                num = parseInt(val);
                                            }
                                            return !isNaN(num) && num >= fromNum && num <= toNum;
                                        });

                                        // Sort by number
                                        recordsToExport.sort((a, b) => {
                                            const numA = parseInt((a.data?.so_vao_so || '').replace('CN ', '')) || 0;
                                            const numB = parseInt((b.data?.so_vao_so || '').replace('CN ', '')) || 0;
                                            return numA - numB;
                                        });
                                    } else {
                                        // Export by criteria
                                        const { ward, month, splitByLetter } = exportSoDiaChinhCriteria;
                                        if (!ward && !month && !splitByLetter) {
                                            alert("Vui lòng nhập khoảng số hoặc chọn ít nhất một tiêu chí xuất.");
                                            return;
                                        }

                                        recordsToExport = records.filter(r => {
                                            let matchWard = true;
                                            let matchMonth = true;

                                            if (ward) {
                                                matchWard = r.data?.dia_danh?.toLowerCase().includes(ward.toLowerCase());
                                            }

                                            if (month) {
                                                const recordDate = r.data?.ngay_nhan || r.ngay_thang;
                                                if (recordDate) {
                                                    matchMonth = recordDate.startsWith(month);
                                                } else {
                                                    matchMonth = false;
                                                }
                                            }

                                            return matchWard && matchMonth;
                                        });
                                    }

                                    if (recordsToExport.length === 0) {
                                        alert("Không tìm thấy hồ sơ nào thỏa mãn điều kiện.");
                                        return;
                                    }

                                    if (exportSoDiaChinhCriteria.splitByLetter && !exportSoDiaChinhRange.from && !exportSoDiaChinhRange.to) {
                                        // Group by letter
                                        const groups: Record<string, typeof recordsToExport> = {};
                                        recordsToExport.forEach(r => {
                                            const ownerName = r.data?.ten_chu_su_dung || '';
                                            const parts = ownerName.trim().split(' ');
                                            const firstName = parts[parts.length - 1] || '';
                                            let firstLetter = firstName.charAt(0).toUpperCase();
                                            
                                            const charMap: Record<string, string> = {
                                                'À':'A', 'Á':'A', 'Ạ':'A', 'Ả':'A', 'Ã':'A',
                                                'Ầ':'Â', 'Ấ':'Â', 'Ậ':'Â', 'Ẩ':'Â', 'Ẫ':'Â',
                                                'Ằ':'Ă', 'Ắ':'Ă', 'Ặ':'Ă', 'Ẳ':'Ă', 'Ẵ':'Ă',
                                                'È':'E', 'É':'E', 'Ẹ':'E', 'Ẻ':'E', 'Ẽ':'E',
                                                'Ề':'Ê', 'Ế':'Ê', 'Ệ':'Ê', 'Ể':'Ê', 'Ễ':'Ê',
                                                'Ì':'I', 'Í':'I', 'Ị':'I', 'Ỉ':'I', 'Ĩ':'I',
                                                'Ò':'O', 'Ó':'O', 'Ọ':'O', 'Ỏ':'O', 'Õ':'O',
                                                'Ồ':'Ô', 'Ố':'Ô', 'Ộ':'Ô', 'Ổ':'Ô', 'Ỗ':'Ô',
                                                'Ờ':'Ơ', 'Ớ':'Ơ', 'Ợ':'Ơ', 'Ở':'Ơ', 'Ỡ':'Ơ',
                                                'Ù':'U', 'Ú':'U', 'Ụ':'U', 'Ủ':'U', 'Ũ':'U',
                                                'Ừ':'Ư', 'Ứ':'Ư', 'Ự':'Ư', 'Ử':'Ư', 'Ữ':'Ư',
                                                'Ỳ':'Y', 'Ý':'Y', 'Ỵ':'Y', 'Ỷ':'Y', 'Ỹ':'Y',
                                            };
                                            firstLetter = charMap[firstLetter] || firstLetter;
                                            
                                            // Normalize to base letter if needed, but keeping original uppercase is fine
                                            if (!firstLetter || !/[A-ZĂÂĐÊÔƠƯ]/.test(firstLetter)) {
                                                firstLetter = 'Khac';
                                            }
                                            
                                            if (!groups[firstLetter]) groups[firstLetter] = [];
                                            groups[firstLetter].push(r);
                                        });

                                        import('jszip').then(async ({ default: JSZip }) => {
                                            const zip = new JSZip();
                                            const monthStr = exportSoDiaChinhCriteria.month ? exportSoDiaChinhCriteria.month.split('-')[1] : 'All';
                                            const yearStr = exportSoDiaChinhCriteria.month ? exportSoDiaChinhCriteria.month.split('-')[0] : 'All';

                                            for (const [letter, groupRecords] of Object.entries(groups)) {
                                                // Sort groupRecords by number
                                                groupRecords.sort((a, b) => {
                                                    const numA = parseInt((a.data?.so_vao_so || '').replace('CN ', '')) || 0;
                                                    const numB = parseInt((b.data?.so_vao_so || '').replace('CN ', '')) || 0;
                                                    return numA - numB;
                                                });

                                                const quyenSo = `${letter}${monthStr}`;
                                                const blob = await generateSoDiaChinhBlob(groupRecords, quyenSo, exportSoDiaChinhCriteria.exportTocOnly);
                                                const fileName = `SDC-${monthStr}-${yearStr}-${letter}.docx`;
                                                zip.file(fileName, blob);
                                            }

                                            const zipBlob = await zip.generateAsync({ type: 'blob' });
                                            saveAs(zipBlob, `SoDiaChinh_${monthStr}_${yearStr}.zip`);
                                            setShowExportSoDiaChinhModal(false);
                                        });
                                    } else {
                                        // Sort by number
                                        recordsToExport.sort((a, b) => {
                                            const numA = parseInt((a.data?.so_vao_so || '').replace('CN ', '')) || 0;
                                            const numB = parseInt((b.data?.so_vao_so || '').replace('CN ', '')) || 0;
                                            return numA - numB;
                                        });
                                        exportSoDiaChinh(recordsToExport, "", exportSoDiaChinhCriteria.exportTocOnly);
                                        setShowExportSoDiaChinhModal(false);
                                    }
                                }}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                            >
                                Xuất file
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Settings Modal */}
            {showSettingsModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-sm animate-fade-in-up">
                        <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                            <h3 className="font-bold text-gray-800 text-lg">Cài đặt số vào sổ</h3>
                            <button onClick={() => setShowSettingsModal(false)} className="text-gray-400 hover:text-red-500"><X size={20}/></button>
                        </div>
                        <div className="p-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Số vào sổ hiện tại (phần số)</label>
                            <input 
                                type="text" 
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                                value={currentBookNumber}
                                onChange={(e) => setCurrentBookNumber(e.target.value)}
                            />
                            <p className="text-xs text-gray-500 mt-2">
                                Hệ thống sẽ tự động tăng số này và thêm tiền tố "CN".<br/>
                                Ví dụ: Nếu nhập <strong>{currentBookNumber}</strong>, số tiếp theo sẽ là <strong>CN {incrementString(currentBookNumber)}</strong>.
                            </p>
                        </div>
                        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
                            <button 
                                onClick={async () => {
                                    await saveSystemSetting('vaoso_current_book_number', currentBookNumber);
                                    setShowSettingsModal(false);
                                }} 
                                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-bold text-sm shadow-sm"
                            >
                                Lưu cài đặt
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Batch Modal Component
interface BatchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (batch: number, date: string) => void;
    records: ArchiveRecord[];
    selectedCount: number;
}

const BatchModal: React.FC<BatchModalProps> = ({ isOpen, onClose, onConfirm, records, selectedCount }) => {
    const [mode, setMode] = useState<'new' | 'existing'>('new');
    const [selectedExistingBatch, setSelectedExistingBatch] = useState<string>('');
    const todayStr = new Date().toISOString().split('T')[0];

    const nextBatchInfo = useMemo(() => {
        let maxBatch = 0;
        records.forEach(r => {
            if (r.data?.scan_batch_id && r.data?.scan_date?.startsWith(todayStr)) {
                const b = parseInt(r.data.scan_batch_id);
                if (!isNaN(b) && b > maxBatch) maxBatch = b;
            }
        });
        return { batch: maxBatch + 1, date: new Date().toISOString() };
    }, [records, todayStr]);

    const historyBatches = useMemo(() => {
        const batches: Record<string, any> = {};
        records.forEach(r => {
            if (r.data?.is_scanned && r.data?.scan_batch_id && r.data?.scan_date) {
                const datePart = r.data.scan_date.split('T')[0];
                const key = `${datePart}_${r.data.scan_batch_id}`;
                if (!batches[key]) {
                    batches[key] = { date: datePart, batch: parseInt(r.data.scan_batch_id), count: 0, fullDate: r.data.scan_date };
                }
                batches[key].count++;
            }
        });
        return Object.values(batches).sort((a: any, b: any) => b.date.localeCompare(a.date) || b.batch - a.batch);
    }, [records]);

    useEffect(() => {
        if (mode === 'existing' && historyBatches.length > 0 && !selectedExistingBatch) {
            const first = historyBatches[0];
            setSelectedExistingBatch(`${first.date}_${first.batch}`);
        }
    }, [mode, historyBatches]);

    if (!isOpen) return null;

    const handleConfirm = () => {
        if (mode === 'new') {
            onConfirm(nextBatchInfo.batch, nextBatchInfo.date);
        } else {
            if (!selectedExistingBatch) {
                alert('Vui lòng chọn một đợt cũ.');
                return;
            }
            const [datePart, batchNumStr] = selectedExistingBatch.split('_');
            const batchNum = parseInt(batchNumStr);
            const found = historyBatches.find((h: any) => h.date === datePart && h.batch === batchNum);
            
            if (found) {
                onConfirm(found.batch, found.fullDate);
            }
        }
        onClose();
    };

    const formatDate = (d: string) => {
        const parts = d.split('-');
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md animate-fade-in-up flex flex-col overflow-hidden">
                <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800 text-lg">Tạo Đợt Chuyển Scan</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-red-500"><X size={20}/></button>
                </div>

                <div className="p-6 space-y-4">
                    <p className="text-sm text-gray-600 mb-2">
                        Bạn đang tạo đợt cho <strong>{selectedCount}</strong> hồ sơ.
                    </p>

                    {/* Option 1: New Batch */}
                    <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${mode === 'new' ? 'bg-blue-50 border-blue-500 shadow-sm' : 'bg-white border-gray-200 hover:border-blue-300'}`}>
                        <input 
                            type="radio" 
                            name="batchMode" 
                            checked={mode === 'new'} 
                            onChange={() => setMode('new')}
                            className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex-1">
                            <div className="flex items-center gap-2 font-bold text-gray-800">
                                <Plus size={16} className="text-blue-600" /> Tạo đợt mới (Hôm nay)
                            </div>
                            <div className="text-sm text-gray-600 mt-1 pl-6">
                                Đợt tiếp theo: <span className="font-bold text-blue-700">Đợt {nextBatchInfo.batch}</span>
                                <br/>
                                <span className="text-xs text-gray-500">Ngày: {formatDate(todayStr)}</span>
                            </div>
                        </div>
                    </label>

                    {/* Option 2: Existing Batch */}
                    <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${mode === 'existing' ? 'bg-green-50 border-green-500 shadow-sm' : 'bg-white border-gray-200 hover:border-green-300'}`}>
                        <input 
                            type="radio" 
                            name="batchMode" 
                            checked={mode === 'existing'} 
                            onChange={() => setMode('existing')}
                            className="mt-1 w-4 h-4 text-green-600 focus:ring-green-500"
                        />
                        <div className="flex-1">
                            <div className="flex items-center gap-2 font-bold text-gray-800">
                                <History size={16} className="text-green-600" /> Thêm vào đợt cũ
                            </div>
                            
                            <div className="mt-2 pl-6">
                                <select 
                                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-green-500 outline-none disabled:bg-gray-100 disabled:text-gray-400"
                                    disabled={mode !== 'existing'}
                                    value={selectedExistingBatch}
                                    onChange={(e) => setSelectedExistingBatch(e.target.value)}
                                >
                                    {historyBatches.length > 0 ? (
                                        historyBatches.map((h: any) => (
                                            <option key={`${h.date}_${h.batch}`} value={`${h.date}_${h.batch}`}>
                                                Đợt {h.batch} - Ngày {formatDate(h.date)} (Đã có {h.count} HS)
                                            </option>
                                        ))
                                    ) : (
                                        <option value="">Chưa có đợt nào</option>
                                    )}
                                </select>
                            </div>
                        </div>
                    </label>
                </div>

                <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 font-medium text-sm">
                        Hủy bỏ
                    </button>
                    <button 
                        onClick={handleConfirm} 
                        className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-bold text-sm shadow-sm transition-transform active:scale-95"
                    >
                        <CheckCircle2 size={16} /> Xác nhận
                    </button>
                </div>
            </div>
        </div>
    );
};

// Export Handover Modal Component
interface ExportHandoverModalProps {
    isOpen: boolean;
    onClose: () => void;
    records: ArchiveRecord[];
    wards: string[];
}

const ExportHandoverModal: React.FC<ExportHandoverModalProps> = ({ isOpen, onClose, records, wards }) => {
    const [selectedBatch, setSelectedBatch] = useState<string>('');
    const [selectedGcnType, setSelectedGcnType] = useState<string>('GCN mới');
    const [selectedWard, setSelectedWard] = useState<string>('all');

    const historyBatches = useMemo(() => {
        const batches: Record<string, any> = {};
        records.forEach(r => {
            if (r.data?.is_scanned && r.data?.scan_batch_id && r.data?.scan_date) {
                const datePart = r.data.scan_date.split('T')[0];
                const key = `${datePart}_${r.data.scan_batch_id}`;
                if (!batches[key]) {
                    batches[key] = { date: datePart, batch: parseInt(r.data.scan_batch_id), count: 0, fullDate: r.data.scan_date };
                }
                batches[key].count++;
            }
        });
        return Object.values(batches).sort((a: any, b: any) => b.date.localeCompare(a.date) || b.batch - a.batch);
    }, [records]);

    useEffect(() => {
        if (isOpen && historyBatches.length > 0 && !selectedBatch) {
            const first = historyBatches[0];
            setSelectedBatch(`${first.date}_${first.batch}`);
        }
    }, [isOpen, historyBatches]);

    if (!isOpen) return null;

    const formatDate = (d: string) => {
        const parts = d.split('-');
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    };

    const handleExport = () => {
        if (!selectedBatch) {
            alert('Vui lòng chọn đợt xuất.');
            return;
        }

        const [datePart, batchNumStr] = selectedBatch.split('_');
        const batchNum = parseInt(batchNumStr);
        const batchInfo = historyBatches.find((h: any) => h.date === datePart && h.batch === batchNum);
        
        if (!batchInfo) return;

        // Filter records
        const filtered = records.filter(r => {
            const rBatchId = String(r.data?.scan_batch_id || '');
            const isBatchMatch = r.data?.is_scanned && 
                                 rBatchId === batchNumStr && 
                                 r.data?.scan_date?.startsWith(datePart);
            
            // Default to 'GCN mới' if undefined
            const rType = r.data?.loai_gcn || 'GCN mới';
            const isTypeMatch = rType === selectedGcnType;
            
            const isWardMatch = selectedWard === 'all' || r.data?.dia_danh?.toLowerCase().includes(selectedWard.toLowerCase());
            
            return isBatchMatch && isTypeMatch && isWardMatch;
        });

        if (filtered.length === 0) {
            alert('Không có hồ sơ nào thỏa mãn điều kiện lọc.');
            return;
        }

        // Generate Excel
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([]);

        // Styles
        const styleTitle = { font: { bold: true, sz: 14 }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true } };
        const styleItalicCenter = { font: { italic: true, sz: 11 }, alignment: { horizontal: 'center', vertical: 'center' } };
        const styleHeader = { font: { bold: true }, border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, fill: { fgColor: { rgb: "E0E0E0" } } };
        const styleCell = { border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }, alignment: { vertical: 'center', wrapText: true } };
        const styleCellCenter = { ...styleCell, alignment: { ...styleCell.alignment, horizontal: 'center' } };

        const exportDate = formatDate(datePart);

        // Define Headers and Data Mapping based on GCN Type
        let headers: string[] = [];
        let dataRows: any[][] = [];
        let colWidths: any[] = [];

        if (selectedGcnType === 'GCN trang 4') {
            headers = [
                "STT", "Tên Chủ sử dụng", "Địa danh", "Số phát hành", "Ngày ký GCN", 
                "Mã hồ sơ giao dịch", "Loại hồ sơ", "Ngày chủ SD nhận GCN", 
                "Người nhận GCN ký, ghi họ tên", "Ghi chú"
            ];
            colWidths = [
                { wch: 5 }, { wch: 30 }, { wch: 20 }, { wch: 15 }, { wch: 12 }, 
                { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 20 }
            ];
            dataRows = filtered.map((r, idx) => [
                idx + 1,
                r.data?.ten_chu_su_dung || '',
                r.data?.dia_danh || '',
                r.data?.so_phat_hanh || '',
                r.data?.ngay_ky_gcn ? new Date(r.data.ngay_ky_gcn).toLocaleDateString('vi-VN') : '',
                r.data?.ma_ho_so || '',
                r.data?.loai_bien_dong || '',
                '', // Ngày chủ SD nhận GCN
                '', // Người nhận GCN ký
                r.data?.ghi_chu || ''
            ]);
        } else {
            // GCN mới
            headers = [
                "STT", "Số vào sổ", "Tên chủ sử dụng đất", "Số phát hành", "Ngày ký GCN",
                "Mã hồ sơ giao dịch", "Địa danh", "Ngày nhận GCN", 
                "Người nhận GCN ký, ghi rõ họ tên", "Ghi chú"
            ];
            colWidths = [
                { wch: 5 }, { wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 12 },
                { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 20 }
            ];
            dataRows = filtered.map((r, idx) => [
                idx + 1,
                r.data?.so_vao_so || '',
                r.data?.ten_chu_su_dung || '',
                r.data?.so_phat_hanh || '',
                r.data?.ngay_ky_gcn ? new Date(r.data.ngay_ky_gcn).toLocaleDateString('vi-VN') : '',
                r.data?.ma_ho_so || '',
                r.data?.dia_danh || '',
                '', // Ngày nhận GCN
                '', // Người nhận GCN ký
                r.data?.ghi_chu || ''
            ]);
        }

        // Row 1: Title
        XLSX.utils.sheet_add_aoa(ws, [[
            "DANH SÁCH BÀN GIAO GCNQSD ĐẤT TỪ VPĐKĐĐ SANG\nBỘ PHẬN TIẾP NHẬN VÀ TRẢ KẾT QUẢ"
        ]], { origin: "A1" });
        
        // Merge Title
        if(!ws['!merges']) ws['!merges'] = [];
        ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } });
        ws['A1'].s = styleTitle;

        // Row 2: GCN Type
        const typeCellRef = XLSX.utils.encode_cell({ r: 1, c: headers.length - 1 });
        XLSX.utils.sheet_add_aoa(ws, [[selectedGcnType]], { origin: typeCellRef });
        ws[typeCellRef].s = { font: { bold: true, sz: 12 }, alignment: { horizontal: 'right' } };

        // Row 3: Date - Batch
        XLSX.utils.sheet_add_aoa(ws, [[`Ngày ${exportDate} - Danh sách số ${batchNum}`]], { origin: "A3" });
        ws['!merges'].push({ s: { r: 2, c: 0 }, e: { r: 2, c: headers.length - 1 } });
        ws['A3'].s = styleItalicCenter;

        // Table Header (Row 5)
        XLSX.utils.sheet_add_aoa(ws, [headers], { origin: "A5" });
        headers.forEach((_, i) => {
            const cellRef = XLSX.utils.encode_cell({ r: 4, c: i });
            ws[cellRef].s = styleHeader;
        });

        // Data Rows
        XLSX.utils.sheet_add_aoa(ws, dataRows, { origin: "A6" });

        // Apply styles to data
        dataRows.forEach((row, rIdx) => {
            row.forEach((_, cIdx) => {
                const cellRef = XLSX.utils.encode_cell({ r: 5 + rIdx, c: cIdx });
                if (cIdx === 0) { // STT centered
                    ws[cellRef].s = styleCellCenter;
                } else {
                    ws[cellRef].s = styleCell;
                }
            });
        });

        // Signature Section
        const lastRowIdx = 5 + dataRows.length;
        const sigRowIdx = lastRowIdx + 2; // Leave 1 empty row

        // Người giao (Left)
        XLSX.utils.sheet_add_aoa(ws, [["Người giao"]], { origin: { r: sigRowIdx, c: 0 } });
        ws['!merges'].push({ s: { r: sigRowIdx, c: 0 }, e: { r: sigRowIdx, c: 2 } }); // Merge A-C
        const sigLeftRef = XLSX.utils.encode_cell({ r: sigRowIdx, c: 0 });
        ws[sigLeftRef].s = { font: { bold: true }, alignment: { horizontal: 'center' } };

        // Người nhận (Center)
        XLSX.utils.sheet_add_aoa(ws, [["Người nhận"]], { origin: { r: sigRowIdx, c: 3 } });
        ws['!merges'].push({ s: { r: sigRowIdx, c: 3 }, e: { r: sigRowIdx, c: 5 } }); // Merge D-F
        const sigCenterRef = XLSX.utils.encode_cell({ r: sigRowIdx, c: 3 });
        ws[sigCenterRef].s = { font: { bold: true }, alignment: { horizontal: 'center' } };

        // Giao nhận 1 cửa (Right)
        XLSX.utils.sheet_add_aoa(ws, [["Giao nhận 1 cửa"]], { origin: { r: sigRowIdx, c: 6 } });
        ws['!merges'].push({ s: { r: sigRowIdx, c: 6 }, e: { r: sigRowIdx, c: headers.length - 1 } }); // Merge G-End
        const sigRightRef = XLSX.utils.encode_cell({ r: sigRowIdx, c: 6 });
        ws[sigRightRef].s = { font: { bold: true }, alignment: { horizontal: 'center' } };

        // Column Widths
        ws['!cols'] = colWidths;

        // Row Heights
        ws['!rows'] = [
            { hpt: 40 }, // Title
            { hpt: 20 }, // Subtitle
            { hpt: 20 }, // Date
            { hpt: 10 }, // Spacer
            { hpt: 25 }  // Header
        ];

        XLSX.utils.book_append_sheet(wb, ws, "DanhSachBanGiao");
        XLSX.writeFile(wb, `DanhSachBanGiao_${selectedGcnType.replace(/ /g, '')}_${datePart}_Dot${batchNum}.xlsx`);
        
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md animate-fade-in-up flex flex-col overflow-hidden">
                <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800 text-lg">Xuất Danh Sách Bàn Giao</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-red-500"><X size={20}/></button>
                </div>

                <div className="p-6 space-y-4">
                    {/* Batch Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Chọn Đợt Xuất</label>
                        <select 
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-purple-500"
                            value={selectedBatch}
                            onChange={(e) => setSelectedBatch(e.target.value)}
                        >
                            {historyBatches.map((h: any) => (
                                <option key={`${h.date}_${h.batch}`} value={`${h.date}_${h.batch}`}>
                                    Đợt {h.batch} - Ngày {formatDate(h.date)} ({h.count} HS)
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* GCN Type Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Loại GCN</label>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="radio" 
                                    name="gcnType" 
                                    value="GCN mới" 
                                    checked={selectedGcnType === 'GCN mới'} 
                                    onChange={(e) => setSelectedGcnType(e.target.value)}
                                    className="text-purple-600 focus:ring-purple-500"
                                />
                                <span>GCN mới</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="radio" 
                                    name="gcnType" 
                                    value="GCN trang 4" 
                                    checked={selectedGcnType === 'GCN trang 4'} 
                                    onChange={(e) => setSelectedGcnType(e.target.value)}
                                    className="text-purple-600 focus:ring-purple-500"
                                />
                                <span>GCN trang 4</span>
                            </label>
                        </div>
                    </div>

                    {/* Ward Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Xã/Phường</label>
                        <select 
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-purple-500"
                            value={selectedWard}
                            onChange={(e) => setSelectedWard(e.target.value)}
                        >
                            <option value="all">Tất cả</option>
                            {wards.map(w => (
                                <option key={w} value={w}>{w}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 font-medium text-sm">
                        Hủy bỏ
                    </button>
                    <button 
                        onClick={handleExport} 
                        className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 font-bold text-sm shadow-sm transition-transform active:scale-95"
                    >
                        <FileOutput size={16} /> Xuất Excel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VaoSoView;
