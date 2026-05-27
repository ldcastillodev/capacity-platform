import { runAnalyticsRefresh } from './src/lib/analytics/refresh';
runAnalyticsRefresh([new Date('2026-05-01')]).then(() => { console.log('OK'); process.exit(0); }).catch((err: Error) => { console.error('ERROR:', err.message); console.error(err.stack); process.exit(1); });
