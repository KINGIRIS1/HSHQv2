import React from 'react';
import { User } from '../types';
import VaoSoView from './archive/VaoSoView';

interface RegistrationRecordsProps {
    currentUser: User;
    wards: string[];
}

const RegistrationRecords: React.FC<RegistrationRecordsProps> = ({ currentUser, wards }) => {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col flex-1 h-full animate-fade-in-up">
            <VaoSoView currentUser={currentUser} wards={wards} />
        </div>
    );
};

export default RegistrationRecords;
