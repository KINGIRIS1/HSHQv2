import React, { useState, useMemo } from 'react';
import { 
    CheckCircle2, 
    AlertCircle, 
    Calendar, 
    UserCheck, 
    ListFilter, 
    CheckSquare, 
    Square, 
    Save, 
    RefreshCw, 
    FileText, 
    Check, 
    ArrowRight, 
    HelpCircle, 
    Layers, 
    SlidersHorizontal,
    Search,
    Upload,
    Play,
    Trash2
} from 'lucide-react';
import { RecordFile, Employee, NotifyFunction, RecordStatus } from '../../types';
import { getDepartmentForRecord, formatDateDDMMYYYY, parseSafeDate } from '../../utils/appHelpers';
import { getShortRecordType } from '../../constants';
import * as XLSX from 'xlsx-js-style';

interface KiemTraDoDacTabProps {
    records: RecordFile[];
    employees: Employee[];
    onSaveRecord: (record: RecordFile) => Promise<any>;
    onRefreshData?: () => void | Promise<void>;
    notify: NotifyFunction;
}

type GroupByOption = 'all' | 'type' | 'status' | 'ward';

export const KiemTraDoDacTab: React.FC<KiemTraDoDacTabProps> = ({
    records = [],
    employees = [],
    onSaveRecord,
    onRefreshData,
    notify
}) => {
    // --- MAIN STATES ---
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isSaving, setIsSaving] = useState(false);
    
    // Grouping & Filtering segment states
    const [groupBy, setGroupBy] = useState<GroupByOption>('all');
    const [activeGroupFilter, setActiveGroupFilter] = useState<string>('Tất cả');

    // Toggle showing only missing or all measurement records
    const [showOnlyMissing, setShowOnlyMissing] = useState<boolean>(true);

    // Pagination states
    const [currentPage, setCurrentPage] = useState<number>(1);
    const itemsPerPage = 15;

    // Bulk action states - independent and optional
    const [bulkDate, setBulkDate] = useState<string>('');
    const [bulkInspectorId, setBulkInspectorId] = useState<string>('');
    const [bulkSubmissionDate, setBulkSubmissionDate] = useState<string>('');
    const [bulkSubmittedTo, setBulkSubmittedTo] = useState<string>('');
    const [bulkAssignedDate, setBulkAssignedDate] = useState<string>('');
    const [bulkAssignedTo, setBulkAssignedTo] = useState<string>('');

    // Row-specific edit overrides (if the user wants to adjust individual values)
    const [rowEdits, setRowEdits] = useState<Record<string, { 
        checkedBy?: string; 
        checkedDate?: string;
        submissionDate?: string;
        submittedTo?: string;
        assignedDate?: string;
        assignedTo?: string;
        exportDate?: string;
    }>>({});

    // Quick load filter presets
    const [quickFilter, setQuickFilter] = useState<'all' | 'giao_viec' | 'kiem_tra' | 'trinh_ky'>('all');

    // Filter counts for top navigation buttons
    const filterCounts = useMemo(() => {
        let giaoViec = 0;
        let kiemTra = 0;
        let trinhKy = 0;
        let total = 0;

        records.forEach(r => {
            const isMeasuringDept = getDepartmentForRecord(r) === 'Tổ Đo đạc' || getDepartmentForRecord(r) === 'Đo đạc';
            const isAllowedStatus = [RecordStatus.PENDING_CHECK, RecordStatus.CHECKED, RecordStatus.PENDING_SIGN].includes(r.status);
            const isNotInProgress = r.status !== RecordStatus.IN_PROGRESS;
            
            if (isMeasuringDept && isAllowedStatus && isNotInProgress) {
                total++;

                const isMissingAssignment = !r.assignedDate || !r.assignedTo;
                if (isMissingAssignment) giaoViec++;

                const hasAssignment = r.assignedDate && r.assignedTo;
                const isMissingChecking = !r.checkedDate || !r.checkedBy;
                if (hasAssignment && isMissingChecking) kiemTra++;

                const hasChecking = r.checkedDate && r.checkedBy;
                const isMissingSigning = !r.submissionDate || !r.submittedTo;
                if (hasChecking && isMissingSigning) trinhKy++;
            }
        });

        return { total, giaoViec, kiemTra, trinhKy };
    }, [records]);

    // Sync / Progress States
    const [stagedFile, setStagedFile] = useState<File | null>(null);
    const [importProgress, setImportProgress] = useState<number>(0);
    const [importTotal, setImportTotal] = useState<number>(0);
    const [importCurrent, setImportCurrent] = useState<number>(0);
    const [isImporting, setIsImporting] = useState<boolean>(false);
    const [importStatusText, setImportStatusText] = useState<string>('');

    // Reset pagination when filter or search changes
    React.useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, groupBy, activeGroupFilter, showOnlyMissing, quickFilter]);

    // --- FILTER INSPECTORS (Tổ trưởng / Tổ phó of Tổ Đo đạc) ---
    const allowedInspectors = useMemo(() => {
        return employees.filter(emp => {
            const dept = (emp.department || '').toLowerCase();
            const pos = (emp.position || '').toLowerCase();
            const isMeasDept = dept.includes('đo đạc') || dept.includes('đo dạc');
            const isLeader = pos.includes('tổ trưởng') || pos.includes('to truong') || 
                             pos.includes('tổ phó') || pos.includes('to pho') || 
                             pos.includes('trưởng') || pos.includes('phó') ||
                             pos.includes('tp') || pos.includes('tt');
            return isMeasDept && isLeader;
        });
    }, [employees]);

    // --- FILTER BAN GIÁM ĐỐC (BGĐ) ---
    const bgdEmployees = useMemo(() => {
        return employees.filter(emp => {
            const dept = (emp.department || '').toLowerCase();
            const pos = (emp.position || '').toLowerCase();
            return dept.includes('giám đốc') || dept.includes('giam doc') || dept.includes('bgđ') || dept.includes('bgd') || dept.includes('lãnh đạo') || dept.includes('lanh dao') ||
                   pos.includes('giám đốc') || pos.includes('giam doc') || pos.includes('gd') || pos.includes('pgd') || pos.includes('trưởng chi nhánh') || pos.includes('truong chi nhanh') || pos.includes('phó chi nhánh') || pos.includes('pho chi nhanh') || pos.includes('phó giám đốc') || pos.includes('pho giam doc');
        });
    }, [employees]);

    // --- FILTER NHÂN VIÊN TỔ ĐO ĐẠC ---
    const measuringEmployees = useMemo(() => {
        return employees.filter(emp => {
            const dept = (emp.department || '').toLowerCase();
            return dept.includes('đo đạc') || dept.includes('đo dạc');
        });
    }, [employees]);

    // --- HELPER FOR EXCEL DATE PARSING ---
    const parseExcelDate = (input: any): string | undefined => {
        if (input === undefined || input === null || input === '') return undefined;
        
        if (input instanceof Date) {
            if (!isNaN(input.getTime())) {
                const y = input.getUTCFullYear();
                const m = String(input.getUTCMonth() + 1).padStart(2, '0');
                const d = String(input.getUTCDate()).padStart(2, '0');
                return `${y}-${m}-${d}`;
            }
            return undefined;
        }

        const num = Number(input);
        if (!isNaN(num) && num > 20000 && typeof input !== 'string') {
            const utcMs = Math.round((num - 25569) * 86400 * 1000);
            const date = new Date(utcMs);
            if (!isNaN(date.getTime())) {
                const y = date.getUTCFullYear();
                const m = String(date.getUTCMonth() + 1).padStart(2, '0');
                const d = String(date.getUTCDate()).padStart(2, '0');
                return `${y}-${m}-${d}`;
            }
        }

        if (typeof input === 'string') {
            const cleanStr = input.trim();
            if (cleanStr === '') return undefined;
            
            const dmyRegex = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/;
            const match = cleanStr.match(dmyRegex);
            if (match) {
                const day = match[1].padStart(2, '0');
                const month = match[2].padStart(2, '0');
                const year = match[3];
                return `${year}-${month}-${day}`;
            }

            const ymdRegex = /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/;
            const matchYmd = cleanStr.match(ymdRegex);
            if (matchYmd) {
                const year = matchYmd[1];
                const month = matchYmd[2].padStart(2, '0');
                const day = matchYmd[3].padStart(2, '0');
                return `${year}-${month}-${day}`;
            }

            const date = new Date(cleanStr);
            if (!isNaN(date.getTime())) {
                const y = date.getUTCFullYear();
                const m = String(date.getUTCMonth() + 1).padStart(2, '0');
                const d = String(date.getUTCDate()).padStart(2, '0');
                return `${y}-${m}-${d}`;
            }
        }
        return undefined;
    };

    // --- HELPER FOR EMPLOYEE FUZZY MATCHING ---
    const findEmployeeByName = (nameStr: string): string => {
        if (!nameStr) return '';
        const cleanName = nameStr.trim().toLowerCase();
        const exact = employees.find(emp => emp.name.trim().toLowerCase() === cleanName);
        if (exact) return exact.id;

        const removeVietnameseTones = (str: string) => {
            return str
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/đ/g, 'd')
                .replace(/Đ/g, 'D');
        };
        
        const noToneCleanName = removeVietnameseTones(cleanName);
        const match = employees.find(emp => {
            const empClean = emp.name.trim().toLowerCase();
            const empNoTone = removeVietnameseTones(empClean);
            return empNoTone.includes(noToneCleanName) || noToneCleanName.includes(empNoTone);
        });

        return match ? match.id : nameStr;
    };

    // --- GET SUGGESTED DATE FOR RECORD ---
    const getSuggestedCheckDate = (record: RecordFile): string => {
        const baseDateStr = record.pendingCheckDate || record.receivedDate || record.assignedDate;
        if (!baseDateStr) {
            return new Date().toISOString().split('T')[0];
        }
        const d = parseSafeDate(baseDateStr);
        if (!d) {
            return new Date().toISOString().split('T')[0];
        }
        let daysAdded = 0;
        while (daysAdded < 2) {
            d.setDate(d.getDate() + 1);
            const dayOfWeek = d.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) { 
                daysAdded++;
            }
        }
        return d.toISOString().split('T')[0];
    };

    // --- FILTER & CLASSIFY RECORDS ---
    const eligibleRecords = useMemo(() => {
        const allowedStatuses = [
            RecordStatus.PENDING_CHECK,
            RecordStatus.CHECKED,
            RecordStatus.PENDING_SIGN,
            RecordStatus.SIGNED,
            RecordStatus.HANDOVER,
            RecordStatus.RETURNED
        ];

        return records.filter(r => {
            const dept = getDepartmentForRecord(r);
            const isMeasurement = dept === 'Tổ Đo đạc';
            if (!isMeasurement) return false;

            // Status filter
            const isAllowedStatus = allowedStatuses.includes(r.status);
            const isNotInProgress = r.status !== RecordStatus.IN_PROGRESS;
            if (!isAllowedStatus || !isNotInProgress) return false;

            // Base missing check (if showOnlyMissing is toggled)
            if (showOnlyMissing) {
                const isMissing = !r.checkedDate || !r.checkedBy || !r.submissionDate || !r.submittedTo || !r.assignedDate || !r.assignedTo;
                if (!isMissing) return false;
            }

            // Phase-based precise load filters
            if (quickFilter === 'giao_viec') {
                // Phase 1: Giao việc - missing assignment details
                const isMissingAssignment = !r.assignedDate || !r.assignedTo;
                if (!isMissingAssignment) return false;
            } else if (quickFilter === 'kiem_tra') {
                // Phase 2: Kiểm tra - has assignment details, but missing checking details (doesn't load unassigned new files)
                const hasAssignment = r.assignedDate && r.assignedTo;
                const isMissingChecking = !r.checkedDate || !r.checkedBy;
                if (!hasAssignment || !isMissingChecking) return false;
            } else if (quickFilter === 'trinh_ky') {
                // Phase 3: Trình ký - has checking details, but missing signing details (doesn't load unchecked files)
                const hasChecking = r.checkedDate && r.checkedBy;
                const isMissingSigning = !r.submissionDate || !r.submittedTo;
                if (!hasChecking || !isMissingSigning) return false;
            }

            return true;
        });
    }, [records, showOnlyMissing, quickFilter]);

    // Search filter
    const searchedRecords = useMemo(() => {
        if (!searchTerm.trim()) return eligibleRecords;
        const lower = searchTerm.toLowerCase().trim();
        return eligibleRecords.filter(r => 
            (r.code || '').toLowerCase().includes(lower) ||
            (r.customerName || '').toLowerCase().includes(lower) ||
            (r.recordType || '').toLowerCase().includes(lower) ||
            (r.ward || '').toLowerCase().includes(lower)
        );
    }, [eligibleRecords, searchTerm]);

    // Segmented / Group segments mapping
    const segments = useMemo(() => {
        const groups: Record<string, RecordFile[]> = {};
        
        searchedRecords.forEach(r => {
            let key = 'Khác';
            if (groupBy === 'all') {
                key = 'Tất cả';
            } else if (groupBy === 'type') {
                key = getShortRecordType(r.recordType) || 'Chưa phân loại';
            } else if (groupBy === 'status') {
                if (r.status === RecordStatus.PENDING_CHECK) key = 'Chờ kiểm tra';
                else if (r.status === RecordStatus.PENDING_SIGN) key = 'Chờ ký duyệt';
                else if (r.status === RecordStatus.CHECKED) key = 'Đã kiểm tra';
                else key = 'Đã hoàn thành bước kiểm tra';
            } else if (groupBy === 'ward') {
                key = r.ward || 'Chưa rõ xã/phường';
            }

            if (!groups[key]) groups[key] = [];
            groups[key].push(r);
        });

        return groups;
    }, [searchedRecords, groupBy]);

    const segmentKeys = useMemo(() => {
        const keys = Object.keys(segments);
        return keys.sort((a, b) => {
            if (a === 'Tất cả') return -1;
            if (b === 'Tất cả') return 1;
            return a.localeCompare(b);
        });
    }, [segments]);

    const currentActiveFilter = useMemo(() => {
        if (segmentKeys.length === 0) return '';
        if (segmentKeys.includes(activeGroupFilter)) return activeGroupFilter;
        return segmentKeys[0];
    }, [segmentKeys, activeGroupFilter]);

    const recordsToDisplay = useMemo(() => {
        if (!currentActiveFilter) return [];
        return segments[currentActiveFilter] || [];
    }, [segments, currentActiveFilter]);

    const totalPages = useMemo(() => {
        return Math.max(1, Math.ceil(recordsToDisplay.length / itemsPerPage));
    }, [recordsToDisplay.length, itemsPerPage]);

    const paginatedRecords = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return recordsToDisplay.slice(start, start + itemsPerPage);
    }, [recordsToDisplay, currentPage, itemsPerPage]);

    const handleToggleSelectAll = () => {
        const recordIds = recordsToDisplay.map(r => r.id);
        const allSelectedInView = recordIds.every(id => selectedIds.has(id));

        const next = new Set(selectedIds);
        if (allSelectedInView) {
            recordIds.forEach(id => next.delete(id));
        } else {
            recordIds.forEach(id => next.add(id));
        }
        setSelectedIds(next);
    };

    const handleToggleSelect = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const handleApplySuggestDate = (recordId: string, date: string) => {
        setRowEdits(prev => ({
            ...prev,
            [recordId]: {
                ...prev[recordId],
                checkedDate: date
            }
        }));
    };

    const handleRowEditChange = (
        recordId: string, 
        field: 'checkedBy' | 'checkedDate' | 'submissionDate' | 'submittedTo' | 'assignedDate' | 'assignedTo' | 'exportDate', 
        value: string
    ) => {
        setRowEdits(prev => ({
            ...prev,
            [recordId]: {
                ...prev[recordId],
                [field]: value
            }
        }));
    };

    // Save individual record with optional check date
    const handleSaveSingleRecord = async (record: RecordFile) => {
        const edits = rowEdits[record.id] || {};
        
        const inspector = edits.checkedBy !== undefined ? edits.checkedBy : record.checkedBy;
        const checkDateVal = edits.checkedDate !== undefined ? edits.checkedDate : (record.checkedDate ? record.checkedDate.split('T')[0] : '');
        const subDateVal = edits.submissionDate !== undefined ? edits.submissionDate : (record.submissionDate ? record.submissionDate.split('T')[0] : '');
        const subToVal = edits.submittedTo !== undefined ? edits.submittedTo : (record.submittedTo || '');
        const assDateVal = edits.assignedDate !== undefined ? edits.assignedDate : (record.assignedDate ? record.assignedDate.split('T')[0] : '');
        const assToVal = edits.assignedTo !== undefined ? edits.assignedTo : (record.assignedTo || '');
        const expDateVal = edits.exportDate !== undefined ? edits.exportDate : (record.exportDate ? record.exportDate.split('T')[0] : '');

        setIsSaving(true);
        try {
            const updated: RecordFile = {
                ...record,
                checkedBy: inspector || undefined,
                checkedDate: checkDateVal ? new Date(checkDateVal + "T12:00:00").toISOString() : undefined,
                submissionDate: subDateVal ? new Date(subDateVal + "T12:00:00").toISOString() : undefined,
                submittedTo: subToVal || undefined,
                assignedDate: assDateVal ? new Date(assDateVal + "T12:00:00").toISOString() : undefined,
                assignedTo: assToVal || undefined,
                exportDate: expDateVal ? new Date(expDateVal + "T12:00:00").toISOString() : undefined,
                status: (record.status === RecordStatus.PENDING_CHECK && inspector) ? RecordStatus.CHECKED : record.status,
                statusLogs: [
                    ...(record.statusLogs || []),
                    {
                        id: Math.random().toString(36).substr(2, 9),
                        recordId: record.id,
                        previousStatus: record.status,
                        newStatus: (record.status === RecordStatus.PENDING_CHECK && inspector) ? RecordStatus.CHECKED : record.status,
                        changedBy: inspector || 'Hệ thống',
                        changedAt: new Date().toISOString(),
                        note: `Cập nhật thủ công kiểm tra đo đạc.`
                    }
                ]
            };

            await onSaveRecord(updated);
            if (onRefreshData) await onRefreshData();
            notify(`Đã cập nhật thông tin cho hồ sơ: ${record.code}`, 'success');

            setRowEdits(prev => {
                const next = { ...prev };
                delete next[record.id];
                return next;
            });
            setSelectedIds(prev => {
                const next = new Set(prev);
                next.delete(record.id);
                return next;
            });
        } catch (error) {
            console.error(error);
            notify('Không thể cập nhật hồ sơ.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // Apply bulk edits to selected with progress bar feedback
    const handleApplyBulkUpdate = async () => {
        if (selectedIds.size === 0) {
            notify('Vui lòng chọn ít nhất một hồ sơ từ danh sách.', 'error');
            return;
        }

        const updateFields: any = {};
        if (bulkDate) updateFields.checkedDate = new Date(bulkDate + "T12:00:00").toISOString();
        if (bulkInspectorId) updateFields.checkedBy = bulkInspectorId;
        if (bulkSubmissionDate) updateFields.submissionDate = new Date(bulkSubmissionDate + "T12:00:00").toISOString();
        if (bulkSubmittedTo) updateFields.submittedTo = bulkSubmittedTo;
        if (bulkAssignedDate) updateFields.assignedDate = new Date(bulkAssignedDate + "T12:00:00").toISOString();
        if (bulkAssignedTo) updateFields.assignedTo = bulkAssignedTo;

        if (Object.keys(updateFields).length === 0) {
            notify('Vui lòng chọn hoặc điền ít nhất một trường cần cập nhật.', 'error');
            return;
        }

        const confirmMsg = `Xác nhận cập nhật đồng loạt ${Object.keys(updateFields).length} trường thông tin cho ${selectedIds.size} hồ sơ đang chọn?`;
        if (!window.confirm(confirmMsg)) return;

        setIsSaving(true);
        setImportTotal(selectedIds.size);
        setImportCurrent(0);
        setImportProgress(0);
        setImportStatusText('Bắt đầu cập nhật hàng loạt...');
        setIsImporting(true);

        try {
            let count = 0;
            const targets = eligibleRecords.filter(r => selectedIds.has(r.id));

            for (let i = 0; i < targets.length; i++) {
                const r = targets[i];
                setImportCurrent(i + 1);
                setImportProgress(Math.round(((i + 1) / targets.length) * 100));
                setImportStatusText(`Đang xử lý hồ sơ: ${r.code}`);

                const finalStatus = (r.status === RecordStatus.PENDING_CHECK && (updateFields.checkedBy || r.checkedBy))
                    ? RecordStatus.CHECKED
                    : r.status;

                const updated: RecordFile = {
                    ...r,
                    ...updateFields,
                    status: finalStatus,
                    statusLogs: [
                        ...(r.statusLogs || []),
                        {
                            id: Math.random().toString(36).substr(2, 9),
                            recordId: r.id,
                            previousStatus: r.status,
                            newStatus: finalStatus,
                            changedBy: updateFields.checkedBy || 'Bulk Tool',
                            changedAt: new Date().toISOString(),
                            note: `Cập nhật nhanh hàng loạt từ bảng điều phối.`
                        }
                    ]
                };

                await onSaveRecord(updated);
                count++;
                await new Promise(resolve => setTimeout(resolve, 30));
            }

            if (onRefreshData) await onRefreshData();
            notify(`Đã cập nhật đồng loạt thành công ${count} hồ sơ!`, 'success');
            setSelectedIds(new Set());
            setRowEdits({});
            setBulkDate('');
            setBulkInspectorId('');
            setBulkSubmissionDate('');
            setBulkSubmittedTo('');
            setBulkAssignedDate('');
            setBulkAssignedTo('');
        } catch (error) {
            console.error(error);
            notify('Gặp lỗi khi cập nhật hàng loạt.', 'error');
        } finally {
            setIsSaving(false);
            setIsImporting(false);
        }
    };

    const handleDownloadTemplate = () => {
        const wb = XLSX.utils.book_new();
        const wsData = [
            ["Mã hồ sơ", "Trạng thái", "Người được giao trạng thái", "Ngày giao trạng thái"],
            ["HS-2026-0001", "Chờ kiểm tra", "Nguyễn Văn A", "12/08/2026"],
            ["HS-2026-0002", "Chờ ký duyệt", "Trần Thị B", "13/08/2026"]
        ];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, "Mau_Dong_Bo");
        XLSX.writeFile(wb, "Mau_Dong_Bo_Do_Dac.xlsx");
        notify("Đã tải tệp mẫu Excel thành công!", "success");
    };

    // EXCEL FILE SELECTION
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setStagedFile(file);
        notify(`Đã chọn tệp "${file.name}". Nhấp nút "Bắt đầu đồng bộ" để thực hiện.`, "success");
    };

    const handleClearStagedFile = () => {
        setStagedFile(null);
        notify("Đã gỡ tệp Excel đã chọn.", "info");
    };

    // EXCEL SYNC EXECUTIVE START (with Progress Bar)
    const handleStartSync = () => {
        if (!stagedFile) {
            notify("Vui lòng chọn tệp Excel trước.", "error");
            return;
        }

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const ab = evt.target?.result;
                const wb = XLSX.read(ab, { type: 'array' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[];

                if (data.length <= 1) {
                    notify('File Excel không có dữ liệu để đồng bộ.', 'error');
                    return;
                }

                // Find header row to locate columns
                let headerRowIdx = -1;
                for (let i = 0; i < Math.min(data.length, 15); i++) {
                    const row = data[i] as any[];
                    if (row && row.some(cell => {
                        const s = String(cell || '').toLowerCase();
                        return s.includes('mã hồ sơ') || s.includes('ma ho so') || s.includes('mã hs') || s.includes('hồ sơ');
                    })) {
                        headerRowIdx = i;
                        break;
                    }
                }

                if (headerRowIdx === -1) {
                    headerRowIdx = 0;
                }

                const headers = (data[headerRowIdx] as any[]).map(h => String(h || '').toLowerCase().trim());
                
                const codeIdx = headers.findIndex(h => h.includes('mã hồ sơ') || h.includes('ma ho so') || h.includes('mã hs') || h.includes('ma hs') || h.includes('hồ sơ') || h.includes('code'));
                const statusIdx = headers.findIndex(h => h.includes('trạng thái') || h.includes('trang thai') || h.includes('status'));
                const personIdx = headers.findIndex(h => h.includes('người được giao') || h.includes('nguoi duoc giao') || h.includes('người nhận') || h.includes('người xử lý') || h.includes('person'));
                const dateIdx = headers.findIndex(h => h.includes('ngày giao') || h.includes('ngay giao') || h.includes('ngày xử lý') || h.includes('ngày nhận') || h.includes('date'));

                const finalCodeIdx = codeIdx !== -1 ? codeIdx : 0;
                const finalStatusIdx = statusIdx !== -1 ? statusIdx : 1;
                const finalPersonIdx = personIdx !== -1 ? personIdx : 2;
                const finalDateIdx = dateIdx !== -1 ? dateIdx : 3;

                const rowsToProcess = data.slice(headerRowIdx + 1).filter(row => {
                    return row && row[finalCodeIdx] && String(row[finalCodeIdx]).trim() !== '';
                });

                if (rowsToProcess.length === 0) {
                    notify('Không tìm thấy dòng dữ liệu nào hợp lệ trong file Excel.', 'error');
                    return;
                }

                setIsImporting(true);
                setImportTotal(rowsToProcess.length);
                setImportCurrent(0);
                setImportProgress(0);
                setImportStatusText('Đang nạp file Excel...');

                let updatedCount = 0;

                for (let index = 0; index < rowsToProcess.length; index++) {
                    const row = rowsToProcess[index] as any[];
                    const code = String(row[finalCodeIdx] || '').trim();
                    const rowState = String(row[finalStatusIdx] || '').trim();
                    const personRaw = String(row[finalPersonIdx] || '').trim();
                    const dateRaw = row[finalDateIdx];
                    
                    setImportCurrent(index + 1);
                    setImportProgress(Math.round(((index + 1) / rowsToProcess.length) * 100));
                    setImportStatusText(`Đang đồng bộ hồ sơ: ${code}`);

                    const targetRecord = records.find(r => (r.code || '').trim().toLowerCase() === code.toLowerCase());
                    
                    if (targetRecord) {
                        const statusClean = rowState.toLowerCase();
                        let personField: 'assignedTo' | 'checkedBy' | 'submittedTo' = 'checkedBy';
                        let dateField: 'assignedDate' | 'checkedDate' | 'submissionDate' = 'checkedDate';

                        if (statusClean.includes('kiểm tra') || statusClean.includes('kiem tra')) {
                            personField = 'checkedBy';
                            dateField = 'checkedDate';
                        } else if (statusClean.includes('ký') || statusClean.includes('ky') || statusClean.includes('trình') || statusClean.includes('trinh')) {
                            personField = 'submittedTo';
                            dateField = 'submissionDate';
                        } else if (statusClean.includes('thực hiện') || statusClean.includes('thuc hien') || statusClean.includes('giao')) {
                            personField = 'assignedTo';
                            dateField = 'assignedDate';
                        }

                        const recordUpdates: Partial<RecordFile> = {};
                        let mappedId = '';

                        if (personRaw) {
                            mappedId = findEmployeeByName(personRaw);
                            if (mappedId) {
                                recordUpdates[personField] = mappedId;
                            }
                        }

                        if (dateRaw !== undefined && dateRaw !== null && String(dateRaw).trim() !== '') {
                            const parsedDateStr = parseExcelDate(dateRaw);
                            if (parsedDateStr) {
                                recordUpdates[dateField] = new Date(parsedDateStr + "T12:00:00").toISOString();
                            }
                        }

                        const hasPerson = recordUpdates[personField] || targetRecord[personField];
                        const finalStatus = (targetRecord.status === RecordStatus.PENDING_CHECK && personField === 'checkedBy' && hasPerson) 
                            ? RecordStatus.CHECKED 
                            : targetRecord.status;

                        if (Object.keys(recordUpdates).length > 0 || finalStatus !== targetRecord.status) {
                            const updatedRecord: RecordFile = {
                                ...targetRecord,
                                ...recordUpdates,
                                status: finalStatus,
                                statusLogs: [
                                    ...(targetRecord.statusLogs || []),
                                    {
                                        id: Math.random().toString(36).substr(2, 9),
                                        recordId: targetRecord.id,
                                        previousStatus: targetRecord.status,
                                        newStatus: finalStatus,
                                        changedBy: mappedId || 'Excel Sync Tool',
                                        changedAt: new Date().toISOString(),
                                        note: `Đồng bộ nhanh thông tin từ tệp Excel theo trạng thái ${rowState}.`
                                    }
                                ]
                            };

                            await onSaveRecord(updatedRecord);
                            updatedCount++;
                        }
                    }

                    await new Promise(resolve => setTimeout(resolve, 25));
                }

                if (onRefreshData) await onRefreshData();
                notify(`Đồng bộ thành công! Đã khớp và cập nhật ${updatedCount}/${rowsToProcess.length} dòng hồ sơ từ Excel.`, 'success');
                setStagedFile(null); // Clear the staged file on success
            } catch (err) {
                console.error(err);
                notify('Đã xảy ra lỗi khi đồng bộ tệp Excel.', 'error');
            } finally {
                setIsImporting(false);
            }
        };
        reader.readAsArrayBuffer(stagedFile);
    };

    const handleFillSuggestionsForSelected = () => {
        if (selectedIds.size === 0) {
            notify('Chọn các hồ sơ cần điền nhanh gợi ý trước.', 'info');
            return;
        }

        const nextRowEdits = { ...rowEdits };
        eligibleRecords.forEach(r => {
            if (selectedIds.has(r.id)) {
                nextRowEdits[r.id] = {
                    ...nextRowEdits[r.id],
                    checkedDate: getSuggestedCheckDate(r)
                };
            }
        });
        setRowEdits(nextRowEdits);
        notify(`Đã điền ngày kiểm tra gợi ý cho ${selectedIds.size} hồ sơ đang chọn!`, 'success');
    };

    const handleExportExcel = () => {
        if (searchedRecords.length === 0) {
            notify("Danh sách trống, không có hồ sơ để xuất.", 'error');
            return;
        }

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([]);

        const title1 = "DANH SÁCH HỒ SƠ THIẾU THÔNG TIN KIỂM TRA ĐO ĐẠC";
        const title2 = "CHI NHÁNH HỚN QUẢN";

        const headers = [
            "STT",
            "Mã hồ sơ",
            "Thủ tục",
            "Ngày thực hiện",
            "Người thực hiện",
            "Ngày kiểm tra",
            "Người kiểm tra",
            "Ngày trình ký",
            "Người ký duyệt",
            "Ngày hoàn thành",
            "Ngày giao 1 cửa",
            "Ngày trả kết quả"
        ];

        XLSX.utils.sheet_add_aoa(ws, [
            [title1],
            [title2],
            [""]
        ], { origin: "A1" });

        XLSX.utils.sheet_add_aoa(ws, [headers], { origin: "A4" });

        ws['!pageSetup'] = {
            paperSize: 9,
            orientation: 'landscape',
            fitToWidth: 1,
            fitToHeight: 0
        };
        ws['!margins'] = { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 };

        const getEmployeeName = (idOrName: string | null | undefined): string => {
            if (!idOrName) return '';
            const emp = employees.find(e => e.id === idOrName || e.name === idOrName);
            return emp ? emp.name : idOrName;
        };

        const dataRows: any[] = [];
        searchedRecords.forEach((r, idx) => {
            const hasReachedPendingSign = [
                RecordStatus.PENDING_SIGN,
                RecordStatus.SIGNED,
                RecordStatus.HANDOVER,
                RecordStatus.RETURNED
            ].includes(r.status);

            const pendingCheckDateFormatted = r.checkedDate 
                ? formatDateDDMMYYYY(r.checkedDate) 
                : (r.pendingCheckDate ? formatDateDDMMYYYY(r.pendingCheckDate) : '');
            const checkedByFormatted = r.checkedBy ? getEmployeeName(r.checkedBy) : '';
            const submissionDateFormatted = (hasReachedPendingSign && r.submissionDate) ? formatDateDDMMYYYY(r.submissionDate) : '';

            let signerName = '';
            if ([RecordStatus.SIGNED, RecordStatus.HANDOVER, RecordStatus.RETURNED].includes(r.status)) {
                signerName = getEmployeeName(r.submittedTo || r.authorizedBy);
            }

            dataRows.push([
                idx + 1,
                r.code || '',
                r.recordType || '',
                r.assignedDate ? formatDateDDMMYYYY(r.assignedDate) : '',
                getEmployeeName(r.assignedTo),
                pendingCheckDateFormatted,
                checkedByFormatted,
                submissionDateFormatted,
                signerName,
                r.completedDate ? formatDateDDMMYYYY(r.completedDate) : '',
                r.exportDate ? formatDateDDMMYYYY(r.exportDate) : '',
                r.resultReturnedDate ? formatDateDDMMYYYY(r.resultReturnedDate) : ''
            ]);
        });

        XLSX.utils.sheet_add_aoa(ws, dataRows, { origin: "A5" });

        const totalCols = 11;
        const merges = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: totalCols } }
        ];
        ws['!merges'] = merges;

        const headerStyle = {
            font: { bold: true, sz: 11, name: "Times New Roman" },
            alignment: { horizontal: "center", vertical: "center", wrapText: true },
            border: {
                top: { style: "thin" },
                bottom: { style: "thin" },
                left: { style: "thin" },
                right: { style: "thin" }
            },
            fill: { fgColor: { rgb: "E0E0E0" } }
        };
        const cellStyle = {
            font: { sz: 11, name: "Times New Roman" },
            border: {
                top: { style: "thin" },
                bottom: { style: "thin" },
                left: { style: "thin" },
                right: { style: "thin" }
            },
            alignment: { vertical: "center", wrapText: true }
        };
        const centerStyle = {
            ...cellStyle,
            alignment: { ...cellStyle.alignment, horizontal: "center" }
        };
        const titleStyle = {
            font: { bold: true, sz: 14, name: "Times New Roman" },
            alignment: { horizontal: "center" }
        };

        if (ws['A1']) ws['A1'].s = titleStyle;
        if (ws['A2']) ws['A2'].s = titleStyle;

        for (let c = 0; c <= totalCols; c++) {
            const ref = XLSX.utils.encode_cell({ r: 3, c });
            if (!ws[ref]) ws[ref] = { v: "", t: "s" };
            ws[ref].s = headerStyle;
        }

        for (let r = 4; r < 4 + dataRows.length; r++) {
            for (let c = 0; c <= totalCols; c++) {
                const ref = XLSX.utils.encode_cell({ r, c });
                if (!ws[ref]) ws[ref] = { v: "", t: "s" };
                if ([0, 1, 3, 5, 7, 9, 10, 11].includes(c)) ws[ref].s = centerStyle;
                else ws[ref].s = cellStyle;
            }
        }

        ws['!cols'] = [
            { wch: 6 },  // STT
            { wch: 16 }, // Mã hồ sơ
            { wch: 28 }, // Thủ tục
            { wch: 15 }, // Ngày thực hiện
            { wch: 20 }, // Người thực hiện
            { wch: 18 }, // Ngày kiểm tra
            { wch: 20 }, // Người kiểm tra
            { wch: 15 }, // Ngày trình ký
            { wch: 20 }, // Người ký duyệt
            { wch: 15 }, // Ngày hoàn thành
            { wch: 15 }, // Ngày giao 1 cửa
            { wch: 15 }  // Ngày trả kết quả
        ];

        XLSX.utils.book_append_sheet(wb, ws, "DS_ThieuThongTinKT");
        XLSX.writeFile(wb, `DS_Thieu_Thong_Tin_Kiem_Tra_Do_Dac_${new Date().toISOString().split('T')[0]}.xlsx`);
        notify("Đã xuất file Excel danh sách hồ sơ thiếu thông tin kiểm tra!", "success");
    };

    return (
        <div className="flex flex-col h-full bg-[#f8fafc]">
            {/* 1. MINIMALIST BANNER & HEADER */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 shrink-0 shadow-sm animate-fade-in">
                {/* Phase Filter Tabs */}
                <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl self-start xl:self-auto">
                    <button
                        onClick={() => setQuickFilter('all')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${quickFilter === 'all' ? 'bg-white text-slate-800 shadow-sm font-extrabold' : 'text-slate-600 hover:text-slate-800'}`}
                        title="Tải toàn bộ hồ sơ thiếu thông tin"
                    >
                        <span>Tất cả</span>
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${quickFilter === 'all' ? 'bg-slate-200 text-slate-800' : 'bg-slate-200/60 text-slate-500'}`}>
                            {filterCounts.total}
                        </span>
                    </button>
                    <button
                        onClick={() => setQuickFilter('giao_viec')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${quickFilter === 'giao_viec' ? 'bg-white text-blue-700 shadow-sm font-extrabold' : 'text-slate-600 hover:text-slate-800'}`}
                        title="Tải hồ sơ thiếu thông tin Người được giao hoặc Ngày giao việc"
                    >
                        <span>Giao việc</span>
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${quickFilter === 'giao_viec' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200/60 text-slate-500'}`}>
                            {filterCounts.giaoViec}
                        </span>
                    </button>
                    <button
                        onClick={() => setQuickFilter('kiem_tra')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${quickFilter === 'kiem_tra' ? 'bg-white text-blue-700 shadow-sm font-extrabold' : 'text-slate-600 hover:text-slate-800'}`}
                        title="Tải hồ sơ đã giao nhưng thiếu Người kiểm tra hoặc Ngày kiểm tra"
                    >
                        <span>Kiểm tra</span>
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${quickFilter === 'kiem_tra' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200/60 text-slate-500'}`}>
                            {filterCounts.kiemTra}
                        </span>
                    </button>
                    <button
                        onClick={() => setQuickFilter('trinh_ky')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${quickFilter === 'trinh_ky' ? 'bg-white text-blue-700 shadow-sm font-extrabold' : 'text-slate-600 hover:text-slate-800'}`}
                        title="Tải hồ sơ đã kiểm tra nhưng thiếu Người ký duyệt hoặc Ngày trình ký"
                    >
                        <span>Trình ký</span>
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${quickFilter === 'trinh_ky' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200/60 text-slate-500'}`}>
                            {filterCounts.trinhKy}
                        </span>
                    </button>
                </div>
                
                {/* Stats Summary Badge & Action Export */}
                <div className="flex items-center gap-3 text-xs self-start xl:self-auto">
                    <button
                        onClick={handleExportExcel}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold shadow-sm transition-colors cursor-pointer"
                        title="Xuất danh sách hồ sơ đang hiển thị ra tệp Excel"
                    >
                        <FileText size={14} />
                        Xuất Excel
                    </button>
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-semibold">
                        <AlertCircle size={14} className="text-amber-600" />
                        Đang lọc: {eligibleRecords.length} hồ sơ
                    </div>
                </div>
            </div>

            {/* MAIN INTERACTIVE WORKSPACE */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden p-6 gap-6">
                
                {/* LEFT CONTROL PANEL - BULK UTILITY */}
                <div className="w-full lg:w-[340px] flex flex-col gap-5 shrink-0 overflow-y-auto pr-1">
                    
                    {/* CARD 2: ĐỒNG BỘ TỪ EXCEL */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                        <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                            <Upload size={14} className="text-emerald-600" />
                            Đồng bộ từ Excel
                        </h3>
                        
                        <div className="space-y-3">
                            <span className="block text-slate-500 text-[11px] leading-relaxed">
                                Đồng bộ trạng thái nhanh chóng chỉ với 2 thao tác: Tải mẫu và chọn tệp Excel.
                            </span>

                            {/* Step 1: Download template */}
                            <button
                                onClick={handleDownloadTemplate}
                                className="w-full py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                                <FileText size={14} />
                                1. Tải tệp mẫu Excel
                            </button>

                            {/* Step 2: Upload Excel file / Display Staged File */}
                            {!stagedFile ? (
                                <div className="border-2 border-dashed border-slate-200 rounded-lg p-3 hover:bg-slate-50 transition-colors flex flex-col items-center justify-center cursor-pointer relative">
                                    <Upload size={20} className="text-slate-400 mb-1" />
                                    <span className="text-[11px] font-bold text-slate-600 text-center">2. Chọn tệp Excel đồng bộ</span>
                                    <span className="text-[9px] text-slate-400 mt-0.5">Hỗ trợ .xls, .xlsx</span>
                                    <input 
                                        type="file" 
                                        accept=".xlsx, .xls"
                                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                        onChange={handleFileSelect}
                                        disabled={isImporting}
                                    />
                                </div>
                            ) : (
                                <div className="border border-emerald-200 bg-emerald-50/50 rounded-lg p-3 space-y-3 animate-fade-in">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <FileText className="text-emerald-600" size={18} />
                                            <div className="min-w-0">
                                                <p className="text-[11px] font-bold text-slate-800 truncate" title={stagedFile.name}>
                                                    {stagedFile.name}
                                                </p>
                                                <p className="text-[9px] text-slate-500">
                                                    {(stagedFile.size / 1024).toFixed(1)} KB
                                                </p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={handleClearStagedFile}
                                            className="text-slate-400 hover:text-red-500 transition-colors p-0.5"
                                            title="Gỡ bỏ tệp này"
                                            disabled={isImporting}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>

                                    {/* Action button to execute sync */}
                                    <button
                                        onClick={handleStartSync}
                                        disabled={isImporting}
                                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                                    >
                                        {isImporting ? (
                                            <RefreshCw size={14} className="animate-spin" />
                                        ) : (
                                            <Play size={14} />
                                        )}
                                        Bắt đầu đồng bộ
                                    </button>
                                </div>
                            )}

                            {isImporting && (
                                <div className="space-y-2 pt-2 border-t border-slate-100 animate-fade-in">
                                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                                        <span className="truncate max-w-[185px]">{importStatusText}</span>
                                        <span>{importProgress}%</span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                                        <div 
                                            className="bg-emerald-600 h-full rounded-full transition-all duration-150 animate-pulse" 
                                            style={{ width: `${importProgress}%` }}
                                        />
                                    </div>
                                    <div className="text-[9px] text-slate-400 text-right font-semibold">
                                        Đã xử lý {importCurrent}/{importTotal} dòng
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* CARD 3: PHÂN MẢNG DANH SÁCH (SEGMENT CLASSIFIER) */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                            <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                                <Layers size={14} className="text-purple-600" />
                                Phân mảng danh sách
                            </h3>
                            {/* Toggle show all / only missing */}
                            <label className="flex items-center gap-1.5 cursor-pointer text-[10px] font-bold text-slate-600">
                                <input
                                    type="checkbox"
                                    checked={showOnlyMissing}
                                    onChange={e => setShowOnlyMissing(e.target.checked)}
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3 h-3 cursor-pointer"
                                />
                                Chỉ hiện hồ sơ thiếu
                            </label>
                        </div>

                        <div className="space-y-3">
                            <span className="block text-slate-500 text-[11px]">Chọn tiêu chí để phân nhóm hồ sơ:</span>
                            
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <button 
                                    onClick={() => { setGroupBy('all'); setActiveGroupFilter('Tất cả'); }}
                                    className={`py-2 px-3 rounded-lg font-bold border transition-all text-center ${groupBy === 'all' ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                                >
                                    Tất cả ({eligibleRecords.length})
                                </button>
                                <button 
                                    onClick={() => { setGroupBy('status'); setActiveGroupFilter(''); }}
                                    className={`py-2 px-3 rounded-lg font-bold border transition-all text-center ${groupBy === 'status' ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                                >
                                    Theo Trạng thái
                                </button>
                                <button 
                                    onClick={() => { setGroupBy('type'); setActiveGroupFilter(''); }}
                                    className={`py-2 px-3 rounded-lg font-bold border transition-all text-center ${groupBy === 'type' ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                                >
                                    Theo Loại thủ tục
                                </button>
                                <button 
                                    onClick={() => { setGroupBy('ward'); setActiveGroupFilter(''); }}
                                    className={`py-2 px-3 rounded-lg font-bold border transition-all text-center ${groupBy === 'ward' ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                                >
                                    Theo Xã/Phường
                                </button>
                            </div>

                            {/* List of sub-segments */}
                            {groupBy !== 'all' && segmentKeys.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                                    {segmentKeys.map(key => {
                                        const count = segments[key]?.length || 0;
                                        const isActive = currentActiveFilter === key;
                                        return (
                                            <button
                                                key={key}
                                                onClick={() => setActiveGroupFilter(key)}
                                                className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs font-semibold flex items-center justify-between transition-colors ${isActive ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
                                            >
                                                <span className="truncate max-w-[190px]">{key}</span>
                                                <span className="bg-slate-200 text-slate-700 rounded-full px-1.5 py-0.5 text-[10px] font-bold min-w-[20px] text-center">
                                                    {count}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* RIGHT DETAILED RECORD TABLE LIST */}
                <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
                    
                    {/* SEARCH & GROUP TITLE */}
                    <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800 text-sm">
                                Mảng: {currentActiveFilter || 'Tất cả'}
                            </span>
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold">
                                {recordsToDisplay.length} hồ sơ
                            </span>
                        </div>

                        {/* Search Input */}
                        <div className="relative w-full sm:w-64">
                            <input 
                                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" 
                                placeholder="Tìm kiếm nhanh..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                            <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                        </div>
                    </div>

                    {/* CORE DATA TABLE */}
                    <div className="flex-1 overflow-auto">
                        {recordsToDisplay.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-12 text-slate-400 h-full animate-fade-in">
                                <FileText size={48} className="text-slate-300 mb-3" />
                                <p className="font-semibold text-slate-600 text-sm">Tuyệt vời! Không có hồ sơ nào bị thiếu dữ liệu</p>
                                <p className="text-xs mt-1">Toàn bộ hồ sơ ở mảng này đã được kiểm tra đầy đủ</p>
                            </div>
                        ) : (
                            <div className="flex flex-col h-full justify-between">
                                <div className="overflow-auto flex-1">
                                    <table className="w-full border-collapse text-left">
                                        <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold text-xs uppercase sticky top-0 z-10">
                                            <tr>
                                                <th className="p-3 w-10 text-center">
                                                    <button 
                                                        onClick={handleToggleSelectAll} 
                                                        className="text-slate-500 hover:text-blue-600 focus:outline-none"
                                                    >
                                                        {recordsToDisplay.every(r => selectedIds.has(r.id)) ? (
                                                            <CheckSquare size={16} className="text-blue-600" />
                                                        ) : (
                                                            <Square size={16} />
                                                        )}
                                                    </button>
                                                </th>
                                                <th className="p-3 w-28">Mã hồ sơ</th>
                                                <th className="p-3 w-40">Ngày giao việc</th>
                                                <th className="p-3 w-40">Người được giao</th>
                                                <th className="p-3 w-40">Ngày kiểm tra</th>
                                                <th className="p-3 w-40">Người kiểm tra</th>
                                                <th className="p-3 w-40">Ngày trình ký</th>
                                                <th className="p-3 w-40">Người trình ký</th>
                                                <th className="p-3 w-40">Ngày giao 1 cửa</th>
                                                <th className="p-3 w-16 text-center">Lưu</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                                            {paginatedRecords.map((r, index) => {
                                                const isSelected = selectedIds.has(r.id);
                                                const suggestedDate = getSuggestedCheckDate(r);
                                                
                                                const edits = rowEdits[r.id] || {};
                                                const finalDate = edits.checkedDate !== undefined ? edits.checkedDate : (r.checkedDate ? r.checkedDate.split('T')[0] : '');
                                                const finalInspector = edits.checkedBy !== undefined ? edits.checkedBy : (r.checkedBy || '');
                                                const finalSubmissionDate = edits.submissionDate !== undefined ? edits.submissionDate : (r.submissionDate ? r.submissionDate.split('T')[0] : '');
                                                const finalSubmittedTo = edits.submittedTo !== undefined ? edits.submittedTo : (r.submittedTo || '');
                                                const finalAssignedDate = edits.assignedDate !== undefined ? edits.assignedDate : (r.assignedDate ? r.assignedDate.split('T')[0] : '');
                                                const finalAssignedTo = edits.assignedTo !== undefined ? edits.assignedTo : (r.assignedTo || '');
                                                const finalExportDate = edits.exportDate !== undefined ? edits.exportDate : (r.exportDate ? r.exportDate.split('T')[0] : '');

                                                return (
                                                    <tr key={r.id} className={`hover:bg-slate-50/70 transition-colors ${isSelected ? 'bg-blue-50/20' : ''}`}>
                                                        {/* Selection Checkbox */}
                                                        <td className="p-3 text-center">
                                                            <button 
                                                                onClick={() => handleToggleSelect(r.id)} 
                                                                className="text-slate-500 hover:text-blue-600 focus:outline-none"
                                                            >
                                                                {isSelected ? (
                                                                    <CheckSquare size={16} className="text-blue-600" />
                                                                ) : (
                                                                    <Square size={16} />
                                                                )}
                                                            </button>
                                                        </td>

                                                        {/* Record Code */}
                                                        <td className="p-3">
                                                            <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded text-[11px] border border-slate-200">
                                                                {r.code}
                                                            </span>
                                                            <div className="mt-1 text-[10px] text-slate-400 font-medium">
                                                                Trạng thái: <span className="font-semibold text-slate-600">{r.status}</span>
                                                            </div>
                                                        </td>

                                                        {/* Assigned Date Input */}
                                                        <td className="p-3">
                                                            <input 
                                                                type="date"
                                                                value={finalAssignedDate}
                                                                onChange={e => handleRowEditChange(r.id, 'assignedDate', e.target.value)}
                                                                className="w-full border border-slate-300 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500 font-medium text-slate-700 bg-white"
                                                            />
                                                        </td>

                                                        {/* Assigned To Dropdown Selection (Tổ đo đạc) */}
                                                        <td className="p-3">
                                                            <select
                                                                value={finalAssignedTo}
                                                                onChange={e => handleRowEditChange(r.id, 'assignedTo', e.target.value)}
                                                                className="w-full border border-slate-300 rounded px-1.5 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500 font-semibold text-slate-700 bg-white"
                                                            >
                                                                <option value="">-- Chọn nhân viên --</option>
                                                                {measuringEmployees.map(emp => (
                                                                    <option key={emp.id} value={emp.id}>
                                                                        {emp.name}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </td>

                                                        {/* Check Date Input */}
                                                        <td className="p-3">
                                                            <input 
                                                                type="date"
                                                                value={finalDate}
                                                                onChange={e => handleRowEditChange(r.id, 'checkedDate', e.target.value)}
                                                                className="w-full border border-slate-300 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500 font-medium text-slate-700 bg-white"
                                                            />
                                                        </td>

                                                        {/* Inspector Dropdown Selection */}
                                                        <td className="p-3">
                                                            <select
                                                                value={finalInspector}
                                                                onChange={e => handleRowEditChange(r.id, 'checkedBy', e.target.value)}
                                                                className="w-full border border-slate-300 rounded px-1.5 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500 font-semibold text-slate-700 bg-white"
                                                            >
                                                                <option value="">-- Chọn cán bộ --</option>
                                                                {allowedInspectors.map(emp => (
                                                                    <option key={emp.id} value={emp.id}>
                                                                        {emp.name}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </td>

                                                        {/* Submission Date Input */}
                                                        <td className="p-3">
                                                            <input 
                                                                type="date"
                                                                value={finalSubmissionDate}
                                                                onChange={e => handleRowEditChange(r.id, 'submissionDate', e.target.value)}
                                                                className="w-full border border-slate-300 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500 font-medium text-slate-700 bg-white"
                                                            />
                                                        </td>

                                                        {/* Submitted To Dropdown Selection (BGĐ only) */}
                                                        <td className="p-3">
                                                            <select
                                                                value={finalSubmittedTo}
                                                                onChange={e => handleRowEditChange(r.id, 'submittedTo', e.target.value)}
                                                                className="w-full border border-slate-300 rounded px-1.5 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500 font-semibold text-slate-700 bg-white"
                                                            >
                                                                <option value="">-- Chọn lãnh đạo --</option>
                                                                {bgdEmployees.map(emp => (
                                                                    <option key={emp.id} value={emp.id}>
                                                                        {emp.name}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </td>

                                                        {/* Export Date (Ngày giao 1 cửa) Input */}
                                                        <td className="p-3">
                                                            <input 
                                                                type="date"
                                                                value={finalExportDate}
                                                                onChange={e => handleRowEditChange(r.id, 'exportDate', e.target.value)}
                                                                className="w-full border border-slate-300 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500 font-medium text-slate-700 bg-white"
                                                            />
                                                        </td>

                                                        {/* Quick Save Row */}
                                                        <td className="p-3 text-center">
                                                            <button
                                                                onClick={() => handleSaveSingleRecord(r)}
                                                                className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors inline-flex items-center"
                                                                title="Lưu hồ sơ này"
                                                            >
                                                                <Save size={16} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination Controls */}
                                <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0 text-xs">
                                    <div className="text-slate-500 font-medium">
                                        Hiển thị <span className="font-semibold text-slate-700">{(currentPage - 1) * itemsPerPage + 1}</span> - <span className="font-semibold text-slate-700">{Math.min(currentPage * itemsPerPage, recordsToDisplay.length)}</span> trong tổng số <span className="font-semibold text-slate-700">{recordsToDisplay.length}</span> hồ sơ
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                            disabled={currentPage === 1}
                                            className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-md font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white transition-colors cursor-pointer"
                                        >
                                            Trước
                                        </button>
                                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                                            if (totalPages > 5 && Math.abs(page - currentPage) > 1 && page !== 1 && page !== totalPages) {
                                                if (page === 2 || page === totalPages - 1) {
                                                    return <span key={page} className="px-1 text-slate-400">...</span>;
                                                }
                                                return null;
                                            }
                                            return (
                                                <button
                                                    key={page}
                                                    onClick={() => setCurrentPage(page)}
                                                    className={`px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer ${currentPage === page ? 'bg-blue-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                                >
                                                    {page}
                                                </button>
                                            );
                                        })}
                                        <button
                                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                            disabled={currentPage === totalPages}
                                            className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-md font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white transition-colors cursor-pointer"
                                        >
                                            Sau
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
