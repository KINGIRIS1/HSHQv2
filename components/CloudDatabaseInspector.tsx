import React, { useState, useEffect, useRef } from 'react';
import { Database, CheckCircle2, AlertTriangle, RefreshCw, Layers, FileText, FolderArchive, Server, ShieldCheck, X, Download, Upload, Clock, FileJson } from 'lucide-react';
import { supabase, isConfigured } from '../services/supabaseClient';
import { getShortRecordType } from '../constants';
import { downloadSystemJsonBackup, restoreSystemJsonBackupAsync, FullBackupData } from '../services/backupService';
import { RecordFile } from '../types';

interface CloudDatabaseInspectorProps {
  isOpen: boolean;
  onClose: () => void;
  records?: RecordFile[];
  onRefreshData?: () => void;
}

export const CloudDatabaseInspector: React.FC<CloudDatabaseInspectorProps> = ({ isOpen, onClose, records = [], onRefreshData }) => {
  const [loading, setLoading] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState<{ processed: number; total: number; status: string } | null>(null);
  const [backupFeedback, setBackupFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [restoreFeedback, setRestoreFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tableStats, setTableStats] = useState<{
    dangky: { count: number; error?: string; samples: any[] };
    land: { count: number; error?: string; samples: any[] };
    luutru: { count: number; error?: string; samples: any[] };
  }>({
    dangky: { count: 0, samples: [] },
    land: { count: 0, samples: [] },
    luutru: { count: 0, samples: [] },
  });
  const [activeTab, setActiveTab] = useState<'dangky' | 'land' | 'luutru'>('dangky');

  const checkDatabase = async () => {
    if (!isConfigured) return;
    setLoading(true);

    const stats = {
      dangky: { count: 0, error: undefined as string | undefined, samples: [] as any[] },
      land: { count: 0, error: undefined as string | undefined, samples: [] as any[] },
      luutru: { count: 0, error: undefined as string | undefined, samples: [] as any[] },
    };

    // 1. Check dangky_records
    try {
      const { count, error, data } = await supabase
        .from('dangky_records')
        .select('*', { count: 'exact', head: false })
        .order('receivedDate', { ascending: false })
        .limit(5);

      if (error) throw error;
      stats.dangky.count = count ?? (data ? data.length : 0);
      stats.dangky.samples = data || [];
    } catch (e: any) {
      stats.dangky.error = e.message || 'Lỗi kết nối bảng dangky_records';
    }

    // 2. Check land_records
    try {
      const { count, error, data } = await supabase
        .from('land_records')
        .select('*', { count: 'exact', head: false })
        .order('receivedDate', { ascending: false })
        .limit(5);

      if (error) throw error;
      stats.land.count = count ?? (data ? data.length : 0);
      stats.land.samples = data || [];
    } catch (e: any) {
      stats.land.error = e.message || 'Lỗi kết nối bảng land_records';
    }

    // 3. Check luutru_records
    try {
      const { count, error, data } = await supabase
        .from('luutru_records')
        .select('*', { count: 'exact', head: false })
        .order('receivedDate', { ascending: false })
        .limit(5);

      if (error) throw error;
      stats.luutru.count = count ?? (data ? data.length : 0);
      stats.luutru.samples = data || [];
    } catch (e: any) {
      stats.luutru.error = e.message || 'Lỗi kết nối bảng luutru_records';
    }

    setTableStats(stats);
    setLoading(false);
  };

  const handleDownloadBackup = async () => {
    setBackupLoading(true);
    setBackupFeedback(null);
    try {
      const res = await downloadSystemJsonBackup();
      if (res.success) {
        setBackupFeedback({
          type: 'success',
          message: `Đã tạo và tải về tệp sao lưu "${res.fileName}" (${res.count} hồ sơ) thành công!`
        });
      }
    } catch (err: any) {
      setBackupFeedback({
        type: 'error',
        message: err?.message || 'Lỗi khi tạo tệp sao lưu .json'
      });
    } finally {
      setBackupLoading(false);
    }
  };

  const handleFileRestoreChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoreLoading(true);
    setRestoreFeedback(null);
    setRestoreProgress({ processed: 0, total: 100, status: 'Đang đọc tệp sao lưu .json...' });

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const jsonContent = event.target?.result as string;
        const backupObj = JSON.parse(jsonContent) as FullBackupData;
        
        if (!backupObj || !backupObj.data || !backupObj.data.records) {
          throw new Error("Tệp .json không đúng định dạng sao lưu hệ thống.");
        }

        const result = await restoreSystemJsonBackupAsync(backupObj, records, (processed, total, status) => {
          setRestoreProgress({ processed, total, status });
        });

        setRestoreFeedback({
          type: 'success',
          message: result.message
        });

        if (onRefreshData) {
          onRefreshData();
        }
        checkDatabase();
      } catch (err: any) {
        console.error("Restore error:", err);
        setRestoreFeedback({
          type: 'error',
          message: err?.message || 'Lỗi khi phân tích hoặc khôi phục tệp .json'
        });
      } finally {
        setRestoreLoading(false);
        setRestoreProgress(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.onerror = () => {
      setRestoreFeedback({ type: 'error', message: 'Không thể đọc tệp đã chọn.' });
      setRestoreLoading(false);
      setRestoreProgress(null);
    };
    reader.readAsText(file);
  };

  useEffect(() => {
    if (isOpen) {
      checkDatabase();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-700 to-indigo-800 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl">
              <Database className="w-6 h-6 text-purple-200" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Kiểm Tra Kết Nối Cloud Database (Supabase)</h2>
              <p className="text-xs text-purple-200">Xác thực phân bổ bản ghi: Đăng ký → dangky_records | Đo đạc → land_records | Lưu trữ → luutru_records</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={checkDatabase} 
              disabled={loading}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title="Làm mới kiểm tra"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Làm mới
            </button>
            <button 
              onClick={onClose} 
              className="p-1.5 hover:bg-white/10 rounded-lg text-white/80 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-gray-50/50">
          
          {!isConfigured ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <div className="text-sm">
                <strong>Supabase chưa được cấu hình.</strong> Vui lòng cung cấp URL và Anon Key để kết nối Cloud Database.
              </div>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* 1. Dangky Records */}
                <div className={`bg-white p-4 rounded-xl border transition-all shadow-xs ${tableStats.dangky.error ? 'border-red-200 bg-red-50/30' : 'border-purple-200 hover:border-purple-300'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 flex items-center gap-1">
                      <FileText className="w-3 h-3" /> Module Cấp giấy (3.x)
                    </span>
                    {tableStats.dangky.error ? (
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    )}
                  </div>
                  <div className="text-2xl font-black text-gray-800 mb-1">
                    {loading ? '...' : tableStats.dangky.count} <span className="text-xs font-normal text-gray-500">bản ghi</span>
                  </div>
                  <div className="text-xs text-purple-700 font-mono font-medium">dangky_records (Mã H19.151.11.22-*)</div>
                  {tableStats.dangky.error && (
                    <div className="mt-2 text-[11px] text-red-600 bg-red-100/60 p-1.5 rounded">{tableStats.dangky.error}</div>
                  )}
                </div>

                {/* 2. Land Records */}
                <div className={`bg-white p-4 rounded-xl border transition-all shadow-xs ${tableStats.land.error ? 'border-red-200 bg-red-50/30' : 'border-blue-200 hover:border-blue-300'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 flex items-center gap-1">
                      <Layers className="w-3 h-3" /> Module Đo đạc (2.x)
                    </span>
                    {tableStats.land.error ? (
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    )}
                  </div>
                  <div className="text-2xl font-black text-gray-800 mb-1">
                    {loading ? '...' : tableStats.land.count} <span className="text-xs font-normal text-gray-500">bản ghi</span>
                  </div>
                  <div className="text-xs text-blue-700 font-mono font-medium">land_records (Mã TK-*, TQ-*, TH-*, MD-*)</div>
                  {tableStats.land.error && (
                    <div className="mt-2 text-[11px] text-red-600 bg-red-100/60 p-1.5 rounded">{tableStats.land.error}</div>
                  )}
                </div>

                {/* 3. Luutru Records */}
                <div className={`bg-white p-4 rounded-xl border transition-all shadow-xs ${tableStats.luutru.error ? 'border-red-200 bg-red-50/30' : 'border-amber-200 hover:border-amber-300'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 flex items-center gap-1">
                      <FolderArchive className="w-3 h-3" /> Module Lưu trữ (1.x)
                    </span>
                    {tableStats.luutru.error ? (
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    )}
                  </div>
                  <div className="text-2xl font-black text-gray-800 mb-1">
                    {loading ? '...' : tableStats.luutru.count} <span className="text-xs font-normal text-gray-500">bản ghi</span>
                  </div>
                  <div className="text-xs text-amber-700 font-mono font-medium">luutru_records (Mã LT-*, CV-*)</div>
                  {tableStats.luutru.error && (
                    <div className="mt-2 text-[11px] text-red-600 bg-red-100/60 p-1.5 rounded">{tableStats.luutru.error}</div>
                  )}
                </div>

              </div>

              {/* Sample Data Inspection Section */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs">
                <div className="flex border-b border-gray-200 bg-gray-50 px-4 pt-3 gap-2">
                  <button
                    onClick={() => setActiveTab('dangky')}
                    className={`px-4 py-2 font-bold text-xs rounded-t-lg transition-all border-t border-x ${activeTab === 'dangky' ? 'bg-white text-purple-700 border-gray-200 relative top-[1px]' : 'text-gray-500 border-transparent hover:bg-gray-100'}`}
                  >
                    Bản ghi Đăng ký (dangky_records) [{tableStats.dangky.samples.length}]
                  </button>
                  <button
                    onClick={() => setActiveTab('land')}
                    className={`px-4 py-2 font-bold text-xs rounded-t-lg transition-all border-t border-x ${activeTab === 'land' ? 'bg-white text-blue-700 border-gray-200 relative top-[1px]' : 'text-gray-500 border-transparent hover:bg-gray-100'}`}
                  >
                    Bản ghi Đo đạc (land_records) [{tableStats.land.samples.length}]
                  </button>
                  <button
                    onClick={() => setActiveTab('luutru')}
                    className={`px-4 py-2 font-bold text-xs rounded-t-lg transition-all border-t border-x ${activeTab === 'luutru' ? 'bg-white text-amber-700 border-gray-200 relative top-[1px]' : 'text-gray-500 border-transparent hover:bg-gray-100'}`}
                  >
                    Bản ghi Lưu trữ (luutru_records) [{tableStats.luutru.samples.length}]
                  </button>
                </div>

                <div className="p-4 overflow-x-auto max-h-80">
                  {loading ? (
                    <div className="text-center py-8 text-gray-500 text-sm">Đang tải dữ liệu kiểm tra...</div>
                  ) : (
                    <>
                      {activeTab === 'dangky' && (
                        <SampleTable records={tableStats.dangky.samples} tableName="dangky_records" emptyMessage="Chưa có bản ghi nào trong bảng dangky_records." />
                      )}
                      {activeTab === 'land' && (
                        <SampleTable records={tableStats.land.samples} tableName="land_records" emptyMessage="Chưa có bản ghi nào trong bảng land_records." />
                      )}
                      {activeTab === 'luutru' && (
                        <SampleTable records={tableStats.luutru.samples} tableName="luutru_records" emptyMessage="Chưa có bản ghi nào trong bảng luutru_records." />
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* --- SAO LƯU & KHÔI PHỤC DỮ LIỆU .JSON THÔNG MINH --- */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200/80 rounded-2xl p-5 space-y-4 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-blue-200/60">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-blue-600 text-white rounded-xl shadow-xs">
                      <FileJson className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-800 text-sm tracking-tight">Sao lưu & Khôi phục Dữ liệu Hệ thống (.json)</h3>
                      <p className="text-xs text-slate-500 font-medium">Bảo toàn 100% tất cả trường thông tin hồ sơ. Tự động sao lưu lúc 7:30 sáng hàng ngày.</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono px-3 py-1 bg-blue-100 text-blue-800 font-bold rounded-full">
                    Định dạng .json chuẩn
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Export Box */}
                  <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-2xs flex flex-col justify-between gap-3">
                    <div>
                      <h4 className="font-bold text-xs text-slate-700 mb-1 flex items-center gap-1.5">
                        <Download size={15} className="text-blue-600" /> Xuất tệp sao lưu (.json)
                      </h4>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Đóng gói toàn bộ dữ liệu hồ sơ, nhân sự, lịch sử và cấu hình hệ thống thành tệp .json và tự động tải về máy.
                      </p>
                    </div>
                    <button
                      onClick={handleDownloadBackup}
                      disabled={backupLoading}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {backupLoading ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
                      <span>{backupLoading ? 'Đang tạo tệp sao lưu...' : 'Tạo & Tải về tệp .json ngay'}</span>
                    </button>
                    {backupFeedback && (
                      <div className={`p-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${backupFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                        {backupFeedback.type === 'success' ? <CheckCircle2 size={14} className="text-emerald-600 shrink-0" /> : <AlertTriangle size={14} className="text-red-600 shrink-0" />}
                        <span className="text-[11px]">{backupFeedback.message}</span>
                      </div>
                    )}
                  </div>

                  {/* Restore Box */}
                  <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-2xs flex flex-col justify-between gap-3">
                    <div>
                      <h4 className="font-bold text-xs text-slate-700 mb-1 flex items-center gap-1.5">
                        <Upload size={15} className="text-indigo-600" /> Khôi phục thông minh (.json)
                      </h4>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Tải lên tệp .json. Hệ thống áp dụng <strong>phân trang chống quá tải</strong> và <strong>chỉ bù đắp hồ sơ thiếu</strong>, bỏ qua hồ sơ đã có sẵn.
                      </p>
                    </div>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept=".json" 
                      onChange={handleFileRestoreChange} 
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={restoreLoading}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {restoreLoading ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
                      <span>{restoreLoading ? 'Đang khôi phục phân trang...' : 'Chọn tệp .json để khôi phục'}</span>
                    </button>

                    {restoreProgress && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-bold text-indigo-700">
                          <span>{restoreProgress.status}</span>
                          <span>{Math.round((restoreProgress.processed / restoreProgress.total) * 100)}%</span>
                        </div>
                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div className="bg-indigo-600 h-2 transition-all duration-300 rounded-full" style={{ width: `${Math.max(5, (restoreProgress.processed / restoreProgress.total) * 100)}%` }}></div>
                        </div>
                      </div>
                    )}

                    {restoreFeedback && (
                      <div className={`p-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${restoreFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                        {restoreFeedback.type === 'success' ? <CheckCircle2 size={14} className="text-emerald-600 shrink-0" /> : <AlertTriangle size={14} className="text-red-600 shrink-0" />}
                        <span className="text-[11px]">{restoreFeedback.message}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Instructions / SQL Hint */}
              <div className="bg-purple-50/60 border border-purple-100 rounded-xl p-4 text-xs text-purple-900 space-y-3">
                <div className="font-bold flex items-center gap-1.5 text-purple-800">
                  <ShieldCheck className="w-4 h-4 text-purple-600" /> Mã lệnh SQL tối ưu hệ thống & cấp quyền (Chạy trên Supabase SQL Editor):
                </div>
                <p className="text-purple-700">
                  Để đảm bảo tính năng <strong>Phân công giao việc</strong> và <strong>Cấu hình nhân sự, bảng đăng ký</strong> đồng bộ tức thì lên Cloud cho toàn bộ đơn vị, hãy copy đoạn mã SQL bên dưới và chạy tại mục <strong>SQL Editor</strong> trên Supabase:
                </p>
                <pre className="bg-gray-900 text-gray-100 p-3.5 rounded-lg font-mono text-[11px] overflow-x-auto leading-relaxed select-all">
{`-- 1. BẢNG NHÂN VIÊN & ĐỊA BÀN PHỤ TRÁCH
CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    department TEXT DEFAULT 'Tổ Đo đạc',
    position TEXT DEFAULT 'Nhân viên',
    "managedWards" TEXT,
    managed_wards TEXT
);
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public full access employees" ON employees;
CREATE POLICY "Public full access employees" ON employees FOR ALL TO anon USING (true) WITH CHECK (true);

-- 2. BẢNG CẤU HÌNH HỆ THỐNG (SYSTEM SETTINGS)
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public full access system_settings" ON system_settings;
CREATE POLICY "Public full access system_settings" ON system_settings FOR ALL TO anon USING (true) WITH CHECK (true);

-- 3. BẢNG HỒ SƠ ĐĂNG KÝ (DANGKY_RECORDS)
CREATE TABLE IF NOT EXISTS dangky_records (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    "customerName" TEXT NOT NULL,
    "phoneNumber" TEXT,
    ward TEXT,
    "landPlot" TEXT,
    "mapSheet" TEXT,
    area NUMERIC,
    "recordType" TEXT,
    "receivedDate" TIMESTAMP,
    status TEXT DEFAULT 'RECEIVED'
);
ALTER TABLE dangky_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public full access dangky_records" ON dangky_records;
CREATE POLICY "Public full access dangky_records" ON dangky_records FOR ALL TO anon USING (true) WITH CHECK (true);`}
                </pre>
              </div>

            </>
          )}

        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-3.5 border-t border-gray-100 flex justify-end">
          <button 
            onClick={onClose}
            className="px-5 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
};

const SampleTable: React.FC<{ records: any[]; tableName: string; emptyMessage: string }> = ({ records, tableName, emptyMessage }) => {
  if (!records || records.length === 0) {
    return <div className="text-center py-8 text-gray-400 text-xs italic">{emptyMessage}</div>;
  }

  return (
    <table className="w-full text-left text-xs border-collapse">
      <thead>
        <tr className="border-b border-gray-200 text-gray-500 bg-gray-50">
          <th className="p-2.5 font-semibold">Mã hồ sơ</th>
          <th className="p-2.5 font-semibold">Tên khách hàng</th>
          <th className="p-2.5 font-semibold">Loại hồ sơ</th>
          <th className="p-2.5 font-semibold">Xã/Phường</th>
          <th className="p-2.5 font-semibold">Ngày nhận</th>
          <th className="p-2.5 font-semibold">Bảng lưu (Table)</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {records.map((r, idx) => (
          <tr key={r.id || idx} className="hover:bg-gray-50/80">
            <td className="p-2.5 font-mono font-bold text-purple-700">{r.code || '---'}</td>
            <td className="p-2.5 font-medium text-gray-800">{r.customerName || '---'}</td>
            <td className="p-2.5 text-gray-600">{getShortRecordType(r.recordType) || '---'}</td>
            <td className="p-2.5 text-gray-600">{r.ward || '---'}</td>
            <td className="p-2.5 text-gray-500">{r.receivedDate ? new Date(r.receivedDate).toLocaleDateString('vi-VN') : '---'}</td>
            <td className="p-2.5">
              <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-purple-100 text-purple-700 font-bold">
                {tableName}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default CloudDatabaseInspector;
