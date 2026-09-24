// Generates the small static assets: registration QR (ink-on-transparent SVG)
// and an all-day .ics so people can drop both days into their calendar.
import QRCode from 'qrcode';
import { writeFileSync } from 'node:fs';

export const REGISTER_URL = 'https://forms.gle/512N3yDsMZzTYqtH9';

const svg = await QRCode.toString(REGISTER_URL, {
  type: 'svg', margin: 0, errorCorrectionLevel: 'M',
  color: { dark: '#0a1633', light: '#0000' },
});
writeFileSync('public/register-qr.svg', svg);

const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
const ics = [
  'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//IGNUZ26//KPRIET BME//EN', 'CALSCALE:GREGORIAN',
  'BEGIN:VEVENT',
  'UID:ignuz26@kpriet.ac.in',
  `DTSTAMP:${stamp}`,
  'DTSTART;VALUE=DATE:20261009',
  'DTEND;VALUE=DATE:20261011',
  "SUMMARY:IGNUZ'26 — National-level technical symposium",
  'LOCATION:KPR Institute of Engineering and Technology\, Arasur\, Coimbatore',
  `DESCRIPTION:Dept. of Biomedical Engineering\, KPRIET. Six events\, two days. Register: ${REGISTER_URL}`,
  `URL:${REGISTER_URL}`,
  'END:VEVENT', 'END:VCALENDAR', '',
].join('\r\n');
writeFileSync('public/ignuz26.ics', ics);
console.log('ok');
