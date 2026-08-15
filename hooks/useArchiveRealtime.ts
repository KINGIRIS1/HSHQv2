import { useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { ArchiveRecord, mapLuutruDbToArchiveRecord } from '../services/apiArchive';

export const useArchiveRealtime = (type: string, setRecords: React.Dispatch<React.SetStateAction<ArchiveRecord[]>>) => {
    useEffect(() => {
        if (!supabase) return;

        const channel = supabase.channel(`luutru_records_${type}_changes`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'luutru_records' },
                (payload) => {
                    const mapped = mapLuutruDbToArchiveRecord(payload.new);
                    if (mapped.type !== type) return;
                    setRecords(prev => {
                        if (prev.some(r => r.id === mapped.id)) return prev;
                        return [mapped, ...prev];
                    });
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'luutru_records' },
                (payload) => {
                    const mapped = mapLuutruDbToArchiveRecord(payload.new);
                    setRecords(prev => {
                        if (mapped.type !== type) {
                            return prev.filter(r => r.id !== mapped.id);
                        }
                        return prev.map(r => r.id === mapped.id ? mapped : r);
                    });
                }
            )
            .on(
                'postgres_changes',
                { event: 'DELETE', schema: 'public', table: 'luutru_records' },
                (payload) => {
                    setRecords(prev => prev.filter(r => r.id !== payload.old.id));
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [type, setRecords]);
};
