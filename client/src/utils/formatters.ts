export const formatTime = (date: Date): string => {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  });
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
  activatedTime: number,
  expire: number
): { minutesLeft: number; expiresAt: Date; expiresTimeStr: string } | null => {
  if (!activatedTime || !expire) return null;

  const expiresAt = new Date((activatedTime + expire) * 1000);
  const now = Date.now();
  const minutesLeft = Math.ceil((expiresAt.getTime() - now) / 60000);

  if (minutesLeft <= 0) return null;

  return {
    minutesLeft,
    expiresAt,
    expiresTimeStr: formatTime(expiresAt),
  };
};
