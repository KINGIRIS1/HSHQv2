import { useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { ArchiveRecord, mapLuutruDbToArchiveRecord, mapDangkyRecordToArchiveRecord } from '../services/apiArchive';

export const useArchiveRealtime = (type: string, setRecords: React.Dispatch<React.SetStateAction<ArchiveRecord[]>>) => {
    useEffect(() => {
        if (!supabase) return;

        const tableName = type === 'vaoso' ? 'dangky_records' : 'luutru_records';
        const mapper = type === 'vaoso' ? mapDangkyRecordToArchiveRecord : mapLuutruDbToArchiveRecord;

        const channel = supabase.channel(`${tableName}_${type}_changes`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: tableName },
                (payload) => {
                    const mapped = mapper(payload.new);
                    if (type !== 'vaoso' && mapped.type !== type) return;
                    setRecords(prev => {
                        if (prev.some(r => r.id === mapped.id)) return prev;
                        return [mapped, ...prev];
                    });
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: tableName },
                (payload) => {
                    const mapped = mapper(payload.new);
                    setRecords(prev => {
                        if (type !== 'vaoso' && mapped.type !== type) {
                            return prev.filter(r => r.id !== mapped.id);
                        }
                        const exists = prev.some(r => r.id === mapped.id);
                        if (!exists) {
                            return [mapped, ...prev];
                        }
                        return prev.map(r => r.id === mapped.id ? mapped : r);
                    });
                }
            )
            .on(
                'postgres_changes',
                { event: 'DELETE', schema: 'public', table: tableName },
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
