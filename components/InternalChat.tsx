
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { User, Message, ChatGroup, UserRole, Employee } from '../types';
import { fetchMessages, sendMessageApi, uploadChatFile, fetchChatGroups, createChatGroup, deleteChatGroup, deleteMessageApi, addMemberToGroupApi, toggleReactionApi } from '../services/api';
import { supabase } from '../services/supabaseClient';
import { Send, Paperclip, File as FileIcon, X, Loader2, Image as ImageIcon, Download, Hash, MapPin, Plus, Trash2, Users, Monitor, Camera, UserPlus, Shield, Crop, Smile, Reply, ZoomIn, ArrowLeft } from 'lucide-react';
import ScreenshotCropper from './ScreenshotCropper';
import { confirmAction } from '../utils/appHelpers';

// ... (Giữ nguyên phần định nghĩa interface Window và MessageItem component không thay đổi) ...
declare global {
  interface Window {
    electronAPI?: {
      captureScreenshot: (options?: { hideWindow: boolean }) => Promise<string>;
      openExternal: (url: string) => Promise<void>;
      saveAndOpenFile: (data: { fileName: string; base64Data: string; outputFolder?: string | null }) => Promise<{ success: boolean; path?: string; message?: string }>;
      openFilePath: (path: string) => Promise<boolean>;
      selectFolder: () => Promise<string | null>;
      checkForUpdate: (serverUrl: string) => Promise<any>;
      downloadUpdate: () => Promise<void>;
      quitAndInstall: () => Promise<void>;
      onUpdateStatus: (callback: (data: any) => void) => void;
      removeUpdateListener: () => void;
      showNotification: (title: string, body: string) => Promise<boolean>;
      onNavigateToView: (callback: (viewId: string) => void) => void;
      removeNavigationListener: () => void;
      showConfirmDialog: (message: string, title?: string) => Promise<boolean>;
    };
  }
}

const normalizeStr = (str: string) => str ? str.toLowerCase().trim() : '';

const EMOJI_LIST = [
  "👍", "❤️", "😆", "😮", "😢", "😡",
  "😀", "😁", "😂", "🤣", "😃", "😅", "😉", "😊", "😋", "😎", "😍", "😘", "🥰", "😗", "🙂", "🤗", "🤔", "😐", "😑", "😶", "🙄", "😏", "😥", "🤐", "😯", "😪", "😫", "😴", "😌", "😛", "😜", "😝", "🤤", "😒", "😥", "😔", "😕", "🙃", "🤑", "😲", "☹️", "🙁", "😖", "😞", "😤", "😭", "frowning", "anguished", "fearful", "weary", "exploding_head", "grimacing", "anxious", "scream", "flushed", "crazy", "rage", "mask", "sick", "shushing_face", 
  "👌", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆", "👇", "✋", "👋", "👏", "🙌", "👐", "🤲", "🤝", "🙏", "💪", "👀", "🧠", "👤", "👥",
  "🧡", "💛", "💚", "💙", "💜", "🖤", "💔", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💯", "💢", "💥", "💫", "💦", "💨", "🕳️",
  "📅", "✅", "❎", "❌", "🔥", "✨", "🌟", "⭐", "📝", "📁", "📂", "📌", "📍", "📎", "📏", "📐", "✂️", "🖊️", "💻", "📱", "☎️", "📞", "📷", "💡", "💰", "💵", "💸", "💳", "🔨", "🔧", "🏠", "🏢", "🏥", "🚗", "✈️", "🚀", "🚩", "🏁", "🎌", "☕", "🍺", "🍻", "🥂", "🥃", "🎉", "🎊", "🎁", "🎈"
];

const QUICK_REACTIONS = ["👍", "❤️", "😆", "😮", "😢", "😡"];

interface MessageItemProps {
    msg: Message;
    currentUser: User;
    isModerator: boolean;
    isSameSender: boolean;
    onReply: (msg: Message) => void;
    onReaction: (msgId: string, emoji: string) => void;
    onDelete: (msg: Message) => void;
    onViewImage: (url: string) => void;
}

const MessageItem = React.memo(({ msg, currentUser, isModerator, isSameSender, onReply, onReaction, onDelete, onViewImage }: MessageItemProps) => {
    const isMe = msg.sender_username === currentUser.username;
    const canDelete = isMe || isModerator;

    const formatTime = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} group/message`}>
            {!isMe && !isSameSender && (
                <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-xs font-bold text-gray-600 mr-2 shrink-0 self-end mb-1 border-2 border-white shadow-sm">
                    {msg.sender_name.charAt(0).toUpperCase()}
                </div>
            )}
            {!isMe && isSameSender && <div className="w-8 mr-2 shrink-0" />}

            <div className={`max-w-[75%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                {!isMe && !isSameSender && <span className="text-[10px] text-gray-500 mb-1 ml-1 font-medium">{msg.sender_name}</span>}
                
                <div className={`relative px-4 py-2 shadow-sm border transition-all hover:shadow-md
                    ${isMe 
                        ? 'bg-blue-600 text-white rounded-2xl rounded-tr-sm border-blue-500' 
                        : 'bg-white text-gray-800 rounded-2xl rounded-tl-sm border-gray-200'
                    }
                `}>
                    {/* REPLY BLOCK */}
                    {msg.reply_to_content && (
                        <div className={`text-xs mb-2 p-2 rounded-lg border-l-4 flex flex-col gap-1 cursor-pointer
                            ${isMe ? 'bg-blue-700/50 border-blue-300 text-blue-100' : 'bg-gray-100 border-gray-300 text-gray-600'}
                        `}>
                            <span className="font-bold flex items-center gap-1">
                                <Reply size={10} /> {msg.reply_to_sender}
                            </span>
                            <span className="italic truncate line-clamp-1">{msg.reply_to_content}</span>
                        </div>
                    )}

                    {/* CONTENT */}
                    {msg.content && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{msg.content}</p>}

                    {msg.file_url && (
                        <div className={`mt-2 rounded-lg overflow-hidden ${isMe ? '' : 'bg-gray-50 border border-gray-200'}`}>
                            {msg.file_type === 'image' ? (
                                <div 
                                    className="cursor-zoom-in relative group/img"
                                    onClick={() => onViewImage(msg.file_url!)}
                                >
                                    <img src={msg.file_url} alt="attachment" className="max-w-full max-h-[300px] object-cover rounded-lg" loading="lazy" />
                                    <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 transition-colors flex items-center justify-center">
                                        <ZoomIn className="text-white opacity-0 group-hover/img:opacity-100 drop-shadow-md" />
                                    </div>
                                </div>
                            ) : (
                                <div className={`p-2 flex items-center gap-3 ${isMe ? 'bg-blue-700 text-white' : 'text-gray-700'}`}>
                                    <FileIcon size={24} />
                                    <div className="overflow-hidden">
                                        <p className="text-xs font-bold truncate max-w-[150px]">{msg.file_name}</p>
                                        <a 
                                            href={msg.file_url} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className={`text-[10px] hover:underline flex items-center gap-1 ${isMe ? 'text-blue-200' : 'text-blue-600'}`}
                                        >
                                            <Download size={10} /> Tải xuống
                                        </a>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {/* TIMESTAMP */}
                    <span className={`text-[9px] block text-right mt-1 opacity-70`}>
                        {formatTime(msg.created_at)}
                    </span>

                    {/* REACTIONS DISPLAY */}
                    {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                        <div className={`absolute -bottom-3 ${isMe ? 'right-0' : 'left-0'} flex -space-x-1`}>
                            <div className="bg-white border border-gray-200 shadow-sm rounded-full px-1.5 py-0.5 flex items-center gap-0.5 text-[10px]">
                                {Object.entries(msg.reactions).slice(0, 3).map(([usr, reaction], idx) => (
                                    <span key={idx} title={usr}>{reaction}</span>
                                ))}
                                {Object.keys(msg.reactions).length > 3 && <span className="text-gray-500 font-bold">+{Object.keys(msg.reactions).length - 3}</span>}
                            </div>
                        </div>
                    )}

                    {/* HOVER ACTIONS */}
                    <div className={`absolute -top-8 ${isMe ? 'right-0' : 'left-0'} flex items-center gap-1 bg-white shadow-lg rounded-full p-1 opacity-0 group-hover/message:opacity-100 transition-opacity z-20 border border-gray-200 scale-90`}>
                        <button onClick={() => onReply(msg)} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-600" title="Trả lời">
                            <Reply size={14} />
                        </button>
                        
                        <div className="flex items-center border-l border-gray-200 pl-1 ml-1 gap-1">
                            {QUICK_REACTIONS.slice(0, 3).map(emoji => (
                                <button key={emoji} onClick={() => onReaction(msg.id, emoji)} className="hover:scale-125 transition-transform text-sm">{emoji}</button>
                            ))}
                        </div>

                        {canDelete && (
                            <button 
                                onClick={() => onDelete(msg)} 
                                className={`p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-full border-l border-gray-200 ml-1 ${!isMe ? 'bg-red-50 text-red-400' : ''}`} 
                                title={isMe ? "Thu hồi" : "Xóa tin nhắn (Quản trị)"}
                            >
                                <Trash2 size={14} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}, (prev, next) => {
    return prev.msg === next.msg && prev.isSameSender === next.isSameSender && prev.currentUser.username === next.currentUser.username;
});

interface InternalChatProps {
  currentUser: User;
  wards: string[];
  employees: Employee[];
  users: User[];
  onResetUnread?: () => void;
  notificationEnabled?: boolean;
}

const InternalChat: React.FC<InternalChatProps> = ({ currentUser, wards = [], employees, users, onResetUnread, notificationEnabled = true }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  
  const [currentGroupId, setCurrentGroupId] = useState<string>('GENERAL');
  const [customGroups, setCustomGroups] = useState<ChatGroup[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  
  // Mobile View Logic
  const [showMobileList, setShowMobileList] = useState(true);

  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [targetGroupForAdd, setTargetGroupForAdd] = useState<ChatGroup | null>(null);

  const [screenshotImg, setScreenshotImg] = useState<string | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [isScreenshotMenuOpen, setIsScreenshotMenuOpen] = useState(false); 

  const [isEmojiOpen, setIsEmojiOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const screenshotMenuRef = useRef<HTMLDivElement>(null); 
  const emojiMenuRef = useRef<HTMLDivElement>(null); 
  const textareaRef = useRef<HTMLTextAreaElement>(null); 

  const isAdmin = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUBADMIN;
  const isModerator = isAdmin || currentUser.role === UserRole.TEAM_LEADER;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
      if (onResetUnread) onResetUnread();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // ... (Giữ nguyên các useEffect khác)

  useEffect(() => { loadGroups(); }, []);

  const loadGroups = async () => {
      const groups = await fetchChatGroups();
      setCustomGroups(groups);
  };

  useEffect(() => {
    const loadMessages = async () => {
      setLoading(true);
      const data = await fetchMessages(50, currentGroupId);
      setMessages(data);
      setLoading(false);
      setReplyingTo(null); 
    };

    loadMessages();

    // ... (Giữ nguyên logic subscription) ...
    const channel = supabase
      .channel(`chat:${currentGroupId}`)
      .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'messages'
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
            const newMsg = payload.new as Message;
            let shouldAdd = false;
            if (currentGroupId === 'GENERAL') {
                if (!newMsg.group_id || newMsg.group_id === 'GENERAL') shouldAdd = true;
            } else {
                if (newMsg.group_id === currentGroupId) shouldAdd = true;
            }

            if (shouldAdd) {
                setMessages(prev => [...prev, newMsg]);
            }
        } 
        else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id;
            setMessages(prev => prev.filter(m => m.id !== deletedId));
        }
        else if (payload.eventType === 'UPDATE') {
            const updatedMsg = payload.new as Message;
            setMessages(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentGroupId]);

  // ... (Giữ nguyên các handlers: handleReply, handleReaction, handleSend, v.v...)
  
  const handleReply = useCallback((msg: Message) => {
      setReplyingTo(msg);
      textareaRef.current?.focus();
  }, []);

  const handleReaction = useCallback(async (msgId: string, emoji: string) => {
      await toggleReactionApi(msgId, currentUser.username, emoji);
  }, [currentUser.username]);

  const handleRecallMessage = useCallback(async (msg: Message) => {
      const isMine = msg.sender_username === currentUser.username;
      let confirmMessage = "Bạn có chắc chắn muốn thu hồi tin nhắn này?";
      if (!isMine) {
          confirmMessage = `[QUẢN TRỊ] Bạn có chắc chắn muốn xóa tin nhắn của ${msg.sender_name}?`;
      }
      if (await confirmAction(confirmMessage)) {
          if (textareaRef.current) textareaRef.current.focus();
          await deleteMessageApi(msg.id);
      }
  }, [currentUser.username]);

  const handleViewImage = useCallback((url: string) => {
      setLightboxImage(url);
  }, []);

  // --- Handlers for Groups & Input ---
  
  const handleGroupSelect = (groupId: string) => {
      setCurrentGroupId(groupId);
      setShowMobileList(false); // Switch to Chat View on Mobile
  };

  const handleBackToList = () => {
      setShowMobileList(true);
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!newMessage.trim() && !file) || sending) return;

    setSending(true);
    let fileUrl = '';
    let fileType = '';

    try {
        if (file) {
            const url = await uploadChatFile(file);
            if (!url) { setSending(false); return; }
            fileUrl = url;
            const ext = file.name.split('.').pop()?.toLowerCase();
            if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) fileType = 'image';
            else fileType = 'document';
        }

        let replyData = {};
        if (replyingTo) {
            replyData = {
                reply_to_id: replyingTo.id,
                reply_to_content: replyingTo.content || (replyingTo.file_name ? `[File] ${replyingTo.file_name}` : '[Hình ảnh]'),
                reply_to_sender: replyingTo.sender_name
            };
        }

        await sendMessageApi({
            sender_username: currentUser.username,
            sender_name: currentUser.name,
            content: newMessage,
            file_url: fileUrl || undefined,
            file_name: file ? file.name : undefined,
            file_type: fileType || undefined,
            group_id: currentGroupId,
            ...replyData
        });

        setNewMessage('');
        setFile(null);
        setReplyingTo(null); 
    } catch (error) {
        console.error(error);
        alert("Gửi thất bại.");
    } finally {
        setSending(false);
    }
  };

  // ... (Giữ nguyên các handler Create Group, Delete Group, Members...)
  const handleCreateGroup = async () => {
      if (!newGroupName.trim()) return;
      const group = await createChatGroup(newGroupName, 'CUSTOM', currentUser.username, [currentUser.username]);
      if (group) {
          setCustomGroups(prev => [...prev, group]);
          setNewGroupName('');
          setIsCreatingGroup(false);
      }
  };

  const handleDeleteGroup = async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isAdmin) return;
      if (await confirmAction("Xóa nhóm chat này?")) {
          const success = await deleteChatGroup(id);
          if (success) {
              setCustomGroups(prev => prev.filter(g => g.id !== id));
              if (currentGroupId === id) setCurrentGroupId('GENERAL');
          }
      }
  };

  const openAddMemberModal = (group: ChatGroup, e: React.MouseEvent) => {
      e.stopPropagation();
      setTargetGroupForAdd(group);
      setIsAddMemberModalOpen(true);
  };

  const handleAddMember = async (username: string) => {
      if (!targetGroupForAdd || !isAdmin) return;
      const currentMembers = targetGroupForAdd.members || [];
      if (currentMembers.includes(username)) return; 
      const newMembers = [...currentMembers, username];
      const success = await addMemberToGroupApi(targetGroupForAdd.id, newMembers);
      if (success) {
          const updatedGroup = { ...targetGroupForAdd, members: newMembers };
          setCustomGroups(prev => prev.map(g => g.id === targetGroupForAdd.id ? updatedGroup : g));
          setTargetGroupForAdd(updatedGroup);
      }
  };

  const handleRemoveMember = async (username: string) => {
      if (!targetGroupForAdd || !isAdmin) return;
      const newMembers = (targetGroupForAdd.members || []).filter(m => m !== username);
      const success = await addMemberToGroupApi(targetGroupForAdd.id, newMembers);
       if (success) {
          const updatedGroup = { ...targetGroupForAdd, members: newMembers };
          setCustomGroups(prev => prev.map(g => g.id === targetGroupForAdd.id ? updatedGroup : g));
          setTargetGroupForAdd(updatedGroup);
      }
  };

  const handleInsertEmoji = (emoji: string) => {
      const input = textareaRef.current;
      if (input) {
          const start = input.selectionStart;
          const end = input.selectionEnd;
          const text = newMessage;
          const before = text.substring(0, start);
          const after = text.substring(end, text.length);
          setNewMessage(before + emoji + after);
          setTimeout(() => {
              input.selectionStart = input.selectionEnd = start + emoji.length;
              input.focus();
          }, 0);
      } else {
          setNewMessage(prev => prev + emoji);
      }
  };

  // ... (Other handlers like paste, screenshot...)
  const handlePaste = (e: React.ClipboardEvent) => {
      if (e.clipboardData.files && e.clipboardData.files.length > 0) {
          const pastedFile = e.clipboardData.files[0];
          if (pastedFile.type.startsWith('image/')) {
              e.preventDefault();
              setFile(pastedFile);
          }
      }
  };

  const handleScreenshot = async (hideWindow: boolean) => {
      if (sending) return;
      try {
          if (window.electronAPI && window.electronAPI.captureScreenshot) {
              const dataUrl = await window.electronAPI.captureScreenshot({ hideWindow });
              if (dataUrl) {
                  setScreenshotImg(dataUrl);
                  setIsCropping(true);
              } else {
                  alert("Không chụp được màn hình.");
              }
          } else {
               alert("Chức năng này yêu cầu App Desktop (Electron).");
          }
      } catch (err: any) {
          console.error(err);
      }
  };

  const handleCropConfirm = (blob: Blob) => {
      const timestamp = new Date().toISOString().replace(/-/g, "").replace(/:/g, "").replace(/\./g, "");
      const screenshotFile = new File([blob], `Screenshot_${timestamp}.png`, { type: 'image/png' });
      setFile(screenshotFile);
      setScreenshotImg(null);
      setIsCropping(false);
  };

  const handleCropCancel = () => {
      setScreenshotImg(null);
      setIsCropping(false);
  };

  const myCustomGroups = useMemo(() => {
      if (isAdmin) return customGroups;
      return customGroups.filter(g => {
          if (!g.members || g.members.length === 0) return true; 
          if (g.created_by === currentUser.username) return true;
          if (g.members.includes(currentUser.username)) return true;
          return false;
      });
  }, [customGroups, currentUser, isAdmin]);

  const visibleWards = useMemo(() => {
      if (isAdmin) return wards;
      const currentEmp = employees.find(e => e.id === currentUser.employeeId);
      if (!currentEmp || !currentEmp.managedWards) return [];
      const empWardsNormalized = currentEmp.managedWards.map(normalizeStr);
      return wards.filter(w => empWardsNormalized.includes(normalizeStr(w)));
  }, [wards, currentUser, employees, isAdmin]);

  return (
    <div className="flex h-full bg-gray-50 rounded-xl overflow-hidden shadow-sm border border-gray-200 relative">
      
      {/* CROPPER OVERLAY */}
      {isCropping && screenshotImg && (
          <ScreenshotCropper 
              imageSrc={screenshotImg}
              onConfirm={handleCropConfirm}
              onCancel={handleCropCancel}
          />
      )}

      {/* LIGHTBOX OVERLAY */}
      {lightboxImage && (
          <div className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setLightboxImage(null)}>
              <button className="absolute top-4 right-4 text-white hover:text-red-500 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all">
                  <X size={32} />
              </button>
              <img 
                  src={lightboxImage} 
                  alt="Lightbox" 
                  className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-fade-in" 
                  onClick={(e) => e.stopPropagation()} 
              />
          </div>
      )}

      {/* SIDEBAR (LIST GROUPS) */}
      <div className={`w-full md:w-64 bg-white border-r border-gray-200 flex-col md:flex ${showMobileList ? 'flex' : 'hidden'} h-full absolute md:static z-20`}>
          <div className="p-4 border-b border-gray-200 bg-gray-50">
              <h3 className="font-bold text-gray-700 flex items-center gap-2">
                  <Hash size={18} className="text-blue-600"/> Nhóm Chat
              </h3>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
              <button 
                  onClick={() => handleGroupSelect('GENERAL')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${currentGroupId === 'GENERAL' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`}
              >
                  <Users size={16} /> Chung
              </button>

              {visibleWards.length > 0 && (
                  <div className="mt-4 mb-1 px-3 text-xs font-bold text-gray-400 uppercase">Khu vực / Xã Phường</div>
              )}
              {visibleWards.map(ward => {
                  const wardGroupId = `WARD_${ward}`; 
                  return (
                    <button 
                        key={ward}
                        onClick={() => handleGroupSelect(wardGroupId)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${currentGroupId === wardGroupId ? 'bg-green-100 text-green-700' : 'text-gray-700 hover:bg-gray-100'}`}
                    >
                        <MapPin size={16} /> {ward}
                    </button>
                  );
              })}

              <div className="mt-4 mb-1 px-3 flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-400 uppercase">Nhóm tùy chỉnh</span>
                  {isAdmin && (
                      <button onClick={() => setIsCreatingGroup(!isCreatingGroup)} className="text-gray-400 hover:text-blue-600"><Plus size={14} /></button>
                  )}
              </div>
              
              {isCreatingGroup && (
                  <div className="px-2 mb-2">
                      <div className="flex gap-1">
                          <input 
                              type="text" 
                              className="w-full border rounded px-2 py-1 text-xs outline-none focus:border-blue-500"
                              placeholder="Tên nhóm..."
                              value={newGroupName}
                              onChange={e => setNewGroupName(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && handleCreateGroup()}
                              autoFocus
                          />
                          <button onClick={handleCreateGroup} className="bg-blue-600 text-white px-2 rounded text-xs"><Plus size={12} /></button>
                      </div>
                  </div>
              )}

              {myCustomGroups.map(group => (
                  <button 
                    key={group.id}
                    onClick={() => handleGroupSelect(group.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors text-sm font-medium group relative ${currentGroupId === group.id ? 'bg-purple-100 text-purple-700' : 'text-gray-700 hover:bg-gray-100'}`}
                  >
                    <div className="flex items-center gap-2 truncate">
                        <Hash size={16} /> <span className="truncate">{group.name}</span>
                    </div>
                    {isAdmin && (
                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <span onClick={(e) => openAddMemberModal(group, e)} className="p-1 text-gray-400 hover:text-blue-600" title="Thêm thành viên">
                                <UserPlus size={12} />
                            </span>
                            <span onClick={(e) => handleDeleteGroup(group.id, e)} className="p-1 text-gray-400 hover:text-red-500" title="Xóa nhóm">
                                <Trash2 size={12} />
                            </span>
                        </div>
                    )}
                  </button>
              ))}
          </div>
      </div>

      {/* CHAT AREA */}
      <div className={`flex-1 flex flex-col h-full overflow-hidden bg-[#e5e7eb] ${showMobileList ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 bg-white border-b border-gray-200 flex justify-between items-center shadow-sm z-10 shrink-0">
            <div className="flex items-center gap-3">
                {/* Back Button for Mobile */}
                <button 
                    onClick={handleBackToList}
                    className="md:hidden p-2 rounded-full hover:bg-gray-100 text-gray-600"
                >
                    <ArrowLeft size={20} />
                </button>

                <div>
                    <h2 className="font-bold text-gray-800 flex items-center gap-2">
                        {currentGroupId === 'GENERAL' ? (
                            <>
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                Kênh Chung
                            </>
                        ) : (
                            <>
                                <Hash size={18} className="text-blue-600" />
                                {currentGroupId.startsWith('WARD_') ? currentGroupId.replace('WARD_', '') : customGroups.find(g => g.id === currentGroupId)?.name || 'Nhóm Chat'}
                            </>
                        )}
                    </h2>
                    <p className="text-xs text-gray-500 hidden sm:block">
                        {currentGroupId === 'GENERAL' ? 'Tin nhắn toàn hệ thống' : 'Trao đổi công việc nội bộ'}
                    </p>
                </div>
            </div>
        </div>

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {loading ? (
                <div className="flex justify-center items-center h-full text-gray-400">
                    <Loader2 className="animate-spin" />
                </div>
            ) : (
                messages.length > 0 ? messages.map((msg, index) => {
                    const prevMsg = messages[index - 1];
                    const isSameSender = prevMsg && prevMsg.sender_username === msg.sender_username;
                    
                    return (
                        <MessageItem
                            key={msg.id}
                            msg={msg}
                            currentUser={currentUser}
                            isModerator={isModerator}
                            isSameSender={isSameSender}
                            onReply={handleReply}
                            onReaction={handleReaction}
                            onDelete={handleRecallMessage}
                            onViewImage={handleViewImage}
                        />
                    );
                }) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <div className="bg-white p-6 rounded-full shadow-sm mb-4">
                            <Hash size={40} className="text-blue-200" />
                        </div>
                        <p className="font-medium text-gray-500">Chưa có tin nhắn nào.</p>
                        <p className="text-sm">Hãy bắt đầu cuộc trò chuyện!</p>
                    </div>
                )
            )}
            <div ref={messagesEndRef} />
        </div>

        {/* INPUT AREA */}
        <div className="bg-white border-t border-gray-200 shrink-0">
            {/* REPLY BANNER */}
            {replyingTo && (
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex justify-between items-center animate-fade-in">
                    <div className="text-sm text-gray-600 border-l-4 border-blue-500 pl-3">
                        <div className="font-bold text-blue-600 flex items-center gap-1">
                            <Reply size={12} /> Đang trả lời {replyingTo.sender_name}
                        </div>
                        <div className="truncate max-w-md text-xs italic mt-0.5">
                            {replyingTo.content || '[Đính kèm]'}
                        </div>
                    </div>
                    <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-gray-200 rounded-full text-gray-500">
                        <X size={16} />
                    </button>
                </div>
            )}

            {file && (
                <div className="px-4 py-2 flex items-center gap-2 bg-blue-50 border-b border-blue-100">
                    {file.type.startsWith('image/') ? <ImageIcon size={16} className="text-blue-600"/> : <FileIcon size={16} className="text-blue-600"/>}
                    <span className="text-sm text-gray-700 truncate max-w-[200px] font-medium">{file.name}</span>
                    <button onClick={() => setFile(null)} className="ml-auto text-gray-400 hover:text-red-500"><X size={16} /></button>
                </div>
            )}

            <div className="p-4">
                <form onSubmit={handleSend} className="flex items-end gap-2 bg-gray-100 p-2 rounded-2xl border border-gray-200 focus-within:bg-white focus-within:border-blue-300 focus-within:ring-4 focus-within:ring-blue-50 transition-all">
                    <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => { if(e.target.files && e.target.files[0]) setFile(e.target.files[0]); }} />
                    
                    <button 
                        type="button" 
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-200 rounded-full transition-colors"
                        title="Đính kèm file"
                    >
                        <Paperclip size={20} />
                    </button>

                    <div className="relative hidden sm:block" ref={screenshotMenuRef}>
                        <button 
                            type="button" 
                            onClick={() => setIsScreenshotMenuOpen(!isScreenshotMenuOpen)}
                            className={`p-2 rounded-full transition-colors ${isScreenshotMenuOpen ? 'text-blue-600 bg-blue-100' : 'text-gray-500 hover:text-blue-600 hover:bg-gray-200'}`}
                            title="Chụp màn hình"
                        >
                            <Camera size={20} />
                        </button>
                        {isScreenshotMenuOpen && (
                            <div className="absolute bottom-full left-0 mb-2 bg-white rounded-lg shadow-xl border border-gray-200 p-1 w-48 z-50 animate-fade-in-up">
                                <button type="button" onClick={() => { handleScreenshot(true); setIsScreenshotMenuOpen(false); }} className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded text-sm text-gray-700 flex items-center gap-2"><Monitor size={16} /> Chụp màn hình khác</button>
                                <button type="button" onClick={() => { handleScreenshot(false); setIsScreenshotMenuOpen(false); }} className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded text-sm text-gray-700 flex items-center gap-2"><Crop size={16} /> Chụp cửa sổ chat</button>
                            </div>
                        )}
                    </div>

                    <div className="relative hidden sm:block" ref={emojiMenuRef}>
                        <button 
                            type="button" 
                            onClick={() => setIsEmojiOpen(!isEmojiOpen)}
                            className={`p-2 rounded-full transition-colors ${isEmojiOpen ? 'text-yellow-600 bg-yellow-100' : 'text-gray-500 hover:text-yellow-600 hover:bg-gray-200'}`}
                            title="Emoji"
                        >
                            <Smile size={20} />
                        </button>
                        {isEmojiOpen && (
                            <div className="absolute bottom-full left-0 mb-2 bg-white rounded-lg shadow-xl border border-gray-200 w-72 z-50 animate-fade-in-up flex flex-col">
                                <div className="p-2 border-b bg-gray-50 rounded-t-lg"><span className="text-xs font-bold text-gray-500">Biểu tượng cảm xúc</span></div>
                                <div className="p-2 grid grid-cols-8 gap-1 max-h-60 overflow-y-auto">
                                    {EMOJI_LIST.map((emoji, index) => (
                                        <button key={index} type="button" onClick={() => handleInsertEmoji(emoji)} className="text-xl p-1 hover:bg-gray-100 rounded transition-colors flex items-center justify-center h-8 w-8">{emoji}</button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <textarea
                        ref={textareaRef}
                        rows={1}
                        className="flex-1 bg-transparent border-none outline-none resize-none max-h-32 py-2.5 text-sm px-2"
                        placeholder={`Nhập tin nhắn...`}
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onPaste={handlePaste}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                    />

                    <button 
                        type="submit" 
                        disabled={(!newMessage.trim() && !file) || sending}
                        className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md transition-transform active:scale-95 flex items-center justify-center"
                    >
                        {sending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                    </button>
                </form>
            </div>
        </div>
      </div>

      {/* ... (Add Member Modal giữ nguyên) ... */}
      {isAddMemberModalOpen && targetGroupForAdd && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-sm animate-fade-in-up flex flex-col max-h-[80vh]">
                  <div className="flex justify-between items-center p-4 border-b">
                      <h3 className="font-bold text-gray-800 flex items-center gap-2"><Shield size={16} className="text-blue-600"/> Quản lý thành viên</h3>
                      <button onClick={() => setIsAddMemberModalOpen(false)} className="text-gray-400 hover:text-red-500"><X size={20} /></button>
                  </div>
                  <div className="p-4 border-b bg-gray-50 text-sm">Đang chỉnh sửa: <strong>{targetGroupForAdd.name}</strong></div>
                  <div className="flex-1 overflow-y-auto p-2">
                      {users.map(u => {
                          const isMember = targetGroupForAdd.members?.includes(u.username);
                          return (
                              <div key={u.username} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded">
                                  <div className="flex items-center gap-2">
                                      <div className={`w-2 h-2 rounded-full ${isMember ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                      <div><div className="text-sm font-medium">{u.name}</div><div className="text-xs text-gray-500">@{u.username}</div></div>
                                  </div>
                                  {isMember ? <button onClick={() => handleRemoveMember(u.username)} className="text-xs text-red-600 border border-red-200 px-2 py-1 rounded hover:bg-red-50">Xóa</button> : <button onClick={() => handleAddMember(u.username)} className="text-xs text-blue-600 border border-blue-200 px-2 py-1 rounded hover:bg-blue-50">Thêm</button>}
                              </div>
                          );
                      })}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default InternalChat;
