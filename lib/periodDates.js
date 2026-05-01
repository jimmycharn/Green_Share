/**
 * generatePeriodDates — คำนวณวันที่ของแต่ละงวดอัตโนมัติ
 *
 * @param {string}  startDate      – ISO date string (YYYY-MM-DD)
 * @param {number}  totalHands     – จำนวนงวดทั้งหมด
 * @param {string}  periodType     – 'MONTHLY' | 'BIMONTHLY' | 'DAILY'
 * @param {number}  periodInterval – MONTHLY: ทุกกี่เดือน, DAILY: ทุกกี่วัน
 * @param {string}  periodValue    – MONTHLY: วันที่ในเดือน (e.g. "15"),
 *                                   BIMONTHLY: "1,15" หรือ "FIRST_LAST"
 *                                   DAILY: ไม่ใช้
 * @returns {Array<{ period: number, date: string }>}
 */
export function generatePeriodDates(
  startDate,
  totalHands,
  periodType = 'MONTHLY',
  periodInterval = 1,
  periodValue = ''
) {
  const dates = [];
  const start = new Date(startDate + 'T00:00:00');

  if (isNaN(start.getTime())) {
    throw new Error('Invalid start date');
  }

  switch (periodType) {
    case 'MONTHLY': {
      // งวด 1 = start_date
      // งวด N = start + (N-1)*interval เดือน, ใช้ dayOfMonth จาก periodValue หรือ start
      const dayOfMonth = periodValue ? parseInt(periodValue) : start.getDate();
      for (let i = 0; i < totalHands; i++) {
        if (i === 0) {
          dates.push({ period: 1, date: formatDate(start) });
        } else {
          const d = new Date(start);
          d.setMonth(d.getMonth() + i * periodInterval);
          // Clamp day to the last day of the target month
          d.setDate(Math.min(dayOfMonth, daysInMonth(d.getFullYear(), d.getMonth())));
          dates.push({ period: i + 1, date: formatDate(d) });
        }
      }
      break;
    }

    case 'BIMONTHLY': {
      // 2 ครั้งต่อเดือน
      let day1, day2;
      const isFirstLast = periodValue === 'FIRST_LAST';

      if (isFirstLast) {
        day1 = 1;
        day2 = -1; // sentinel → last day of month
      } else {
        const parts = (periodValue || '1,15').split(',').map((s) => parseInt(s.trim()));
        day1 = parts[0] || 1;
        day2 = parts[1] || 15;
        // Ensure day1 < day2
        if (day1 > day2) [day1, day2] = [day2, day1];
      }

      // Generate all slot dates starting from start_date's month
      const allDates = [];
      let year = start.getFullYear();
      let month = start.getMonth();

      // Generate enough months to cover totalHands slots
      const maxMonths = totalHands; // at most totalHands months (2 slots each)
      for (let m = 0; m < maxMonths && allDates.length < totalHands; m++) {
        const d1Val = Math.min(day1, daysInMonth(year, month));
        const d2Val = isFirstLast
          ? daysInMonth(year, month)
          : Math.min(day2, daysInMonth(year, month));

        const date1 = new Date(year, month, d1Val);
        const date2 = new Date(year, month, d2Val);

        // Only include dates >= start_date
        if (date1 >= start) allDates.push(date1);
        if (date2 >= start && date2.getTime() !== date1.getTime()) allDates.push(date2);

        // If this is the start month and neither date matched, also try date2
        if (allDates.length === 0 && date2 >= start) {
          allDates.push(date2);
        }

        month++;
        if (month > 11) {
          month = 0;
          year++;
        }
      }

      for (let i = 0; i < Math.min(totalHands, allDates.length); i++) {
        dates.push({ period: i + 1, date: formatDate(allDates[i]) });
      }

      // If we still need more dates, keep generating
      while (dates.length < totalHands) {
        const d1Val = Math.min(day1, daysInMonth(year, month));
        const d2Val = isFirstLast
          ? daysInMonth(year, month)
          : Math.min(day2, daysInMonth(year, month));

        const date1 = new Date(year, month, d1Val);
        const date2 = new Date(year, month, d2Val);

        if (dates.length < totalHands) dates.push({ period: dates.length + 1, date: formatDate(date1) });
        if (dates.length < totalHands && date2.getTime() !== date1.getTime()) {
          dates.push({ period: dates.length + 1, date: formatDate(date2) });
        }

        month++;
        if (month > 11) {
          month = 0;
          year++;
        }
      }
      break;
    }

    case 'DAILY': {
      // งวด 1 = start_date, งวด N = start + (N-1)*interval วัน
      const interval = periodInterval || 1;
      for (let i = 0; i < totalHands; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i * interval);
        dates.push({ period: i + 1, date: formatDate(d) });
      }
      break;
    }

    default: {
      // Fallback: weekly (compat กับข้อมูลเดิม)
      for (let i = 0; i < totalHands; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i * 7);
        dates.push({ period: i + 1, date: formatDate(d) });
      }
    }
  }

  return dates;
}

// ─── helpers ───

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function formatDate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
