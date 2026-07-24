
import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx-js-style';
import { RecordFile } from '../../types';
import { getNormalizedWard, getShortRecordType } from '../../constants';
import { Search, Eye, FileSpreadsheet, Pencil, Printer, Trash2, MapPin, FileSignature } from 'lucide-react';

interface DailyListProps {
  records: RecordFile[];
  wards: string[];
  currentUser: any;
  employees?: any[];
  onPreviewExcel: (wb: XLSX.WorkBook, name: string) => void;
  // New Handlers
  onEdit: (record: RecordFile) => void;
  onDelete: (record: RecordFile) => void;
  onPrint: (record: RecordFile) => void;
  onCreateContract?: (record: RecordFile) => void;
  onHandOverRecords?: (recordIds: string[]) => Promise<void>;
}

// Hàm lấy mã viết tắt (Prefix) từ tên Xã/Phường - Đồng bộ với logic sinh mã
const getShortCode = (ward: string) => {
    const normalized = ward.toLowerCase().trim();
    const cleanName = normalized
        .replace(/^(xã|phường|thị trấn|tt\.|p\.|x\.)\s+/g, '')
        .replace(/\s+(xã|phường|thị trấn)\s+/g, ' ');

    if (cleanName.includes('tân khai') || cleanName.includes('tankhai')) return 'TK';
    if (cleanName.includes('tân hưng') || cleanName.includes('tanhung')) return 'TH';
    if (cleanName.includes('minh đức') || cleanName.includes('minhduc')) return 'MĐ';
    if (cleanName.includes('tân quan') || cleanName.includes('tanquan')) return 'TQ';

    if (cleanName.includes('minh hưng') || cleanName.includes('minhhung')) return 'MH';
    if (cleanName.includes('chơn thành') || cleanName.includes('chonthanh') || cleanName.includes('hưng long')) return 'CT';
    if (cleanName.includes('nha bích') || cleanName.includes('nhabich')) return 'NB';
    if (cleanName.includes('minh lập') || cleanName.includes('minhlap')) return 'ML';
    if (cleanName.includes('minh thắng') || cleanName.includes('minhthang')) return 'MT';
    if (cleanName.includes('quang minh') || cleanName.includes('quangminh')) return 'QM';
    if (cleanName.includes('thành tâm') || cleanName.includes('thanhtam')) return 'TT';
    if (cleanName.includes('minh long') || cleanName.includes('minhlong')) return 'MLO';
    
    return 'CT'; // Mặc định
};

const DailyList: React.FC<DailyListProps> = ({ records, wards, currentUser, employees, onPreviewExcel, onEdit, onDelete, onPrint, onCreateContract, onHandOverRecords }) => {
  const [filterDate, setFilterDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('Tất cả');

  const filteredDailyRecords = useMemo(() => {
      if (!records) return [];
      const searchLower = searchTerm.toLowerCase();
      
      // Lọc danh sách
      const list = records.filter(r => {
          // Bỏ qua hồ sơ đã bàn giao
          if (r.isHandedOver) {
              return false;
          }

          // Luôn lọc theo user nhận
          if (r.receivedBy !== currentUser.employeeId) {
              return false;
          }

          // 1. Lọc theo ngày nhận
          const recordDate = r.receivedDate ? r.receivedDate.split('T')[0] : '';
          if (recordDate !== filterDate) return false;
          
          // Lọc theo tổ chuyên môn
          if (selectedDept !== 'Tất cả') {
              const typeLower = (r.recordType || '').toLowerCase();
              if (selectedDept === 'Tổ Đo đạc') {
                  const isMeasurement = typeLower.includes('trích đo') || typeLower.includes('đo đạc') || typeLower.includes('cắm mốc') || typeLower.includes('tách') || typeLower.includes('hợp') || typeLower.startsWith('2.3') || typeLower.startsWith('2.4') || typeLower.startsWith('2.5') || typeLower.startsWith('2.6') || typeLower.includes('số thửa') || typeLower.includes('cập nhật') || typeLower.includes('cập nhập');
                  if (!isMeasurement) return false;
              } else if (selectedDept === 'Tổ Thông tin lưu trữ') {
                  const isArchive = (typeLower.includes('cung cấp') || typeLower.includes('trích lục') || typeLower.startsWith('1.1') || typeLower.startsWith('2.1') || typeLower.startsWith('2.2')) && 
                                    !typeLower.startsWith('2.6') && !typeLower.includes('số thửa') && !typeLower.includes('cập nhật') && !typeLower.includes('cập nhập');
                  if (!isArchive) return false;
              }
          }
          
          // 3. Tìm kiếm từ khóa
          if (searchTerm) {
              const nameMatch = r.customerName?.toLowerCase().includes(searchLower);
              const codeMatch = r.code?.toLowerCase().includes(searchLower);
              if (!nameMatch && !codeMatch) return false;
          }
          return true;
      });

      // Sắp xếp: Tăng dần theo số thứ tự
      return list.sort((a, b) => {
          const codeA = (a.code || '').toUpperCase();
          const codeB = (b.code || '').toUpperCase();
          
          return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
      });
  }, [records, filterDate, searchTerm, currentUser, selectedDept]);

  const createDailyListWorkbook = () => {
      if (filteredDailyRecords.length === 0) return null;
      
      let mainTitle = "DANH SÁCH TIẾP NHẬN HỒ SƠ";
      let wardTitle = "DANH SÁCH TỔNG HỢP";
      if (selectedDept === 'Tổ Đo đạc') {
          mainTitle = "DANH SÁCH BÀN GIAO HỒ SƠ";
          wardTitle = "TỔ ĐO ĐẠC BẢN ĐỒ";
      } else if (selectedDept === 'Tổ Thông tin lưu trữ') {
          mainTitle = "DANH SÁCH BÀN GIAO HỒ SƠ";
          wardTitle = "TỔ THÔNG TIN LƯU TRỮ";
      }
      const dateParts = filterDate.split('-'); 
      const dateStr = `NGÀY ${dateParts[2]} THÁNG ${dateParts[1]} NĂM ${dateParts[0]}`;
      
      const tableHeader = ["STT", "Mã Hồ Sơ", "Chủ Sử Dụng", "Xã / Phường", "Tờ", "Thửa", "Loại Hồ Sơ", "Hẹn Trả", "Ghi Chú"];
      
      const dataRows = filteredDailyRecords.map((r, i) => [
          i + 1, r.code, r.customerName, 
          getNormalizedWard(r.ward), 
          r.mapSheet, r.landPlot, 
          getShortRecordType(r.recordType), 
          r.deadline ? new Date(r.deadline).toLocaleDateString('vi-VN') : '', r.content
      ]);

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([]);

      // Styles
      const border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
      const center = { alignment: { horizontal: "center", vertical: "center", wrapText: true } };
      const headerStyle = { font: { name: "Times New Roman", sz: 11, bold: true }, border, fill: { fgColor: { rgb: "E0E0E0" } }, ...center };
      const cellStyle = { font: { name: "Times New Roman", sz: 11 }, border, alignment: { vertical: "center", wrapText: true } };
      const centerCellStyle = { font: { name: "Times New Roman", sz: 11 }, border, alignment: { horizontal: "center", vertical: "center", wrapText: true } };

      // Header content
      XLSX.utils.sheet_add_aoa(ws, [
          ["CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"], ["Độc lập - Tự do - Hạnh phúc"], [""],
          [mainTitle], [wardTitle], [dateStr], tableHeader
      ], { origin: "A1" });
      
      // Data content
      XLSX.utils.sheet_add_aoa(ws, dataRows, { origin: "A8" });

      // Footer
      const lastDataRowIndex = 7 + dataRows.length;
      const footerRowIndex = lastDataRowIndex + 2;

      XLSX.utils.sheet_add_aoa(ws, [
          ["BÊN GIAO HỒ SƠ", "", "", "", "", "BÊN NHẬN HỒ SƠ", "", "", ""],
          ["(Ký và ghi rõ họ tên)", "", "", "", "", "(Ký và ghi rõ họ tên)", "", "", ""]
      ], { origin: { r: footerRowIndex, c: 0 } });

      // Merges
      if (!ws['!merges']) ws['!merges'] = [];
      ws['!merges'].push(
          { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }, 
          { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } }, 
          { s: { r: 3, c: 0 }, e: { r: 3, c: 8 } }, 
          { s: { r: 4, c: 0 }, e: { r: 4, c: 8 } }, 
          { s: { r: 5, c: 0 }, e: { r: 5, c: 8 } },
          { s: { r: footerRowIndex, c: 0 }, e: { r: footerRowIndex, c: 3 } },
          { s: { r: footerRowIndex + 1, c: 0 }, e: { r: footerRowIndex + 1, c: 3 } },
          { s: { r: footerRowIndex, c: 5 }, e: { r: footerRowIndex, c: 8 } },
          { s: { r: footerRowIndex + 1, c: 5 }, e: { r: footerRowIndex + 1, c: 8 } }
      );

      // Column Widths
      ws['!cols'] = [{ wch: 5 }, { wch: 15 }, { wch: 22 }, { wch: 15 }, { wch: 6 }, { wch: 6 }, { wch: 20 }, { wch: 12 }, { wch: 15 }];

      // Styles Loop
      for(let c=0; c<=8; c++) { 
          const ref = XLSX.utils.encode_cell({r: 6, c: c}); 
          if(!ws[ref]) ws[ref] = { v: "", t: "s"}; 
          ws[ref].s = headerStyle; 
      }
      for(let r=7; r < lastDataRowIndex; r++) { 
          for(let c=0; c<=8; c++) { 
              const ref = XLSX.utils.encode_cell({r: r, c: c}); 
              if(!ws[ref]) ws[ref] = { v: "", t: "s"}; 
              if (c === 4 || c === 5) ws[ref].s = centerCellStyle;
              else ws[ref].s = cellStyle;
          } 
      }

      // Footer Styles
      const sigTitleStyle = { font: { name: "Times New Roman", sz: 12, bold: true }, alignment: { horizontal: "center" } };
      const sigNoteStyle = { font: { name: "Times New Roman", sz: 11, italic: true }, alignment: { horizontal: "center" } };

      const leftTitle = XLSX.utils.encode_cell({r: footerRowIndex, c: 0});
      const leftNote = XLSX.utils.encode_cell({r: footerRowIndex + 1, c: 0});
      const rightTitle = XLSX.utils.encode_cell({r: footerRowIndex, c: 5});
      const rightNote = XLSX.utils.encode_cell({r: footerRowIndex + 1, c: 5});

      if(!ws[leftTitle]) ws[leftTitle] = {v: "BÊN GIAO HỒ SƠ", t:'s'}; ws[leftTitle].s = sigTitleStyle;
      if(!ws[leftNote]) ws[leftNote] = {v: "(Ký và ghi rõ họ tên)", t:'s'}; ws[leftNote].s = sigNoteStyle;
      if(!ws[rightTitle]) ws[rightTitle] = {v: "BÊN NHẬN HỒ SƠ", t:'s'}; ws[rightTitle].s = sigTitleStyle;
      if(!ws[rightNote]) ws[rightNote] = {v: "(Ký và ghi rõ họ tên)", t:'s'}; ws[rightNote].s = sigNoteStyle;

      XLSX.utils.book_append_sheet(wb, ws, "Danh Sach");
      return wb;
  };

  const handleExport = () => {
      const wb = createDailyListWorkbook();
      if (!wb) { alert("Không có hồ sơ."); return; }
      const suffix = selectedDept === 'Tất cả' ? 'Tiep_Nhan' : selectedDept === 'Tổ Đo đạc' ? 'Ban_Giao_Do_Dac' : 'Ban_Giao_Luu_Tru';
      XLSX.writeFile(wb, `DS_${suffix}_${filterDate.replace(/-/g, '')}.xlsx`);
      
      if (onHandOverRecords) {
          const ids = filteredDailyRecords.map(r => r.id);
          setTimeout(() => {
              onHandOverRecords(ids);
          }, 1000);
      }
  };

  const handlePreview = () => {
      const wb = createDailyListWorkbook();
      if (!wb) { alert("Không có hồ sơ."); return; }
      const suffix = selectedDept === 'Tất cả' ? 'Tiep_Nhan' : selectedDept === 'Tổ Đo đạc' ? 'Ban_Giao_Do_Dac' : 'Ban_Giao_Luu_Tru';
      onPreviewExcel(wb, `DS_${suffix}_${filterDate.replace(/-/g, '')}`);
  };

  return (
    <div className="flex flex-col h-full space-y-4 animate-fade-in">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap items-center gap-4 shrink-0">
            <div className="flex items-center gap-2"> 
                <label className="text-sm font-medium text-gray-600">Ngày nhận:</label> 
                <input type="date" className="border border-gray-300 rounded px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-blue-500" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} /> 
            </div>
            <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-600">Tổ chuyên môn:</label>
                <select
                    className="border border-gray-300 rounded px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                >
                    <option value="Tất cả">Tất cả tổ</option>
                    <option value="Tổ Đo đạc">Tổ Đo đạc</option>
                    <option value="Tổ Thông tin lưu trữ">Tổ Thông tin lưu trữ</option>
                </select>
            </div>
            <div className="relative flex-1 max-w-sm"> 
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} /> 
                <input type="text" placeholder="Tìm kiếm..." className="w-full pl-9 pr-4 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /> 
            </div>
            <div className="ml-auto flex gap-2">
                <button onClick={handlePreview} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 shadow-sm text-sm font-medium"> <Eye size={16} /> Xem Excel </button>
                <button onClick={handleExport} className="flex items-center gap-2 bg-white text-green-600 border border-green-200 px-4 py-2 rounded-md hover:bg-green-50 shadow-sm text-sm font-medium"> <FileSpreadsheet size={16} /> Tải Excel </button>
            </div>
        </div>
        <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col min-h-0">
            <div className="overflow-auto flex-1">
                <table className="w-full text-left table-fixed min-w-[1300px]">
                    <thead className="bg-gray-50 text-xs text-gray-600 uppercase font-bold sticky top-0 shadow-sm">
                        <tr> 
                            <th className="p-4 w-12 text-center">STT</th> 
                            <th className="p-4 w-[120px]">Mã Hồ Sơ</th> 
                            <th className="p-4 w-[200px]">Chủ Sử Dụng</th> 
                            <th className="p-4 w-[150px]">Xã / Phường (Đất)</th> 
                            <th className="p-4 w-[60px] text-center">Tờ</th>
                            <th className="p-4 w-[60px] text-center">Thửa</th>
                            <th className="p-4 w-[115px]">Loại Hồ Sơ</th> 
                            <th className="p-4 text-center w-[120px]">Hẹn Trả</th> 
                            <th className="p-4 w-[150px]">Ghi Chú</th>
                            <th className="p-4 w-[140px] text-center bg-gray-100/50 sticky right-0 shadow-l">Thao Tác</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                        {filteredDailyRecords.length > 0 ? (
                            filteredDailyRecords.map((r, index) => (
                                <tr key={r.id} className="hover:bg-blue-50/50 group">
                                    <td className="p-4 text-center text-gray-400 align-middle">{index + 1}</td> 
                                    <td className="p-4 font-medium text-blue-600 truncate align-middle" title={r.code}>{r.code}</td> 
                                    <td className="p-4 font-medium text-gray-800 truncate align-middle" title={r.customerName}>{r.customerName}</td> 
                                    <td className="p-4 text-gray-700 truncate align-middle font-medium" title={getNormalizedWard(r.ward)}>
                                        {getNormalizedWard(r.ward)}
                                    </td>
                                    <td className="p-4 text-center font-mono align-middle">{r.mapSheet || '-'}</td>
                                    <td className="p-4 text-center font-mono align-middle">{r.landPlot || '-'}</td>
                                    <td className="p-4 text-gray-600 truncate align-middle" title={r.recordType || ''}>{getShortRecordType(r.recordType)}</td> 
                                    <td className="p-4 text-center text-blue-700 font-medium align-middle">{r.deadline ? new Date(r.deadline).toLocaleDateString('vi-VN') : '-'}</td> 
                                    <td className="p-4 text-gray-500 italic truncate align-middle" title={r.content || ''}>{r.content}</td>
                                    <td className="p-3 align-middle text-center sticky right-0 bg-white group-hover:bg-blue-50/50 shadow-l">
                                        <div className="flex items-center justify-center gap-2">
                                            <button onClick={() => onEdit(r)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition-colors" title="Sửa">
                                                <Pencil size={16} />
                                            </button>
                                            {r.recordType && (getShortRecordType(r.recordType).startsWith('2.3') || getShortRecordType(r.recordType).startsWith('2.4')) && onCreateContract && (
                                                <button onClick={() => onCreateContract(r)} className="p-1.5 text-amber-600 hover:bg-amber-100 rounded transition-colors" title="Lập hợp đồng">
                                                    <FileSignature size={16} />
                                                </button>
                                            )}
                                            <button onClick={() => onPrint(r)} className="p-1.5 text-purple-600 hover:bg-purple-100 rounded transition-colors" title="In biên nhận">
                                                <Printer size={16} />
                                            </button>
                                            {(currentUser?.role === 'ADMIN' || currentUser?.role === 'SUBADMIN') && (
                                                <button onClick={() => onDelete(r)} className="p-1.5 text-red-500 hover:bg-red-100 rounded transition-colors" title="Xóa">
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : ( <tr><td colSpan={10} className="p-8 text-center text-gray-400 italic"> Không có hồ sơ nào trong ngày này phù hợp với bộ lọc. </td></tr> )}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  );
};

export default DailyList;
