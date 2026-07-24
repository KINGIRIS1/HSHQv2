import React, { useState } from 'react';
import { ArchiveRecord } from '../../services/apiArchive';
import { X, MapPin, FileText, User as UserIcon, CheckCircle2, Circle, Send, FileSignature, CheckSquare, CalendarClock, Trash2, Pencil, Printer, StickyNote, Info } from 'lucide-react';
import { STATUS_LABELS, STATUS_COLORS } from '../../constants';
import { RecordStatus } from '../../types';
import StatusBadge from '../StatusBadge';

interface ArchiveDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    record: ArchiveRecord | null;
    getEmployeeName: (id: string) => string;
}

const ArchiveDetailModal: React.FC<ArchiveDetailModalProps> = ({ isOpen, onClose, record, getEmployeeName }) => {
    if (!isOpen || !record) return null;

    const history = record.data?.history || [];

    // Helper to map Archive status to RecordStatus enum for labels/colors
    const mapStatus = (s: string): RecordStatus => {
        switch(s) {
            case 'draft': return RecordStatus.RECEIVED;
            case 'assigned': return RecordStatus.ASSIGNED;
            case 'executed': return RecordStatus.COMPLETED_WORK;
            case 'pending_sign': return RecordStatus.PENDING_SIGN;
            case 'signed': return RecordStatus.SIGNED;
            case 'completed': return RecordStatus.RETURNED;
            default: return RecordStatus.RECEIVED;
        }
    };

    const currentStatus = mapStatus(record.status);

    const formatDate = (dateStr?: string | null) => {
        if (!dateStr) return '---';
        const date = new Date(dateStr);
        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const y = date.getFullYear();
        return `${d}/${m}/${y}`;
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-gray-50 rounded-xl shadow-2xl w-full max-w-7xl max-h-[95vh] overflow-hidden flex flex-col animate-fade-in-up">
                {/* HEADER */}
                <div className="bg-white px-6 py-4 border-b border-gray-200 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-4">
                        <span className="bg-blue-100 text-blue-700 font-bold px-3 py-1 rounded text-sm border border-blue-200">
                            {record.so_hieu}
                        </span>
                        <h2 className="text-lg font-bold text-gray-800 uppercase">
                            {record.type === 'saoluc' ? 'SAO LỤC, TRÍCH LỤC' : 'CÔNG VĂN'}
                        </h2>
                        <StatusBadge status={currentStatus} />
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <div className="w-px h-6 bg-gray-300 mx-2"></div>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* BODY */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        
                        {/* COLUMN 1: THÔNG TIN CHUNG */}
                        <div className="space-y-6">
                            {/* KHÁCH HÀNG */}
                            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                                <h3 className="text-xs font-bold text-blue-600 uppercase mb-4 flex items-center gap-2 border-l-4 border-blue-600 pl-2">
                                    <UserIcon size={16}/> Thông tin tổ chức/cá nhân
                                </h3>
                                <div className="grid grid-cols-1 gap-4">
                                    <div>
                                        <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Nơi nhận / Gửi (Chủ sử dụng)</label>
                                        <p className="text-base font-bold text-gray-800">{record.noi_nhan_gui}</p>
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Thời gian ghi nhận</label>
                                        <p className="text-base font-bold text-gray-800">{formatDate(record.ngay_thang)}</p>
                                    </div>
                                </div>
                            </div>

                            {/* ĐỊA CHÍNH (NẾU LÀ SAO LỤC) */}
                            {record.type === 'saoluc' && (
                                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                                    <h3 className="text-xs font-bold text-green-600 uppercase mb-4 flex items-center gap-2 border-l-4 border-green-600 pl-2">
                                        <MapPin size={16}/> Thông tin địa chính
                                    </h3>
                                    <div className="grid grid-cols-3 gap-4 mb-4">
                                        <div>
                                            <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Xã/Phường</label>
                                            <p className="font-bold text-gray-800 text-sm">{record.data?.xa_phuong || '-'}</p>
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Tờ bản đồ</label>
                                            <p className="font-bold text-gray-800 bg-gray-50 px-2 py-1 rounded border border-gray-200 text-center">{record.data?.to_ban_do || '-'}</p>
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Thửa đất</label>
                                            <p className="font-bold text-gray-800 bg-gray-50 px-2 py-1 rounded border border-gray-200 text-center">{record.data?.thua_dat || '-'}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* NGƯỜI XỬ LÝ */}
                            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                                <label className="text-[10px] text-gray-400 uppercase font-bold block mb-2">Người xử lý hồ sơ</label>
                                <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg border border-gray-100">
                                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                                        <UserIcon size={16}/>
                                    </div>
                                    <span className="font-bold text-sm text-gray-700">
                                        {record.data?.assigned_to ? getEmployeeName(record.data.assigned_to) : 'Chưa giao'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* COLUMN 2: CHI TIẾT */}
                        <div className="space-y-6">
                            {/* NỘI DUNG */}
                            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm h-full flex flex-col">
                                <h3 className="text-xs font-bold text-purple-600 uppercase mb-4 flex items-center gap-2 border-l-4 border-purple-600 pl-2">
                                    <FileText size={16}/> Nội dung chi tiết
                                </h3>
                                
                                <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 text-gray-800 text-sm font-medium mb-6 min-h-[80px]">
                                    {record.trich_yeu || 'Không có nội dung chi tiết.'}
                                </div>
                            </div>
                        </div>

                        {/* COLUMN 3: TIẾN ĐỘ & NHẮC VIỆC */}
                        <div className="space-y-6">
                            {/* TIMELINE */}
                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                <div className="bg-indigo-600 px-5 py-3 flex items-center gap-2">
                                    <CalendarClock size={16} className="text-white"/>
                                    <span className="text-xs font-bold text-white uppercase">Tiến độ xử lý</span>
                                </div>
                                
                                <div className="p-6 text-center border-b border-gray-100">
                                     <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Hạn trả kết quả</label>
                                     <p className="text-2xl font-black text-gray-800">{formatDate(record.data?.hen_tra || record.ngay_thang)}</p>
                                </div>

                                <div className="p-6 space-y-6 relative">
                                    {/* Line */}
                                    <div className="absolute left-[34px] top-6 bottom-6 w-0.5 bg-gray-100 -z-10"></div>

                                    {history.length > 0 ? history.map((h: any, idx: number) => (
                                        <div key={idx} className="flex gap-4 relative">
                                            <div className="flex flex-col items-center">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 z-10 ${idx === history.length - 1 ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-300 text-gray-400'}`}>
                                                    <CheckCircle2 size={16} />
                                                </div>
                                            </div>
                                            <div className="pb-2">
                                                <p className={`text-xs font-bold uppercase mb-0.5 ${idx === history.length - 1 ? 'text-blue-700' : 'text-gray-500'}`}>
                                                    {h.status ? STATUS_LABELS[mapStatus(h.status)] : h.action}
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-sm font-medium ${idx === history.length - 1 ? 'text-gray-800' : 'text-gray-500'}`}>
                                                        {new Date(h.timestamp).toLocaleString('vi-VN')}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-indigo-600 mt-1 italic">Bởi: {h.user || 'Hệ thống'}</p>
                                                {h.note && (
                                                    <div className="text-xs text-gray-500 italic mt-1 bg-gray-50 p-2 rounded">
                                                        "{h.note}"
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="text-sm text-gray-400 italic text-center">Chưa có lịch sử ghi nhận.</div>
                                    )}
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default ArchiveDetailModal;
