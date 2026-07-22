import React, { useState, useEffect } from 'react';
import { X, FileDown, Calendar, MapPin, List } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { ArchiveRecord } from '../../services/apiArchive';
import { toTitleCase } from '../../utils/appHelpers';

interface ExportHandoverModalProps {
    isOpen: boolean;
    onClose: () => void;
    records: ArchiveRecord[];
    type: 'saoluc' | 'congvan';
    wards?: string[];
}

const ExportHandoverModal: React.FC<ExportHandoverModalProps> = ({ isOpen, onClose, records, type, wards }) => {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedWard, setSelectedWard] = useState<string>('all');
    const [selectedBatch, setSelectedBatch] = useState<string>('all');
    const [availableBatches, setAvailableBatches] = useState<string[]>([]);

    // Reset state when opening
    useEffect(() => {
        if (isOpen) {
            setSelectedDate(new Date().toISOString().split('T')[0]);
            setSelectedWard('all');
            setSelectedBatch('all');
        }
    }, [isOpen]);

    // Update available batches based on date and ward
    useEffect(() => {
        const batches = new Set<string>();
        records.forEach(r => {
            // Filter by type and completed status
            if (r.type !== type || r.status !== 'completed') return;
            
            // Filter by date (ngay_hoan_thanh)
            if ((r.data?.ngay_hoan_thanh || '').split('T')[0] !== selectedDate) return;

            // Filter by ward (if applicable and selected)
            if (type === 'saoluc' && selectedWard !== 'all') {
                if (r.data?.xa_phuong !== selectedWard) return;
            }

            if (r.data?.danh_sach) {
                batches.add(r.data.danh_sach);
            }
        });
        setAvailableBatches(Array.from(batches).sort());
        setSelectedBatch('all'); // Reset batch selection
    }, [selectedDate, selectedWard, records, type]);

    const handleExport = () => {
        // Filter records to export
        const exportData = records.filter(r => {
            if (r.type !== type || r.status !== 'completed') return false;
            if ((r.data?.ngay_hoan_thanh || '').split('T')[0] !== selectedDate) return false;
            if (type === 'saoluc' && selectedWard !== 'all' && r.data?.xa_phuong !== selectedWard) return false;
            if (selectedBatch !== 'all' && r.data?.danh_sach !== selectedBatch) return false;
            return true;
        });

        if (exportData.length === 0) {
            alert('Không có hồ sơ nào để xuất!');
            return;
        }

        // Sort by Batch then by ID (or custom order)
        exportData.sort((a, b) => {
            if (a.data?.danh_sach !== b.data?.danh_sach) {
                return (a.data?.danh_sach || '').localeCompare(b.data?.danh_sach || '');
            }
            return 0;
        });

        generateExcel(exportData);
    };

    const generateExcel = (data: ArchiveRecord[]) => {
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

        const title = type === 'saoluc' ? 'DANH SÁCH BÀN GIAO HỒ SƠ SAO LỤC' : 'DANH SÁCH BÀN GIAO CÔNG VĂN';
        wsData.push([title]);
        wsData.push([`NGÀY ${day < 10 ? '0' + day : day} THÁNG ${month < 10 ? '0' + month : month} NĂM ${year}`]);
        
        const batchText = selectedBatch !== 'all' ? `ĐỢT: ${selectedBatch.replace(/Đợt /i, '')}` : 'TẤT CẢ CÁC ĐỢT';
        
        // Add Ward name to title if selected
        let fullBatchTitle = `${batchText} - TỔNG SỐ HỒ SƠ: ${data.length}`;
        if (type === 'saoluc' && selectedWard !== 'all') {
            fullBatchTitle = `${selectedWard.toUpperCase()} - ${fullBatchTitle}`;
        }

        wsData.push([fullBatchTitle]);
        wsData.push(['']); // Empty row

        // 2. Header Row
        const headers = [
            'STT', 
            'Mã Hồ Sơ', 
            type === 'saoluc' ? 'Chủ Sử Dụng' : 'Cơ quan phát hành',
            'Địa Chỉ (Xã)', 
            'Thửa', 
            'Tờ', 
            'Loại Hồ Sơ', 
            'Hẹn Trả', 
            'Ngày nhận hồ sơ', 
            'Ký tên', 
            'Ghi Chú'
        ];
        wsData.push(headers);

        // 3. Data Rows
        data.forEach((r, index) => {
            wsData.push([
                index + 1,
                r.so_hieu,
                toTitleCase(r.noi_nhan_gui),
                r.data?.xa_phuong || '',
                r.data?.thua_dat || '',
                r.data?.to_ban_do || '',
                type === 'saoluc' ? 'Sao lục' : 'Công văn',
                r.data?.hen_tra ? r.data.hen_tra.split('-').reverse().join('/') : '',
                '', // Ngày nhận hồ sơ (Empty)
                '', // Ký tên (Empty)
                ''  // Ghi Chú (Empty)
            ]);
        });

        // 4. Footer Section
        wsData.push(['']);
        wsData.push(['']);
        wsData.push(['BÊN GIAO HỒ SƠ', '', '', '', '', '', '', '', '', 'BÊN NHẬN HỒ SƠ']);
        
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
        if(ws[XLSX.utils.encode_cell({r:1, c:0})]) ws[XLSX.utils.encode_cell({r:1, c:0})].s = { font: { bold: true, underline: true }, alignment: { horizontal: 'center' } };
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

        XLSX.utils.book_append_sheet(wb, ws, "DanhSachBanGiao");
        XLSX.writeFile(wb, `DanhSachBanGiao_${type}_${selectedDate}.xlsx`);
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

                    <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 mt-4">
                        <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium">Hủy</button>
                        <button 
                            onClick={handleExport} 
                            disabled={availableBatches.length === 0 && selectedBatch !== 'all'}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg font-bold text-sm hover:bg-green-700 shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <FileDown size={16}/> Xuất Excel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExportHandoverModal;
