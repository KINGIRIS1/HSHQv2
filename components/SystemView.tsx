import React, { useState } from 'react';
import { User, Employee, UserRole } from '../types';
import UserManagement from './UserManagement';
import EmployeeManagement from './EmployeeManagement';
import SystemSettingsView from './SystemSettingsView';
import { Shield, Users, Settings2 } from 'lucide-react';

interface SystemViewProps {
    currentUser: User;
    users: User[];
    employees: Employee[];
    onAddUser: (user: Omit<User, 'id'>) => void;
    onUpdateUser: (user: User) => void;
    onDeleteUser: (username: string) => void;
    onSaveEmployee: (employee: Employee) => void;
    onDeleteEmployee: (id: string) => void;
    wards: string[];
    onDeleteAllData: () => Promise<boolean>;
    onHolidaysChanged: () => void;
}

const SystemView: React.FC<SystemViewProps> = ({
    currentUser,
    users,
    employees,
    onAddUser,
    onUpdateUser,
    onDeleteUser,
    onSaveEmployee,
    onDeleteEmployee,
    wards,
    onDeleteAllData,
    onHolidaysChanged
}) => {
    const isAdmin = currentUser.role === UserRole.ADMIN;
    const [activeTab, setActiveTab] = useState<'users' | 'employees' | 'settings'>('employees');

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col flex-1 h-full animate-fade-in-up">
            {/* TABS */}
            <div className="flex border-b border-gray-200 bg-gray-50 px-4 overflow-x-auto">
                {isAdmin && (
                    <button 
                        onClick={() => setActiveTab('users')}
                        className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'users' ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        <Shield size={16}/> TK Hệ thống
                    </button>
                )}
                <button 
                    onClick={() => setActiveTab('employees')}
                    className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'employees' ? 'border-teal-600 text-teal-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <Users size={16}/> DS Nhân sự
                </button>
                {isAdmin && (
                    <button 
                        onClick={() => setActiveTab('settings')}
                        className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'settings' ? 'border-orange-600 text-orange-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        <Settings2 size={16}/> Cấu hình
                    </button>
                )}
            </div>

            {/* CONTENT */}
            <div className="flex-1 overflow-hidden flex flex-col p-4">
                {activeTab === 'users' && isAdmin && (
                    <UserManagement 
                        users={users} 
                        employees={employees} 
                        onAddUser={onAddUser} 
                        onUpdateUser={onUpdateUser} 
                        onDeleteUser={onDeleteUser} 
                    />
                )}
                {activeTab === 'employees' && (
                    <EmployeeManagement 
                        employees={employees} 
                        onSaveEmployee={onSaveEmployee} 
                        onDeleteEmployee={onDeleteEmployee} 
                        wards={wards} 
                        currentUser={currentUser} 
                    />
                )}
                {activeTab === 'settings' && isAdmin && (
                    <SystemSettingsView 
                        onDeleteAllData={onDeleteAllData} 
                        onHolidaysChanged={onHolidaysChanged} 
                        employees={employees}
                    />
                )}
            </div>
        </div>
    );
};

export default SystemView;
