import React, { useState, useEffect, useRef } from 'react';
import { Calendar, AlertCircle, Check, Clock } from 'lucide-react';

interface FlexibleDateInputProps {
    value?: string; // YYYY-MM-DD or ISO string
    onChange: (isoDateStr: string) => void;
    label?: string;
    placeholder?: string;
    className?: string;
    inputClassName?: string;
    size?: 'sm' | 'md';
    showCalendarIcon?: boolean;
    showTodayButton?: boolean;
}

// Check days in month to prevent invalid dates like 31/04 or 29/02 in non-leap year
const getDaysInMonth = (month: number, year: number): number => {
    return new Date(year, month, 0).getDate();
};

// Convert YYYY-MM-DD or ISO string to DD/MM/YYYY without timezone shift
const isoToDisplay = (isoStr?: string): string => {
    if (!isoStr) return '';
    const dateOnly = isoStr.includes('T') ? isoStr.split('T')[0] : (isoStr.includes(' ') ? isoStr.split(' ')[0] : isoStr);
    const parts = dateOnly.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
        return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
    }
    // If it's already DD/MM/YYYY, return as is
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(isoStr)) {
        return isoStr;
    }
    return isoStr;
};

// Convert DD/MM/YYYY or 8-digit DDMMYYYY to YYYY-MM-DD with strict calendar validation
const displayToIso = (displayStr: string): { iso: string | null; error?: string } => {
    if (!displayStr || displayStr.trim() === '') {
        return { iso: null };
    }
    const clean = displayStr.replace(/[^0-9/.-]/g, '');
    let parts = clean.split(/[/.-]/);
    
    // Support 8 digits: 24072026 -> [24, 07, 2026]
    if (parts.length === 1 && clean.length === 8) {
        parts = [clean.slice(0, 2), clean.slice(2, 4), clean.slice(4, 8)];
    } else if (parts.length === 1 && clean.length === 6) {
        parts = [clean.slice(0, 2), clean.slice(2, 4), clean.slice(4, 6)];
    }

    if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        let year = parseInt(parts[2], 10);

        if (isNaN(day) || isNaN(month) || isNaN(year)) {
            return { iso: null, error: 'Ngày tháng không đúng định dạng số' };
        }

        // Support 2-digit years: 26 -> 2026, 95 -> 1995
        if (parts[2].length === 2) {
            year = year < 50 ? 2000 + year : 1900 + year;
        }

        if (year < 1900 || year > 2100) {
            return { iso: null, error: `Năm ${year} không hợp lệ (1900-2100)` };
        }

        if (month < 1 || month > 12) {
            return { iso: null, error: `Tháng ${month} không hợp lệ (1-12)` };
        }

        const maxDays = getDaysInMonth(month, year);
        if (day < 1 || day > maxDays) {
            return { iso: null, error: `Tháng ${month}/${year} chỉ có ${maxDays} ngày (bạn nhập ${day})` };
        }

        const yStr = String(year).padStart(4, '0');
        const mStr = String(month).padStart(2, '0');
        const dStr = String(day).padStart(2, '0');
        return { iso: `${yStr}-${mStr}-${dStr}` };
    }
    
    return { iso: null, error: 'Định dạng yêu cầu: ngày/tháng/năm (vd: 24/07/2026)' };
};

// Auto format raw digits as typing, e.g., 24072026 -> 24/07/2026
const autoFormatDateText = (rawStr: string): string => {
    let val = rawStr.replace(/[^0-9/.-]/g, '');
    const digitsOnly = val.replace(/[^0-9]/g, '');
    
    if (digitsOnly.length === 8 && !val.includes('/')) {
        const d = digitsOnly.slice(0, 2);
        const m = digitsOnly.slice(2, 4);
        const y = digitsOnly.slice(4, 8);
        return `${d}/${m}/${y}`;
    }

    return val;
};

export const FlexibleDateInput: React.FC<FlexibleDateInputProps> = ({
    value,
    onChange,
    label,
    placeholder = 'dd/mm/yyyy',
    className = '',
    inputClassName = '',
    size = 'md',
    showCalendarIcon = true,
    showTodayButton = false
}) => {
    const [textValue, setTextValue] = useState<string>(() => isoToDisplay(value));
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const datePickerRef = useRef<HTMLInputElement>(null);

    // Sync state when external value changes
    useEffect(() => {
        const expectedDisplay = isoToDisplay(value);
        if (expectedDisplay !== textValue) {
            const { iso: currentIso } = displayToIso(textValue);
            const newIso = value ? (value.includes('T') ? value.split('T')[0] : value) : '';
            if (currentIso !== newIso) {
                setTextValue(expectedDisplay);
                setErrorMsg(null);
            }
        }
    }, [value]);

    const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        const formatted = autoFormatDateText(raw);
        setTextValue(formatted);

        if (formatted.trim() === '') {
            setErrorMsg(null);
            onChange('');
            return;
        }

        const { iso, error } = displayToIso(formatted);
        if (iso) {
            setErrorMsg(null);
            onChange(iso);
        } else {
            // Only show error if the user typed enough characters (e.g. complete date attempted)
            if (formatted.length >= 8 || formatted.split(/[/.-]/).length >= 3) {
                setErrorMsg(error || 'Ngày không hợp lệ');
            } else {
                setErrorMsg(null);
            }
        }
    };

    const handleBlur = () => {
        if (textValue.trim() === '') {
            setTextValue('');
            setErrorMsg(null);
            onChange('');
            return;
        }

        const { iso, error } = displayToIso(textValue);
        if (iso) {
            setTextValue(isoToDisplay(iso));
            setErrorMsg(null);
            onChange(iso);
        } else {
            setErrorMsg(error || 'Ngày không hợp lệ');
        }
    };

    const handleNativeDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedIso = e.target.value; // YYYY-MM-DD
        if (selectedIso) {
            setTextValue(isoToDisplay(selectedIso));
            setErrorMsg(null);
            onChange(selectedIso);
        }
    };

    const setToday = () => {
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const d = String(today.getDate()).padStart(2, '0');
        const iso = `${y}-${m}-${d}`;
        setTextValue(`${d}/${m}/${y}`);
        setErrorMsg(null);
        onChange(iso);
    };

    const isoValue = value ? (value.includes('T') ? value.split('T')[0] : value) : '';

    const pyClass = size === 'sm' ? 'py-0.5 text-xs' : 'py-1.5 text-sm';
    const paddingClass = size === 'sm' ? (inputClassName?.includes('px-') ? '' : 'px-1 pr-6') : 'px-2.5 pr-9';
    const borderClass = errorMsg 
        ? 'border-red-400 bg-red-50/50 text-red-900 focus:ring-red-500' 
        : 'border-gray-300 bg-white text-gray-800 focus:ring-blue-500';

    return (
        <div className={`flex flex-col gap-0.5 ${className}`}>
            {label && (
                <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-700">{label}</label>
                    {showTodayButton && (
                        <button
                            type="button"
                            onClick={setToday}
                            className="text-[10px] text-blue-600 hover:text-blue-800 hover:underline font-medium"
                        >
                            Hôm nay
                        </button>
                    )}
                </div>
            )}
            <div className="relative flex items-center w-full">
                <input
                    type="text"
                    value={textValue}
                    onChange={handleTextChange}
                    onBlur={handleBlur}
                    placeholder={placeholder}
                    className={`w-full border rounded-lg ${paddingClass} ${pyClass} font-medium placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition-colors ${borderClass} ${inputClassName}`}
                    title={errorMsg || undefined}
                />
                
                {showCalendarIcon && (
                    <div className="absolute right-1 flex items-center justify-center p-1 text-gray-400 hover:text-blue-600 transition-colors rounded cursor-pointer">
                        <Calendar size={size === 'sm' ? 13 : 16} />
                        <input
                            type="date"
                            ref={datePickerRef}
                            value={isoValue}
                            onChange={handleNativeDateChange}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            title="Chọn từ lịch"
                            tabIndex={-1}
                        />
                    </div>
                )}
            </div>
            {errorMsg && (
                <span className="text-[11px] text-red-600 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                    <AlertCircle size={11} className="shrink-0" />
                    {errorMsg}
                </span>
            )}
        </div>
    );
};

export default FlexibleDateInput;

