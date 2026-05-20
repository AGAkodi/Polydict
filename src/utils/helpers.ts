/**
 * Format numbers as readable volume or currency
 */
export function formatVolume(num: number): string {
  if (!num || isNaN(num)) return '$0';
  if (num >= 1_000_000) {
    return `$${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `$${(num / 1_000).toFixed(1)}K`;
  }
  return `$${num.toFixed(0)}`;
}

export interface CountdownInfo {
  label: string;
  daysLeft: number;
  severity: 'red' | 'amber' | 'gray' | 'closed';
}

/**
 * Returns formatted countdown and styling severity based on remaining hours/days
 */
export function getCountdown(endDateIso: string): CountdownInfo {
  if (!endDateIso) {
    return { label: '--', daysLeft: 999, severity: 'gray' };
  }

  const now = new Date();
  const end = new Date(endDateIso);
  const diffMs = end.getTime() - now.getTime();

  if (diffMs <= 0) {
    return { label: 'CLOSED', daysLeft: 0, severity: 'closed' };
  }

  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays >= 7) {
    return {
      label: `${diffDays}d left`,
      daysLeft: diffDays,
      severity: 'gray',
    };
  } else if (diffDays >= 1) {
    return {
      label: `${diffDays}d left`,
      daysLeft: diffDays,
      severity: 'amber',
    };
  } else if (diffHours >= 1) {
    return {
      label: `${diffHours}h left`,
      daysLeft: 0,
      severity: 'red',
    };
  } else {
    return {
      label: `${diffMins}m left`,
      daysLeft: 0,
      severity: 'red',
    };
  }
}

/**
 * Formats full timestamp for last updated string
 */
export function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
