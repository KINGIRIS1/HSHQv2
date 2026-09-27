import React from 'react';

interface CertificateOwnersSectionProps {
    owners?: any[] | string | null;
    onChange?: (owners: any[]) => void;
    applicantName?: string;
    applicantCccd?: string;
    applicantPhone?: string;
    applicantAddress?: string;
    onSyncApplicant?: (owner1: any) => void;
}

export const CertificateOwnersSection: React.FC<CertificateOwnersSectionProps> = ({ owners = [], onChange, onSyncApplicant }) => {
    const list = Array.isArray(owners) ? owners : [];
    return (
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-700 uppercase">Thông tin chủ sử dụng / sở hữu (GCN)</h4>
                {onSyncApplicant && list.length > 0 && (
                    <button
                        type="button"
                        onClick={() => onSyncApplicant(list[0])}
                        className="text-[11px] font-bold text-blue-600 hover:text-blue-800"
                    >
                        Đồng bộ từ chủ đầu tiên
                    </button>
                )}
            </div>
            <div className="text-xs text-slate-600">
                {list.length > 0 ? (
                    <div className="space-y-1">
                        {list.map((owner: any, idx: number) => (
                            <div key={idx} className="p-2 bg-white rounded-lg border border-slate-200 flex justify-between items-center">
                                <div>
                                    <span className="font-bold text-slate-800">{owner.name || '---'}</span>
                                    <span className="text-slate-500 ml-2">CCCD: {owner.cccd || '---'} | SĐT: {owner.phone || '---'}</span>
                                </div>
                                {onChange && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const updated = list.filter((_, i) => i !== idx);
                                            onChange(updated);
                                        }}
                                        className="text-red-500 hover:text-red-700 text-xs"
                                    >
                                        Xóa
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="italic text-slate-400">Chưa có thông tin chủ sở hữu GCN</p>
                )}
            </div>
        </div>
    );
};

export default CertificateOwnersSection;
