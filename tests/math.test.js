/* Zero-dependency unit tests for js/math.js.
   Run with:  node tests/math.test.js   (or: npm test)        */
const M = require('../js/math.js');

let passed = 0, failed = 0;
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; }
  else { failed++; console.error('✗ ' + label + '\n    expected ' + e + '\n    got      ' + a); }
}
function ok(cond, label) { if (cond) passed++; else { failed++; console.error('✗ ' + label); } }

/* parseTime */
eq(M.parseTime('5:18 AM'), 318, 'parseTime 5:18 AM');
eq(M.parseTime('7:50 AM'), 470, 'parseTime 7:50 AM');
eq(M.parseTime('12:00 PM'), 720, 'parseTime noon');
eq(M.parseTime('12:30 AM'), 30, 'parseTime 12:30 AM');
eq(M.parseTime('10:30 PM'), 1350, 'parseTime 10:30 PM');
eq(M.parseTime('1:05 AM'), 65, 'parseTime 1:05 AM');

/* formatTime */
eq(M.formatTime(470), '7:50 AM', 'formatTime 470');
eq(M.formatTime(720), '12:00 PM', 'formatTime noon');
eq(M.formatTime(0), '12:00 AM', 'formatTime midnight');
eq(M.formatTime(1350), '10:30 PM', 'formatTime 1350');
eq(M.formatTime(65), '1:05 AM', 'formatTime 65');
eq(M.formatTime(1505), '1:05 AM', 'formatTime wraps past midnight');

/* formatDuration */
eq(M.formatDuration(152), '2 hr 32 min', 'formatDuration 152');
eq(M.formatDuration(60), '1 hr', 'formatDuration 60');
eq(M.formatDuration(45), '45 min', 'formatDuration 45');
eq(M.formatDuration(0), '0 min', 'formatDuration 0');
eq(M.formatDuration(125), '2 hr 5 min', 'formatDuration 125');

/* minutesBetween (incl. wrap past midnight) */
eq(M.minutesBetween('7:18 AM', '9:50 AM'), 152, 'minutesBetween southbound 682');
eq(M.minutesBetween('5:18 AM', '7:50 AM'), 152, 'minutesBetween southbound 680');
eq(M.minutesBetween('10:30 PM', '1:05 AM'), 155, 'minutesBetween wraps past midnight');

/* clockStepFor */
eq(M.clockStepFor(M.parseTime('9:50 AM'), 'friendly'), 10, 'clockStep friendly :50 -> 10');
eq(M.clockStepFor(M.parseTime('9:50 AM'), 'challenge'), 5, 'clockStep challenge :50 -> 5');
eq(M.clockStepFor(M.parseTime('8:00 AM'), 'friendly'), 30, 'clockStep friendly :00 -> 30');
eq(M.clockStepFor(M.parseTime('4:15 PM'), 'friendly'), 15, 'clockStep friendly :15 -> 15');
eq(M.clockStepFor(M.parseTime('2:20 PM'), 'friendly'), 10, 'clockStep friendly :20 -> 10');

/* parseMoneyInput (tolerant) */
eq(M.parseMoneyInput('$9'), 9, 'parseMoney $9');
eq(M.parseMoneyInput('9.00'), 9, 'parseMoney 9.00');
eq(M.parseMoneyInput(' 9 '), 9, 'parseMoney spaces');
eq(M.parseMoneyInput('9$'), 9, 'parseMoney trailing $');
eq(M.parseMoneyInput('64.50'), 64.5, 'parseMoney 64.50');
eq(M.parseMoneyInput('$1,000'), 1000, 'parseMoney with comma');
ok(Number.isNaN(M.parseMoneyInput('abc')), 'parseMoney abc -> NaN');
ok(Number.isNaN(M.parseMoneyInput('')), 'parseMoney empty -> NaN');

/* money math */
eq(M.moneyLeft(75, 2.40), 72.6, 'moneyLeft 75 - 2.40');
eq(M.moneyLeft(75, 11), 64, 'moneyLeft 75 - 11');
eq(M.applyTax(9, 0.07), 9.63, 'applyTax meals 9');
eq(M.applyTax(20, 0.0625), 21.25, 'applyTax goods 20');
eq(M.money(9), '$9', 'money whole');
eq(M.money(72.6), '$72.60', 'money cents');
eq(M.money(22.5), '$22.50', 'money 22.5');
eq(M.money(0), '$0', 'money zero');

/* pickReturnTrain + planReturn against the real return schedule */
const RT = [
  { num: '681', depart: '8:50 AM',  arrive: '11:25 AM' },
  { num: '683', depart: '11:50 AM', arrive: '2:25 PM'  },
  { num: '685', depart: '3:45 PM',  arrive: '6:20 PM'  },
  { num: '687', depart: '5:20 PM',  arrive: '7:55 PM'  },
  { num: '689', depart: '10:30 PM', arrive: '1:05 AM'  },
];
eq(M.pickReturnTrain(RT, M.parseTime('1:00 PM')).train.num, '685', 'pickReturn after 1:00 PM -> 685');
eq(M.pickReturnTrain(RT, M.parseTime('1:00 PM')).missedLast, false, 'pickReturn not missed');
eq(M.pickReturnTrain(RT, M.parseTime('11:00 PM')).train.num, '689', 'pickReturn after 11:00 PM -> last');
eq(M.pickReturnTrain(RT, M.parseTime('11:00 PM')).missedLast, true, 'pickReturn missed last');
eq(M.pickReturnTrain(RT, M.parseTime('8:50 AM')).train.num, '681', 'pickReturn exactly 8:50 -> 681');

const plan = M.planReturn(M.parseTime('9:50 AM'), 240, RT, 45); // arrive 9:50, 4h in Boston, 45 min buffer
eq(plan.returnTrain.num, '685', 'planReturn picks 685');
eq(plan.homeArriveMins, M.parseTime('6:20 PM'), 'planReturn home arrival 6:20 PM');
eq(plan.missedLast, false, 'planReturn feasible');

console.log((failed === 0 ? '✓ ALL PASS' : '✗ FAILURES') + ' — ' + passed + ' passed, ' + failed + ' failed.');
process.exit(failed === 0 ? 0 : 1);
