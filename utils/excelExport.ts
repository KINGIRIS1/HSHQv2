
import * as XLSX from 'xlsx-js-style';
import { RecordFile, RecordStatus, Employee } from '../types';
import { getNormalizedWard, getShortRecordType, STATUS_LABELS } from '../constants';
import { isRecordOverdue, removeVietnameseTones } from './appHelpers';
import { fetchContracts } from '../services/api';

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

    // Filter records
    const filtered = records.filter(r => {
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

    // Lấy dữ liệu hợp đồng để map giá tiền và loại hợp đồng
    let contracts: any[] = [];
    try {
        contracts = await fetchContracts();
    } catch (e) {
        console.warn("Không tải được dữ liệu hợp đồng cho báo cáo.");
    }

    // Helper find Contract Info
    const getContractInfo = (recordCode: string) => {
        if (!recordCode) return { amount: '', liquidation: '', type: '' };
        const match = contracts.find(c => c.code && c.code.toLowerCase().trim() === recordCode.toLowerCase().trim());
        if (!match) return { amount: '', liquidation: '', type: '' };

        return {
            amount: match.totalAmount ? match.totalAmount.toLocaleString('vi-VN') : '',
            liquidation: match.liquidationAmount ? match.liquidationAmount.toLocaleString('vi-VN') : '',
            type: match.contractType || '' // Loại hợp đồng (Trích lục, Đo đạc...)
        };
    };

    // Helper find Employee Name
    const getEmployeeName = (empId?: string) => {
        if (!empId) return '';
        const emp = employees.find(e => e.id === empId);
        return emp ? emp.name : '';
    };

    // Prepare Data
    const formatDate = (d: string | undefined | null) => {
        if (!d) return '';
        const date = new Date(d);
        if (isNaN(date.getTime())) return '';
        return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
    };

    // Summary Stats
    let total = filtered.length;
    let completed = filtered.filter(r => r.status === RecordStatus.HANDOVER || r.status === RecordStatus.RETURNED).length;
    let processing = total - completed;
    
    // Tính trễ hạn tách biệt
    let overduePending = 0;
    let overdueCompleted = 0;

    filtered.forEach(r => {
        if (r.deadline) {
            const deadline = new Date(r.deadline);
            deadline.setHours(0,0,0,0);
            
            const isCompleted = r.status === RecordStatus.HANDOVER || r.status === RecordStatus.RETURNED;
            
            if (isCompleted) {
                if (r.completedDate) {
                    const completedDate = new Date(r.completedDate);
                    completedDate.setHours(0,0,0,0);
                    if (completedDate > deadline) overdueCompleted++;
                }
            } else if (r.status !== RecordStatus.WITHDRAWN && r.status !== RecordStatus.REJECTED) {
                const today = new Date();
                today.setHours(0,0,0,0);
                if (today > deadline) overduePending++;
            }
        }
    });

    // Table Header (Cập nhật cột theo yêu cầu)
    const tableHeader = [
        "STT", 
        "Mã Hồ Sơ", 
        "Chủ Sử Dụng", 
        "Địa Chỉ (Xã)", 
        "Tờ",
        "Thửa",
        "Loại Hồ Sơ", 
        "Loại HĐ/TL", // Yêu cầu 2: Loại hồ sơ thanh lý (Trích lục, đo đạc...)
        "NV Xử Lý",
        "Số Biên Lai", 
        "Giá trị HĐ", // Yêu cầu 3: Đổi từ Thành Tiền -> Giá trị HĐ
        "Giá trị TL", // Yêu cầu 1: Thêm cột Giá trị thanh lý
        "Ngày Nhận", 
        "Hẹn Trả", 
        "Ngày hoàn thành",
        "Ngày trả kết quả",
        "Trạng Thái", 
        "Ghi Chú"
    ];
    
    const dataRows = filtered.map((r, i) => {
        const contractInfo = getContractInfo(r.code);
        
        // Tổng hợp ghi chú cho Excel
        const notesParts: string[] = [];
        if (r.notes) notesParts.push(r.notes);
        if (r.content && r.content !== r.notes) notesParts.push(r.content);
        
        const fullNotesText = notesParts.join('; ') || '';

        return [
            i + 1,
            r.code,
            r.customerName,
            getNormalizedWard(r.ward || undefined),
            r.mapSheet || '',
            r.landPlot || '',
            getShortRecordType(r.recordType || undefined),
            contractInfo.type, // Loại HĐ/TL
            getEmployeeName(r.assignedTo || undefined),
            r.receiptNumber || '',
            contractInfo.amount,      // Giá trị HĐ
            contractInfo.liquidation, // Giá trị TL
            formatDate(r.receivedDate),
            formatDate(r.deadline),
            formatDate(r.completedDate),      
            formatDate(r.resultReturnedDate),
            STATUS_LABELS[r.status],
            ""
        ];
    });

    // Generate Workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([]);

    // Styles
    const titleStyle = { font: { name: "Times New Roman", sz: 14, bold: true }, alignment: { horizontal: "center" } };
    const subTitleStyle = { font: { name: "Times New Roman", sz: 12, italic: true }, alignment: { horizontal: "center" } };
    const headerStyle = { 
        font: { name: "Times New Roman", sz: 11, bold: true }, 
        border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }, 
        fill: { fgColor: { rgb: "E0E0E0" } }, 
        alignment: { horizontal: "center", vertical: "center", wrapText: true } 
    };
    const cellStyle = { 
        font: { name: "Times New Roman", sz: 11 }, 
        border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } },
        alignment: { vertical: "center", wrapText: true }
    };
    const centerStyle = { ...cellStyle, alignment: { horizontal: "center", vertical: "center" } };
    const rightStyle = { ...cellStyle, alignment: { horizontal: "right", vertical: "center" } };

    // Tên tiêu đề động theo xã
    const wardTitle = (ward && ward !== 'all') ? ` - ${ward.toUpperCase()}` : "";

    // Content Injection
    const reportTitle = customTitle ? `${customTitle}${wardTitle}` : `BÁO CÁO TÌNH HÌNH TIẾP NHẬN VÀ GIẢI QUYẾT HỒ SƠ${wardTitle}`;
    
    XLSX.utils.sheet_add_aoa(ws, [
        ["CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"], // 0
        ["Độc lập - Tự do - Hạnh phúc"],         // 1
        [""],                                    // 2
        [reportTitle], // 3
        [`Từ ngày ${formatDate(fromDateStr)} đến ngày ${formatDate(toDateStr)}`], // 4
        [""],                                    // 5
        [`Tổng số: ${total} | Đã xong: ${completed} | Đang giải quyết: ${processing} | Trễ hạn (Chưa xong): ${overduePending} | Trễ hạn (Đã xong): ${overdueCompleted}`], // 6
        [""],                                    // 7
        tableHeader                              // 8 (A9) -> Header Row Index = 8
    ], { origin: "A1" });

    // Dữ liệu bắt đầu từ dòng 9 (A10) -> Data Start Index = 9
    XLSX.utils.sheet_add_aoa(ws, dataRows, { origin: "A10" });

    // Formatting Merges
    const totalCols = tableHeader.length - 1; 
    ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: totalCols } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: totalCols } },
        { s: { r: 4, c: 0 }, e: { r: 4, c: totalCols } },
        { s: { r: 6, c: 0 }, e: { r: 6, c: totalCols } }
    ];
    
    // Column Widths (Adjusted for new columns)
    ws['!cols'] = [
        { wch: 5 },  // STT
        { wch: 15 }, // Mã HS
        { wch: 25 }, // Chủ SD
        { wch: 18 }, // Địa Chỉ
        { wch: 7 },  // Tờ
        { wch: 7 },  // Thửa
        { wch: 15 }, // Loại HS
        { wch: 15 }, // Loại HĐ/TL (New)
        { wch: 20 }, // NV Xử Lý
        { wch: 12 }, // Số BL
        { wch: 15 }, // Giá trị HĐ
        { wch: 15 }, // Giá trị TL (New)
        { wch: 12 }, // Ngày Nhận
        { wch: 12 }, // Hẹn Trả
        { wch: 14 }, // Ngày hoàn thành
        { wch: 14 }, // Ngày trả kết quả
        { wch: 15 }, // Trạng thái
        { wch: 20 }  // Ghi chú
    ];

    // Apply Styles
    if(ws['A1']) ws['A1'].s = titleStyle;
    if(ws['A2']) ws['A2'].s = { font: { name: "Times New Roman", sz: 12, bold: true, underline: true }, alignment: { horizontal: "center" } };
    if(ws['A4']) ws['A4'].s = { font: { name: "Times New Roman", sz: 16, bold: true, color: { rgb: "0000FF" } }, alignment: { horizontal: "center" } };
    if(ws['A5']) ws['A5'].s = subTitleStyle;
    if(ws['A7']) ws['A7'].s = { font: { name: "Times New Roman", sz: 12, bold: true }, alignment: { horizontal: "center", fill: { fgColor: { rgb: "FFFACD" } } } };

    const headerRowIdx = 8;
    const dataStartIdx = 9;
    const totalDataRows = dataRows.length;

    for (let c = 0; c <= totalCols; c++) {
        const headerRef = XLSX.utils.encode_cell({ r: headerRowIdx, c });
        if (!ws[headerRef]) ws[headerRef] = { v: "", t: "s" };
        ws[headerRef].s = headerStyle;

        for (let r = dataStartIdx; r < dataStartIdx + totalDataRows; r++) {
            const cellRef = XLSX.utils.encode_cell({ r, c });
            if (!ws[cellRef]) ws[cellRef] = { v: "", t: "s" };
            
            // Căn giữa: STT, Tờ, Thửa, NV, BL, Ngày, Trạng thái. Căn phải: Tiền.
            // Index: 0(STT), 4(Tờ), 5(Thửa), 8(NV), 9(BL), 10(HĐ), 11(TL), 12(NgayNhan), 13(Hen), 14(Xong), 15(TraKQ), 16(Status)
            if ([0, 4, 5, 8, 9, 12, 13, 14, 15, 16].includes(c)) ws[cellRef].s = centerStyle;
            else if (c === 10 || c === 11) ws[cellRef].s = rightStyle;
            else ws[cellRef].s = cellStyle;
        }
    }

    const lastRow = dataStartIdx + totalDataRows + 2;
    // Footer adjustments for wider table
    const rightColStart = totalCols - 2;
    const rightColEnd = totalCols;

    XLSX.utils.sheet_add_aoa(ws, [
        ["NGƯỜI LẬP BIỂU", "", "", "", "", "", "", "", "", "", "", "", "", "", "THỦ TRƯỞNG ĐƠN VỊ", ""],
        ["(Ký, họ tên)", "", "", "", "", "", "", "", "", "", "", "", "", "", "(Ký, họ tên, đóng dấu)", ""]
    ], { origin: `A${lastRow}` });
    
    ws['!merges'].push(
        { s: { r: lastRow - 1, c: 0 }, e: { r: lastRow - 1, c: 2 } },
        { s: { r: lastRow, c: 0 }, e: { r: lastRow, c: 2 } },
        { s: { r: lastRow - 1, c: rightColStart }, e: { r: lastRow - 1, c: rightColEnd } },
        { s: { r: lastRow, c: rightColStart }, e: { r: lastRow, c: rightColEnd } }
    );
    
    const footerStyle = { font: { name: "Times New Roman", sz: 12, bold: true }, alignment: { horizontal: "center" } };
    
    const leftTitle = XLSX.utils.encode_cell({r: lastRow - 1, c: 0});
    const rightTitle = XLSX.utils.encode_cell({r: lastRow - 1, c: rightColStart});
    if(ws[leftTitle]) ws[leftTitle].s = footerStyle;
    if(ws[rightTitle]) ws[rightTitle].s = footerStyle;

    XLSX.utils.book_append_sheet(wb, ws, "Bao Cao");
    const safeWardName = ward === 'all' ? 'Tong_Hop' : ward.replace(/\s/g, '_');
    const fileName = `Bao_Cao_${safeWardName}_${fromDateStr}_${toDateStr}.xlsx`;
    XLSX.writeFile(wb, fileName);
};

export const exportDailyStatsToExcel = (records: RecordFile[], employees: Employee[], receiveFrom: string, receiveTo: string, deadlineFrom: string, deadlineTo: string, assignedFrom?: string, assignedTo?: string, handoverFrom?: string, handoverTo?: string) => {
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
        "Xã/Phường", 
        "Ngày Nhận", 
        "Ngày Hẹn Trả", 
        "Ngày Giao NV",
        "Ngày Hoàn Thành",
        "NV Xử Lý", 
        "Trạng Thái"
    ];

    const dataRows = records.map((r, i) => {
        const emp = employees.find(e => e.id === r.assignedTo);
        return [
            i + 1,
            r.code,
            r.customerName,
            getNormalizedWard(r.ward || undefined),
            formatDate(r.receivedDate),
            formatDate(r.deadline),
            formatDate(r.assignedDate),
            formatDate(r.completedDate || r.resultReturnedDate),
            emp ? emp.name : '',
            STATUS_LABELS[r.status] || r.status
        ];
    });

    let subtitle = "THỐNG KÊ THEO NGÀY";
    if (receiveFrom || receiveTo) {
        subtitle += `\nNgày nhận: ${receiveFrom ? formatDate(receiveFrom) : '...'} - ${receiveTo ? formatDate(receiveTo) : '...'}`;
    }
    if (deadlineFrom || deadlineTo) {
        subtitle += `\nNgày hẹn trả: ${deadlineFrom ? formatDate(deadlineFrom) : '...'} - ${deadlineTo ? formatDate(deadlineTo) : '...'}`;
    }
    if (assignedFrom || assignedTo) {
        subtitle += `\nNgày giao NV: ${assignedFrom ? formatDate(assignedFrom) : '...'} - ${assignedTo ? formatDate(assignedTo) : '...'}`;
    }
    if (handoverFrom || handoverTo) {
        subtitle += `\nNgày giao 1 cửa: ${handoverFrom ? formatDate(handoverFrom) : '...'} - ${handoverTo ? formatDate(handoverTo) : '...'}`;
    }

    const wsData = [
        ["CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"],
        ["Độc lập - Tự do - Hạnh phúc"],
        [],
        ["DANH SÁCH HỒ SƠ THỐNG KÊ"],
        [subtitle],
        [],
        tableHeader,
        ...dataRows
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    const totalCols = tableHeader.length - 1;
    ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: totalCols } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: totalCols } },
        { s: { r: 4, c: 0 }, e: { r: 4, c: totalCols } }
    ];

    if(ws['A1']) ws['A1'].s = { font: { name: "Times New Roman", sz: 14, bold: true }, alignment: { horizontal: "center" } };
    if(ws['A2']) ws['A2'].s = { font: { name: "Times New Roman", sz: 12, bold: true, underline: true }, alignment: { horizontal: "center" } };
    if(ws['A4']) ws['A4'].s = { font: { name: "Times New Roman", sz: 16, bold: true, color: { rgb: "0000FF" } }, alignment: { horizontal: "center" } };
    if(ws['A5']) ws['A5'].s = { font: { name: "Times New Roman", sz: 12, italic: true }, alignment: { horizontal: "center", wrapText: true } };

    const headerStyle = { 
        font: { name: "Times New Roman", sz: 11, bold: true }, 
        border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }, 
        fill: { fgColor: { rgb: "E0E0E0" } }, 
        alignment: { horizontal: "center", vertical: "center", wrapText: true } 
    };
    const cellStyle = { 
        font: { name: "Times New Roman", sz: 11 }, 
        border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } },
        alignment: { vertical: "center", wrapText: true }
    };
    const centerStyle = { ...cellStyle, alignment: { horizontal: "center", vertical: "center" } };

    const headerRowIdx = 6;
    const dataStartIdx = 7;

    for (let c = 0; c <= totalCols; c++) {
        const headerRef = XLSX.utils.encode_cell({ r: headerRowIdx, c });
        if (!ws[headerRef]) ws[headerRef] = { v: "", t: "s" };
        ws[headerRef].s = headerStyle;

        for (let r = dataStartIdx; r < dataStartIdx + dataRows.length; r++) {
            const cellRef = XLSX.utils.encode_cell({ r, c });
            if (!ws[cellRef]) ws[cellRef] = { v: "", t: "s" };
            
            if ([0, 4, 5, 6, 7, 9].includes(c)) ws[cellRef].s = centerStyle;
            else ws[cellRef].s = cellStyle;
        }
    }

    // Styling
    ws['!cols'] = [
        { wch: 5 },  // STT
        { wch: 15 }, // Mã HS
        { wch: 30 }, // Chủ sử dụng
        { wch: 20 }, // Xã
        { wch: 15 }, // Ngày nhận
        { wch: 15 }, // Ngày hẹn trả
        { wch: 15 }, // Ngày giao NV
        { wch: 15 }, // Ngày hoàn thành
        { wch: 25 }, // NV
        { wch: 20 }  // Trạng thái
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ThongKe");
    
    const fileName = `ThongKe_${new Date().getTime()}.xlsx`;
    XLSX.writeFile(wb, fileName);
};

export const exportReturnedListToExcel = (records: RecordFile[], fromDateStr?: string, toDateStr?: string, wardName?: string) => {
    // ... Giữ nguyên code cũ cho exportReturnedListToExcel ...
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
        r.notes || ''
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
    const titleStyle = { font: { name: "Times New Roman", sz: 14, bold: true }, alignment: { horizontal: "center" } };
    
    const headerStyle = { 
        font: { name: "Times New Roman", sz: 11, bold: true }, 
        border, 
        fill: { fgColor: { rgb: "E0E0E0" } }, 
        alignment: { horizontal: "center", vertical: "center", wrapText: true } 
    };

    const cellStyle = { 
        font: { name: "Times New Roman", sz: 11 }, 
        border, 
        alignment: { vertical: "center", wrapText: true } 
    };
    const centerStyle = { ...cellStyle, alignment: { horizontal: "center", vertical: "center" } };

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

    const lastColIdx = 11;
    if(!ws['!merges']) ws['!merges'] = [];
    ws['!merges'].push(
        { s: { r: 0, c: 0 }, e: { r: 0, c: lastColIdx } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: lastColIdx } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: lastColIdx } },
        { s: { r: 4, c: 0 }, e: { r: 4, c: lastColIdx } }
    );

    ws['!cols'] = [
        { wch: 5 }, { wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 7 }, { wch: 7 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 20 }, { wch: 20 }
    ];

    if(ws['A1']) ws['A1'].s = titleStyle;
    if(ws['A2']) ws['A2'].s = { font: { name: "Times New Roman", sz: 12, bold: true, underline: true }, alignment: { horizontal: "center" } };
    if(ws['A4']) ws['A4'].s = { font: { name: "Times New Roman", sz: 14, bold: true, color: { rgb: "0000FF" } }, alignment: { horizontal: "center" } };
    if(ws['A5']) ws['A5'].s = { font: { name: "Times New Roman", sz: 12, italic: true }, alignment: { horizontal: "center" } };

    const headerRow = 6;
    const dataStart = 7;
    
    for (let c = 0; c <= lastColIdx; c++) {
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
    XLSX.utils.sheet_add_aoa(ws, [
        ["NGƯỜI LẬP BIỂU", "", "", "", "", "THỦ TRƯỞNG ĐƠN VỊ", "", "", "", ""],
        ["(Ký, họ tên)", "", "", "", "", "(Ký, họ tên)", "", "", "", ""]
    ], { origin: { r: footerStart, c: 0 } });

    ws['!merges'].push(
        { s: { r: footerStart, c: 0 }, e: { r: footerStart, c: 2 } },
        { s: { r: footerStart + 1, c: 0 }, e: { r: footerStart + 1, c: 2 } },
        { s: { r: footerStart, c: 7 }, e: { r: footerStart, c: 11 } },
        { s: { r: footerStart + 1, c: 7 }, e: { r: footerStart + 1, c: 11 } }
    );

    const footerTitleStyle = { font: { name: "Times New Roman", sz: 12, bold: true }, alignment: { horizontal: "center" } };
    const leftTitle = XLSX.utils.encode_cell({r: footerStart, c: 0});
    const rightTitle = XLSX.utils.encode_cell({r: footerStart, c: 7});
    if(ws[leftTitle]) ws[leftTitle].s = footerTitleStyle;
    if(ws[rightTitle]) ws[rightTitle].s = footerTitleStyle;

    XLSX.utils.book_append_sheet(wb, ws, "DS_Tra_KQ");
    
    let safeName = 'Tat_Ca';
    if (wardName && wardName !== 'all') {
        safeName = wardName.replace(/\s+/g, '_');
    }
    const fileName = `DS_Tra_KQ_${safeName}.xlsx`;
    
    XLSX.writeFile(wb, fileName);
};

export const exportOverdueStatsToExcel = (records: any[], employees: Employee[], filterType: string) => {
    if (records.length === 0) {
        alert("Không có hồ sơ nào để xuất.");
        return;
    }

    const formatDate = (dStr: string | null | undefined) => {
        if (!dStr) return '';
        const date = new Date(dStr);
        if (isNaN(date.getTime())) return '';
        return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
    };

    const wb = XLSX.utils.book_new();

    const tableHeader = [
        "STT", 
        "Mã Hồ Sơ", 
        "Chủ Sử Dụng", 
        "Xã/Phường", 
        "Loại Trễ", 
        "Ngày Nhận", 
        "Ngày Hẹn Trả", 
        "Hoàn Thành",
        "NV Xử Lý", 
        "Trạng Thái"
    ];

    const dataRows = records.map((r, i) => {
        const emp = employees.find(e => e.id === r.assignedTo);
        const isPendingOverdue = r._overdueType === 'pending';
        return [
            i + 1,
            r.code,
            r.customerName,
            getNormalizedWard(r.ward || undefined),
            isPendingOverdue ? 'Chưa có kết quả' : 'Đã có kết quả',
            formatDate(r.receivedDate),
            formatDate(r.deadline),
            formatDate(r.completedDate),
            emp ? emp.name : '',
            STATUS_LABELS[r.status as RecordStatus] || r.status
        ];
    });

    let subtitle = "THỐNG KÊ HỒ SƠ TRỄ HẠN";
    if (filterType === 'pending') subtitle += " (Chưa có kết quả)";
    if (filterType === 'completed') subtitle += " (Đã có kết quả)";

    const wsData = [
        ["CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"],
        ["Độc lập - Tự do - Hạnh phúc"],
        [],
        ["DANH SÁCH HỒ SƠ THỐNG KÊ"],
        [subtitle],
        [],
        tableHeader,
        ...dataRows
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    const totalCols = tableHeader.length - 1;
    ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: totalCols } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: totalCols } },
        { s: { r: 4, c: 0 }, e: { r: 4, c: totalCols } }
    ];

    if(ws['A1']) ws['A1'].s = { font: { name: "Times New Roman", sz: 14, bold: true }, alignment: { horizontal: "center" } };
    if(ws['A2']) ws['A2'].s = { font: { name: "Times New Roman", sz: 12, bold: true, underline: true }, alignment: { horizontal: "center" } };
    if(ws['A4']) ws['A4'].s = { font: { name: "Times New Roman", sz: 16, bold: true, color: { rgb: "0000FF" } }, alignment: { horizontal: "center" } };
    if(ws['A5']) ws['A5'].s = { font: { name: "Times New Roman", sz: 12, italic: true }, alignment: { horizontal: "center", wrapText: true } };

    const headerStyle = { 
        font: { name: "Times New Roman", sz: 11, bold: true }, 
        border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }, 
        fill: { fgColor: { rgb: "E0E0E0" } }, 
        alignment: { horizontal: "center", vertical: "center", wrapText: true } 
    };
    const cellStyle = { 
        font: { name: "Times New Roman", sz: 11 }, 
        border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } },
        alignment: { vertical: "center", wrapText: true }
    };
    const centerStyle = { ...cellStyle, alignment: { horizontal: "center", vertical: "center" } };

    const headerRowIdx = 6;
    const dataStartIdx = 7;

    for (let c = 0; c <= totalCols; c++) {
        const headerRef = XLSX.utils.encode_cell({ r: headerRowIdx, c });
        if (!ws[headerRef]) ws[headerRef] = { v: "", t: "s" };
        ws[headerRef].s = headerStyle;

        for (let r = dataStartIdx; r < dataStartIdx + dataRows.length; r++) {
            const cellRef = XLSX.utils.encode_cell({ r, c });
            if (!ws[cellRef]) ws[cellRef] = { v: "", t: "s" };
            
            if ([0, 4, 5, 6, 7, 9].includes(c)) ws[cellRef].s = centerStyle;
            else ws[cellRef].s = cellStyle;
        }
    }

    ws['!cols'] = [
        { wch: 5 },  // STT
        { wch: 15 }, // Mã HS
        { wch: 30 }, // Chủ sử dụng
        { wch: 20 }, // Xã
        { wch: 15 }, // Loại trễ
        { wch: 12 }, // Ngày nhận
        { wch: 12 }, // Ngày hẹn
        { wch: 12 }, // Ngày Xong
        { wch: 20 }, // NV Xử lý
        { wch: 15 }  // Trạng thái
    ];

    XLSX.utils.book_append_sheet(wb, ws, "HoSoTreHan");
    const fileName = `Danh_Sach_Tre_Han_${filterType}_${new Date().getTime()}.xlsx`;
    XLSX.writeFile(wb, fileName);
};
