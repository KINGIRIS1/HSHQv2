import { useCallback, useEffect, useRef, useState } from 'react';
import { User } from '../types';
import { supabase, isConfigured } from '../services/supabaseClient';
import { getAuthenticatedAppUser } from '../services/authAccounts';

// Hỗ trợ đồng thời cả Supabase Auth và Session đăng nhập người dùng nội bộ
export const useAuthenticatedUser = () => {
    const [currentUser, updateUser] = useState<User | null>(() => {
        try {
            if (typeof sessionStorage !== 'undefined') {
                const saved = sessionStorage.getItem('current_user_session');
                if (saved) {
                    const lastActivity = Number(sessionStorage.getItem('last_activity_timestamp'));
                    const SIXTY_MINUTES_MS = 60 * 60 * 1000;
                    if (lastActivity && Date.now() - lastActivity < SIXTY_MINUTES_MS) {
                        return JSON.parse(saved);
                    } else if (lastActivity) {
                        sessionStorage.removeItem('current_user_session');
                        sessionStorage.removeItem('last_activity_timestamp');
                    }
                }
            }
        } catch {}
        return null;
    });
    const generation = useRef(0);

    const setCurrentUser = useCallback((user: User | null) => {
        generation.current++;
        updateUser(user);
        if (typeof sessionStorage !== 'undefined') {
            if (user) {
                sessionStorage.setItem('current_user_session', JSON.stringify(user));
                sessionStorage.setItem('last_activity_timestamp', String(Date.now()));
            } else {
                sessionStorage.removeItem('current_user_session');
                sessionStorage.removeItem('last_activity_timestamp');
            }
        }
        if (!user && isConfigured) {
            void supabase.auth.signOut({ scope: 'local' }).catch(() => {});
        }
    }, []);

    useEffect(() => {
        if (!isConfigured) return;
        let disposed = false;
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (disposed) return;
            if (session?.user) {
                try {
                    const user = await getAuthenticatedAppUser();
                    if (!disposed && user) {
                        setCurrentUser(user);
                    }
                } catch {}
            }
        });
        return () => {
            disposed = true;
            subscription.unsubscribe();
        };
    }, [setCurrentUser]);

    return { currentUser, setCurrentUser };
};
