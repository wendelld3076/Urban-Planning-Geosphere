import tzlookup from 'tz-lookup';
import { LocationPreset } from '../types';

export function getUtcOffsetForTimeZone(timeZone: string, date: Date = new Date()): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false
    });
    
    const parts = formatter.formatToParts(date);
    const getPart = (type: string) => {
      const val = parts.find(p => p.type === type)?.value;
      return val ? parseInt(val, 10) : 0;
    };
    
    const year = getPart('year');
    const month = getPart('month') - 1; // 0-indexed
    const day = getPart('day');
    const hour = getPart('hour') % 24;
    const minute = getPart('minute');
    const second = getPart('second');
    
    const targetUtcTime = Date.UTC(year, month, day, hour, minute, second);
    const actualUtcTime = date.getTime();
    
    return (targetUtcTime - actualUtcTime) / (1000 * 60 * 60);
  } catch (err) {
    console.error('Error getting offset for timezone', timeZone, err);
    return 0;
  }
}

export function getActiveTimezoneOffset(mode: string, preset: LocationPreset | null): number {
  if (mode === 'local') {
    return -(new Date().getTimezoneOffset() / 60);
  }
  if (mode === 'auto') {
    if (preset) {
      try {
        const iana = tzlookup(preset.latitude, preset.longitude);
        return getUtcOffsetForTimeZone(iana);
      } catch (e) {
        return Math.round(preset.longitude / 15);
      }
    }
    // Default to device/browser local timezone offset
    return -(new Date().getTimezoneOffset() / 60);
  }
  const parsed = parseFloat(mode);
  return isNaN(parsed) ? 0 : parsed;
}
