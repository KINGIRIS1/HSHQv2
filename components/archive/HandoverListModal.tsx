import React, { useState, useEffect } from 'react';
import { X, ListPlus, List } from 'lucide-react';
import { fetchListsByDate } from '../../services/apiArchive';

interface HandoverListModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (listName: string, handoverDate: string) => void;
    type: 'saoluc' | 'congvan';
}

const HandoverListModal: React.FC<HandoverListModalProps> = ({ isOpen, onClose, onConfirm, type }) => {
    const [mode, setMode] = useState<'new' | 'existing'>('new');
    const [existingLists, setExistingLists] = useState<string[]>([]);
    const [newListName, setNewListName] = useState('');
    const [selectedList, setSelectedList] = useState('');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        if (isOpen) {
            loadLists(selectedDate);
        }
    }, [isOpen, selectedDate]);

    const loadLists = async (date: string) => {
        const lists = await fetchListsByDate(type, date);
        setExistingLists(lists);
        
        // Auto-generate next list name
        let maxBatch = 0;
        lists.forEach(l => {
            const match = l.match(/Đợt (\d+)/i);
            if (match) {
                const num = parseInt(match[1], 10);
                if (num > maxBatch) maxBatch = num;
            }
        });
        setNewListName(`Đợt ${maxBatch + 1}`);
        
        // Default selection logic
        if (lists.length > 0) {
            setSelectedList(lists[lists.length - 1]); // Default to latest existing
            setMode('existing'); // Default to existing if available
        } else {
            setMode('new');
        }
    };

    const handleConfirm = () => {
        if (mode === 'new') {
            if (!newListName.trim()) {
                alert('Vui lòng nhập tên danh sách mới');
                return;
            }
            onConfirm(newListName.trim(), selectedDate);
        } else {
            if (!selectedList) {
                alert('Vui lòng chọn danh sách');
                return;
            }
            onConfirm(selectedList, selectedDate);
        }
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in">
            <div className="bg-white rounded-xl shadow-xl w-[400px] overflow-hidden animate-scale-in">
                <div className="bg-blue-600 p-4 flex justify-between items-center text-white">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <ListPlus size={20}/> Tạo danh sách bàn giao
                    </h3>
                    <button onClick={onClose} className="hover:bg-blue-700 p-1 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-6 space-y-4">
                    <p className="text-sm text-gray-600 mb-2">
                        Hồ sơ đã hoàn thành. Vui lòng chọn ngày và danh sách bàn giao.
                    </p>

                    <div className="mb-4">
                        <label className="block text-sm font-bold text-gray-700 mb-1">Ngày giao</label>
                        <input 
                            type="date" 
                            value={selectedDate} 
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>

                    <div className="flex gap-4 mb-4">
                        <label className={`flex-1 border rounded-lg p-3 cursor-pointer transition-all ${mode === 'new' ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-gray-200 hover:bg-gray-50'}`}>
                            <div className="flex items-center gap-2 mb-2">
                                <input type="radio" name="listMode" checked={mode === 'new'} onChange={() => setMode('new')} className="accent-blue-600" />
                                <span className="font-bold text-gray-800 text-sm">Tạo mới</span>
                            </div>
                            <input 
                                type="text" 
                                value={newListName} 
                                onChange={(e) => setNewListName(e.target.value)}
                                disabled={mode !== 'new'}
                                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white disabled:bg-gray-100"
                                placeholder="Ví dụ: Đợt 1"
                            />
                        </label>

                        <label className={`flex-1 border rounded-lg p-3 cursor-pointer transition-all ${mode === 'existing' ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-gray-200 hover:bg-gray-50'}`}>
                            <div className="flex items-center gap-2 mb-2">
                                <input type="radio" name="listMode" checked={mode === 'existing'} onChange={() => setMode('existing')} className="accent-blue-600" disabled={existingLists.length === 0} />
                                <span className={`font-bold text-sm ${existingLists.length === 0 ? 'text-gray-400' : 'text-gray-800'}`}>Chọn cũ</span>
                            </div>
                            <select 
                                value={selectedList} 
                                onChange={(e) => setSelectedList(e.target.value)}
                                disabled={mode !== 'existing' || existingLists.length === 0}
                                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white disabled:bg-gray-100 outline-none"
                            >
                                {existingLists.map(l => <option key={l} value={l}>{l}</option>)}
                            </select>
                        </label>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium">Hủy</button>
                        <button onClick={handleConfirm} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 shadow-sm flex items-center gap-2">
                            <List size={16}/> Xác nhận
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HandoverListModal;
