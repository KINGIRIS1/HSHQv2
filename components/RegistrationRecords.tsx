import React from 'react';
import { User } from '../types';
import VaoSoView from './archive/VaoSoView';

interface RegistrationRecordsProps {
    currentUser: User;
    wards: string[];
    activeTab?: 'pending_entry' | 'completed_entry' | 'all';
    onTabChange?: (tab: 'pending_entry' | 'completed_entry' | 'all') => void;
}

const RegistrationRecords: React.FC<RegistrationRecordsProps> = ({ currentUser, wards, activeTab, onTabChange }) => {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col flex-1 h-full animate-fade-in-up">
            <VaoSoView currentUser={currentUser} wards={wards} activeTab={activeTab} onTabChange={onTabChange} />
        </div>
    );
};

export default RegistrationRecords;
