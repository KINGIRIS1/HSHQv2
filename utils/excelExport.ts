
import * as XLSX from 'xlsx-js-style';
import { RecordFile, RecordStatus, Employee } from '../types';
import { getNormalizedWard, getShortRecordType, STATUS_LABELS } from '../constants';
import { isRecordOverdue, removeVietnameseTones, cleanSyncNotes } from './appHelpers';
import { fetchContracts } from '../services/api';

/**
 * Tự động tính toán độ rộng cột trong Excel vừa vặn với nội dung chữ Tiếng Việt
 */
export const autoFitColumns = (ws: XLSX.WorkSheet, minWidth = 8, maxWidth = 60) => {
    if (!ws['!ref']) return;
    const range = XLSX.utils.decode_range(ws['!ref']);
    const colWidths: { wch: number }[] = [];

    for (let C = range.s.c; C <= range.e.c; ++C) {
        let maxLen = minWidth;
        for (let R = range.s.r; R <= range.e.r; ++R) {
            // Tránh tính toán trên các dòng tiêu đề/banner gộp ô ở đầu trang
            if (R < 6 && (C === 0 || range.e.c > 5)) continue;
            const cellRef = XLSX.utils.encode_cell({ c: C, r: R });
            const cell = ws[cellRef];
            if (cell && cell.v !== undefined && cell.v !== null) {
                const valStr = String(cell.v);
                const lines = valStr.split('\n');
                for (const line of lines) {
                    const len = Math.ceil(line.length * 1.2) + 3;
                    if (len > maxLen) maxLen = len;
                }
            }
        }
        colWidths.push({ wch: Math.min(Math.max(maxLen, minWidth), maxWidth) });
    }
    ws['!cols'] = colWidths;
};

export const exportReportToExcel = async (
    records: RecordFile[], 
    fromDateStr: string, 
    toDateStr: string,
    ward: string,
    employees: Employee[],
    customTitle?: string
) => {
    const from = new Date(fromDateStr);
    from.setHours(0, 0, 0, 0);
    const to = new Date(toDateStr);
    to.setHours(23, 59, 59, 999);

    // Filter records: If customTitle is provided or ward is PRE_FILTERED, use pre-filtered records directly
    const filtered = (customTitle || ward === 'PRE_FILTERED') ? records : records.filter(r => {
        if (!r.receivedDate) return false;
        const rDate = new Date(r.receivedDate);
        const matchDate = rDate >= from && rDate <= to;
        
        let matchWard = true;
        if (ward && ward !== 'all') {
            const rWard = removeVietnameseTones(r.ward || '');
            const filterWard = removeVietnameseTones(ward);
            matchWard = rWard.includes(filterWard);
        }

        return matchDate && matchWard;
    });

    if (filtered.length === 0) {
        alert("Không có hồ sơ nào trong khoảng thời gian và địa bàn này.");
        return;
    }

    // Tên tiêu đề động theo xã
    const wardTitle = (ward && ward !== 'all') ? ` - ${ward.toUpperCase()}` : "";
    const reportTitle = customTitle ? `${customTitle}${wardTitle}` : `BÁO CÁO TÌNH HÌNH TIẾP NHẬN VÀ GIẢI QUYẾT HỒ SƠ${wardTitle}`;
    const safeWardName = ward === 'all' ? 'Tong_Hop' : ward.replace(/\s/g, '_');
    const fileName = `Bao_Cao_${safeWardName}_${fromDateStr}_${toDateStr}.xlsx`;

    try {
        const wb = await createRecordsWorkbook(filtered, employees, reportTitle);
        XLSX.writeFile(wb, fileName);
    } catch (err: any) {
        alert(err.message || "Lỗi khi xuất file Excel báo cáo.");
    }
};

export const exportDailyStatsToExcel = async (
    records: RecordFile[], 
    employees: Employee[], 
    receiveFrom: string, 
    receiveTo: string, 
    deadlineFrom: string, 
    deadlineTo: string, 
    assignedFrom?: string, 
    assignedTo?: string, 
    handoverFrom?: string, 
    handoverTo?: string
) => {
    if (records.length === 0) {
        alert("Không có hồ sơ nào để xuất.");
        return;
    }

    const formatDate = (d: string | undefined | null) => {
        if (!d) return '';
        const date = new Date(d);
        if (isNaN(date.getTime())) return '';
        return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
    };

    let subtitle = "THỐNG KÊ HỒ SƠ THEO NGÀY";
    const details: string[] = [];
    if (receiveFrom || receiveTo) {
        details.push(`Tiếp nhận: ${receiveFrom ? formatDate(receiveFrom) : '...'} - ${receiveTo ? formatDate(receiveTo) : '...'}`);
    }
    if (deadlineFrom || deadlineTo) {
        details.push(`Hẹn trả: ${deadlineFrom ? formatDate(deadlineFrom) : '...'} - ${deadlineTo ? formatDate(deadlineTo) : '...'}`);
    }
    if (assignedFrom || assignedTo) {
        details.push(`Giao NV: ${assignedFrom ? formatDate(assignedFrom) : '...'} - ${assignedTo ? formatDate(assignedTo) : '...'}`);
    }
    if (handoverFrom || handoverTo) {
        details.push(`Giao 1 cửa: ${handoverFrom ? formatDate(handoverFrom) : '...'} - ${handoverTo ? formatDate(handoverTo) : '...'}`);
    }

    const titleText = details.length > 0 ? `${subtitle} (${details.join(', ')})` : subtitle;

    try {
        const wb = await createRecordsWorkbook(records, employees, titleText);
        const fileName = `ThongKe_TheoNgay_${new Date().getTime()}.xlsx`;
        XLSX.writeFile(wb, fileName);
    } catch (err: any) {
        alert(err.message || "Lỗi khi xuất file Excel thống kê.");
    }
};

export const exportReturnedListToExcel = (records: RecordFile[], fromDateStr?: string, toDateStr?: string, wardName?: string) => {
    if (records.length === 0) {
        alert("Không có hồ sơ nào để xuất.");
        return;
    }

    const formatDate = (d: string | undefined | null) => {
        if (!d) return '';
        const date = new Date(d);
        if (isNaN(date.getTime())) return '';
        return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
    };

    const tableHeader = [
        "STT", 
        "Mã Hồ Sơ", 
        "Chủ Sử Dụng", 
        "Địa Chỉ", 
        "Tờ", 
        "Thửa", 
        "Loại Hồ Sơ", 
        "Số Biên Lai", 
        "Ngày Hẹn", 
        "Ngày Trả Kết Quả", 
        "Người Nhận", 
        "Ghi Chú"
    ];

    const dataRows = records.map((r, i) => [
        i + 1,
        r.code,
        r.customerName,
        getNormalizedWard(r.ward || undefined),
        r.mapSheet || '', 
        r.landPlot || '', 
        getShortRecordType(r.recordType || undefined),
        r.receiptNumber || '',
        formatDate(r.deadline),
        formatDate(r.resultReturnedDate),
        r.receiverName || '',
        cleanSyncNotes(r.notes) || ''
    ]);

    let displayDate = "";
    if (fromDateStr && toDateStr && fromDateStr !== toDateStr) {
        displayDate = `TỪ NGÀY ${formatDate(fromDateStr)} ĐẾN NGÀY ${formatDate(toDateStr)}`;
    } else if (fromDateStr) {
        displayDate = `NGÀY ${formatDate(fromDateStr)}`;
    } else {
        displayDate = `TÍNH ĐẾN NGÀY ${new Date().toLocaleDateString('vi-VN')}`;
    }

    let title = "DANH SÁCH HỒ SƠ ĐÃ TRẢ KẾT QUẢ";
    if (wardName && wardName !== 'all') {
        title += ` - ${wardName.toUpperCase()}`;
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([]);

    const border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
    const titleStyle = { font: { name: "Times New Roman", sz: 14, bold: true }, alignment: { horizontal: "center", vertical: "center" } };
    
    const headerStyle = { 
        font: { name: "Times New Roman", sz: 11, bold: true }, 
        border, 
        fill: { fgColor: { rgb: "E0E0E0" } }, 
        alignment: { horizontal: "center", vertical: "center", wrapText: true } 
    };

    const cellStyle = { 
        font: { name: "Times New Roman", sz: 11 }, 
        border, 
        alignment: { horizontal: "left", vertical: "center", wrapText: true } 
    };
    const centerStyle = { ...cellStyle, alignment: { horizontal: "center", vertical: "center", wrapText: true } };

    XLSX.utils.sheet_add_aoa(ws, [
        ["CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"],
        ["Độc lập - Tự do - Hạnh phúc"],
        [""],
        [title], 
        [displayDate.toUpperCase()],
        [""],
        tableHeader
    ], { origin: "A1" });

    XLSX.utils.sheet_add_aoa(ws, dataRows, { origin: "A8" });

    const totalCols = tableHeader.length - 1;
    if(!ws['!merges']) ws['!merges'] = [];
    ws['!merges'].push(
        { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: totalCols } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: totalCols } },
        { s: { r: 4, c: 0 }, e: { r: 4, c: totalCols } }
    );

    ws['!cols'] = [
        { wch: 5 }, { wch: 18 }, { wch: 22 }, { wch: 18 }, { wch: 7 }, { wch: 7 }, { wch: 20 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 35 }
    ];

    if(ws['A1']) ws['A1'].s = titleStyle;
    if(ws['A2']) ws['A2'].s = { font: { name: "Times New Roman", sz: 12, bold: true, underline: true }, alignment: { horizontal: "center", vertical: "center" } };
    if(ws['A4']) ws['A4'].s = { font: { name: "Times New Roman", sz: 14, bold: true, color: { rgb: "0000FF" } }, alignment: { horizontal: "center", vertical: "center" } };
    if(ws['A5']) ws['A5'].s = { font: { name: "Times New Roman", sz: 12, italic: true }, alignment: { horizontal: "center", vertical: "center" } };

    const headerRow = 6;
    const dataStart = 7;
    
    for (let c = 0; c <= totalCols; c++) {
        const headerRef = XLSX.utils.encode_cell({ r: headerRow, c });
        if (!ws[headerRef]) ws[headerRef] = { v: "", t: "s" };
        ws[headerRef].s = headerStyle; 

        for (let r = dataStart; r < dataStart + dataRows.length; r++) {
            const cellRef = XLSX.utils.encode_cell({ r, c });
            if (!ws[cellRef]) ws[cellRef] = { v: "", t: "s" };
            
            if ([0, 4, 5, 7, 8, 9].includes(c)) ws[cellRef].s = centerStyle;
            else ws[cellRef].s = cellStyle;
        }
    }

    const footerStart = dataStart + dataRows.length + 2;
    const numCols = tableHeader.length;
    let blockWidth = Math.floor(numCols / 3);
    if (blockWidth < 3) blockWidth = Math.min(3, Math.floor(numCols / 2));
    if (blockWidth < 2) blockWidth = 2;

    const leftStart = 0;
    const leftEnd = Math.min(leftStart + blockWidth - 1, Math.floor(totalCols / 2) - 1);
    const rightEnd = totalCols;
    const rightStart = Math.max(leftEnd + 1, rightEnd - blockWidth + 1);

    const footerRow1 = new Array(numCols).fill("");
    const footerRow2 = new Array(numCols).fill("");
    footerRow1[leftStart] = "NGƯỜI LẬP BIỂU";
    footerRow2[leftStart] = "(Ký, họ tên)";
    footerRow1[rightStart] = "THỦ TRƯỞNG ĐƠN VỊ";
    footerRow2[rightStart] = "(Ký, họ tên, đóng dấu)";

    XLSX.utils.sheet_add_aoa(ws, [footerRow1, footerRow2], { origin: { r: footerStart, c: 0 } });

    ws['!merges'].push(
        { s: { r: footerStart, c: leftStart }, e: { r: footerStart, c: leftEnd } },
        { s: { r: footerStart + 1, c: leftStart }, e: { r: footerStart + 1, c: leftEnd } },
        { s: { r: footerStart, c: rightStart }, e: { r: footerStart, c: rightEnd } },
        { s: { r: footerStart + 1, c: rightStart }, e: { r: footerStart + 1, c: rightEnd } }
    );

    const footerTitleStyle = { font: { name: "Times New Roman", sz: 12, bold: true }, alignment: { horizontal: "center", vertical: "center" } };
    const footerNoteStyle = { font: { name: "Times New Roman", sz: 11, italic: true }, alignment: { horizontal: "center", vertical: "center" } };

    for (let c = leftStart; c <= leftEnd; c++) {
        const titleRef = XLSX.utils.encode_cell({ r: footerStart, c });
        const noteRef = XLSX.utils.encode_cell({ r: footerStart + 1, c });
        if (ws[titleRef]) ws[titleRef].s = footerTitleStyle;
        if (ws[noteRef]) ws[noteRef].s = footerNoteStyle;
    }
    for (let c = rightStart; c <= rightEnd; c++) {
        const titleRef = XLSX.utils.encode_cell({ r: footerStart, c });
        const noteRef = XLSX.utils.encode_cell({ r: footerStart + 1, c });
        if (ws[titleRef]) ws[titleRef].s = footerTitleStyle;
        if (ws[noteRef]) ws[noteRef].s = footerNoteStyle;
    }

    const rowsMeta: any[] = [];
    rowsMeta[0] = { hpt: 24, hpx: 30 };
    rowsMeta[1] = { hpt: 20, hpx: 25 };
    rowsMeta[2] = { hpt: 10, hpx: 12 };
    rowsMeta[3] = { hpt: 24, hpx: 30 };
    rowsMeta[4] = { hpt: 20, hpx: 25 };
    rowsMeta[5] = { hpt: 10, hpx: 12 };
    rowsMeta[6] = { hpt: 24, hpx: 30 };

    for (let r = dataStart; r < dataStart + dataRows.length; r++) {
        rowsMeta[r] = { hpt: 20, hpx: 25 };
    }

    rowsMeta[footerStart - 2] = { hpt: 12, hpx: 15 };
    rowsMeta[footerStart - 1] = { hpt: 12, hpx: 15 };
    rowsMeta[footerStart] = { hpt: 24, hpx: 30 };
    rowsMeta[footerStart + 1] = { hpt: 20, hpx: 25 };

    ws['!rows'] = rowsMeta;

    autoFitColumns(ws, 8, 55);
    XLSX.utils.book_append_sheet(wb, ws, "DS_Tra_KQ");
    
    let safeName = 'Tat_Ca';
    if (wardName && wardName !== 'all') {
        safeName = wardName.replace(/\s+/g, '_');
    }
    const fileName = `DS_Tra_KQ_${safeName}.xlsx`;
    
    XLSX.writeFile(wb, fileName);
};

export const exportOverdueStatsToExcel = async (records: any[], employees: Employee[], filterType: string) => {
    if (records.length === 0) {
        alert("Không có hồ sơ nào để xuất.");
        return;
    }

    let subtitle = "BÁO CÁO THỐNG KÊ HỒ SƠ TRỄ HẠN";
    if (filterType === 'pending') subtitle += " (CHƯA CÓ KẾT QUẢ)";
    if (filterType === 'completed') subtitle += " (ĐÃ CÓ KẾT QUẢ)";

    try {
        const wb = await createRecordsWorkbook(records, employees, subtitle);
        const fileName = `Danh_Sach_Tre_Han_${filterType}_${new Date().getTime()}.xlsx`;
        XLSX.writeFile(wb, fileName);
    } catch (err: any) {
        alert(err.message || "Lỗi khi xuất file Excel hồ sơ trễ hạn.");
    }
};

export const createRecordsWorkbook = async (
    records: RecordFile[],
    employees: Employee[],
    titleText: string = "DANH SÁCH HỒ SƠ"
) => {
    if (records.length === 0) {
        throw new Error("Không có hồ sơ nào để xuất.");
    }

    // Lấy dữ liệu hợp đồng để map giá tiền và số hợp đồng
    let contracts: any[] = [];
    try {
        contracts = await fetchContracts();
    } catch (e) {
        console.warn("Không tải được dữ liệu hợp đồng cho xuất excel.");
    }

    const getContractInfo = (recordCode: string) => {
        if (!recordCode) return { amount: '', liquidation: '', type: '' };
        const match = contracts.find(c => c.code && c.code.toLowerCase().trim() === recordCode.toLowerCase().trim());
        if (!match) return { amount: '', liquidation: '', type: '' };

        return {
            amount: match.totalAmount ? match.totalAmount.toLocaleString('vi-VN') : '',
            liquidation: match.liquidationAmount ? match.liquidationAmount.toLocaleString('vi-VN') : '',
            type: match.contractType || ''
        };
    };

    const getEmployeeName = (empId?: string) => {
        if (!empId) return '';
        const emp = employees.find(e => e.id === empId);
        return emp ? emp.name : '';
    };

    const formatDate = (d: string | undefined | null) => {
        if (!d) return '';
        const date = new Date(d);
        if (isNaN(date.getTime())) return '';
        return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
    };

    const isGiaHanList = titleText.toUpperCase().includes("GIA HẠN") || titleText.toUpperCase().includes("GIA HAN");

    let tableHeader: string[] = [];
    let colWidths: { wch: number }[] = [];
    let dataRows: any[][] = [];

    if (isGiaHanList) {
        tableHeader = [
            "STT", 
            "Mã Hồ Sơ", 
            "Chủ Sử Dụng", 
            "Xã / Phường", 
            "Tờ", 
            "Thửa", 
            "Loại Hồ Sơ", 
            "Thời Hạn Cũ", 
            "Thời Hạn Mới", 
            "Trạng Thái",
            "Giao Nhân Viên",
            "Hoàn Thành / Đợt",
            "Ghi Chú / Lý Do Gia Hạn"
        ];

        colWidths = [
            { wch: 5 },  // STT
            { wch: 18 }, // Mã Hồ Sơ
            { wch: 22 }, // Chủ Sử Dụng
            { wch: 16 }, // Xã / Phường
            { wch: 7 },  // Tờ
            { wch: 7 },  // Thửa
            { wch: 20 }, // Loại Hồ Sơ
            { wch: 12 }, // Thời Hạn Cũ
            { wch: 12 }, // Thời Hạn Mới
            { wch: 15 }, // Trạng Thái
            { wch: 18 }, // Giao Nhân Viên
            { wch: 14 }, // Hoàn Thành / Đợt
            { wch: 35 }  // Ghi Chú / Lý Do Gia Hạn (ngoài cùng bên phải)
        ];

        dataRows = records.map((r, i) => {
            const pNotes = r.privateNotes || '';
            const notes = r.notes || '';
            const oldMatch = pNotes.match(/Hạn cũ:\s*([0-9/.\-]+)/i) || notes.match(/Hạn cũ:\s*([0-9/.\-]+)/i);
            let oldDeadline = '';
            if (oldMatch && oldMatch[1]) {
                oldDeadline = oldMatch[1];
            } else if (r.deadline) {
                const d = new Date(r.deadline);
                if (!isNaN(d.getTime())) {
                    const prevD = new Date(d);
                    prevD.setDate(prevD.getDate() - 7);
                    oldDeadline = `${String(prevD.getDate()).padStart(2, '0')}/${String(prevD.getMonth() + 1).padStart(2, '0')}/${prevD.getFullYear()}`;
                }
            }

            const cleanNote = cleanSyncNotes(r.notes || r.content || '');

            return [
                i + 1,
                r.code,
                r.customerName,
                getNormalizedWard(r.ward || (r as any).assignedWard || undefined),
                r.mapSheet || '',
                r.landPlot || '',
                getShortRecordType(r.recordType || undefined),
                oldDeadline || formatDate(r.receivedDate),
                formatDate(r.deadline),
                STATUS_LABELS[r.status] || r.status,
                getEmployeeName(r.assignedTo || undefined),
                r.exportBatch || (r as any).handoverBatch || formatDate(r.completedDate),
                cleanNote
            ];
        });
    } else {
        // Cấu trúc đầy đủ 22 cột:
        // Cột cơ bản (0-9) -> Các cột giai đoạn (10-20) -> Cột Ghi chú (21)
        const fullHeader = [
            "STT", 
            "Mã Hồ Sơ", 
            "Chủ Sử Dụng", 
            "Xã / Phường", 
            "Tờ",
            "Thửa",
            "Loại Hồ Sơ", 
            "Ngày Nhận", 
            "Hẹn Trả", 
            "Trạng Thái",
            "Ngày Giao NV",
            "NV Xử Lý",
            "Ngày Trình KT",
            "Người KT",
            "Ngày Trình Ký",
            "Người Ký Duyệt",
            "Hoàn Thành",
            "Đợt",
            "Ngày Trả KQ",
            "Số BL/HĐ",
            "Số Tiền",
            "Ghi Chú"
        ];

        const fullColWidths = [
            { wch: 5 },  // STT
            { wch: 18 }, // Mã Hồ Sơ
            { wch: 22 }, // Chủ Sử Dụng
            { wch: 16 }, // Xã / Phường
            { wch: 7 },  // Tờ
            { wch: 7 },  // Thửa
            { wch: 20 }, // Loại Hồ Sơ
            { wch: 12 }, // Ngày Nhận
            { wch: 12 }, // Hẹn Trả
            { wch: 15 }, // Trạng Thái
            { wch: 12 }, // Ngày Giao NV
            { wch: 18 }, // NV Xử Lý
            { wch: 12 }, // Ngày Trình KT
            { wch: 18 }, // Người KT
            { wch: 12 }, // Ngày Trình Ký
            { wch: 18 }, // Người Ký Duyệt
            { wch: 12 }, // Hoàn Thành
            { wch: 10 }, // Đợt
            { wch: 12 }, // Ngày Trả KQ
            { wch: 15 }, // Số BL/HĐ
            { wch: 15 }, // Số Tiền
            { wch: 35 }  // Ghi Chú (rộng rãi, tự xuống dòng)
        ];

        // Lập toàn bộ hàng dữ liệu
        const fullDataRows = records.map((r, i) => {
            const contractInfo = getContractInfo(r.code);
            
            let rawPrice = '';
            if ((r as any).calcReturned !== undefined && (r as any).calcReturned !== null) {
                rawPrice = (r as any).calcReturned.toLocaleString('vi-VN');
            } else if (r.returnedPrice !== undefined && r.returnedPrice !== null) {
                rawPrice = r.returnedPrice.toLocaleString('vi-VN');
            } else if (r.price !== undefined && r.price !== null) {
                rawPrice = r.price.toLocaleString('vi-VN');
            } else {
                rawPrice = contractInfo.amount;
            }

            const cleanNote = cleanSyncNotes(r.notes || r.content || '');

            return [
                i + 1,
                r.code,
                r.customerName,
                getNormalizedWard(r.ward || (r as any).assignedWard || undefined),
                r.mapSheet || '',
                r.landPlot || '',
                getShortRecordType(r.recordType || undefined),
                formatDate(r.receivedDate),
                formatDate(r.deadline),
                STATUS_LABELS[r.status] || r.status,
                formatDate(r.assignedDate),
                getEmployeeName(r.assignedTo || undefined),
                formatDate(r.pendingCheckDate),
                getEmployeeName(r.checkedBy || undefined),
                formatDate(r.submissionDate),
                getEmployeeName(r.submittedTo || undefined),
                formatDate(r.completedDate),
                r.exportBatch || (r as any).handoverBatch || '',
                formatDate(r.resultReturnedDate || r.exportDate),
                r.receiptNumber || (r as any).contractNumber || '',
                rawPrice,
                cleanNote
            ];
        });

        // Cơ chế "Cắt giảm linh động":
        // 1. Cột cơ bản luôn giữ: index 0..9 (STT, Mã HS, Chủ Sử Dụng, Xã/Phường, Tờ, Thửa, Loại HS, Ngày Nhận, Hẹn Trả, Trạng Thái)
        const baseIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

        // 2. Cột giai đoạn trung gian (index 10: Ngày Giao NV -> index 20: Số Tiền):
        // Chỉ giữ lại những cột THỰC SỰ có dữ liệu phát sinh trong danh sách xuất
        const activeIntermediateCols: number[] = [];
        for (let colIdx = 10; colIdx <= 20; colIdx++) {
            const hasData = fullDataRows.some(row => {
                const val = row[colIdx];
                return val !== '' && val !== null && val !== undefined && String(val).trim() !== '';
            });
            if (hasData) {
                activeIntermediateCols.push(colIdx);
            }
        }

        // 3. Cột Ghi Chú (index 21) luôn được đưa về ngoài cùng bên phải của bảng tính
        const keptIndices = [...baseIndices, ...activeIntermediateCols, 21];

        tableHeader = keptIndices.map(idx => fullHeader[idx]);
        colWidths = keptIndices.map(idx => fullColWidths[idx]);
        dataRows = fullDataRows.map(row => keptIndices.map(idx => row[idx]));
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([]);

    const border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
    const titleStyle = { font: { name: "Times New Roman", sz: 14, bold: true }, alignment: { horizontal: "center", vertical: "center" } };
    
    const headerStyle = { 
        font: { name: "Times New Roman", sz: 11, bold: true }, 
        border, 
        fill: { fgColor: { rgb: "E0E0E0" } }, 
        alignment: { horizontal: "center", vertical: "center", wrapText: true } 
    };

    const cellStyle = { 
        font: { name: "Times New Roman", sz: 11 }, 
        border, 
        alignment: { horizontal: "left", vertical: "center", wrapText: true } 
    };
    const centerStyle = { 
        font: { name: "Times New Roman", sz: 11 }, 
        border, 
        alignment: { horizontal: "center", vertical: "center", wrapText: true } 
    };
    const rightStyle = { 
        font: { name: "Times New Roman", sz: 11 }, 
        border, 
        alignment: { horizontal: "right", vertical: "center", wrapText: true } 
    };

    const todayStr = new Date().toLocaleDateString('vi-VN');

    XLSX.utils.sheet_add_aoa(ws, [
        ["CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"],
        ["Độc lập - Tự do - Hạnh phúc"],
        [""],
        [titleText.toUpperCase()], 
        [`Ngày xuất: ${todayStr}`],
        [""],
        tableHeader
    ], { origin: "A1" });

    XLSX.utils.sheet_add_aoa(ws, dataRows, { origin: "A8" });

    const totalCols = tableHeader.length - 1;
    if(!ws['!merges']) ws['!merges'] = [];
    ws['!merges'].push(
        { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: totalCols } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: totalCols } },
        { s: { r: 4, c: 0 }, e: { r: 4, c: totalCols } }
    );

    // Áp dụng độ rộng cột linh động
    ws['!cols'] = colWidths;

    if(ws['A1']) ws['A1'].s = titleStyle;
    if(ws['A2']) ws['A2'].s = { font: { name: "Times New Roman", sz: 12, bold: true, underline: true }, alignment: { horizontal: "center", vertical: "center" } };
    if(ws['A4']) ws['A4'].s = { font: { name: "Times New Roman", sz: 14, bold: true, color: { rgb: "0000FF" } }, alignment: { horizontal: "center", vertical: "center" } };
    if(ws['A5']) ws['A5'].s = { font: { name: "Times New Roman", sz: 12, italic: true }, alignment: { horizontal: "center", vertical: "center" } };

    const headerRowIdx = 6;
    const dataStartIdx = 7;
    
    for (let c = 0; c <= totalCols; c++) {
        const headerRef = XLSX.utils.encode_cell({ r: headerRowIdx, c });
        if (!ws[headerRef]) ws[headerRef] = { v: "", t: "s" };
        ws[headerRef].s = headerStyle; 

        const colTitle = tableHeader[c];
        const isCenterCol = [
            "STT", "Tờ", "Thửa", "Ngày Nhận", "Hẹn Trả", "Thời Hạn Cũ", "Thời Hạn Mới", 
            "Trạng Thái", "Ngày Giao NV", "Ngày Trình KT", "Ngày Trình Ký", "Hoàn Thành", 
            "Đợt", "Ngày Trả KQ", "Số BL/HĐ"
        ].includes(colTitle);
        const isRightCol = colTitle === "Số Tiền";

        for (let r = dataStartIdx; r < dataStartIdx + dataRows.length; r++) {
            const cellRef = XLSX.utils.encode_cell({ r, c });
            if (!ws[cellRef]) ws[cellRef] = { v: "", t: "s" };
            
            if (isCenterCol) ws[cellRef].s = centerStyle;
            else if (isRightCol) ws[cellRef].s = rightStyle;
            else ws[cellRef].s = cellStyle;
        }
    }

    // Chân trang ký tên: Tự động căn đối xứng theo số lượng cột thực tế
    const footerStart = dataStartIdx + dataRows.length + 2;
    const numCols = tableHeader.length;
    let blockWidth = Math.floor(numCols / 3);
    if (blockWidth < 3) blockWidth = Math.min(3, Math.floor(numCols / 2));
    if (blockWidth < 2) blockWidth = 2;

    const leftStart = 0;
    const leftEnd = Math.min(leftStart + blockWidth - 1, Math.floor(totalCols / 2) - 1);
    const rightEnd = totalCols;
    const rightStart = Math.max(leftEnd + 1, rightEnd - blockWidth + 1);

    const footerRow1 = new Array(numCols).fill("");
    const footerRow2 = new Array(numCols).fill("");
    footerRow1[leftStart] = "NGƯỜI LẬP BIỂU";
    footerRow2[leftStart] = "(Ký, họ tên)";
    footerRow1[rightStart] = "THỦ TRƯỞNG ĐƠN VỊ";
    footerRow2[rightStart] = "(Ký, họ tên, đóng dấu)";

    XLSX.utils.sheet_add_aoa(ws, [footerRow1, footerRow2], { origin: { r: footerStart, c: 0 } });

    ws['!merges'].push(
        { s: { r: footerStart, c: leftStart }, e: { r: footerStart, c: leftEnd } },
        { s: { r: footerStart + 1, c: leftStart }, e: { r: footerStart + 1, c: leftEnd } },
        { s: { r: footerStart, c: rightStart }, e: { r: footerStart, c: rightEnd } },
        { s: { r: footerStart + 1, c: rightStart }, e: { r: footerStart + 1, c: rightEnd } }
    );

    const footerTitleStyle = { font: { name: "Times New Roman", sz: 12, bold: true }, alignment: { horizontal: "center", vertical: "center" } };
    const footerNoteStyle = { font: { name: "Times New Roman", sz: 11, italic: true }, alignment: { horizontal: "center", vertical: "center" } };

    for (let c = leftStart; c <= leftEnd; c++) {
        const titleRef = XLSX.utils.encode_cell({ r: footerStart, c });
        const noteRef = XLSX.utils.encode_cell({ r: footerStart + 1, c });
        if (ws[titleRef]) ws[titleRef].s = footerTitleStyle;
        if (ws[noteRef]) ws[noteRef].s = footerNoteStyle;
    }
    for (let c = rightStart; c <= rightEnd; c++) {
        const titleRef = XLSX.utils.encode_cell({ r: footerStart, c });
        const noteRef = XLSX.utils.encode_cell({ r: footerStart + 1, c });
        if (ws[titleRef]) ws[titleRef].s = footerTitleStyle;
        if (ws[noteRef]) ws[noteRef].s = footerNoteStyle;
    }

    // Cấu hình chiều cao dòng tiêu chuẩn (30px tiêu đề/header/chữ ký, 25px dòng dữ liệu)
    const rowsMeta: any[] = [];
    rowsMeta[0] = { hpt: 24, hpx: 30 }; // Quốc hiệu
    rowsMeta[1] = { hpt: 20, hpx: 25 }; // Tiêu ngữ
    rowsMeta[2] = { hpt: 10, hpx: 12 }; // Khoảng cách
    rowsMeta[3] = { hpt: 24, hpx: 30 }; // Tiêu đề chính
    rowsMeta[4] = { hpt: 20, hpx: 25 }; // Ngày xuất
    rowsMeta[5] = { hpt: 10, hpx: 12 }; // Khoảng cách
    rowsMeta[6] = { hpt: 24, hpx: 30 }; // Header bảng

    for (let r = dataStartIdx; r < dataStartIdx + dataRows.length; r++) {
        rowsMeta[r] = { hpt: 20, hpx: 25 }; // Dữ liệu hồ sơ
    }

    rowsMeta[footerStart - 2] = { hpt: 12, hpx: 15 };
    rowsMeta[footerStart - 1] = { hpt: 12, hpx: 15 };
    rowsMeta[footerStart] = { hpt: 24, hpx: 30 }; // Chữ ký tiêu đề
    rowsMeta[footerStart + 1] = { hpt: 20, hpx: 25 }; // Chữ ký ghi chú

    ws['!rows'] = rowsMeta;

    XLSX.utils.book_append_sheet(wb, ws, isGiaHanList ? "HoSoGiaHan" : "DanhSach");
    return wb;
};

export const generateRecordsWorkbookBase64 = async (
    records: RecordFile[],
    employees: Employee[],
    titleText: string = "DANH SÁCH TOÀN BỘ HỒ SƠ"
): Promise<{ wb: any; base64: string }> => {
    const wb = await createRecordsWorkbook(records, employees, titleText);
    const base64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
    return { wb, base64 };
};

export const exportCustomRecordsToExcel = async (
    records: RecordFile[],
    employees: Employee[],
    titleText: string = "DANH SÁCH HỒ SƠ",
    customFileName?: string
) => {
    if (records.length === 0) {
        alert("Không có hồ sơ nào để xuất.");
        return;
    }

    try {
        const wb = await createRecordsWorkbook(records, employees, titleText);
        const fileName = customFileName || `Danh_Sach_Ho_So_${new Date().getTime()}.xlsx`;
        XLSX.writeFile(wb, fileName);
    } catch (err: any) {
        alert(err.message || "Lỗi khi xuất file Excel.");
    }
};
