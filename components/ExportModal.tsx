
import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx-js-style';
import { RecordFile, RecordStatus } from '../types';
import { X, FileDown, Calendar, Layers, MapPin, Printer, Eye } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: RecordFile[];
  wards: string[];
  type: 'handover' | 'check_list'; // Phân loại danh sách
  onPreview: (workbook: XLSX.WorkBook, fileName: string) => void; // Callback để mở Preview
}

const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, records, wards, type, onPreview }) => {
  const [selectedBatchKey, setSelectedBatchKey] = useState<string>('');
  const [selectedWard, setSelectedWard] = useState<string>('all');

  // 1. Tổng hợp danh sách các đợt (Batch Options)
  const batchOptions = useMemo(() => {
    const batches: Record<string, { date: string, batch: number | string, count: number }> = {};

    records.forEach(r => {
      if (type === 'handover') {
          // Logic cho Giao 1 cửa
          if (r.status === RecordStatus.HANDOVER || r.status === RecordStatus.SIGNED || r.status === RecordStatus.WITHDRAWN || r.status === RecordStatus.REJECTED) {
              if (r.exportBatch && r.exportDate) {
                  const dateStr = r.exportDate.split('T')[0];
                  const key = `${dateStr}_${r.exportBatch}`;
                  if (!batches[key]) {
                      batches[key] = { date: dateStr, batch: r.exportBatch, count: 0 };
                  }
                  batches[key].count++;
              } else if (r.status === RecordStatus.HANDOVER) {
                  // Fallback cho những hồ sơ thiếu exportBatch (Chưa chốt đợt hoặc nhập từ Excel)
                  const dateStr = (r.completedDate || r.receivedDate || new Date().toISOString()).split('T')[0];
                  const key = `${dateStr}_NOT_BATCHED`;
                  if (!batches[key]) {
                      batches[key] = { date: dateStr, batch: 'Lẻ (Chưa tạo đợt)', count: 0 };
                  }
                  batches[key].count++;
              }
          }
      } else if (type === 'check_list') {
          // Logic cho Trình Ký: Dựa vào ngày tiếp nhận (receivedDate) để gom nhóm
          // Lấy các hồ sơ đang Chờ ký hoặc Đã ký (nhưng chưa giao)
          if (r.status === RecordStatus.PENDING_SIGN || r.status === RecordStatus.SIGNED) {
             const dateStr = r.receivedDate ? r.receivedDate.split('T')[0] : null;
             if (!dateStr) return;
             const key = `date_${dateStr}`;
             if (!batches[key]) {
                 batches[key] = { date: dateStr, batch: 'Theo ngày', count: 0 };
             }
             batches[key].count++;
          }
      }
    });

    // Sắp xếp giảm dần theo ngày
    return Object.entries(batches)
        .map(([key, value]) => ({ key, ...value }))
        .sort((a, b) => b.date.localeCompare(a.date));
  }, [records, isOpen, type]);

  // Synchronize filters and selected batch key stably to prevent resetting selection
  useEffect(() => {
    if (isOpen) {
      if (batchOptions.length > 0) {
        setSelectedBatchKey(prev => {
          const exists = batchOptions.some(opt => opt.key === prev);
          return exists ? prev : batchOptions[0].key;
        });
      } else {
        setSelectedBatchKey('');
      }
    } else {
      setSelectedBatchKey('');
      setSelectedWard('all');
    }
  }, [isOpen, batchOptions]);

  const formatDate = (d: string) => {
      const date = new Date(d);
      if (isNaN(date.getTime())) return d;
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
  };

  const removeVietnameseTones = (str: string): string => {
    if (!str) return '';
    str = str.toLowerCase();
    str = str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    str = str.replace(/đ/g, "d");
    str = str.replace(/\s+/g, "_");
    return str.toUpperCase();
  };

  // Hàm tạo Workbook chung (cho cả Preview và Download)
  const generateWorkbook = (): { wb: XLSX.WorkBook, fileName: string } | null => {
    if (!selectedBatchKey) return null;

    let recordsToExport: RecordFile[] = [];
    let title = "";
    let subTitle = "";
    let fileName = "";

    // Xử lý tên xã phường để hiển thị
    // NẾU selectedWard là 'all' thì hiển thị "TOÀN BỘ", ngược lại hiển thị tên xã
    const wardTitle = selectedWard === 'all' ? "" : ` - ${selectedWard.toUpperCase()}`;

    if (type === 'handover') {
        const parts = selectedBatchKey.split('_');
        const dateStr = parts[0];
        const batchStr = parts.slice(1).join('_');
        
        recordsToExport = records.filter(r => {
            const targetWard = r.handoverWard || r.ward;
            const matchWard = selectedWard === 'all' || targetWard === selectedWard;
            
            if (batchStr === 'NOT_BATCHED') {
                const rDateObj = (r.completedDate || r.receivedDate || new Date().toISOString()).split('T')[0];
                return r.status === RecordStatus.HANDOVER && !r.exportBatch && rDateObj === dateStr && matchWard;
            } else {
                const batchNum = parseInt(batchStr);
                return r.exportDate?.startsWith(dateStr) && r.exportBatch === batchNum && matchWard;
            }
        });

        title = `DANH SÁCH BÀN GIAO HỒ SƠ 1 CỬA${wardTitle}`;
        const displayBatch = batchStr === 'NOT_BATCHED' ? 'CHƯA TẠO ĐỢT' : `ĐỢT ${batchStr}`;
        subTitle = `${displayBatch}  -  TỔNG SỐ HỒ SƠ: ${recordsToExport.length}`;
        const safeDate = dateStr.replace(/-/g, '');
        fileName = `Giao_1_Cua_${batchStr === 'NOT_BATCHED' ? 'Le' : `Dot_${batchStr}`}_${safeDate}`;

    } else {
        // Check List
        const dateStr = selectedBatchKey.replace('date_', '');
        
        recordsToExport = records.filter(r => {
            const rDateStr = r.receivedDate ? r.receivedDate.split('T')[0] : null;
            const matchDate = rDateStr === dateStr;
            const matchStatus = r.status === RecordStatus.PENDING_SIGN || r.status === RecordStatus.SIGNED;
            const matchWard = selectedWard === 'all' || r.ward === selectedWard;
            return matchDate && matchStatus && matchWard;
        });

        title = `DANH SÁCH HỒ SƠ TRÌNH KÝ${wardTitle}`;
        subTitle = `NGÀY TIẾP NHẬN: ${formatDate(dateStr)}  -  SỐ LƯỢNG: ${recordsToExport.length}`;
        const safeDate = dateStr.replace(/-/g, '');
        fileName = `Trinh_Ky_Ngay_${safeDate}`;
    }

    if (recordsToExport.length === 0) {
        alert("Không tìm thấy hồ sơ nào cho lựa chọn này.");
        return null;
    }

    if (selectedWard !== 'all') {
        fileName += `_${removeVietnameseTones(selectedWard)}`;
    }

    // --- TẠO EXCEL ---
    // Tiêu đề ngày tháng (dùng ngày hiện tại hoặc ngày của đợt)
    const exportDateParts = type === 'handover' 
        ? selectedBatchKey.split('_')[0].split('-') 
        : selectedBatchKey.replace('date_', '').split('-');
        
    const displayDate = `Ngày ${exportDateParts[2]} tháng ${exportDateParts[1]} năm ${exportDateParts[0]}`;

    // --- CẤU HÌNH CỘT ĐỘNG ---
    const isHandover = type === 'handover';
    const isSpecificWard = selectedWard !== 'all';

    // 1. Header Array
    let tableHeader = ["STT", "Mã Hồ Sơ", "Chủ Sử Dụng"];
    
    // Nếu là Giao 1 cửa và chọn xã cụ thể thì BỎ cột Địa Chỉ
    // Nếu là Trình ký hoặc Tất cả xã thì GIỮ cột Địa Chỉ
    if (!(isHandover && isSpecificWard)) {
        tableHeader.push("Địa Chỉ (Xã)");
    }

    tableHeader.push("Thửa", "Tờ", "Loại Hồ Sơ");

    // Chỉ hiện Số TĐ, Số TL ở danh sách Trình Ký (Check List)
    if (!isHandover) {
        tableHeader.push("Số TĐ", "Số TL");
    }

    tableHeader.push("Hẹn Trả");

    // Thêm cột cho Giao 1 cửa
    tableHeader.push(isHandover ? "Ghi chú" : "Ghi Chú");

    // 2. Data Mapping
    const dataRows = recordsToExport.map((r, index) => {
        let noteText = r.notes || '';
        if (r.status === RecordStatus.WITHDRAWN) {
            noteText = noteText ? `${noteText} (CSD rút hồ sơ)` : 'CSD rút hồ sơ';
        }

        const row = [
            index + 1,
            r.code || '',
            r.customerName || ''
        ];

        if (!(isHandover && isSpecificWard)) {
            row.push(r.handoverWard || r.ward || '');
        }

        row.push(
            r.landPlot || '',
            r.mapSheet || '',
            r.recordType || ''
        );

        if (!isHandover) {
            row.push(
                r.measurementNumber || '',
                r.excerptNumber || ''
            );
        }

        row.push(r.deadline ? formatDate(r.deadline) : '');

        if (isHandover) {
            row.push(r.explanationPlan || '');
        } else {
            row.push(noteText);
        }

        return row;
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([]); 

    // Header Quốc Hiệu
    const headerRows = [
        ["CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"],
        ["Độc lập - Tự do - Hạnh phúc"],
        [""],
        [title],
        [displayDate.toUpperCase()],
        [subTitle],
    ];

    let handoverNoteRowIndex: number | null = null;
    if (type === 'handover') {
        handoverNoteRowIndex = headerRows.length;
        headerRows.push(["Kèm theo đầy đủ hồ sơ gốc"]);
    }
    headerRows.push([""]);
    const tableHeaderRowIndex = headerRows.length;
    headerRows.push(tableHeader);

    XLSX.utils.sheet_add_aoa(ws, headerRows, { origin: "A1" });

    // Data
    const dataOriginRow = headerRows.length + 1;
    XLSX.utils.sheet_add_aoa(ws, dataRows, { origin: `A${dataOriginRow}` });

    const totalCols = tableHeader.length;
    const lastDataRow = (dataOriginRow - 1) + dataRows.length;
    const footerStartRow = lastDataRow + 2;

    // Thêm Footer (Canh đều 2 bên - Justify)
    const midPoint = Math.floor(totalCols / 2);
    const leftStart = 0;
    const leftEnd = midPoint - 1;
    const rightStart = midPoint + 1; // Để lại 1 cột trống ở giữa
    const rightEnd = totalCols - 1;

    // Nếu không đủ cột để chia đôi đẹp, footer sẽ tự điều chỉnh
    const footerRow1 = new Array(totalCols).fill("");
    footerRow1[leftStart] = "BÊN GIAO HỒ SƠ";
    footerRow1[rightStart] = "BÊN NHẬN HỒ SƠ";

    const footerRow2 = new Array(totalCols).fill("");
    footerRow2[leftStart] = "(Ký và ghi rõ họ tên)";
    footerRow2[rightStart] = "(Ký và ghi rõ họ tên)";

    XLSX.utils.sheet_add_aoa(ws, [footerRow1, footerRow2], { origin: `A${footerStartRow + 1}` });

    // Cấu hình độ rộng cột (Cần mapping với tableHeader)
    const wscols = [
        { wch: 5 },  // STT
        { wch: 18 }, // Mã HS
        { wch: 22 }, // Chủ SD
    ];

    if (!(isHandover && isSpecificWard)) {
        wscols.push({ wch: 15 }); // Địa Chỉ (Xã)
    }

    wscols.push(
        { wch: 7 },  // Thửa
        { wch: 7 },  // Tờ
        { wch: 20 }  // Loại
    );

    if (!isHandover) {
        wscols.push(
            { wch: 8 },  // TĐ
            { wch: 8 }   // TL
        );
    }

    wscols.push({ wch: 11 }); // Hẹn

    if (isHandover) {
        wscols.push(
            { wch: 35 }  // Ghi chú (Rộng rãi để hiển thị thông tin)
        );
    } else {
        wscols.push({ wch: 15 }); // Ghi chú
    }

    ws['!cols'] = wscols;

    // --- CẤU HÌNH CHIỀU CAO DÒNG (ROWS HEIGHT) ---
    // Đây là phần quan trọng để tăng chiều cao dòng cho việc ký tên
    const wsrows = [];
    
    // Các dòng tiêu đề và header bảng: Cao 30px
    for(let i=0; i <= tableHeaderRowIndex; i++) {
        wsrows.push({ hpx: 30 }); 
    }
    
    // Các dòng dữ liệu: Cao 25px nếu là bàn giao (không cần ký tên), 60px cho các trường hợp khác
    for(let i=0; i < dataRows.length; i++) {
        wsrows.push({ hpx: isHandover ? 25 : 60 });
    }

    // Các dòng trống và Footer
    // lastDataRow là dòng trống đầu tiên sau dữ liệu.
    // Footer bắt đầu từ lastDataRow + 2.
    wsrows.push({ hpx: 25 }); // Dòng trống sát dữ liệu
    wsrows.push({ hpx: 25 }); // Dòng trống tiếp theo (để tạo khoảng cách)
    
    wsrows.push({ hpx: 30 }); // Dòng tiêu đề Footer (BÊN GIAO...)
    wsrows.push({ hpx: 30 }); // Dòng ghi chú Footer (Ký và ghi rõ...)

    ws['!rows'] = wsrows;

    // Merge Config
    const merges = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: totalCols - 1 } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: totalCols - 1 } },
        { s: { r: 4, c: 0 }, e: { r: 4, c: totalCols - 1 } },
        { s: { r: 5, c: 0 }, e: { r: 5, c: totalCols - 1 } },
    ];

    if (handoverNoteRowIndex !== null) {
        merges.push({ s: { r: handoverNoteRowIndex, c: 0 }, e: { r: handoverNoteRowIndex, c: totalCols - 1 } });
    }

    // Footer Merges
    merges.push(
        { s: { r: footerStartRow, c: leftStart }, e: { r: footerStartRow, c: leftEnd } },     
        { s: { r: footerStartRow + 1, c: leftStart }, e: { r: footerStartRow + 1, c: leftEnd } }, 
        
        { s: { r: footerStartRow, c: rightStart }, e: { r: footerStartRow, c: rightEnd } },    
        { s: { r: footerStartRow + 1, c: rightStart }, e: { r: footerStartRow + 1, c: rightEnd } }
    );

    ws['!merges'] = merges;

    // Styles
    const borderStyle = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
    const styles = {
        nationalTitle: { font: { name: "Times New Roman", sz: 12, bold: true }, alignment: { horizontal: "center", vertical: "center" } },
        nationalSlogan: { font: { name: "Times New Roman", sz: 12, bold: true, underline: true }, alignment: { horizontal: "center", vertical: "center" } },
        reportTitle: { font: { name: "Times New Roman", sz: 14, bold: true }, alignment: { horizontal: "center", vertical: "center" } },
        reportSubTitle: { font: { name: "Times New Roman", sz: 12, italic: true }, alignment: { horizontal: "center", vertical: "center" } },
        tableHeader: { font: { name: "Times New Roman", sz: 11, bold: true }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, border: borderStyle, fill: { fgColor: { rgb: "E0E0E0" } } },
        tableData: { font: { name: "Times New Roman", sz: 11 }, border: borderStyle, alignment: { vertical: "center", wrapText: true } },
        tableDataCenter: { font: { name: "Times New Roman", sz: 11 }, border: borderStyle, alignment: { horizontal: "center", vertical: "center", wrapText: true } },
        sigTitle: { font: { name: "Times New Roman", sz: 12, bold: true }, alignment: { horizontal: "center", vertical: "center" } },
        sigNote: { font: { name: "Times New Roman", sz: 11, italic: true }, alignment: { horizontal: "center", vertical: "center" } }
    };

    if(ws['A1']) ws['A1'].s = styles.nationalTitle;
    if(ws['A2']) ws['A2'].s = styles.nationalSlogan;
    if(ws['A4']) ws['A4'].s = styles.reportTitle;
    if(ws['A5']) ws['A5'].s = styles.reportSubTitle;
    if(ws['A6']) ws['A6'].s = styles.reportSubTitle;

    if (handoverNoteRowIndex !== null) {
        const handoverNoteCell = XLSX.utils.encode_cell({ r: handoverNoteRowIndex, c: 0 });
        if (ws[handoverNoteCell]) ws[handoverNoteCell].s = styles.reportSubTitle;
    }

    for (let c = 0; c < totalCols; c++) {
        const headerCell = XLSX.utils.encode_cell({ r: tableHeaderRowIndex, c: c });
        if (!ws[headerCell]) ws[headerCell] = { v: "", t: "s" };
        ws[headerCell].s = styles.tableHeader;

        for (let r = tableHeaderRowIndex + 1; r < lastDataRow; r++) {
            const cellRef = XLSX.utils.encode_cell({ r: r, c: c });
            if (!ws[cellRef]) ws[cellRef] = { v: "", t: "s" };
            
            // Tìm tên cột hiện tại để apply style
            const colName = tableHeader[c];
            const centerCols = ["STT", "Thửa", "Tờ", "Số TĐ", "Số TL", "Hẹn Trả", "Đợt Xuất", "Ngày nhận hồ sơ"];
            
            if (centerCols.includes(colName)) ws[cellRef].s = styles.tableDataCenter;
            else ws[cellRef].s = styles.tableData;
        }
    }

    // Apply Footer Styles (NO BORDER)
    const giaoRef = XLSX.utils.encode_cell({ r: footerStartRow, c: leftStart });
    const giaoNoteRef = XLSX.utils.encode_cell({ r: footerStartRow + 1, c: leftStart });
    const nhanRef = XLSX.utils.encode_cell({ r: footerStartRow, c: rightStart });
    const nhanNoteRef = XLSX.utils.encode_cell({ r: footerStartRow + 1, c: rightStart });

    if(ws[giaoRef]) ws[giaoRef].s = styles.sigTitle;
    if(ws[giaoNoteRef]) ws[giaoNoteRef].s = styles.sigNote;
    if(ws[nhanRef]) ws[nhanRef].s = styles.sigTitle;
    if(ws[nhanNoteRef]) ws[nhanNoteRef].s = styles.sigNote;

    XLSX.utils.book_append_sheet(wb, ws, "Danh Sách");
    return { wb, fileName };
  };

  const handleDownload = () => {
      const result = generateWorkbook();
      if (result) {
          XLSX.writeFile(result.wb, result.fileName + '.xlsx');
          onClose(); // Đóng sau khi tải
      }
  };

  const handlePreview = () => {
      const result = generateWorkbook();
      if (result) {
          onPreview(result.wb, result.fileName);
          onClose(); // Đóng modal chọn đợt để hiện modal Preview
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md animate-fade-in-up">
        <div className="flex justify-between items-center p-5 border-b">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Printer className="text-blue-600" />
            {type === 'handover' ? 'Xuất DS Giao 1 Cửa' : 'Xuất DS Trình Ký'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-red-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">1. Chọn đợt / ngày xuất</label>
                {batchOptions.length > 0 ? (
                    <div className="relative">
                        <select
                            className="w-full appearance-none border border-gray-300 rounded-lg px-4 py-3 pr-10 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white text-gray-700 font-medium"
                            value={selectedBatchKey}
                            onChange={(e) => setSelectedBatchKey(e.target.value)}
                        >
                            {batchOptions.map(opt => (
                                <option key={opt.key} value={opt.key}>
                                    {type === 'handover' 
                                      ? (opt.batch === 'Lẻ (Chưa tạo đợt)' 
                                          ? `Lẻ (Chưa tạo đợt) - Ngày ${formatDate(opt.date)} (${opt.count} HS)`
                                          : `Đợt ${opt.batch} - Ngày ${formatDate(opt.date)} (${opt.count} HS)`)
                                      : `Ngày tiếp nhận: ${formatDate(opt.date)} (${opt.count} HS)`
                                    }
                                </option>
                            ))}
                        </select>
                        <Layers className="absolute right-3 top-3.5 text-gray-400 pointer-events-none" size={18} />
                    </div>
                ) : (
                    <div className="text-center p-4 bg-gray-50 rounded-lg text-gray-500 border border-gray-200 text-sm">
                        {type === 'handover' 
                            ? 'Chưa có đợt giao nào. Hãy thực hiện "Chốt danh sách" trước.'
                            : 'Không có hồ sơ nào đang chờ ký.'}
                    </div>
                )}
            </div>

            {batchOptions.length > 0 && (
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">2. Lọc theo Xã / Phường (Tùy chọn)</label>
                    <div className="relative">
                        <select
                            className="w-full appearance-none border border-gray-300 rounded-lg px-4 py-3 pr-10 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white text-gray-700 font-medium"
                            value={selectedWard}
                            onChange={(e) => setSelectedWard(e.target.value)}
                        >
                            <option value="all">-- Tất cả Xã / Phường --</option>
                            {wards.map(w => (
                                <option key={w} value={w}>{w}</option>
                            ))}
                        </select>
                        <MapPin className="absolute right-3 top-3.5 text-gray-400 pointer-events-none" size={18} />
                    </div>
                </div>
            )}

            <div className="text-xs text-gray-500 bg-blue-50 p-3 rounded border border-blue-100 flex gap-2 items-start">
                <Calendar size={14} className="mt-0.5 text-blue-500 shrink-0" />
                <p>Hệ thống sẽ tạo file Excel chuẩn A4 Ngang (Landscape) để in ấn.</p>
            </div>

            <div className="pt-4 flex justify-between gap-3 border-t">
                <button 
                    onClick={onClose} 
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium text-sm"
                >
                    Hủy bỏ
                </button>
                
                <div className="flex gap-2">
                    <button 
                        onClick={handlePreview}
                        disabled={batchOptions.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 border border-blue-200 rounded-md hover:bg-blue-200 disabled:opacity-50 font-medium text-sm transition-colors"
                    >
                        <Eye size={18} />
                        Xem trước & In
                    </button>
                    <button 
                        onClick={handleDownload}
                        disabled={batchOptions.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 font-medium text-sm shadow-sm transition-colors"
                    >
                        <FileDown size={18} />
                        Tải Excel
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;
