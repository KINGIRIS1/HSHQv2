import React, { useState, useEffect } from 'react';
import { Database, CheckCircle2, AlertTriangle, RefreshCw, Layers, FileText, FolderArchive, Server, ShieldCheck, X } from 'lucide-react';
import { supabase, isConfigured } from '../services/supabaseClient';
import { getShortRecordType } from '../constants';

interface CloudDatabaseInspectorProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CloudDatabaseInspector: React.FC<CloudDatabaseInspectorProps> = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(false);
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
                      <FileText className="w-3 h-3" /> Tab Đăng ký
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
                  <div className="text-xs text-purple-700 font-mono font-medium">dangky_records</div>
                  {tableStats.dangky.error && (
                    <div className="mt-2 text-[11px] text-red-600 bg-red-100/60 p-1.5 rounded">{tableStats.dangky.error}</div>
                  )}
                </div>

                {/* 2. Land Records */}
                <div className={`bg-white p-4 rounded-xl border transition-all shadow-xs ${tableStats.land.error ? 'border-red-200 bg-red-50/30' : 'border-blue-200 hover:border-blue-300'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 flex items-center gap-1">
                      <Layers className="w-3 h-3" /> Tab Đo đạc
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
                  <div className="text-xs text-blue-700 font-mono font-medium">land_records</div>
                  {tableStats.land.error && (
                    <div className="mt-2 text-[11px] text-red-600 bg-red-100/60 p-1.5 rounded">{tableStats.land.error}</div>
                  )}
                </div>

                {/* 3. Luutru Records */}
                <div className={`bg-white p-4 rounded-xl border transition-all shadow-xs ${tableStats.luutru.error ? 'border-red-200 bg-red-50/30' : 'border-amber-200 hover:border-amber-300'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 flex items-center gap-1">
                      <FolderArchive className="w-3 h-3" /> Tab Lưu trữ
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
                  <div className="text-xs text-amber-700 font-mono font-medium">luutru_records</div>
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

              {/* Instructions / SQL Hint */}
              <div className="bg-purple-50/60 border border-purple-100 rounded-xl p-4 text-xs text-purple-900 space-y-2">
                <div className="font-bold flex items-center gap-1.5 text-purple-800">
                  <ShieldCheck className="w-4 h-4 text-purple-600" /> Hướng dẫn kiểm tra và tạo bảng trên Supabase SQL Editor:
                </div>
                <p className="text-purple-700">
                  Nếu bảng <code className="bg-white px-1.5 py-0.5 rounded border border-purple-200 font-mono text-purple-900">dangky_records</code> chưa được tạo trên Supabase, bạn có thể vào mục <strong>SQL Editor</strong> trên trang quản lý Supabase và chạy lệnh khởi tạo:
                </p>
                <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg font-mono text-[11px] overflow-x-auto">
{`CREATE TABLE IF NOT EXISTS dangky_records (
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
);`}
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
