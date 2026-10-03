import type { BusinessHour } from './types';
import { timeToMinutes, minutesToTime, nowMinutes } from './utils';

export function hoursFor(
  hours: BusinessHour[],
  professionalId: string | null,
  weekday: number
): BusinessHour | undefined {
  const own = hours.find((h) => h.professional_id === professionalId && h.weekday === weekday);
  if (own) return own;
  return hours.find((h) => h.professional_id === null && h.weekday === weekday);
}

export type SlotInput = {
  hours: BusinessHour[];
  professionalId: string;
  weekday: number;
  dateStr: string;
  durationMin: number;
  busy: { start_time: string; end_time: string }[]; // active appointments for this professional
  stepMin?: number;
};

export function computeSlots({
  hours,
  professionalId,
  weekday,
  dateStr,
  durationMin,
  busy,
  stepMin = 15,
}: SlotInput): string[] {
  const h = hoursFor(hours, professionalId, weekday);
  if (!h || h.closed) return [];
  const open = timeToMinutes(h.start_time);
  const close = timeToMinutes(h.end_time);
  const bStart = h.break_start ? timeToMinutes(h.break_start) : null;
  const bEnd = h.break_end ? timeToMinutes(h.break_end) : null;
  const isToday = dateStr === todayLocal();
  const nowM = nowMinutes();
  const result: string[] = [];

  for (let t = open; t + durationMin <= close; t += stepMin) {
    if (isToday && t < nowM) continue;
    if (bStart !== null && bEnd !== null && t < bEnd && t + durationMin > bStart) continue;
    const overlaps = busy.some((a) => {
      const s = timeToMinutes(a.start_time);
      const e = timeToMinutes(a.end_time);
      return t < e && t + durationMin > s;
    });
    if (!overlaps) result.push(minutesToTime(t));
  }
  return result;
}

export function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
