import React from 'react';
import { RecordFile, Employee, User, UserRole, Holiday, RecordStatus } from '../../types';
import MobileDashboard from './MobileDashboard';
import MobileRecordList from './MobileRecordList';
import MobileSettingsView from './MobileSettingsView';
import BarcodeGeneratorView from '../BarcodeGeneratorView';
import PersonalProfile from '../PersonalProfile';
import WorkScheduleView from '../WorkScheduleView';
import ReportSection from '../ReportSection';

interface MobileRoutesProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  currentUser: User;
  records: RecordFile[];
  employees: Employee[];
  users: User[];
  wards: string[];
  holidays: Holiday[];
  
  // Handlers
  handleViewRecord: (r: RecordFile) => void;
  setEditingRecord: (r: RecordFile | null) => void;
  setIsModalOpen: (b: boolean) => void;
  setDeletingRecord: (r: RecordFile | null) => void;
  setIsDeleteModalOpen: (b: boolean) => void;
  handleUpdateCurrentAccount: (data: any) => Promise<boolean>;
  notificationEnabled: boolean;
  setNotificationEnabled: (enabled: boolean) => void;
  setUnreadMessages: (n: number) => void;
  onLogout: () => void;
  onAddUser: (user: Omit<User, 'id'>) => void;
  onUpdateUser: (user: User) => void;
  onDeleteUser: (username: string) => void;
  onSaveEmployee: (employee: Employee) => void;
  onDeleteEmployee: (id: string) => void;
  onDeleteAllData: () => Promise<boolean>;
  onHolidaysChanged: () => void;

  handleQuickUpdate?: (id: string, field: keyof RecordFile, value: any) => Promise<void>;
  handleAddOrUpdateRecord?: (record: RecordFile) => Promise<RecordFile | null>;
  onCreateLiquidation?: (record: RecordFile) => void;
  onMapCorrection?: (record: RecordFile) => void;

  setWards: React.Dispatch<React.SetStateAction<string[]>>;
  onResetWards: () => void;
  recordForMapCorrection: RecordFile | null;
  globalReportContent: string;
  isGeneratingReport: boolean;
  handleGlobalGenerateReport: (fromDate: string, toDate: string, title?: string, data?: RecordFile[]) => void;
  handleExportReportExcel: (fromDate: string, toDate: string, ward: string, title?: string, data?: RecordFile[]) => void;
}

const MobileRoutes: React.FC<MobileRoutesProps> = (props) => {
  const { currentView, records, employees, currentUser, wards, users } = props;

  switch (currentView) {
    case 'dashboard':
      return (
        <MobileDashboard 
          records={records} 
          currentUser={currentUser}
          employees={employees}
          setCurrentView={props.setCurrentView}
        />
      );
    
    case 'all_records':
    case 'received_list':
    case 'assigned_list':
    case 'in_progress_list':
    case 'completed_list':
    case 'pending_sign_list':
    case 'signed_list':
    case 'handover_list':
    case 'returned_list':
      return (
        <MobileRecordList 
          records={records} 
          employees={employees}
          onViewRecord={props.handleViewRecord}
          onEditRecord={(r) => { props.setEditingRecord(r); props.setIsModalOpen(true); }}
          onDeleteRecord={(r) => { props.setDeletingRecord(r); props.setIsDeleteModalOpen(true); }}
          onAddRecord={() => { props.setEditingRecord(null); props.setIsModalOpen(true); }}
        />
      );

    case 'barcode_generator':
      return <BarcodeGeneratorView />;

    case 'personal_profile':
      const isDirector = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUBADMIN;
      return (
        <PersonalProfile
          user={currentUser}
          records={records}
          isDirector={isDirector}
          users={users}
          employees={employees}
          onUpdateStatus={(r, status) => {
            if (props.handleQuickUpdate) {
              props.handleQuickUpdate(r.id, 'status', status);
            }
          }}
          onUpdateRecord={props.handleAddOrUpdateRecord}
          onViewRecord={props.handleViewRecord}
          onCreateLiquidation={props.onCreateLiquidation}
          onMapCorrection={props.onMapCorrection}
        />
      );

    case 'account_settings':
      return (
        <MobileSettingsView
          currentUser={currentUser}
          employees={employees}
          users={users}
          wards={wards}
          onUpdateAccount={props.handleUpdateCurrentAccount}
          onAddUser={props.onAddUser}
          onUpdateUser={props.onUpdateUser}
          onDeleteUser={props.onDeleteUser}
          onSaveEmployee={props.onSaveEmployee}
          onDeleteEmployee={props.onDeleteEmployee}
          onDeleteAllData={props.onDeleteAllData}
          onHolidaysChanged={props.onHolidaysChanged}
          notificationEnabled={props.notificationEnabled}
          setNotificationEnabled={props.setNotificationEnabled}
          onLogout={props.onLogout}
        />
      );

    case 'work_schedule':
      return (
        <WorkScheduleView currentUser={currentUser} />
      );

    case 'reports':
      return (
        <ReportSection
          reportContent={props.globalReportContent}
          isGenerating={props.isGeneratingReport}
          onGenerate={props.handleGlobalGenerateReport}
          onExportExcel={props.handleExportReportExcel}
          records={records}
          employees={employees}
          wards={wards}
        />
      );

    default:
      return (
        <div className="p-10 text-center text-slate-400">
          <p className="text-sm font-medium">Tính năng này đang được tối ưu cho mobile...</p>
          <button 
            onClick={() => props.setCurrentView('dashboard')}
            className="mt-4 text-blue-600 font-bold"
          >
            Quay lại Tổng quan
          </button>
        </div>
      );
  }
};

export default MobileRoutes;
