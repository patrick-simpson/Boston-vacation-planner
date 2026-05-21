/* =========================================================
   Boston Transit Adventure — LESSON DATA
   ---------------------------------------------------------
   This file holds all the editable content: trains, fares,
   attractions, lunches, souvenirs, vocabulary, and standards.
   Teachers can change everything here OR from the in-app
   Settings (gear) button — no other code editing needed.

   REAL-WORLD NOTE
   The Downeaster times below match the published weekday
   schedule (Amtrak Downeaster, timetable effective Oct 2025).
   Fares match the MBTA fare structure. Attraction prices are
   approximate 2025-2026 youth admissions and should be
   re-checked before a real trip — they change often. The
   Settings > "Export settings" button lets you save edits.
   ========================================================= */

/* Massachusetts taxes — used only when "Add MA tax" is on. */
const TAX_RATES = { meals: 0.07, goods: 0.0625 };

/* Minutes to allow for the subway ride + walking to/from the
   train station. Used when picking a realistic return train. */
const GET_AROUND_BUFFER_MIN = 45;

const DEFAULT_CONFIG = {
  // 'support'   = multiple choice (2 choices) + number line shown.
  // 'friendly'  = multiple choice (3 choices) + "Show me how" help.
  // 'challenge' = type the money, finer clock steps.
  difficulty: 'friendly',

  // Accessibility / language helpers.
  simpleLanguage: false, // shorter, simpler instructions.
  readAloud: false,      // show "Read aloud" buttons (text-to-speech).
  taxEnabled: false,     // add Massachusetts tax to lunch + souvenirs.
  showStandards: false,  // show Maine standard tags around the page.

  // Day's spending money (whole dollars).
  startingBudget: 75,

  // Phase 1 — real Downeaster SOUTHBOUND trains (Portland -> Boston).
  // depart/arrive are the real published times; the ride is ~2h32m.
  trains: [
    { id: 'A', num: '680', label: 'Early Riser',   depart: '5:18 AM',  arrive: '7:50 AM'  },
    { id: 'B', num: '682', label: 'Morning Train',  depart: '7:18 AM',  arrive: '9:50 AM'  },
    { id: 'C', num: '684', label: 'Late Morning',   depart: '11:48 AM', arrive: '2:20 PM'  },
  ],

  // Phase 6 — real Downeaster NORTHBOUND trains (Boston -> Portland).
  // The app picks the first one that leaves after you finish your day.
  returnTrains: [
    { id: 'R1', num: '681', label: 'Mid-Morning Return', depart: '8:50 AM',  arrive: '11:25 AM' },
    { id: 'R2', num: '683', label: 'Midday Return',       depart: '11:50 AM', arrive: '2:25 PM'  },
    { id: 'R3', num: '685', label: 'Afternoon Return',    depart: '3:45 PM',  arrive: '6:20 PM'  },
    { id: 'R4', num: '687', label: 'Evening Return',      depart: '5:20 PM',  arrive: '7:55 PM'  },
    { id: 'R5', num: '689', label: 'Late Return',         depart: '10:30 PM', arrive: '1:05 AM'  },
  ],

  // Phase 2 — subway pass options (real MBTA fares).
  passes: [
    { label: 'Single Ride', cost: 2.40,  blurb: 'One subway ride (CharlieCard tap).' },
    { label: '1-Day Pass',  cost: 11,    blurb: 'Unlimited subway + bus for one day.' },
    { label: '7-Day Pass',  cost: 22.50, blurb: 'A whole week of riding.' },
  ],

  // Phase 2 — which colored line to choose.
  subway: {
    from: 'North Station',
    to: 'Park Street',
    correctLine: 'Green',
    hint: 'Look for the Green Line — it connects North Station to Park Street.',
  },

  // Phase 3 — attractions. cost = youth price (used for budget);
  // costAdult = grown-up price (shown so students see the difference).
  // stop = nearest MBTA stop. walk = note when you can walk instead.
  destinations: [
    { name: 'Museum of Science',                 line: 'Green',  stop: 'Science Park',     category: 'Science / Interactive',    cost: 27, costAdult: 32, hours: 3, emoji: '🔬', fact: 'It has a giant lightning show with real electricity!' },
    { name: 'New England Aquarium',              line: 'Blue',   stop: 'Aquarium',         category: 'Animals / Nature',         cost: 32, costAdult: 40, hours: 2, emoji: '🐠', fact: 'Its giant ocean tank holds 200,000 gallons of water.', walk: 'Walkable from Faneuil Hall.' },
    { name: "Boston Children's Museum",          line: 'Red',    stop: 'South Station',    category: 'Interactive / Play',       cost: 20, costAdult: 20, hours: 2, emoji: '🧸', fact: 'It is one of the oldest children’s museums in the world.' },
    { name: 'Boston Tea Party Ships & Museum',   line: 'Red',    stop: 'South Station',    category: 'History / Transportation', cost: 24, costAdult: 34, hours: 2, emoji: '⛵', fact: 'You can toss "tea" into the harbor like the colonists did in 1773.' },
    { name: 'USS Constitution Museum & Ship',    line: 'Green',  stop: 'North Station',    category: 'History / Transportation', cost: 5,  costAdult: 15, hours: 2, emoji: '⚓', fact: 'USS Constitution is the oldest warship still afloat in the world.' },
    { name: 'Fenway Park Tour',                  line: 'Green',  stop: 'Kenmore',          category: 'Sports / Recreation',      cost: 22, costAdult: 25, hours: 1, emoji: '⚾', fact: 'Fenway opened in 1912 and has a wall called the "Green Monster."' },
    { name: 'Boston Common & Swan Boats',        line: 'Green',  stop: 'Park Street',      category: 'Nature / Outdoor',         cost: 5,  costAdult: 5,  hours: 2, emoji: '🦢', fact: 'Boston Common is the oldest public park in the United States.', walk: 'A short walk from Park Street.' },
    { name: 'Franklin Park Zoo',                 line: 'Orange', stop: 'Forest Hills',     category: 'Animals / Nature',         cost: 18, costAdult: 23, hours: 3, emoji: '🦁', fact: 'It is home to gorillas, lions, and a tropical rainforest.' },
    { name: 'Legoland Discovery Center',         line: 'Orange', stop: 'Assembly',         category: 'Interactive / Play',       cost: 25, costAdult: 25, hours: 2, emoji: '🧱', fact: 'It has a model of Boston built from millions of LEGO bricks.' },
    { name: 'Kings Dining & Bowling',            line: 'Green',  stop: 'Hynes',            category: 'Recreation / Indoor',      cost: 18, costAdult: 18, hours: 2, emoji: '🎳', fact: 'You can bowl and play games all in one spot.' },
    { name: 'Harvard University Tour',           line: 'Red',    stop: 'Harvard',          category: 'Education / History',      cost: 10, costAdult: 15, hours: 2, emoji: '🎓', fact: 'Harvard opened in 1636 — the oldest college in the U.S.' },
    { name: 'View Boston Observation Deck',      line: 'Green',  stop: 'Prudential',       category: 'Views / Indoor',           cost: 30, costAdult: 38, hours: 1, emoji: '🏙️', fact: 'Opened in 2023 atop the Prudential Tower — 360° views of the city.' },
    { name: 'Boston Public Library',             line: 'Green',  stop: 'Copley',           category: 'Reading / History',        cost: 0,  costAdult: 0,  hours: 1, emoji: '📚', fact: 'It opened in 1848 and is free for everyone to visit.' },
    { name: 'Harvard Museum of Natural History', line: 'Red',    stop: 'Harvard',          category: 'Science / Nature',         cost: 13, costAdult: 15, hours: 2, emoji: '🦕', fact: 'See real dinosaur fossils and famous glass flowers.' },
    { name: 'Old North Church',                  line: 'Orange', stop: 'Haymarket',        category: 'History / Landmark',       cost: 8,  costAdult: 8,  hours: 1, emoji: '🔔', fact: '"One if by land, two if by sea" — the 1775 signal lanterns hung here.', walk: 'In the North End, walkable from the waterfront.' },
  ],

  // Phase 4 — lunch choices (cheapest stays affordable for everyone).
  foods: [
    { label: 'Pretzel Cart Snack', cost: 3,  hours: 1, emoji: '🥨', fact: 'Street carts have sold snacks in Boston for over 100 years.' },
    { label: 'Pizza Slice',        cost: 6,  hours: 1, emoji: '🍕', fact: 'The North End is Boston’s famous Italian neighborhood.' },
    { label: 'Clam Chowder Bowl',  cost: 9,  hours: 1, emoji: '🥣', fact: 'Clam chowder is a New England favorite.' },
    { label: 'Burger & Fries',     cost: 11, hours: 1, emoji: '🍔', fact: 'Boston has many classic diners.' },
    { label: 'Sit-Down Lunch',     cost: 14, hours: 1, emoji: '🍝', fact: 'A sit-down meal takes longer than a quick snack.' },
  ],

  // Phase 5 — souvenirs (optional spending).
  souvenirs: [
    { label: 'Postcard',     cost: 1,  emoji: '✉️' },
    { label: 'Sticker',      cost: 2,  emoji: '🏷️' },
    { label: 'Keychain',     cost: 4,  emoji: '🔑' },
    { label: 'T-Shirt',      cost: 12, emoji: '👕' },
    { label: 'Plush Animal', cost: 15, emoji: '🧸' },
    { label: 'Baseball Cap', cost: 18, emoji: '🧢' },
  ],
};

const LINE_COLORS = { Red: '#DA291C', Green: '#00843D', Blue: '#003DA5', Orange: '#ED8B00' };

// Phase descriptors drive the journey map, titles, and the render loop.
const PHASES = [
  { n: 1, icon: '🚆', short: 'Train',   title: 'The Downeaster Departure' },
  { n: 2, icon: '🚇', short: 'Subway',  title: 'The Subway Connection' },
  { n: 3, icon: '🎡', short: 'Explore', title: 'Pick Two Attractions' },
  { n: 4, icon: '🍽️', short: 'Lunch',   title: 'Lunchtime in Boston' },
  { n: 5, icon: '🎁', short: 'Gifts',   title: 'The Souvenir Shop' },
  { n: 6, icon: '🏆', short: 'Home',    title: 'Heading Home' },
];

const STAMP_DEFS = [
  { name: 'Train Conductor',  seal: '🚂' },
  { name: 'Subway Navigator', seal: '🚇' },
  { name: 'Boston Explorer',  seal: '🗽' },
  { name: 'Foodie',           seal: '🍽️' },
  { name: 'Souvenir Shopper', seal: '🎁' },
];

/* Maine Learning Results (math, grades 3-4). */
const STANDARDS = {
  '3.MD.A.1': 'Grade 3 (3.MD.A.1): Tell and write time to the nearest minute and measure time intervals in minutes; solve problems about elapsed time, using a number line.',
  '4.MD.A.2': 'Grade 4 (4.MD.A.2): Use the four operations to solve word problems involving money and intervals of time.',
  '3.NBT.A.2': 'Grade 3 (3.NBT.A.2): Fluently add and subtract within 1000 using place-value strategies.',
};

/* Phase 2 vocabulary pre-teach (sidebar Word Bank). */
const VOCAB = [
  { term: 'Schedule',  def: 'A list of times when trains leave and arrive.' },
  { term: 'Departure', def: 'The time your train leaves.' },
  { term: 'Arrival',   def: 'The time you get there.' },
  { term: 'Fare',      def: 'The money you pay to ride the subway.' },
  { term: 'Admission', def: 'The money you pay to get into a place.' },
  { term: 'Budget',    def: 'The money you have to spend for the day.' },
  { term: 'Transfer',  def: 'Changing from one train or line to another.' },
  { term: 'Souvenir',  def: 'A small gift you buy to remember a trip.' },
];
