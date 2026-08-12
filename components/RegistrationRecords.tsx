import React, { useState } from 'react';
import { User } from '../types';
import { BookOpen } from 'lucide-react';
import VaoSoView from './archive/VaoSoView';

interface RegistrationRecordsProps {
    currentUser: User;
    wards: string[];
}

const RegistrationRecords: React.FC<RegistrationRecordsProps> = ({ currentUser, wards }) => {
    const [activeTab, setActiveTab] = useState<'vaoso'>('vaoso');

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col flex-1 h-full animate-fade-in-up">
            {/* MAIN HEADER TABS */}
            <div className="flex border-b border-gray-200 bg-gray-50 px-4 overflow-x-auto">
                <button 
                    onClick={() => setActiveTab('vaoso')}
                    className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'vaoso' ? 'border-teal-600 text-teal-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <BookOpen size={16}/> Vào số GCN
                </button>
            </div>

            {/* CONTENT AREA */}
            <div className="flex-1 overflow-hidden flex flex-col">
                {activeTab === 'vaoso' && <VaoSoView currentUser={currentUser} wards={wards} />}
            </div>
        </div>
    );
};

export default RegistrationRecords;
