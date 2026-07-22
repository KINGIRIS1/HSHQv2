import React from 'react';
import { RecordFile, Employee, User } from '../../types';
import DashboardView from '../DashboardView';

interface MobileDashboardProps {
  records: RecordFile[];
  currentUser: User;
  employees: Employee[];
  setCurrentView: (view: string) => void;
}

const MobileDashboard: React.FC<MobileDashboardProps> = ({ 
  records, 
  currentUser, 
  employees, 
  setCurrentView 
}) => {
  return (
    <div className="w-full pb-6">
      <DashboardView
        records={records}
        currentUser={currentUser}
        employees={employees}
        setCurrentView={setCurrentView}
      />
    </div>
  );
};

export default MobileDashboard;
