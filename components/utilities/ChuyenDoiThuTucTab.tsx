import React, { useState, useEffect } from 'react';
import { RefreshCw, Play, CheckCircle2, AlertTriangle, FileText, ListFilter, Plus, Trash2, HelpCircle } from 'lucide-react';
import { fetchRecords, updateRecordsBatchById } from '../../services/api';
import { RecordFile, NotifyFunction } from '../../types';

interface Props {
    notify: NotifyFunction;
}

interface ProcedureMapping {
    oldType: string;
    newType: string;
    alias: string[]; // Variations for flexible match
    isCustom?: boolean; // Custom mappings added by user
}

export const INITIAL_PROCEDURE_MAPPINGS: ProcedureMapping[] = [
    {
        oldType: 'Trích lục',
        newType: '2.1 Trích lục',
        alias: ['trích lục', 'trich luc', 'trích lục bản đồ địa chính']
    },
    {
        oldType: 'Trích lục quy hoạch',
        newType: '2.2 Trích lục Quy hoạch',
        alias: ['trích lục quy hoạch', 'trich luc quy hoach']
    },
    {
        oldType: 'Trích đo',
        newType: '2.3 Trích đo',
        alias: ['trích đo', 'trich do', 'trích đo bản đồ địa chính']
    },
    {
        oldType: 'Cắm mốc',
        newType: '2.4 Trích đo Cắm mốc',
        alias: ['cắm mốc', 'cam moc']
    },
    {
        oldType: 'Tách thửa',
        newType: '2.5 Trích đo Tách - Hợp thửa',
        alias: ['tách thửa', 'tach thua', 'hồ sơ tách thửa', 'tách - hợp thửa']
    },
    {
        oldType: 'Cung cấp tài liệu đất đai',
        newType: '1.1 Cung cấp dữ liệu đất đai',
        alias: ['cung cấp tài liệu đất đai', 'cung cap tai lieu dat dai', 'cung cấp tài liệu dất đai']
    },
    {
        oldType: 'Cung cấp số thửa đất',
        newType: '2.6 Cung cấp số thửa',
        alias: ['cung cấp số thửa', 'cung cấp số thửa đất', 'cung cap so thua']
    }
];

const ChuyenDoiThuTucTab: React.FC<Props> = ({ notify }) => {
    const [records, setRecords] = useState<RecordFile[]>([]);
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState<Record<string, number>>({});
    const [converting, setConverting] = useState(false);
    const [log, setLog] = useState<string[]>([]);

    // Custom mappings state merged with initial ones
    const [mappings, setMappings] = useState<ProcedureMapping[]>(() => {
        try {
            const saved = localStorage.getItem('custom_procedure_mappings');
            const custom = saved ? JSON.parse(saved) : [];
            return [...INITIAL_PROCEDURE_MAPPINGS, ...custom.map((m: any) => ({ ...m, isCustom: true }))];
        } catch {
            return INITIAL_PROCEDURE_MAPPINGS;
        }
    });

    // Form inputs for adding a mapping
    const [newOldType, setNewOldType] = useState('');
    const [newNewType, setNewNewType] = useState('');
    const [newAliasStr, setNewAliasStr] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);

    useEffect(() => {
        loadRecords();
    }, [mappings]);

    const loadRecords = async () => {
        setLoading(true);
        setLog(prev => [...prev, 'Đang quét toàn bộ hồ sơ trong cơ sở dữ liệu...']);
        try {
            const allRecords = await fetchRecords();
            setRecords(allRecords);
            
            // Calculate statistics
            const counts: Record<string, number> = {};
            mappings.forEach(m => {
                counts[m.oldType] = 0;
            });

            allRecords.forEach(r => {
                const type = r.recordType || '';
                // Match with aliases
                const matched = mappings.find(m => 
                    m.oldType.toLowerCase() === type.toLowerCase() ||
                    m.alias.some(al => al.toLowerCase() === type.toLowerCase())
                );
                if (matched) {
                    counts[matched.oldType] = (counts[matched.oldType] || 0) + 1;
                }
            });

            setStats(counts);
            setLog(prev => [...prev, `Quét hoàn tất! Tìm thấy tổng cộng ${allRecords.length} hồ sơ.`]);
        } catch (error) {
            console.error(error);
            notify('Lỗi khi tải dữ liệu hồ sơ', 'error');
            setLog(prev => [...prev, 'Lỗi: Không thể tải dữ liệu hồ sơ.']);
        } finally {
            setLoading(false);
        }
    };

    const handleAddMapping = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newOldType.trim() || !newNewType.trim()) {
            notify('Vui lòng nhập đầy đủ tên thủ tục cũ và mới!', 'error');
            return;
        }

        // Check duplicate
        if (mappings.some(m => m.oldType.toLowerCase() === newOldType.trim().toLowerCase())) {
            notify('Thủ tục cũ này đã tồn tại trong danh sách chuyển đổi!', 'error');
            return;
        }

        const aliasList = newAliasStr
            .split(',')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        // Include original values as aliases
        if (!aliasList.some(a => a.toLowerCase() === newOldType.trim().toLowerCase())) {
            aliasList.push(newOldType.trim().toLowerCase());
        }

        const newMapping: ProcedureMapping = {
            oldType: newOldType.trim(),
            newType: newNewType.trim(),
            alias: aliasList,
            isCustom: true
        };

        const currentCustom = mappings.filter(m => m.isCustom);
        const updatedCustom = [...currentCustom, newMapping];

        localStorage.setItem('custom_procedure_mappings', JSON.stringify(updatedCustom));
        setMappings([...INITIAL_PROCEDURE_MAPPINGS, ...updatedCustom]);
        
        // Reset inputs
        setNewOldType('');
        setNewNewType('');
        setNewAliasStr('');
        setShowAddForm(false);
        notify('Đã thêm quy tắc chuyển đổi mới!', 'success');
        setLog(prev => [...prev, `Đã thêm quy tắc chuyển đổi: "${newMapping.oldType}" ➔ "${newMapping.newType}"`]);
    };

    const handleDeleteMapping = (oldType: string) => {
        if (!confirm(`Bạn có chắc chắn muốn xóa quy tắc chuyển đổi của "${oldType}"?`)) {
            return;
        }

        const currentCustom = mappings.filter(m => m.isCustom && m.oldType !== oldType);
        localStorage.setItem('custom_procedure_mappings', JSON.stringify(currentCustom));
        setMappings([...INITIAL_PROCEDURE_MAPPINGS, ...currentCustom]);

        notify('Đã xóa quy tắc chuyển đổi!', 'success');
        setLog(prev => [...prev, `Đã xóa quy tắc chuyển đổi cho: "${oldType}"`]);
    };

    const handleConvert = async () => {
        const totalToConvert = Object.values(stats).reduce((a, b) => a + b, 0);
        if (totalToConvert === 0) {
            notify('Không có hồ sơ nào cần chuyển đổi!', 'info');
            return;
        }

        if (!confirm(`Bạn có chắc chắn muốn chuyển đổi ${totalToConvert} hồ sơ sang tên thủ tục mới? Hành động này sẽ cập nhật trực tiếp cơ sở dữ liệu.`)) {
            return;
        }

        setConverting(true);
        setLog(prev => [...prev, 'Bắt đầu quá trình chuyển đổi hàng loạt...']);

        try {
            const updates: Partial<RecordFile>[] = [];
            records.forEach(r => {
                const type = r.recordType || '';
                const matched = mappings.find(m => 
                    m.oldType.toLowerCase() === type.toLowerCase() ||
                    m.alias.some(al => al.toLowerCase() === type.toLowerCase())
                );
                if (matched && type !== matched.newType) {
                    updates.push({
                        id: r.id,
                        recordType: matched.newType
                    });
                }
            });

            if (updates.length === 0) {
                setLog(prev => [...prev, 'Không có thay đổi thực tế cần thực hiện.']);
                notify('Hồ sơ đã khớp định dạng mới!', 'success');
                return;
            }

            setLog(prev => [...prev, `Tìm thấy ${updates.length} hồ sơ cần cập nhật. Đang lưu lên cơ sở dữ liệu...`]);
            const result = await updateRecordsBatchById(updates);

            if (result.success) {
                setLog(prev => [...prev, `Chuyển đổi thành công ${result.count} hồ sơ!`]);
                notify(`Đã cập nhật ${result.count} hồ sơ thành công!`, 'success');
                // Refresh statistics
                await loadRecords();
            } else {
                setLog(prev => [...prev, 'Lỗi: Cập nhật cơ sở dữ liệu thất bại.']);
                notify('Lỗi khi cập nhật cơ sở dữ liệu', 'error');
            }
        } catch (error) {
            console.error(error);
            setLog(prev => [...prev, `Lỗi nghiêm trọng: ${(error as Error).message}`]);
            notify('Đã xảy ra lỗi trong quá trình chuyển đổi', 'error');
        } finally {
            setConverting(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 p-6 overflow-y-auto">
            <div className="max-w-4xl mx-auto w-full bg-white rounded-xl shadow-md border border-slate-200 p-6">
                
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            <RefreshCw className="text-teal-600 animate-spin-slow" size={24} />
                            Công cụ Chuyển đổi Thủ tục tiếp nhận
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">
                            Hỗ trợ đồng bộ hóa các tên thủ tục cũ trong cơ sở dữ liệu sang định dạng mã hóa mới.
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowAddForm(!showAddForm)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors shadow-sm"
                        >
                            <Plus size={14} />
                            Thêm thủ tục mới phát sinh
                        </button>
                        <button 
                            onClick={loadRecords}
                            disabled={loading || converting}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200 disabled:opacity-50"
                        >
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                            Làm mới
                        </button>
                    </div>
                </div>

                {/* Info Alert */}
                <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg mb-6 flex gap-3">
                    <AlertTriangle className="text-amber-600 shrink-0" size={20} />
                    <div className="text-xs text-amber-800 leading-relaxed">
                        <strong className="block mb-1 text-amber-900">⚠️ Chú ý giải trình phương án:</strong>
                        Đây là công cụ chuyển đổi nhanh các hồ sơ hiện tại trên DB để đồng bộ với bộ tên thủ tục mới. 
                        Sau khi bạn duyệt phương án này, hệ thống sẽ cập nhật toàn diện cấu hình trong mã nguồn 
                        (<code className="bg-amber-100 px-1 rounded font-mono">constants.ts</code>, biểu mẫu tiếp nhận, các báo cáo...) 
                        để tất cả hồ sơ mới được tiếp nhận từ nay về sau sẽ tự động áp dụng tên thủ tục chuẩn hóa này.
                    </div>
                </div>

                {/* Add Custom Mapping Form */}
                {showAddForm && (
                    <form onSubmit={handleAddMapping} className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-6 animate-fade-in-up">
                        <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-1.5">
                            <Plus size={16} className="text-teal-600" />
                            Đăng ký Quy tắc Chuyển đổi phát sinh mới
                        </h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">
                                    Tên thủ tục cũ cần đổi <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ví dụ: Đất tranh chấp, Trích lục cũ"
                                    value={newOldType}
                                    onChange={e => setNewOldType(e.target.value)}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">
                                    Tên thủ tục mới chuẩn hóa <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ví dụ: 2.7 Trích đo Đất tranh chấp"
                                    value={newNewType}
                                    onChange={e => setNewNewType(e.target.value)}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                                />
                            </div>
                        </div>

                        <div className="mb-4">
                            <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
                                Từ khóa / Biến thể nhận diện khác (Alias)
                                <span title="Nếu hồ sơ có thể mang tên viết tắt khác, hãy nhập chúng cách nhau bởi dấu phẩy">
                                    <HelpCircle size={12} className="text-slate-400 cursor-help" />
                                </span>
                            </label>
                            <input
                                type="text"
                                placeholder="Ví dụ: dat tranh chap, tranh chap dat, TC (ngăn cách bằng dấu phẩy)"
                                value={newAliasStr}
                                onChange={e => setNewAliasStr(e.target.value)}
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                            />
                        </div>

                        <div className="flex justify-end gap-2.5">
                            <button
                                type="button"
                                onClick={() => setShowAddForm(false)}
                                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg"
                            >
                                Hủy bỏ
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm flex items-center gap-1"
                            >
                                <Plus size={14} />
                                Lưu Quy tắc
                            </button>
                        </div>
                    </form>
                )}

                {/* Mapping Table */}
                <div className="border border-slate-200 rounded-lg overflow-hidden mb-6 bg-white shadow-sm">
                    <table className="w-full text-left text-sm border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                                <th className="p-3 w-12 text-center">STT</th>
                                <th className="p-3">Thủ tục cũ</th>
                                <th className="p-3 text-center">Số hồ sơ hiện có</th>
                                <th className="p-3 w-12 text-center"></th>
                                <th className="p-3 text-teal-900 font-extrabold bg-teal-50/50">Thủ tục mới chuẩn hóa</th>
                                <th className="p-3 w-14 text-center">Xóa</th>
                            </tr>
                        </thead>
                        <tbody>
                            {mappings.map((m, idx) => {
                                const count = stats[m.oldType] || 0;
                                return (
                                    <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                        <td className="p-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                                        <td className="p-3">
                                            <div className="font-semibold text-slate-700">{m.oldType}</div>
                                            {m.alias.length > 1 && (
                                                <div className="text-[10px] text-slate-400 mt-0.5">
                                                    Từ khóa ghép: {m.alias.filter(a => a.toLowerCase() !== m.oldType.toLowerCase()).join(', ')}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-3 text-center">
                                            {loading ? (
                                                <span className="text-slate-400 animate-pulse">...</span>
                                            ) : (
                                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${count > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'}`}>
                                                    {count} hồ sơ
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-3 text-center text-slate-400">➔</td>
                                        <td className="p-3 bg-teal-50/30">
                                            <div className="font-bold text-teal-700">{m.newType}</div>
                                            {m.isCustom && (
                                                <span className="text-[9px] bg-indigo-100 text-indigo-800 px-1 py-0.2 rounded font-semibold">Tự định nghĩa</span>
                                            )}
                                        </td>
                                        <td className="p-3 text-center">
                                            {m.isCustom ? (
                                                <button
                                                    onClick={() => handleDeleteMapping(m.oldType)}
                                                    className="p-1 text-rose-500 hover:text-rose-700 rounded transition-colors"
                                                    title="Xóa quy tắc này"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            ) : (
                                                <span className="text-slate-300 text-xs">-</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Operations */}
                <div className="flex gap-4 items-center justify-between border-t border-slate-100 pt-6">
                    <div className="text-xs text-slate-500 flex items-center gap-1.5">
                        <ListFilter size={14} />
                        Tổng số hồ sơ phát hiện cần chuyển đổi:{' '}
                        <strong className="text-slate-700">
                            {Object.values(stats).reduce((a, b) => a + b, 0)} hồ sơ
                        </strong>
                    </div>

                    <button
                        onClick={handleConvert}
                        disabled={loading || converting || Object.values(stats).reduce((a, b) => a + b, 0) === 0}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 shadow-md shadow-teal-100 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                    >
                        {converting ? (
                            <>
                                <RefreshCw className="animate-spin" size={18} />
                                Đang chuyển đổi...
                            </>
                        ) : (
                            <>
                                <Play size={18} />
                                Thực hiện chuyển đổi ngay
                            </>
                        )}
                    </button>
                </div>

                {/* Real-time Logs */}
                <div className="mt-6 border border-slate-200 rounded-lg p-4 bg-slate-900 text-slate-300 font-mono text-xs h-40 overflow-y-auto shadow-inner">
                    <div className="text-slate-400 border-b border-slate-800 pb-1 mb-2 flex justify-between items-center">
                        <span>NHẬT KÝ HỆ THỐNG (LOGS)</span>
                        <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-teal-400">CONSOLE</span>
                    </div>
                    {log.map((line, lIdx) => (
                        <div key={lIdx} className="mb-1 leading-relaxed">
                            <span className="text-slate-500 mr-1.5">[{new Date().toLocaleTimeString()}]</span>
                            {line.startsWith('Lỗi') ? (
                                <span className="text-red-400 font-bold">{line}</span>
                            ) : line.includes('thành công') || line.includes('Đã thêm') ? (
                                <span className="text-emerald-400 font-bold">{line}</span>
                            ) : (
                                <span>{line}</span>
                            )}
                        </div>
                    ))}
                    {log.length === 0 && <span className="text-slate-600">Không có hoạt động nào...</span>}
                </div>

            </div>
        </div>
    );
};

export default ChuyenDoiThuTucTab;
