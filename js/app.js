/* =========================================================
   Boston Transit Adventure — APP LOGIC
   ---------------------------------------------------------
   Uses data.js (content), math.js (pure helpers, attached to
   window), and speech.js (read aloud). Loaded as a plain
   <script> after those files.
   ========================================================= */

/* =========================================================
   === PERSISTENCE ===
   v3 = real Downeaster schedule + new options (older saves
   from v2 are ignored so the schema can change safely).
   ========================================================= */
const CONFIG_KEY = 'bta-config-v3';
const NAME_KEY = 'bta-name';
function cloneDefaults() { return JSON.parse(JSON.stringify(DEFAULT_CONFIG)); }

// Make sure no phase can ever be empty / impossible.
function ensurePlayable(c) {
  if (!c || typeof c !== 'object') return cloneDefaults();
  const d = cloneDefaults();
  if (!Array.isArray(c.trains) || c.trains.length === 0) c.trains = d.trains;
  if (!Array.isArray(c.returnTrains) || c.returnTrains.length === 0) c.returnTrains = d.returnTrains;
  if (!Array.isArray(c.passes) || c.passes.length === 0) c.passes = d.passes;
  if (!c.subway || typeof c.subway !== 'object') c.subway = d.subway;
  if (!Array.isArray(c.destinations) || c.destinations.length < 2) c.destinations = d.destinations;
  if (!Array.isArray(c.foods) || c.foods.length === 0) c.foods = d.foods;
  if (!Array.isArray(c.souvenirs) || c.souvenirs.length === 0) c.souvenirs = d.souvenirs;
  if (typeof c.startingBudget !== 'number' || isNaN(c.startingBudget)) c.startingBudget = d.startingBudget;
  if (['support', 'friendly', 'challenge'].indexOf(c.difficulty) < 0) c.difficulty = 'friendly';
  return c;
}
function sanitizeConfig(obj) { return ensurePlayable(Object.assign(cloneDefaults(), obj || {})); }

function loadConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(CONFIG_KEY));
    if (saved && typeof saved === 'object') return ensurePlayable(Object.assign(cloneDefaults(), saved));
  } catch (e) {}
  return cloneDefaults();
}
function saveConfig() { try { localStorage.setItem(CONFIG_KEY, JSON.stringify(config)); } catch (e) {} }
function loadName() { try { return localStorage.getItem(NAME_KEY) || ''; } catch (e) { return ''; } }
function saveName(n) { try { localStorage.setItem(NAME_KEY, n); } catch (e) {} }

let config = loadConfig();

/* =========================================================
   === STATE ===
   ========================================================= */
const state = {
  phase: 1,
  budget: config.startingBudget,
  minutesAway: 0,
  name: loadName() || 'Explorer',
  train: null,
  arrivalTime: null,
  pass: null,
  destinations: [],
  lunch: null,
  lunchCharged: 0,
  souvenirs: [],
  souvenirsCharged: 0,
  returnTrain: null,
  homeTime: null,
  stamps: [],
};

function resetTrip() {
  state.phase = 1;
  state.budget = config.startingBudget;
  state.minutesAway = 0;
  state.train = null;
  state.arrivalTime = null;
  state.pass = null;
  state.destinations = [];
  state.lunch = null;
  state.lunchCharged = 0;
  state.souvenirs = [];
  state.souvenirsCharged = 0;
  state.returnTrain = null;
  state.homeTime = null;
  state.stamps = [];
  document.querySelectorAll('.stamp').forEach(s => s.classList.remove('unlocked'));
  Speech.stop();
  updateTrackers();
  renderApp();
}

/* =========================================================
   === SOUND + CONFETTI ===
   ========================================================= */
let audioCtx = null;
function getAudio() {
  try { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); return audioCtx; }
  catch (e) { return null; }
}
function playChime(kind) {
  const ctx = getAudio(); if (!ctx) return;
  const now = ctx.currentTime;
  const notes = (kind === 'ok') ? [523.25, 659.25, 783.99] : [349.23];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.type = 'sine'; osc.frequency.value = freq;
    const start = now + i * 0.12;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.32);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start); osc.stop(start + 0.4);
  });
}
function confetti() {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const host = document.getElementById('confetti');
  const colors = [LINE_COLORS.Red, LINE_COLORS.Green, LINE_COLORS.Blue, LINE_COLORS.Orange, '#F4B400', '#FF5C8A'];
  for (let i = 0; i < 36; i++) {
    const bit = document.createElement('div');
    bit.className = 'confetti-bit';
    bit.style.left = Math.random() * 100 + 'vw';
    bit.style.background = colors[i % colors.length];
    bit.style.animationDelay = (Math.random() * 0.35) + 's';
    bit.style.transform = 'rotate(' + (Math.random() * 360) + 'deg)';
    host.appendChild(bit);
    setTimeout(() => bit.remove(), 2700);
  }
}

/* =========================================================
   === GENERIC HELPERS ===
   ========================================================= */
// Pick simpler wording when "simple language" is on.
function tt(normal, simple) { return (config.simpleLanguage && simple) ? simple : normal; }

function escAttr(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
function stdBadgeHTML() {
  const codes = Array.prototype.slice.call(arguments);
  const tip = codes.map(c => STANDARDS[c]).join('\n\n');
  return '<span class="std-badge" title="' + escAttr(tip) + '">📐 ' + codes.join(' · ') + '</span>';
}
function skillBadgeHTML(text) { return '<span class="std-badge skill" title="' + escAttr(text) + '">🧭 Thinking skill</span>'; }

function updateTrackers() {
  document.getElementById('budget-value').textContent = money(state.budget);
  document.getElementById('time-value').textContent = formatDuration(state.minutesAway);
}
function updateJourney() {
  document.querySelectorAll('.journey-step').forEach((el) => {
    const step = parseInt(el.dataset.step, 10);
    el.classList.toggle('done', step < state.phase);
    el.classList.toggle('active', step === state.phase);
  });
}
function awardStamp(name) {
  if (state.stamps.includes(name)) return;
  state.stamps.push(name);
  const el = document.querySelector('.stamp[data-stamp="' + name + '"]');
  if (el) el.classList.add('unlocked');
  playChime('ok'); confetti();
}
function showFeedback(box, kind, msg) { box.className = 'feedback ' + kind; box.textContent = msg; }
function lineChip(line) {
  const span = document.createElement('span'); span.className = 'chip';
  const dot = document.createElement('span'); dot.className = 'dot';
  dot.style.background = LINE_COLORS[line] || '#666';
  span.appendChild(dot); span.appendChild(document.createTextNode(line + ' Line'));
  return span;
}
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}
function minFoodCost() { return Math.min.apply(null, config.foods.map(f => f.cost)); }
function reserveForLunch() {
  const m = minFoodCost();
  return config.taxEnabled ? applyTax(m, TAX_RATES.meals) : m;
}

// Append a "Read aloud" button to a phase head when enabled.
function attachReadAloud(card) {
  if (!config.readAloud || !Speech.supported) return;
  const head = card.querySelector('.phase-head');
  if (!head) return;
  const getText = () => {
    const sub = card.querySelector('.phase-subtitle');
    const title = card.querySelector('.phase-title');
    return (title ? title.textContent + '. ' : '') + (sub ? sub.textContent : '');
  };
  head.appendChild(Speech.button(getText));
}

/* =========================================================
   === NUMBER LINE + "SHOW ME HOW" (money model) ===
   ========================================================= */
function buildNumberLine(start, cost) {
  const end = Math.max(0, round2(start - cost));
  const total = Math.max(start, 0.01);
  const wrap = document.createElement('div');
  wrap.className = 'number-line';
  wrap.innerHTML =
    '<div class="nl-caption">' + money(start) + ' − ' + money(cost) + ' = ' + money(end) + '</div>' +
    '<div class="nl-track">' +
      '<div class="nl-seg nl-end" style="flex:' + (end / total) + '">' + money(end) + '</div>' +
      '<div class="nl-seg nl-cost" style="flex:' + (Math.max(cost, 0) / total) + '">−' + money(cost) + '</div>' +
    '</div>' +
    '<div class="nl-labels"><span>$0</span><span>' + money(start) + '</span></div>';
  return wrap;
}
function moneyStepsHTML(start, cost) {
  const end = round2(start - cost);
  return '<p class="steps">Start with <span class="op">' + money(start) + '</span>. ' +
    'Take away <span class="op">' + money(cost) + '</span> (the cost). ' +
    money(start) + ' − ' + money(cost) + ' = <span class="op">' + money(end) + '</span> left.</p>';
}
// A panel showing the worked steps + number line. shownByDefault for support tier.
function makeShowHow(start, cost, container, shownByDefault) {
  const panel = document.createElement('div');
  panel.className = 'show-how-panel';
  panel.innerHTML = moneyStepsHTML(start, cost);
  panel.appendChild(buildNumberLine(start, cost));
  if (shownByDefault) {
    container.appendChild(panel);
    return;
  }
  panel.style.display = 'none';
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'btn secondary small show-how-btn';
  btn.textContent = 'Show me how 🧮';
  btn.addEventListener('click', () => {
    const open = panel.style.display !== 'none';
    panel.style.display = open ? 'none' : 'block';
    btn.textContent = open ? 'Show me how 🧮' : 'Hide help';
  });
  container.appendChild(btn);
  container.appendChild(panel);
}

/* =========================================================
   === INTERACTIVE CLOCK WIDGET ===
   ========================================================= */
function buildClock(correctMins, onCorrect, feedbackBox, opts) {
  opts = opts || {};
  const step = clockStepFor(correctMins, config.difficulty);
  let cur = 12 * 60; // start at 12:00 PM (neutral)

  const wrap = document.createElement('div');
  wrap.className = 'clock';
  wrap.innerHTML =
    '<svg viewBox="0 0 200 200" class="clock-face" aria-hidden="true">' +
      '<circle cx="100" cy="100" r="94" class="clock-rim"></circle>' +
      '<line class="hand hour" x1="100" y1="100" x2="100" y2="58"></line>' +
      '<line class="hand minute" x1="100" y1="100" x2="100" y2="32"></line>' +
      '<circle cx="100" cy="100" r="5" class="clock-cap"></circle>' +
    '</svg>' +
    '<div class="clock-controls">' +
      '<div class="stepper"><button type="button" class="btn small" data-act="h-" aria-label="One hour earlier">−</button><span>Hour</span><button type="button" class="btn small" data-act="h+" aria-label="One hour later">+</button></div>' +
      '<div class="stepper"><button type="button" class="btn small" data-act="m-" aria-label="' + step + ' minutes earlier">−</button><span>Min</span><button type="button" class="btn small" data-act="m+" aria-label="' + step + ' minutes later">+</button></div>' +
      '<button type="button" class="btn secondary small" data-act="ap" aria-label="Switch between morning and afternoon">AM / PM</button>' +
    '</div>' +
    '<div class="clock-readout" aria-live="polite">12:00 PM</div>' +
    '<button type="button" class="btn" data-act="check">Check my time ✓</button>';

  const svg = wrap.querySelector('svg');
  for (let i = 0; i < 12; i++) {
    const ang = (i * 30) * Math.PI / 180;
    const x1 = 100 + Math.sin(ang) * 84, y1 = 100 - Math.cos(ang) * 84;
    const x2 = 100 + Math.sin(ang) * 92, y2 = 100 - Math.cos(ang) * 92;
    const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    ln.setAttribute('x1', x1); ln.setAttribute('y1', y1);
    ln.setAttribute('x2', x2); ln.setAttribute('y2', y2);
    ln.setAttribute('class', 'clock-tick');
    svg.insertBefore(ln, svg.querySelector('.hand'));
  }

  const hourHand = wrap.querySelector('.hand.hour');
  const minHand = wrap.querySelector('.hand.minute');
  const readout = wrap.querySelector('.clock-readout');

  function render() {
    readout.textContent = formatTime(cur);
    const m = cur % 60, h = Math.floor(cur / 60);
    hourHand.setAttribute('transform', 'rotate(' + (((h % 12) + m / 60) * 30) + ' 100 100)');
    minHand.setAttribute('transform', 'rotate(' + (m * 6) + ' 100 100)');
  }
  function explainWrong() {
    let diff = cur - correctMins;
    while (diff > 720) diff -= 1440;
    while (diff <= -720) diff += 1440;
    const off = formatDuration(Math.abs(diff));
    const dir = diff > 0 ? 'too late' : 'too early';
    showFeedback(feedbackBox, 'hint', '🤔 That clock is ' + off + ' ' + dir + '. Use the Time Helper to count the hours, then try again.');
    playChime('hint');
  }
  wrap.addEventListener('click', (e) => {
    const act = e.target.getAttribute && e.target.getAttribute('data-act');
    if (!act) return;
    const h = Math.floor(cur / 60), m = cur % 60;
    if (act === 'h+') cur = ((h + 1) % 24) * 60 + m;
    else if (act === 'h-') cur = ((h + 23) % 24) * 60 + m;
    else if (act === 'm+') cur = h * 60 + ((m + step) % 60);
    else if (act === 'm-') cur = h * 60 + ((m - step + 60) % 60);
    else if (act === 'ap') cur = (cur + 720) % 1440;
    else if (act === 'check') {
      if (cur === correctMins) { showFeedback(feedbackBox, 'ok', '✓ That’s right — ' + formatTime(correctMins) + '!'); onCorrect(); }
      else explainWrong();
      return;
    }
    render();
  });
  render();

  // "Show me how" for elapsed time (always shown in support tier).
  if (typeof opts.fromMins === 'number') {
    const rideMins = opts.rideMins != null ? opts.rideMins : ((correctMins - opts.fromMins + 1440) % 1440);
    const panel = document.createElement('div');
    panel.className = 'show-how-panel';
    panel.innerHTML = '<p class="steps">Start at <span class="op">' + formatTime(opts.fromMins) +
      '</span>. The ride is <span class="op">' + formatDuration(rideMins) +
      '</span>. Count forward: ' + formatTime(opts.fromMins) + ' + ' + formatDuration(rideMins) +
      ' = <span class="op">' + formatTime(correctMins) + '</span>.</p>';
    if (config.difficulty === 'support') {
      wrap.appendChild(panel);
    } else {
      panel.style.display = 'none';
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'btn secondary small show-how-btn';
      btn.textContent = 'Show me how 🧮';
      btn.addEventListener('click', () => {
        const open = panel.style.display !== 'none';
        panel.style.display = open ? 'none' : 'block';
        btn.textContent = open ? 'Show me how 🧮' : 'Hide help';
      });
      wrap.appendChild(btn);
      wrap.appendChild(panel);
    }
  }
  return wrap;
}

/* =========================================================
   === MONEY ANSWER (3 tiers, optional tax, number line) ===
   ========================================================= */
function buildMoneyAnswer(container, currentBudget, baseCost, itemLabel, onCorrect, feedbackBox, opts) {
  opts = opts || {};
  const taxRate = opts.taxRate || 0;
  const taxed = taxRate ? applyTax(baseCost, taxRate) : round2(baseCost);
  const taxAmt = round2(taxed - baseCost);
  const correct = moneyLeft(currentBudget, taxed);
  const tier = config.difficulty;

  let intro = '';
  if ((tier === 'support' || tier === 'friendly') && typeof opts.spentSoFar === 'number' && opts.spentSoFar > 0) {
    intro = '<p class="phase-subtitle" style="margin-bottom:6px;">You started with <strong>' + money(config.startingBudget) +
      '</strong>. So far you spent <strong>' + money(opts.spentSoFar) + '</strong>, so you have <strong>' +
      money(currentBudget) + '</strong> now.</p>';
  }
  let question;
  if (taxRate) {
    question = '<p class="phase-subtitle">' + itemLabel + ' costs <strong>' + money(baseCost) +
      '</strong>. Massachusetts adds <strong>' + money(taxAmt) + '</strong> tax, so it really costs <strong>' +
      money(taxed) + '</strong>. You have <strong>' + money(currentBudget) + '</strong>. How much will you have left?</p>';
  } else {
    question = '<p class="phase-subtitle">You have <strong>' + money(currentBudget) + '</strong>. ' + itemLabel +
      ' costs <strong>' + money(taxed) + '</strong>. How much will you have left?</p>';
  }
  container.innerHTML = intro + question;

  function succeed() {
    showFeedback(feedbackBox, 'ok', '✓ Yes! ' + money(correct) + ' left.');
    onCorrect(taxed);
  }

  if (tier === 'challenge') {
    const wrap = document.createElement('div');
    wrap.style.display = 'flex'; wrap.style.gap = '10px'; wrap.style.alignItems = 'center'; wrap.style.flexWrap = 'wrap';
    wrap.innerHTML =
      '<span style="font-weight:800;font-size:24px;">$</span>' +
      '<input type="text" inputmode="decimal" class="num-input" aria-label="Money left over" style="width:130px;" placeholder="0">' +
      '<button class="btn" type="button">Check ✓</button>';
    const input = wrap.querySelector('input');
    const checkIt = () => {
      const v = parseMoneyInput(input.value);
      if (isNaN(v)) { showFeedback(feedbackBox, 'hint', '🤔 Type just the number, like 64 or 64.50.'); playChime('hint'); return; }
      if (Math.abs(v - correct) < 0.005) { input.disabled = true; succeed(); }
      else {
        const why = (v > correct)
          ? '🤔 Too high — when you spend money you end up with less than you started.'
          : '🤔 Too low — you did not spend that much.';
        showFeedback(feedbackBox, 'hint', why + ' Try ' + money(currentBudget) + ' − ' + money(taxed) + '.');
        playChime('hint');
      }
    };
    wrap.querySelector('button').addEventListener('click', checkIt);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') checkIt(); });
    container.appendChild(wrap);
    makeShowHow(currentBudget, taxed, container, false);
  } else {
    let choices;
    if (tier === 'support') {
      const distract = (correct >= 5) ? correct - 5 : correct + 5;
      choices = [correct, round2(distract)];
    } else {
      choices = (correct >= 5) ? [correct, correct + 5, correct - 5] : [correct, correct + 5, correct + 10];
      choices = choices.map(round2);
    }
    const opt = document.createElement('div'); opt.className = 'options';
    shuffle(choices).forEach((n) => {
      const b = document.createElement('button'); b.className = 'option';
      b.innerHTML = '<span class="opt-title">' + money(n) + '</span>';
      b.addEventListener('click', () => {
        if (Math.abs(n - correct) < 0.005) {
          b.classList.add('correct');
          opt.querySelectorAll('.option').forEach(x => x.disabled = true);
          succeed();
        } else {
          b.classList.add('wrong'); b.disabled = true;
          const why = (n > correct)
            ? '🤔 Too high — spending money leaves you with less.'
            : '🤔 Too low — you did not spend that much.';
          showFeedback(feedbackBox, 'hint', why + ' Try ' + money(currentBudget) + ' − ' + money(taxed) + '.');
          playChime('hint');
        }
      });
      opt.appendChild(b);
    });
    container.appendChild(opt);
    makeShowHow(currentBudget, taxed, container, tier === 'support');
  }
}

/* =========================================================
   === TRIP MATH (shared by Phase 6 + certificate) ===
   ========================================================= */
function computeTrip() {
  const destHours = state.destinations.reduce((s, d) => s + d.hours, 0);
  const lunchHours = state.lunch ? state.lunch.hours : 0;
  const bostonMinutes = (destHours + lunchHours) * 60;
  const arriveBoston = parseTime(state.arrivalTime);
  const plan = planReturn(arriveBoston, bostonMinutes, config.returnTrains, GET_AROUND_BUFFER_MIN);
  const returnTrain = plan ? plan.returnTrain : config.returnTrains[config.returnTrains.length - 1];
  const homeMins = parseTime(returnTrain.arrive);
  const totalSpent = round2(config.startingBudget - state.budget);
  const minutesAway = minutesBetween(state.train.depart, returnTrain.arrive);
  return {
    destHours: destHours, lunchHours: lunchHours, bostonMinutes: bostonMinutes,
    arriveBoston: arriveBoston, returnTrain: returnTrain, homeMins: homeMins,
    missedLast: plan ? plan.missedLast : true, totalSpent: totalSpent, minutesAway: minutesAway,
  };
}
// Would the chosen attractions still let you catch a train home?
function returnFeasible(extraMinutes) {
  if (!state.arrivalTime) return true;
  const arriveBoston = parseTime(state.arrivalTime);
  const plan = planReturn(arriveBoston, extraMinutes, config.returnTrains, GET_AROUND_BUFFER_MIN);
  return plan && !plan.missedLast;
}

/* =========================================================
   === PHASE 1: DOWNEASTER DEPARTURE ===
   ========================================================= */
function renderPhase1() {
  const card = document.createElement('section');
  card.className = 'card phase-card';
  card.innerHTML =
    '<div class="phase-head"><div class="phase-badge">1</div><h2 class="phase-title">The Downeaster Departure</h2></div>' +
    '<p class="phase-subtitle">' +
      tt('Pick a real Downeaster train from Portland, Maine. Then set the clock to the time it arrives in Boston.',
         'Pick a train. Then set the clock to when it gets to Boston.') + ' ' +
      stdBadgeHTML('3.MD.A.1', '4.MD.A.2') + '</p>' +
    '<div class="options" id="train-options" role="radiogroup" aria-label="Train choices"></div>' +
    '<div id="train-question" style="margin-top: 20px;"></div>' +
    '<div class="feedback" id="p1-feedback" role="status"></div>';

  const opts = card.querySelector('#train-options');
  config.trains.forEach((t) => {
    const dur = minutesBetween(t.depart, t.arrive);
    const btn = document.createElement('button');
    btn.className = 'option'; btn.setAttribute('role', 'radio'); btn.setAttribute('aria-checked', 'false');
    btn.innerHTML =
      '<span class="opt-title">' + t.label + ' <span class="opt-meta">(Train ' + t.num + ')</span></span>' +
      '<span class="opt-meta">Leaves Portland: <strong>' + t.depart + '</strong></span>' +
      '<span class="opt-meta">Arrives Boston: <strong>' + t.arrive + '</strong></span>' +
      '<span class="opt-meta">Ride: <strong>' + formatDuration(dur) + '</strong></span>';
    btn.addEventListener('click', () => selectTrain(t, card));
    opts.appendChild(btn);
  });
  attachReadAloud(card);
  return card;
}
function selectTrain(train, card) {
  card.querySelectorAll('#train-options .option').forEach((b) => {
    const isThis = b.querySelector('.opt-title').textContent.indexOf(train.label) === 0;
    b.classList.toggle('selected', isThis);
    b.setAttribute('aria-checked', isThis ? 'true' : 'false');
  });
  const departMins = parseTime(train.depart);
  const arriveMins = parseTime(train.arrive);
  const rideMins = minutesBetween(train.depart, train.arrive);
  const qBox = card.querySelector('#train-question');
  qBox.innerHTML =
    '<p class="phase-subtitle" style="margin-top:8px;">Your train leaves at <strong>' + train.depart +
    '</strong> and the ride takes <strong>' + formatDuration(rideMins) + '</strong>. ' +
    'Set the clock to your arrival time at Boston North Station.</p>';
  const fb = card.querySelector('#p1-feedback');
  const clock = buildClock(arriveMins, () => {
    state.train = train; state.arrivalTime = train.arrive;
    state.minutesAway += rideMins; updateTrackers();
    awardStamp('Train Conductor');
    setTimeout(() => { state.phase = 2; renderApp(); }, 950);
  }, fb, { fromMins: departMins, rideMins: rideMins });
  qBox.appendChild(clock);
}

/* =========================================================
   === PHASE 2: SUBWAY CONNECTION ===
   ========================================================= */
function renderPhase2() {
  const sub = config.subway;
  const card = document.createElement('section');
  card.className = 'card phase-card';
  card.innerHTML =
    '<div class="phase-head"><div class="phase-badge">2</div><h2 class="phase-title">The Subway Connection</h2></div>' +
    '<p class="phase-subtitle">' + tt('Buy a subway pass, then pick the right colored line.', 'Buy a pass. Then pick the right color line.') + '</p>' +
    '<span class="step-label">Step A — Choose your pass</span> ' + stdBadgeHTML('3.NBT.A.2', '4.MD.A.2') +
    '<div class="options" id="pass-options" role="radiogroup" aria-label="Pass choices" style="margin-top:8px;"></div>' +
    '<div id="pass-math" style="margin-top: 16px;"></div>' +
    '<div id="step-b" style="margin-top: 24px; display: none;">' +
      '<span class="step-label">Step B — Pick the right line</span> ' +
        skillBadgeHTML('Map-reading and logical reasoning: matching a destination to the correct subway line.') +
      '<p class="phase-subtitle" style="margin-top:8px;">You need to get from <strong>' + sub.from +
        '</strong> to <strong>' + sub.to + '</strong>. Hint: ' + sub.hint + '</p>' +
      '<div class="line-buttons" id="line-buttons"></div>' +
    '</div>' +
    '<div class="feedback" id="p2-feedback" role="status"></div>';

  const opts = card.querySelector('#pass-options');
  config.passes.forEach((p) => {
    const btn = document.createElement('button');
    btn.className = 'option'; btn.setAttribute('role', 'radio');
    btn.innerHTML =
      '<span class="opt-title">' + p.label + '</span>' +
      '<span class="opt-meta">' + p.blurb + '</span>' +
      '<span class="opt-meta"><strong>' + money(p.cost) + '</strong></span>';
    btn.addEventListener('click', () => selectPass(p, card));
    opts.appendChild(btn);
  });
  attachReadAloud(card);
  return card;
}
function selectPass(pass, card) {
  card.querySelectorAll('#pass-options .option').forEach((b) => {
    const isThis = b.querySelector('.opt-title').textContent === pass.label;
    b.classList.toggle('selected', isThis);
    b.setAttribute('aria-checked', isThis ? 'true' : 'false');
  });
  const fb = card.querySelector('#p2-feedback');
  buildMoneyAnswer(card.querySelector('#pass-math'), state.budget, pass.cost, 'The pass', (charged) => {
    state.pass = pass; state.budget = moneyLeft(state.budget, charged); updateTrackers();
    card.querySelector('#step-b').style.display = 'block';
    buildLineButtons(card);
  }, fb, { taxRate: 0 });
}
function buildLineButtons(card) {
  const wrap = card.querySelector('#line-buttons'); wrap.innerHTML = '';
  Object.keys(LINE_COLORS).forEach((name) => {
    const b = document.createElement('button');
    b.className = 'line-btn ' + name.toLowerCase();
    b.textContent = name + ' Line'; b.setAttribute('aria-label', name + ' Line');
    b.addEventListener('click', () => checkLine(name, b, card));
    wrap.appendChild(b);
  });
}
function checkLine(name, btn, card) {
  const sub = config.subway; const fb = card.querySelector('#p2-feedback');
  if (name === sub.correctLine) {
    btn.classList.add('correct');
    showFeedback(fb, 'ok', '✓ Perfect! The ' + name + ' Line goes from ' + sub.from + ' to ' + sub.to + '.');
    awardStamp('Subway Navigator');
    card.querySelectorAll('.line-btn').forEach(b => b.disabled = true);
    setTimeout(() => { state.phase = 3; renderApp(); }, 1000);
  } else {
    btn.classList.add('wrong'); btn.disabled = true;
    showFeedback(fb, 'hint', '🤔 Try a different color. ' + sub.hint); playChime('hint');
  }
}

/* =========================================================
   === PHASE 3: ATTRACTIONS MENU ===
   ========================================================= */
function renderPhase3() {
  const reserve = reserveForLunch();
  const card = document.createElement('section');
  card.className = 'card phase-card';
  card.innerHTML =
    '<div class="phase-head"><div class="phase-badge">3</div><h2 class="phase-title">Pick Two Attractions</h2></div>' +
    '<p class="phase-subtitle">' +
      tt('Choose <strong>two</strong> places to visit. Add up the cost and the hours — and remember to leave at least <strong>' + money(reserve) + '</strong> for lunch!',
         'Pick <strong>two</strong> places. Keep at least <strong>' + money(reserve) + '</strong> for lunch.') + ' ' +
      stdBadgeHTML('3.NBT.A.2', '3.MD.A.1', '4.MD.A.2') + '</p>' +
    '<div class="pick-grid" id="dest-grid"></div>' +
    '<div class="totals-bar" id="totals">' +
      '<span class="totals-item">Picked: <span class="v" id="t-picked">0/2</span></span>' +
      '<span class="totals-item">Cost: <span class="v" id="t-cost">$0</span></span>' +
      '<span class="totals-item">Hours: <span class="v" id="t-hours">0</span></span>' +
      '<span class="totals-item">Budget left: <span class="v" id="t-budget">' + money(state.budget) + '</span></span>' +
    '</div>' +
    '<div style="margin-top: 16px;"><button class="btn" id="confirm-dest" disabled>Confirm My Picks ✨</button></div>' +
    '<div class="feedback" id="p3-feedback" role="status"></div>';

  const grid = card.querySelector('#dest-grid');
  const picks = [];
  config.destinations.forEach((d, idx) => {
    const c = document.createElement('button');
    c.className = 'pick-card'; c.setAttribute('aria-pressed', 'false');
    const adult = (d.costAdult != null && d.costAdult !== d.cost) ? '<span class="price-adult">(adult ' + money(d.costAdult) + ')</span>' : '';
    c.innerHTML =
      '<span class="emoji" aria-hidden="true">' + d.emoji + '</span>' +
      '<span class="name">' + d.name + '</span>' +
      '<span class="cat">' + d.category + '</span>' +
      (d.fact ? '<span class="fact">💡 ' + d.fact + '</span>' : '') +
      (d.walk ? '<span class="walk">🚶 ' + d.walk + '</span>' : '') +
      '<span class="meta"><span class="price">' + money(d.cost) + '</span>' + adult + '<span class="hours">' + d.hours + ' hr</span></span>' +
      '<span class="meta"><span class="stop">🚉 ' + (d.stop ? d.stop : '—') + '</span></span>';
    c.querySelector('.meta').appendChild(lineChip(d.line));
    c.addEventListener('click', () => {
      const i = picks.indexOf(idx);
      if (i >= 0) { picks.splice(i, 1); c.classList.remove('selected'); c.setAttribute('aria-pressed', 'false'); }
      else {
        if (picks.length >= 2) { showFeedback(card.querySelector('#p3-feedback'), 'hint', '🤔 You already picked 2. Tap one to unpick it first.'); return; }
        picks.push(idx); c.classList.add('selected'); c.setAttribute('aria-pressed', 'true');
      }
      updateDestTotals(picks, card);
    });
    grid.appendChild(c);
  });
  card.querySelector('#confirm-dest').addEventListener('click', () => confirmDests(picks, card));
  attachReadAloud(card);
  return card;
}
function updateDestTotals(picks, card) {
  const reserve = reserveForLunch();
  const chosen = picks.map(i => config.destinations[i]);
  const totalCost = round2(chosen.reduce((s, d) => s + d.cost, 0));
  const totalHours = chosen.reduce((s, d) => s + d.hours, 0);
  card.querySelector('#t-picked').textContent = picks.length + '/2';
  card.querySelector('#t-cost').textContent = money(totalCost);
  card.querySelector('#t-hours').textContent = totalHours;
  card.querySelector('#t-budget').textContent = money(state.budget);
  const fb = card.querySelector('#p3-feedback');
  const btn = card.querySelector('#confirm-dest');
  const overBudget = totalCost > state.budget;
  const overReserve = totalCost > round2(state.budget - reserve);
  // Real-world guardrail: would this leave time to catch a train home?
  const feasible = (picks.length !== 2) || returnFeasible((totalHours + 1) * 60);
  btn.disabled = (picks.length !== 2) || overReserve || !feasible;
  if (overBudget) showFeedback(fb, 'hint', "🤔 That's " + money(totalCost) + ', but you only have ' + money(state.budget) + '. Try a cheaper combo.');
  else if (overReserve) showFeedback(fb, 'hint', '🤔 Save at least ' + money(reserve) + ' for lunch! Pick a cheaper combo.');
  else if (!feasible) showFeedback(fb, 'hint', '🤔 That is a lot of hours — you might miss the last train home. Try shorter visits.');
  else { fb.className = 'feedback'; fb.textContent = ''; }
}
function confirmDests(picks, card) {
  const chosen = picks.map(i => config.destinations[i]);
  const totalCost = round2(chosen.reduce((s, d) => s + d.cost, 0));
  const totalHours = chosen.reduce((s, d) => s + d.hours, 0);
  state.destinations = chosen; state.budget = moneyLeft(state.budget, totalCost); state.minutesAway += totalHours * 60;
  updateTrackers(); awardStamp('Boston Explorer');
  showFeedback(card.querySelector('#p3-feedback'), 'ok', '✓ Great picks! ' + money(totalCost) + ' spent, ' + totalHours + ' hours of fun.');
  setTimeout(() => { state.phase = 4; renderApp(); }, 1000);
}

/* =========================================================
   === PHASE 4: LUNCH ===
   ========================================================= */
function renderPhase4() {
  const card = document.createElement('section');
  card.className = 'card phase-card';
  card.innerHTML =
    '<div class="phase-head"><div class="phase-badge">4</div><h2 class="phase-title">Lunchtime in Boston</h2></div>' +
    '<p class="phase-subtitle">' +
      tt('Pick a lunch you can afford. Then work out how much money is left.', 'Pick a lunch. Then find how much money is left.') +
      (config.taxEnabled ? ' Massachusetts adds a meals tax, so lunch costs a little more than the price.' : '') + ' ' +
      stdBadgeHTML('3.NBT.A.2', '4.MD.A.2') + '</p>' +
    '<div class="pick-grid" id="food-grid"></div>' +
    '<div id="food-math" style="margin-top: 16px;"></div>' +
    '<div class="feedback" id="p4-feedback" role="status"></div>';

  const grid = card.querySelector('#food-grid');
  config.foods.forEach((f) => {
    const c = document.createElement('button');
    c.className = 'pick-card'; c.setAttribute('aria-pressed', 'false');
    const realCost = config.taxEnabled ? applyTax(f.cost, TAX_RATES.meals) : f.cost;
    const tooPricey = realCost > state.budget;
    c.innerHTML =
      '<span class="emoji" aria-hidden="true">' + f.emoji + '</span>' +
      '<span class="name">' + f.label + '</span>' +
      (f.fact ? '<span class="fact">💡 ' + f.fact + '</span>' : '') +
      '<span class="meta"><span class="price">' + money(f.cost) + '</span><span class="hours">' + f.hours + ' hr</span></span>';
    if (tooPricey) { c.disabled = true; c.style.opacity = '0.5'; c.title = 'Too expensive — you have ' + money(state.budget); }
    c.addEventListener('click', () => selectFood(f, card));
    grid.appendChild(c);
  });
  attachReadAloud(card);
  return card;
}
function selectFood(food, card) {
  card.querySelectorAll('#food-grid .pick-card').forEach((b) => {
    const isThis = b.querySelector('.name').textContent === food.label;
    b.classList.toggle('selected', isThis); b.setAttribute('aria-pressed', isThis ? 'true' : 'false');
  });
  const fb = card.querySelector('#p4-feedback');
  const taxRate = config.taxEnabled ? TAX_RATES.meals : 0;
  const spentSoFar = round2(config.startingBudget - state.budget);
  buildMoneyAnswer(card.querySelector('#food-math'), state.budget, food.cost, 'Lunch', (charged) => {
    state.lunch = food; state.lunchCharged = charged; state.budget = moneyLeft(state.budget, charged);
    state.minutesAway += food.hours * 60; updateTrackers();
    awardStamp('Foodie');
    setTimeout(() => { state.phase = 5; renderApp(); }, 950);
  }, fb, { taxRate: taxRate, spentSoFar: spentSoFar });
}

/* =========================================================
   === PHASE 5: SOUVENIR SHOP ===
   ========================================================= */
function renderPhase5() {
  const card = document.createElement('section');
  card.className = 'card phase-card';
  card.innerHTML =
    '<div class="phase-head"><div class="phase-badge">5</div><h2 class="phase-title">The Souvenir Shop</h2></div>' +
    '<p class="phase-subtitle">' +
      tt('Spend your leftover money on gifts — or press Confirm to buy nothing and save it.', 'Buy gifts with your leftover money — or save it.') +
      (config.taxEnabled ? ' Massachusetts adds sales tax to gifts.' : '') + ' ' +
      stdBadgeHTML('3.NBT.A.2', '4.MD.A.2') + '</p>' +
    '<div class="pick-grid" id="souvenir-grid"></div>' +
    '<div class="totals-bar" id="souvenir-totals">' +
      '<span class="totals-item">Gifts cost: <span class="v" id="s-cost">$0</span></span>' +
      (config.taxEnabled ? '<span class="totals-item">With tax: <span class="v" id="s-taxed">$0</span></span>' : '') +
      '<span class="totals-item">Money left: <span class="v" id="s-left">' + money(state.budget) + '</span></span>' +
    '</div>' +
    '<div style="margin-top: 16px;"><button class="btn" id="confirm-souvenirs">Confirm Gifts 🎁</button></div>' +
    '<div class="feedback" id="p5-feedback" role="status"></div>';

  const grid = card.querySelector('#souvenir-grid');
  const picks = [];
  config.souvenirs.forEach((s, idx) => {
    const c = document.createElement('button');
    c.className = 'pick-card'; c.setAttribute('aria-pressed', 'false');
    c.innerHTML =
      '<span class="emoji" aria-hidden="true">' + s.emoji + '</span>' +
      '<span class="name">' + s.label + '</span>' +
      '<span class="meta"><span class="price">' + money(s.cost) + '</span></span>';
    c.addEventListener('click', () => {
      const i = picks.indexOf(idx);
      if (i >= 0) { picks.splice(i, 1); c.classList.remove('selected'); c.setAttribute('aria-pressed', 'false'); }
      else {
        const subtotal = picks.reduce((sum, k) => sum + config.souvenirs[k].cost, 0) + s.cost;
        const taxed = config.taxEnabled ? applyTax(subtotal, TAX_RATES.goods) : round2(subtotal);
        if (taxed > state.budget) { showFeedback(card.querySelector('#p5-feedback'), 'hint', "🤔 That costs more than you have left. Pick something cheaper."); return; }
        picks.push(idx); c.classList.add('selected'); c.setAttribute('aria-pressed', 'true');
      }
      updateSouvenirTotals(picks, card);
    });
    grid.appendChild(c);
  });
  card.querySelector('#confirm-souvenirs').addEventListener('click', () => confirmSouvenirs(picks, card));
  attachReadAloud(card);
  return card;
}
function updateSouvenirTotals(picks, card) {
  const subtotal = round2(picks.reduce((sum, k) => sum + config.souvenirs[k].cost, 0));
  const taxed = config.taxEnabled ? applyTax(subtotal, TAX_RATES.goods) : subtotal;
  card.querySelector('#s-cost').textContent = money(subtotal);
  if (config.taxEnabled) card.querySelector('#s-taxed').textContent = money(taxed);
  card.querySelector('#s-left').textContent = money(round2(state.budget - taxed));
  const fb = card.querySelector('#p5-feedback');
  if (fb.classList.contains('hint')) { fb.className = 'feedback'; fb.textContent = ''; }
}
function confirmSouvenirs(picks, card) {
  const chosen = picks.map(i => config.souvenirs[i]);
  const subtotal = round2(chosen.reduce((s, d) => s + d.cost, 0));
  const taxed = config.taxEnabled ? applyTax(subtotal, TAX_RATES.goods) : subtotal;
  state.souvenirs = chosen; state.souvenirsCharged = taxed; state.budget = moneyLeft(state.budget, taxed); updateTrackers();
  awardStamp('Souvenir Shopper');
  const msg = chosen.length ? ('✓ Nice! You bought ' + chosen.length + ' gift' + (chosen.length > 1 ? 's' : '') + ' for ' + money(taxed) + '.') : '✓ You saved all your money for next time!';
  showFeedback(card.querySelector('#p5-feedback'), 'ok', msg);
  setTimeout(() => { state.phase = 6; renderApp(); }, 1000);
}

/* =========================================================
   === PHASE 6: HEADING HOME + CERTIFICATE ===
   ========================================================= */
function renderPhase6() {
  const trip = computeTrip();
  state.returnTrain = trip.returnTrain;
  const rideMins = minutesBetween(trip.returnTrain.depart, trip.returnTrain.arrive);
  const card = document.createElement('section');
  card.className = 'card phase-card';
  const missedNote = trip.missedLast
    ? '<p class="phase-subtitle" style="color:#6A4A00;">Your day in Boston ran long, so you catch the <strong>last</strong> train of the night!</p>'
    : '';
  card.innerHTML =
    '<div class="phase-head"><div class="phase-badge">6</div><h2 class="phase-title">Heading Home</h2></div>' +
    missedNote +
    '<p class="phase-subtitle">Your return train (<strong>Downeaster ' + trip.returnTrain.num + '</strong>) leaves Boston at <strong>' +
      trip.returnTrain.depart + '</strong> and the ride takes <strong>' + formatDuration(rideMins) + '</strong>. ' +
      'Set the clock to the time you get home to Portland. ' + stdBadgeHTML('3.MD.A.1', '4.MD.A.2') + '</p>' +
    '<div id="home-question"></div>' +
    '<div class="feedback" id="p6-feedback" role="status"></div>';

  const fb = card.querySelector('#p6-feedback');
  const clock = buildClock(trip.homeMins, () => {
    state.homeTime = formatTime(trip.homeMins);
    state.minutesAway = trip.minutesAway; updateTrackers();
    confetti();
    setTimeout(() => showCertificate(card, trip), 600);
  }, fb, { fromMins: parseTime(trip.returnTrain.depart), rideMins: rideMins });
  card.querySelector('#home-question').appendChild(clock);
  attachReadAloud(card);
  return card;
}

function showCertificate(card, trip) {
  const dateStr = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  const destItems = state.destinations.map(d =>
    '<li>' + d.emoji + ' <strong>' + d.name + '</strong> — ' + money(d.cost) + ', ' + d.hours + ' hr (' + d.line + ' Line · ' + (d.stop || '—') + ')' +
    (d.fact ? '<br><span class="cert-fact">💡 ' + d.fact + '</span>' : '') + '</li>').join('');
  const souvList = state.souvenirs.length
    ? state.souvenirs.map(s => s.emoji + ' ' + s.label + ' (' + money(s.cost) + ')').join(', ') + (config.taxEnabled ? ' — ' + money(state.souvenirsCharged) + ' with tax' : '')
    : 'None — saved the money!';
  const stampList = state.stamps.map(n => '<span class="cert-stamp">✓ ' + n + '</span>').join('');
  const lunchLine = state.lunch
    ? (state.lunch.emoji + ' <strong>' + state.lunch.label + '</strong> (' + money(state.lunch.cost) + (config.taxEnabled ? ', ' + money(state.lunchCharged) + ' with tax' : '') + ')')
    : 'Skipped';

  card.innerHTML =
    '<div class="certificate">' +
      '<h2>🏆 Certificate of Completion</h2>' +
      '<div class="cert-name">' + escAttr(state.name) + '’s Boston Adventure</div>' +
      '<div class="cert-date">' + dateStr + '</div>' +
      '<div class="cert-stamps">' + stampList + '</div>' +

      '<div class="cert-section">' +
        '<h3>🚆 Train There</h3>' +
        '<p>Took <strong>Downeaster ' + state.train.num + ' (' + state.train.label + ')</strong> from Portland at <strong>' + state.train.depart +
          '</strong>, arriving Boston North Station at <strong>' + state.arrivalTime + '</strong>.</p>' +
        '<h3>🚇 Subway</h3>' +
        '<p>Bought a <strong>' + state.pass.label + '</strong> (' + money(state.pass.cost) + ') and rode the <strong>' +
          config.subway.correctLine + ' Line</strong> from ' + config.subway.from + ' to ' + config.subway.to + '.</p>' +
        '<h3>🗺️ Attractions</h3>' +
        '<ul>' + destItems + '</ul>' +
        '<h3>🍽️ Lunch</h3>' +
        '<p>' + lunchLine + '</p>' +
        '<h3>🎁 Souvenirs</h3>' +
        '<p>' + souvList + '</p>' +
        '<h3>🚆 Train Home</h3>' +
        '<p>Took <strong>Downeaster ' + trip.returnTrain.num + '</strong> from Boston at <strong>' + trip.returnTrain.depart +
          '</strong>, home in Portland by <strong>' + state.homeTime + '</strong>.</p>' +
        '<h3>📊 Trip Totals</h3>' +
        '<p>Spent <strong>' + money(trip.totalSpent) + '</strong> of ' + money(config.startingBudget) +
          '. Money left: <strong>' + money(state.budget) + '</strong>.</p>' +
        '<p>Total time away from home: <strong>' + formatDuration(trip.minutesAway) + '</strong>.</p>' +
      '</div>' +
    '</div>' +
    '<div class="no-print" style="margin-top: 20px; display: flex; gap: 10px; flex-wrap: wrap;">' +
      '<button class="btn" id="print-btn">🖨️ Print Certificate / Itinerary</button>' +
      '<button class="btn secondary" id="restart-btn">↻ Start Over</button>' +
    '</div>';

  card.querySelector('#print-btn').addEventListener('click', () => window.print());
  card.querySelector('#restart-btn').addEventListener('click', resetTrip);
}

/* =========================================================
   === LOCKED PLACEHOLDER + ORCHESTRATOR ===
   ========================================================= */
function renderLocked(num, title) {
  const card = document.createElement('section');
  card.className = 'card phase-card phase-locked'; card.setAttribute('aria-disabled', 'true');
  card.innerHTML =
    '<div class="phase-head"><div class="phase-badge">' + num + '</div><h2 class="phase-title">' + title + '</h2></div>' +
    '<div class="lock-note">🔒 Finish Phase ' + (num - 1) + ' to unlock this step.</div>';
  return card;
}
const PHASE_BUILDERS = { 1: renderPhase1, 2: renderPhase2, 3: renderPhase3, 4: renderPhase4, 5: renderPhase5, 6: renderPhase6 };
function renderApp() {
  const root = document.getElementById('phase-root'); root.innerHTML = '';
  PHASES.forEach((ph) => {
    const p = ph.n;
    if (p === state.phase) root.appendChild(PHASE_BUILDERS[p]());
    else if (p < state.phase) {
      const done = document.createElement('section');
      done.className = 'card phase-card phase-done-card';
      done.innerHTML = '<div class="phase-head"><div class="phase-badge">✓</div><h2 class="phase-title">Phase ' + p + ' Complete: ' + ph.title + '</h2></div>';
      root.appendChild(done);
    } else root.appendChild(renderLocked(p, ph.title));
  });
  updateJourney();
}

/* =========================================================
   === JOURNEY + PASSPORT (rendered from descriptors) ===
   ========================================================= */
function initJourney() {
  const j = document.getElementById('journey'); j.innerHTML = '';
  PHASES.forEach((p) => {
    const step = document.createElement('div'); step.className = 'journey-step'; step.dataset.step = p.n;
    step.innerHTML = '<span class="j-ico" aria-hidden="true">' + p.icon + '</span><span>' + p.short + '</span>';
    j.appendChild(step);
  });
}
function initPassport() {
  const s = document.getElementById('stamps'); s.innerHTML = '';
  STAMP_DEFS.forEach((d) => {
    const el = document.createElement('div'); el.className = 'stamp'; el.dataset.stamp = d.name;
    el.innerHTML = '<div class="seal" aria-hidden="true">' + d.seal + '</div><div class="stamp-name">' + d.name + '</div>';
    if (state.stamps.includes(d.name)) el.classList.add('unlocked');
    s.appendChild(el);
  });
}
function updatePassportName() {
  const h = document.getElementById('passport-h');
  const nm = (state.name && state.name !== 'Explorer') ? (escAttr(state.name) + '’s') : 'My';
  h.innerHTML = '<span aria-hidden="true">🛂</span> ' + nm + ' Passport';
}

/* =========================================================
   === WORD BANK (vocabulary pre-teach) ===
   ========================================================= */
function initWordBank() {
  const list = document.getElementById('word-bank-list');
  if (!list) return;
  list.innerHTML = '';
  VOCAB.forEach((v) => {
    const row = document.createElement('div'); row.className = 'word-row';
    const dt = document.createElement('dt'); dt.textContent = v.term;
    if (config.readAloud && Speech.supported) {
      dt.appendChild(Speech.button(() => v.term + '. ' + v.def, ''));
    }
    const dd = document.createElement('dd'); dd.textContent = v.def;
    row.appendChild(dt); row.appendChild(dd);
    list.appendChild(row);
  });
}

/* =========================================================
   === TIME HELPER ===
   ========================================================= */
function initTimeHelper() {
  const startSel = document.getElementById('th-start');
  const endRange = document.getElementById('th-end');
  const ticks = document.getElementById('th-ticks');
  const out = document.getElementById('th-out');
  document.getElementById('th-std').title = STANDARDS['3.MD.A.1'];
  startSel.innerHTML = '';
  for (let m = 6 * 60; m <= 20 * 60; m += 30) {
    const opt = document.createElement('option'); opt.value = m; opt.textContent = formatTime(m);
    if (m === 8 * 60) opt.selected = true; startSel.appendChild(opt);
  }
  ticks.innerHTML = '';
  for (let i = 0; i < 13; i++) { const t = document.createElement('div'); t.className = 'tick'; t.textContent = i; ticks.appendChild(t); }
  function refresh() {
    const startMin = parseInt(startSel.value, 10);
    const halfHours = parseInt(endRange.value, 10);
    const durationMin = halfHours * 30;
    const endMin = startMin + durationMin;
    const hours = durationMin / 60;
    const hoursLabel = (hours === 1) ? '1 hour' : hours + ' hours';
    out.textContent = 'From ' + formatTime(startMin) + ' to ' + formatTime(endMin) + ' = ' + hoursLabel;
    endRange.setAttribute('aria-valuenow', halfHours);
    endRange.setAttribute('aria-valuetext', hoursLabel);
    const wholeHours = Math.floor(hours);
    document.querySelectorAll('#th-ticks .tick').forEach((el, idx) => { el.classList.toggle('active', idx > 0 && idx <= wholeHours); });
  }
  startSel.addEventListener('change', refresh);
  endRange.addEventListener('input', refresh);
  refresh();
}

/* =========================================================
   === SETTINGS MODAL ===
   ========================================================= */
function lineOptionsHTML(selected) {
  return Object.keys(LINE_COLORS).map(n => '<option value="' + n + '"' + (n === selected ? ' selected' : '') + '>' + n + '</option>').join('');
}
function rowVal(row, sel) { return row.querySelector(sel).value.trim(); }
function rowInt(row, sel, fallback) { const n = parseInt(row.querySelector(sel).value, 10); return isNaN(n) ? fallback : n; }
function rowNum(row, sel, fallback) { const n = parseFloat(row.querySelector(sel).value); return isNaN(n) ? fallback : n; }

// Times are free text (e.g. "7:18 AM") so real off-the-half-hour
// schedule times like 5:18 or 11:48 are kept exactly as entered.
function buildTrainRow(t) {
  t = t || { label: '', depart: '8:00 AM', arrive: '10:30 AM' };
  const row = document.createElement('div'); row.className = 'erow train';
  row.innerHTML =
    '<input type="text" class="set-input f-label" value="' + escAttr(t.label) + '" placeholder="Train name">' +
    '<input type="text" class="set-input f-depart" value="' + escAttr(t.depart) + '" placeholder="7:18 AM">' +
    '<input type="text" class="set-input f-arrive" value="' + escAttr(t.arrive) + '" placeholder="9:50 AM">' +
    '<button type="button" class="row-del" aria-label="Remove train">✕</button>';
  row.querySelector('.row-del').addEventListener('click', () => row.remove());
  return row;
}
function buildReturnRow(t) {
  t = t || { label: '', depart: '5:00 PM', arrive: '7:30 PM' };
  const row = document.createElement('div'); row.className = 'erow rtrain';
  row.innerHTML =
    '<input type="text" class="set-input f-label" value="' + escAttr(t.label) + '" placeholder="Return train name">' +
    '<input type="text" class="set-input f-depart" value="' + escAttr(t.depart) + '" placeholder="5:20 PM">' +
    '<input type="text" class="set-input f-arrive" value="' + escAttr(t.arrive) + '" placeholder="7:55 PM">' +
    '<button type="button" class="row-del" aria-label="Remove return train">✕</button>';
  row.querySelector('.row-del').addEventListener('click', () => row.remove());
  return row;
}
function buildPassRow(p) {
  p = p || { label: '', cost: 0, blurb: '' };
  const row = document.createElement('div'); row.className = 'erow pass';
  row.innerHTML =
    '<input type="text" class="set-input f-label" value="' + escAttr(p.label) + '" placeholder="Pass name">' +
    '<input type="number" class="set-input f-cost" min="0" max="999" step="0.01" value="' + (p.cost || 0) + '">' +
    '<input type="text" class="set-input f-blurb" value="' + escAttr(p.blurb || '') + '" placeholder="Short description">' +
    '<button type="button" class="row-del" aria-label="Remove pass">✕</button>';
  row.querySelector('.row-del').addEventListener('click', () => row.remove());
  return row;
}
function buildDestRow(d) {
  d = d || { emoji: '📍', name: '', category: '', line: 'Green', stop: '', cost: 0, costAdult: 0, hours: 1, fact: '' };
  const row = document.createElement('div'); row.className = 'erow dest';
  row.innerHTML =
    '<input type="text" class="set-input f-emoji" value="' + escAttr(d.emoji) + '" maxlength="3">' +
    '<input type="text" class="set-input f-name" value="' + escAttr(d.name) + '" placeholder="Place name">' +
    '<input type="text" class="set-input f-cat" value="' + escAttr(d.category) + '" placeholder="Category">' +
    '<select class="set-select f-line">' + lineOptionsHTML(d.line) + '</select>' +
    '<input type="text" class="set-input f-stop" value="' + escAttr(d.stop || '') + '" placeholder="Nearest stop">' +
    '<input type="number" class="set-input f-cost" min="0" max="999" step="1" value="' + (d.cost || 0) + '" title="Youth price">' +
    '<input type="number" class="set-input f-adult" min="0" max="999" step="1" value="' + (d.costAdult != null ? d.costAdult : (d.cost || 0)) + '" title="Adult price">' +
    '<input type="number" class="set-input f-hours" min="1" max="12" step="1" value="' + (d.hours || 1) + '">' +
    '<input type="text" class="set-input f-fact" value="' + escAttr(d.fact || '') + '" placeholder="Did you know?">' +
    '<button type="button" class="row-del" aria-label="Remove attraction">✕</button>';
  row.querySelector('.row-del').addEventListener('click', () => row.remove());
  return row;
}
function buildFoodRow(f) {
  f = f || { emoji: '🍽️', label: '', cost: 0, hours: 1, fact: '' };
  const row = document.createElement('div'); row.className = 'erow food';
  row.innerHTML =
    '<input type="text" class="set-input f-emoji" value="' + escAttr(f.emoji) + '" maxlength="3">' +
    '<input type="text" class="set-input f-label" value="' + escAttr(f.label) + '" placeholder="Food name">' +
    '<input type="number" class="set-input f-cost" min="0" max="999" step="1" value="' + (f.cost || 0) + '">' +
    '<input type="number" class="set-input f-hours" min="1" max="12" step="1" value="' + (f.hours || 1) + '">' +
    '<input type="text" class="set-input f-fact" value="' + escAttr(f.fact || '') + '" placeholder="Did you know?">' +
    '<button type="button" class="row-del" aria-label="Remove lunch">✕</button>';
  row.querySelector('.row-del').addEventListener('click', () => row.remove());
  return row;
}
function buildSouvenirRow(s) {
  s = s || { emoji: '🎁', label: '', cost: 0 };
  const row = document.createElement('div'); row.className = 'erow souvenir';
  row.innerHTML =
    '<input type="text" class="set-input f-emoji" value="' + escAttr(s.emoji) + '" maxlength="3">' +
    '<input type="text" class="set-input f-label" value="' + escAttr(s.label) + '" placeholder="Souvenir name">' +
    '<input type="number" class="set-input f-cost" min="0" max="999" step="1" value="' + (s.cost || 0) + '">' +
    '<button type="button" class="row-del" aria-label="Remove souvenir">✕</button>';
  row.querySelector('.row-del').addEventListener('click', () => row.remove());
  return row;
}

function fillRows(containerId, items, builder) {
  const box = document.getElementById(containerId); box.innerHTML = '';
  items.forEach(it => box.appendChild(builder(it)));
}
function populateSettingsFormFrom(cfg) {
  document.getElementById('set-difficulty').value = cfg.difficulty || 'friendly';
  document.getElementById('set-standards').checked = !!cfg.showStandards;
  document.getElementById('set-simple').checked = !!cfg.simpleLanguage;
  document.getElementById('set-readaloud').checked = !!cfg.readAloud;
  document.getElementById('set-tax').checked = !!cfg.taxEnabled;
  document.getElementById('set-name').value = (state.name === 'Explorer') ? '' : state.name;
  document.getElementById('set-budget').value = cfg.startingBudget;
  fillRows('trains-rows', cfg.trains, buildTrainRow);
  fillRows('rtrains-rows', cfg.returnTrains, buildReturnRow);
  fillRows('passes-rows', cfg.passes, buildPassRow);
  document.getElementById('set-from').value = cfg.subway.from;
  document.getElementById('set-to').value = cfg.subway.to;
  document.getElementById('set-line').innerHTML = lineOptionsHTML(cfg.subway.correctLine);
  document.getElementById('set-hint').value = cfg.subway.hint;
  fillRows('dests-rows', cfg.destinations, buildDestRow);
  fillRows('foods-rows', cfg.foods, buildFoodRow);
  fillRows('souvenirs-rows', cfg.souvenirs, buildSouvenirRow);
}
function populateSettingsForm() { populateSettingsFormFrom(config); }

function readSettingsForm() {
  const c = cloneDefaults();
  const diff = document.getElementById('set-difficulty').value;
  c.difficulty = (['support', 'friendly', 'challenge'].indexOf(diff) >= 0) ? diff : 'friendly';
  c.showStandards = document.getElementById('set-standards').checked;
  c.simpleLanguage = document.getElementById('set-simple').checked;
  c.readAloud = document.getElementById('set-readaloud').checked;
  c.taxEnabled = document.getElementById('set-tax').checked;
  const b = parseFloat(document.getElementById('set-budget').value);
  c.startingBudget = isNaN(b) ? 75 : Math.max(0, b);

  c.trains = Array.prototype.map.call(document.querySelectorAll('#trains-rows .erow'), (r, i) => ({
    id: String.fromCharCode(65 + i), num: String(680 + i * 2),
    label: rowVal(r, '.f-label') || ('Train ' + (i + 1)),
    depart: rowVal(r, '.f-depart') || '8:00 AM',
    arrive: rowVal(r, '.f-arrive') || '10:30 AM',
  }));
  c.returnTrains = Array.prototype.map.call(document.querySelectorAll('#rtrains-rows .erow'), (r, i) => ({
    id: 'R' + (i + 1), num: String(681 + i * 2),
    label: rowVal(r, '.f-label') || ('Return ' + (i + 1)),
    depart: rowVal(r, '.f-depart') || '5:00 PM',
    arrive: rowVal(r, '.f-arrive') || '7:30 PM',
  }));
  c.passes = Array.prototype.map.call(document.querySelectorAll('#passes-rows .erow'), (r) => ({
    label: rowVal(r, '.f-label') || 'Pass', cost: Math.max(0, rowNum(r, '.f-cost', 0)), blurb: rowVal(r, '.f-blurb'),
  }));
  c.subway = {
    from: document.getElementById('set-from').value.trim() || 'North Station',
    to: document.getElementById('set-to').value.trim() || 'Park Street',
    correctLine: document.getElementById('set-line').value,
    hint: document.getElementById('set-hint').value.trim(),
  };
  c.destinations = Array.prototype.map.call(document.querySelectorAll('#dests-rows .erow'), (r) => ({
    emoji: rowVal(r, '.f-emoji') || '📍', name: rowVal(r, '.f-name') || 'Attraction',
    category: rowVal(r, '.f-cat'), line: r.querySelector('.f-line').value, stop: rowVal(r, '.f-stop'),
    cost: Math.max(0, rowInt(r, '.f-cost', 0)), costAdult: Math.max(0, rowInt(r, '.f-adult', 0)),
    hours: Math.max(1, rowInt(r, '.f-hours', 1)), fact: rowVal(r, '.f-fact'),
  }));
  c.foods = Array.prototype.map.call(document.querySelectorAll('#foods-rows .erow'), (r) => ({
    emoji: rowVal(r, '.f-emoji') || '🍽️', label: rowVal(r, '.f-label') || 'Lunch',
    cost: Math.max(0, rowInt(r, '.f-cost', 0)), hours: Math.max(1, rowInt(r, '.f-hours', 1)), fact: rowVal(r, '.f-fact'),
  }));
  c.souvenirs = Array.prototype.map.call(document.querySelectorAll('#souvenirs-rows .erow'), (r) => ({
    emoji: rowVal(r, '.f-emoji') || '🎁', label: rowVal(r, '.f-label') || 'Souvenir', cost: Math.max(0, rowInt(r, '.f-cost', 0)),
  }));
  return ensurePlayable(c);
}
function applyAccessibilityMode() {
  document.body.classList.toggle('show-standards', !!config.showStandards);
}
function openSettings() { populateSettingsForm(); document.getElementById('settings-overlay').classList.add('open'); }
function closeSettings() { document.getElementById('settings-overlay').classList.remove('open'); }

function exportSettings() {
  try {
    const data = JSON.stringify(readSettingsForm(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'boston-trip-settings.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (e) { alert('Sorry — could not export the settings file.'); }
}
function importSettings(file) {
  const note = document.getElementById('io-note');
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const merged = sanitizeConfig(parsed);
      populateSettingsFormFrom(merged);
      if (note) note.textContent = 'Imported! Review the values, then press “Save & Restart”.';
    } catch (e) {
      if (note) note.textContent = 'That file could not be read. Please choose a settings file you exported here.';
    }
  };
  reader.onerror = () => { if (note) note.textContent = 'Could not read that file.'; };
  reader.readAsText(file);
}

function initSettings() {
  document.getElementById('open-settings').addEventListener('click', openSettings);
  document.getElementById('close-settings-x').addEventListener('click', closeSettings);
  document.getElementById('cancel-settings').addEventListener('click', closeSettings);
  document.getElementById('add-train').addEventListener('click', () => document.getElementById('trains-rows').appendChild(buildTrainRow()));
  document.getElementById('add-rtrain').addEventListener('click', () => document.getElementById('rtrains-rows').appendChild(buildReturnRow()));
  document.getElementById('add-pass').addEventListener('click', () => document.getElementById('passes-rows').appendChild(buildPassRow()));
  document.getElementById('add-dest').addEventListener('click', () => document.getElementById('dests-rows').appendChild(buildDestRow()));
  document.getElementById('add-food').addEventListener('click', () => document.getElementById('foods-rows').appendChild(buildFoodRow()));
  document.getElementById('add-souvenir').addEventListener('click', () => document.getElementById('souvenirs-rows').appendChild(buildSouvenirRow()));

  document.getElementById('export-settings').addEventListener('click', exportSettings);
  const importInput = document.getElementById('import-file');
  document.getElementById('import-settings').addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', (e) => { if (e.target.files && e.target.files[0]) importSettings(e.target.files[0]); e.target.value = ''; });

  document.getElementById('save-settings').addEventListener('click', () => {
    config = readSettingsForm(); saveConfig();
    const nm = document.getElementById('set-name').value.trim();
    state.name = nm || 'Explorer'; saveName(state.name === 'Explorer' ? '' : state.name);
    applyAccessibilityMode(); updatePassportName(); initWordBank(); closeSettings(); resetTrip();
  });
  document.getElementById('reset-settings').addEventListener('click', () => {
    config = cloneDefaults(); saveConfig(); populateSettingsForm(); applyAccessibilityMode();
    const note = document.getElementById('io-note'); if (note) note.textContent = 'Reset to defaults. Press “Save & Restart” to use them.';
  });
  document.getElementById('settings-overlay').addEventListener('click', (e) => { if (e.target.id === 'settings-overlay') closeSettings(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSettings(); });
}

/* =========================================================
   === NAME OVERLAY ===
   ========================================================= */
function initNameOverlay() {
  const overlay = document.getElementById('name-overlay');
  const input = document.getElementById('name-input');
  function finish(name) {
    state.name = (name && name.trim()) ? name.trim() : 'Explorer';
    saveName(state.name === 'Explorer' ? '' : state.name);
    updatePassportName();
    overlay.classList.remove('open');
  }
  document.getElementById('name-start').addEventListener('click', () => finish(input.value));
  document.getElementById('name-skip').addEventListener('click', () => finish(''));
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') finish(input.value); });
  if (!loadName()) { overlay.classList.add('open'); setTimeout(() => input.focus(), 50); }
}

/* =========================================================
   === INIT ===
   ========================================================= */
document.addEventListener('DOMContentLoaded', () => {
  initJourney();
  initPassport();
  updatePassportName();
  applyAccessibilityMode();
  initWordBank();
  initSettings();
  initNameOverlay();
  initTimeHelper();
  updateTrackers();
  renderApp();
});
