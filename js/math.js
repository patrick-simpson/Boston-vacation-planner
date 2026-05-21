/* =========================================================
   Boston Transit Adventure — PURE MATH HELPERS
   ---------------------------------------------------------
   No DOM, no app state. Everything here is a pure function so
   it can be unit-tested in Node (see tests/math.test.js) and
   reused in the browser. Loaded as a plain <script>, it also
   attaches each helper to window for the rest of the app.
   ========================================================= */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') Object.assign(window, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // "5:18 AM" -> minutes since midnight (0..1439). Returns 0 if unparseable.
  function parseTime(str) {
    const m = String(str).match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!m) return 0;
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const period = m[3].toUpperCase();
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return h * 60 + min;
  }

  // minutes since midnight -> "9:50 AM" (wraps across days).
  function formatTime(mins) {
    mins = ((mins % 1440) + 1440) % 1440;
    const h24 = Math.floor(mins / 60);
    const m = mins % 60;
    const period = h24 >= 12 ? 'PM' : 'AM';
    let h = h24 % 12;
    if (h === 0) h = 12;
    return h + ':' + String(m).padStart(2, '0') + ' ' + period;
  }

  // 152 -> "2 hr 32 min"; 60 -> "1 hr"; 45 -> "45 min".
  function formatDuration(mins) {
    mins = Math.max(0, Math.round(mins));
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return m + ' min';
    if (m === 0) return h + ' hr';
    return h + ' hr ' + m + ' min';
  }

  // Forward gap between two clock strings, wrapping past midnight.
  // minutesBetween("10:30 PM","1:05 AM") === 155.
  function minutesBetween(departStr, arriveStr) {
    let d = parseTime(departStr);
    let a = parseTime(arriveStr);
    let diff = a - d;
    if (diff < 0) diff += 1440;
    return diff;
  }

  // Pick the first return train that leaves at/after earliestDepartMins.
  // Falls back to the last train (and flags it) if the day ran too long.
  function pickReturnTrain(returnTrains, earliestDepartMins) {
    if (!returnTrains || !returnTrains.length) return null;
    for (let i = 0; i < returnTrains.length; i++) {
      if (parseTime(returnTrains[i].depart) >= earliestDepartMins) {
        return { train: returnTrains[i], missedLast: false };
      }
    }
    return { train: returnTrains[returnTrains.length - 1], missedLast: true };
  }

  // Build the return plan from when you arrive + how long you stay.
  function planReturn(arriveBostonMins, bostonMinutes, returnTrains, buffer) {
    const earliestLeave = arriveBostonMins + bostonMinutes + (buffer || 0);
    const picked = pickReturnTrain(returnTrains, earliestLeave);
    if (!picked) return null;
    return {
      earliestLeave: earliestLeave,
      returnTrain: picked.train,
      missedLast: picked.missedLast,
      homeArriveMins: parseTime(picked.train.arrive),
    };
  }

  // Largest "friendly" minute step that can still land exactly on target.
  function clockStepFor(targetMins, difficulty) {
    const minute = ((Math.round(targetMins) % 60) + 60) % 60;
    const ladder = (difficulty === 'challenge') ? [5, 1] : [30, 15, 10, 5, 1];
    for (let i = 0; i < ladder.length; i++) {
      if (minute % ladder[i] === 0) return ladder[i];
    }
    return 1;
  }

  function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

  // Tolerant money parser: "$9", "9.00", " 9 ", "9$" -> 9.
  function parseMoneyInput(str) {
    if (str === null || str === undefined) return NaN;
    const cleaned = String(str).replace(/[$,\s]/g, '');
    if (cleaned === '') return NaN;
    const n = Number(cleaned);
    return Number.isFinite(n) ? round2(n) : NaN;
  }

  // Money left after a purchase (kept to cents).
  function moneyLeft(budget, cost) { return round2(budget - cost); }

  // amount with tax added, to cents. applyTax(9, 0.07) -> 9.63.
  function applyTax(amount, rate) { return round2(amount * (1 + rate)); }

  // Format money: whole dollars show as "$9", cents as "$9.63".
  function money(n) {
    const r = round2(n);
    return '$' + (Number.isInteger(r) ? String(r) : r.toFixed(2));
  }

  return {
    parseTime: parseTime,
    formatTime: formatTime,
    formatDuration: formatDuration,
    minutesBetween: minutesBetween,
    pickReturnTrain: pickReturnTrain,
    planReturn: planReturn,
    clockStepFor: clockStepFor,
    round2: round2,
    parseMoneyInput: parseMoneyInput,
    moneyLeft: moneyLeft,
    applyTax: applyTax,
    money: money,
  };
});
