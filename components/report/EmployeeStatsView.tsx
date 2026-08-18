
import React, { useState, useMemo } from 'react';
import { RecordFile, Employee, RecordStatus, User } from '../../types';
import { generateEmployeeEvaluation } from '../../services/geminiService';
import { User as UserIcon, AlertOctagon, Sparkles, Loader2, ListFilter, CheckCircle2, Clock, AlertTriangle, Briefcase, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { STATUS_LABELS } from '../../constants';
import { cleanSyncNotes } from '../../utils/appHelpers';

interface EmployeeStatsViewProps {
    records: RecordFile[];
    employees: Employee[];
    fromDate: string;
    toDate: string;
    selectedEmpId: string;
    setSelectedEmpId: (id: string) => void;
    defaultDeptFilter?: 'all' | 'archive' | 'onedoor' | 'measurement';
    currentUser?: User;
}

const EmployeeStatsView: React.FC<EmployeeStatsViewProps> = ({ 
    records, employees, fromDate, toDate, selectedEmpId, setSelectedEmpId, defaultDeptFilter = 'all', currentUser
}) => {
    const [aiEvaluation, setAiEvaluation] = useState<string>('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [deptFilter, setDeptFilter] = useState<'all' | 'archive' | 'onedoor' | 'measurement'>(defaultDeptFilter);

    const isRegularEmployee = currentUser && (currentUser.role === 'EMPLOYEE' || currentUser.role === 'ONEDOOR');

    // Synchronize deptFilter if defaultDeptFilter changes
    React.useEffect(() => {
        if (defaultDeptFilter) {
            setDeptFilter(defaultDeptFilter);
        }
    }, [defaultDeptFilter]);

    // Filter employees by department (separating One-Door from Archive)
    const filteredEmployeesByDept = useMemo(() => {
        return employees.filter(emp => {
            const d = (emp.department || '').toLowerCase();
            if (deptFilter === 'archive') {
                return d.includes('lưu trữ') && !d.includes('một cửa') && !d.includes('hành chính');
            }
            if (deptFilter === 'onedoor') {
                return d.includes('một cửa') || d.includes('hành chính');
            }
            if (deptFilter === 'measurement') {
                return d.includes('đo đạc') || d.includes('kỹ thuật');
            }
            return true;
        });
    }, [employees, deptFilter]);

    // Filter records by date range first
    const recordsInTimeRange = useMemo(() => {
        const start = new Date(fromDate); start.setHours(0,0,0,0);
        const end = new Date(toDate); end.setHours(23,59,59,999);
        return records.filter(r => {
            if (!r.receivedDate) return false;
            const rDate = new Date(r.receivedDate);
            return rDate >= start && rDate <= end;
        });
    }, [records, fromDate, toDate]);

    // Calculate Stats (Used for AI and Lists, visual cards are handled by parent ReportSection)
    const stats = useMemo(() => {
        const emp = selectedEmpId ? employees.find(e => e.id === selectedEmpId) : null;
        const pos = emp ? (emp.position || '').toLowerCase() : '';
        const isSelectedSupervisor = pos.includes('tổ trưởng') || pos.includes('tổ phó') || pos.includes('trưởng') || pos.includes('phó') || pos.includes('giám đốc') || pos.includes('lãnh đạo');

        const today = new Date(); today.setHours(0,0,0,0);
        let completedCount = 0;
        let processingCount = 0;
        let overduePendingCount = 0;
        let overdueCompletedCount = 0;
        
        const overdueRecords: { record: RecordFile, daysOver: number }[] = [];

        if (selectedEmpId && isSelectedSupervisor && emp) {
            const empDept = (emp.department || '').toLowerCase();
            const isArchiveEmp = empDept.includes('lưu trữ');
            const isMeasurementEmp = empDept.includes('đo đạc') || empDept.includes('kỹ thuật');

            // 1. Records checked by them
            const checkedRecords = recordsInTimeRange.filter(r => r.checkedBy === selectedEmpId);
            checkedRecords.forEach(r => {
                completedCount++;
                if (r.deadline && r.checkedDate) {
                    const d = new Date(r.deadline); d.setHours(0,0,0,0);
                    const c = new Date(r.checkedDate); c.setHours(0,0,0,0);
                    if (c > d) overdueCompletedCount++;
                } else if (r.pendingCheckDate && r.checkedDate) {
                    const p = new Date(r.pendingCheckDate);
                    const c = new Date(r.checkedDate);
                    const diff = c.getTime() - p.getTime();
                    if (diff > 2 * 24 * 60 * 60 * 1000) overdueCompletedCount++;
                }
            });

            // 2. Records assigned to them but not checked by themselves (to avoid double count)
            const assignedRecords = recordsInTimeRange.filter(r => r.assignedTo === selectedEmpId && r.checkedBy !== selectedEmpId);
            assignedRecords.forEach(r => {
                const isFinished = [
                    RecordStatus.HANDOVER, 
                    RecordStatus.RETURNED, 
                    RecordStatus.WITHDRAWN, 
                    RecordStatus.SIGNED
                ].includes(r.status) || !!r.exportBatch || !!r.exportDate;

                if (isFinished) {
                    completedCount++;
                    if (r.deadline && r.completedDate) {
                        const d = new Date(r.deadline); d.setHours(0,0,0,0);
                        const c = new Date(r.completedDate); c.setHours(0,0,0,0);
                        if (c > d) overdueCompletedCount++;
                    }
                } else {
                    processingCount++;
                    if (r.deadline) {
                        const d = new Date(r.deadline); d.setHours(0,0,0,0);
                        if (today > d) {
                            overduePendingCount++;
                            const diffTime = today.getTime() - d.getTime();
                            const daysOver = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                            overdueRecords.push({ record: r, daysOver });
                        }
                    }
                }
            });

            // 3. Records currently pending check in their department (not yet checked by them)
            const pendingCheckRecords = recordsInTimeRange.filter(r => 
                r.status === RecordStatus.PENDING_CHECK && 
                (!r.checkedBy || r.checkedBy === selectedEmpId)
            );
            pendingCheckRecords.forEach(r => {
                const recordDept = (r.recordType || '').toLowerCase();
                const isArchiveRecord = recordDept.includes('sao lục') || recordDept.includes('công văn') || recordDept.includes('vào sổ');
                const isMatch = (isArchiveRecord && isArchiveEmp) || (!isArchiveRecord && isMeasurementEmp);

                if (isMatch) {
                    processingCount++;
                    if (r.deadline) {
                        const d = new Date(r.deadline); d.setHours(0,0,0,0);
                        if (today > d) {
                            overduePendingCount++;
                            const diffTime = today.getTime() - d.getTime();
                            const daysOver = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                            overdueRecords.push({ record: r, daysOver });
                        }
                    } else if (r.pendingCheckDate) {
                        const p = new Date(r.pendingCheckDate); p.setHours(0,0,0,0);
                        if (today > p) {
                            overduePendingCount++;
                            const diffTime = today.getTime() - p.getTime();
                            const daysOver = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                            overdueRecords.push({ record: r, daysOver });
                        }
                    }
                }
            });
        } else {
            const targetRecords = selectedEmpId 
                ? recordsInTimeRange.filter(r => r.assignedTo === selectedEmpId)
                : recordsInTimeRange;

            targetRecords.forEach(r => {
                // Xác định đã xong hay chưa
                const isFinished = [
                    RecordStatus.HANDOVER, 
                    RecordStatus.RETURNED, 
                    RecordStatus.WITHDRAWN, 
                    RecordStatus.SIGNED
                ].includes(r.status) || !!r.exportBatch || !!r.exportDate;

                if (isFinished) {
                    completedCount++;
                    if (r.deadline && r.completedDate) {
                        const d = new Date(r.deadline); d.setHours(0,0,0,0);
                        const c = new Date(r.completedDate); c.setHours(0,0,0,0);
                        if (c > d) overdueCompletedCount++;
                    }
                } else {
                    processingCount++;
                    if (r.deadline) {
                        const d = new Date(r.deadline); d.setHours(0,0,0,0);
                        if (today > d) {
                            overduePendingCount++;
                            const diffTime = today.getTime() - d.getTime();
                            const daysOver = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                            overdueRecords.push({ record: r, daysOver });
                        }
                    }
                }
            });
        }

        const total = completedCount + processingCount;

        overdueRecords.sort((a, b) => b.daysOver - a.daysOver);
        const longestOverdue = overdueRecords.length > 0 ? overdueRecords[0] : null;
        const longOverdueList = overdueRecords.filter(item => item.daysOver > 10);

        return {
            total,
            completedCount,
            processingCount,
            overduePendingCount,
            overdueCompletedCount,
            longestOverdue,
            longOverdueList,
            totalOverdue: overduePendingCount + overdueCompletedCount
        };
    }, [recordsInTimeRange, selectedEmpId, employees]);

    // Summary table for all employees when no specific employee is selected
    const employeeSummaryList = useMemo(() => {
        const today = new Date(); today.setHours(0,0,0,0);

        return filteredEmployeesByDept.map(emp => {
            const pos = (emp.position || '').toLowerCase();
            const isSupervisor = pos.includes('tổ trưởng') || pos.includes('tổ phó') || pos.includes('trưởng') || pos.includes('phó') || pos.includes('giám đốc') || pos.includes('lãnh đạo');

            if (isSupervisor) {
                const checkedRecords = recordsInTimeRange.filter(r => r.checkedBy === emp.id);
                const assignedRecords = recordsInTimeRange.filter(r => r.assignedTo === emp.id && r.checkedBy !== emp.id);
                
                let completed = 0;
                let processing = 0;
                let overdueCompleted = 0;
                let overduePending = 0;

                // Process Checked Records
                checkedRecords.forEach(r => {
                    completed++;
                    if (r.deadline && r.checkedDate) {
                        const d = new Date(r.deadline); d.setHours(0,0,0,0);
                        const c = new Date(r.checkedDate); c.setHours(0,0,0,0);
                        if (c > d) overdueCompleted++;
                    } else if (r.pendingCheckDate && r.checkedDate) {
                        const p = new Date(r.pendingCheckDate);
                        const c = new Date(r.checkedDate);
                        const diff = c.getTime() - p.getTime();
                        if (diff > 2 * 24 * 60 * 60 * 1000) overdueCompleted++;
                    }
                });

                // Process Assigned Records
                assignedRecords.forEach(r => {
                    const isFinished = [
                        RecordStatus.HANDOVER, 
                        RecordStatus.RETURNED, 
                        RecordStatus.WITHDRAWN, 
                        RecordStatus.SIGNED
                    ].includes(r.status) || !!r.exportBatch || !!r.exportDate;

                    if (isFinished) {
                        completed++;
                        if (r.deadline && r.completedDate) {
                            const d = new Date(r.deadline); d.setHours(0,0,0,0);
                            const c = new Date(r.completedDate); c.setHours(0,0,0,0);
                            if (c > d) overdueCompleted++;
                        }
                    } else {
                        processing++;
                        if (r.deadline) {
                            const d = new Date(r.deadline); d.setHours(0,0,0,0);
                            if (today > d) overduePending++;
                        }
                    }
                });

                // Add currently pending check records
                const empDept = (emp.department || '').toLowerCase();
                const isArchiveEmp = empDept.includes('lưu trữ');
                const isMeasurementEmp = empDept.includes('đo đạc') || empDept.includes('kỹ thuật');

                const pendingCheckRecords = recordsInTimeRange.filter(r => 
                    r.status === RecordStatus.PENDING_CHECK && 
                    (!r.checkedBy || r.checkedBy === emp.id)
                );

                pendingCheckRecords.forEach(r => {
                    const recordDept = (r.recordType || '').toLowerCase();
                    const isArchiveRecord = recordDept.includes('sao lục') || recordDept.includes('công văn') || recordDept.includes('vào sổ');
                    const isMatch = (isArchiveRecord && isArchiveEmp) || (!isArchiveRecord && isMeasurementEmp);
                    
                    if (isMatch) {
                        processing++;
                        if (r.deadline) {
                            const d = new Date(r.deadline); d.setHours(0,0,0,0);
                            if (today > d) overduePending++;
                        } else if (r.pendingCheckDate) {
                            const p = new Date(r.pendingCheckDate); p.setHours(0,0,0,0);
                            if (today > p) overduePending++;
                        }
                    }
                });

                const totalAssigned = completed + processing;

                return {
                    employee: emp,
                    totalAssigned,
                    completed,
                    processing,
                    overdueCompleted,
                    overduePending,
                    isSupervisor: true
                };
            } else {
                const empRecords = recordsInTimeRange.filter(r => r.assignedTo === emp.id);
                const totalAssigned = empRecords.length;

                let completed = 0;
                let processing = 0;
                let overdueCompleted = 0;
                let overduePending = 0;

                empRecords.forEach(r => {
                    const isFinished = [
                        RecordStatus.HANDOVER, 
                        RecordStatus.RETURNED, 
                        RecordStatus.WITHDRAWN, 
                        RecordStatus.SIGNED
                    ].includes(r.status) || !!r.exportBatch || !!r.exportDate;

                    if (isFinished) {
                        completed++;
                        if (r.deadline && r.completedDate) {
                            const d = new Date(r.deadline); d.setHours(0,0,0,0);
                            const c = new Date(r.completedDate); c.setHours(0,0,0,0);
                            if (c > d) overdueCompleted++;
                        }
                    } else {
                        processing++;
                        if (r.deadline) {
                            const d = new Date(r.deadline); d.setHours(0,0,0,0);
                            if (today > d) overduePending++;
                        }
                    }
                });

                return {
                    employee: emp,
                    totalAssigned,
                    completed,
                    processing,
                    overdueCompleted,
                    overduePending,
                    isSupervisor: false
                };
            }
        }).sort((a, b) => b.totalAssigned - a.totalAssigned);
    }, [filteredEmployeesByDept, recordsInTimeRange]);

    const handleExportSummaryExcel = () => {
        const dataToExport = employeeSummaryList.map((item, idx) => ({
            'STT': idx + 1,
            'Tên cán bộ': item.employee.name,
            'Phòng / Tổ': item.employee.department || 'Tổ chuyên môn',
            'Hồ sơ giao': item.totalAssigned,
            'Đã xong': item.completed,
            'Đang xử lý': item.processing,
            'Trễ đã xong': item.overdueCompleted,
            'Trễ chưa xong': item.overduePending
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        ws['!cols'] = [
            { wch: 5 },
            { wch: 25 },
            { wch: 20 },
            { wch: 12 },
            { wch: 12 },
            { wch: 12 },
            { wch: 12 },
            { wch: 12 }
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "ThongKeNhanVien");
        XLSX.writeFile(wb, `Bao_Cao_Thong_Ke_Nhan_Vien_${fromDate}_${toDate}.xlsx`);
    };

    const handleGenerateReview = async () => {
        if (!stats || !selectedEmpId) return;
        setIsGenerating(true);
        const emp = employees.find(e => e.id === selectedEmpId);
        let empName = emp ? emp.name : "Nhân viên";
        
        const pos = emp ? (emp.position || '').toLowerCase() : '';
        const isSupervisor = pos.includes('tổ trưởng') || pos.includes('tổ phó') || pos.includes('trưởng') || pos.includes('phó') || pos.includes('giám đốc') || pos.includes('lãnh đạo');
        
        if (emp && emp.position) {
            empName += ` (${emp.position})`;
        }
        if (isSupervisor) {
            empName += " - Vai trò: Kiểm duyệt & Thẩm định";
        }
        
        const badRecordsSimple = stats.longOverdueList.map(i => ({
            code: i.record.code,
            customer: i.record.customerName,
            daysOverdue: i.daysOver
        }));

        const aiStats = {
            total: stats.total,
            onTime: stats.completedCount - stats.overdueCompletedCount,
            approaching: 0, 
            overdue: stats.overduePendingCount,
            onTimeRate: stats.total > 0 ? (((stats.completedCount - stats.overdueCompletedCount) / stats.total) * 100).toFixed(1) : 0
        };

        const result = await generateEmployeeEvaluation(
            empName,
            aiStats,
            badRecordsSimple,
            fromDate === '1970-01-01' ? `Toàn bộ thời gian đến ${new Date(toDate).toLocaleDateString('vi-VN')}` : `Từ ${new Date(fromDate).toLocaleDateString('vi-VN')} đến ${new Date(toDate).toLocaleDateString('vi-VN')}`
        );
        
        setAiEvaluation(result);
        setIsGenerating(false);
    };

    const handleExportEmployeeRecords = () => {
        if (!selectedEmpId) return;
        
        const emp = employees.find(e => e.id === selectedEmpId);
        const empName = emp ? emp.name : "NhanVien";
        
        const pos = emp ? (emp.position || '').toLowerCase() : '';
        const isSupervisor = pos.includes('tổ trưởng') || pos.includes('tổ phó') || pos.includes('trưởng') || pos.includes('phó') || pos.includes('giám đốc') || pos.includes('lãnh đạo');

        let targetRecords: RecordFile[] = [];
        if (emp && isSupervisor) {
            const empDept = (emp.department || '').toLowerCase();
            const isArchiveEmp = empDept.includes('lưu trữ');
            const isMeasurementEmp = empDept.includes('đo đạc') || empDept.includes('kỹ thuật');

            const checked = recordsInTimeRange.filter(r => r.checkedBy === selectedEmpId);
            const assigned = recordsInTimeRange.filter(r => r.assignedTo === selectedEmpId && r.checkedBy !== selectedEmpId);
            const pending = recordsInTimeRange.filter(r => {
                if (r.status !== RecordStatus.PENDING_CHECK) return false;
                if (r.checkedBy && r.checkedBy !== selectedEmpId) return false;
                
                const recordDept = (r.recordType || '').toLowerCase();
                const isArchiveRecord = recordDept.includes('sao lục') || recordDept.includes('công văn') || recordDept.includes('vào sổ');
                return (isArchiveRecord && isArchiveEmp) || (!isArchiveRecord && isMeasurementEmp);
            });

            const uniqueMap = new Map<string, RecordFile>();
            [...checked, ...assigned, ...pending].forEach(r => uniqueMap.set(r.id, r));
            targetRecords = Array.from(uniqueMap.values());
        } else {
            targetRecords = recordsInTimeRange.filter(r => r.assignedTo === selectedEmpId);
        }
        
        if (targetRecords.length === 0) {
            alert("Không có hồ sơ nào trong khoảng thời gian này.");
            return;
        }

        const dataToExport = targetRecords.map((r, idx) => ({
            'STT': idx + 1,
            'Mã hồ sơ': r.code,
            'Tên khách hàng': r.customerName,
            'Địa chỉ': r.address,
            'Xã/Phường': r.ward,
            'Ngày nhận': r.receivedDate ? new Date(r.receivedDate).toLocaleDateString('vi-VN') : '',
            'Hẹn trả': r.deadline ? new Date(r.deadline).toLocaleDateString('vi-VN') : '',
            'Ngày xong': r.completedDate ? new Date(r.completedDate).toLocaleDateString('vi-VN') : '',
            'Trạng thái': STATUS_LABELS[r.status] || r.status,
            'Ghi chú': cleanSyncNotes(r.notes || r.content) || ''
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        
        // Auto-width columns
        const wscols = [
            { wch: 5 }, // STT
            { wch: 15 }, // Ma HS
            { wch: 25 }, // Ten KH
            { wch: 30 }, // Dia chi
            { wch: 15 }, // Xa
            { wch: 12 }, // Ngay nhan
            { wch: 12 }, // Hen tra
            { wch: 12 }, // Ngay xong
            { wch: 15 }, // Trang thai
            { wch: 30 }  // Ghi chu
        ];
        ws['!cols'] = wscols;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "DanhSachHoSo");
        
        const fileName = `DS_HoSo_${empName}_${fromDate}_${toDate}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    return (
        <div className="flex flex-col h-full bg-slate-100 p-6 overflow-y-auto">
            
            {/* 1. EMPLOYEE FILTER & TITLE */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row items-center gap-4 shrink-0">
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100">
                        <Briefcase size={20} />
                    </div>
                    <div>
                        <h4 className="font-bold text-gray-800 text-sm uppercase">Thống kê chi tiết</h4>
                        <p className="text-xs text-gray-500">Chọn nhân viên để xem hiệu suất làm việc</p>
                    </div>
                </div>
                
                <div className="flex-1 w-full flex gap-2">
                    <div className="relative flex-1">
                        <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <select 
                            className={`w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm font-bold text-gray-700 outline-none transition-shadow shadow-sm ${isRegularEmployee ? 'bg-slate-100 cursor-not-allowed opacity-90' : 'focus:ring-2 focus:ring-indigo-500 cursor-pointer hover:border-indigo-300 bg-white'}`}
                            value={selectedEmpId}
                            disabled={Boolean(isRegularEmployee)}
                            onChange={(e) => { setSelectedEmpId(e.target.value); setAiEvaluation(''); }}
                        >
                            {!isRegularEmployee && <option value="">-- Tổng hợp tất cả nhân viên --</option>}
                            {filteredEmployeesByDept.map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.name} - {emp.department}</option>
                            ))}
                            {isRegularEmployee && currentUser?.employeeId && !filteredEmployeesByDept.some(e => e.id === currentUser.employeeId) && (
                                <option value={currentUser.employeeId}>
                                    {employees.find(e => e.id === currentUser.employeeId)?.name || currentUser.name}
                                </option>
                            )}
                        </select>
                    </div>
                    {/* Single shared Excel button is on top toolbar */}
                </div>
            </div>

            {/* 2. DETAILED CONTENT */}
            {selectedEmpId ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in-up flex-1 min-h-0">
                    
                    {/* LEFT COL: PROBLEM RECORDS */}
                    <div className="space-y-4 flex flex-col h-full overflow-hidden">
                        {/* Top Problem Card */}
                        <div className="bg-white p-5 rounded-xl border border-red-100 shadow-sm relative overflow-hidden shrink-0">
                            <div className="absolute top-0 right-0 p-4 opacity-5"><AlertOctagon size={100} className="text-red-500" /></div>
                            <h4 className="font-bold text-red-700 flex items-center gap-2 mb-3 uppercase text-xs tracking-wider">
                                <AlertOctagon size={16}/> Hồ sơ tồn đọng lâu nhất
                            </h4>
                            {stats.longestOverdue ? (
                                <div className="bg-red-50 rounded-lg p-3 border border-red-100">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="text-xl font-black text-red-800">{stats.longestOverdue.record.code}</div>
                                        <div className="bg-white text-red-600 px-2 py-1 rounded border border-red-200 text-xs font-bold shadow-sm">
                                            Trễ {stats.longestOverdue.daysOver} ngày
                                        </div>
                                    </div>
                                    <div className="text-gray-800 font-bold text-sm mb-1">{stats.longestOverdue.record.customerName}</div>
                                    <div className="text-xs text-gray-500 flex gap-3">
                                        <span>Ngày nhận: {new Date(stats.longestOverdue.record.receivedDate!).toLocaleDateString('vi-VN')}</span>
                                        <span>Hẹn trả: <span className="text-red-600 font-bold">{new Date(stats.longestOverdue.record.deadline!).toLocaleDateString('vi-VN')}</span></span>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 text-green-600 py-4 bg-green-50 rounded-lg justify-center border border-green-100">
                                    <CheckCircle2 size={24} />
                                    <span className="font-bold text-sm">Tuyệt vời! Không có hồ sơ nào trễ hạn.</span>
                                </div>
                            )}
                        </div>

                        {/* List of Long Overdue */}
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
                            <div className="p-3 bg-gray-50 border-b border-gray-200 shrink-0">
                                <h4 className="font-bold text-gray-700 text-xs uppercase flex items-center gap-2">
                                    <ListFilter size={14} /> Danh sách trễ hạn nguy cấp ({'>'}10 ngày)
                                </h4>
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                {stats.longOverdueList.length > 0 ? (
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-white text-gray-500 font-medium text-xs uppercase sticky top-0 shadow-sm z-10">
                                            <tr>
                                                <th className="p-3 bg-gray-50 w-24">Mã HS</th>
                                                <th className="p-3 bg-gray-50">Khách hàng</th>
                                                <th className="p-3 bg-gray-50 text-center w-20">Số ngày</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {stats.longOverdueList.map((item, idx) => (
                                                <tr key={idx} className="hover:bg-red-50 transition-colors">
                                                    <td className="p-3 font-bold text-blue-600 text-xs">{item.record.code}</td>
                                                    <td className="p-3 text-gray-700 font-medium">{item.record.customerName}</td>
                                                    <td className="p-3 text-center">
                                                        <span className="inline-block px-2 py-0.5 rounded bg-red-100 text-red-700 font-bold text-xs">
                                                            {item.daysOver}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm italic p-6">
                                        <p>Không có hồ sơ nào trễ quá 10 ngày.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COL: AI ANALYSIS */}
                    <div className="flex flex-col bg-white rounded-xl border border-indigo-200 shadow-sm h-full overflow-hidden">
                        <div className="p-4 bg-indigo-50 border-b border-indigo-100 flex justify-between items-center shrink-0">
                            <h4 className="font-bold text-indigo-800 flex items-center gap-2 text-sm uppercase">
                                <Sparkles size={16} className="text-indigo-600"/> Đánh giá hiệu quả (AI)
                            </h4>
                            <button 
                                onClick={handleGenerateReview} 
                                disabled={isGenerating}
                                className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-700 flex items-center gap-1 disabled:opacity-50 transition-all shadow-sm active:scale-95"
                            >
                                {isGenerating ? <Loader2 className="animate-spin" size={14}/> : <Sparkles size={14}/>} 
                                {aiEvaluation ? 'Phân tích lại' : 'Phân tích ngay'}
                            </button>
                        </div>
                        <div className="p-6 flex-1 bg-white overflow-y-auto custom-scrollbar">
                            {aiEvaluation ? (
                                <div 
                                    className="prose prose-sm max-w-none text-gray-800 font-serif leading-relaxed animate-fade-in"
                                    dangerouslySetInnerHTML={{ __html: aiEvaluation }}
                                />
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60 min-h-[200px]">
                                    <div className="bg-indigo-50 p-4 rounded-full mb-3">
                                        <Sparkles size={32} className="text-indigo-300"/>
                                    </div>
                                    <p className="text-center text-sm font-medium">Bấm "Phân tích ngay" để AI tổng hợp số liệu<br/>và đánh giá hiệu quả làm việc.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col flex-1 animate-fade-in min-h-[400px]">
                    {/* Header bar */}
                    <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <div className="flex items-center gap-2">
                            <UserIcon size={18} className="text-slate-600" />
                            <h3 className="font-bold text-slate-800 text-sm sm:text-base uppercase tracking-wide">
                                BẢNG THỐNG KÊ NHÂN VIÊN
                            </h3>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="bg-indigo-50 text-indigo-700 font-bold px-3 py-1 rounded-full text-xs border border-indigo-100">
                                Cán bộ: {filteredEmployeesByDept.length}
                            </span>
                        </div>
                    </div>
                    {/* Table */}
                    <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left text-xs sm:text-sm border-collapse">
                            <thead className="bg-slate-50/90 text-slate-500 font-bold text-[11px] sm:text-xs uppercase sticky top-0 border-b border-slate-200 z-10">
                                <tr>
                                    <th className="py-3.5 px-4 text-center w-12">STT</th>
                                    <th className="py-3.5 px-4 text-left">TÊN CÁN BỘ</th>
                                    <th className="py-3.5 px-4 text-center">HỒ SƠ GIAO</th>
                                    <th className="py-3.5 px-4 text-center">ĐÃ XONG</th>
                                    <th className="py-3.5 px-4 text-center">ĐANG XỬ LÝ</th>
                                    <th className="py-3.5 px-4 text-center">TRỄ ĐÃ XONG</th>
                                    <th className="py-3.5 px-4 text-center">TRỄ CHƯA XONG</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {employeeSummaryList.map((item, idx) => (
                                    <tr 
                                        key={item.employee.id} 
                                        onClick={() => setSelectedEmpId(item.employee.id)}
                                        className="hover:bg-indigo-50/30 transition-colors cursor-pointer group"
                                    >
                                        <td className="py-3.5 px-4 text-center font-semibold text-slate-400 group-hover:text-slate-600">
                                            {idx + 1}
                                        </td>
                                        <td className="py-3.5 px-4">
                                            <div className="font-bold text-slate-800 text-sm group-hover:text-indigo-600 transition-colors flex items-center gap-2">
                                                {item.employee.name}
                                                {item.employee.position && (
                                                    <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-semibold border border-indigo-100">
                                                        {item.employee.position}
                                                    </span>
                                                )}
                                                {item.isSupervisor && (
                                                    <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-bold border border-amber-100">
                                                        Kiểm duyệt
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-slate-400 font-normal mt-0.5">
                                                {item.employee.department || 'Tổ chuyên môn'}
                                            </div>
                                        </td>
                                        <td className="py-3.5 px-4 text-center">
                                            <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold min-w-[48px] ${
                                                item.totalAssigned > 0 
                                                    ? 'bg-blue-50 text-blue-600 border border-blue-100/50' 
                                                    : 'bg-slate-100 text-slate-400'
                                            }`}>
                                                {item.totalAssigned}
                                            </span>
                                        </td>
                                        <td className="py-3.5 px-4 text-center">
                                            <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold min-w-[48px] ${
                                                item.completed > 0 
                                                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-100/50' 
                                                    : 'bg-slate-100 text-slate-400'
                                            }`}>
                                                {item.completed}
                                            </span>
                                        </td>
                                        <td className="py-3.5 px-4 text-center">
                                            <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold min-w-[48px] ${
                                                item.processing > 0 
                                                    ? 'bg-amber-50 text-amber-600 border border-amber-100/50' 
                                                    : 'bg-slate-100 text-slate-400'
                                            }`}>
                                                {item.processing}
                                            </span>
                                        </td>
                                        <td className="py-3.5 px-4 text-center">
                                            <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold min-w-[48px] ${
                                                item.overdueCompleted > 0 
                                                    ? 'bg-rose-50 text-rose-600 border border-rose-100/50' 
                                                    : 'bg-slate-100 text-slate-400'
                                            }`}>
                                                {item.overdueCompleted}
                                            </span>
                                        </td>
                                        <td className="py-3.5 px-4 text-center">
                                            <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold min-w-[48px] ${
                                                item.overduePending > 0 
                                                    ? 'bg-red-100 text-red-700 border border-red-200/60' 
                                                    : 'bg-slate-100 text-slate-400'
                                            }`}>
                                                {item.overduePending}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {employeeSummaryList.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                                            Chưa có dữ liệu cán bộ.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmployeeStatsView;
