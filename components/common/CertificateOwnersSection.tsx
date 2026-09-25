import React, { useEffect } from 'react';
import { CertificateOwnerItem } from '../../types';
import { Plus, Trash2, Users, UserCheck } from 'lucide-react';

interface CertificateOwnersSectionProps {
  owners?: CertificateOwnerItem[] | string | null;
  onChange?: (owners: CertificateOwnerItem[]) => void;
  // Dynamic default values from Applicant / Submitter (Người nộp hồ sơ)
  applicantName?: string;
  applicantCccd?: string;
  applicantPhone?: string;
  applicantAddress?: string;
  onSyncApplicant?: (owner1: CertificateOwnerItem) => void;
  readOnly?: boolean;
  className?: string;
}

export const parseCertificateOwners = (raw: CertificateOwnerItem[] | string | null | undefined): CertificateOwnerItem[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return [];
    }
  }
  return [];
};

export const CertificateOwnersSection: React.FC<CertificateOwnersSectionProps> = ({
  owners,
  onChange,
  applicantName = '',
  applicantCccd = '',
  applicantPhone = '',
  applicantAddress = '',
  onSyncApplicant,
  readOnly = false,
  className = ''
}) => {
  const parsedOwners = parseCertificateOwners(owners);

  // Auto initialize or sync Person #1 in real-time whenever applicant information changes
  useEffect(() => {
    if (!readOnly && onChange) {
      if (parsedOwners.length === 0) {
        if (applicantName || applicantCccd || applicantPhone || applicantAddress) {
          onChange([
            {
              id: 'owner_1',
              name: applicantName || '',
              cccd: applicantCccd || '',
              phone: applicantPhone || '',
              address: applicantAddress || ''
            }
          ]);
        }
      } else {
        const owner1 = parsedOwners[0];
        if (
          owner1 &&
          (owner1.name !== (applicantName || '') ||
           owner1.cccd !== (applicantCccd || '') ||
           owner1.phone !== (applicantPhone || '') ||
           owner1.address !== (applicantAddress || ''))
        ) {
          const updated = [...parsedOwners];
          updated[0] = {
            ...owner1,
            name: applicantName || '',
            cccd: applicantCccd || '',
            phone: applicantPhone || '',
            address: applicantAddress || ''
          };
          onChange(updated);
        }
      }
    }
  }, [applicantName, applicantCccd, applicantPhone, applicantAddress, readOnly]);

  const activeOwners = parsedOwners.length > 0 
    ? parsedOwners 
    : [
        {
          id: 'owner_1',
          name: applicantName || '',
          cccd: applicantCccd || '',
          phone: applicantPhone || '',
          address: applicantAddress || ''
        }
      ];

  const handleUpdate = (index: number, field: keyof CertificateOwnerItem, value: string) => {
    if (readOnly || !onChange) return;
    const nextList = activeOwners.map((item, idx) => {
      if (idx === index) {
        return { ...item, [field]: value };
      }
      return item;
    });
    onChange(nextList);

    // If Person #1 changed, optionally sync back to Applicant
    if (index === 0 && onSyncApplicant) {
      onSyncApplicant(nextList[0]);
    }
  };

  const handleAddOwner = () => {
    if (readOnly || !onChange) return;
    const newOwner: CertificateOwnerItem = {
      id: `owner_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: '',
      cccd: '',
      phone: '',
      address: ''
    };
    onChange([...activeOwners, newOwner]);
  };

  const handleRemoveOwner = (index: number) => {
    if (readOnly || !onChange) return;
    if (activeOwners.length <= 1) return; // Must keep at least 1 owner
    const nextList = activeOwners.filter((_, idx) => idx !== index);
    onChange(nextList);
  };

  return (
    <div className={`bg-white p-4 md:p-5 rounded-xl border border-blue-200 shadow-sm space-y-3 ${className}`}>
      <div className="flex flex-wrap justify-between items-center pb-2 border-b border-blue-100 gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
            <Users size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-blue-900 uppercase tracking-wide">
              Chủ hồ sơ
            </h3>
          </div>
        </div>

        {!readOnly && onChange && (
          <button
            type="button"
            onClick={handleAddOwner}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold rounded-lg transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={14} />
            <span>Thêm mới</span>
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-left border-collapse bg-white">
          <thead>
            <tr className="bg-blue-50/70 border-b border-blue-200 text-[11px] font-bold text-blue-900 uppercase tracking-wider">
              <th className="py-2.5 px-3 text-center w-12">#</th>
              <th className="py-2.5 px-3 min-w-[200px]">
                Họ tên chủ hồ sơ <span className="text-red-500">*</span>
              </th>
              <th className="py-2.5 px-3 w-40 min-w-[150px]">
                Giấy CMND / CCCD <span className="text-red-500">*</span>
              </th>
              <th className="py-2.5 px-3 w-36 min-w-[130px]">Số điện thoại</th>
              <th className="py-2.5 px-3 min-w-[220px]">Địa chỉ chủ sử dụng</th>
              {!readOnly && <th className="py-2.5 px-2 text-center w-12">Xóa</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {activeOwners.map((owner, idx) => (
              <tr key={owner.id || idx} className="hover:bg-blue-50/30 transition-colors">
                <td className="py-2 px-3 text-center font-bold text-blue-700 bg-blue-50/30">
                  {idx + 1}
                </td>
                <td className="py-2 px-3">
                  {readOnly ? (
                    <span className="font-bold text-slate-800">{owner.name || '—'}</span>
                  ) : (
                    <input
                      type="text"
                      required
                      value={owner.name}
                      onChange={(e) => handleUpdate(idx, 'name', e.target.value)}
                      placeholder="Nhập họ tên người đứng tên GCN..."
                      className="w-full px-2.5 py-1.5 text-xs font-bold text-slate-800 border border-slate-300 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  )}
                </td>
                <td className="py-2 px-3">
                  {readOnly ? (
                    <span className="font-mono text-slate-700">{owner.cccd || '—'}</span>
                  ) : (
                    <input
                      type="text"
                      required
                      value={owner.cccd}
                      onChange={(e) => handleUpdate(idx, 'cccd', e.target.value)}
                      placeholder="Số CMND/CCCD..."
                      className="w-full px-2.5 py-1.5 text-xs font-mono font-medium text-slate-800 border border-slate-300 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  )}
                </td>
                <td className="py-2 px-3">
                  {readOnly ? (
                    <span className="font-mono text-slate-700">{owner.phone || '—'}</span>
                  ) : (
                    <input
                      type="text"
                      value={owner.phone || ''}
                      onChange={(e) => handleUpdate(idx, 'phone', e.target.value)}
                      placeholder="Số điện thoại..."
                      className="w-full px-2.5 py-1.5 text-xs font-mono text-slate-800 border border-slate-300 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  )}
                </td>
                <td className="py-2 px-3">
                  {readOnly ? (
                    <span className="text-slate-700">{owner.address || '—'}</span>
                  ) : (
                    <input
                      type="text"
                      value={owner.address || ''}
                      onChange={(e) => handleUpdate(idx, 'address', e.target.value)}
                      placeholder="Địa chỉ thường trú / Nơi ở..."
                      className="w-full px-2.5 py-1.5 text-xs font-medium text-slate-800 border border-slate-300 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  )}
                </td>
                {!readOnly && (
                  <td className="py-2 px-2 text-center">
                    {idx > 0 ? (
                      <button
                        type="button"
                        onClick={() => handleRemoveOwner(idx)}
                        className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Xóa người đứng tên này"
                      >
                        <Trash2 size={15} />
                      </button>
                    ) : (
                      <span className="text-slate-300" title="Người số 1 bắt buộc không thể xóa">—</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
export default CertificateOwnersSection;
