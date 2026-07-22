
import React, { useMemo } from 'react';
import { RecordFile } from '../types';
import { getNormalizedWard, STATUS_LABELS } from '../constants';
import { Eye, Copy, AlertTriangle, CheckCircle } from 'lucide-react';

interface DuplicateFinderProps {
  records: RecordFile[];
  onViewRecord: (record: RecordFile) => void;
}

const DuplicateFinder: React.FC<DuplicateFinderProps> = ({ records, onViewRecord }) => {
  const duplicates = useMemo(() => {
    const map = new Map<string, RecordFile[]>();
    const normalize = (c: string) => c ? c.trim().toLowerCase() : '';

    records.forEach(r => {
      if (!r.code) return;
      const key = normalize(r.code);
      if (!map.has(key)) map.set(key, []);
      map.get(key)?.push(r);
    });

    const result: { code: string, count: number, items: RecordFile[] }[] = [];
    map.forEach((items) => {
      if (items.length > 1) {
        result.push({
          code: items[0].code,
          count: items.length,
          items: items
        });
      }
    });

    return result.sort((a, b) => b.count - a.count);
  }, [records]);

  if (duplicates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 bg-white rounded-xl shadow-sm border border-gray-200">
        <CheckCircle size={64} className="text-green-500 mb-4" />
        <h3 className="text-xl font-bold text-gray-700">Hệ thống sạch sẽ</h3>
        <p>Không phát hiện hồ sơ nào bị trùng mã.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in-up">
      <div className="p-4 border-b border-gray-200 bg-orange-50 flex items-center gap-3 shrink-0">
        <div className="p-2 bg-orange-100 rounded-lg text-orange-600">
            <AlertTriangle size={24} />
        </div>
        <div>
            <h2 className="text-lg font-bold text-gray-800">Công cụ phát hiện trùng lặp</h2>
            <p className="text-sm text-gray-600">Tìm thấy <strong className="text-red-600">{duplicates.length}</strong> nhóm mã hồ sơ bị trùng trong hệ thống.</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50">
        {duplicates.map((group, idx) => (
          <div key={idx} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-3 bg-blue-50 border-b border-blue-100 flex justify-between items-center">
              <span className="font-mono font-bold text-blue-700 flex items-center gap-2 text-lg">
                <Copy size={18} /> {group.code}
              </span>
              <span className="text-xs font-bold text-red-600 bg-white px-3 py-1 rounded-full border border-red-200 shadow-sm">
                {group.count} bản ghi
              </span>
            </div>
            <div className="divide-y divide-gray-100">
              {group.items.map(r => (
                <div key={r.id} className="p-4 hover:bg-gray-50 transition-colors flex justify-between items-center gap-4 group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-gray-800 text-base">{r.customerName}</span>
                        <span className="text-xs text-gray-400 font-mono">ID: {r.id}</span>
                    </div>
                    <div className="text-sm text-gray-600 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                        <span className="flex items-center gap-1"><span className="font-semibold text-gray-500 text-xs uppercase">Ngày nhận:</span> {r.receivedDate}</span>
                        <span className="flex items-center gap-1"><span className="font-semibold text-gray-500 text-xs uppercase">Hẹn trả:</span> {r.deadline}</span>
                        <span className="flex items-center gap-1"><span className="font-semibold text-gray-500 text-xs uppercase">Địa chỉ:</span> {getNormalizedWard(r.ward)}</span>
                        <span className="flex items-center gap-1"><span className="font-semibold text-gray-500 text-xs uppercase">Trạng thái:</span> {STATUS_LABELS[r.status]}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => onViewRecord(r)}
                    className="p-2 bg-white border border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 rounded-lg transition-all shadow-sm flex flex-col items-center gap-1 min-w-[70px]"
                  >
                    <Eye size={18} />
                    <span className="text-[10px] font-bold">Chi tiết</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DuplicateFinder;
