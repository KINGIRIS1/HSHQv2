import React, { useState, useMemo } from 'react';
import { RecordFile, RecordStatus, Employee } from '../../types';
import { getNormalizedWard, getShortRecordType, STATUS_LABELS } from '../../constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { DollarSign, CreditCard, Wallet, TrendingUp, Table2, BarChart3, FileSpreadsheet, Search, Filter, PieChart as PieChartIcon } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';

interface RevenueStatsViewProps {
    records: RecordFile[];
    employees: Employee[];
    fromDate?: string;
    toDate?: string;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#6366f1', '#ef4444'];

const RevenueStatsView: React.FC<RevenueStatsViewProps> = ({ records, employees, fromDate, toDate }) => {
    const [subTab, setSubTab] = useState<'overview' | 'ward' | 'type' | 'records'>('overview');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedWardFilter, setSelectedWardFilter] = useState('all');
    const [paymentStatusFilter, setPaymentStatusFilter] = useState<'all' | 'paid' | 'advance' | 'unpaid'>('all');

    // Filter records that have financial data or belong to the set
    const revenueRecords = useMemo(() => {
        return records.map(r => {
            const price = Number(r.price) || 0;
            const advance = Number(r.advancePayment) || 0;
            const returned = r.returnedPrice !== undefined && r.returnedPrice !== null ? Number(r.returnedPrice) : (r.status === RecordStatus.RETURNED || r.status === RecordStatus.HANDOVER ? price : 0);
            
            // Effective total value for this record
            const effectiveTotal = returned > 0 ? returned : price;
            const remaining = Math.max(0, effectiveTotal - advance);

            return {
                ...r,
                calcPrice: price,
                calcAdvance: advance,
                calcReturned: returned,
                calcEffectiveTotal: effectiveTotal,
                calcRemaining: remaining
            };
        });
    }, [records]);

    // Financial KPI Summary
    const summary = useMemo(() => {
        let totalEstimated = 0;
        let totalCollected = 0;
        let totalAdvance = 0;
        let totalRemaining = 0;
        let feeCount = 0;

        revenueRecords.forEach(r => {
            if (r.calcEffectiveTotal > 0 || r.calcAdvance > 0) {
                feeCount++;
            }
            totalEstimated += r.calcPrice;
            totalCollected += r.calcReturned;
            totalAdvance += r.calcAdvance;
            totalRemaining += r.calcRemaining;
        });

        return {
            totalEstimated,
            totalCollected,
            totalAdvance,
            totalRemaining,
            feeCount,
            totalRecords: revenueRecords.length
        };
    }, [revenueRecords]);

    // Breakdown by Ward
    const wardData = useMemo(() => {
        const map: Record<string, { ward: string; count: number; totalEstimated: number; totalCollected: number; totalAdvance: number; totalRemaining: number }> = {};

        revenueRecords.forEach(r => {
            const ward = getNormalizedWard(r.ward) || 'Chưa xác định';
            if (!map[ward]) {
                map[ward] = {
                    ward,
                    count: 0,
                    totalEstimated: 0,
                    totalCollected: 0,
                    totalAdvance: 0,
                    totalRemaining: 0
                };
            }
            map[ward].count += 1;
            map[ward].totalEstimated += r.calcPrice;
            map[ward].totalCollected += r.calcReturned;
            map[ward].totalAdvance += r.calcAdvance;
            map[ward].totalRemaining += r.calcRemaining;
        });

        return Object.values(map).sort((a, b) => b.totalCollected - a.totalCollected);
    }, [revenueRecords]);

    // Breakdown by Record Type
    const typeData = useMemo(() => {
        const map: Record<string, { type: string; count: number; totalCollected: number; totalEstimated: number }> = {};

        revenueRecords.forEach(r => {
            const type = getShortRecordType(r.recordType) || 'Khác';
            if (!map[type]) {
                map[type] = {
                    type,
                    count: 0,
                    totalCollected: 0,
                    totalEstimated: 0
                };
            }
            map[type].count += 1;
            map[type].totalCollected += r.calcReturned;
            map[type].totalEstimated += r.calcPrice;
        });

        return Object.values(map).sort((a, b) => b.totalCollected - a.totalCollected);
    }, [revenueRecords]);

    // Filtered records list for detail table
    const filteredDetailRecords = useMemo(() => {
        return revenueRecords.filter(r => {
            if (selectedWardFilter !== 'all' && getNormalizedWard(r.ward) !== selectedWardFilter) {
                return false;
            }

            if (paymentStatusFilter === 'paid' && r.calcReturned <= 0) return false;
            if (paymentStatusFilter === 'advance' && r.calcAdvance <= 0) return false;
            if (paymentStatusFilter === 'unpaid' && (r.calcReturned > 0 || r.calcAdvance > 0)) return false;

            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase();
                const matchCode = r.code?.toLowerCase().includes(term);
                const matchName = r.customerName?.toLowerCase().includes(term);
                const matchWard = r.ward?.toLowerCase().includes(term);
                return matchCode || matchName || matchWard;
            }

            return true;
        });
    }, [revenueRecords, selectedWardFilter, paymentStatusFilter, searchTerm]);

    // Export Excel Function for Revenue Report
    const handleExportExcel = () => {
        const rows = filteredDetailRecords.map((r, index) => ({
            STT: index + 1,
            'Mã hồ sơ': r.code || '',
            'Tên khách hàng': r.customerName || '',
            'Xã / Phường': getNormalizedWard(r.ward) || '',
            'Loại hồ sơ': getShortRecordType(r.recordType) || '',
            'Ngày nhận': r.receivedDate || '',
            'Ngày trả KQ': r.resultReturnedDate || r.completedDate || '',
            'Giá trị gốc (Đ)': r.calcPrice,
            'Tạm ứng (Đ)': r.calcAdvance,
            'Đã thu thực tế (Đ)': r.calcReturned,
            'Còn phải thu (Đ)': r.calcRemaining,
            'Trạng thái': STATUS_LABELS[r.status as RecordStatus] || r.status
        }));

        const worksheet = XLSX.utils.json_to_sheet(rows);

        // Formatting header
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const address = XLSX.utils.encode_cell({ r: 0, c: C });
            if (!worksheet[address]) continue;
            worksheet[address].s = {
                font: { bold: true, color: { rgb: "FFFFFF" } },
                fill: { fgColor: { rgb: "1E40AF" } },
                alignment: { horizontal: "center", vertical: "center" }
            };
        }

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "BaoCaoDoanhThu");

        const fileName = `Bao_Cao_Doanh_Thu_${fromDate || 'TatCa'}_${toDate || 'HienTai'}.xlsx`;
        XLSX.writeFile(workbook, fileName);
    };

    return (
        <div className="flex flex-col h-full bg-slate-100 p-4 gap-4 overflow-y-auto">
            {/* 1. TOP CARDS OVERVIEW */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-sm flex items-center gap-3">
                    <div className="p-3 bg-emerald-100 text-emerald-700 rounded-lg">
                        <DollarSign size={24} />
                    </div>
                    <div>
                        <div className="text-xs font-bold text-emerald-600 uppercase">Đã thu thực tế</div>
                        <div className="text-xl font-black text-emerald-800">
                            {summary.totalCollected.toLocaleString('vi-VN')} đ
                        </div>
                        <div className="text-[11px] text-emerald-600">
                            Trên {summary.feeCount} hồ sơ có thu phí
                        </div>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-sm flex items-center gap-3">
                    <div className="p-3 bg-blue-100 text-blue-700 rounded-lg">
                        <Wallet size={24} />
                    </div>
                    <div>
                        <div className="text-xs font-bold text-blue-600 uppercase">Tiền tạm ứng</div>
                        <div className="text-xl font-black text-blue-800">
                            {summary.totalAdvance.toLocaleString('vi-VN')} đ
                        </div>
                        <div className="text-[11px] text-blue-600">
                            Số tiền dân đã ứng trước
                        </div>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm flex items-center gap-3">
                    <div className="p-3 bg-amber-100 text-amber-700 rounded-lg">
                        <CreditCard size={24} />
                    </div>
                    <div>
                        <div className="text-xs font-bold text-amber-600 uppercase">Giá trị gốc dự kiến</div>
                        <div className="text-xl font-black text-amber-800">
                            {summary.totalEstimated.toLocaleString('vi-VN')} đ
                        </div>
                        <div className="text-[11px] text-amber-600">
                            Tổng theo đơn giá niêm yết
                        </div>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-purple-200 shadow-sm flex items-center gap-3">
                    <div className="p-3 bg-purple-100 text-purple-700 rounded-lg">
                        <TrendingUp size={24} />
                    </div>
                    <div>
                        <div className="text-xs font-bold text-purple-600 uppercase">Còn phải thu</div>
                        <div className="text-xl font-black text-purple-800">
                            {summary.totalRemaining.toLocaleString('vi-VN')} đ
                        </div>
                        <div className="text-[11px] text-purple-600">
                            Chênh lệch chưa hoàn tất
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. SUB NAVIGATION TABS */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button
                        onClick={() => setSubTab('overview')}
                        className={`px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                            subTab === 'overview' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                        }`}
                    >
                        <BarChart3 size={15} /> Biểu đồ doanh thu
                    </button>
                    <button
                        onClick={() => setSubTab('ward')}
                        className={`px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                            subTab === 'ward' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                        }`}
                    >
                        <PieChartIcon size={15} /> Theo Xã/Phường
                    </button>
                    <button
                        onClick={() => setSubTab('type')}
                        className={`px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                            subTab === 'type' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                        }`}
                    >
                        <Table2 size={15} /> Theo Loại hồ sơ
                    </button>
                    <button
                        onClick={() => setSubTab('records')}
                        className={`px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                            subTab === 'records' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                        }`}
                    >
                        <FileSpreadsheet size={15} /> Chi tiết hồ sơ ({filteredDetailRecords.length})
                    </button>
                </div>

                <button
                    onClick={handleExportExcel}
                    className="hidden md:flex px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm items-center gap-2 transition-all"
                >
                    <FileSpreadsheet size={16} /> Xuất Excel Doanh Thu
                </button>
            </div>

            {/* 3. TAB CONTENT */}
            <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm p-4 min-h-[400px]">
                {/* SUBTAB 1: BIỂU ĐỒ OVERVIEW */}
                {subTab === 'overview' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full min-h-[380px]">
                        <div className="flex flex-col h-full">
                            <h3 className="font-bold text-gray-800 text-sm mb-4 flex items-center gap-2">
                                <BarChart3 size={18} className="text-blue-600" /> Doanh thu thực tế theo địa bàn (VNĐ)
                            </h3>
                            <div className="flex-1 min-h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={wardData.slice(0, 10)} margin={{ top: 10, right: 20, left: 20, bottom: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="ward" fontSize={11} interval={0} angle={-15} textAnchor="end" />
                                        <YAxis fontSize={11} tickFormatter={(val) => `${(val / 1000000).toFixed(1)}M`} />
                                        <Tooltip
                                            formatter={(value: any) => [`${Number(value).toLocaleString('vi-VN')} đ`, 'Đã thu']}
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        />
                                        <Bar dataKey="totalCollected" fill="#10b981" radius={[4, 4, 0, 0]} name="Đã thu" barSize={35} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="flex flex-col h-full border-t lg:border-t-0 lg:border-l lg:pl-6 border-gray-100 pt-4 lg:pt-0">
                            <h3 className="font-bold text-gray-800 text-sm mb-4 flex items-center gap-2">
                                <PieChartIcon size={18} className="text-purple-600" /> Tỷ lệ doanh thu theo Loại hồ sơ
                            </h3>
                            <div className="flex-1 min-h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={typeData}
                                            dataKey="totalCollected"
                                            nameKey="type"
                                            cx="50%"
                                            cy="50%"
                                            outerRadius={100}
                                            label={(entry) => `${entry.type}: ${(entry.totalCollected / 1000000).toFixed(1)}M`}
                                        >
                                            {typeData.map((_, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(val: any) => `${Number(val).toLocaleString('vi-VN')} đ`} />
                                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                )}

                {/* SUBTAB 2: DOANH THU THEO XÃ */}
                {subTab === 'ward' && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left border-collapse">
                            <thead className="bg-gray-50 text-xs font-bold text-gray-600 uppercase border-b border-gray-200">
                                <tr>
                                    <th className="p-3 w-12 text-center">STT</th>
                                    <th className="p-3">Xã / Phường</th>
                                    <th className="p-3 text-center">Số hồ sơ</th>
                                    <th className="p-3 text-right">Giá trị dự kiến</th>
                                    <th className="p-3 text-right">Tạm ứng</th>
                                    <th className="p-3 text-right text-emerald-700 bg-emerald-50/50">Đã thu thực tế</th>
                                    <th className="p-3 text-right text-purple-700 bg-purple-50/50">Còn phải thu</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {wardData.map((row, idx) => (
                                    <tr key={row.ward} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-3 text-center text-gray-400">{idx + 1}</td>
                                        <td className="p-3 font-semibold text-gray-800">{row.ward}</td>
                                        <td className="p-3 text-center font-bold text-blue-600">{row.count}</td>
                                        <td className="p-3 text-right font-mono text-gray-700">{row.totalEstimated.toLocaleString('vi-VN')} đ</td>
                                        <td className="p-3 text-right font-mono text-blue-700">{row.totalAdvance.toLocaleString('vi-VN')} đ</td>
                                        <td className="p-3 text-right font-mono font-bold text-emerald-700 bg-emerald-50/30">
                                            {row.totalCollected.toLocaleString('vi-VN')} đ
                                        </td>
                                        <td className="p-3 text-right font-mono font-bold text-purple-700 bg-purple-50/30">
                                            {row.totalRemaining.toLocaleString('vi-VN')} đ
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300">
                                <tr>
                                    <td colSpan={2} className="p-3 text-right uppercase">Tổng cộng:</td>
                                    <td className="p-3 text-center text-blue-800">{summary.totalRecords}</td>
                                    <td className="p-3 text-right font-mono">{summary.totalEstimated.toLocaleString('vi-VN')} đ</td>
                                    <td className="p-3 text-right font-mono text-blue-800">{summary.totalAdvance.toLocaleString('vi-VN')} đ</td>
                                    <td className="p-3 text-right font-mono text-emerald-800 bg-emerald-100/50">{summary.totalCollected.toLocaleString('vi-VN')} đ</td>
                                    <td className="p-3 text-right font-mono text-purple-800 bg-purple-100/50">{summary.totalRemaining.toLocaleString('vi-VN')} đ</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}

                {/* SUBTAB 3: DOANH THU THEO LOẠI HỒ SƠ */}
                {subTab === 'type' && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left border-collapse">
                            <thead className="bg-gray-50 text-xs font-bold text-gray-600 uppercase border-b border-gray-200">
                                <tr>
                                    <th className="p-3 w-12 text-center">STT</th>
                                    <th className="p-3">Loại hồ sơ</th>
                                    <th className="p-3 text-center">Số lượng</th>
                                    <th className="p-3 text-right">Giá trị gốc dự kiến</th>
                                    <th className="p-3 text-right text-emerald-700 bg-emerald-50/50">Đã thu thực tế</th>
                                    <th className="p-3 text-center">% Doanh thu</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {typeData.map((row, idx) => {
                                    const percent = summary.totalCollected > 0 ? ((row.totalCollected / summary.totalCollected) * 100).toFixed(1) : '0';
                                    return (
                                        <tr key={row.type} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-3 text-center text-gray-400">{idx + 1}</td>
                                            <td className="p-3 font-semibold text-gray-800">{row.type}</td>
                                            <td className="p-3 text-center font-bold text-blue-600">{row.count}</td>
                                            <td className="p-3 text-right font-mono text-gray-700">{row.totalEstimated.toLocaleString('vi-VN')} đ</td>
                                            <td className="p-3 text-right font-mono font-bold text-emerald-700 bg-emerald-50/30">
                                                {row.totalCollected.toLocaleString('vi-VN')} đ
                                            </td>
                                            <td className="p-3 text-center font-bold text-purple-700">{percent}%</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* SUBTAB 4: CHI TIẾT DANH SÁCH HỒ SƠ */}
                {subTab === 'records' && (
                    <div className="space-y-4">
                        {/* Search & Filters */}
                        <div className="flex flex-wrap items-center gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
                            <div className="relative flex-1 min-w-[200px]">
                                <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Tìm mã HS, tên khách hàng, địa chỉ..."
                                    className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-300 rounded-md outline-none focus:border-blue-500 bg-white"
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <Filter size={15} className="text-gray-500" />
                                <select
                                    value={selectedWardFilter}
                                    onChange={(e) => setSelectedWardFilter(e.target.value)}
                                    className="px-2 py-1.5 text-xs border border-gray-300 rounded-md outline-none bg-white font-medium"
                                >
                                    <option value="all">Tất cả Xã / Phường</option>
                                    {wardData.map(w => (
                                        <option key={w.ward} value={w.ward}>{w.ward}</option>
                                    ))}
                                </select>

                                <select
                                    value={paymentStatusFilter}
                                    onChange={(e) => setPaymentStatusFilter(e.target.value as any)}
                                    className="px-2 py-1.5 text-xs border border-gray-300 rounded-md outline-none bg-white font-medium"
                                >
                                    <option value="all">Tất cả thanh toán</option>
                                    <option value="paid">Đã thu thực tế (&gt;0)</option>
                                    <option value="advance">Có tạm ứng (&gt;0)</option>
                                    <option value="unpaid">Chưa thu phí (0đ)</option>
                                </select>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="overflow-x-auto max-h-[500px] border border-gray-200 rounded-lg">
                            <table className="w-full text-xs text-left border-collapse">
                                <thead className="bg-gray-100 text-gray-600 font-bold sticky top-0 shadow-sm z-10">
                                    <tr>
                                        <th className="p-2.5 w-10 text-center border-b">#</th>
                                        <th className="p-2.5 w-28 border-b">Mã HS</th>
                                        <th className="p-2.5 min-w-[150px] border-b">Khách hàng</th>
                                        <th className="p-2.5 w-28 border-b">Xã/Phường</th>
                                        <th className="p-2.5 w-28 border-b">Loại HS</th>
                                        <th className="p-2.5 text-right w-28 border-b">Giá trị gốc</th>
                                        <th className="p-2.5 text-right w-28 border-b">Tạm ứng</th>
                                        <th className="p-2.5 text-right w-32 border-b bg-emerald-100/50 text-emerald-800">Đã thu thực tế</th>
                                        <th className="p-2.5 text-right w-28 border-b bg-purple-100/50 text-purple-800">Còn lại</th>
                                        <th className="p-2.5 text-center w-24 border-b">Trạng thái</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredDetailRecords.length > 0 ? (
                                        filteredDetailRecords.map((r, idx) => (
                                            <tr key={r.id || idx} className="hover:bg-blue-50/40 transition-colors">
                                                <td className="p-2.5 text-center text-gray-400">{idx + 1}</td>
                                                <td className="p-2.5 font-bold text-blue-600">{r.code}</td>
                                                <td className="p-2.5 font-medium text-gray-800">{r.customerName}</td>
                                                <td className="p-2.5 text-gray-600">{getNormalizedWard(r.ward)}</td>
                                                <td className="p-2.5 text-gray-600">{getShortRecordType(r.recordType)}</td>
                                                <td className="p-2.5 text-right font-mono text-gray-700">
                                                    {r.calcPrice ? `${r.calcPrice.toLocaleString('vi-VN')} đ` : '—'}
                                                </td>
                                                <td className="p-2.5 text-right font-mono text-blue-700">
                                                    {r.calcAdvance ? `${r.calcAdvance.toLocaleString('vi-VN')} đ` : '—'}
                                                </td>
                                                <td className="p-2.5 text-right font-mono font-bold text-emerald-700 bg-emerald-50/30">
                                                    {r.calcReturned ? `${r.calcReturned.toLocaleString('vi-VN')} đ` : '—'}
                                                </td>
                                                <td className="p-2.5 text-right font-mono font-bold text-purple-700 bg-purple-50/30">
                                                    {r.calcRemaining ? `${r.calcRemaining.toLocaleString('vi-VN')} đ` : '—'}
                                                </td>
                                                <td className="p-2.5 text-center">
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                                                        {STATUS_LABELS[r.status as RecordStatus] || r.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={10} className="p-8 text-center text-gray-400 italic">
                                                Không tìm thấy hồ sơ phù hợp với điều kiện lọc.
                                            </td>
                                        </tr>
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

export default RevenueStatsView;
