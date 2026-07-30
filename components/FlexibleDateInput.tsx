import React, { useState, useEffect, useRef } from 'react';
import { Calendar } from 'lucide-react';

interface FlexibleDateInputProps {
    value?: string; // YYYY-MM-DD or ISO string
    onChange: (isoDateStr: string) => void;
    label?: string;
    placeholder?: string;
    className?: string;
    inputClassName?: string;
    size?: 'sm' | 'md';
    showCalendarIcon?: boolean;
}

// Convert YYYY-MM-DD to DD/MM/YYYY
const isoToDisplay = (isoStr?: string): string => {
    if (!isoStr) return '';
    const dateOnly = isoStr.includes('T') ? isoStr.split('T')[0] : isoStr;
    const parts = dateOnly.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
        return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
    }
    return isoStr;
};

// Convert DD/MM/YYYY or 8-digit DDMMYYYY to YYYY-MM-DD
const displayToIso = (displayStr: string): string | null => {
    const clean = displayStr.replace(/[^0-9/]/g, '');
    let parts = clean.split('/');
    if (parts.length === 1 && clean.length === 8) {
        parts = [clean.slice(0, 2), clean.slice(2, 4), clean.slice(4, 8)];
    } else if (parts.length === 1 && clean.length === 6) {
        parts = [clean.slice(0, 2), clean.slice(2, 4), clean.slice(4, 6)];
    }
    if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        let year = parseInt(parts[2], 10);
        if (parts[2].length === 2) {
            year = year < 50 ? 2000 + year : 1900 + year;
        }

        if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
            const yStr = String(year).padStart(4, '0');
            const mStr = String(month).padStart(2, '0');
            const dStr = String(day).padStart(2, '0');
            return `${yStr}-${mStr}-${dStr}`;
        }
    }
    return null;
};

// Auto format raw digits as typing, e.g., 30072026 -> 30/07/2026
const autoFormatDateText = (rawStr: string): string => {
    let val = rawStr.replace(/[^0-9/]/g, '');
    const digitsOnly = val.replace(/\//g, '');
    
    if (digitsOnly.length >= 8) {
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
    showCalendarIcon = true
}) => {
    const [textValue, setTextValue] = useState<string>(() => isoToDisplay(value));
    const datePickerRef = useRef<HTMLInputElement>(null);

    // Sync state when external value changes
    useEffect(() => {
        const expectedDisplay = isoToDisplay(value);
        if (expectedDisplay !== textValue) {
            // Only update if current text doesn't already map to the same ISO
            const currentIso = displayToIso(textValue);
            const newIso = value ? (value.includes('T') ? value.split('T')[0] : value) : '';
            if (currentIso !== newIso) {
                setTextValue(expectedDisplay);
            }
        }
    }, [value]);

    const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        const formatted = autoFormatDateText(raw);
        setTextValue(formatted);

        const iso = displayToIso(formatted);
        if (iso) {
            onChange(iso);
        } else if (formatted === '') {
            onChange('');
        }
    };

    const handleBlur = () => {
        const iso = displayToIso(textValue);
        if (iso) {
            setTextValue(isoToDisplay(iso));
            onChange(iso);
        } else if (textValue.trim() === '') {
            setTextValue('');
            onChange('');
        }
    };

    const handleNativeDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedIso = e.target.value; // YYYY-MM-DD
        if (selectedIso) {
            setTextValue(isoToDisplay(selectedIso));
            onChange(selectedIso);
        }
    };

    const triggerDatePicker = () => {
        if (datePickerRef.current) {
            if ('showPicker' in HTMLInputElement.prototype) {
                try {
                    datePickerRef.current.showPicker();
                } catch {
                    datePickerRef.current.click();
                }
            } else {
                datePickerRef.current.click();
            }
        }
    };

    const isoValue = value ? (value.includes('T') ? value.split('T')[0] : value) : '';

    const pyClass = size === 'sm' ? 'py-0.5 text-xs' : 'py-1.5 text-sm';
    const paddingClass = size === 'sm' ? (inputClassName?.includes('px-') ? '' : 'px-1 pr-4') : 'px-2.5 pr-8';

    return (
        <div className={`flex flex-col gap-1 ${className}`}>
            {label && <label className="text-xs font-bold text-gray-700">{label}</label>}
            <div className="relative flex items-center w-full">
                <input
                    type="text"
                    value={textValue}
                    onChange={handleTextChange}
                    onBlur={handleBlur}
                    placeholder={placeholder}
                    className={`w-full bg-white border border-gray-300 rounded-lg ${paddingClass} ${pyClass} font-medium text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${inputClassName}`}
                />
                
                {showCalendarIcon && (
                    <div className="absolute right-0.5 flex items-center justify-center p-0.5 text-gray-400 hover:text-blue-600 transition-colors rounded cursor-pointer">
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
        </div>
    );
};

export default FlexibleDateInput;
