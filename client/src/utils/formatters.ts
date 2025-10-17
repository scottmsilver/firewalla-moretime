export const formatTime = (date: Date, timezone?: string): string => {
  // Always use the timezone if provided, otherwise format in browser's local timezone
  try {
    const formatted = date.toLocaleTimeString('en-US', {
      timeZone: timezone || undefined, // Use undefined to let browser use local timezone
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    // Convert "10:30 AM" to "10:30a"
    return formatted.replace(' AM', 'a').replace(' PM', 'p');
  } catch (error) {
    console.error('Error formatting time:', error, 'timezone:', timezone);
    // Fallback to simple formatting
    const hour = date.getHours();
    const minute = date.getMinutes();
    const hour12 = hour % 12 || 12;
    const ampm = hour >= 12 ? 'p' : 'a';
    const minuteStr = minute.toString().padStart(2, '0');
    return `${hour12}:${minuteStr}${ampm}`;
  }
};

export const formatDateTime = (date: Date): string => {
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  });
};

export const formatSchedule = (cronTime: string, duration: number): string => {
  if (!cronTime) return 'No schedule';

  const parts = cronTime.split(' ');
  if (parts.length < 2) return cronTime;

  const minute = parseInt(parts[0]);
  const hour24 = parseInt(parts[1]);

  // cronTime is already in Firewalla's local timezone, just format it nicely
  // Convert to 12-hour format
  const hour12 = hour24 % 12 || 12;
  const ampm = hour24 >= 12 ? 'p' : 'a';
  // Only show minutes if not :00
  const time = minute === 0 ? `${hour12}${ampm}` : `${hour12}:${minute.toString().padStart(2, '0')}${ampm}`;

  const hours = Math.floor(duration / 3600);
  const mins = Math.floor((duration % 3600) / 60);

  // Build duration string with fractions for common intervals
  let durationStr = '';
  if (hours > 0) {
    const hourWord = hours === 1 ? 'hour' : 'hours';
    if (mins === 0) {
      durationStr = `${hours} ${hourWord}`;
    } else if (mins === 15) {
      durationStr = `${hours}¼ ${hourWord}`;
    } else if (mins === 30) {
      durationStr = `${hours}½ ${hourWord}`;
    } else if (mins === 45) {
      durationStr = `${hours}¾ ${hourWord}`;
    } else {
      durationStr = `${hours}h ${mins}m`;
    }
  } else {
    // For durations under 1 hour
    if (mins === 15) {
      durationStr = '¼ hour';
    } else if (mins === 30) {
      durationStr = '½ hour';
    } else if (mins === 45) {
      durationStr = '¾ hour';
    } else {
      durationStr = `${mins}m`;
    }
  }

  return `Blocks at ${time} for ${durationStr}`;
};

export const calculateExpirationInfo = (
  idleTs: number | null,
  timezone?: string
): { minutesLeft: number; expiresAt: Date; expiresTimeStr: string } | null => {
  if (!idleTs) return null;

  const expiresAt = new Date(idleTs * 1000);
  const now = Date.now();
  const minutesLeft = Math.ceil((expiresAt.getTime() - now) / 60000);

  if (minutesLeft <= 0) return null;

  return {
    minutesLeft,
    expiresAt,
    expiresTimeStr: formatTime(expiresAt, timezone),
  };
};
