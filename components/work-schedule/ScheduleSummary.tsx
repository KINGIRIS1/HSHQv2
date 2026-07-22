import React, { useState, useMemo } from 'react';
import { WorkSchedule } from '../../types';
import { BarChart3, Search, Calendar as CalendarIcon } from 'lucide-react';

interface ScheduleSummaryProps {
    schedules: WorkSchedule[];
}

const ScheduleSummary: React.FC<ScheduleSummaryProps> = ({ schedules }) => {
    const [filterType, setFilterType] = useState<'week' | 'month' | 'year'>('month');
    const [searchEmployee, setSearchEmployee] = useState('');

    const summaryData = useMemo(() => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        
        // Helper to get week number
        const getWeekNumber = (d: Date) => {
            d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
            d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
            const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
            return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
        };
        const currentWeek = getWeekNumber(now);

        // Filter schedules based on selected time period
        const filteredSchedules = schedules.filter(s => {
            const date = new Date(s.date);
            if (filterType === 'year') {
                return date.getFullYear() === currentYear;
            } else if (filterType === 'month') {
                return date.getFullYear() === currentYear && date.getMonth() === currentMonth;
            } else if (filterType === 'week') {
                return date.getFullYear() === currentYear && getWeekNumber(date) === currentWeek;
            }
            return true;
        });

        // Aggregate by employee
        const counts: Record<string, number> = {};
        filteredSchedules.forEach(s => {
            // Split executors by comma and trim
            const executors = s.executors.split(',').map(e => e.trim()).filter(e => e);
            executors.forEach(emp => {
                counts[emp] = (counts[emp] || 0) + 1;
            });
        });

        // Convert to array, filter by search, and sort by count descending
        return Object.entries(counts)
            .map(([name, count]) => ({ name, count }))
            .filter(item => item.name.toLowerCase().includes(searchEmployee.toLowerCase()))
            .sort((a, b) => b.count - a.count);

    }, [schedules, filterType, searchEmployee]);

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden mt-6">
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-bold text-gray-700 flex items-center gap-2">
                        <BarChart3 size={18} className="text-blue-600"/> Tổng hợp số lượng thực hiện
                    </h3>
                    
                    <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-gray-200">
                        <button onClick={() => setFilterType('week')} className={`px-3 py-1 text-xs font-bold rounded transition-colors ${filterType === 'week' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}>Tuần này</button>
                        <button onClick={() => setFilterType('month')} className={`px-3 py-1 text-xs font-bold rounded transition-colors ${filterType === 'month' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}>Tháng này</button>
                        <button onClick={() => setFilterType('year')} className={`px-3 py-1 text-xs font-bold rounded transition-colors ${filterType === 'year' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}>Năm nay</button>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input 
                            type="text" 
                            placeholder="Lọc theo tên nhân viên..." 
                            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                            value={searchEmployee}
                            onChange={e => setSearchEmployee(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="p-0 overflow-auto max-h-80">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-100 text-xs font-bold text-gray-600 uppercase sticky top-0 shadow-sm z-10">
                        <tr>
                            <th className="p-3 w-16 text-center">STT</th>
                            <th className="p-3">Nhân viên</th>
                            <th className="p-3 w-40 text-center">Số lượng thực hiện</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-gray-100">
                        {summaryData.length > 0 ? summaryData.map((item, idx) => (
                            <tr key={item.name} className="hover:bg-blue-50/50 transition-colors">
                                <td className="p-3 text-center text-gray-400">{idx + 1}</td>
                                <td className="p-3 font-medium text-gray-800">{item.name}</td>
                                <td className="p-3 text-center">
                                    <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                                        {item.count} trường hợp
                                    </span>
                                </td>
                            </tr>
                        )) : (
                            <tr><td colSpan={3} className="p-8 text-center text-gray-400 italic">Không có dữ liệu tổng hợp.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ScheduleSummary;
