import { useCallback, useEffect, useRef, useState } from 'react';
import { User } from '../types';
import { supabase, isConfigured } from '../services/supabaseClient';
import { getAuthenticatedAppUser } from '../services/authAccounts';

// A cached profile is display data; only Supabase Auth can restore a login.
export const useAuthenticatedUser = () => {
    const [currentUser, updateUser] = useState<User | null>(null);
    const generation = useRef(0);
    const lastActivity = Number(sessionStorage.getItem('last_activity_timestamp'));
    const expiredOnMount = useRef(lastActivity > 0 && Date.now() - lastActivity >= 60 * 60 * 1000);

    const setCurrentUser = useCallback((user: User | null) => {
        generation.current++;
        updateUser(user);
        if (!user && isConfigured) {
            void supabase.auth.signOut({ scope: 'local' }).catch(() => {});
        }
    }, []);

    useEffect(() => {
        if (!isConfigured) return;
        let disposed = false;
        let restoreTimer: ReturnType<typeof setTimeout> | undefined;
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (disposed) return;
            if (!session) {
                generation.current++;
                updateUser(null);
                return;
            }
            if (!['INITIAL_SESSION', 'SIGNED_IN', 'USER_UPDATED'].includes(event)) return;
            const request = ++generation.current;
            clearTimeout(restoreTimer);
            // Auth listeners run under the client's auth lock. Read the profile after releasing it.
            restoreTimer = setTimeout(async () => {
                if (disposed || request !== generation.current) return;
                if (event === 'INITIAL_SESSION' && expiredOnMount.current) {
                    setCurrentUser(null);
                    return;
                }
                try {
                    const user = await getAuthenticatedAppUser();
                    if (!disposed && request === generation.current) updateUser(user);
                } catch {
                    if (!disposed && request === generation.current) updateUser(null);
                }
            }, 0);
        });
        return () => {
            disposed = true;
            generation.current++;
            clearTimeout(restoreTimer);
            subscription.unsubscribe();
        };
    }, [setCurrentUser]);

    return { currentUser, setCurrentUser };
};
