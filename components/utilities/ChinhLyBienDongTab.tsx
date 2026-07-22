
import React, { useState, useEffect, useMemo } from 'react';
import { User as UserType, RecordFile, NotifyFunction } from '../../types';
import { fetchRecords } from '../../services/apiRecords';
import { ChinhLyRecord, fetchChinhLyRecords, saveChinhLyRecord, deleteChinhLyRecord } from '../../services/apiUtilities';
import { Search, Plus, Save, List, Edit, Trash2, FileSpreadsheet, Layers, CheckSquare, Square, ArrowRight, FolderCheck, RotateCcw, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { confirmAction } from '../../utils/appHelpers';
import * as XLSX from 'xlsx-js-style';

interface ChinhLyBienDongTabProps {
    currentUser: UserType;
    notify: NotifyFunction;
    initialRecord?: RecordFile | null; // Prop mới
}

// Danh sách Xã/Phường giới hạn theo yêu cầu
const HON_QUAN_WARDS = [
    "thị trấn Tân Khai",
    "xã Tân Quan",
    "xã Minh Đức",
    "xã Tân Hưng"
];

// Dữ liệu dùng chung cho cả nhóm (Header)
interface CommonData {
    XA: string;
    SO_HD: string; // Key để gom nhóm
    CAN_CU_PHAP_LY: string;
    GHI_CHU: string;
    STATUS?: 'pending' | 'sent'; // Trạng thái: Chờ xử lý | Đã chuyển
}

// Dữ liệu chi tiết từng dòng (Detail)
interface DetailData {
    // Trước BĐ
    TO_CU: string; THUA_CU: string; DT_CU: string; LOAI_DAT_CU: string;
    // Sau BĐ
    TO_MOI: string; THUA_TAM: string; THUA_CHINH_THUC: string; DT_MOI: string; LOAI_DAT_MOI: string;
    // Thông tin bổ sung
    THONG_TIN_QH: string; // Cột mới: Thông tin quy hoạch/Diện tích thu hồi
    
    TONG_DT: string; 
}

const DEFAULT_COMMON: CommonData = {
    XA: '', SO_HD: '', 
    CAN_CU_PHAP_LY: 'Phiếu yêu cầu nộp hồ sơ GQ TTHC', GHI_CHU: '',
    STATUS: 'pending'
};

const DEFAULT_DETAIL: DetailData = {
    TO_CU: '', THUA_CU: '', DT_CU: '', LOAI_DAT_CU: '',
    TO_MOI: '', THUA_TAM: '', THUA_CHINH_THUC: '', DT_MOI: '', LOAI_DAT_MOI: '',
    THONG_TIN_QH: '', // Init
    TONG_DT: ''
};

const ChinhLyBienDongTab: React.FC<ChinhLyBienDongTabProps> = ({ currentUser, notify, initialRecord }) => {
    const [mode, setMode] = useState<'create' | 'list'>('list');
    
    // Tab con trong màn hình danh sách
    const [listTab, setListTab] = useState<'pending' | 'sent'>('pending');

    const [records, setRecords] = useState<RecordFile[]>([]);
    const [savedList, setSavedList] = useState<ChinhLyRecord[]>([]);
    
    // Thay đổi: Quản lý từ khóa tìm kiếm riêng cho từng tab
    const [searchTerms, setSearchTerms] = useState<{ pending: string; sent: string }>({
        pending: '',
        sent: ''
    });
    
    // Selection State
    const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());

    // State Form
    const [commonData, setCommonData] = useState<CommonData>(DEFAULT_COMMON);
    const [detailRows, setDetailRows] = useState<DetailData[]>([ { ...DEFAULT_DETAIL } ]);
    
    const [searchQuery, setSearchQuery] = useState(''); 
    const [isSaving, setIsSaving] = useState(false);
    
    const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    // --- HANDLE INITIAL RECORD (AUTO FILL) ---
    useEffect(() => {
        if (initialRecord) {
            setMode('create');
            setCommonData({
                ...DEFAULT_COMMON,
                XA: initialRecord.ward || '',
                SO_HD: initialRecord.code || ''
            });
            
            const newDetail: DetailData = {
                ...DEFAULT_DETAIL,
                TO_CU: initialRecord.mapSheet || '',
                THUA_CU: initialRecord.landPlot || '',
                DT_CU: initialRecord.area ? initialRecord.area.toString() : '',
                DT_MOI: initialRecord.area ? initialRecord.area.toString() : '',
                TONG_DT: initialRecord.area ? initialRecord.area.toString() : '',
                TO_MOI: initialRecord.mapSheet || '',
            };
            setDetailRows([newDetail]);
            notify(`Đã nạp dữ liệu chỉnh lý từ hồ sơ: ${initialRecord.code}`, 'success');
        }
    }, [initialRecord]);

    // Reset selection khi đổi tab danh sách và xóa tìm kiếm
    useEffect(() => {
        setSelectedGroups(new Set());
        setSearchTerms({ pending: '', sent: '' });
    }, [listTab]);

    const loadData = async () => {
        const [appRecords, utilityRecords] = await Promise.all([
            fetchRecords(),
            fetchChinhLyRecords()
        ]);
        setRecords(appRecords);
        setSavedList(utilityRecords);
    };

    // --- LOGIC FORM ---
    const handleAddDetailRow = () => {
        setDetailRows(prev => [...prev, { ...DEFAULT_DETAIL }]);
    };

    const handleRemoveDetailRow = (index: number) => {
        if (detailRows.length === 1) {
            setDetailRows([{ ...DEFAULT_DETAIL }]); 
        } else {
            setDetailRows(prev => prev.filter((_, i) => i !== index));
        }
    };

    const handleDetailChange = (index: number, field: keyof DetailData, value: string) => {
        const newRows = [...detailRows];
        newRows[index] = { ...newRows[index], [field]: value };
        setDetailRows(newRows);
    };

    const handleSearchAndFill = () => {
        if (!searchQuery.trim()) return;
        const found = records.find(r => r.code.toLowerCase() === searchQuery.toLowerCase().trim());
        
        if (found) {
            setCommonData(prev => ({
                ...prev,
                XA: found.ward ? found.ward : '',
                SO_HD: found.code
            }));

            const newDetail: DetailData = {
                ...DEFAULT_DETAIL,
                TO_CU: found.mapSheet || '',
                THUA_CU: found.landPlot || '',
                DT_CU: found.area ? found.area.toString() : '',
                DT_MOI: found.area ? found.area.toString() : '',
                TONG_DT: found.area ? found.area.toString() : '',
                TO_MOI: found.mapSheet || '',
            };

            const lastIdx = detailRows.length - 1;
            const isLastEmpty = !detailRows[lastIdx].TO_CU && !detailRows[lastIdx].THUA_CU;
            
            if (isLastEmpty) {
                const updated = [...detailRows];
                updated[lastIdx] = newDetail;
                setDetailRows(updated);
            } else {
                setDetailRows(prev => [...prev, newDetail]);
            }
            
            notify(`Đã lấy dữ liệu từ hồ sơ: ${found.code}`, 'success');
            setSearchQuery('');
        } else {
            notify('Không tìm thấy mã hồ sơ này.', 'error');
        }
    };

    // --- LOGIC TÍNH TOÁN DIỆN TÍCH ---
    const calculateTotals = useMemo(() => {
        const totalBefore = detailRows.reduce((sum, row) => sum + (parseFloat(row.DT_CU) || 0), 0);
        const totalAfter = detailRows.reduce((sum, row) => sum + (parseFloat(row.DT_MOI) || 0), 0);
        const diff = Math.abs(totalBefore - totalAfter);
        const isMismatch = diff > 0.1; 

        return {
            totalBefore: parseFloat(totalBefore.toFixed(2)),
            totalAfter: parseFloat(totalAfter.toFixed(2)),
            isMismatch,
            diff: parseFloat(diff.toFixed(2))
        };
    }, [detailRows]);

    const handleSaveGroup = async () => {
        if (!commonData.XA) { notify("Vui lòng chọn Xã/Phường.", 'error'); return; }
        
        setIsSaving(true);

        if (calculateTotals.isMismatch) {
            const warningMsg = `CẢNH BÁO SAI LỆCH DIỆN TÍCH!\n\n` +
                `- Tổng diện tích TRƯỚC biến động: ${calculateTotals.totalBefore} m²\n` +
                `- Tổng diện tích SAU biến động: ${calculateTotals.totalAfter} m²\n` +
                `- Chênh lệch: ${calculateTotals.diff} m²\n\n` +
                `Bạn có chắc chắn muốn lưu không?`;
            
            if (!(await confirmAction(warningMsg, 'Xác nhận lưu dữ liệu lệch'))) {
                setIsSaving(false);
                return;
            }
        }
        
        // 1. Xóa cũ nếu đang sửa
        if (editingGroupId) {
            const oldRecords = savedList.filter(r => r.data.SO_HD === editingGroupId);
            for (const rec of oldRecords) {
                await deleteChinhLyRecord(rec.id);
            }
        }

        // 2. Insert mới
        let successCount = 0;
        const validRows = detailRows.filter(r => r.TO_CU || r.THUA_CU || r.TO_MOI || r.THUA_CHINH_THUC);
        
        if (validRows.length === 0) {
            setIsSaving(false);
            notify("Vui lòng nhập ít nhất 1 dòng chi tiết thửa đất.", 'error');
            return;
        }

        for (const row of validRows) {
            const recordData = {
                ...commonData,
                // Khi tạo mới hoặc sửa, nếu chưa có status thì set là pending. 
                // Nếu đang sửa và đã có status cũ, giữ nguyên (logic này có thể tùy chỉnh)
                STATUS: commonData.STATUS || 'pending', 
                ...row
            };
            
            const recordToSave: Partial<ChinhLyRecord> = {
                customer_name: `${commonData.XA} - ${commonData.SO_HD}`, 
                data: recordData,
                created_by: currentUser.name
            };
            
            await saveChinhLyRecord(recordToSave);
            successCount++;
        }

        setIsSaving(false);
        await loadData();
        notify(`Đã lưu thành công ${successCount} dòng!`, 'success');
        setMode('list');
        handleReset();
    };

    const handleEditGroup = (soHD: string) => {
        const groupRecords = savedList.filter(r => r.data.SO_HD === soHD);
        if (groupRecords.length === 0) return;

        const first = groupRecords[0].data;
        
        setCommonData({
            XA: first.XA || '',
            SO_HD: first.SO_HD || '',
            CAN_CU_PHAP_LY: first.CAN_CU_PHAP_LY || '',
            GHI_CHU: first.GHI_CHU || '',
            STATUS: first.STATUS || 'pending'
        });

        const details: DetailData[] = groupRecords.map(r => ({
            TO_CU: r.data.TO_CU, THUA_CU: r.data.THUA_CU, DT_CU: r.data.DT_CU, LOAI_DAT_CU: r.data.LOAI_DAT_CU,
            TO_MOI: r.data.TO_MOI, THUA_TAM: r.data.THUA_TAM, THUA_CHINH_THUC: r.data.THUA_CHINH_THUC, DT_MOI: r.data.DT_MOI, LOAI_DAT_MOI: r.data.LOAI_DAT_MOI,
            THONG_TIN_QH: r.data.THONG_TIN_QH || '',
            TONG_DT: r.data.TONG_DT
        }));

        setDetailRows(details);
        setEditingGroupId(soHD);
        setMode('create');
    };

    const handleDeleteGroup = async (soHD: string) => {
        const groupRecords = savedList.filter(r => r.data.SO_HD === soHD);
        if (await confirmAction(`Xóa toàn bộ ${groupRecords.length} dòng thuộc hợp đồng ${soHD}?`)) {
            for (const rec of groupRecords) {
                await deleteChinhLyRecord(rec.id);
            }
            await loadData();
            notify("Đã xóa nhóm hồ sơ.", 'success');
        }
    };

    const handleReset = () => {
        setEditingGroupId(null);
        setCommonData(DEFAULT_COMMON);
        setDetailRows([{ ...DEFAULT_DETAIL }]);
        setSearchQuery('');
    };

    // --- SELECTION LOGIC ---
    const toggleSelectGroup = (soHD: string) => {
        if (!soHD) return;
        const newSet = new Set(selectedGroups);
        if (newSet.has(soHD)) {
            newSet.delete(soHD);
        } else {
            newSet.add(soHD);
        }
        setSelectedGroups(newSet);
    };

    const toggleSelectAll = () => {
        // Lấy tất cả SO_HD duy nhất trong danh sách HIỆN TẠI (đã lọc)
        const allGroups = new Set<string>();
        groupedList.forEach(item => {
            if (item.data.SO_HD) allGroups.add(item.data.SO_HD);
        });

        if (selectedGroups.size === allGroups.size) {
            setSelectedGroups(new Set()); // Bỏ chọn hết
        } else {
            setSelectedGroups(allGroups); // Chọn hết
        }
    };

    // --- TRANSFER / REVERT LOGIC ---
    const handleChangeStatus = async (targetStatus: 'pending' | 'sent') => {
        if (selectedGroups.size === 0) {
            notify("Vui lòng chọn ít nhất 1 hồ sơ.", 'error');
            return;
        }

        const actionName = targetStatus === 'sent' ? 'LẬP DANH SÁCH (Chuyển đi)' : 'HUỶ DANH SÁCH (Trả lại)';
        if (!(await confirmAction(`Bạn có chắc chắn muốn ${actionName} cho ${selectedGroups.size} hồ sơ đã chọn?`))) return;

        setIsSaving(true);
        let count = 0;

        // Tìm tất cả các record thuộc các nhóm đã chọn
        const recordsToUpdate = savedList.filter(r => r.data.SO_HD && selectedGroups.has(r.data.SO_HD));

        for (const rec of recordsToUpdate) {
            // Cập nhật status trong data JSON
            const newData = { ...rec.data, STATUS: targetStatus };
            await saveChinhLyRecord({ ...rec, data: newData });
            count++;
        }

        await loadData();
        setIsSaving(false);
        setSelectedGroups(new Set());
        notify(`Đã cập nhật trạng thái cho ${count} dòng dữ liệu.`, 'success');
    };

    // --- GROUPING & FILTERING LOGIC ---
    const groupedList = useMemo(() => {
        let list = savedList;

        // 1. Filter by Tab (Status)
        list = list.filter(item => {
            const status = item.data.STATUS || 'pending';
            return status === listTab;
        });

        // 2. Filter by Search (Dùng search term riêng của tab hiện tại)
        const currentSearchTerm = searchTerms[listTab];
        if (currentSearchTerm) {
            const lower = currentSearchTerm.toLowerCase();
            list = list.filter(item => 
                (item.customer_name || '').toLowerCase().includes(lower) ||
                (item.data.XA || '').toLowerCase().includes(lower) ||
                (item.data.SO_HD || '').toLowerCase().includes(lower)
            );
        }

        // 3. Sort by SO_HD
        list.sort((a, b) => {
            const hdA = a.data.SO_HD || '';
            const hdB = b.data.SO_HD || '';
            if (!hdA && !hdB) return 0;
            if (!hdA) return 1;
            if (!hdB) return -1;
            return hdA.localeCompare(hdB);
        });

        return list;
    }, [savedList, searchTerms, listTab]);

    const getRowSpan = (index: number, field: string) => {
        const current = groupedList[index];
        const prev = groupedList[index - 1];
        
        if (!current.data.SO_HD) return 1;

        if (prev && prev.data.SO_HD === current.data.SO_HD) {
            return 0; // Đã được gộp
        }

        let count = 1;
        for (let i = index + 1; i < groupedList.length; i++) {
            if (groupedList[i].data.SO_HD === current.data.SO_HD) {
                count++;
            } else {
                break;
            }
        }
        return count;
    };
    
    const getGroupSTT = (index: number) => {
        const current = groupedList[index];
        if (!current.data.SO_HD) return index + 1;

        let firstIdx = index;
        while(firstIdx > 0 && groupedList[firstIdx - 1].data.SO_HD === current.data.SO_HD) {
            firstIdx--;
        }
        
        let groupCount = 0;
        let i = 0;
        while (i < firstIdx) {
            groupCount++;
            const hd = groupedList[i].data.SO_HD;
            if (hd) {
                while (i < firstIdx && groupedList[i].data.SO_HD === hd) i++;
            } else {
                i++;
            }
        }
        return groupCount + 1;
    }

    const handleExportExcel = () => {
        if (groupedList.length === 0) { notify("Danh sách trống.", 'error'); return; }

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([]);

        // UPDATED TITLE & FOOTER
        const title1 = "DANH SÁCH CUNG CẤP SỐ THỬA CHÍNH THỨC";
        const title2 = "CHI NHÁNH HỚN QUẢN";
        
        // Header: Bỏ cột Ghi chú, đổi tên cột Số HĐ
        const header1 = ["STT", "Xã, Phường", "Thông tin trước biến động", "", "", "", "Thông tin sau biến động", "", "", "", "", "Thông tin QH / DT thu hồi", "Tổng DT (m2)", "Căn cứ pháp lý", "Ghi chú (Số hợp đồng)"];
        const header2 = ["", "", "Tờ BĐĐC", "Số thửa", "Diện tích (m2)", "Loại đất", "Tờ BĐĐC", "Số thửa tạm", "Số thửa chính thức", "Diện tích (m2)", "Loại đất", "", "", "", ""];

        XLSX.utils.sheet_add_aoa(ws, [
            [title1],
            [title2],
            [""],
            header1,
            header2
        ], { origin: "A1" });

        // Cấu hình in khổ A3 Ngang
        ws['!pageSetup'] = { 
            paperSize: 8, // 8 = A3
            orientation: 'landscape', 
            fitToWidth: 1, 
            fitToHeight: 0 
        };
        ws['!margins'] = { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 };

        const dataRows: any[] = [];
        const merges: any[] = [];
        const totalCols = 14; // 15 columns total (0-14)
        
        // Merge Title (Row 0 & 1)
        merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: totalCols } }); 
        merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: totalCols } }); 

        // Merge Headers (Row 3 & 4)
        merges.push({ s: { r: 3, c: 0 }, e: { r: 4, c: 0 } }); // STT
        merges.push({ s: { r: 3, c: 1 }, e: { r: 4, c: 1 } }); // Xã
        merges.push({ s: { r: 3, c: 2 }, e: { r: 3, c: 5 } }); // Trước BĐ (4 cols)
        merges.push({ s: { r: 3, c: 6 }, e: { r: 3, c: 10 } }); // Sau BĐ (5 cols)
        
        // Merge các cột đơn lẻ còn lại ở header (11, 12, 13, 14)
        for (let c = 11; c <= totalCols; c++) {
            merges.push({ s: { r: 3, c: c }, e: { r: 4, c: c } });
        }

        let currentRow = 5; // Start data at A6

        for (let i = 0; i < groupedList.length; i++) {
            const item = groupedList[i];
            const d = item.data;
            const span = getRowSpan(i, 'SO_HD');
            
            dataRows.push([
                span > 0 ? getGroupSTT(i) : '', 
                span > 0 ? d.XA : '',           
                d.TO_CU, d.THUA_CU, d.DT_CU, d.LOAI_DAT_CU,
                d.TO_MOI, d.THUA_TAM, d.THUA_CHINH_THUC, d.DT_MOI, d.LOAI_DAT_MOI,
                d.THONG_TIN_QH, 
                d.TONG_DT,
                span > 0 ? d.CAN_CU_PHAP_LY : '', 
                span > 0 ? d.SO_HD : '', // Đưa Số HĐ vào cột cuối (đã đổi tên thành Ghi chú)
            ]);

            if (span > 1) {
                // Merge common cols: STT(0), Xa(1), CanCu(13), GhiChu/SoHD(14)
                [0, 1, 13, 14].forEach(colIdx => {
                    merges.push({ s: { r: currentRow, c: colIdx }, e: { r: currentRow + span - 1, c: colIdx } });
                });
            }
            currentRow++;
        }

        XLSX.utils.sheet_add_aoa(ws, dataRows, { origin: "A6" });
        
        // NEW FOOTER
        const footerStartRow = currentRow + 1; // 1 spacer row
        const currentYear = new Date().getFullYear();

        // CHÚ Ý: Footer Text được đặt ở Index 11 (start column of right merge)
        // Mảng dữ liệu: Index 0=Left, Index 1..10=Empty, Index 11=Right
        const footerData = [
            [`Ngày      tháng      năm ${currentYear}`, "", "", "", "", "", "", "", "", "", "", `Ngày      tháng      năm ${currentYear}`],
            ["Người đề xuất", "", "", "", "", "", "", "", "", "", "", "Giám Đốc"]
        ];

        XLSX.utils.sheet_add_aoa(ws, footerData, { origin: { r: footerStartRow, c: 0 } });

        // Footer Merges: Left side (0-3) and Right side (11-14)
        merges.push({ s: { r: footerStartRow, c: 0 }, e: { r: footerStartRow, c: 3 } });
        merges.push({ s: { r: footerStartRow + 1, c: 0 }, e: { r: footerStartRow + 1, c: 3 } });
        
        merges.push({ s: { r: footerStartRow, c: 11 }, e: { r: footerStartRow, c: 14 } });
        merges.push({ s: { r: footerStartRow + 1, c: 11 }, e: { r: footerStartRow + 1, c: 14 } });

        ws['!merges'] = merges;

        // Styles
        const titleStyle = { font: { bold: true, sz: 14, name: "Times New Roman" }, alignment: { horizontal: "center" } };
        const headerStyle = { font: { bold: true, sz: 11, name: "Times New Roman" }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }, fill: { fgColor: { rgb: "E0E0E0" } } };
        const cellStyle = { font: { sz: 11, name: "Times New Roman" }, border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }, alignment: { vertical: "center", wrapText: true } };
        const centerStyle = { ...cellStyle, alignment: { ...cellStyle.alignment, horizontal: "center" } };
        const footerStyle = { font: { bold: true, sz: 12, name: "Times New Roman" }, alignment: { horizontal: "center" } };
        const footerDateStyle = { font: { italic: true, sz: 12, name: "Times New Roman" }, alignment: { horizontal: "center" } };

        // Apply Title Styles
        if(ws['A1']) ws['A1'].s = titleStyle;
        if(ws['A2']) ws['A2'].s = titleStyle;

        // Apply Header Styles (Rows 3, 4)
        for (let r = 3; r <= 4; r++) {
            for (let c = 0; c <= totalCols; c++) {
                const ref = XLSX.utils.encode_cell({ r, c });
                if (!ws[ref]) ws[ref] = { v: "", t: "s" };
                ws[ref].s = headerStyle;
            }
        }

        // Apply Data Styles
        for (let r = 5; r < 5 + dataRows.length; r++) {
            for (let c = 0; c <= totalCols; c++) {
                const ref = XLSX.utils.encode_cell({ r, c });
                if (!ws[ref]) ws[ref] = { v: "", t: "s" };
                if ([0, 2, 3, 6, 7, 8, 14].includes(c)) ws[ref].s = centerStyle;
                else ws[ref].s = cellStyle;
            }
        }

        // Apply Footer Styles (NO BORDER)
        const giaoRef = XLSX.utils.encode_cell({ r: footerStartRow, c: 0 });
        const giaoNoteRef = XLSX.utils.encode_cell({ r: footerStartRow + 1, c: 0 });
        const nhanRef = XLSX.utils.encode_cell({ r: footerStartRow, c: 11 });
        const nhanNoteRef = XLSX.utils.encode_cell({ r: footerStartRow + 1, c: 11 });

        if(ws[giaoRef]) ws[giaoRef].s = footerDateStyle;
        if(ws[giaoNoteRef]) ws[giaoNoteRef].s = footerStyle;
        if(ws[nhanRef]) ws[nhanRef].s = footerDateStyle;
        if(ws[nhanNoteRef]) ws[nhanNoteRef].s = footerStyle;

        // Tăng độ rộng cột cho khổ A3
        ws['!cols'] = [
            { wch: 6 },  { wch: 18 }, // STT, Xã
            { wch: 7 },  { wch: 7 },  { wch: 10 }, { wch: 10 }, // Trước BĐ
            { wch: 7 },  { wch: 7 },  { wch: 10 }, { wch: 10 }, { wch: 10 }, // Sau BĐ
            { wch: 25 }, // Thông tin QH
            { wch: 12 }, { wch: 30 }, { wch: 25 } // Tổng DT, Căn cứ, Ghi chú (Số HĐ)
        ];

        XLSX.utils.book_append_sheet(wb, ws, "DS_ChinhLy");
        XLSX.writeFile(wb, `DS_ChinhLy_${listTab}_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const commonInputClass = "w-full border border-gray-300 rounded px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white";
    const detailInputClass = "w-full border-none bg-transparent px-1 py-2 text-sm text-center focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none h-full";

    return (
        <div className="flex flex-col h-full bg-[#f1f5f9]">
            {/* SUB-HEADER TABS */}
            <div className="flex items-center gap-2 px-4 pt-2 border-b border-gray-200 bg-white shadow-sm shrink-0 z-20">
                <button onClick={() => { setMode('create'); handleReset(); }} className={`flex items-center gap-2 px-4 py-2 text-sm font-bold border-b-2 transition-colors ${mode === 'create' ? 'border-orange-600 text-orange-600 bg-orange-50/50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    <Plus size={16} /> Nhập liệu
                </button>
                <button onClick={() => setMode('list')} className={`flex items-center gap-2 px-4 py-2 text-sm font-bold border-b-2 transition-colors ${mode === 'list' ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    <List size={16} /> Danh sách
                </button>
            </div>

            <div className="flex-1 overflow-hidden p-4">
                {mode === 'create' ? (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 h-full flex flex-col overflow-hidden max-w-[1600px] mx-auto">
                        
                        {/* 1. HEADER: COMMON INFO */}
                        <div className="p-4 bg-gray-50 border-b border-gray-200">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                    <Layers size={18} className="text-blue-600"/> 
                                    {editingGroupId ? `Đang chỉnh sửa hồ sơ: ${editingGroupId}` : 'Thông tin chung (Nhóm)'}
                                </h3>
                                
                                {!editingGroupId && (
                                    <div className="flex gap-2">
                                        <div className="relative">
                                            <input 
                                                className="pl-8 pr-3 py-1.5 text-sm border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-48" 
                                                placeholder="Mã HS..."
                                                value={searchQuery}
                                                onChange={e => setSearchQuery(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && handleSearchAndFill()}
                                            />
                                            <Search size={14} className="absolute left-2.5 top-2.5 text-blue-400" />
                                        </div>
                                        <button onClick={handleSearchAndFill} className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-200">Điền</button>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                <div className="md:col-span-3">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Xã / Phường *</label>
                                    <select 
                                        className={commonInputClass}
                                        value={commonData.XA}
                                        onChange={e => setCommonData({...commonData, XA: e.target.value})}
                                    >
                                        <option value="">-- Chọn Xã/Phường --</option>
                                        {HON_QUAN_WARDS.map(w => (
                                            <option key={w} value={w}>{w}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Số Hợp đồng / Mã HS *</label>
                                    <input className={`${commonInputClass} font-mono font-bold text-blue-700`} value={commonData.SO_HD} onChange={e => setCommonData({...commonData, SO_HD: e.target.value})} placeholder="0902/HĐ..." />
                                </div>
                                <div className="md:col-span-4">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Căn cứ pháp lý</label>
                                    <input className={commonInputClass} value={commonData.CAN_CU_PHAP_LY} onChange={e => setCommonData({...commonData, CAN_CU_PHAP_LY: e.target.value})} />
                                </div>
                                <div className="md:col-span-3">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ghi chú</label>
                                    <input className={commonInputClass} value={commonData.GHI_CHU} onChange={e => setCommonData({...commonData, GHI_CHU: e.target.value})} />
                                </div>
                            </div>
                        </div>

                        {/* 2. BODY: DETAIL LIST TABLE */}
                        <div className="flex-1 overflow-auto bg-white relative">
                            <table className="w-full border-collapse min-w-[1200px]">
                                <thead className="bg-gray-100 text-xs font-bold text-gray-600 uppercase sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="p-2 border w-10 bg-gray-200">#</th>
                                        <th colSpan={4} className="p-2 border text-center bg-blue-50 text-blue-800">Thông tin Trước Biến Động</th>
                                        <th colSpan={5} className="p-2 border text-center bg-green-50 text-green-800">Thông tin Sau Biến Động</th>
                                        <th className="p-2 border w-40 bg-yellow-50 text-yellow-800">TT Quy hoạch / Thu hồi</th>
                                        <th className="p-2 border w-24 bg-gray-200">Tổng DT</th>
                                        <th className="p-2 border w-10 bg-gray-200">Xóa</th>
                                    </tr>
                                    <tr>
                                        <th className="bg-gray-200 border"></th>
                                        <th className="p-2 border w-16 text-center bg-blue-50">Tờ</th>
                                        <th className="p-2 border w-16 text-center bg-blue-50">Thửa</th>
                                        <th className="p-2 border w-20 text-center bg-blue-50">DT (m2)</th>
                                        <th className="p-2 border w-20 text-center bg-blue-50">Loại đất</th>
                                        
                                        <th className="p-2 border w-16 text-center bg-green-50">Tờ</th>
                                        <th className="p-2 border w-16 text-center bg-green-50">Thửa Tạm</th>
                                        <th className="p-2 border w-20 text-center bg-green-50 text-green-700">Thửa CT</th>
                                        <th className="p-2 border w-20 text-center bg-green-50">DT (m2)</th>
                                        <th className="p-2 border w-20 text-center bg-green-50">Loại đất</th>
                                        <th className="p-2 border bg-yellow-50"></th>
                                        <th className="bg-gray-200 border"></th>
                                        <th className="bg-gray-200 border"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {detailRows.map((row, idx) => (
                                        <tr key={idx} className="border-b border-gray-200 hover:bg-blue-50/20">
                                            <td className="border text-center text-gray-400 text-xs bg-gray-50">{idx + 1}</td>
                                            
                                            {/* TRƯỚC */}
                                            <td className="border p-0"><input className={detailInputClass} value={row.TO_CU} onChange={e => handleDetailChange(idx, 'TO_CU', e.target.value)} /></td>
                                            <td className="border p-0"><input className={detailInputClass} value={row.THUA_CU} onChange={e => handleDetailChange(idx, 'THUA_CU', e.target.value)} /></td>
                                            <td className="border p-0"><input className={detailInputClass} value={row.DT_CU} onChange={e => handleDetailChange(idx, 'DT_CU', e.target.value)} /></td>
                                            <td className="border p-0"><input className={detailInputClass} value={row.LOAI_DAT_CU} onChange={e => handleDetailChange(idx, 'LOAI_DAT_CU', e.target.value)} /></td>

                                            {/* SAU */}
                                            <td className="border p-0"><input className={detailInputClass} value={row.TO_MOI} onChange={e => handleDetailChange(idx, 'TO_MOI', e.target.value)} /></td>
                                            <td className="border p-0"><input className={detailInputClass} value={row.THUA_TAM} onChange={e => handleDetailChange(idx, 'THUA_TAM', e.target.value)} /></td>
                                            <td className="border p-0"><input className={`${detailInputClass} font-bold text-green-700 bg-green-50/30`} value={row.THUA_CHINH_THUC} onChange={e => handleDetailChange(idx, 'THUA_CHINH_THUC', e.target.value)} /></td>
                                            <td className="border p-0"><input className={detailInputClass} value={row.DT_MOI} onChange={e => handleDetailChange(idx, 'DT_MOI', e.target.value)} /></td>
                                            <td className="border p-0"><input className={detailInputClass} value={row.LOAI_DAT_MOI} onChange={e => handleDetailChange(idx, 'LOAI_DAT_MOI', e.target.value)} /></td>

                                            {/* THONG TIN QH */}
                                            <td className="border p-0"><input className={`${detailInputClass} bg-yellow-50/30 text-left px-2`} value={row.THONG_TIN_QH || ''} onChange={e => handleDetailChange(idx, 'THONG_TIN_QH', e.target.value)} placeholder="..." /></td>

                                            <td className="border p-0"><input className={`${detailInputClass} font-bold`} value={row.TONG_DT} onChange={e => handleDetailChange(idx, 'TONG_DT', e.target.value)} /></td>
                                            
                                            <td className="border text-center">
                                                <button onClick={() => handleRemoveDetailRow(idx)} className="text-gray-300 hover:text-red-500 p-1"><X size={16}/></button>
                                            </td>
                                        </tr>
                                    ))}
                                    <tr>
                                        <td colSpan={13} className="p-2 border-t bg-gray-50">
                                            <button onClick={handleAddDetailRow} className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 mx-auto px-3 py-1 bg-white border border-blue-200 rounded-full shadow-sm hover:shadow">
                                                <Plus size={14}/> Thêm dòng thửa đất
                                            </button>
                                        </td>
                                    </tr>
                                </tbody>
                                {/* FOOTER: HIỂN THỊ TỔNG CỘNG ĐỂ KIỂM TRA */}
                                <tfoot>
                                    <tr className="bg-gray-100 font-bold border-t-2 border-gray-300 text-sm">
                                        <td colSpan={3} className="p-2 text-right text-gray-600 border-r border-gray-200">Tổng cộng Trước:</td>
                                        <td className={`p-2 text-center border-r border-gray-200 ${calculateTotals.isMismatch ? 'text-red-600' : 'text-blue-600'}`}>
                                            {calculateTotals.totalBefore}
                                        </td>
                                        <td className="p-2 border-r border-gray-200"></td>
                                        <td colSpan={3} className="p-2 text-right text-gray-600 border-r border-gray-200">Tổng cộng Sau:</td>
                                        <td className={`p-2 text-center border-r border-gray-200 ${calculateTotals.isMismatch ? 'text-red-600' : 'text-green-600'}`}>
                                            {calculateTotals.totalAfter}
                                        </td>
                                        <td colSpan={3} className="p-2 text-left">
                                            {calculateTotals.isMismatch ? (
                                                <span className="text-xs text-red-500 flex items-center gap-1 animate-pulse">
                                                    <AlertTriangle size={14}/> Lệch {calculateTotals.diff} m²
                                                </span>
                                            ) : (
                                                <span className="text-xs text-green-600 flex items-center gap-1">
                                                    <CheckCircle2 size={14}/> Khớp
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* 3. FOOTER: ACTIONS */}
                        <div className="p-4 border-t border-gray-200 bg-white flex justify-between items-center shrink-0">
                            <button onClick={() => { setMode('list'); handleReset(); }} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium text-sm">Hủy bỏ</button>
                            <button onClick={handleSaveGroup} disabled={isSaving} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-md flex items-center gap-2">
                                <Save size={18}/> {editingGroupId ? 'Cập nhật Nhóm' : 'Lưu Danh Sách'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 h-full flex flex-col overflow-hidden">
                        {/* LIST SUB-NAVIGATION */}
                        <div className="flex border-b border-gray-200 bg-gray-50 px-4">
                            <button 
                                onClick={() => setListTab('pending')}
                                className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${listTab === 'pending' ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                            >
                                <List size={16} /> Chờ lập danh sách
                            </button>
                            <button 
                                onClick={() => setListTab('sent')}
                                className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${listTab === 'sent' ? 'border-green-600 text-green-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                            >
                                <FolderCheck size={16} /> Đã chuyển chỉnh lý
                            </button>
                        </div>

                        {/* List Toolbar */}
                        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-white">
                            <div className="relative w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <input 
                                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none" 
                                    placeholder="Tìm kiếm..." 
                                    // Thay đổi: Dùng search term riêng cho từng tab
                                    value={searchTerms[listTab]}
                                    onChange={e => setSearchTerms(prev => ({ ...prev, [listTab]: e.target.value }))}
                                />
                            </div>
                            
                            <div className="flex items-center gap-2">
                                {/* TRANSFER BUTTON (Only visible in Pending Tab with Selection) */}
                                {listTab === 'pending' && selectedGroups.size > 0 && (
                                    <button 
                                        onClick={() => handleChangeStatus('sent')} 
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 shadow-sm animate-pulse"
                                    >
                                        <ArrowRight size={16} /> Lập danh sách ({selectedGroups.size})
                                    </button>
                                )}

                                {/* REVERT BUTTON (Only visible in Sent Tab with Selection) */}
                                {listTab === 'sent' && selectedGroups.size > 0 && (
                                    <button 
                                        onClick={() => handleChangeStatus('pending')} 
                                        className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-bold hover:bg-orange-700 shadow-sm"
                                    >
                                        <RotateCcw size={16} /> Trả lại danh sách ({selectedGroups.size})
                                    </button>
                                )}

                                <button onClick={handleExportExcel} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 shadow-sm">
                                    <FileSpreadsheet size={16} /> Xuất Excel
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-left border-collapse text-sm">
                                <thead className="bg-gray-100 text-gray-600 font-bold sticky top-0 shadow-sm z-10 text-xs uppercase">
                                    <tr>
                                        {/* CHECKBOX HEADER */}
                                        <th className="p-3 border-b border-r w-10 text-center bg-gray-200">
                                            <button onClick={toggleSelectAll}>
                                                {selectedGroups.size > 0 && selectedGroups.size === new Set(groupedList.map(i => i.data.SO_HD)).size 
                                                    ? <CheckSquare size={16} className="text-blue-600" /> 
                                                    : <Square size={16} className="text-gray-400" />
                                                }
                                            </button>
                                        </th>
                                        <th className="p-3 border-b text-center w-12 border-r bg-gray-200">STT</th>
                                        <th className="p-3 border-b border-r w-[150px] bg-white">Xã / Phường</th>
                                        <th className="p-3 border-b border-r min-w-[200px] bg-white">Thông tin Trước BĐ</th>
                                        <th className="p-3 border-b border-r min-w-[200px] bg-white">Thông tin Sau BĐ</th>
                                        <th className="p-3 border-b border-r w-[120px] bg-white">Thông tin QH</th>
                                        <th className="p-3 border-b border-r w-[80px] bg-white">Tổng DT</th>
                                        <th className="p-3 border-b border-r w-[150px] bg-white">Căn cứ pháp lý</th>
                                        <th className="p-3 border-b border-r w-[100px] bg-white">Số HĐ</th>
                                        <th className="p-3 border-b border-r w-[150px] bg-white">Ghi chú</th>
                                        <th className="p-3 border-b w-[80px] text-center bg-gray-200 sticky right-0">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {groupedList.length > 0 ? groupedList.map((item, idx) => {
                                        // Logic Merge Rows
                                        const rowSpan = getRowSpan(idx, 'SO_HD');
                                        const shouldRenderCommon = rowSpan > 0;
                                        const isFirstInGroup = shouldRenderCommon; // Dòng đầu của nhóm
                                        
                                        const rowClass = isFirstInGroup ? "border-t-2 border-gray-300" : "hover:bg-blue-50/30";
                                        const isSelected = item.data.SO_HD && selectedGroups.has(item.data.SO_HD);

                                        return (
                                            <tr key={item.id} className={`${rowClass} ${isSelected ? 'bg-blue-50' : ''}`}>
                                                {/* CHECKBOX COLUMN (Render with RowSpan) */}
                                                {shouldRenderCommon && (
                                                    <td className="p-3 text-center border-r align-middle bg-white" rowSpan={rowSpan}>
                                                        <button onClick={() => toggleSelectGroup(item.data.SO_HD)}>
                                                            {isSelected ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} className="text-gray-300" />}
                                                        </button>
                                                    </td>
                                                )}

                                                {/* COMMON COLUMNS (Render with RowSpan) */}
                                                {shouldRenderCommon && (
                                                    <td className="p-3 text-center text-gray-500 border-r align-middle bg-white" rowSpan={rowSpan}>
                                                        {getGroupSTT(idx)}
                                                    </td>
                                                )}
                                                
                                                {shouldRenderCommon && (
                                                    <td className="p-3 font-bold text-gray-800 border-r align-middle bg-white" rowSpan={rowSpan}>
                                                        {item.data.XA}
                                                    </td>
                                                )}

                                                {/* DETAIL COLUMNS (Always render) */}
                                                <td className="p-2 border-r text-xs">
                                                    {/* ĐÃ BỎ HIỂN THỊ TÊN CHỦ */}
                                                    <div>Tờ: <b>{item.data.TO_CU}</b> - Thửa: <b>{item.data.THUA_CU}</b></div>
                                                    <div>DT: {item.data.DT_CU} ({item.data.LOAI_DAT_CU})</div>
                                                </td>
                                                <td className="p-2 border-r text-xs">
                                                    <div>Tờ: <b>{item.data.TO_MOI}</b></div>
                                                    <div>Tạm: {item.data.THUA_TAM} <span className="text-gray-300">|</span> CT: <b className="text-green-700">{item.data.THUA_CHINH_THUC}</b></div>
                                                    <div>DT: {item.data.DT_MOI} ({item.data.LOAI_DAT_MOI})</div>
                                                </td>
                                                
                                                <td className="p-2 border-r text-xs italic text-gray-600">
                                                    {item.data.THONG_TIN_QH || ''}
                                                </td>

                                                {/* COMMON COLUMNS (Right side) */}
                                                {shouldRenderCommon && (
                                                    <td className="p-3 text-center border-r align-middle font-bold bg-white" rowSpan={rowSpan}>
                                                        {item.data.TONG_DT}
                                                    </td>
                                                )}
                                                {shouldRenderCommon && (
                                                    <td className="p-3 text-xs text-gray-500 border-r align-middle bg-white" rowSpan={rowSpan}>
                                                        {item.data.CAN_CU_PHAP_LY}
                                                    </td>
                                                )}
                                                {shouldRenderCommon && (
                                                    <td className="p-3 text-center font-mono text-xs font-bold text-blue-600 border-r align-middle bg-white" rowSpan={rowSpan}>
                                                        {item.data.SO_HD}
                                                    </td>
                                                )}
                                                {shouldRenderCommon && (
                                                    <td className="p-3 text-xs text-gray-500 border-r align-middle italic bg-white" rowSpan={rowSpan}>
                                                        {item.data.GHI_CHU}
                                                    </td>
                                                )}

                                                {/* ACTION COLUMN */}
                                                {shouldRenderCommon && (
                                                    <td className="p-3 text-center align-middle bg-white sticky right-0 shadow-l" rowSpan={rowSpan}>
                                                        <div className="flex flex-col gap-2 items-center">
                                                            <button onClick={() => handleEditGroup(item.data.SO_HD)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded border border-blue-200 bg-blue-50" title="Sửa nhóm"><Edit size={14}/></button>
                                                            <button onClick={() => handleDeleteGroup(item.data.SO_HD)} className="p-1.5 text-red-500 hover:bg-red-100 rounded border border-red-200 bg-red-50" title="Xóa nhóm"><Trash2 size={14}/></button>
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    }) : (
                                        <tr><td colSpan={11} className="p-8 text-center text-gray-400 italic">Chưa có dữ liệu.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChinhLyBienDongTab;
