import React, { useMemo } from 'react';
import { RecordFile } from '../../types';
import { getNormalizedWard, getShortRecordType } from '../../constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { MapPin, Table2, BarChart3 } from 'lucide-react';

interface WardStatsViewProps {
    records: RecordFile[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6', '#06b6d4'];

const WardStatsView: React.FC<WardStatsViewProps> = ({ records }) => {
    
    const { processedData, recordTypes } = useMemo(() => {
        const stats: Record<string, Record<string, number>> = {};
        const typesSet = new Set<string>();

        records.forEach(r => {
            const ward = getNormalizedWard(r.ward) || 'Khác';
            const type = getShortRecordType(r.recordType) || 'Khác';
            
            typesSet.add(type);

            if (!stats[ward]) {
                stats[ward] = { _total: 0 };
            }
            
            // Tăng đếm cho loại hồ sơ
            stats[ward][type] = (stats[ward][type] || 0) + 1;
            // Tăng tổng số của xã
            stats[ward]._total += 1;
        });

        // Convert sang mảng để dùng cho Recharts và Table
        const data = Object.entries(stats).map(([wardName, counts]) => ({
            name: wardName,
            ...counts
        })).sort((a: any, b: any) => b._total - a._total); // Sắp xếp theo tổng số giảm dần

        return { 
            processedData: data, 
            recordTypes: Array.from(typesSet).sort() 
        };
    }, [records]);

    return (
        <div className="flex flex-col lg:flex-row h-full bg-slate-100 p-4 gap-4 overflow-y-auto lg:overflow-hidden">
            {/* 1. BIỂU ĐỒ */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col w-full lg:w-1/2 min-h-[400px] lg:min-h-0 shrink-0">
                <h3 className="font-bold text-gray-700 flex items-center gap-2 mb-4">
                    <BarChart3 size={20} className="text-blue-600" /> Biểu đồ phân bố hồ sơ theo địa bàn
                </h3>
                <div className="flex-1 w-full min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={processedData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                            <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
                            <YAxis fontSize={12} tickLine={false} axisLine={false} />
                            <Tooltip 
                                cursor={{ fill: '#f3f4f6' }}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            />
                            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                            
                            {recordTypes.map((type, index) => (
                                <Bar 
                                    key={type} 
                                    dataKey={type} 
                                    stackId="a" 
                                    fill={COLORS[index % COLORS.length]} 
                                    name={type}
                                    barSize={40}
                                />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* 2. BẢNG DỮ LIỆU CHI TIẾT */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col w-full lg:w-1/2 flex-1 min-h-[400px] lg:min-h-0">
                <h3 className="font-bold text-gray-700 flex items-center gap-2 mb-4 shrink-0">
                    <Table2 size={20} className="text-green-600" /> Bảng tổng hợp chi tiết
                </h3>
                
                <div className="flex-1 overflow-auto rounded-lg border border-gray-200">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-gray-100 text-gray-600 font-bold sticky top-0 shadow-sm z-10">
                            <tr>
                                <th className="p-3 border-b border-r w-10 text-center">STT</th>
                                <th className="p-3 border-b border-r min-w-[150px]">Xã / Phường</th>
                                {recordTypes.map(type => (
                                    <th key={type} className="p-3 border-b border-r text-center whitespace-nowrap min-w-[100px]">{type}</th>
                                ))}
                                <th className="p-3 border-b text-center w-24 bg-blue-50 text-blue-800">Tổng cộng</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {processedData.map((row: any, index: number) => (
                                <tr key={row.name} className="hover:bg-gray-50 transition-colors">
                                    <td className="p-3 text-center border-r text-gray-500">{index + 1}</td>
                                    <td className="p-3 font-bold text-gray-800 border-r flex items-center gap-2">
                                        <MapPin size={14} className="text-gray-400" /> {row.name}
                                    </td>
                                    {recordTypes.map(type => (
                                        <td key={type} className="p-3 text-center border-r text-gray-600">
                                            {row[type] || '-'}
                                        </td>
                                    ))}
                                    <td className="p-3 text-center font-bold text-blue-700 bg-blue-50/30">
                                        {row._total}
                                    </td>
                                </tr>
                            ))}
                            {processedData.length > 0 && (
                                <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                                    <td className="p-3 text-center border-r"></td>
                                    <td className="p-3 text-right border-r uppercase">Tổng toàn huyện</td>
                                    {recordTypes.map(type => {
                                        const typeTotal = processedData.reduce((sum: number, row: any) => sum + (row[type] || 0), 0);
                                        return (
                                            <td key={type} className="p-3 text-center border-r">{typeTotal}</td>
                                        );
                                    })}
                                    <td className="p-3 text-center bg-blue-100 text-blue-800">
                                        {processedData.reduce((sum: number, row: any) => sum + row._total, 0)}
                                    </td>
                                </tr>
                            )}
                            {processedData.length === 0 && (
                                <tr>
                                    <td colSpan={recordTypes.length + 3} className="p-8 text-center text-gray-400 italic">
                                        Không có dữ liệu thống kê.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default WardStatsView;