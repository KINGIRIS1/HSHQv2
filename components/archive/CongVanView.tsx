
import React, { useState, useEffect, useMemo } from 'react';
import { User, RecordFile, RecordStatus, Employee } from '../../types';
import { ArchiveRecord, fetchArchiveRecords, saveArchiveRecord, deleteArchiveRecord, updateArchiveRecordsBatch, importArchiveRecords } from '../../services/apiArchive';
import { useArchiveRealtime } from '../../hooks/useArchiveRealtime';
import { fetchEmployees, saveEmployeeApi, fetchUsers, saveUserApi } from '../../services/apiPeople';
import { Search, Plus, ListChecks, FileCheck, Send, Trash2, Edit, Save, X, RotateCcw, Users, User as UserIcon, LayoutGrid, CheckCircle, PenTool, Eye, Calendar, FileDown, FileSpreadsheet } from 'lucide-react';
import { confirmAction, toTitleCase } from '../../utils/appHelpers';
import AssignModal from '../AssignModal';
import ArchiveDetailModal from './ArchiveDetailModal';
import HandoverListModal from './HandoverListModal';
import ExportHandoverModal from './ExportHandoverModal';
import { STATUS_LABELS, STATUS_COLORS } from '../../constants';
import * as XLSX from 'xlsx-js-style';

interface CongVanViewProps {
    currentUser: User;
}

const CongVanView: React.FC<CongVanViewProps> = ({ currentUser }) => {
    const [subTab, setSubTab] = useState<'all' | 'draft' | 'assigned' | 'executed' | 'sign' | 'signed' | 'result'>('all');
    const [records, setRecords] = useState<ArchiveRecord[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false);
    
    // Filters
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [filterEmployee, setFilterEmployee] = useState('');

    // Detail Modal State
    const [detailRecord, setDetailRecord] = useState<ArchiveRecord | null>(null);

    // Assign Modal State
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Handover Modal State
    const [showHandoverModal, setShowHandoverModal] = useState(false);
    const [pendingCompletionRecord, setPendingCompletionRecord] = useState<ArchiveRecord | null>(null);

    // Export Modal State
    const [showExportModal, setShowExportModal] = useState(false);

    const [formData, setFormData] = useState<Partial<ArchiveRecord>>({
        type: 'congvan',
        status: 'draft',
        so_hieu: '',
        trich_yeu: '',
        ngay_thang: new Date().toISOString(),
        noi_nhan_gui: ''
    });
    const [editingId, setEditingId] = useState<string | null>(null);
    
    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useArchiveRealtime('congvan', setRecords);

    useEffect(() => {
        loadData();
        loadEmployees();
    }, []);

    // Tự động bỏ tích và xóa chuỗi tìm kiếm khi người dùng chuyển đổi giữa các tab con
    useEffect(() => {
        setSelectedIds(new Set());
        setSearchTerm('');
    }, [subTab]);

    const loadData = async () => {
        const data = await fetchArchiveRecords('congvan');
        setRecords(data);
    };

    const loadEmployees = async () => {
        const data = await fetchEmployees();
        setEmployees(data);
    };

    const filteredRecords = useMemo(() => {
        let list = records;
        
        if (subTab === 'draft') list = list.filter(r => r.status === 'draft');
        if (subTab === 'assigned') list = list.filter(r => r.status === 'assigned');
        if (subTab === 'executed') list = list.filter(r => r.status === 'executed');
        if (subTab === 'sign') list = list.filter(r => r.status === 'pending_sign');
        if (subTab === 'signed') list = list.filter(r => r.status === 'signed');
        if (subTab === 'result') list = list.filter(r => r.status === 'completed');
        // 'all' shows everything

        // Filter by Date
        if (fromDate) list = list.filter(r => r.ngay_thang >= fromDate);
        if (toDate) list = list.filter(r => r.ngay_thang <= toDate);

        // Filter by Employee
        if (filterEmployee) list = list.filter(r => r.data?.assigned_to === filterEmployee);

        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            list = list.filter(r => 
                (r.so_hieu || '').toLowerCase().includes(lower) ||
                (r.trich_yeu || '').toLowerCase().includes(lower) ||
                (r.noi_nhan_gui || '').toLowerCase().includes(lower)
            );
        }
        return list;
    }, [records, subTab, searchTerm, fromDate, toDate, filterEmployee]);

    // Reset selection and page when tab/filters change
    useEffect(() => {
        setSelectedIds(new Set());
        setCurrentPage(1);
    }, [subTab, searchTerm, fromDate, toDate, filterEmployee]);

    const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            const ab = evt.target?.result;
            const wb = XLSX.read(ab, { type: 'array' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

            // Skip header row
            const rows = data.slice(1);
            const newRecords: Partial<ArchiveRecord>[] = [];
            
            // Get users to link
            const users = await fetchUsers();

            // Helper to get or create employee
            const getOrCreateEmployee = async (name: string): Promise<string> => {
                if (!name) return '';
                const cleanName = toTitleCase(name.trim());
                let emp = employees.find(e => e.name.toLowerCase() === cleanName.toLowerCase());
                
                if (!emp) {
                    // Create new employee
                    const newEmp: Employee = {
                        id: crypto.randomUUID(),
                        name: cleanName,
                        department: 'Bộ phận một cửa',
                        managedWards: []
                    };
                    await saveEmployeeApi(newEmp, false);
                    // Update local state to avoid duplicates in same loop
                    employees.push(newEmp);
                    emp = newEmp;
                }

                // Link to User if exists and not linked
                const user = users.find(u => u.name.toLowerCase() === cleanName.toLowerCase());
                if (user && !user.employeeId) {
                    user.employeeId = emp.id;
                    await saveUserApi(user, true);
                }

                return emp.id;
            };

            for (const row of rows as any[]) {
                // Map columns: 
                // 0: SỐ HIỆU, 1: CƠ QUAN PHÁT HÀNH, 2: NGÀY THÁNG, 3: TRÍCH YẾU
                // 4: NGƯỜI THỰC HIỆN, 5: NGÀY HOÀN THÀNH, 6: DANH SÁCH

                const so_hieu = row[0]?.toString() || '';
                if (!so_hieu) continue;

                // Find employee ID by name if provided
                let assigned_to = '';
                const employeeName = row[4]?.toString();
                if (employeeName) {
                    assigned_to = await getOrCreateEmployee(employeeName);
                }

                // Parse dates (assuming DD/MM/YYYY or Excel serial date)
                const parseExcelDate = (val: any) => {
                    if (!val) return '';
                    
                    let date: Date | null = null;

                    if (typeof val === 'number') {
                        // Excel serial date
                        date = new Date(Math.round((val - 25569) * 86400 * 1000));
                    } else if (typeof val === 'string') {
                        const cleanVal = val.trim();
                        // Check for DD/MM/YYYY
                        if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(cleanVal)) {
                            const [d, m, y] = cleanVal.split('/');
                            date = new Date(Number(y), Number(m) - 1, Number(d));
                        }
                        // Check for DD-MM-YYYY
                        else if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(cleanVal)) {
                            const [d, m, y] = cleanVal.split('-');
                            date = new Date(Number(y), Number(m) - 1, Number(d));
                        }
                        // Check for YYYY-MM-DD
                        else if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(cleanVal)) {
                            date = new Date(cleanVal);
                        }
                    }

                    if (date && !isNaN(date.getTime())) {
                        const y = date.getFullYear();
                        if (y >= 1900 && y <= 2100) {
                            const offset = date.getTimezoneOffset() * 60000;
                            const localDate = new Date(date.getTime() - offset);
                            return localDate.toISOString().split('T')[0];
                        }
                    }
                    return '';
                };

                const ngay_hoan_thanh = parseExcelDate(row[5]);
                const danh_sach = row[6]?.toString() || '';
                
                let status: ArchiveRecord['status'] = 'draft';
                let history: any[] = [];

                // Determine status based on data
                if (ngay_hoan_thanh && danh_sach) {
                    status = 'completed';
                    history.push({
                        action: 'Hoàn thành (Import)',
                        status: 'completed',
                        timestamp: new Date().toISOString(),
                        user: currentUser.name,
                        note: `Đã chuyển vào danh sách: ${danh_sach}`
                    });
                } else if (assigned_to) {
                    status = 'assigned';
                    history.push({
                        action: 'Giao việc (Import)',
                        status: 'assigned',
                        timestamp: new Date().toISOString(),
                        user: currentUser.name
                    });
                }

                newRecords.push({
                    type: 'congvan',
                    status: status,
                    so_hieu: so_hieu,
                    noi_nhan_gui: toTitleCase(row[1]?.toString() || ''),
                    ngay_thang: parseExcelDate(row[2]),
                    trich_yeu: row[3]?.toString() || '',
                    data: {
                        assigned_to: assigned_to,
                        ngay_hoan_thanh: ngay_hoan_thanh,
                        danh_sach: danh_sach,
                        history: history
                    },
                    created_by: currentUser.username,
                    created_at: new Date().toISOString()
                });
            }

            if (newRecords.length > 0) {
                const success = await importArchiveRecords(newRecords);
                if (success) {
                    alert(`Đã import thành công ${newRecords.length} công văn.`);
                    loadData();
                } else {
                    alert('Có lỗi xảy ra khi import.');
                }
            } else {
                alert('Không tìm thấy dữ liệu hợp lệ trong file.');
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleAssign = () => {
        if (selectedIds.size === 0) return;
        setShowAssignModal(true);
    };

    const handleConfirmAssign = async (employeeId: string) => {
        const historyEntry = {
            action: 'Giao việc',
            status: 'assigned',
            timestamp: new Date().toISOString(),
            user: currentUser.name,
            note: `Giao cho nhân viên: ${getEmployeeName(employeeId)}`
        };

        const updates = {
            status: 'assigned' as any,
            data: {
                assigned_to: employeeId,
                assigned_date: new Date().toISOString(),
                history: [historyEntry] // Will be appended by updateArchiveRecordsBatch
            }
        };
        
        await updateArchiveRecordsBatch(Array.from(selectedIds), updates);
        setShowAssignModal(false);
        setSelectedIds(new Set());
        loadData();
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

    // Helper để lấy tên nhân viên từ ID
    const getEmployeeName = (id?: string) => {
        if (!id) return '-';
        const emp = employees.find(e => e.id === id);
        return emp ? emp.name : id;
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.so_hieu || !formData.trich_yeu) { alert('Vui lòng nhập Số hiệu và Trích yếu.'); return; }
        
        const success = await saveArchiveRecord({
            ...formData,
            id: editingId || undefined,
            created_by: currentUser.username
        });

        if (success) {
            await loadData();
            setIsFormOpen(false);
            setEditingId(null);
            setFormData({ type: 'congvan', status: 'draft', so_hieu: '', trich_yeu: '', ngay_thang: new Date().toISOString(), noi_nhan_gui: '' });
        } else {
            alert('Lỗi khi lưu.');
        }
    };

    const handleStatusChange = async (record: ArchiveRecord, newStatus: ArchiveRecord['status']) => {
        // If completing, show modal to select list
        if (newStatus === 'completed') {
            setPendingCompletionRecord(record);
            setShowHandoverModal(true);
            return;
        }

        let confirmMsg = '';
        let actionName = '';
        switch (newStatus) {
            case 'draft': confirmMsg = 'Thu hồi công văn về trạng thái Nháp?'; actionName = 'Thu hồi'; break;
            case 'executed': confirmMsg = 'Xác nhận đã thực hiện xong?'; actionName = 'Thực hiện xong'; break;
            case 'pending_sign': confirmMsg = 'Trình ký công văn này?'; actionName = 'Trình ký'; break;
            case 'signed': confirmMsg = 'Xác nhận đã ký duyệt?'; actionName = 'Ký duyệt'; break;
            default: confirmMsg = 'Chuyển trạng thái?'; actionName = 'Chuyển trạng thái';
        }

        if (await confirmAction(confirmMsg)) {
            const historyEntry = {
                action: actionName,
                status: newStatus,
                timestamp: new Date().toISOString(),
                user: currentUser.name
            };
            
            const oldHistory = Array.isArray(record.data?.history) ? record.data.history : [];
            const newHistory = [...oldHistory, historyEntry];

            await saveArchiveRecord({ 
                ...record, 
                status: newStatus,
                data: { ...record.data, history: newHistory }
            });
            loadData();
        }
    };

    const handleBatchStatusChange = async (newStatus: ArchiveRecord['status']) => {
        if (selectedIds.size === 0) return;

        let confirmMsg = '';
        let actionName = '';
        switch (newStatus) {
            case 'executed': confirmMsg = `Xác nhận đã thực hiện xong ${selectedIds.size} công văn?`; actionName = 'Đã thực hiện'; break;
            case 'pending_sign': confirmMsg = `Trình ký ${selectedIds.size} công văn?`; actionName = 'Trình ký'; break;
            case 'signed': confirmMsg = `Xác nhận đã ký duyệt ${selectedIds.size} công văn?`; actionName = 'Ký duyệt'; break;
            default: return;
        }

        if (await confirmAction(confirmMsg)) {
            const historyEntry = {
                action: actionName,
                status: newStatus,
                timestamp: new Date().toISOString(),
                user: currentUser.name
            };
            
            const updates = {
                status: newStatus as any,
                data: {
                    history: [historyEntry]
                }
            };
            
            await updateArchiveRecordsBatch(Array.from(selectedIds), updates);
            setSelectedIds(new Set());
            loadData();
        }
    };

    const handleConfirmHandover = async (listName: string, handoverDate: string) => {
        if (pendingCompletionRecord) {
            const historyEntry = {
                action: 'Đã giao 1 cửa',
                status: 'completed',
                timestamp: new Date().toISOString(),
                user: currentUser.name,
                note: `Đã chuyển vào danh sách: ${listName}`
            };

            const oldHistory = Array.isArray(pendingCompletionRecord.data?.history) ? pendingCompletionRecord.data.history : [];
            const newHistory = [...oldHistory, historyEntry];

            const updateData: any = { ...pendingCompletionRecord.data, history: newHistory };
            updateData.ngay_hoan_thanh = handoverDate;
            updateData.danh_sach = listName;

            await saveArchiveRecord({ 
                ...pendingCompletionRecord, 
                status: 'completed',
                data: updateData
            });
            
            setPendingCompletionRecord(null);
            loadData();
        } else if (selectedIds.size > 0 && subTab === 'signed') {
            const historyEntry = {
                action: 'Đã giao 1 cửa',
                status: 'completed',
                timestamp: new Date().toISOString(),
                user: currentUser.name,
                note: `Đã chuyển vào danh sách: ${listName}`
            };

            const updates = {
                status: 'completed' as any,
                data: {
                    ngay_hoan_thanh: handoverDate,
                    danh_sach: listName,
                    history: [historyEntry]
                }
            };
            
            await updateArchiveRecordsBatch(Array.from(selectedIds), updates);
            setSelectedIds(new Set());
            loadData();
        }
    };

    const handleDelete = async (id: string) => {
        if (await confirmAction('Xóa công văn này?')) {
            await deleteArchiveRecord(id);
            loadData();
        }
    };

    const handleEdit = (r: ArchiveRecord) => {
        setFormData(r);
        setEditingId(r.id);
        setIsFormOpen(true);
    };

    const mapStatusToEnum = (s: string): RecordStatus => {
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

    const isManager = (currentUser.role as string) === 'ADMIN' || (currentUser.role as string) === 'SUBADMIN' || (currentUser.role as string) === 'admin' || (currentUser.role as string) === 'subadmin';

    const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
    const paginatedRecords = filteredRecords.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <div className="flex flex-col h-full bg-white">
            {/* SUB-HEADER TABS */}
            <div className="flex border-b border-gray-200 bg-gray-50 px-4 overflow-x-auto shrink-0">
                <button 
                    onClick={() => setSubTab('all')} 
                    className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${subTab === 'all' ? 'border-orange-600 text-orange-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <LayoutGrid size={16}/> Tất cả công văn
                </button>
                <button 
                    onClick={() => setSubTab('draft')} 
                    className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${subTab === 'draft' ? 'border-orange-600 text-orange-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <ListChecks size={16}/> Chưa giao
                </button>
                <button 
                    onClick={() => setSubTab('assigned')} 
                    className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${subTab === 'assigned' ? 'border-orange-600 text-orange-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <Users size={16}/> Đang thực hiện
                </button>
                <button 
                    onClick={() => setSubTab('executed')} 
                    className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${subTab === 'executed' ? 'border-orange-600 text-orange-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <CheckCircle size={16}/> Đang thực hiện
                </button>
                <button 
                    onClick={() => setSubTab('sign')} 
                    className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${subTab === 'sign' ? 'border-purple-600 text-purple-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <Send size={16}/> Trình ký
                </button>
                <button 
                    onClick={() => setSubTab('signed')} 
                    className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${subTab === 'signed' ? 'border-teal-600 text-teal-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <PenTool size={16}/> Ký duyệt
                </button>
                <button 
                    onClick={() => setSubTab('result')} 
                    className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${subTab === 'result' ? 'border-green-600 text-green-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <FileCheck size={16}/> Giao 1 cửa
                </button>
            </div>

            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        {subTab === 'all' && 'Tất cả công văn'}
                        {subTab === 'draft' && 'Công văn chưa giao'}
                        {subTab === 'assigned' && 'Công văn đang thực hiện'}
                        {subTab === 'executed' && 'Công văn đã thực hiện'}
                        {subTab === 'sign' && 'Danh sách Trình ký'}
                        {subTab === 'signed' && 'Danh sách Ký duyệt'}
                        {subTab === 'result' && 'Danh sách Đã giao 1 cửa'}
                    </h2>
                    <div className="relative flex-1 sm:w-64 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input 
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" 
                            placeholder="Tìm công văn..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                        />
                    </div>
                </div>

                {/* Filters & Actions */}
                <div className="flex flex-wrap gap-3 items-center bg-gray-50 p-2 rounded-lg border border-gray-100 relative">
                    <div className="flex items-center gap-2 bg-white px-2 py-1.5 rounded-md border border-gray-200 shadow-sm">
                        <Calendar size={16} className="text-gray-500"/>
                        <input type="date" className="text-sm outline-none bg-transparent text-gray-700 w-28" value={fromDate} onChange={e => setFromDate(e.target.value)} placeholder="Từ ngày" />
                        <span className="text-gray-400">-</span>
                        <input type="date" className="text-sm outline-none bg-transparent text-gray-700 w-28" value={toDate} onChange={e => setToDate(e.target.value)} placeholder="Đến ngày" />
                        {(fromDate || toDate) && (<button onClick={() => { setFromDate(''); setToDate(''); }} className="text-gray-400 hover:text-red-500"><X size={14} /></button>)}
                    </div>

                    <div className="flex items-center gap-2 bg-white px-2 py-1.5 rounded-md border border-gray-200 shadow-sm">
                        <Users size={16} className="text-gray-500"/>
                        <select className="text-sm outline-none bg-transparent text-gray-700 font-medium cursor-pointer border-none focus:ring-0 min-w-[120px]" value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)}>
                            <option value="">Tất cả Nhân viên</option>
                            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-2">
                    {subTab === 'assigned' && isManager && selectedIds.size > 0 && (
                        <button onClick={() => handleBatchStatusChange('executed')} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-bold shadow-md transition-all animate-pulse">
                            <CheckCircle size={18}/> Đã thực hiện ({selectedIds.size})
                        </button>
                    )}
                    {subTab === 'executed' && isManager && selectedIds.size > 0 && (
                        <button onClick={() => handleBatchStatusChange('pending_sign')} className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 font-bold shadow-md transition-all animate-pulse">
                            <Send size={18}/> Trình ký ({selectedIds.size})
                        </button>
                    )}
                    {subTab === 'sign' && isManager && selectedIds.size > 0 && (
                        <button onClick={() => handleBatchStatusChange('signed')} className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 font-bold shadow-md transition-all animate-pulse">
                            <PenTool size={18}/> Ký duyệt ({selectedIds.size})
                        </button>
                    )}
                    {subTab === 'signed' && isManager && selectedIds.size > 0 && (
                        <button onClick={() => setShowHandoverModal(true)} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-bold shadow-md transition-all animate-pulse">
                            <FileCheck size={18}/> Đã giao 1 cửa ({selectedIds.size})
                        </button>
                    )}
                    {(subTab === 'draft' || subTab === 'all') && isManager && (
                        <>
                            {selectedIds.size > 0 && (
                                <button onClick={handleAssign} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-bold shadow-md transition-all animate-pulse">
                                    <Users size={18}/> Giao việc ({selectedIds.size})
                                </button>
                            )}
                            <label className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-bold shadow-md transition-all cursor-pointer">
                                <FileSpreadsheet size={18}/> Import Excel
                                <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleImportExcel} />
                            </label>
                            <button onClick={() => { setIsFormOpen(true); setEditingId(null); setFormData({type: 'congvan', status: 'draft', so_hieu: '', trich_yeu: '', ngay_thang: new Date().toISOString(), noi_nhan_gui: ''}); }} className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 font-bold shadow-md transition-all">
                                <Plus size={18}/> Tạo mới
                            </button>
                        </>
                    )}
                    <button onClick={() => setShowExportModal(true)} className="flex items-center gap-2 bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 font-medium shadow-sm transition-all">
                        <FileDown size={18}/> Xuất Bàn Giao
                    </button>
                </div>
            </div>

            {/* CONTENT */}
            <div className="flex-1 overflow-auto p-4 flex gap-4 relative">
                {/* Detail Modal */}
                <ArchiveDetailModal 
                    isOpen={!!detailRecord}
                    onClose={() => setDetailRecord(null)}
                    record={detailRecord}
                    getEmployeeName={getEmployeeName}
                />

                {/* Handover List Modal */}
                <HandoverListModal 
                    isOpen={showHandoverModal}
                    onClose={() => { setShowHandoverModal(false); setPendingCompletionRecord(null); }}
                    onConfirm={handleConfirmHandover}
                    type="congvan"
                />

                {/* Export Handover Modal */}
                <ExportHandoverModal
                    isOpen={showExportModal}
                    onClose={() => setShowExportModal(false)}
                    records={records}
                    type="congvan"
                />

                {/* Assign Modal */}
                <AssignModal 
                    isOpen={showAssignModal}
                    onClose={() => setShowAssignModal(false)}
                    onConfirm={handleConfirmAssign}
                    employees={employees}
                    selectedRecords={records.filter(r => selectedIds.has(r.id)).map(r => ({
                        id: r.id,
                        code: r.so_hieu,
                        customerName: r.noi_nhan_gui,
                        ward: '',
                        status: RecordStatus.RECEIVED
                    } as RecordFile))}
                    filterDepartment="Lưu trữ"
                />

                {isFormOpen && (
                    <div className="w-1/3 min-w-[300px] border-r pr-4 bg-gray-50 p-4 rounded-lg h-full flex flex-col">
                        <h3 className="font-bold text-gray-800 mb-4">{editingId ? 'Cập nhật Công văn' : 'Thêm mới Công văn'}</h3>
                        <form onSubmit={handleSave} className="space-y-3 flex-1 overflow-y-auto">
                            <div><label className="text-xs font-bold text-gray-500 uppercase">Số hiệu</label><input className="w-full border rounded px-3 py-2 text-sm" value={formData.so_hieu} onChange={e => setFormData({...formData, so_hieu: e.target.value})} placeholder="Số CV..." /></div>
                            <div><label className="text-xs font-bold text-gray-500 uppercase">Ngày tháng</label><input type="date" className="w-full border rounded px-3 py-2 text-sm" value={formData.ngay_thang} onChange={e => setFormData({...formData, ngay_thang: e.target.value})} /></div>
                            <div><label className="text-xs font-bold text-gray-500 uppercase">Trích yếu</label><textarea rows={3} className="w-full border rounded px-3 py-2 text-sm" value={formData.trich_yeu} onChange={e => setFormData({...formData, trich_yeu: e.target.value})} placeholder="Nội dung..." /></div>
                            <div><label className="text-xs font-bold text-gray-500 uppercase">Cơ quan phát hành</label><input className="w-full border rounded px-3 py-2 text-sm" value={formData.noi_nhan_gui} onChange={e => setFormData({...formData, noi_nhan_gui: toTitleCase(e.target.value)})} placeholder="Đơn vị..." /></div>
                            
                            {formData.status === 'completed' && (
                                <div className="grid grid-cols-2 gap-3 bg-green-50 p-3 rounded-lg border border-green-200">
                                    <div>
                                        <label className="text-xs font-bold text-green-700 uppercase mb-1 block">Ngày giao</label>
                                        <input type="date" className="w-full border border-green-300 rounded-lg px-2 py-2 text-sm outline-none" value={formData.data?.ngay_hoan_thanh || ''} onChange={e => setFormData({...formData, data: { ...formData.data, ngay_hoan_thanh: e.target.value }})} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-green-700 uppercase mb-1 block">Đợt giao</label>
                                        <input type="text" className="w-full border border-green-300 rounded-lg px-2 py-2 text-sm outline-none" value={formData.data?.danh_sach || ''} onChange={e => setFormData({...formData, data: { ...formData.data, danh_sach: e.target.value }})} placeholder="VD: Đợt 1" />
                                    </div>
                                </div>
                            )}

                            <div className="pt-4 flex gap-2 justify-end">
                                <button type="button" onClick={() => setIsFormOpen(false)} className="px-3 py-2 text-gray-600 hover:bg-gray-200 rounded text-sm">Hủy</button>
                                <button type="submit" className="px-4 py-2 bg-orange-600 text-white rounded font-bold text-sm hover:bg-orange-700 flex items-center gap-1"><Save size={16}/> Lưu</button>
                            </div>
                        </form>
                    </div>
                )}

                <div className="flex-1 overflow-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-100 text-xs font-bold text-gray-600 uppercase sticky top-0 shadow-sm z-10">
                            <tr>
                                <th className="p-3 w-10 text-center">
                                    <input type="checkbox" onChange={handleSelectAll} checked={filteredRecords.length > 0 && selectedIds.size === filteredRecords.length} />
                                </th>
                                <th className="p-3 w-10 text-center">#</th>
                                <th className="p-3 w-32 text-center">Số hiệu</th>
                                <th className="p-3 w-28 text-center">Ngày</th>
                                <th className="p-3 w-64 text-center">Trích yếu</th>
                                <th className="p-3 w-40 text-center">Cơ quan phát hành</th>
                                {(subTab === 'all') && <th className="p-3 w-32 text-center">Trạng thái</th>}
                                {(subTab !== 'draft') && <th className="p-3 w-48 text-center">Người thực hiện</th>}
                                {(subTab === 'all') && <th className="p-3 w-32 text-center">Ngày giao</th>}
                                <th className="p-3 w-32 text-center">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-gray-100">
                            {paginatedRecords.length > 0 ? paginatedRecords.map((r, idx) => (
                                <tr key={r.id} className={`hover:bg-orange-50/30 group ${selectedIds.has(r.id) ? 'bg-orange-50' : ''}`}>
                                    <td className="p-3 text-center">
                                        <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => handleSelectRow(r.id)} />
                                    </td>
                                    <td className="p-3 text-center text-gray-500">{(currentPage - 1) * itemsPerPage + idx + 1}</td>
                                    <td className="p-3 font-bold text-orange-600 cursor-pointer hover:underline" onClick={() => setDetailRecord(r)}>{r.so_hieu}</td>
                                    <td className="p-3 text-gray-600">{r.ngay_thang?.split('-').reverse().join('/')}</td>
                                    <td className="p-3 text-gray-800">{r.trich_yeu}</td>
                                    <td className="p-3 text-gray-600">{toTitleCase(r.noi_nhan_gui)}</td>
                                    {(subTab === 'all') && (
                                        <td className="p-3 text-center">
                                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${STATUS_COLORS[mapStatusToEnum(r.status)]}`}>
                                                {STATUS_LABELS[mapStatusToEnum(r.status)]}
                                            </span>
                                        </td>
                                    )}
                                    {(subTab !== 'draft') && (
                                        <td className="p-3 text-indigo-600 font-medium">
                                            {r.data?.assigned_to ? (
                                                <div className="flex items-center gap-1">
                                                    <UserIcon size={14}/> {getEmployeeName(r.data?.assigned_to)}
                                                </div>
                                            ) : null}
                                        </td>
                                    )}
                                    {(subTab === 'all') && (
                                        <td className="p-3 text-center">
                                            <div className="text-gray-600 font-medium">{r.data?.ngay_hoan_thanh ? r.data.ngay_hoan_thanh.split('-').reverse().join('/') : ''}</div>
                                        </td>
                                    )}
                                    <td className="p-3 text-center">
                                        <div className="flex justify-center gap-1">
                                            <button onClick={() => setDetailRecord(r)} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded" title="Xem chi tiết"><Eye size={14}/></button>
                                            {r.status === 'draft' && isManager && (
                                                <button onClick={() => { setSelectedIds(new Set([r.id])); setShowAssignModal(true); }} className="p-1.5 text-indigo-600 bg-indigo-50 rounded hover:bg-indigo-100" title="Giao việc"><Users size={14}/></button>
                                            )}
                                            {r.status === 'assigned' && isManager && (
                                                <>
                                                    <button onClick={() => handleStatusChange(r, 'draft')} className="p-1.5 text-orange-600 bg-orange-50 rounded hover:bg-orange-100" title="Thu hồi"><RotateCcw size={14}/></button>
                                                    <button onClick={() => handleStatusChange(r, 'executed')} className="p-1.5 text-blue-600 bg-blue-50 rounded hover:bg-blue-100" title="Đã thực hiện"><CheckCircle size={14}/></button>
                                                </>
                                            )}
                                            {r.status === 'executed' && isManager && (
                                                <>
                                                    <button onClick={() => handleStatusChange(r, 'assigned')} className="p-1.5 text-orange-600 bg-orange-50 rounded hover:bg-orange-100" title="Quay lại"><RotateCcw size={14}/></button>
                                                    <button onClick={() => handleStatusChange(r, 'pending_sign')} className="p-1.5 text-purple-600 bg-purple-50 rounded hover:bg-purple-100" title="Trình ký"><Send size={14}/></button>
                                                </>
                                            )}
                                            {r.status === 'pending_sign' && isManager && (
                                                <>
                                                    <button onClick={() => handleStatusChange(r, 'executed')} className="p-1.5 text-orange-600 bg-orange-50 rounded hover:bg-orange-100" title="Trả lại"><RotateCcw size={14}/></button>
                                                    <button onClick={() => handleStatusChange(r, 'signed')} className="p-1.5 text-teal-600 bg-teal-50 rounded hover:bg-teal-100" title="Ký duyệt"><PenTool size={14}/></button>
                                                </>
                                            )}
                                            {r.status === 'signed' && isManager && (
                                                <>
                                                    <button onClick={() => handleStatusChange(r, 'pending_sign')} className="p-1.5 text-orange-600 bg-orange-50 rounded hover:bg-orange-100" title="Trả lại"><RotateCcw size={14}/></button>
                                                    <button onClick={() => handleStatusChange(r, 'completed')} className="p-1.5 text-green-600 bg-green-50 rounded hover:bg-green-100" title="Đã giao 1 cửa"><FileCheck size={14}/></button>
                                                </>
                                            )}
                                            
                                            {isManager && (
                                                <>
                                                    <button onClick={() => handleEdit(r)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Sửa"><Edit size={14}/></button>
                                                    <button onClick={() => handleDelete(r.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="Xóa"><Trash2 size={14}/></button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan={(subTab !== 'draft') ? 10 : 9} className="p-8 text-center text-gray-400 italic">Không có dữ liệu</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="p-3 border-t border-gray-200 flex items-center justify-between bg-gray-50 shrink-0">
                        <span className="text-xs text-gray-500 font-medium">
                            Hiển thị {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredRecords.length)} / {filteredRecords.length} hồ sơ
                        </span>
                        <div className="flex gap-1">
                            <button 
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-2 py-1 rounded border border-gray-300 bg-white text-xs disabled:opacity-50 hover:bg-gray-100"
                            >
                                Trước
                            </button>
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let p = i + 1;
                                if (totalPages > 5) {
                                    if (currentPage > 3) p = currentPage - 2 + i;
                                    if (p > totalPages) p = totalPages - (4 - i);
                                    if (p < 1) p = i + 1;
                                }
                                return (
                                    <button
                                        key={p}
                                        onClick={() => setCurrentPage(p)}
                                        className={`px-2 py-1 rounded border text-xs font-medium min-w-[24px] ${currentPage === p ? 'bg-orange-600 text-white border-orange-600' : 'border-gray-300 bg-white hover:bg-gray-100 text-gray-600'}`}
                                    >
                                        {p}
                                    </button>
                                );
                            })}
                            <button 
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="px-2 py-1 rounded border border-gray-300 bg-white text-xs disabled:opacity-50 hover:bg-gray-100"
                            >
                                Sau
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CongVanView;
