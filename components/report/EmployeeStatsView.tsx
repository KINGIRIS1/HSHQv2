
import React, { useState, useMemo } from 'react';
import { RecordFile, Employee, RecordStatus } from '../../types';
import { generateEmployeeEvaluation } from '../../services/geminiService';
import { User as UserIcon, AlertOctagon, Sparkles, Loader2, ListFilter, CheckCircle2, Clock, AlertTriangle, Briefcase, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { STATUS_LABELS } from '../../constants';

interface EmployeeStatsViewProps {
    records: RecordFile[];
    employees: Employee[];
    fromDate: string;
    toDate: string;
    selectedEmpId: string;
    setSelectedEmpId: (id: string) => void;
}

const EmployeeStatsView: React.FC<EmployeeStatsViewProps> = ({ 
    records, employees, fromDate, toDate, selectedEmpId, setSelectedEmpId 
}) => {
    const [aiEvaluation, setAiEvaluation] = useState<string>('');
    const [isGenerating, setIsGenerating] = useState(false);

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
        const targetRecords = selectedEmpId 
            ? recordsInTimeRange.filter(r => r.assignedTo === selectedEmpId)
            : recordsInTimeRange;

        const total = targetRecords.length;
        
        let completedCount = 0;
        let processingCount = 0;
        let overduePendingCount = 0;
        let overdueCompletedCount = 0;
        
        const overdueRecords: { record: RecordFile, daysOver: number }[] = [];

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
                    const today = new Date(); today.setHours(0,0,0,0);
                    if (today > d) {
                        overduePendingCount++;
                        const diffTime = today.getTime() - d.getTime();
                        const daysOver = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        overdueRecords.push({ record: r, daysOver });
                    }
                }
            }
        });

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
    }, [recordsInTimeRange, selectedEmpId]);

    const handleGenerateReview = async () => {
        if (!stats || !selectedEmpId) return;
        setIsGenerating(true);
        const emp = employees.find(e => e.id === selectedEmpId);
        const empName = emp ? emp.name : "Nhân viên";
        
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
            `Từ ${new Date(fromDate).toLocaleDateString('vi-VN')} đến ${new Date(toDate).toLocaleDateString('vi-VN')}`
        );
        
        setAiEvaluation(result);
        setIsGenerating(false);
    };

    const handleExportEmployeeRecords = () => {
        if (!selectedEmpId) return;
        
        const emp = employees.find(e => e.id === selectedEmpId);
        const empName = emp ? emp.name : "NhanVien";
        
        const targetRecords = recordsInTimeRange.filter(r => r.assignedTo === selectedEmpId);
        
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
            'Ghi chú': r.notes || r.content
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
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500 bg-white transition-shadow shadow-sm cursor-pointer hover:border-indigo-300"
                            value={selectedEmpId}
                            onChange={(e) => { setSelectedEmpId(e.target.value); setAiEvaluation(''); }}
                        >
                            <option value="">-- Tổng hợp tất cả nhân viên --</option>
                            {employees.map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.name} - {emp.department}</option>
                            ))}
                        </select>
                    </div>
                    {selectedEmpId && (
                        <button 
                            onClick={handleExportEmployeeRecords}
                            className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-green-700 shadow-sm flex items-center gap-2 whitespace-nowrap"
                            title="Xuất danh sách hồ sơ của nhân viên này"
                        >
                            <FileSpreadsheet size={18} /> Xuất DS
                        </button>
                    )}
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
                <div className="flex flex-col items-center justify-center h-64 bg-white rounded-xl border border-dashed border-slate-300 text-gray-400 m-4 shadow-sm">
                    <UserIcon size={48} className="mb-3 opacity-20"/>
                    <p className="text-sm font-medium">Vui lòng chọn một nhân viên cụ thể ở trên để xem chi tiết.</p>
                </div>
            )}
        </div>
    );
};

export default EmployeeStatsView;
