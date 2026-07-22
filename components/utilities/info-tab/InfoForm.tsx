import React from 'react';
import { FileText, User, Calendar, MapPin, UserCog, Hash, Building2, Settings, Eye, AlertCircle, CheckCircle } from 'lucide-react';
import { PhieuInfoData, PlanningConfig } from '../../../services/phieuInfoService';

interface ProviderConfig {
    name: string;
    title: string;
}

interface InfoFormProps {
    formData: PhieuInfoData;
    handleChange: (field: string, value: string) => void;
    providers: ProviderConfig[];
    handleProvider1Change: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    openProviderConfig: () => void;
    planningConfigs: PlanningConfig[];
    openPlanningConfig: () => void;
}

const InfoForm: React.FC<InfoFormProps> = ({ 
    formData, handleChange, 
    providers, handleProvider1Change, openProviderConfig,
    planningConfigs, openPlanningConfig
}) => {
    
    // Styling constants
    const labelClass = "block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 ml-1";
    const inputClass = "w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all";
    const iconClass = "absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none";

    return (
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6">
                
            {/* 1. Thông tin người yêu cầu */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                <h3 className="text-sm font-bold text-slate-800 uppercase mb-5 flex items-center gap-2">
                    <span className="p-1.5 bg-blue-100 text-blue-600 rounded-lg"><FileText size={16}/></span> 
                    Người yêu cầu cung cấp
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-1">
                        <label className={labelClass}>Họ tên người yêu cầu *</label>
                        <div className="relative">
                            <User size={16} className={iconClass} />
                            <input className={`${inputClass} font-bold text-blue-700 capitalize`} value={formData.Ten_Nguoi_Yeu_Cau} onChange={e => handleChange('Ten_Nguoi_Yeu_Cau', e.target.value)} />
                        </div>
                    </div>
                    <div className="md:col-span-1">
                        <label className={labelClass}>Ngày nộp phiếu *</label>
                        <div className="relative">
                            <Calendar size={16} className={iconClass} />
                            <input type="date" className={inputClass} value={formData.Ngay_Nop} onChange={e => handleChange('Ngay_Nop', e.target.value)} />
                        </div>
                    </div>
                    <div className="md:col-span-2">
                        <label className={labelClass}>Địa chỉ liên hệ</label>
                        <div className="relative">
                            <MapPin size={16} className={iconClass} />
                            <input className={inputClass} value={formData.Dia_Chi} onChange={e => handleChange('Dia_Chi', e.target.value)} />
                        </div>
                    </div>
                    
                    {/* PHẦN ỦY QUYỀN MỚI */}
                    <div className="md:col-span-2 bg-slate-50 p-4 rounded-xl border border-slate-200 mt-2">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-3 border-b border-slate-200 pb-2">
                            <UserCog size={14} /> Thông tin Ủy quyền (Nếu có)
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] text-slate-400 font-bold uppercase mb-1 block">Loại ủy quyền</label>
                                <div className="relative">
                                    <FileText size={14} className={iconClass} />
                                    <select className={`${inputClass} appearance-none bg-white`} value={formData.UQ_Loai} onChange={e => handleChange('UQ_Loai', e.target.value)}>
                                        <option value="">-- Không ủy quyền --</option>
                                        <option value="Giấy ủy quyền">Giấy ủy quyền</option>
                                        <option value="Hợp đồng ủy quyền">Hợp đồng ủy quyền</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-400 font-bold uppercase mb-1 block">Số công chứng (Kèm quyển số)</label>
                                <div className="relative">
                                    <Hash size={14} className={iconClass} />
                                    <input className={inputClass} placeholder="VD: 003305 quyển số 01/2025..." value={formData.UQ_So} onChange={e => handleChange('UQ_So', e.target.value)} />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-400 font-bold uppercase mb-1 block">Ngày công chứng</label>
                                <div className="relative">
                                    <Calendar size={14} className={iconClass} />
                                    <input type="date" className={inputClass} value={formData.UQ_Ngay} onChange={e => handleChange('UQ_Ngay', e.target.value)} />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-400 font-bold uppercase mb-1 block">Văn phòng công chứng</label>
                                <div className="relative">
                                    <Building2 size={14} className={iconClass} />
                                    <input className={inputClass} placeholder="VD: VPCC Nguyễn Cảnh" value={formData.UQ_VPCC} onChange={e => handleChange('UQ_VPCC', e.target.value)} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. Cấu hình người ký */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-orange-500"></div>
                <div className="flex justify-between items-center mb-5">
                    <h3 className="text-sm font-bold text-slate-800 uppercase flex items-center gap-2">
                        <span className="p-1.5 bg-orange-100 text-orange-600 rounded-lg"><User size={16}/></span>
                        Người cung cấp thông tin
                    </h3>
                    <button onClick={openProviderConfig} className="text-xs flex items-center gap-1 text-slate-500 hover:text-blue-600 bg-slate-50 px-2 py-1 rounded border border-slate-200 hover:bg-white hover:shadow-sm transition-all">
                        <Settings size={12}/> Cấu hình DS
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className={labelClass}>Người thứ 1 (Tổ trưởng/Phó)</label>
                        <div className="relative">
                            <User size={16} className={iconClass} />
                            <select className={`${inputClass} appearance-none bg-white cursor-pointer`} value={formData.Nguoi_1} onChange={handleProvider1Change}>
                                {providers.map((p, idx) => (
                                    <option key={idx} value={p.name}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="text-[10px] text-orange-600 mt-1 italic pl-1 font-medium">{formData.CV_1}</div>
                    </div>
                    <div>
                        <label className={labelClass}>Người thứ 2 (Nhân viên)</label>
                        <div className="relative">
                            <User size={16} className={iconClass} />
                            <input className={`${inputClass} bg-gray-50 text-gray-500 font-medium cursor-not-allowed`} value={formData.Nguoi_2} readOnly />
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. Thông tin Thửa đất */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                <h3 className="text-sm font-bold text-slate-800 uppercase mb-5 flex items-center gap-2">
                    <span className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg"><MapPin size={16}/></span> 
                    Thông tin Thửa đất
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                        <label className={labelClass}>Tên Chủ Sử Dụng (trên GCN)</label>
                        <div className="relative">
                            <User size={16} className={iconClass} />
                            <input className={`${inputClass} font-bold uppercase`} value={formData.Ten_CSD} onChange={e => handleChange('Ten_CSD', e.target.value)} />
                        </div>
                    </div>
                    <div>
                        <label className={labelClass}>Xã / Phường *</label>
                        <div className="relative">
                            <MapPin size={16} className={iconClass} />
                            <select className={`${inputClass} appearance-none bg-white cursor-pointer`} value={formData.Phuong} onChange={e => handleChange('Phuong', e.target.value)}>
                                <option value="thị trấn Tân Khai">Tân Khai</option>
                                <option value="xã Tân Quan">Tân Quan</option>
                                <option value="xã Minh Đức">Minh Đức</option>
                                <option value="xã Tân Hưng">Tân Hưng</option>
                            </select>
                        </div>
                    </div>
                    <div className="md:col-span-3">
                        <label className={labelClass}>Địa chỉ thửa đất</label>
                        <div className="relative">
                            <MapPin size={16} className={iconClass} />
                            <input className={inputClass} value={formData.Dia_Chi_Thua_Dat} onChange={e => handleChange('Dia_Chi_Thua_Dat', e.target.value)} />
                        </div>
                    </div>
                    
                    {/* Block: GCN Cũ */}
                    <div className="md:col-span-3 rounded-xl border border-slate-200 overflow-hidden">
                        <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase flex items-center gap-2">
                            <FileText size={14}/> Theo Giấy Chứng Nhận (Cũ)
                        </div>
                        <div className="p-3 grid grid-cols-12 gap-3 bg-white">
                            <div className="col-span-3">
                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Tờ cũ</label>
                                <input className="w-full border border-slate-200 rounded-lg p-2 text-sm font-bold text-center outline-none focus:border-blue-500" value={formData.To_Cu} onChange={e => handleChange('To_Cu', e.target.value)} />
                            </div>
                            <div className="col-span-3">
                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Thửa cũ</label>
                                <input className="w-full border border-slate-200 rounded-lg p-2 text-sm font-bold text-center outline-none focus:border-blue-500" value={formData.Thua_Cu} onChange={e => handleChange('Thua_Cu', e.target.value)} />
                            </div>
                            <div className="col-span-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Tổng DT</label>
                                <input className="w-full border border-slate-200 rounded-lg p-2 text-sm font-bold text-center outline-none focus:border-blue-500" value={formData.DT_Cu} onChange={e => handleChange('DT_Cu', e.target.value)} />
                            </div>
                            <div className="col-span-2">
                                <label className="text-[10px] font-bold text-blue-500 uppercase mb-1 block">Đất Ở</label>
                                <input className="w-full border border-blue-200 rounded-lg p-2 text-sm font-bold text-center text-blue-700 outline-none focus:border-blue-500" value={formData.DT_ODT} onChange={e => handleChange('DT_ODT', e.target.value)} />
                            </div>
                            <div className="col-span-2">
                                <label className="text-[10px] font-bold text-emerald-500 uppercase mb-1 block">Đất NN</label>
                                <div className="w-full border border-emerald-200 bg-emerald-50 rounded-lg p-2 text-sm font-bold text-center text-emerald-700 h-[38px] flex items-center justify-center cursor-not-allowed">
                                    {formData.DT_CLN}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Block: Hiện trạng mới */}
                    <div className="md:col-span-3 rounded-xl border border-indigo-200 overflow-hidden">
                        <div className="bg-indigo-50 px-3 py-2 border-b border-indigo-200 text-xs font-bold text-indigo-700 uppercase flex items-center gap-2">
                            <Hash size={14}/> Theo Hiện trạng mới (2024)
                        </div>
                        <div className="p-3 grid grid-cols-4 gap-3 bg-white">
                            <div><label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Tờ 2024</label><input className="w-full border border-slate-200 rounded-lg p-2 text-sm text-center outline-none focus:border-indigo-500" value={formData.To_2024} onChange={e => handleChange('To_2024', e.target.value)} /></div>
                            <div><label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Thửa 2024</label><input className="w-full border border-slate-200 rounded-lg p-2 text-sm text-center outline-none focus:border-indigo-500" value={formData.Thua_2024} onChange={e => handleChange('Thua_2024', e.target.value)} /></div>
                            <div><label className="text-[10px] font-bold text-purple-600 uppercase mb-1 block">Tờ 106</label><input className="w-full border border-purple-200 bg-purple-50 rounded-lg p-2 text-sm text-center font-bold text-purple-700 outline-none focus:border-purple-500" value={formData.To_106} onChange={e => handleChange('To_106', e.target.value)} placeholder="(Nếu có)"/></div>
                            <div><label className="text-[10px] font-bold text-blue-600 uppercase mb-1 block">DT Mới</label><input className="w-full border border-blue-200 bg-blue-50 rounded-lg p-2 text-sm text-center font-bold text-blue-700 outline-none focus:border-blue-500" value={formData.DT_Moi} onChange={e => handleChange('DT_Moi', e.target.value)} /></div>
                        </div>
                    </div>

                    {/* Block: Thu hồi */}
                    <div className="md:col-span-3 flex gap-4">
                        <div className="flex-1">
                            <label className={labelClass}>Số Thông báo Thu hồi (TBTH)</label>
                            <div className="relative">
                                <AlertCircle size={16} className={iconClass} />
                                <input className={inputClass} value={formData.TBTH} onChange={e => handleChange('TBTH', e.target.value)} placeholder="Nhập số TB..." />
                            </div>
                        </div>
                        <div className="flex-1">
                            <label className={labelClass}>Số Quyết định Thu hồi (QĐTH)</label>
                            <div className="relative">
                                <CheckCircle size={16} className={iconClass} />
                                <input className={inputClass} value={formData.QDTH} onChange={e => handleChange('QDTH', e.target.value)} placeholder="Nhập số QĐ..." />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 4. Quy hoạch (DYNAMIC RENDERING) */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-purple-500"></div>
                <div className="flex justify-between items-center mb-5">
                    <h3 className="text-sm font-bold text-slate-800 uppercase flex items-center gap-2">
                        <span className="p-1.5 bg-purple-100 text-purple-600 rounded-lg"><Eye size={16}/></span> 
                        Thông tin Quy hoạch
                    </h3>
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button onClick={openPlanningConfig} className="flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-md bg-white text-purple-700 shadow-sm border border-purple-100 hover:bg-purple-50 transition-all">
                            <Settings size={12}/> Cài đặt
                        </button>
                    </div>
                </div>
                
                <div className="space-y-4">
                    {/* Map over dynamic planningConfigs */}
                    {planningConfigs.map((cfg) => (
                        <div key={cfg.key} className="bg-slate-50/50 p-3 rounded-xl border border-slate-100 hover:border-purple-200 transition-colors">
                            <div className="flex justify-between mb-1.5">
                                <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">{cfg.Label}</span>
                                <span className="text-[10px] text-slate-400 italic truncate max-w-[250px]" title={cfg.TenDoAn}>{cfg.TenDoAn}</span>
                            </div>
                            <input 
                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none bg-white transition-all" 
                                placeholder={`Nhập nội dung quy hoạch...`}
                                value={(formData as any)[`${cfg.key}_Value`] || ''}
                                onChange={e => handleChange(`${cfg.key}_Value`, e.target.value)}
                            />
                        </div>
                    ))}
                    {planningConfigs.length === 0 && (
                        <div className="text-center p-4 text-xs text-gray-400 italic bg-gray-50 rounded-lg">
                            Chưa có cấu hình quy hoạch. Bấm "Cài đặt" để thêm.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default InfoForm;