
import React from 'react';
import { User, FileText, MapPin, Hash, Calendar, Building2 } from 'lucide-react';

interface VPHCFormProps {
    formData: any;
    handleChange: (field: string, value: string) => void;
}

const VPHCForm: React.FC<VPHCFormProps> = ({ formData, handleChange }) => {
    
    const labelClass = "block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 ml-1";
    const inputClass = "w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all";
    const iconClass = "absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none";

    const WARDS = [
        "xã Tân Quan",
        "thị trấn Tân Khai", 
        "xã Minh Đức",
    "xã Tân Hưng"
    ];

    return (
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6 pb-20">
            {/* 1. THÔNG TIN CÁ NHÂN VI PHẠM */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                <h3 className="text-sm font-bold text-slate-800 uppercase mb-5 flex items-center gap-2">
                    <span className="p-1.5 bg-red-100 text-red-600 rounded-lg"><User size={16}/></span> 
                    Thông tin cá nhân
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <label className={labelClass}>Họ và tên</label>
                        <div className="relative">
                            <User size={16} className={iconClass} />
                            <input className={`${inputClass} font-bold uppercase text-red-700`} value={formData.NGUOI} onChange={e => handleChange('NGUOI', e.target.value)} />
                        </div>
                    </div>
                    <div>
                        <label className={labelClass}>Giới tính</label>
                        <select className={`${inputClass} pl-3`} value={formData.GIOITINH} onChange={e => handleChange('GIOITINH', e.target.value)}>
                            <option value="Nam">Nam</option>
                            <option value="Nữ">Nữ</option>
                        </select>
                    </div>
                    <div>
                        <label className={labelClass}>Ngày sinh</label>
                        <div className="relative">
                            <Calendar size={16} className={iconClass} />
                            <input className={inputClass} placeholder="dd/mm/yyyy" value={formData.NGAYSINH} onChange={e => handleChange('NGAYSINH', e.target.value)} />
                        </div>
                    </div>
                    <div>
                        <label className={labelClass}>CCCD / CMND</label>
                        <div className="relative">
                            <Hash size={16} className={iconClass} />
                            <input className={inputClass} value={formData.CCCD} onChange={e => handleChange('CCCD', e.target.value)} />
                        </div>
                    </div>
                    <div>
                        <label className={labelClass}>Ngày cấp</label>
                        <div className="relative">
                            <Calendar size={16} className={iconClass} />
                            <input className={inputClass} placeholder="dd/mm/yyyy" value={formData.NGAYCAP} onChange={e => handleChange('NGAYCAP', e.target.value)} />
                        </div>
                    </div>
                    <div className="md:col-span-2">
                        <label className={labelClass}>Nơi cấp</label>
                        <div className="relative">
                            <Building2 size={16} className={iconClass} />
                            <input className={inputClass} value={formData.NOICAP} onChange={e => handleChange('NOICAP', e.target.value)} />
                        </div>
                    </div>
                    <div className="md:col-span-2">
                        <label className={labelClass}>Nơi ở hiện tại</label>
                        <div className="relative">
                            <MapPin size={16} className={iconClass} />
                            <input className={inputClass} value={formData.NOIO} onChange={e => handleChange('NOIO', e.target.value)} />
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. THÔNG TIN THỬA ĐẤT */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-green-500"></div>
                <h3 className="text-sm font-bold text-slate-800 uppercase mb-5 flex items-center gap-2">
                    <span className="p-1.5 bg-green-100 text-green-600 rounded-lg"><MapPin size={16}/></span> 
                    Thông tin Thửa đất & GCN
                </h3>
                <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-3">
                        <label className={labelClass}>Xã / Phường</label>
                        <select className={`${inputClass} pl-3`} value={formData.XA_PHUONG} onChange={e => handleChange('XA_PHUONG', e.target.value)}>
                            {WARDS.map(w => <option key={w} value={w}>{w}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={labelClass}>Thửa số</label>
                        <input className={`${inputClass} text-center font-bold`} value={formData.THUA} onChange={e => handleChange('THUA', e.target.value)} />
                    </div>
                    <div>
                        <label className={labelClass}>Tờ bản đồ</label>
                        <input className={`${inputClass} text-center font-bold`} value={formData.TO} onChange={e => handleChange('TO', e.target.value)} />
                    </div>
                    <div>
                        <label className={labelClass}>Diện tích (m2)</label>
                        <input className={`${inputClass} text-center font-bold`} value={formData.DT} onChange={e => handleChange('DT', e.target.value)} />
                    </div>
                    <div className="col-span-3">
                        <label className={labelClass}>Địa chỉ thửa đất (Ấp/Khu phố)</label>
                        <div className="relative">
                            <MapPin size={16} className={iconClass} />
                            <input className={inputClass} value={formData.DC_THUA} onChange={e => handleChange('DC_THUA', e.target.value)} placeholder="Nhập tên Ấp hoặc Khu phố..." />
                        </div>
                    </div>
                    
                    <div className="col-span-3 border-t pt-3 mt-1">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>Số phát hành GCN</label>
                                <input className={inputClass} value={formData.SPH} onChange={e => handleChange('SPH', e.target.value)} />
                            </div>
                            <div>
                                <label className={labelClass}>Số vào sổ</label>
                                <input className={inputClass} value={formData.SVS} onChange={e => handleChange('SVS', e.target.value)} />
                            </div>
                            <div>
                                <label className={labelClass}>Ngày cấp GCN</label>
                                <input className={inputClass} placeholder="dd/mm/yyyy" value={formData.NGAYCAPGCN} onChange={e => handleChange('NGAYCAPGCN', e.target.value)} />
                            </div>
                            <div>
                                <label className={labelClass}>Cơ quan cấp</label>
                                <input className={inputClass} value={formData.COQUANCAP} onChange={e => handleChange('COQUANCAP', e.target.value)} />
                            </div>
                            <div className="col-span-2">
                                <label className={labelClass}>Chủ sử dụng trên GCN (Nếu khác)</label>
                                <input className={`${inputClass} font-bold uppercase`} value={formData.CHUSDGCN} onChange={e => handleChange('CHUSDGCN', e.target.value)} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. THÔNG TIN VỤ VIỆC */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-orange-500"></div>
                <h3 className="text-sm font-bold text-slate-800 uppercase mb-5 flex items-center gap-2">
                    <span className="p-1.5 bg-orange-100 text-orange-600 rounded-lg"><FileText size={16}/></span> 
                    Thông tin vụ việc & Hợp đồng
                </h3>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={labelClass}>Loại hồ sơ / Hợp đồng</label>
                        <select className={inputClass} value={formData.LOAIHS} onChange={e => handleChange('LOAIHS', e.target.value)}>
                            <option value="chuyển nhượng">Chuyển nhượng</option>
                            <option value="tặng cho">Tặng cho</option>
                            <option value="thừa kế">Thừa kế</option>
                        </select>
                    </div>
                    <div>
                        <label className={labelClass}>Thời gian xảy ra</label>
                        <input className={inputClass} placeholder="ngày ... tháng ..." value={formData.TGXRVV} onChange={e => handleChange('TGXRVV', e.target.value)} />
                    </div>
                    <div>
                        <label className={labelClass}>Số công chứng</label>
                        <input className={inputClass} value={formData.SOCC} onChange={e => handleChange('SOCC', e.target.value)} />
                    </div>
                    <div>
                        <label className={labelClass}>Ngày công chứng</label>
                        <input className={inputClass} placeholder="dd/mm/yyyy" value={formData.NGAYCC} onChange={e => handleChange('NGAYCC', e.target.value)} />
                    </div>
                    <div className="col-span-2">
                        <label className={labelClass}>Văn phòng công chứng</label>
                        <input className={inputClass} value={formData.VPCC} onChange={e => handleChange('VPCC', e.target.value)} />
                    </div>
                    <div className="col-span-2">
                        <label className={labelClass}>Số biên bản (Cho Mẫu 02)</label>
                        <div className="relative">
                            <Hash size={16} className={iconClass} />
                            <input className={inputClass} value={formData.STT} onChange={e => handleChange('STT', e.target.value)} placeholder="01/BBLV" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VPHCForm;
