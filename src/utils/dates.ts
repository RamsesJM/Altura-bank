export const BANK_TIME_ZONE = 'America/Santo_Domingo';

const partsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BANK_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const readableFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: BANK_TIME_ZONE,
  dateStyle: 'medium',
});

function dateParts(iso: string): Record<string, string> {
  return Object.fromEntries(
    partsFormatter.formatToParts(new Date(iso)).map((part) => [part.type, part.value]),
  );
}

export function bankDateKey(iso: string): string {
  const { year, month, day } = dateParts(iso);
  return `${year}-${month}-${day}`;
}

export function formatBankDate(iso: string): string {
  return readableFormatter.format(new Date(iso));
}

export function formatBankDateTime(iso: string): string {
  const { year, month, day, hour, minute } = dateParts(iso);
  return `${year}-${month}-${day} ${hour}:${minute}`;
}
