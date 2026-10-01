import React, { useState, useEffect, useRef } from 'react';
import { 
    Download, 
    Upload, 
    RefreshCw, 
    Trash2, 
    FolderOpen, 
    Clock, 
    CheckCircle2, 
    AlertTriangle, 
    ShieldCheck, 
    HardDrive, 
    Database, 
    Lightbulb, 
    Check, 
    Loader2, 
    X, 
    FileJson
} from 'lucide-react';
import { 
    createFullBackupData, 
    downloadSystemJsonBackup, 
    getStoredRestorePoints, 
    saveLocalRestorePoint, 
    deleteStoredRestorePoint, 
    LocalRestorePoint, 
    FullBackupData, 
    restoreFullBackupToSupabase,
    restoreSystemJsonBackupAsync
} from '../../services/backupService';
import { getSystemSetting, saveSystemSetting } from '../../services/api';
import { confirmAction } from '../../utils/appHelpers';

interface BackupRestoreTabProps {
    onRecordsUpdated?: () => void;
    records?: any[];
}

export const BackupRestoreTab: React.FC<BackupRestoreTabProps> = ({ onRecordsUpdated, records = [] }) => {
    // Local States
    const [isAutoBackup, setIsAutoBackup] = useState<boolean>(true);
    const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'custom' | 'off'>('daily');
    const [customDays, setCustomDays] = useState<number>(3);
    const [saveMode, setSaveMode] = useState<'new' | 'overwrite'>('new');
    const [backupDir, setBackupDir] = useState<string>('');
    const [isCreatingBackup, setIsCreatingBackup] = useState<boolean>(false);
    const [restorePoints, setRestorePoints] = useState<LocalRestorePoint[]>([]);
    const [isLoadingPoints, setIsLoadingPoints] = useState<boolean>(true);

    // Selective Restore Modal State
    const [selectedBackupData, setSelectedBackupData] = useState<FullBackupData | null>(null);
    const [showSelectiveModal, setShowSelectiveModal] = useState<boolean>(false);
    const [isRestoring, setIsRestoring] = useState<boolean>(false);
    const [restoreProgressMsg, setRestoreProgressMsg] = useState<string>('');
    const [selectedModules, setSelectedModules] = useState<{ [key: string]: boolean }>({
        records: true,
        contracts: true,
        archive: true,
        nganChan: true,
        vphc: true,
        bienban: true,
        chinhly: true,
        tachthua: true,
        users: true,
        schedules: true
    });

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Load initial settings and restore points
    useEffect(() => {
        const loadSettings = async () => {
            setIsLoadingPoints(true);
            try {
                const auto = await getSystemSetting('auto_backup_enabled');
                if (auto !== null) setIsAutoBackup(auto === 'true');

                const freq = await getSystemSetting('auto_backup_frequency');
                if (freq) setFrequency(freq as any);

                const mode = await getSystemSetting('auto_backup_mode');
                if (mode) setSaveMode(mode as any);

                const dir = await getSystemSetting('backup_directory');
                if (dir) setBackupDir(dir);

                const points = await getStoredRestorePoints();
                setRestorePoints(points);

                // Nếu chưa có điểm lưu nào, tự động tạo 1 điểm đầu tiên nếu có dữ liệu
                if (points.length === 0) {
                    const initialBackup = await createFullBackupData().catch(() => null);
                    if (initialBackup) {
                        const newPts = await saveLocalRestorePoint(initialBackup, true, 'new', 5);
                        setRestorePoints(newPts);
                    }
                }
            } catch (e) {
                console.error("Lỗi khởi tạo tab Sao lưu & Khôi phục:", e);
            } finally {
                setIsLoadingPoints(false);
            }
        };
        loadSettings();
    }, []);

    // Toggle Auto Backup
    const handleToggleAutoBackup = async (val: boolean) => {
        setIsAutoBackup(val);
        await saveSystemSetting('auto_backup_enabled', String(val)).catch(() => {});
    };

    // Frequency Change
    const handleFrequencyChange = async (val: 'daily' | 'weekly' | 'custom' | 'off') => {
        setFrequency(val);
        await saveSystemSetting('auto_backup_frequency', val).catch(() => {});
        if (val === 'off') {
            handleToggleAutoBackup(false);
        } else {
            handleToggleAutoBackup(true);
        }
    };

    // Save Mode Change
    const handleSaveModeChange = async (val: 'new' | 'overwrite') => {
        setSaveMode(val);
        await saveSystemSetting('auto_backup_mode', val).catch(() => {});
    };

    // Select Directory
    const handleSelectDirectory = async () => {
        try {
            if ('showDirectoryPicker' in window) {
                const handle = await (window as any).showDirectoryPicker();
                if (handle && handle.name) {
                    const path = `C:\\Backup\\${handle.name}`;
                    setBackupDir(path);
                    await saveSystemSetting('backup_directory', path);
                }
            } else {
                const customPath = prompt("Nhập đường dẫn thư mục lưu bản sao lưu trên máy tính:", backupDir || "C:\\Backup_System");
                if (customPath) {
                    setBackupDir(customPath.trim());
                    await saveSystemSetting('backup_directory', customPath.trim());
                }
            }
        } catch (e) {
            console.log("Hủy chọn thư mục");
        }
    };

    // Trigger Instant Backup
    const handleCreateBackupNow = async () => {
        setIsCreatingBackup(true);
        try {
            const backup = await createFullBackupData();
            const updated = await saveLocalRestorePoint(backup, false, saveMode, 5);
            setRestorePoints(updated);
            alert("Đã tạo điểm sao lưu thành công!");
        } catch (e) {
            console.error("Lỗi tạo sao lưu:", e);
            alert("Có lỗi khi tạo bản sao lưu.");
        } finally {
            setIsCreatingBackup(false);
        }
    };

    // Download JSON file
    const handleDownloadJsonFile = async () => {
        setIsCreatingBackup(true);
        try {
            await downloadSystemJsonBackup();
        } catch (e) {
            alert("Có lỗi khi xuất tệp sao lưu JSON.");
        } finally {
            setIsCreatingBackup(false);
        }
    };

    // Handle JSON File Upload for Restore
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const content = evt.target?.result as string;
                const parsed = JSON.parse(content) as FullBackupData;
                if (!parsed || (!parsed.data && !(parsed as any).records)) {
                    alert("Tệp JSON không đúng định dạng sao lưu của hệ thống!");
                    return;
                }
                setSelectedBackupData(parsed);
                setShowSelectiveModal(true);
            } catch (err) {
                alert("Tệp JSON bị lỗi hoặc không đọc được!");
            }
        };
        reader.readAsText(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Trigger Restore from Point item
    const handleRestorePoint = (point: LocalRestorePoint) => {
        if (!point.fullData) {
            alert("Dữ liệu của điểm khôi phục này không còn trong bộ nhớ!");
            return;
        }
        setSelectedBackupData(point.fullData);
        setShowSelectiveModal(true);
    };

    // Delete Point item
    const handleDeletePoint = async (id: string) => {
        if (await confirmAction("Bạn có chắc chắn muốn xóa điểm khôi phục này khỏi lịch sử không?")) {
            const updated = await deleteStoredRestorePoint(id);
            setRestorePoints(updated);
        }
    };

    // Execute Selected Restore
    const handleExecuteRestore = async () => {
        if (!selectedBackupData) return;
        setIsRestoring(true);
        setRestoreProgressMsg('Đang khởi tạo quá trình khôi phục...');

        try {
            const isFull = Object.values(selectedModules).every(v => v);
            if (isFull) {
                const success = await restoreFullBackupToSupabase(selectedBackupData);
                if (success) {
                    alert("Khôi phục toàn bộ dữ liệu thành công!");
                    if (onRecordsUpdated) onRecordsUpdated();
                } else {
                    // Fallback restore missing
                    const res = await restoreSystemJsonBackupAsync(selectedBackupData, records, (_, __, status) => {
                        setRestoreProgressMsg(status);
                    });
                    alert(res.message);
                    if (onRecordsUpdated) onRecordsUpdated();
                }
            } else {
                // Selective restore
                const res = await restoreSystemJsonBackupAsync(selectedBackupData, records, (_, __, status) => {
                    setRestoreProgressMsg(status);
                });
                alert(res.message);
                if (onRecordsUpdated) onRecordsUpdated();
            }
            setShowSelectiveModal(false);
            setSelectedBackupData(null);
        } catch (e: any) {
            console.error("Lỗi khôi phục:", e);
            alert(`Lỗi khi khôi phục dữ liệu: ${e?.message || 'Thao tác thất bại'}`);
        } finally {
            setIsRestoring(false);
            setRestoreProgressMsg('');
        }
    };

    const lastPoint = restorePoints[0];
    const lastBackupTimeFormatted = lastPoint 
        ? new Date(lastPoint.timestamp).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
        : 'Chưa có bản lưu';

    return (
        <div className="space-y-6 max-w-6xl mx-auto pb-10 animate-fade-in">
            {/* 1. HEADER BANNER */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl shadow-xl p-6 text-white border border-indigo-900/50 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative overflow-hidden">
                <div className="space-y-2 z-10 max-w-2xl">
                    <span className="bg-blue-500/20 text-blue-300 border border-blue-400/30 font-bold px-3 py-1 rounded-full text-[11px] tracking-wider uppercase inline-flex items-center gap-1.5">
                        <ShieldCheck size={14} className="text-blue-400" />
                        An Toàn Dữ Liệu Tuyệt Đối
                    </span>
                    <h2 className="font-extrabold text-2xl md:text-3xl text-white tracking-tight">
                        Công cụ Sao lưu & Khôi phục Dữ liệu
                    </h2>
                    <p className="text-slate-300 text-xs md:text-sm leading-relaxed font-medium">
                        Tải bản sao lưu định kỳ dạng file JSON hoặc tự động lưu các điểm khôi phục nhanh (Restore Points) để bảo vệ toàn bộ dữ liệu Hồ sơ, Hợp đồng và Cấu hình hệ thống.
                    </p>
                </div>
                <div className="z-10 shrink-0 w-full lg:w-auto">
                    <button 
                        onClick={handleDownloadJsonFile}
                        disabled={isCreatingBackup}
                        className="w-full lg:w-auto bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold px-6 py-3.5 rounded-xl shadow-lg flex items-center justify-center gap-2.5 transition-all active:scale-95 cursor-pointer text-sm disabled:opacity-50"
                    >
                        {isCreatingBackup ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                        <span>CHỌN THƯ MỤC & XUẤT SAO LƯU (.JSON)</span>
                    </button>
                </div>
                {/* Background Glow */}
                <div className="absolute -right-10 -bottom-10 w-60 h-60 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
            </div>

            {/* 2. GRID 2 COLUMNS: CẤU HÌNH TỰ ĐỘNG & KHÔI PHỤC TỪ FILE */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* KHỐI TRÁI: CẤU HÌNH SAO LƯU TỰ ĐỘNG */}
                <div className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-slate-200/80 flex flex-col justify-between space-y-5">
                    <div className="space-y-5">
                        {/* Title */}
                        <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                                <Clock size={20} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 text-base">Cấu hình Sao lưu Tự động</h3>
                                <p className="text-xs text-slate-500 font-medium">Tự động chụp bản sao CSDL khi khởi động hệ thống</p>
                            </div>
                        </div>

                        {/* Toggle Switch */}
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                            <div>
                                <label className="font-bold text-slate-800 text-sm block">Kích hoạt Sao lưu Tự động</label>
                                <span className="text-xs text-slate-500 font-medium">Tự động sao lưu ở nền khi Admin đăng nhập</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleToggleAutoBackup(!isAutoBackup)}
                                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                    isAutoBackup ? 'bg-indigo-600' : 'bg-slate-300'
                                }`}
                            >
                                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                    isAutoBackup ? 'translate-x-5' : 'translate-x-0'
                                }`} />
                            </button>
                        </div>

                        {/* Tần suất */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Tần suất sao lưu tự động</label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                {[
                                    { id: 'daily', label: 'Hàng ngày' },
                                    { id: 'weekly', label: 'Hàng tuần' },
                                    { id: 'custom', label: 'Tùy chọn số ngày' },
                                    { id: 'off', label: 'Tắt' }
                                ].map(f => (
                                    <button
                                        key={f.id}
                                        type="button"
                                        onClick={() => handleFrequencyChange(f.id as any)}
                                        className={`py-2.5 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                                            frequency === f.id 
                                                ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-2xs' 
                                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Mode */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Tùy chọn sao lưu điểm khôi phục</label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => handleSaveModeChange('new')}
                                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                                        saveMode === 'new'
                                            ? 'bg-indigo-50/80 border-indigo-500 ring-1 ring-indigo-500'
                                            : 'bg-white border-slate-200 hover:bg-slate-50'
                                    }`}
                                >
                                    <span className="font-bold text-slate-900 text-xs block mb-0.5">Tạo bản lưu mới</span>
                                    <span className="text-[11px] text-slate-500 font-medium block">Thêm điểm mới vào lịch sử (giữ tối đa 5 điểm)</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleSaveModeChange('overwrite')}
                                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                                        saveMode === 'overwrite'
                                            ? 'bg-indigo-50/80 border-indigo-500 ring-1 ring-indigo-500'
                                            : 'bg-white border-slate-200 hover:bg-slate-50'
                                    }`}
                                >
                                    <span className="font-bold text-slate-900 text-xs block mb-0.5">Lưu đè điểm gần nhất</span>
                                    <span className="text-[11px] text-slate-500 font-medium block">Ghi đè trực tiếp lên điểm sao lưu cũ nhất gần nhất</span>
                                </button>
                            </div>
                        </div>

                        {/* Thư mục lưu trên máy */}
                        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <label className="text-xs font-bold text-slate-800 block">Thư mục tự động lưu trên máy</label>
                                <p className="text-[11px] text-slate-500 truncate font-mono mt-0.5">
                                    {backupDir || 'Chưa chọn thư mục. Hệ thống sẽ sao lưu an toàn vào bộ nhớ nội bộ trình duyệt.'}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleSelectDirectory}
                                className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-lg shrink-0 shadow-2xs cursor-pointer flex items-center gap-1.5"
                            >
                                <FolderOpen size={14} className="text-indigo-600" />
                                <span>Chọn thư mục</span>
                            </button>
                        </div>

                        {/* Info line */}
                        <div className="bg-slate-100/70 px-4 py-2.5 rounded-xl text-xs flex justify-between items-center text-slate-600 font-medium">
                            <span>Lần sao lưu gần nhất: <strong className="text-slate-900 font-mono">{lastBackupTimeFormatted}</strong></span>
                            <span>Số điểm khôi phục lưu tối đa: <strong className="text-indigo-700 font-bold">5 bản ghi</strong></span>
                        </div>
                    </div>

                    {/* Instant Backup Button */}
                    <button
                        type="button"
                        onClick={handleCreateBackupNow}
                        disabled={isCreatingBackup}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl shadow-sm flex items-center justify-center gap-2 active:scale-95 transition-all text-xs md:text-sm cursor-pointer disabled:opacity-50"
                    >
                        {isCreatingBackup ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                        <span>TẠO ĐIỂM SAO LƯU NGAY BÂY GIỜ</span>
                    </button>
                </div>

                {/* KHỐI PHẢI: KHÔI PHỤC DỮ LIỆU TỪ FILE */}
                <div className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-slate-200/80 flex flex-col justify-between space-y-5">
                    <div className="space-y-5">
                        {/* Title */}
                        <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                                <RefreshCw size={20} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 text-base">Khôi phục Dữ liệu từ File</h3>
                                <p className="text-xs text-slate-500 font-medium">Tải lên tệp sao lưu JSON để phục hồi hệ thống</p>
                            </div>
                        </div>

                        {/* Dropzone */}
                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-slate-200 hover:border-emerald-500 bg-slate-50/50 hover:bg-emerald-50/30 p-8 rounded-2xl text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 group"
                        >
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                className="hidden" 
                                accept=".json" 
                                onChange={handleFileUpload} 
                            />
                            <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 group-hover:border-emerald-400 flex items-center justify-center text-slate-400 group-hover:text-emerald-600 shadow-2xs transition-all">
                                <FileJson size={24} />
                            </div>
                            <div>
                                <span className="font-bold text-slate-800 text-sm block group-hover:text-emerald-700">Bấm để chọn tệp sao lưu JSON</span>
                                <span className="text-xs text-slate-400 font-medium block mt-1">Hỗ trợ các file định dạng JSON xuất từ hệ thống</span>
                            </div>
                        </div>

                        {/* Selective Restore Notice Box */}
                        <div className="bg-amber-50/80 border border-amber-200/80 p-4 rounded-xl text-xs text-amber-900 flex items-start gap-3">
                            <div className="p-1 bg-amber-100 rounded-lg text-amber-700 shrink-0 mt-0.5">
                                <Lightbulb size={18} />
                            </div>
                            <div className="space-y-1">
                                <strong className="font-bold text-amber-950 block">Khôi phục theo từng mục:</strong>
                                <p className="text-slate-700 leading-relaxed font-medium">
                                    Bạn có thể chủ động chọn mục dữ liệu cụ thể (Hồ sơ, Hợp đồng, GCN, Xử phạt, Cấu hình...) để khôi phục thay vì toàn bộ hệ thống.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. LỊCH SỬ 5 ĐIỂM SAO LƯU GẦN ĐÂY */}
            <div className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-slate-200/80 space-y-5">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 border-b border-slate-100 pb-3">
                    <div>
                        <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                            <Clock size={18} className="text-blue-600" />
                            <span>Danh sách các Điểm Sao lưu / Khôi phục gần đây ({restorePoints.length})</span>
                        </h3>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                            Các bản sao dự phòng được lưu trữ trực tiếp trên thiết bị trình duyệt này
                        </p>
                    </div>
                </div>

                {isLoadingPoints ? (
                    <div className="py-12 text-center text-slate-400 text-xs font-bold flex items-center justify-center gap-2">
                        <Loader2 size={18} className="animate-spin text-blue-600" />
                        <span>Đang tải các điểm sao lưu...</span>
                    </div>
                ) : restorePoints.length === 0 ? (
                    <div className="py-10 text-center text-slate-400 text-xs font-medium bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        Chưa có điểm sao lưu nào trong bộ nhớ. Hãy bấm "Tạo điểm sao lưu ngay bây giờ" ở trên.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {restorePoints.map((pt, idx) => {
                            const dateFormatted = new Date(pt.timestamp).toLocaleString('vi-VN', {
                                hour: '2-digit', minute: '2-digit', second: '2-digit',
                                day: '2-digit', month: '2-digit', year: 'numeric'
                            });

                            return (
                                <div key={pt.id || idx} className="bg-slate-50/70 hover:bg-slate-50 rounded-2xl p-4 md:p-5 border border-slate-200/80 transition-all space-y-4 shadow-2xs">
                                    {/* Card Header */}
                                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-slate-200/60 pb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 shadow-2xs">
                                                <HardDrive size={20} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-extrabold text-slate-900 text-sm font-mono">{dateFormatted}</span>
                                                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                                                        pt.isAuto ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
                                                    }`}>
                                                        {pt.isAuto ? 'TỰ ĐỘNG' : 'THỦ CÔNG'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3 text-xs text-slate-500 font-medium mt-0.5">
                                                    <span>Tổng số bản ghi: <strong className="text-slate-800 font-bold">{pt.totalRecords.toLocaleString('vi-VN')}</strong></span>
                                                    <span>•</span>
                                                    <span>Dung lượng: <strong className="text-slate-800 font-bold">{pt.sizeKb.toLocaleString('vi-VN')} KB</strong></span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end">
                                            <button
                                                type="button"
                                                onClick={() => handleRestorePoint(pt)}
                                                className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 font-bold text-xs rounded-xl shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
                                            >
                                                <RefreshCw size={14} />
                                                <span>Nạp Khôi phục</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDeletePoint(pt.id)}
                                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                                                title="Xóa điểm sao lưu này"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Detailed Breakdown Grid (12 Items matching screenshot) */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 text-xs">
                                        <div className="bg-white p-2.5 rounded-xl border border-slate-200/60 flex justify-between items-center">
                                            <span className="text-slate-600 font-medium truncate">Đo đạc / Tiếp nhận:</span>
                                            <strong className="text-blue-700 font-bold ml-1">{pt.counts.records.toLocaleString('vi-VN')} bản ghi</strong>
                                        </div>
                                        <div className="bg-white p-2.5 rounded-xl border border-slate-200/60 flex justify-between items-center">
                                            <span className="text-slate-600 font-medium truncate">Hợp đồng dịch vụ:</span>
                                            <strong className="text-indigo-700 font-bold ml-1">{pt.counts.contracts.toLocaleString('vi-VN')} bản ghi</strong>
                                        </div>
                                        <div className="bg-white p-2.5 rounded-xl border border-slate-200/60 flex justify-between items-center">
                                            <span className="text-slate-600 font-medium truncate">Hồ sơ Lưu trữ GCN:</span>
                                            <strong className="text-emerald-700 font-bold ml-1">{pt.counts.archiveVaoso.toLocaleString('vi-VN')} bản ghi</strong>
                                        </div>
                                        <div className="bg-white p-2.5 rounded-xl border border-slate-200/60 flex justify-between items-center">
                                            <span className="text-slate-600 font-medium truncate">Kho hồ sơ GCN:</span>
                                            <strong className="text-emerald-700 font-bold ml-1">{pt.counts.archiveSaoluc.toLocaleString('vi-VN')} bản ghi</strong>
                                        </div>

                                        <div className="bg-white p-2.5 rounded-xl border border-slate-200/60 flex justify-between items-center">
                                            <span className="text-slate-600 font-medium truncate">Dữ liệu Ngăn chặn:</span>
                                            <strong className="text-red-700 font-bold ml-1">{pt.counts.nganChan.toLocaleString('vi-VN')} bản ghi</strong>
                                        </div>
                                        <div className="bg-white p-2.5 rounded-xl border border-slate-200/60 flex justify-between items-center">
                                            <span className="text-slate-600 font-medium truncate">Hồ sơ Đăng ký (iGate):</span>
                                            <strong className="text-blue-700 font-bold ml-1">{pt.counts.iGate.toLocaleString('vi-VN')} bản ghi</strong>
                                        </div>
                                        <div className="bg-white p-2.5 rounded-xl border border-slate-200/60 flex justify-between items-center">
                                            <span className="text-slate-600 font-medium truncate">Nhân viên & User:</span>
                                            <strong className="text-slate-800 font-bold ml-1">{pt.counts.usersAndStaff.toLocaleString('vi-VN')} bản ghi</strong>
                                        </div>
                                        <div className="bg-white p-2.5 rounded-xl border border-slate-200/60 flex justify-between items-center">
                                            <span className="text-slate-600 font-medium truncate">Xử phạt VPHC:</span>
                                            <strong className="text-amber-700 font-bold ml-1">{pt.counts.vphc.toLocaleString('vi-VN')} bản ghi</strong>
                                        </div>

                                        <div className="bg-white p-2.5 rounded-xl border border-slate-200/60 flex justify-between items-center">
                                            <span className="text-slate-600 font-medium truncate">Biên bản bàn giao:</span>
                                            <strong className="text-purple-700 font-bold ml-1">{pt.counts.bienBan.toLocaleString('vi-VN')} bản ghi</strong>
                                        </div>
                                        <div className="bg-white p-2.5 rounded-xl border border-slate-200/60 flex justify-between items-center">
                                            <span className="text-slate-600 font-medium truncate">Chỉnh lý bản đồ:</span>
                                            <strong className="text-red-700 font-bold ml-1">{pt.counts.chinhLy.toLocaleString('vi-VN')} bản ghi</strong>
                                        </div>
                                        <div className="bg-white p-2.5 rounded-xl border border-slate-200/60 flex justify-between items-center">
                                            <span className="text-slate-600 font-medium truncate">Tách thửa / Hợp thửa:</span>
                                            <strong className="text-amber-800 font-bold ml-1">{pt.counts.tachThua.toLocaleString('vi-VN')} bản ghi</strong>
                                        </div>
                                        <div className="bg-white p-2.5 rounded-xl border border-slate-200/60 flex justify-between items-center">
                                            <span className="text-slate-600 font-medium truncate">Lịch đo đạc:</span>
                                            <strong className="text-teal-700 font-bold ml-1">{pt.counts.workSchedules.toLocaleString('vi-VN')} bản ghi</strong>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* MODAL LỰA CHỌN KHÔI PHỤC TỪNG MỤC */}
            {showSelectiveModal && selectedBackupData && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[110] p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 flex flex-col">
                        <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center shrink-0">
                            <h3 className="font-bold text-base flex items-center gap-2">
                                <RefreshCw size={18} className="text-emerald-400" />
                                <span>Tùy chọn Khôi phục Dữ liệu</span>
                            </h3>
                            <button 
                                onClick={() => setShowSelectiveModal(false)}
                                disabled={isRestoring}
                                className="text-slate-400 hover:text-white p-1 rounded-full transition-colors cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
                            <p className="text-xs text-slate-600 font-medium">
                                Hãy chọn các danh mục dữ liệu bạn muốn khôi phục lại vào hệ thống:
                            </p>

                            <div className="space-y-2.5">
                                {[
                                    { id: 'records', label: 'Hồ sơ Đo đạc' },
                                    { id: 'archive', label: 'Hồ sơ Lưu trữ' },
                                    { id: 'igate', label: 'Hồ sơ Cấp Giấy (iGate)' },
                                    { id: 'contracts', label: 'Hợp đồng dịch vụ' },
                                    { id: 'schedules', label: 'Lịch công tác' },
                                    { id: 'vphc', label: 'Biên bản VPHC' },
                                    { id: 'users', label: 'User & Nhân viên' },
                                    { id: 'nganChan', label: 'Dữ liệu Ngăn chặn' },
                                    { id: 'bienban', label: 'Biên bản bàn giao' },
                                    { id: 'chinhly', label: 'Chỉnh lý bản đồ' },
                                    { id: 'tachthua', label: 'Tách hợp thửa' }
                                ].map(mod => (
                                    <label key={mod.id} className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl cursor-pointer transition-colors border border-slate-200/60">
                                        <input 
                                            type="checkbox" 
                                            checked={!!selectedModules[mod.id]} 
                                            onChange={(e) => setSelectedModules(prev => ({ ...prev, [mod.id]: e.target.checked }))}
                                            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                        />
                                        <span className="text-xs font-bold text-slate-800">{mod.label}</span>
                                    </label>
                                ))}
                            </div>

                            {restoreProgressMsg && (
                                <div className="p-3 bg-emerald-50 text-emerald-800 text-xs font-semibold rounded-xl border border-emerald-200 flex items-center gap-2">
                                    <Loader2 size={16} className="animate-spin text-emerald-600 shrink-0" />
                                    <span>{restoreProgressMsg}</span>
                                </div>
                            )}
                        </div>

                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 shrink-0">
                            <button
                                type="button"
                                onClick={() => setShowSelectiveModal(false)}
                                disabled={isRestoring}
                                className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 font-medium text-xs hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                                Hủy bỏ
                            </button>
                            <button
                                type="button"
                                onClick={handleExecuteRestore}
                                disabled={isRestoring || !Object.values(selectedModules).some(v => v)}
                                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                                {isRestoring ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                <span>Thực hiện Khôi phục</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
