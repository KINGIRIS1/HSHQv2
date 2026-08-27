import { WorkflowStep } from '../types';

/**
 * Parses a display SLA string (e.g., "4 giờ", "1 ngày", "1.5 ngày", "12h", "3 ngày", "4h") into working hours (8 hours/day).
 */
export function parseSlaToHours(display: string): number {
  if (!display) return 8;
  const clean = display.toString().trim().toLowerCase();
  
  // Check for day(s)
  const dayMatch = clean.match(/^([0-9.,]+)\s*(ngày|ngay|d)/);
  if (dayMatch) {
    const days = parseFloat(dayMatch[1].replace(',', '.'));
    return isNaN(days) ? 8 : Math.round(days * 8);
  }

  // Check for hour(s)
  const hourMatch = clean.match(/^([0-9.,]+)\s*(giờ|gio|h)/);
  if (hourMatch) {
    const hours = parseFloat(hourMatch[1].replace(',', '.'));
    return isNaN(hours) ? 8 : Math.round(hours);
  }

  const num = parseFloat(clean.replace(',', '.'));
  if (!isNaN(num)) {
    if (num <= 3) return num * 8;
    return num;
  }

  return 8;
}

/**
 * Formats working hours into a clean display string (e.g. 8 hours -> "1 ngày", 4 hours -> "4 giờ", 12 hours -> "1.5 ngày").
 */
export function formatHoursToSla(hours: number): string {
  if (hours <= 0) return '0 giờ';
  if (hours % 8 === 0) {
    const days = hours / 8;
    return days === 1 ? '1 ngày' : `${days} ngày`;
  }
  if (hours < 8) {
    return `${hours} giờ`;
  }
  const days = hours / 8;
  return `${days} ngày`;
}

export const WORKING_HOURS_PER_DAY = 8;

export function addWorkingHours(startDate: Date, hoursToAdd: number): Date {
  let currentDate = new Date(startDate.getTime());
  let remainingHours = hoursToAdd;

  while (remainingHours > 0) {
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      currentDate.setDate(currentDate.getDate() + (dayOfWeek === 6 ? 2 : 1));
      currentDate.setHours(7, 30, 0, 0);
      continue;
    }

    const h = currentDate.getHours();
    const m = currentDate.getMinutes();
    const currentTimeInMinutes = h * 60 + m;

    const mornStart = 7 * 60 + 30;   // 07:30
    const mornEnd = 11 * 60 + 30;    // 11:30
    const noonStart = 13 * 60 + 30;  // 13:30
    const noonEnd = 17 * 60 + 30;    // 17:30

    if (currentTimeInMinutes < mornStart) {
      currentDate.setHours(7, 30, 0, 0);
      continue;
    } else if (currentTimeInMinutes >= mornEnd && currentTimeInMinutes < noonStart) {
      currentDate.setHours(13, 30, 0, 0);
      continue;
    } else if (currentTimeInMinutes >= noonEnd) {
      currentDate.setDate(currentDate.getDate() + 1);
      currentDate.setHours(7, 30, 0, 0);
      continue;
    }

    let minutesLeftInBlock = 0;
    if (currentTimeInMinutes >= mornStart && currentTimeInMinutes < mornEnd) {
      minutesLeftInBlock = mornEnd - currentTimeInMinutes;
    } else if (currentTimeInMinutes >= noonStart && currentTimeInMinutes < noonEnd) {
      minutesLeftInBlock = noonEnd - currentTimeInMinutes;
    }

    const hoursLeftInBlock = minutesLeftInBlock / 60;
    if (remainingHours <= hoursLeftInBlock) {
      currentDate = new Date(currentDate.getTime() + remainingHours * 3600 * 1000);
      remainingHours = 0;
    } else {
      remainingHours -= hoursLeftInBlock;
      if (currentTimeInMinutes < mornEnd) {
        currentDate.setHours(13, 30, 0, 0);
      } else {
        currentDate.setDate(currentDate.getDate() + 1);
        currentDate.setHours(7, 30, 0, 0);
      }
    }
  }

  return currentDate;
}

export type SlaStatusType = 'ontime' | 'warning' | 'overdue';

export interface SlaStatusResult {
  status: SlaStatusType;
  label: string;
  colorClass: string;
  badgeClass: string;
}

export function calculateSlaStatus(deadlineDateStr?: string | null, completedDateStr?: string | null): SlaStatusResult {
  if (!deadlineDateStr) {
    return { status: 'ontime', label: 'Đúng hạn', colorClass: 'text-emerald-600', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  }

  const deadline = new Date(deadlineDateStr);
  const now = completedDateStr ? new Date(completedDateStr) : new Date();

  if (isNaN(deadline.getTime())) {
    return { status: 'ontime', label: 'Đúng hạn', colorClass: 'text-emerald-600', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  }

  const diffMs = deadline.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 0 && !completedDateStr) {
    return { status: 'overdue', label: 'Quá hạn', colorClass: 'text-rose-600', badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse' };
  } else if (diffHours <= 8 && diffHours >= 0 && !completedDateStr) {
    return { status: 'warning', label: 'Sắp đến hạn', colorClass: 'text-amber-600', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' };
  }

  return { status: 'ontime', label: 'Đúng hạn', colorClass: 'text-emerald-600', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
}
