/*
        THIS IS UNFINISHED DO NOT USE UNLESS YOU KNOW HOW TO FIX

  This module was meant to fix the Date ranges when the DS forgets to update the Dates on top of each day. 
  It's like they just clone one spreadsheet sheet, update the roster, update the range at the top but forget to update each date on the columns.

*/
const dateRanges = [
  [2057837586, 'Cleaning Task'],
  [741833431, '3 OCT-08 OCT'],
  [1129340766, '3MAY-9MAY'],
  [292880186, '21 JUNE - 27 JUNE'],
  [1957063207, '28 JUNE - 04 JULY'],
  [321326861, '28 JUNE - 04 JULY'], // duplicate
  [1013164146, '2 AUG - 8 AUG'],
  [401332682, '2 AUG - 8 AUG'] // duplicate
];

const MONTHS = {
  JAN: 0, JANUARY: 0, FEB: 1, FEBUARY: 1, MAR: 2, MARCH: 2, APR: 3, APRIL: 3, MAY: 4, JUN: 5, JUNE: 5,
  JUL: 6, JULY: 6, AUG: 7, AUGUST:7, SEP: 8, SEPTEMBER: 8, SEPT: 8,
  OCT: 9, OCTOBER: 9, NOV: 10, NOVEMBER: 10, DEC: 11, DECEMBER:11
};

const MONTH_NAMES = Object.entries(MONTHS)
  .reduce((acc, [name, idx]) => ({ ...acc, [idx]: name }), {});

// Format as: "28 JUNE - 04 JULY"
function formatRange(startDate, endDate) {
  const start = `${startDate.getDate()} ${MONTH_NAMES[startDate.getMonth()]}`;
  const end = `${endDate.getDate().toString().padStart(2, '0')} ${MONTH_NAMES[endDate.getMonth()]}`;
  return `${start} - ${end}`;
}

// Parse label → [startDate, endDate]
function parseDateRange(label, year = new Date().getFullYear()) {
  const match = label.match(/(\d{1,2})\s*([A-Z]+)[^\d]+(\d{1,2})\s*([A-Z]+)/i);
  if (!match) return null;

  let [_, startDay, startMonth, endDay, endMonth] = match;
  startDay = parseInt(startDay);
  endDay = parseInt(endDay);
  startMonth = startMonth.toUpperCase();
  endMonth = endMonth.toUpperCase();

  const start = new Date(year, MONTHS[startMonth], startDay);
  const end = new Date(year, MONTHS[endMonth], endDay);

  if (end < start) end.setFullYear(end.getFullYear() + 1); // Handle wrap-around

  return [start, end];
}

// Fix ranges in-place in original array
function fixRangesInPlace(ranges) {
  let lastEnd = null;

  for (let i = 0; i < ranges.length; i++) {
    const [id, label] = ranges[i];
    const parsed = parseDateRange(label);

    if (!parsed) continue; // Skip if not a date range

    let [start, end] = parsed;
    const rangeLength = Math.round((end - start) / (1000 * 60 * 60 * 24));

    // Adjust if overlap or duplicate
    if (lastEnd && start <= lastEnd) {
      start = new Date(lastEnd);
      start.setDate(start.getDate() + 1);
      end = new Date(start);
      end.setDate(start.getDate() + rangeLength);
    }

    lastEnd = new Date(end);

    // Update original array in-place
    ranges[i][1] = formatRange(start, end);
  }
}




// Function to extract and loop through the dates
exports.extractDates = function(rangeLabel) {
  let dateRanges = rangeLabel
  // Apply the fix
  fixRangesInPlace(dateRanges);

  // Output the updated result
  console.log("\nUpdated `dateRanges`:\n");
  for (const [id, label] of dateRanges) {
    console.log(`[${id}] ${label}`);
  }

  // Match patterns like: 28 JUNE - 04 JULY OR 2 AUG - 8 AUG
  const match = dateRanges.match(/(\d{1,2})\s*([A-Z]+)\s*[^\d]+\s*(\d{1,2})\s*([A-Z]+)/i);
  if (!match) return [];

  let [_, startDay, startMonth, endDay, endMonth] = match;
  startDay = parseInt(startDay);
  endDay = parseInt(endDay);
  startMonth = startMonth.toUpperCase();
  endMonth = endMonth.toUpperCase();

  const currentYear = new Date().getFullYear();

  const startDate = new Date(currentYear, MONTHS[startMonth], startDay);
  const endDate = new Date(currentYear, MONTHS[endMonth], endDay);

  // Adjust year if end month is before start (e.g., DEC - JAN)
  if (endDate < startDate) {
    endDate.setFullYear(currentYear + 1);
  }

  const dates = [];
  let current = new Date(startDate);
  while (current <= endDate) {
    dates.push(formatDate(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}