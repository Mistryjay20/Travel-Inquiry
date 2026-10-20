import React from 'react';
import { InquiryStatus } from '../types/index.ts';

interface StatusBadgeProps {
  status: InquiryStatus;
  interactive?: boolean;
  onChangeStatus?: (status: InquiryStatus) => void;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  if (status === 'confirmed') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Confirmed (C)
      </span>
    );
  }

  if (status === 'cancelled') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
        Cancelled (x)
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
      Inquiry (I)
    </span>
  );
};
