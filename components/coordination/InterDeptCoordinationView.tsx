import React, { useState, useMemo } from 'react';
import { 
  DepartmentConfig, 
  CoordinationWorkflow, 
  CoordinationWorkflowStep, 
  CoordinationStepType, 
  RecordFile, 
  DangKyRecord, 
  User 
} from '../../types';
import { 
  getDepartmentConfigs, 
  saveDepartmentConfig, 
  deleteDepartmentConfig, 
  resetDepartmentsToDefault,
  getCoordinationWorkflows, 
  saveCoordinationWorkflow, 
  deleteCoordinationWorkflow, 
  resetCoordinationWorkflowsToDefault,
  executeAdvanceCoordinationStep
} from '../../services/apiCoordination';
import { 
  Users, 
  GitBranch, 
  Layers, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  ArrowRight, 
  Plus, 
  Edit3, 
  Trash2, 
  Save, 
  RotateCcw, 
  ArrowUp, 
  ArrowDown, 
  FileText, 
  Search, 
  Filter, 
  ChevronRight, 
  Building2, 
  FileCheck2, 
  ShieldCheck, 
  Share2, 
  Sparkles, 
  ArrowLeftRight,
  Eye,
  Send,
  X,
  Phone,
  UserCheck
} from 'lucide-react';
import { getDepartmentForRecord } from '../../utils/appHelpers';

interface InterDeptCoordinationViewProps {
  currentUser: User;
  records?: RecordFile[];
  dangKyRecords?: DangKyRecord[];
  onViewRecord?: (record: any) => void;
  onRefreshData?: () => void;
}

export const InterDeptCoordinationView: React.FC<InterDeptCoordinationViewProps> = ({
  currentUser,
  records = [],
  dangKyRecords = [],
  onViewRecord,
  onRefreshData
}) => {
  const [activeMainTab, setActiveMainTab] = useState<'monitor' | 'departments' | 'workflows'>('monitor');
  
  // Data States
  const [departments, setDepartments] = useState<DepartmentConfig[]>(getDepartmentConfigs());
  const [workflows, setWorkflows] = useState<CoordinationWorkflow[]>(getCoordinationWorkflows());
  
  // Selection State for Workflow Editor
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>(workflows[0]?.id || '');
  const [editingWorkflow, setEditingWorkflow] = useState<CoordinationWorkflow | null>(
    workflows.find(w => w.id === selectedWorkflowId) || workflows[0] || null
  );

  // Department Modal State
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [editingDept, setEditingDept] = useState<DepartmentConfig | null>(null);

  // Step Advance Modal State
  const [advancingRecord, setAdvancingRecord] = useState<any | null>(null);
  const [stepNoteInput, setStepNoteInput] = useState('');
  const [stepDocInput, setStepDocInput] = useState('');
  const [isSubmittingAdvance, setIsSubmittingAdvance] = useState(false);

  // Monitor Search & Filter States
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterDirection, setFilterDirection] = useState<'all' | 'outgoing' | 'incoming' | 'completed'>('all');
  const [filterDept, setFilterDept] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'in_progress' | 'completed'>('all');

  const [notificationMsg, setNotificationMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    setNotificationMsg({ text, type });
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  // Combine all records that have coordination info
  const allCoordinatingRecords = useMemo(() => {
    const combined: any[] = [];
    
    // Standard records
    records.forEach(r => {
      if (r.coordinationDept || r.coordinationStatus || r.originalDept) {
        combined.push({
          ...r,
          recordTypeDisplay: r.recordType || 'Đo đạc',
          ownerName: r.customerName || (r as any).ownerName || 'Chưa có tên',
          displayCode: r.code || r.id
        });
      }
    });

    // DangKy records
    dangKyRecords.forEach(dk => {
      if (dk.coordinationDept || dk.coordinationStatus || dk.originalDept) {
        const ownerName = dk.owners?.[0]?.name || dk.applicantName || 'Chưa có tên';
        combined.push({
          ...dk,
          recordTypeDisplay: dk.recordType || 'Đăng ký cấp GCN',
          ownerName,
          displayCode: dk.code || dk.id,
          sourceTable: 'dangky_records'
        });
      }
    });

    return combined;
  }, [records, dangKyRecords]);

  // Filtered records for Monitor table
  const filteredRecords = useMemo(() => {
    return allCoordinatingRecords.filter(r => {
      const origDept = r.originalDept || getDepartmentForRecord(r);
      const coordDept = r.coordinationDept;
      const isCompleted = r.coordinationStatus === 'completed';

      // Search keyword filter
      if (searchKeyword.trim()) {
        const q = searchKeyword.toLowerCase();
        const matchCode = (r.displayCode || '').toLowerCase().includes(q);
        const matchName = (r.ownerName || '').toLowerCase().includes(q);
        const matchWard = (r.ward || '').toLowerCase().includes(q);
        if (!matchCode && !matchName && !matchWard) return false;
      }

      // Direction filter
      if (filterDirection === 'outgoing') {
        if (isCompleted || !coordDept) return false;
      } else if (filterDirection === 'incoming') {
        if (isCompleted || !coordDept) return false;
      } else if (filterDirection === 'completed') {
        if (!isCompleted) return false;
      }

      // Dept filter
      if (filterDept !== 'all') {
        if (origDept !== filterDept && coordDept !== filterDept) return false;
      }

      // Status filter
      if (filterStatus === 'in_progress' && isCompleted) return false;
      if (filterStatus === 'completed' && !isCompleted) return false;

      return true;
    });
  }, [allCoordinatingRecords, searchKeyword, filterDirection, filterDept, filterStatus]);

  // Monitor KPIs
  const kpis = useMemo(() => {
    let total = allCoordinatingRecords.length;
    let inProgress = allCoordinatingRecords.filter(r => r.coordinationStatus === 'in_progress' || (r.coordinationDept && r.coordinationStatus !== 'completed')).length;
    let completed = allCoordinatingRecords.filter(r => r.coordinationStatus === 'completed').length;
    let outgoing = allCoordinatingRecords.filter(r => r.coordinationDept && r.coordinationStatus !== 'completed').length;

    return { total, inProgress, completed, outgoing };
  }, [allCoordinatingRecords]);

  // Handle Workflow Selection Change
  const handleSelectWorkflow = (wfId: string) => {
    setSelectedWorkflowId(wfId);
    const found = workflows.find(w => w.id === wfId);
    if (found) {
      setEditingWorkflow(JSON.parse(JSON.stringify(found)));
    }
  };

  // Handle Workflow Step Edit
  const handleStepFieldChange = (stepIdx: number, field: keyof CoordinationWorkflowStep, value: any) => {
    if (!editingWorkflow) return;
    const steps = [...editingWorkflow.steps];
    steps[stepIdx] = { ...steps[stepIdx], [field]: value };
    setEditingWorkflow({ ...editingWorkflow, steps });
  };

  // Move step up / down
  const handleMoveStep = (stepIdx: number, dir: 'up' | 'down') => {
    if (!editingWorkflow) return;
    const targetIdx = dir === 'up' ? stepIdx - 1 : stepIdx + 1;
    if (targetIdx < 0 || targetIdx >= editingWorkflow.steps.length) return;
    
    const steps = [...editingWorkflow.steps];
    const temp = steps[stepIdx];
    steps[stepIdx] = steps[targetIdx];
    steps[targetIdx] = temp;
    steps.forEach((s, idx) => { s.order = idx + 1; });

    setEditingWorkflow({ ...editingWorkflow, steps });
  };

  // Delete step
  const handleDeleteStep = (stepIdx: number) => {
    if (!editingWorkflow) return;
    if (editingWorkflow.steps.length <= 1) {
      alert('Quy trình phải có ít nhất 1 bước.');
      return;
    }
    const steps = editingWorkflow.steps.filter((_, idx) => idx !== stepIdx);
    steps.forEach((s, idx) => { s.order = idx + 1; });
    setEditingWorkflow({ ...editingWorkflow, steps });
  };

  // Add step
  const handleAddStep = () => {
    if (!editingWorkflow) return;
    const newStep: CoordinationWorkflowStep = {
      id: `step_${Date.now()}`,
      name: 'Bước phối hợp mới',
      type: 'inspection',
      responsibleDept: editingWorkflow.targetDept,
      slaHours: 8,
      slaDisplay: '1 ngày',
      order: editingWorkflow.steps.length + 1,
      requireDocs: false,
      allowRejection: true,
      description: 'Mô tả nội dung kiểm tra/thực hiện',
      active: true
    };
    setEditingWorkflow({
      ...editingWorkflow,
      steps: [...editingWorkflow.steps, newStep]
    });
  };

  // Save Workflow
  const handleSaveWorkflow = () => {
    if (!editingWorkflow) return;
    if (!editingWorkflow.name.trim()) {
      alert('Vui lòng nhập tên quy trình.');
      return;
    }
    const success = saveCoordinationWorkflow(editingWorkflow);
    if (success) {
      const updatedList = getCoordinationWorkflows();
      setWorkflows(updatedList);
      showNotification('Đã lưu cấu hình quy trình phối hợp & luồng tự động thành công!');
    } else {
      showNotification('Lỗi khi lưu quy trình!', 'error');
    }
  };

  // Reset Workflows to Default
  const handleResetWorkflows = () => {
    if (confirm('Khôi phục danh sách quy trình phối hợp về cài đặt mặc định ban đầu?')) {
      const list = resetCoordinationWorkflowsToDefault();
      setWorkflows(list);
      if (list[0]) {
        setSelectedWorkflowId(list[0].id);
        setEditingWorkflow(JSON.parse(JSON.stringify(list[0])));
      }
      showNotification('Đã khôi phục quy trình phối hợp mặc định!');
    }
  };

  // Save Department
  const handleSaveDepartment = () => {
    if (!editingDept || !editingDept.name.trim()) {
      alert('Vui lòng nhập tên tổ chuyên môn.');
      return;
    }
    saveDepartmentConfig(editingDept);
    setDepartments(getDepartmentConfigs());
    setShowDeptModal(false);
    setEditingDept(null);
    showNotification('Đã cập nhật thông tin tổ chuyên môn!');
  };

  // Delete Department
  const handleDeleteDept = (id: string, name: string) => {
    if (confirm(`Bạn có chắc muốn xóa "${name}"?`)) {
      deleteDepartmentConfig(id);
      setDepartments(getDepartmentConfigs());
      showNotification('Đã xóa tổ chuyên môn.');
    }
  };

  // Advance Step Execution
  const handleExecuteAdvanceStep = async () => {
    if (!advancingRecord) return;
    setIsSubmittingAdvance(true);

    try {
      const currentIdx = advancingRecord.coordinationCurrentStepIndex ?? 0;
      const nextIdx = currentIdx + 1;
      const attachedDocs = stepDocInput.trim() ? [stepDocInput.trim()] : undefined;

      const res = await executeAdvanceCoordinationStep(advancingRecord, {
        nextStepIndex: nextIdx,
        note: stepNoteInput.trim() || undefined,
        attachedDocs,
        user: { name: currentUser.name, username: currentUser.username, role: currentUser.role }
      });

      if (res.success) {
        showNotification(res.message);
        setAdvancingRecord(null);
        setStepNoteInput('');
        setStepDocInput('');
        if (onRefreshData) onRefreshData();
      } else {
        showNotification(res.message, 'error');
      }
    } catch (e: any) {
      showNotification(e.message || 'Lỗi khi chuyển bước.', 'error');
    } finally {
      setIsSubmittingAdvance(false);
    }
  };

  const getStepTypeBadge = (type: CoordinationStepType) => {
    switch (type) {
      case 'reception':
        return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700">Tiếp nhận</span>;
      case 'verification':
        return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">Xác minh / Hiện trạng</span>;
      case 'inspection':
        return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">Kiểm tra chuyên môn</span>;
      case 'signing':
        return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700">Trình ký duyệt</span>;
      case 'handover':
        return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">Chuyển trả tự động</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-700">Nghiệp vụ</span>;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden font-sans text-gray-800 animate-in fade-in duration-200">
      
      {/* NOTIFICATION TOAST */}
      {notificationMsg && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 border text-sm font-semibold transition-all ${
          notificationMsg.type === 'success' 
            ? 'bg-emerald-50 border-emerald-300 text-emerald-800' 
            : 'bg-rose-50 border-rose-300 text-rose-800'
        }`}>
          {notificationMsg.type === 'success' ? <CheckCircle2 size={18} className="text-emerald-600" /> : <AlertTriangle size={18} className="text-rose-600" />}
          <span>{notificationMsg.text}</span>
        </div>
      )}

      {/* TOP HEADER & NAV TABS */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shrink-0 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center text-white shadow-md shadow-purple-200">
              <ArrowLeftRight size={22} />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
                Quản lý Phối hợp Liên Tổ & Luồng Chuyển trả Tự động
                <span className="text-[10px] px-2 py-0.5 font-bold uppercase rounded-full bg-purple-100 text-purple-700 border border-purple-200">
                  Workflow Engine
                </span>
              </h1>
              <p className="text-xs text-gray-500 font-medium mt-0.5">
                Cấu hình các tổ chuyên môn, định nghĩa các bước phối hợp (xác minh, kiểm tra, trình ký) và luồng tự động chuyển hồ sơ về tổ ban đầu.
              </p>
            </div>
          </div>

          {/* MAIN TABS */}
          <div className="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200 text-xs font-bold shrink-0">
            <button
              onClick={() => setActiveMainTab('monitor')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                activeMainTab === 'monitor' 
                  ? 'bg-white text-purple-700 shadow-xs font-extrabold' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Layers size={15} />
              Theo dõi Phối hợp
              {kpis.inProgress > 0 && (
                <span className="px-1.5 py-0.2 bg-purple-600 text-white rounded-full text-[10px]">
                  {kpis.inProgress}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveMainTab('workflows')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                activeMainTab === 'workflows' 
                  ? 'bg-white text-purple-700 shadow-xs font-extrabold' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <GitBranch size={15} />
              Định nghĩa Quy trình & Bước
            </button>
            <button
              onClick={() => setActiveMainTab('departments')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                activeMainTab === 'departments' 
                  ? 'bg-white text-purple-700 shadow-xs font-extrabold' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Building2 size={15} />
              Tổ Chuyên môn ({departments.length})
            </button>
          </div>
        </div>
      </div>

      {/* CONTENT AREA */}
      <div className="flex-1 overflow-y-auto p-6">
        
        {/* ========================================================================= */}
        {/* TAB 1: THEO DÕI HỒ SƠ PHỐI HỢP LIÊN TỔ (MONITOR & DASHBOARD) */}
        {/* ========================================================================= */}
        {activeMainTab === 'monitor' && (
          <div className="space-y-6 max-w-7xl mx-auto">
            
            {/* KPI STATS CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Tổng HS Phối hợp</span>
                  <div className="text-2xl font-extrabold text-gray-900 mt-1">{kpis.total}</div>
                </div>
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <FileText size={20} />
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-purple-200 shadow-xs flex items-center justify-between bg-gradient-to-br from-white to-purple-50/40">
                <div>
                  <span className="text-xs font-bold text-purple-600 uppercase tracking-wider">Đang phối hợp xử lý</span>
                  <div className="text-2xl font-extrabold text-purple-700 mt-1">{kpis.inProgress}</div>
                </div>
                <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  <Clock size={20} />
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-xs flex items-center justify-between bg-gradient-to-br from-white to-emerald-50/40">
                <div>
                  <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Đã chuyển trả về tổ gốc</span>
                  <div className="text-2xl font-extrabold text-emerald-700 mt-1">{kpis.completed}</div>
                </div>
                <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <CheckCircle2 size={20} />
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-xs flex items-center justify-between bg-gradient-to-br from-white to-amber-50/40">
                <div>
                  <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Tổ chuyên môn kết nối</span>
                  <div className="text-2xl font-extrabold text-amber-700 mt-1">{departments.filter(d => d.active).length}</div>
                </div>
                <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  <Building2 size={20} />
                </div>
              </div>
            </div>

            {/* FILTER & CONTROLS */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 w-full md:w-auto flex-1">
                <div className="relative flex-1 max-w-md">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    placeholder="Tìm theo mã hồ sơ, tên chủ, xã/phường..."
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-gray-50"
                  />
                </div>

                <select
                  value={filterDept}
                  onChange={(e) => setFilterDept(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-xs font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                >
                  <option value="all">-- Tất cả Tổ --</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </select>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-xs font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                >
                  <option value="all">-- Trạng thái phối hợp --</option>
                  <option value="in_progress">Đang phối hợp</option>
                  <option value="completed">Đã chuyển trả</option>
                </select>
              </div>

              <div className="flex items-center gap-2 self-end md:self-auto">
                <button
                  onClick={() => {
                    setSearchKeyword('');
                    setFilterDept('all');
                    setFilterStatus('all');
                    setFilterDirection('all');
                  }}
                  className="px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <RotateCcw size={14} /> Đặt lại
                </button>
              </div>
            </div>

            {/* MONITOR DATA TABLE */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-4">Mã HS / Chủ sử dụng</th>
                      <th className="py-3 px-4">Loại thủ tục</th>
                      <th className="py-3 px-4">Tổ khởi tạo (Gốc)</th>
                      <th className="py-3 px-4">Tổ nhận phối hợp</th>
                      <th className="py-3 px-4">Tiến độ & Bước hiện tại</th>
                      <th className="py-3 px-4">Trạng thái</th>
                      <th className="py-3 px-4 text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredRecords.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-gray-400">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <Layers size={36} className="text-gray-300" />
                            <p className="font-semibold text-sm">Chưa có hồ sơ nào đang trong luồng phối hợp liên tổ</p>
                            <p className="text-xs text-gray-400">Các hồ sơ được chuyển phối hợp từ modal Chi tiết hồ sơ sẽ hiển thị tại đây.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredRecords.map((rec: any, idx: number) => {
                        const origDept = rec.originalDept || getDepartmentForRecord(rec);
                        const coordDept = rec.coordinationDept;
                        const isCompleted = rec.coordinationStatus === 'completed';
                        const currentStepIdx = rec.coordinationCurrentStepIndex ?? 0;
                        const wf = workflows.find(w => w.id === rec.coordinationWorkflowId);
                        const steps = wf?.steps || [];
                        const currentStep = steps[currentStepIdx];

                        return (
                          <tr key={rec.id || idx} className="hover:bg-purple-50/30 transition-colors">
                            <td className="py-3 px-4">
                              <div className="font-bold text-gray-900 flex items-center gap-1.5">
                                <span className="text-purple-700 font-mono">{rec.displayCode}</span>
                              </div>
                              <div className="font-semibold text-gray-800 mt-0.5">{rec.ownerName}</div>
                              {rec.ward && <span className="text-[10px] text-gray-500 font-medium">Xã/Phường: {rec.ward}</span>}
                            </td>

                            <td className="py-3 px-4">
                              <span className="font-medium text-gray-700 block max-w-xs truncate" title={rec.recordTypeDisplay}>
                                {rec.recordTypeDisplay}
                              </span>
                              {wf && (
                                <span className="text-[10px] text-purple-600 font-semibold block mt-0.5">
                                  {wf.name}
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-4">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-bold border border-blue-200 text-xs">
                                <Building2 size={12} /> {origDept}
                              </span>
                            </td>

                            <td className="py-3 px-4">
                              {coordDept ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 font-bold border border-purple-200 text-xs animate-pulse">
                                  <ArrowRight size={12} /> {coordDept}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400 italic">Đã trả về tổ gốc</span>
                              )}
                            </td>

                            <td className="py-3 px-4">
                              {isCompleted ? (
                                <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
                                  <CheckCircle2 size={16} />
                                  <span>Đã hoàn thành & Trả về {origDept}</span>
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  <div className="font-bold text-gray-800 flex items-center gap-1.5">
                                    {currentStep ? getStepTypeBadge(currentStep.type) : <span className="font-semibold">Đang xử lý</span>}
                                    <span className="text-xs">{currentStep?.name || `Bước ${currentStepIdx + 1}`}</span>
                                  </div>
                                  {/* MINI STEPPER */}
                                  {steps.length > 0 && (
                                    <div className="flex items-center gap-1 mt-1">
                                      {steps.map((s, sIdx) => (
                                        <div 
                                          key={s.id} 
                                          className={`h-1.5 rounded-full transition-all ${
                                            sIdx < currentStepIdx 
                                              ? 'w-4 bg-emerald-500' 
                                              : sIdx === currentStepIdx 
                                              ? 'w-6 bg-purple-600 animate-pulse' 
                                              : 'w-3 bg-gray-200'
                                          }`}
                                          title={`Bước ${sIdx + 1}: ${s.name}`}
                                        />
                                      ))}
                                    </div>
                                  )}
                                  {rec.coordinationNotes && (
                                    <p className="text-[11px] text-gray-500 italic truncate max-w-xs">
                                      Yêu cầu: {rec.coordinationNotes}
                                    </p>
                                  )}
                                </div>
                              )}
                            </td>

                            <td className="py-3 px-4">
                              {isCompleted ? (
                                <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[11px] border border-emerald-200 flex items-center gap-1 w-max">
                                  <CheckCircle2 size={12} /> Đã bàn giao
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 rounded-full bg-purple-100 text-purple-800 font-extrabold text-[11px] border border-purple-200 flex items-center gap-1 w-max animate-pulse">
                                  <Clock size={12} /> Đang phối hợp
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {!isCompleted && coordDept && (
                                  <button
                                    onClick={() => setAdvancingRecord(rec)}
                                    className="p-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-bold shadow-xs flex items-center gap-1 text-[11px] px-2.5"
                                    title="Chuyển bước phối hợp tiếp theo"
                                  >
                                    <ArrowRight size={13} /> Chuyển bước
                                  </button>
                                )}
                                {onViewRecord && (
                                  <button
                                    onClick={() => onViewRecord(rec)}
                                    className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                                    title="Xem chi tiết hồ sơ"
                                  >
                                    <Eye size={14} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: CẤU HÌNH TỔ CHUYÊN MÔN (DEPARTMENT DIRECTORY) */}
        {/* ========================================================================= */}
        {activeMainTab === 'departments' && (
          <div className="space-y-6 max-w-6xl mx-auto">
            <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
              <div>
                <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <Building2 size={18} className="text-purple-600" />
                  Danh mục Tổ Chuyên môn & Đầu mối phối hợp
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Thiết lập các tổ nghiệp vụ tham gia vào quy trình luân chuyển và phối hợp giải quyết hồ sơ.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setEditingDept({
                      id: `dept_${Date.now()}`,
                      code: `TO_${departments.length + 1}`,
                      name: '',
                      leaderName: '',
                      contactPhone: '',
                      description: '',
                      active: true,
                      memberCount: 0
                    });
                    setShowDeptModal(true);
                  }}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-xs shadow-sm flex items-center gap-1.5 transition-colors"
                >
                  <Plus size={15} /> Thêm Tổ chuyên môn
                </button>
                <button
                  onClick={() => {
                    if (confirm('Khôi phục danh sách tổ chuyên môn mặc định?')) {
                      setDepartments(resetDepartmentsToDefault());
                      showNotification('Đã khôi phục danh sách tổ mặc định!');
                    }
                  }}
                  className="px-3 py-2 border border-gray-300 hover:bg-gray-100 rounded-lg text-xs font-semibold text-gray-600 transition-colors flex items-center gap-1"
                >
                  <RotateCcw size={14} /> Mặc định
                </button>
              </div>
            </div>

            {/* DEPARTMENTS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {departments.map((dept) => (
                <div 
                  key={dept.id} 
                  className={`bg-white rounded-xl border p-5 shadow-xs transition-all relative flex flex-col justify-between ${
                    dept.active ? 'border-gray-200 hover:border-purple-300' : 'border-gray-200 bg-gray-50/60 opacity-75'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-sm">
                          {dept.code?.slice(0, 3) || 'TO'}
                        </div>
                        <div>
                          <h3 className="font-extrabold text-sm text-gray-900 flex items-center gap-2">
                            {dept.name}
                            <span className="font-mono text-[11px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                              {dept.code}
                            </span>
                          </h3>
                          <span className={`text-[11px] font-semibold flex items-center gap-1 mt-0.5 ${dept.active ? 'text-emerald-600' : 'text-gray-400'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${dept.active ? 'bg-emerald-500' : 'bg-gray-400'}`}></span>
                            {dept.active ? 'Đang hoạt động' : 'Tạm ngưng'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingDept({ ...dept });
                            setShowDeptModal(true);
                          }}
                          className="p-1.5 text-gray-500 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors"
                          title="Chỉnh sửa"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          onClick={() => handleDeleteDept(dept.id, dept.name)}
                          className="p-1.5 text-gray-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Xóa tổ"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-gray-600 mt-2 line-clamp-2 leading-relaxed">
                      {dept.description || 'Chưa có mô tả chức năng nhiệm vụ.'}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-1.5">
                      <UserCheck size={14} className="text-purple-600" />
                      <span className="font-medium">Đầu mối: <strong className="text-gray-800">{dept.leaderName || 'Chưa gán'}</strong></span>
                    </div>
                    {dept.contactPhone && (
                      <div className="flex items-center gap-1 font-mono text-gray-700">
                        <Phone size={12} className="text-gray-400" />
                        <span>{dept.contactPhone}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: ĐỊNH NGHĨA QUY TRÌNH & LUỒNG TỰ ĐỘNG (WORKFLOW & STEPS BUILDER) */}
        {/* ========================================================================= */}
        {activeMainTab === 'workflows' && (
          <div className="space-y-6 max-w-6xl mx-auto">
            
            {/* WORKFLOW SELECTOR BAR */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 w-full">
                <label className="text-xs font-bold text-gray-700 uppercase whitespace-nowrap">Chọn Quy trình:</label>
                <select
                  value={selectedWorkflowId}
                  onChange={(e) => handleSelectWorkflow(e.target.value)}
                  className="flex-1 max-w-md border border-gray-300 rounded-lg p-2 text-xs font-bold text-gray-900 outline-none focus:ring-2 focus:ring-purple-500 bg-gray-50"
                >
                  {workflows.map(wf => (
                    <option key={wf.id} value={wf.id}>
                      {wf.name} ({wf.sourceDept} ➔ {wf.targetDept})
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => {
                    const newWf: CoordinationWorkflow = {
                      id: `wf_${Date.now()}`,
                      code: `WF_CUSTOM_${workflows.length + 1}`,
                      name: 'Quy trình phối hợp mới',
                      sourceDept: departments[0]?.name || 'Tổ Cấp giấy',
                      targetDept: departments[1]?.name || 'Tổ Đo đạc',
                      description: 'Mô tả mục đích và yêu cầu quy trình phối hợp',
                      autoReturnToOrigin: true,
                      targetStatusOnReturn: 'Đang thực hiện',
                      notifyOnReturn: true,
                      active: true,
                      createdAt: new Date().toISOString(),
                      steps: [
                        {
                          id: `step_${Date.now()}_1`,
                          name: 'Tiếp nhận yêu cầu',
                          type: 'reception',
                          responsibleDept: departments[1]?.name || 'Tổ Đo đạc',
                          slaHours: 4,
                          slaDisplay: '4 giờ',
                          order: 1,
                          requireDocs: false,
                          allowRejection: true,
                          description: 'Tiếp nhận hồ sơ',
                          active: true
                        },
                        {
                          id: `step_${Date.now()}_2`,
                          name: 'Xác minh / Xử lý nghiệp vụ',
                          type: 'verification',
                          responsibleDept: departments[1]?.name || 'Tổ Đo đạc',
                          slaHours: 16,
                          slaDisplay: '2 ngày',
                          order: 2,
                          requireDocs: true,
                          allowRejection: false,
                          description: 'Xác minh hiện trạng',
                          active: true
                        },
                        {
                          id: `step_${Date.now()}_3`,
                          name: 'Kiểm tra & Trình ký lãnh đạo',
                          type: 'signing',
                          responsibleDept: departments[1]?.name || 'Tổ Đo đạc',
                          slaHours: 8,
                          slaDisplay: '1 ngày',
                          order: 3,
                          requireDocs: true,
                          allowRejection: true,
                          description: 'Ký duyệt kết quả',
                          active: true
                        },
                        {
                          id: `step_${Date.now()}_4`,
                          name: 'Tự động chuyển trả về Tổ ban đầu',
                          type: 'handover',
                          responsibleDept: departments[0]?.name || 'Tổ Cấp giấy',
                          slaHours: 4,
                          slaDisplay: '4 giờ',
                          order: 4,
                          requireDocs: false,
                          allowRejection: false,
                          description: 'Hoàn tất quy trình',
                          active: true
                        }
                      ]
                    };
                    setWorkflows([...workflows, newWf]);
                    setSelectedWorkflowId(newWf.id);
                    setEditingWorkflow(newWf);
                    showNotification('Đã thêm mẫu quy trình phối hợp mới!');
                  }}
                  className="px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 whitespace-nowrap"
                >
                  <Plus size={14} /> Thêm Quy trình
                </button>
              </div>

              <div className="flex items-center gap-2 self-end md:self-auto">
                <button
                  onClick={handleResetWorkflows}
                  className="px-3 py-2 border border-gray-300 hover:bg-gray-100 rounded-lg text-xs font-semibold text-gray-600 transition-colors flex items-center gap-1"
                >
                  <RotateCcw size={14} /> Khôi phục mẫu gốc
                </button>
                <button
                  onClick={handleSaveWorkflow}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition-colors"
                >
                  <Save size={15} /> Lưu Cấu hình Quy trình
                </button>
              </div>
            </div>

            {/* WORKFLOW SETTINGS & AUTOMATION CONFIG */}
            {editingWorkflow && (
              <div className="space-y-6">
                
                {/* GENERAL & AUTO-RETURN SETTINGS */}
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs space-y-4">
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-3">
                    <Sparkles size={16} className="text-purple-600" />
                    Thông tin Chung & Thiết lập Luồng Tự động Chuyển trả (Auto-Routing)
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Tên Quy trình Phối hợp</label>
                      <input
                        type="text"
                        value={editingWorkflow.name}
                        onChange={(e) => setEditingWorkflow({ ...editingWorkflow, name: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg p-2 text-xs font-bold text-gray-900 outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="VD: Quy trình Đo đạc - Cấp GCN"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Tổ Khởi tạo (Gốc)</label>
                      <select
                        value={editingWorkflow.sourceDept}
                        onChange={(e) => setEditingWorkflow({ ...editingWorkflow, sourceDept: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg p-2 text-xs font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        {departments.map(d => (
                          <option key={d.id} value={d.name}>{d.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Tổ Nhận phối hợp</label>
                      <select
                        value={editingWorkflow.targetDept}
                        onChange={(e) => setEditingWorkflow({ ...editingWorkflow, targetDept: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg p-2 text-xs font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        {departments.map(d => (
                          <option key={d.id} value={d.name}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Mô tả nghiệp vụ</label>
                    <input
                      type="text"
                      value={editingWorkflow.description || ''}
                      onChange={(e) => setEditingWorkflow({ ...editingWorkflow, description: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg p-2 text-xs text-gray-700 outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Mô tả tóm tắt trường hợp áp dụng quy trình này..."
                    />
                  </div>

                  {/* AUTO RETURN TOGGLE & POLICIES */}
                  <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-2">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center font-bold shrink-0 mt-0.5">
                        <Share2 size={16} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-purple-950 uppercase tracking-wide">
                          Tự động chuyển trả về Tổ ban đầu khi hoàn thành bước cuối
                        </div>
                        <p className="text-xs text-purple-800 mt-0.5">
                          Khi Tổ phối hợp hoàn tất ký duyệt / bước cuối, hệ thống tự động đổi trạng thái và bàn giao hồ sơ về lại cho Tổ khởi tạo.
                        </p>
                      </div>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={editingWorkflow.autoReturnToOrigin}
                        onChange={(e) => setEditingWorkflow({ ...editingWorkflow, autoReturnToOrigin: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  </div>
                </div>

                {/* VISUAL STEPS DESIGNER */}
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                        <Layers size={16} className="text-purple-600" />
                        Danh sách Các Bước Phối Hợp ({editingWorkflow.steps.length} bước)
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Định nghĩa các bước: Tiếp nhận ➔ Xác minh ➔ Kiểm tra ➔ Trình ký ➔ Chuyển trả.
                      </p>
                    </div>

                    <button
                      onClick={handleAddStep}
                      className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                    >
                      <Plus size={14} /> Thêm Bước
                    </button>
                  </div>

                  {/* STEP LIST */}
                  <div className="space-y-3">
                    {editingWorkflow.steps.map((step, idx) => (
                      <div 
                        key={step.id || idx}
                        className="border border-gray-200 rounded-xl p-4 bg-gray-50/50 hover:bg-white hover:border-purple-300 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                      >
                        {/* ORDER & DRAG */}
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="w-7 h-7 rounded-full bg-purple-600 text-white font-extrabold text-xs flex items-center justify-center shadow-xs">
                            {idx + 1}
                          </div>
                          
                          <div className="flex flex-col gap-0.5">
                            <button
                              onClick={() => handleMoveStep(idx, 'up')}
                              disabled={idx === 0}
                              className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                              title="Di chuyển lên"
                            >
                              <ArrowUp size={13} />
                            </button>
                            <button
                              onClick={() => handleMoveStep(idx, 'down')}
                              disabled={idx === editingWorkflow.steps.length - 1}
                              className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                              title="Di chuyển xuống"
                            >
                              <ArrowDown size={13} />
                            </button>
                          </div>
                        </div>

                        {/* STEP DETAILS EDIT */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 flex-1 w-full">
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-0.5">Tên bước</label>
                            <input
                              type="text"
                              value={step.name}
                              onChange={(e) => handleStepFieldChange(idx, 'name', e.target.value)}
                              className="w-full border border-gray-300 rounded-lg p-1.5 text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-0.5">Loại nghiệp vụ</label>
                            <select
                              value={step.type}
                              onChange={(e) => handleStepFieldChange(idx, 'type', e.target.value as any)}
                              className="w-full border border-gray-300 rounded-lg p-1.5 text-xs font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                            >
                              <option value="reception">Tiếp nhận & Phân công</option>
                              <option value="verification">Xác minh / Hiện trạng / Đo đạc</option>
                              <option value="inspection">Kiểm tra chuyên môn / Thẩm định</option>
                              <option value="signing">Trình ký / Phê duyệt</option>
                              <option value="handover">Bàn giao & Chuyển trả</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-0.5">Thời hạn SLA</label>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={step.slaDisplay}
                                onChange={(e) => handleStepFieldChange(idx, 'slaDisplay', e.target.value)}
                                className="w-full border border-gray-300 rounded-lg p-1.5 text-xs font-medium text-gray-800 outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                                placeholder="VD: 1 ngày / 4 giờ"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-0.5">Yêu cầu tài liệu đính kèm</label>
                            <div className="flex items-center gap-2 mt-1">
                              <input
                                type="checkbox"
                                id={`reqDoc_${idx}`}
                                checked={step.requireDocs ?? false}
                                onChange={(e) => handleStepFieldChange(idx, 'requireDocs', e.target.checked)}
                                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                              />
                              <label htmlFor={`reqDoc_${idx}`} className="text-xs text-gray-700 font-medium cursor-pointer">
                                Bắt buộc có tài liệu
                              </label>
                            </div>
                          </div>
                        </div>

                        {/* DELETE STEP BUTTON */}
                        <div className="self-end md:self-center shrink-0">
                          <button
                            onClick={() => handleDeleteStep(idx)}
                            className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Xóa bước này"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL: THÊM / SỬA TỔ CHUYÊN MÔN */}
      {/* ========================================================================= */}
      {showDeptModal && editingDept && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100 p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Building2 size={18} className="text-purple-600" />
                {editingDept.name ? 'Chỉnh sửa Tổ chuyên môn' : 'Thêm mới Tổ chuyên môn'}
              </h3>
              <button onClick={() => setShowDeptModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Tên Tổ chuyên môn *</label>
                <input
                  type="text"
                  value={editingDept.name}
                  onChange={(e) => setEditingDept({ ...editingDept, name: e.target.value })}
                  placeholder="VD: Tổ Đo đạc / Tổ Cấp giấy"
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-xs font-bold text-gray-900 outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Mã hiệu tổ *</label>
                <input
                  type="text"
                  value={editingDept.code}
                  onChange={(e) => setEditingDept({ ...editingDept, code: e.target.value.toUpperCase() })}
                  placeholder="VD: DODAC / CAPGIAY"
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-xs font-mono font-bold text-gray-900 outline-none focus:ring-2 focus:ring-purple-500 uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Tổ trưởng / Đầu mối</label>
                  <input
                    type="text"
                    value={editingDept.leaderName || ''}
                    onChange={(e) => setEditingDept({ ...editingDept, leaderName: e.target.value })}
                    placeholder="Họ tên cán bộ"
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-xs text-gray-800 outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Số điện thoại liên hệ</label>
                  <input
                    type="text"
                    value={editingDept.contactPhone || ''}
                    onChange={(e) => setEditingDept({ ...editingDept, contactPhone: e.target.value })}
                    placeholder="0901234567"
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-xs text-gray-800 outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Chức năng & Nhiệm vụ</label>
                <textarea
                  value={editingDept.description || ''}
                  onChange={(e) => setEditingDept({ ...editingDept, description: e.target.value })}
                  placeholder="Mô tả chức năng nhiệm vụ của tổ..."
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-xs text-gray-800 outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="deptActive"
                  checked={editingDept.active}
                  onChange={(e) => setEditingDept({ ...editingDept, active: e.target.checked })}
                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <label htmlFor="deptActive" className="text-xs text-gray-700 font-bold cursor-pointer">
                  Kích hoạt tổ này trong luồng phối hợp
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowDeptModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-xs font-medium"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSaveDepartment}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold shadow-sm"
                >
                  Lưu Tổ chuyên môn
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CHUYỂN BƯỚC PHỐI HỢP & DUYỆT TỰ ĐỘNG */}
      {/* ========================================================================= */}
      {advancingRecord && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100 p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <ArrowRight size={18} className="text-purple-600" />
                Chuyển bước phối hợp hồ sơ
              </h3>
              <button onClick={() => setAdvancingRecord(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-3.5">
                <div className="font-bold text-xs text-purple-950 flex items-center justify-between">
                  <span>Mã HS: <span className="font-mono text-purple-700">{advancingRecord.displayCode}</span></span>
                  <span>Chủ: {advancingRecord.ownerName}</span>
                </div>
                <div className="text-[11px] text-purple-800 mt-1">
                  Đang phối hợp: <strong>{advancingRecord.originalDept || 'Tổ gốc'} ➔ {advancingRecord.coordinationDept}</strong>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Nội dung ghi chú / Kết quả xử lý bước</label>
                <textarea
                  value={stepNoteInput}
                  onChange={(e) => setStepNoteInput(e.target.value)}
                  placeholder="Nhập kết quả xử lý (VD: Đã đo đạc thực tế, ranh giới đúng hiện trạng / Đã kiểm tra đối soát hồ sơ...)"
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-xs text-gray-800 outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Tài liệu / Bản vẽ đính kèm (Tùy chọn)</label>
                <input
                  type="text"
                  value={stepDocInput}
                  onChange={(e) => setStepDocInput(e.target.value)}
                  placeholder="Tên tệp đính kèm (VD: Bản vẽ trích đo số 12/2026.pdf)"
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-xs text-gray-800 outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex items-start gap-2">
                <CheckCircle2 size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Nếu đây là bước cuối cùng của quy trình, hệ thống sẽ <strong>tự động hoàn thành phối hợp và chuyển trả hồ sơ về {advancingRecord.originalDept || 'Tổ ban đầu'}</strong>.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setAdvancingRecord(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-xs font-medium"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleExecuteAdvanceStep}
                  disabled={isSubmittingAdvance}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmittingAdvance ? 'Đang xử lý...' : 'Xác nhận Chuyển bước'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InterDeptCoordinationView;
