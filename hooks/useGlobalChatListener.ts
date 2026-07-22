import React, { useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { User, Message } from '../types';

export const useGlobalChatListener = (
    currentUser: User | null,
    currentView: string,
    notificationEnabled: boolean,
    setUnreadMessages: React.Dispatch<React.SetStateAction<number>>
) => {
    useEffect(() => {
        if (!currentUser) return;
        
        const channel = supabase
            .channel('global-chat-listener')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload: any) => {
                const newMsg = payload.new as Message;
                
                // Không thông báo tin nhắn của chính mình
                if (newMsg.sender_username === currentUser.username) return;
                
                // Nếu đang không ở màn hình chat, tăng số tin chưa đọc
                if (currentView !== 'internal_chat') {
                    setUnreadMessages(prev => prev + 1);
                }

                // Hiển thị thông báo Desktop nếu được bật
                if (notificationEnabled && window.electronAPI && window.electronAPI.showNotification) {
                    const title = `Tin nhắn từ ${newMsg.sender_name}`;
                    const body = newMsg.content || (newMsg.file_name ? `[File] ${newMsg.file_name}` : '[Hình ảnh]');
                    window.electronAPI.showNotification(title, body);
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [currentUser, currentView, notificationEnabled, setUnreadMessages]);
};