import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';

export interface AutoResizeTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    minRows?: number;
    maxRows?: number;
}

export const AutoResizeTextarea = forwardRef<HTMLTextAreaElement, AutoResizeTextareaProps>(({
    value,
    minRows = 1,
    className = '',
    onChange,
    onInput,
    rows = 1,
    style,
    ...props
}, ref) => {
    const internalRef = useRef<HTMLTextAreaElement | null>(null);

    useImperativeHandle(ref, () => internalRef.current as HTMLTextAreaElement);

    const adjustHeight = () => {
        const el = internalRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
    };

    useEffect(() => {
        adjustHeight();
    }, [value]);

    return (
        <textarea
            ref={internalRef}
            rows={minRows}
            value={value}
            onChange={(e) => {
                adjustHeight();
                if (onChange) onChange(e);
            }}
            onInput={(e) => {
                adjustHeight();
                if (onInput) onInput(e);
            }}
            className={`resize-none overflow-hidden transition-all duration-100 ${className}`}
            style={{
                minHeight: '36px',
                ...style
            }}
            {...props}
        />
    );
});

AutoResizeTextarea.displayName = 'AutoResizeTextarea';
export default AutoResizeTextarea;
