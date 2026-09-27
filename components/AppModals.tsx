import React from 'react';
import { RecordFile, Employee, User, RecordStatus, RolePermissions, DepartmentPermissions } from '../types';
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
import BulkUpdateModal from './BulkUpdateModal';
import ReturnResultModal from './ReturnResultModal';
import BatchErrorDiagnosticModal from './BatchErrorDiagnosticModal';
import RejectReturnStepModal, { ReturnOptionType } from './RejectReturnStepModal';
import ExtendDeadlineModal from './ExtendDeadlineModal';
import { PreAssignPrintStaffModal } from './registration/PreAssignPrintStaffModal';
import { ConfirmPaymentReceiptModal } from './registration/ConfirmPaymentReceiptModal';
import { HandoverTaxModal } from './registration/HandoverTaxModal';
import { HandoverPostingModal } from './registration/HandoverPostingModal';
import { HandoverPrintModal } from './registration/HandoverPrintModal';
import * as XLSX from 'xlsx-js-style';
import { checkUserPermission, hasRecordActionPermission } from '../utils/permissionUtils';

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

    // Modals Cấp giấy
    isPreAssignPrintModalOpen?: boolean;
    setIsPreAssignPrintModalOpen?: (v: boolean) => void;
    preAssignTargetRecords?: RecordFile[];
    onConfirmPreAssign?: (recordIds: string[], printStaffId: string) => Promise<void>;

    isConfirmPaymentModalOpen?: boolean;
    setIsConfirmPaymentModalOpen?: (v: boolean) => void;
    confirmPaymentTargetRecords?: RecordFile[];
    onConfirmPaymentReceipt?: (records: RecordFile[], receiptData: { receiptDate: string; receiptNumber: string; note: string }) => Promise<void>;

    isHandoverTaxModalOpen?: boolean;
    setIsHandoverTaxModalOpen?: (v: boolean) => void;
    handoverTaxTargetRecords?: RecordFile[];
    onConfirmHandoverTax?: (recordIds: string[], assignedTo: string) => Promise<void>;

    isHandoverPostingModalOpen?: boolean;
    setIsHandoverPostingModalOpen?: (v: boolean) => void;
    handoverPostingTargetRecords?: RecordFile[];
    onConfirmHandoverPosting?: (recordIds: string[], assignedTo: string) => Promise<void>;

    isHandoverPrintModalOpen?: boolean;
    setIsHandoverPrintModalOpen?: (v: boolean) => void;
    handoverPrintTargetRecords?: RecordFile[];
    onConfirmHandoverPrint?: (recordIds: string[], assignedTo: string) => Promise<void>;
    
    // Data States
    editingRecord: RecordFile | null;
    viewingRecord: RecordFile | null;
    deletingRecord: RecordFile | null;
    returnRecord: RecordFile | null;
    assignTargetRecords: RecordFile[];
    rejectReturnTargetRecords?: RecordFile[];
    extendTargetRecords?: RecordFile[];
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
    
    setEditingRecord: (r: RecordFile | null) => void;
    setViewingRecord: (r: RecordFile | null) => void;
    setDeletingRecord: (r: RecordFile | null) => void;
    setReturnRecord: (r: RecordFile | null) => void;

    // Handlers
    handleAddOrUpdate: (data: any) => Promise<RecordFile | null>;
    handleImportRecords: (data: RecordFile[], mode: 'create' | 'update') => Promise<boolean>;
    handleSaveEmployee: (emp: Employee) => void;
    handleDeleteEmployee: (id: string) => void;
    handleDeleteAllData: () => void;
    onRefreshData?: () => void; // New callback
    confirmAssign: (empId: string) => void;
    handleDeleteRecord: () => void;
    confirmDelete: (r: RecordFile) => void;
    handleExcelPreview: (wb: XLSX.WorkBook, name: string) => void;
    executeBatchExport: (batch: string, date: string, handoverWard?: string) => void;
    executeReturnBatchHandover?: (batch: number, date: string, deptName: string) => void;
    onCreateLiquidation: (record: RecordFile) => void;
    onCreateContract?: (record: Partial<RecordFile>) => void;
    handleBulkUpdate: (field: keyof RecordFile, value: any, customDateStr?: string, targetRecordIds?: string[]) => Promise<void>;
    handleBatchUpdateRecords?: (updates: Partial<RecordFile>[]) => Promise<void>;
    handleBatchDeleteRecords?: (ids: string[]) => Promise<boolean>;
    confirmReturnResult: (receiptNumber: string, receiverName: string, returnedPrice: number, receiptType?: 'Biên Lai' | 'Hóa Đơn', returnReason?: string) => void;
    onConfirmRejectReturnStep?: (optionType: ReturnOptionType, reason: string, returnDateStr: string) => Promise<void>;
    onOpenRejectReturnModal?: (record: RecordFile) => void;
    onConfirmExtendDeadline?: (newDeadline: string, reason: string, executionDateStr: string) => Promise<void>;
    onOpenExtendModal?: (record: RecordFile) => void;

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
    rolePermissions?: RolePermissions;
    departmentPermissions?: DepartmentPermissions;
}

const AppModals: React.FC<AppModalsProps> = (props) => {
    // Lắng nghe phím Esc toàn cục cho tất cả Modal
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (props.isDiagnosticModalOpen) props.setIsDiagnosticModalOpen?.(false);
                else if (props.isRejectReturnStepModalOpen) props.setIsRejectReturnStepModalOpen?.(false);
                else if (props.isExtendModalOpen) props.setIsExtendModalOpen?.(false);
                else if (props.isBulkUpdateModalOpen) props.setIsBulkUpdateModalOpen(false);
                else if (props.isReturnModalOpen) props.setIsReturnModalOpen(false);
                else if (props.isReturnHandoverModalOpen) props.setIsReturnHandoverModalOpen?.(false);
                else if (props.isAddToBatchModalOpen) props.setIsAddToBatchModalOpen(false);
                else if (props.isExcelPreviewOpen) props.setIsExcelPreviewOpen(false);
                else if (props.isExportModalOpen) props.setIsExportModalOpen(false);
                else if (props.isDeleteModalOpen) props.setIsDeleteModalOpen(false);
                else if (props.isAssignModalOpen) props.setIsAssignModalOpen(false);
                else if (props.isImportModalOpen) props.setIsImportModalOpen(false);
                else if (props.isModalOpen) props.setIsModalOpen(false);
                else if (props.viewingRecord) props.setViewingRecord(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [
        props.isDiagnosticModalOpen, props.isRejectReturnStepModalOpen, props.isExtendModalOpen,
        props.isBulkUpdateModalOpen, props.isReturnModalOpen, props.isReturnHandoverModalOpen,
        props.isAddToBatchModalOpen, props.isExcelPreviewOpen, props.isExportModalOpen,
        props.isDeleteModalOpen, props.isAssignModalOpen, props.isImportModalOpen,
        props.isModalOpen, props.viewingRecord, props.setIsDiagnosticModalOpen,
        props.setIsRejectReturnStepModalOpen, props.setIsExtendModalOpen, props.setIsBulkUpdateModalOpen,
        props.setIsReturnModalOpen, props.setIsReturnHandoverModalOpen, props.setIsAddToBatchModalOpen,
        props.setIsExcelPreviewOpen, props.setIsExportModalOpen, props.setIsDeleteModalOpen,
        props.setIsAssignModalOpen, props.setIsImportModalOpen, props.setIsModalOpen, props.setViewingRecord
    ]);

    // Xác định danh sách hồ sơ cần chốt để truyền vào modal (cho tính năng cảnh báo)
    const targetRecordsForBatch = props.selectedRecordsForBulk.length > 0 ? props.selectedRecordsForBulk : props.filteredRecords;
    const isMobile = useIsMobile();

    const canEditViewingRecord = props.viewingRecord
        ? hasRecordActionPermission('edit', props.viewingRecord, props.currentUser, props.employees, props.rolePermissions, props.departmentPermissions)
        : false;

    const canDeleteViewingRecord = props.viewingRecord
        ? hasRecordActionPermission('delete', props.viewingRecord, props.currentUser, props.employees, props.rolePermissions, props.departmentPermissions)
        : false;

    const canExtendViewingRecord = props.viewingRecord
        ? hasRecordActionPermission('extend', props.viewingRecord, props.currentUser, props.employees, props.rolePermissions, props.departmentPermissions)
        : false;

    return (
        <>
            <RecordModal 
                isOpen={props.isModalOpen}
                onClose={() => { props.setIsModalOpen(false); props.setEditingRecord(null); }}
                onSubmit={async (data) => {
                    if (props.viewingRecord && data && props.viewingRecord.id === data.id) {
                        props.setViewingRecord({ ...props.viewingRecord, ...data });
                    }
                    return props.handleAddOrUpdate(data);
                }}
                initialData={props.editingRecord}
                employees={props.employees}
                currentUser={props.currentUser}
                wards={props.wards}
                currentView={props.currentView}
                holidays={props.holidays}
                records={props.records}
            />
            
            <ImportModal 
                isOpen={props.isImportModalOpen} 
                onClose={() => props.setIsImportModalOpen(false)} 
                onImport={props.handleImportRecords} 
                employees={props.employees} 
                initialMode={props.importModalMode}
                records={props.records}
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
                    rolePermissions={props.rolePermissions}
                    departmentPermissions={props.departmentPermissions}
                    onEdit={canEditViewingRecord ? (r) => { props.setEditingRecord(r); props.setIsModalOpen(true); } : undefined}
                    onDelete={canDeleteViewingRecord ? props.confirmDelete : undefined}
                    onCreateLiquidation={props.onCreateLiquidation}
                    onCreateContract={props.onCreateContract}
                    onRefreshData={props.onRefreshData}
                    onOpenExtendModal={canExtendViewingRecord ? props.onOpenExtendModal : undefined}
                />
            ) : (
                <DetailModal 
                    isOpen={!!props.viewingRecord} 
                    onClose={() => props.setViewingRecord(null)} 
                    record={props.viewingRecord} 
                    employees={props.employees} 
                    users={props.users}
                    currentUser={props.currentUser} 
                    rolePermissions={props.rolePermissions}
                    departmentPermissions={props.departmentPermissions}
                    onEdit={canEditViewingRecord ? (r) => { props.setEditingRecord(r); props.setIsModalOpen(true); } : undefined}
                    onDelete={canDeleteViewingRecord ? props.confirmDelete : undefined}
                    onCreateLiquidation={props.onCreateLiquidation}
                    onCreateContract={props.onCreateContract}
                    onRefreshData={props.onRefreshData}
                    onOpenRejectReturnModal={props.onOpenRejectReturnModal}
                    onOpenExtendModal={canExtendViewingRecord ? props.onOpenExtendModal : undefined}
                />
            )}
            
            <DeleteConfirmModal 
                isOpen={props.isDeleteModalOpen} 
                onClose={() => {
                    props.setIsDeleteModalOpen(false);
                    props.setDeletingRecord(null);
                }} 
                onConfirm={props.handleDeleteRecord} 
                title="Xác nhận xóa hồ sơ"
                message={props.deletingRecord?.code ? `Bạn có đồng ý xóa mã hồ sơ số ${props.deletingRecord.code} không?` : undefined} 
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

            <BulkUpdateModal 
                isOpen={props.isBulkUpdateModalOpen}
                onClose={() => props.setIsBulkUpdateModalOpen(false)}
                selectedRecords={props.selectedRecordsForBulk}
                allRecords={props.records}
                employees={props.employees}
                wards={props.wards}
                onConfirm={props.handleBulkUpdate}
                currentView={props.currentView}
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
                onDeleteBatchRecords={props.handleBatchDeleteRecords}
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
                onClose={() => props.setIsExtendModalOpen && props.setIsExtendModalOpen(false)}
                records={props.extendTargetRecords || []}
                currentUser={props.currentUser}
                employees={props.employees}
                users={props.users}
                onConfirm={props.onConfirmExtendDeadline || (async () => {})}
            />

            {/* Modals Quy trình Cấp giấy */}
            <PreAssignPrintStaffModal
                isOpen={!!props.isPreAssignPrintModalOpen}
                onClose={() => props.setIsPreAssignPrintModalOpen && props.setIsPreAssignPrintModalOpen(false)}
                selectedRecords={props.preAssignTargetRecords || []}
                employees={props.employees}
                onConfirmPreAssign={props.onConfirmPreAssign || (async () => {})}
            />

            <ConfirmPaymentReceiptModal
                isOpen={!!props.isConfirmPaymentModalOpen}
                onClose={() => props.setIsConfirmPaymentModalOpen && props.setIsConfirmPaymentModalOpen(false)}
                selectedRecords={props.confirmPaymentTargetRecords || []}
                onConfirmPayment={props.onConfirmPaymentReceipt || (async () => {})}
            />

            <HandoverTaxModal
                isOpen={!!props.isHandoverTaxModalOpen}
                onClose={() => props.setIsHandoverTaxModalOpen && props.setIsHandoverTaxModalOpen(false)}
                selectedRecords={props.handoverTaxTargetRecords || []}
                employees={props.employees}
                onConfirmHandoverTax={props.onConfirmHandoverTax || (async () => {})}
            />

            <HandoverPostingModal
                isOpen={!!props.isHandoverPostingModalOpen}
                onClose={() => props.setIsHandoverPostingModalOpen && props.setIsHandoverPostingModalOpen(false)}
                selectedRecords={props.handoverPostingTargetRecords || []}
                employees={props.employees}
                onConfirmHandoverPosting={props.onConfirmHandoverPosting || (async () => {})}
            />

            <HandoverPrintModal
                isOpen={!!props.isHandoverPrintModalOpen}
                onClose={() => props.setIsHandoverPrintModalOpen && props.setIsHandoverPrintModalOpen(false)}
                selectedRecords={props.handoverPrintTargetRecords || []}
                employees={props.employees}
                onConfirmHandoverPrint={props.onConfirmHandoverPrint || (async () => {})}
            />
        </>
    );
};

export default AppModals;