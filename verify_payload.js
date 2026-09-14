import { createIstToUtcDate } from './frontend/src/utils/dateTime.js';

const date = '2026-09-14';
const start = '16:00';
const end = '17:00';

const payload = {
  request_id: 123,
  session_date: date,
  start_time: start,
  end_time: end,
  scheduled_start: createIstToUtcDate(date, start).toISOString(),
  scheduled_end: createIstToUtcDate(date, end).toISOString(),
  notes: "Test notes"
};

console.log(JSON.stringify(payload, null, 2));
