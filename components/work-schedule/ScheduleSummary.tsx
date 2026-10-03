import React, { useState, useMemo, useRef, useEffect } from 'react';
import { WorkSchedule } from '../../types';
import { BarChart3, Search, CalendarDays, Filter, X } from 'lucide-react';
import FlexibleDateInput from '../FlexibleDateInput';

interface ScheduleSummaryProps {
    schedules: WorkSchedule[];
}

const ScheduleSummary: React.FC<ScheduleSummaryProps> = ({ schedules }) => {
    const [filterType, setFilterType] = useState<'all' | 'week' | 'month' | 'year' | 'range'>('month');
    const [dateRange, setDateRange] = useState({ from: '', to: '' });
    const [searchEmployee, setSearchEmployee] = useState('');
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const filterPopoverRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filterPopoverRef.current && !filterPopoverRef.current.contains(event.target as Node)) {
                setIsFilterOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Init current month range
    useEffect(() => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        setDateRange({ 
            from: start.toISOString().split('T')[0], 
            to: end.toISOString().split('T')[0] 
        });
    }, []);

    const handleFilterPreset = (type: 'week' | 'month' | 'year') => {
        setFilterType(type);
        const now = new Date();
        let start = new Date();
        let end = new Date();

        if (type === 'week') {
            const day = now.getDay();
            const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Thứ 2
            start = new Date(now.getFullYear(), now.getMonth(), diff);
            end = new Date(now.getFullYear(), now.getMonth(), diff + 6);
        } else if (type === 'month') {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        } else if (type === 'year') {
            start = new Date(now.getFullYear(), 0, 1);
            end = new Date(now.getFullYear(), 11, 31);
        }
        setDateRange({ 
            from: start.toISOString().split('T')[0], 
            to: end.toISOString().split('T')[0] 
        });
    };

    const activeFilterCount = filterType !== 'all' ? 1 : 0;

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
            if (filterType === 'all') return true;

            if (filterType === 'range') {
                if (!dateRange.from || !dateRange.to) return true;
                return s.date >= dateRange.from && s.date <= dateRange.to;
            }

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

    }, [schedules, filterType, dateRange, searchEmployee]);

    const getFilterLabel = () => {
        if (filterType === 'all') return 'Tất cả';
        if (filterType === 'week') return 'Tuần này';
        if (filterType === 'month') return 'Tháng này';
        if (filterType === 'year') return 'Năm nay';
        if (filterType === 'range') {
            if (dateRange.from && dateRange.to) {
                const formatDate = (str: string) => {
                    const parts = str.split('-');
                    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : str;
                };
                return `${formatDate(dateRange.from)} - ${formatDate(dateRange.to)}`;
            }
            return 'Khoảng ngày';
        }
        return '';
    };

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-visible">
            {/* SINGLE UNIFIED HEADER ROW */}
            <div className="p-3 border-b border-gray-200 bg-gray-50 flex flex-wrap items-center justify-between gap-2.5 shrink-0 rounded-t-xl">
                {/* Left side: Title & Active Scope Badge */}
                <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-gray-700 flex items-center gap-2 text-sm shrink-0">
                        <BarChart3 size={18} className="text-blue-600"/> Tổng hợp số lượng thực hiện ({summaryData.length})
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-semibold text-[11px] shadow-2xs">
                        {getFilterLabel()}
                    </span>
                </div>
                
                {/* Right side: Search Input -> Filter Dropdown Popover */}
                <div className="flex items-center gap-2 ml-auto flex-wrap">
                    {/* Search Bar */}
                    <div className="relative w-64 sm:w-72 md:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input 
                            type="text" 
                            placeholder="Lọc theo tên nhân viên..." 
                            className="w-full pl-9 pr-8 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white shadow-2xs"
                            value={searchEmployee}
                            onChange={e => setSearchEmployee(e.target.value)}
                        />
                        {searchEmployee && (
                            <button
                                type="button"
                                onClick={() => setSearchEmployee('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded-full"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    {/* Filter Dropdown Popover */}
                    <div className="relative z-50" ref={filterPopoverRef}>
                        <button
                            type="button"
                            onClick={() => setIsFilterOpen(!isFilterOpen)}
                            className={`relative p-2 rounded-lg text-sm transition-all shadow-xs border cursor-pointer flex items-center justify-center ${
                                activeFilterCount > 0
                                    ? "border-blue-400 text-blue-700 bg-blue-50 hover:bg-blue-100"
                                    : "border-gray-300 text-gray-600 bg-white hover:bg-gray-50"
                            }`}
                            title="Bộ lọc thời gian tổng hợp"
                        >
                            <Filter size={16} className={activeFilterCount > 0 ? "text-blue-600" : "text-gray-600"} />
                            {activeFilterCount > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 bg-blue-600 text-white text-[10px] w-4 h-4 rounded-full font-bold flex items-center justify-center shadow-xs">
                                    {activeFilterCount}
                                </span>
                            )}
                        </button>

                        {/* Dropdown Menu - Opens Downwards with proper z-index and max height */}
                        {isFilterOpen && (
                            <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 max-h-[85vh] overflow-y-auto bg-white rounded-xl shadow-2xl border border-gray-200 p-4 z-50 animate-fade-in text-gray-800">
                                <div className="flex items-center justify-between pb-2 border-b border-gray-100 mb-3">
                                    <div className="flex items-center gap-1.5 font-bold text-gray-800 text-xs sm:text-sm">
                                        <CalendarDays size={15} className="text-blue-600" />
                                        <span>Lọc theo thời gian</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setFilterType('all')}
                                        className="text-[11px] text-red-500 hover:underline font-bold cursor-pointer"
                                    >
                                        Tất cả
                                    </button>
                                </div>

                                {/* Quick Presets */}
                                <div className="grid grid-cols-4 gap-1 mb-3">
                                    <button
                                        type="button"
                                        onClick={() => handleFilterPreset('week')}
                                        className={`px-2 py-1 text-[11px] font-medium rounded transition-colors text-center cursor-pointer ${
                                            filterType === 'week' ? 'bg-blue-600 text-white shadow-xs font-bold' : 'bg-gray-100 hover:bg-blue-50 hover:text-blue-600 text-gray-600'
                                        }`}
                                    >
                                        Tuần này
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleFilterPreset('month')}
                                        className={`px-2 py-1 text-[11px] font-medium rounded transition-colors text-center cursor-pointer ${
                                            filterType === 'month' ? 'bg-blue-600 text-white shadow-xs font-bold' : 'bg-gray-100 hover:bg-blue-50 hover:text-blue-600 text-gray-600'
                                        }`}
                                    >
                                        Tháng này
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleFilterPreset('year')}
                                        className={`px-2 py-1 text-[11px] font-medium rounded transition-colors text-center cursor-pointer ${
                                            filterType === 'year' ? 'bg-blue-600 text-white shadow-xs font-bold' : 'bg-gray-100 hover:bg-blue-50 hover:text-blue-600 text-gray-600'
                                        }`}
                                    >
                                        Năm nay
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFilterType('all')}
                                        className={`px-2 py-1 text-[11px] font-medium rounded transition-colors text-center cursor-pointer ${
                                            filterType === 'all' ? 'bg-blue-600 text-white shadow-xs font-bold' : 'bg-gray-100 hover:bg-blue-50 hover:text-blue-600 text-gray-600'
                                        }`}
                                    >
                                        Tất cả
                                    </button>
                                </div>

                                {/* Custom Date Range Inputs */}
                                <div className="space-y-2 mb-3">
                                    <div>
                                        <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Từ ngày</label>
                                        <FlexibleDateInput
                                            value={dateRange.from}
                                            onChange={(isoStr) => { setDateRange(prev => ({ ...prev, from: isoStr })); setFilterType('range'); }}
                                            placeholder="dd/mm/yyyy"
                                            size="sm"
                                            className="w-full"
                                            inputClassName="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 bg-white font-semibold"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Đến ngày</label>
                                        <FlexibleDateInput
                                            value={dateRange.to}
                                            onChange={(isoStr) => { setDateRange(prev => ({ ...prev, to: isoStr })); setFilterType('range'); }}
                                            placeholder="dd/mm/yyyy"
                                            size="sm"
                                            className="w-full"
                                            inputClassName="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 bg-white font-semibold"
                                        />
                                    </div>
                                </div>

                                <div className="pt-2 border-t border-gray-100 flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setIsFilterOpen(false)}
                                        className="px-3.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors cursor-pointer shadow-xs"
                                    >
                                        Áp dụng
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* SUMMARY TABLE */}
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
                                <td className="p-3 text-center text-gray-400 font-medium">{idx + 1}</td>
                                <td className="p-3 font-semibold text-gray-800">{item.name}</td>
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
