
import { supabase, isConfigured } from './supabaseClient';
import { Message, ChatGroup } from '../types';
import { logError, sanitizeFileName } from './apiCore';

export const fetchChatGroups = async (): Promise<ChatGroup[]> => {
    if (!isConfigured) return [];
    try {
        const { data, error } = await supabase.from('chat_groups').select('*').order('created_at', { ascending: true });
        if (error) throw error;
        return data as ChatGroup[];
    } catch (error) {
        logError("fetchChatGroups", error);
        return [];
    }
};

export const createChatGroup = async (name: string, type: 'CUSTOM' | 'SYSTEM', creator: string, members: string[]): Promise<ChatGroup | null> => {
    if (!isConfigured) return null;
    try {
        const newGroup = {
            id: `GROUP_${Math.random().toString(36).substr(2, 9)}`,
            name,
            type,
            created_by: creator,
            members: members
        };
        const { data, error } = await supabase.from('chat_groups').insert([newGroup]).select();
        if (error) throw error;
        return data?.[0] as ChatGroup;
    } catch (error) {
        logError("createChatGroup", error);
        return null;
    }
};

export const deleteChatGroup = async (id: string): Promise<boolean> => {
    if (!isConfigured) return true;
    try {
        await supabase.from('messages').delete().eq('group_id', id);
        const { error } = await supabase.from('chat_groups').delete().eq('id', id);
        if (error) throw error;
        return true;
    } catch (error) {
        logError("deleteChatGroup", error);
        return false;
    }
};

export const addMemberToGroupApi = async (groupId: string, members: string[]): Promise<boolean> => {
    if (!isConfigured) return false;
    try {
        const { error } = await supabase.from('chat_groups').update({ members }).eq('id', groupId);
        if (error) throw error;
        return true;
    } catch (error) {
        logError("addMemberToGroupApi", error);
        return false;
    }
};

export const fetchMessages = async (limit: number = 50, groupId: string = 'GENERAL'): Promise<Message[]> => {
    if (!isConfigured) return [];
    try {
        let query = supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(limit);
        
        if (groupId === 'GENERAL') {
            query = query.or(`group_id.eq.GENERAL,group_id.is.null`);
        } else {
            query = query.eq('group_id', groupId);
        }

        const { data, error } = await query;
        if (error) throw error;
        return (data || []).reverse() as Message[];
    } catch (error) {
        logError("fetchMessages", error);
        return [];
    }
};

export const sendMessageApi = async (msg: Partial<Message>): Promise<boolean> => {
    if (!isConfigured) return false;
    try {
        const { error } = await supabase.from('messages').insert([msg]);
        if (error) throw error;
        return true;
    } catch (error) {
        logError("sendMessageApi", error);
        return false;
    }
};

export const toggleReactionApi = async (msgId: string, username: string, emoji: string): Promise<boolean> => {
    if (!isConfigured) return false;
    try {
        const { data, error: fetchError } = await supabase
            .from('messages')
            .select('reactions')
            .eq('id', msgId)
            .single();
            
        if (fetchError) throw fetchError;

        const currentReactions: Record<string, string> = data?.reactions || {};

        if (currentReactions[username] === emoji) {
            delete currentReactions[username];
        } else {
            currentReactions[username] = emoji;
        }

        const { error: updateError } = await supabase
            .from('messages')
            .update({ reactions: currentReactions })
            .eq('id', msgId);

        if (updateError) throw updateError;
        return true;
    } catch (error) {
        logError("toggleReactionApi", error);
        return false;
    }
};

export const deleteMessageApi = async (id: string): Promise<boolean> => {
    if (!isConfigured) return false;
    try {
        const { error } = await supabase.from('messages').delete().eq('id', id);
        if (error) throw error;
        return true;
    } catch (error) {
        logError("deleteMessageApi", error);
        return false;
    }
};

export const uploadChatFile = async (file: File): Promise<string | null> => {
    if (!isConfigured) return null;
    try {
        const fileName = `${Date.now()}_${sanitizeFileName(file.name)}`;
        const { data, error } = await supabase.storage.from('chat-files').upload(fileName, file);
        if (error) throw error;
        
        const { data: publicData } = supabase.storage.from('chat-files').getPublicUrl(fileName);
        return publicData.publicUrl;
    } catch (error) {
        logError("uploadChatFile", error);
        return null;
    }
};
