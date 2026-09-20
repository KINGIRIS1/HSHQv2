import React, { useState, useEffect, useRef } from 'react';
import { X, FileDown, Calendar, MapPin, List, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { ArchiveRecord } from '../../services/apiArchive';
import { toTitleCase } from '../../utils/appHelpers';

interface ExportHandoverModalProps {
    isOpen: boolean;
    onClose: () => void;
    records: any[];
    type?: string;
    wards?: string[];
}

const ExportHandoverModal: React.FC<ExportHandoverModalProps> = ({ isOpen, onClose, records, type = 'global', wards }) => {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedWard, setSelectedWard] = useState<string>('all');
    const [selectedBatch, setSelectedBatch] = useState<string>('all');
    const [availableBatches, setAvailableBatches] = useState<string[]>([]);
    const [isExporting, setIsExporting] = useState<boolean>(false);
    const isExportingRef = useRef<boolean>(false);
    const [exportProgress, setExportProgress] = useState<number>(0);
    const [exportStatusText, setExportStatusText] = useState<string>('');

    // Reset state when opening
    useEffect(() => {
        if (isOpen) {
            setSelectedDate(new Date().toISOString().split('T')[0]);
            setSelectedWard('all');
            setSelectedBatch('all');
            setIsExporting(false);
            isExportingRef.current = false;
            setExportProgress(0);
            setExportStatusText('');
        }
    }, [isOpen]);

    // Helper to extract batch name from record
    const getRecordBatch = (r: any): string => {
        return r.exportBatch || r.export_batch || r.data?.exportBatch || r.data?.danh_sach || '';
    };

    // Helper to extract export date from record
    const getRecordDate = (r: any): string => {
        const d = r.exportDate || r.export_date || r.completedDate || r.completedWorkDate || r.data?.ngay_hoan_thanh || r.data?.exportDate || '';
        return d.split('T')[0];
    };

    // Update available batches based on date and ward across all records
    useEffect(() => {
        const batches = new Set<string>();
        records.forEach(r => {
            const bName = getRecordBatch(r);
            if (!bName) return;

            const rDate = getRecordDate(r);
            if (rDate && rDate !== selectedDate) return;

            if (selectedWard !== 'all') {
                const w = r.ward || r.data?.xa_phuong || r.handoverWard || '';
                if (w !== selectedWard) return;
            }

            batches.add(bName);
        });
        const sorted = Array.from(batches).sort((a, b) => {
            const getBatchNum = (str: string) => {
                const match = String(str).match(/Đợt\s*0*(\d+)/i) || String(str).match(/^(\d+)$/);
                return match && match[1] ? parseInt(match[1], 10) : 0;
            };
            const numA = getBatchNum(a);
            const numB = getBatchNum(b);
            if (numA !== numB) return numB - numA;
            return b.localeCompare(a, undefined, { numeric: true });
        });
        setAvailableBatches(sorted);
        setSelectedBatch('all'); // Reset batch selection
    }, [selectedDate, selectedWard, records]);

    const handleExport = async () => {
        if (isExportingRef.current || isExporting) return;
        // Filter records to export across all modules
        const exportData = records.filter(r => {
            const bName = getRecordBatch(r);
            if (!bName) return false;

            const rDate = getRecordDate(r);
            if (rDate && rDate !== selectedDate) return false;

            if (selectedWard !== 'all') {
                const w = r.ward || r.data?.xa_phuong || r.handoverWard || '';
                if (w !== selectedWard) return false;
            }

            if (selectedBatch !== 'all' && bName !== selectedBatch) return false;
            return true;
        });

        if (exportData.length === 0) {
            alert('Không có hồ sơ nào để xuất!');
            return;
        }

        isExportingRef.current = true;
        setIsExporting(true);
        try {
            setExportProgress(15);
            setExportStatusText('Đang lọc và chuẩn bị dữ liệu liên module...');
            await new Promise(resolve => setTimeout(resolve, 40));

            // Sort by Batch then by ID (or custom order)
            exportData.sort((a, b) => {
                const bA = getRecordBatch(a);
                const bB = getRecordBatch(b);
                if (bA !== bB) {
                    return bA.localeCompare(bB);
                }
                return 0;
            });

            await generateExcel(exportData);
        } catch (err) {
            console.error("Lỗi xuất Excel:", err);
            alert("Đã xảy ra lỗi khi xuất file Excel.");
        } finally {
            setIsExporting(false);
            isExportingRef.current = false;
        }
    };

    const generateExcel = async (data: any[]) => {
        setExportProgress(30);
        setExportStatusText('Đang khởi tạo mẫu bảng Excel bàn giao chung...');
        await new Promise(resolve => setTimeout(resolve, 30));

        const wb = XLSX.utils.book_new();
        const wsData: any[] = [];
        const now = new Date(selectedDate);
        const day = now.getDate();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        // 1. Title Section
        wsData.push(['CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM']);
        wsData.push(['Độc lập - Tự do - Hạnh phúc']);
        wsData.push(['']); // Empty row

        const title = 'DANH SÁCH BÀN GIAO HỒ SƠ TỔNG HỢP GIAO 1 CỬA';
        wsData.push([title]);
        wsData.push([`NGÀY ${day < 10 ? '0' + day : day} THÁNG ${month < 10 ? '0' + month : month} NĂM ${year}`]);
        
        const batchText = selectedBatch !== 'all' 
            ? (/^đợt/i.test(selectedBatch) ? selectedBatch.toUpperCase() : `ĐỢT: ${selectedBatch}`) 
            : 'TẤT CẢ CÁC ĐỢT';
        
        let fullBatchTitle = `${batchText} - TỔNG SỐ HỒ SƠ: ${data.length}`;
        if (selectedWard !== 'all') {
            fullBatchTitle = `${selectedWard.toUpperCase()} - ${fullBatchTitle}`;
        }

        wsData.push([fullBatchTitle]);
        wsData.push(['']); // Empty row

        // 2. Header Row
        const headers = [
            'STT', 
            'Mã Hồ Sơ', 
            'Chủ Sử Dụng / Đơn Vị',
            'Địa Chỉ (Xã/Phường)', 
            'Thửa', 
            'Tờ', 
            'Loại Hồ Sơ / Phân Hệ', 
            'Hẹn Trả', 
            'Ngày Nhận', 
            'Ký Tên', 
            'Ghi Chú'
        ];
        wsData.push(headers);

        // 3. Data Rows
        const total = data.length;
        for (let index = 0; index < total; index++) {
            const r = data[index];
            const recordCode = r.recordCode || r.so_hieu || r.soDoc || r.id || '';
            const ownerName = r.ownerName || r.noi_nhan_gui || r.data?.chu_su_dung || r.borrowerName || '';
            const wardName = r.ward || r.data?.xa_phuong || r.handoverWard || '';
            const landParcel = r.landParcel || r.data?.thua_dat || '';
            const mapSheet = r.mapSheet || r.data?.to_ban_do || '';
            
            let moduleName = 'Hồ sơ';
            if (r.recordType === 'survey' || r.type === 'survey' || r.sourceTable === 'land_records') moduleName = 'Đo đạc';
            else if (r.recordType === 'certificate' || r.type === 'certificate' || r.sourceTable === 'dangky_records') moduleName = 'Cấp giấy';
            else if (r.type === 'saoluc') moduleName = 'Sao lục';
            else if (r.type === 'congvan') moduleName = 'Công văn';
            else if (r.type === 'vaoso') moduleName = 'Vào sổ';
            else if (r.recordType) moduleName = r.recordType;

            const appointmentDate = r.appointmentDate || r.data?.hen_tra || '';

            wsData.push([
                index + 1,
                recordCode,
                toTitleCase(ownerName),
                wardName,
                landParcel,
                mapSheet,
                moduleName,
                appointmentDate ? appointmentDate.split('T')[0].split('-').reverse().join('/') : '',
                '', // Ký tên / Ngày nhận
                '', 
                r.notes || ''
            ]);

            if (index % 40 === 0 || index === total - 1) {
                const currentPct = 30 + Math.round(((index + 1) / total) * 50);
                setExportProgress(currentPct);
                setExportStatusText(`Đang xử lý bản ghi ${index + 1} / ${total}...`);
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }

        // 4. Footer Section
        wsData.push(['']);
        wsData.push(['']);
        wsData.push(['BÊN GIAO HỒ SƠ', '', '', '', '', '', '', '', '', 'BÊN NHẬN HỒ SƠ']);
        
        setExportProgress(85);
        setExportStatusText('Đang áp dụng định dạng và căn lề...');
        await new Promise(resolve => setTimeout(resolve, 30));

        // Create Worksheet
        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // --- STYLING ---
        const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
        const lastCol = headers.length - 1;

        // Merge Title Rows
        ws['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } }, // CỘNG HÒA...
            { s: { r: 1, c: 0 }, e: { r: 1, c: lastCol } }, // Độc lập...
            { s: { r: 3, c: 0 }, e: { r: 3, c: lastCol } }, // DANH SÁCH...
            { s: { r: 4, c: 0 }, e: { r: 4, c: lastCol } }, // NGÀY...
            { s: { r: 5, c: 0 }, e: { r: 5, c: lastCol } }, // ĐỢT...
            { s: { r: wsData.length - 1, c: 0 }, e: { r: wsData.length - 1, c: 3 } }, // BÊN GIAO...
            { s: { r: wsData.length - 1, c: 9 }, e: { r: wsData.length - 1, c: 10 } }, // BÊN NHẬN...
        ];

        // Column Widths
        ws['!cols'] = [
            { wch: 5 },  // STT
            { wch: 15 }, // Mã Hồ Sơ
            { wch: 25 }, // Chủ Sử Dụng
            { wch: 15 }, // Địa Chỉ
            { wch: 8 },  // Thửa
            { wch: 8 },  // Tờ
            { wch: 20 }, // Loại Hồ Sơ
            { wch: 12 }, // Hẹn Trả
            { wch: 15 }, // Ngày nhận
            { wch: 15 }, // Ký tên
            { wch: 15 }, // Ghi Chú
        ];

        // Styles
        const centerStyle = { alignment: { horizontal: 'center', vertical: 'center' } };
        const boldCenterStyle = { font: { bold: true }, alignment: { horizontal: 'center', vertical: 'center' } };
        const titleStyle = { font: { bold: true, sz: 11 }, alignment: { horizontal: 'center', vertical: 'center' } };
        const headerStyle = { 
            font: { bold: true }, 
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
            border: {
                top: { style: 'thin' }, bottom: { style: 'thin' },
                left: { style: 'thin' }, right: { style: 'thin' }
            }
        };
        const borderStyle = {
            border: {
                top: { style: 'thin' }, bottom: { style: 'thin' },
                left: { style: 'thin' }, right: { style: 'thin' }
            },
            alignment: { vertical: 'center', wrapText: true }
        };

        // Apply styles
        // Row 0: CỘNG HÒA...
        if(ws[XLSX.utils.encode_cell({r:0, c:0})]) ws[XLSX.utils.encode_cell({r:0, c:0})].s = titleStyle;
        // Row 1: Độc lập...
        if(ws[XLSX.utils.encode_cell({r:1, c:0})]) ws[XLSX.utils.encode_cell({r:1, c:0})].s = { font: { bold: true }, border: { bottom: { style: 'medium' } }, alignment: { horizontal: 'center' } };
        // Row 3: DANH SÁCH...
        if(ws[XLSX.utils.encode_cell({r:3, c:0})]) ws[XLSX.utils.encode_cell({r:3, c:0})].s = { font: { bold: true, sz: 14 }, alignment: { horizontal: 'center' } };
        // Row 4: NGÀY...
        if(ws[XLSX.utils.encode_cell({r:4, c:0})]) ws[XLSX.utils.encode_cell({r:4, c:0})].s = { font: { italic: true }, alignment: { horizontal: 'center' } };
        // Row 5: ĐỢT...
        if(ws[XLSX.utils.encode_cell({r:5, c:0})]) ws[XLSX.utils.encode_cell({r:5, c:0})].s = { font: { bold: true, italic: true }, alignment: { horizontal: 'center' } };

        // Header Row (Row 7 - index 7 because of empty rows)
        const headerRowIdx = 7;
        for (let c = 0; c <= lastCol; c++) {
            const cellRef = XLSX.utils.encode_cell({ r: headerRowIdx, c: c });
            if (!ws[cellRef]) continue;
            ws[cellRef].s = headerStyle;
        }

        // Data Rows
        for (let r = headerRowIdx + 1; r < wsData.length - 3; r++) { // -3 for footer rows
            for (let c = 0; c <= lastCol; c++) {
                const cellRef = XLSX.utils.encode_cell({ r: r, c: c });
                if (!ws[cellRef]) ws[cellRef] = { v: '', t: 's' }; // Ensure cell exists
                ws[cellRef].s = borderStyle;
                
                // Center align specific columns
                if ([0, 1, 3, 4, 5, 7].includes(c)) {
                    ws[cellRef].s = { ...borderStyle, alignment: { horizontal: 'center', vertical: 'center' } };
                }
            }
        }

        // Footer Row
        const footerRowIdx = wsData.length - 1;
        if(ws[XLSX.utils.encode_cell({r:footerRowIdx, c:0})]) ws[XLSX.utils.encode_cell({r:footerRowIdx, c:0})].s = boldCenterStyle;
        if(ws[XLSX.utils.encode_cell({r:footerRowIdx, c:9})]) ws[XLSX.utils.encode_cell({r:footerRowIdx, c:9})].s = boldCenterStyle;

        setExportProgress(95);
        setExportStatusText('Đang kết xuất tệp Excel...');
        await new Promise(resolve => setTimeout(resolve, 40));

        XLSX.utils.book_append_sheet(wb, ws, "DanhSachBanGiao");
        XLSX.writeFile(wb, `DanhSachBanGiao_${type}_${selectedDate}.xlsx`);
        
        setExportProgress(100);
        setExportStatusText('Xuất hoàn tất!');
        await new Promise(resolve => setTimeout(resolve, 300));
        setIsExporting(false);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in">
            <div className="bg-white rounded-xl shadow-xl w-[500px] overflow-hidden animate-scale-in">
                <div className="bg-green-600 p-4 flex justify-between items-center text-white">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <FileDown size={20}/> Xuất danh sách bàn giao
                    </h3>
                    <button onClick={onClose} className="hover:bg-green-700 p-1 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-6 space-y-4">
                    {/* Date Selection */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-1">
                            <Calendar size={14}/> Ngày giao
                        </label>
                        <input 
                            type="date" 
                            value={selectedDate} 
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none"
                        />
                    </div>

                    {/* Ward Selection (Only for Sao Luc) */}
                    {type === 'saoluc' && wards && (
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-1">
                                <MapPin size={14}/> Xã / Phường
                            </label>
                            <select 
                                value={selectedWard} 
                                onChange={(e) => setSelectedWard(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none"
                            >
                                <option value="all">Tất cả</option>
                                {wards.map(w => <option key={w} value={w}>{w}</option>)}
                            </select>
                        </div>
                    )}

                    {/* Batch Selection */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-1">
                            <List size={14}/> Đợt giao
                        </label>
                        <select 
                            value={selectedBatch} 
                            onChange={(e) => setSelectedBatch(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none"
                            disabled={availableBatches.length === 0}
                        >
                            <option value="all">Tất cả các đợt</option>
                            {availableBatches.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                        {availableBatches.length === 0 && (
                            <p className="text-xs text-red-500 mt-1 italic">Không tìm thấy đợt giao nào trong ngày này.</p>
                        )}
                    </div>

                    {/* Progress Bar when exporting */}
                    {isExporting && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-2">
                            <div className="flex justify-between items-center text-xs text-green-800 font-medium">
                                <span>{exportStatusText}</span>
                                <span>{exportProgress}%</span>
                            </div>
                            <div className="w-full bg-green-200 h-2 rounded-full overflow-hidden">
                                <div 
                                    className="bg-green-600 h-full transition-all duration-200 rounded-full"
                                    style={{ width: `${exportProgress}%` }}
                                />
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 mt-4">
                        <button 
                            type="button"
                            onClick={onClose} 
                            disabled={isExporting}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium disabled:opacity-50"
                        >
                            Hủy
                        </button>
                        <button 
                            type="button"
                            onClick={handleExport} 
                            disabled={isExporting || (availableBatches.length === 0 && selectedBatch !== 'all')}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-sm shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer active:scale-95"
                        >
                            {isExporting ? (
                                <>
                                    <Loader2 size={18} className="animate-spin text-white" />
                                    <span>Đang xuất</span>
                                </>
                            ) : (
                                <>
                                    <FileDown size={18} />
                                    <span>Đồng ý</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExportHandoverModal;
