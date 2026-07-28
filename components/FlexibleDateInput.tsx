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

// Convert DD/MM/YYYY to YYYY-MM-DD
const displayToIso = (displayStr: string): string | null => {
    const clean = displayStr.replace(/[^0-9/]/g, '');
    const parts = clean.split('/');
    if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const year = parseInt(parts[2], 10);

        if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
            const yStr = String(year).padStart(4, '0');
            const mStr = String(month).padStart(2, '0');
            const dStr = String(day).padStart(2, '0');
            return `${yStr}-${mStr}-${dStr}`;
        }
    }
    return null;
};

// Auto format raw digits as typing, e.g., 01052025 -> 01/05/2025
const autoFormatDateText = (rawStr: string): string => {
    // Only allow numbers and slashes
    let val = rawStr.replace(/[^0-9/]/g, '');
    
    // If user typed digits without slashes, e.g. 01052025
    const digitsOnly = val.replace(/\//g, '');
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

    const pyClass = size === 'sm' ? 'py-1 text-xs' : 'py-1.5 text-sm';

    return (
        <div className={`flex flex-col gap-1 ${className}`}>
            {label && <label className="text-xs font-bold text-gray-700">{label}</label>}
            <div className="relative flex items-center">
                <input
                    type="text"
                    value={textValue}
                    onChange={handleTextChange}
                    onBlur={handleBlur}
                    placeholder={placeholder}
                    className={`w-full bg-white border border-gray-300 rounded-lg px-2.5 ${pyClass} pr-8 font-medium text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${inputClassName}`}
                />
                
                {showCalendarIcon && (
                    <button
                        type="button"
                        onClick={triggerDatePicker}
                        className="absolute right-2 text-gray-400 hover:text-blue-600 transition-colors p-0.5 rounded cursor-pointer"
                        title="Chọn từ lịch"
                    >
                        <Calendar size={size === 'sm' ? 14 : 16} />
                    </button>
                )}

                {/* Hidden native date picker */}
                <input
                    type="date"
                    ref={datePickerRef}
                    value={isoValue}
                    onChange={handleNativeDateChange}
                    className="sr-only pointer-events-none absolute opacity-0 w-0 h-0"
                    tabIndex={-1}
                />
            </div>
        </div>
    );
};

export default FlexibleDateInput;
