import React, { useState, useEffect } from 'react';
import { RecordFile, RecordStatus, Employee, User as UserType } from '../../types';
import { STATUS_LABELS, STATUS_COLORS, getWardLabel, getShortRecordType } from '../../constants';
import { inspectRecordDirectlyInSupabase, repairRecordStatusInSupabase, SupabaseRecordInspection } from '../../services/apiRecords';
import { 
    Search, Database, Loader2, AlertTriangle, CheckCircle2, 
    RefreshCw, ArrowRight, Layers, FileText, User, Phone, 
    MapPin, Tag, Clock, Wrench, ShieldCheck, Eye, Sparkles, Filter
} from 'lucide-react';

interface DatabaseInspectorTabProps {
    records?: RecordFile[];
    employees?: Employee[];
    currentUser?: UserType;
    notify?: (message: string, type?: 'success' | 'error' | 'info') => void;
    onViewDetail?: (record: RecordFile) => void;
    onRecordUpdated?: () => void;
}

export const DatabaseInspectorTab: React.FC<DatabaseInspectorTabProps> = ({
    records = [],
    employees = [],
    currentUser,
    notify,
    onViewDetail,
    onRecordUpdated
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [tableFilter, setTableFilter] = useState<'ALL' | 'land_records' | 'dangky_records' | 'luutru_records'>('ALL');
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState<SupabaseRecordInspection[]>([]);
    const [hasSearched, setHasSearched] = useState(false);
    const [repairingId, setRepairingId] = useState<string | null>(null);
    const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
    const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);

    const handleSearch = async (termToSearch?: string) => {
        const query = (termToSearch !== undefined ? termToSearch : searchTerm).trim();
        if (!query) {
            if (notify) notify('Vui lòng nhập từ khóa tìm kiếm (Mã hồ sơ, Tên chủ, SĐT, Số tờ, Số thửa,...)', 'info');
            return;
        }

        setIsLoading(true);
        setActionMessage(null);
        try {
            const data = await inspectRecordDirectlyInSupabase(query);
            setResults(data);
            setHasSearched(true);
            if (data.length === 0 && notify) {
                notify(`Không tìm thấy hồ sơ nào khớp với từ khóa "${query}" trên CSDL Supabase.`, 'info');
            }
        } catch (err: any) {
            console.error("Lỗi tra cứu CSDL Supabase:", err);
            setActionMessage({ text: `Lỗi truy vấn CSDL: ${err?.message || 'Không thể kết nối CSDL'}`, type: 'error' });
            if (notify) notify(`Lỗi truy vấn CSDL: ${err?.message || 'Không thể kết nối CSDL'}`, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRepairStatus = async (item: SupabaseRecordInspection, targetStatus: RecordStatus, label: string) => {
        setRepairingId(item.id);
        setActionMessage(null);
        try {
            const ok = await repairRecordStatusInSupabase(item.table, item.id, targetStatus);
            if (ok) {
                const msg = `Đã chuyển trạng thái hồ sơ [${item.code}] thành "${label}" trên bảng ${item.table}!`;
                setActionMessage({ text: msg, type: 'success' });
                if (notify) notify(msg, 'success');
                // Tải lại kết quả tìm kiếm
                await handleSearch();
                if (onRecordUpdated) onRecordUpdated();
            } else {
                const msg = `Không thể cập nhật hồ sơ [${item.code}]. Vui lòng thử lại.`;
                setActionMessage({ text: msg, type: 'error' });
                if (notify) notify(msg, 'error');
            }
        } catch (err: any) {
            const msg = `Lỗi: ${err?.message || 'Thao tác thất bại'}`;
            setActionMessage({ text: msg, type: 'error' });
            if (notify) notify(msg, 'error');
        } finally {
            setRepairingId(null);
        }
    };

    const filteredResults = results.filter(item => {
        if (tableFilter !== 'ALL' && item.table !== tableFilter) return false;
        return true;
    });

    const getTableBadge = (table: 'land_records' | 'dangky_records' | 'luutru_records') => {
        switch (table) {
            case 'land_records':
                return <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs px-2.5 py-0.5 rounded-full font-bold">Bảng Đo đạc (land_records)</span>;
            case 'dangky_records':
                return <span className="bg-blue-100 text-blue-800 border border-blue-300 text-xs px-2.5 py-0.5 rounded-full font-bold">Bảng Cấp giấy (dangky_records)</span>;
            case 'luutru_records':
                return <span className="bg-purple-100 text-purple-800 border border-purple-300 text-xs px-2.5 py-0.5 rounded-full font-bold">Bảng Lưu trữ (luutru_records)</span>;
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-100 p-4 gap-4 overflow-hidden animate-fade-in">
            {/* Header Toolbar */}
            <div className="bg-white rounded-xl p-4 shadow-xs border border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
                        <Database size={22} />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                            <span>Tra cứu & Kiểm tra Trực tiếp CSDL Supabase</span>
                            {results.length > 0 && (
                                <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-black">
                                    {filteredResults.length} kết quả
                                </span>
                            )}
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Truy vấn trực tiếp không qua bộ lọc hiển thị cục bộ trên cả 3 bảng: <strong>land_records, dangky_records, luutru_records</strong>
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap flex-1 max-w-2xl justify-end">
                    {/* Bảng filter */}
                    <div className="flex bg-slate-100 p-1 rounded-lg text-xs font-bold border border-slate-200">
                        <button
                            onClick={() => setTableFilter('ALL')}
                            className={`px-3 py-1.5 rounded-md transition-all ${tableFilter === 'ALL' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            Tất cả ({results.length})
                        </button>
                        <button
                            onClick={() => setTableFilter('land_records')}
                            className={`px-3 py-1.5 rounded-md transition-all ${tableFilter === 'land_records' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            Đo đạc ({results.filter(r => r.table === 'land_records').length})
                        </button>
                        <button
                            onClick={() => setTableFilter('dangky_records')}
                            className={`px-3 py-1.5 rounded-md transition-all ${tableFilter === 'dangky_records' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            Cấp giấy ({results.filter(r => r.table === 'dangky_records').length})
                        </button>
                        <button
                            onClick={() => setTableFilter('luutru_records')}
                            className={`px-3 py-1.5 rounded-md transition-all ${tableFilter === 'luutru_records' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            Lưu trữ ({results.filter(r => r.table === 'luutru_records').length})
                        </button>
                    </div>

                    {/* Search box & button */}
                    <div className="flex items-center gap-2 flex-1 min-w-[260px]">
                        <div className="relative flex-1">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Nhập Mã HS, Tên chủ, SĐT, Số tờ, Số thửa,..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 font-medium"
                            />
                        </div>
                        <button
                            onClick={() => handleSearch()}
                            disabled={isLoading || !searchTerm.trim()}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50 shrink-0 cursor-pointer"
                        >
                            {isLoading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                            <span>Tra cứu CSDL</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Notification message if any */}
            {actionMessage && (
                <div className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-semibold ${
                    actionMessage.type === 'success' 
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                        : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}>
                    {actionMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                    <span>{actionMessage.text}</span>
                </div>
            )}

            {/* Results container */}
            <div className="flex-1 overflow-auto bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                {isLoading ? (
                    <div className="py-24 text-center flex flex-col items-center justify-center text-slate-500">
                        <Loader2 className="text-blue-600 animate-spin mb-3" size={44} />
                        <h3 className="text-sm font-bold text-slate-700">Đang truy vấn trực tiếp cơ sở dữ liệu Supabase...</h3>
                        <p className="text-xs text-slate-400 mt-1">Đang tìm kiếm trên cả 3 bảng land_records, dangky_records, luutru_records</p>
                    </div>
                ) : !hasSearched ? (
                    <div className="py-24 text-center flex flex-col items-center justify-center text-slate-400">
                        <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl mb-3">
                            <Sparkles size={40} />
                        </div>
                        <h3 className="text-base font-bold text-slate-700">Sẵn sàng tra cứu dữ liệu CSDL</h3>
                        <p className="text-xs text-slate-500 mt-1 max-w-md">
                            Nhập <strong>Mã hồ sơ (hoặc số biên nhận)</strong>, <strong>Tên chủ sử dụng</strong>, <strong>Số điện thoại</strong> hoặc <strong>Số tờ / Số thửa</strong> để tra cứu trực tiếp toàn bộ dữ liệu gốc trong CSDL Cloud Supabase.
                        </p>
                    </div>
                ) : filteredResults.length === 0 ? (
                    <div className="py-24 text-center flex flex-col items-center justify-center text-slate-500">
                        <AlertTriangle className="text-amber-500 mb-3" size={44} />
                        <h3 className="text-base font-bold text-slate-700">Không tìm thấy hồ sơ nào</h3>
                        <p className="text-xs text-slate-400 mt-1 max-w-md">
                            Không có bản ghi nào khớp với từ khóa "{searchTerm}" trên toàn bộ cơ sở dữ liệu Supabase.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredResults.map((item, idx) => {
                            const isRepairing = repairingId === item.id;
                            const isExpanded = expandedRecordId === item.id;

                            return (
                                <div 
                                    key={`${item.table}-${item.id}`}
                                    className="border border-slate-200 rounded-xl overflow-hidden shadow-xs hover:border-slate-300 transition-all bg-white"
                                >
                                    {/* Card Header */}
                                    <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-black">
                                                {idx + 1}
                                            </span>
                                            <span className="font-mono font-bold text-sm text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                                Mã: {item.code}
                                            </span>
                                            {getTableBadge(item.table)}
                                            <span className="text-slate-400 text-xs font-mono">ID: {item.id}</span>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setExpandedRecordId(isExpanded ? null : item.id)}
                                                className="px-2.5 py-1 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg flex items-center gap-1 transition-all"
                                            >
                                                <Eye size={14} />
                                                <span>{isExpanded ? 'Thu gọn' : 'Xem JSON'}</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Card Body */}
                                    <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                                        {/* Cột 1: Thông tin chủ & Thửa đất */}
                                        <div className="space-y-2 border-r border-slate-100 pr-3">
                                            <div className="flex items-start gap-2">
                                                <User size={15} className="text-slate-400 shrink-0 mt-0.5" />
                                                <div>
                                                    <span className="text-slate-400">Chủ sử dụng:</span>
                                                    <div className="font-bold text-slate-800 text-sm">{item.customerName || '--'}</div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <Phone size={14} className="text-slate-400 shrink-0" />
                                                <span className="text-slate-400">Điện thoại:</span>
                                                <span className="font-bold text-slate-700">{item.phoneNumber || '--'}</span>
                                            </div>

                                            <div className="flex items-start gap-2">
                                                <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" />
                                                <div>
                                                    <span className="text-slate-400">Địa chỉ / Xã:</span>
                                                    <div className="font-medium text-slate-700">{item.ward || '--'} {item.rawRecord?.customerAddress ? `(${item.rawRecord.customerAddress})` : ''}</div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <Tag size={14} className="text-slate-400 shrink-0" />
                                                <span className="text-slate-400">Tờ / Thửa:</span>
                                                <span className="font-mono font-bold text-slate-800">
                                                    Tờ {item.mapSheet || '--'} / Thửa {item.landPlot || '--'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Cột 2: Loại thủ tục & Tiến độ */}
                                        <div className="space-y-2 border-r border-slate-100 pr-3">
                                            <div>
                                                <span className="text-slate-400">Loại thủ tục:</span>
                                                <div className="font-semibold text-slate-800 mt-0.5">{item.recordType || '--'}</div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <Clock size={14} className="text-slate-400 shrink-0" />
                                                <span className="text-slate-400">Ngày nhận:</span>
                                                <span className="font-medium text-slate-700">{item.receivedDate ? item.receivedDate.split('T')[0] : '--'}</span>
                                            </div>

                                            <div>
                                                <span className="text-slate-400">Cán bộ thụ lý:</span>
                                                <div className="font-semibold text-slate-700 mt-0.5">
                                                    {item.assignedTo || item.rawRecord?.drafterId || item.rawRecord?.surveyorId || 'Chưa phân công'}
                                                </div>
                                            </div>

                                            <div>
                                                <span className="text-slate-400">Ghi chú:</span>
                                                <div className="text-slate-600 italic truncate max-w-xs">{item.rawRecord?.notes || 'Không có ghi chú'}</div>
                                            </div>
                                        </div>

                                        {/* Cột 3: Trạng thái & Chẩn đoán */}
                                        <div className="space-y-3 bg-slate-50/60 p-3 rounded-xl border border-slate-200/80 flex flex-col justify-between">
                                            <div>
                                                <div className="text-slate-400 text-[11px] font-semibold mb-1">Trạng thái CSDL Supabase:</div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2.5 py-1 rounded-md text-xs font-bold shadow-2xs ${STATUS_COLORS[item.status as RecordStatus] || 'bg-gray-100 text-gray-800'}`}>
                                                        {STATUS_LABELS[item.status as RecordStatus] || item.status}
                                                    </span>
                                                </div>
                                            </div>

                                            {item.isHandedOver && (
                                                <div className="p-2 bg-amber-50 text-amber-800 rounded-lg border border-amber-200 text-[11px] font-medium flex items-center gap-1.5">
                                                    <AlertTriangle size={13} className="shrink-0 text-amber-600" />
                                                    <span>Hồ sơ đã xuất bàn giao 1 cửa (Đợt {item.exportBatch || '1'})</span>
                                                </div>
                                            )}

                                            {/* Công cụ sửa trạng thái nhanh */}
                                            <div className="pt-2 border-t border-slate-200">
                                                <div className="text-[11px] font-bold text-slate-600 mb-1.5 flex items-center gap-1">
                                                    <Wrench size={13} /> Khôi phục / Sửa trạng thái nhanh:
                                                </div>
                                                <div className="flex flex-wrap gap-1.5">
                                                    <button
                                                        onClick={() => handleRepairStatus(item, RecordStatus.IN_PROGRESS, 'Đang thực hiện')}
                                                        disabled={isRepairing}
                                                        className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-[10px] font-bold transition-all disabled:opacity-50 cursor-pointer"
                                                        title="Chuyển về Đang thực hiện để hiển thị trong danh sách tác vụ"
                                                    >
                                                        Đang làm
                                                    </button>
                                                    <button
                                                        onClick={() => handleRepairStatus(item, RecordStatus.SIGNED, 'Đã ký duyệt')}
                                                        disabled={isRepairing}
                                                        className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold transition-all disabled:opacity-50 cursor-pointer"
                                                        title="Chuyển sang Đã ký duyệt"
                                                    >
                                                        Đã ký
                                                    </button>
                                                    <button
                                                        onClick={() => handleRepairStatus(item, RecordStatus.HANDOVER, 'Đã giao 1 cửa')}
                                                        disabled={isRepairing}
                                                        className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-bold transition-all disabled:opacity-50 cursor-pointer"
                                                        title="Chuyển sang Đã giao 1 cửa"
                                                    >
                                                        Bàn giao
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Collapsible raw data preview */}
                                    {isExpanded && (
                                        <div className="border-t border-slate-200 bg-slate-900 text-slate-200 p-3 text-[11px] font-mono overflow-x-auto">
                                            <div className="text-slate-400 font-bold mb-1 flex items-center justify-between">
                                                <span>Dữ liệu thô Supabase ({item.table}):</span>
                                                <span className="text-[10px] text-blue-400 font-mono">ID: {item.id}</span>
                                            </div>
                                            <pre className="whitespace-pre-wrap max-h-56 overflow-y-auto">
                                                {JSON.stringify(item.rawRecord, null, 2)}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DatabaseInspectorTab;
