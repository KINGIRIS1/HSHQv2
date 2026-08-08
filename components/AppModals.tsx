import React from 'react';
import { RecordFile, Employee, User, RecordStatus } from '../types';
import RecordModal from './RecordModal';
import ImportModal from './ImportModal';
import AssignModal from './AssignModal';
import { DetailModal } from './DetailModal';
import { MobileDetailModal } from './mobile/MobileDetailModal';
import { useIsMobile } from '../hooks/useIsMobile';
import DeleteConfirmModal from './DeleteConfirmModal';
import ExportModal from './ExportModal';
import AddToBatchModal from './AddToBatchModal';
import ReturnBatchHandoverModal from './ReturnBatchHandoverModal';
import ExcelPreviewModal from './ExcelPreviewModal';

import ReturnResultModal from './ReturnResultModal';
import BatchErrorDiagnosticModal from './BatchErrorDiagnosticModal';
import RejectReturnStepModal from './RejectReturnStepModal';
import { ExtendDeadlineModal } from './ExtendDeadlineModal';
import SupplementModal from './SupplementModal';
import * as XLSX from 'xlsx-js-style';

interface AppModalsProps {
    // States
    isModalOpen: boolean;
    isImportModalOpen: boolean;
    importModalMode?: 'create' | 'update';
    isSettingsOpen: boolean; // Kept for prop compatibility but unused
    isAssignModalOpen: boolean;
    isDeleteModalOpen: boolean;
    isExportModalOpen: boolean;
    isAddToBatchModalOpen: boolean;
    isReturnHandoverModalOpen?: boolean;
    isExcelPreviewOpen: boolean;
    isBulkUpdateModalOpen: boolean;
    isReturnModalOpen: boolean;
    isDiagnosticModalOpen?: boolean;
    isRejectReturnStepModalOpen?: boolean;
    isExtendModalOpen?: boolean;
    isSupplementModalOpen?: boolean;
    
    // Data States
    editingRecord: RecordFile | null;
    viewingRecord: RecordFile | null;
    deletingRecord: RecordFile | null;
    returnRecord: RecordFile | null;
    extendTargetRecord?: RecordFile | null;
    extendTargetRecords?: RecordFile[];
    assignTargetRecords: RecordFile[];
    rejectReturnTargetRecords?: RecordFile[];
    supplementTargetRecords?: RecordFile[];
    exportModalType: 'handover' | 'check_list';
    
    // Preview Data
    previewWorkbook: XLSX.WorkBook | null;
    previewExcelName: string;

    // Setters
    setIsModalOpen: (v: boolean) => void;
    setIsImportModalOpen: (v: boolean) => void;
    setIsSettingsOpen: (v: boolean) => void;
    setIsAssignModalOpen: (v: boolean) => void;
    setIsDeleteModalOpen: (v: boolean) => void;
    setIsExportModalOpen: (v: boolean) => void;
    setIsAddToBatchModalOpen: (v: boolean) => void;
    setIsReturnHandoverModalOpen?: (v: boolean) => void;
    setIsExcelPreviewOpen: (v: boolean) => void;
    setIsBulkUpdateModalOpen: (v: boolean) => void;
    setIsReturnModalOpen: (v: boolean) => void;
    setIsDiagnosticModalOpen?: (v: boolean) => void;
    setIsRejectReturnStepModalOpen?: (v: boolean) => void;
    setIsExtendModalOpen?: (v: boolean) => void;
    setIsSupplementModalOpen?: (v: boolean) => void;
    
    setEditingRecord: (r: RecordFile | null) => void;
    setViewingRecord: (r: RecordFile | null) => void;
    setDeletingRecord: (r: RecordFile | null) => void;
    setReturnRecord: (r: RecordFile | null) => void;
    setExtendTargetRecord?: (r: RecordFile | null) => void;

    // Handlers
    handleAddOrUpdate: (data: any) => Promise<RecordFile | null>;
    handleImportRecords: (data: RecordFile[], mode: 'create' | 'update') => Promise<boolean>;
    handleSaveEmployee: (emp: Employee) => void;
    handleDeleteEmployee: (id: string) => void;
    handleDeleteAllData: () => void;
    onRefreshData?: () => void; // New callback
    confirmAssign: (empId: string, subStep?: string) => void;
    handleDeleteRecord: () => void;
    confirmDelete: (r: RecordFile) => void;
    handleExcelPreview: (wb: XLSX.WorkBook, name: string) => void;
    executeBatchExport: (batch: string, date: string, handoverWard?: string) => void;
    executeReturnBatchHandover?: (batch: number, date: string, deptName: string) => void;
    onCreateLiquidation: (record: RecordFile) => void;
    onCreateContract?: (record: Partial<RecordFile>) => void;
    handleBulkUpdate: (field: keyof RecordFile, value: any, customDateStr?: string, targetRecordIds?: string[], assignedTo?: string) => Promise<void>;
    handleBatchUpdateRecords?: (updates: Partial<RecordFile>[]) => Promise<void>;
    confirmReturnResult: (receiptNumber: string, receiverName: string, returnedPrice: number, receiptType?: 'Biên Lai' | 'Hóa Đơn') => void;
    onConfirmRejectReturnStep?: (reason: string, returnDateStr: string) => Promise<void>;
    onConfirmExtendDeadline?: (extendDate: string, reason: string) => Promise<void>;
    onConfirmSupplement?: (note: string) => Promise<void>;
    onOpenRejectReturnModal?: (record: RecordFile) => void;
    onOpenExtendModal?: (record: RecordFile) => void;
    onOpenSupplementModal?: (record: RecordFile) => void;

    // Shared Data
    employees: Employee[];
    users: User[];
    currentUser: User;
    wards: string[];
    holidays?: any[];
    filteredRecords: RecordFile[];
    records: RecordFile[];
    selectedCount: number;
    canPerformAction: boolean;
    selectedRecordsForBulk: RecordFile[];
    currentView: string;
}

const AppModals: React.FC<AppModalsProps> = (props) => {
    // Xác định danh sách hồ sơ cần chốt để truyền vào modal (cho tính năng cảnh báo)
    const targetRecordsForBatch = props.selectedRecordsForBulk.length > 0 ? props.selectedRecordsForBulk : props.filteredRecords;
    const isMobile = useIsMobile();

    return (
        <>
            <RecordModal 
                isOpen={props.isModalOpen}
                onClose={() => { props.setIsModalOpen(false); props.setEditingRecord(null); }}
                onSubmit={props.handleAddOrUpdate}
                initialData={props.editingRecord}
                employees={props.employees}
                currentUser={props.currentUser}
                wards={props.wards}
                currentView={props.currentView}
                holidays={props.holidays}
            />
            
            <ImportModal 
                isOpen={props.isImportModalOpen} 
                onClose={() => props.setIsImportModalOpen(false)} 
                onImport={props.handleImportRecords} 
                employees={props.employees} 
                initialMode={props.importModalMode}
            />
            
            <AssignModal 
                isOpen={props.isAssignModalOpen} 
                onClose={() => props.setIsAssignModalOpen(false)} 
                onConfirm={props.confirmAssign} 
                employees={props.employees} 
                selectedRecords={props.assignTargetRecords} 
                allRecords={props.records}
                currentView={props.currentView}
                currentUser={props.currentUser}
                filterDepartment={(() => {
                    const view = props.currentView;
                    if (['archive_records', 'archive_assign_tasks', 'archive_completed_list', 'archive_pending_check_list', 'archive_check_list', 'archive_handover_list', 'archive_director_completed'].includes(view)) {
                        return 'Lưu trữ';
                    }
                    if (['all_records', 'assign_tasks', 'completed_list', 'pending_check_list', 'check_list', 'handover_list', 'director_completed'].includes(view)) {
                        return 'Đo đạc';
                    }
                    return undefined;
                })()}
            />
            
            {isMobile ? (
                <MobileDetailModal 
                    isOpen={!!props.viewingRecord} 
                    onClose={() => props.setViewingRecord(null)} 
                    record={props.viewingRecord} 
                    employees={props.employees} 
                    users={props.users}
                    currentUser={props.currentUser} 
                    onEdit={props.canPerformAction ? (r) => { props.setEditingRecord(r); props.setIsModalOpen(true); } : undefined}
                    onDelete={props.canPerformAction ? props.confirmDelete : undefined}
                    onCreateLiquidation={props.onCreateLiquidation}
                    onCreateContract={props.onCreateContract}
                    onRefreshData={props.onRefreshData}
                />
            ) : (
                <DetailModal 
                    isOpen={!!props.viewingRecord} 
                    onClose={() => props.setViewingRecord(null)} 
                    record={props.viewingRecord} 
                    employees={props.employees} 
                    users={props.users}
                    currentUser={props.currentUser} 
                    onEdit={props.canPerformAction ? (r) => { props.setEditingRecord(r); props.setIsModalOpen(true); } : undefined}
                    onDelete={props.canPerformAction ? props.confirmDelete : undefined}
                    onCreateLiquidation={props.onCreateLiquidation}
                    onCreateContract={props.onCreateContract}
                    onRefreshData={props.onRefreshData}
                    onOpenRejectReturnModal={props.onOpenRejectReturnModal}
                    onOpenExtendModal={props.onOpenExtendModal}
                    onOpenSupplementModal={props.onOpenSupplementModal}
                />
            )}
            
            <DeleteConfirmModal 
                isOpen={props.isDeleteModalOpen} 
                onClose={() => props.setIsDeleteModalOpen(false)} 
                onConfirm={props.handleDeleteRecord} 
                message={`Bạn có chắc chắn muốn xóa hồ sơ ${props.deletingRecord?.code}?`} 
                record={props.deletingRecord}
            />
            
            <ExportModal 
                isOpen={props.isExportModalOpen} 
                onClose={() => props.setIsExportModalOpen(false)} 
                records={props.records} 
                wards={props.wards} 
                type={props.exportModalType}
                onPreview={props.handleExcelPreview}
                currentView={props.currentView}
            />
            
            <AddToBatchModal
                isOpen={props.isAddToBatchModalOpen}
                onClose={() => props.setIsAddToBatchModalOpen(false)}
                onConfirm={props.executeBatchExport}
                records={props.records}
                selectedCount={props.selectedCount}
                targetRecords={targetRecordsForBatch} 
                wards={props.wards}
                currentUser={props.currentUser}
            />

            <ReturnBatchHandoverModal
                isOpen={!!props.isReturnHandoverModalOpen}
                onClose={() => props.setIsReturnHandoverModalOpen && props.setIsReturnHandoverModalOpen(false)}
                onConfirm={props.executeReturnBatchHandover || (() => {})}
                records={props.records}
                selectedCount={props.selectedCount}
                targetRecords={targetRecordsForBatch}
                currentUser={props.currentUser}
            />

            <ExcelPreviewModal 
                isOpen={props.isExcelPreviewOpen} 
                onClose={() => props.setIsExcelPreviewOpen(false)} 
                workbook={props.previewWorkbook} 
                fileName={props.previewExcelName} 
            />



            <ReturnResultModal
                isOpen={props.isReturnModalOpen}
                onClose={() => { props.setIsReturnModalOpen(false); props.setReturnRecord(null); }}
                record={props.returnRecord}
                onConfirm={props.confirmReturnResult}
            />

            <BatchErrorDiagnosticModal
                isOpen={!!props.isDiagnosticModalOpen}
                onClose={() => props.setIsDiagnosticModalOpen && props.setIsDiagnosticModalOpen(false)}
                records={props.filteredRecords}
                employees={props.employees}
                users={props.users}
                currentUser={props.currentUser}
                onBatchUpdateRecords={props.handleBatchUpdateRecords || (async () => {})}
                onRefreshData={props.onRefreshData}
            />

            <RejectReturnStepModal
                isOpen={!!props.isRejectReturnStepModalOpen}
                onClose={() => props.setIsRejectReturnStepModalOpen && props.setIsRejectReturnStepModalOpen(false)}
                records={props.rejectReturnTargetRecords || []}
                currentUser={props.currentUser}
                employees={props.employees}
                users={props.users}
                onConfirm={props.onConfirmRejectReturnStep || (async () => {})}
            />

            <ExtendDeadlineModal
                isOpen={!!props.isExtendModalOpen}
                onClose={() => {
                    if (props.setIsExtendModalOpen) props.setIsExtendModalOpen(false);
                    if (props.setExtendTargetRecord) props.setExtendTargetRecord(null);
                }}
                record={props.extendTargetRecord || null}
                records={props.extendTargetRecords || []}
                currentUser={props.currentUser}
                onConfirm={props.onConfirmExtendDeadline}
                onRefreshData={props.onRefreshData}
            />

            <SupplementModal
                isOpen={!!props.isSupplementModalOpen}
                onClose={() => props.setIsSupplementModalOpen && props.setIsSupplementModalOpen(false)}
                records={props.supplementTargetRecords || []}
                currentUser={props.currentUser}
                employees={props.employees}
                users={props.users}
                onConfirm={props.onConfirmSupplement || (async () => {})}
            />
        </>
    );
};

export default AppModals;