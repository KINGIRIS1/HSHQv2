import { useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { ArchiveRecord } from '../services/apiArchive';

export const useArchiveRealtime = (type: string, setRecords: React.Dispatch<React.SetStateAction<ArchiveRecord[]>>) => {
    useEffect(() => {
        if (!supabase) return;

        const channel = supabase.channel(`archive_records_${type}_changes`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'archive_records', filter: `type=eq.${type}` },
                (payload) => {
                    setRecords(prev => {
                        if (prev.some(r => r.id === payload.new.id)) return prev;
                        // Put new record at the top
                        return [payload.new as ArchiveRecord, ...prev];
                    });
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'archive_records', filter: `type=eq.${type}` },
                (payload) => {
                    setRecords(prev => prev.map(r => r.id === payload.new.id ? { ...r, ...payload.new } as ArchiveRecord : r));
                }
            )
            .on(
                'postgres_changes',
                { event: 'DELETE', schema: 'public', table: 'archive_records' },
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
