# Preferred Number Prediction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a protected preferred-number prediction area to every lottery tab so users can enter their numbers and receive historical score, margin, sample size, and confidence without promising winnings.

**Architecture:** The statistical estimator lives in Firebase Cloud Functions to protect prediction logic and support rate limiting/audit later. The static page in `sitio/` only validates inputs, calls the callable endpoint, and renders the returned score with clear responsible-play language.

**Tech Stack:** Firebase Functions Node 22, vanilla JavaScript, Firebase Web SDK, static HTML/CSS in Firebase Hosting.

---

## File Structure

- Modify `functions/index.js`: add pure helpers plus callable `estimatePreferredNumbers`.
- Add `functions/preferred-number-estimator.test.js`: Node test suite for validation and scoring helpers.
- Modify `sitio/index.html`: add one reusable preferred-number panel per lottery section, preserving existing tabs/buttons/history.
- Modify `sitio/app.js`: add client-side input parsing, callable invocation, fallback messaging, and rendering.
- Modify `sitio/styles.css`: add responsive styling for the new panel.
- Update `DOCUMENTACION_SISTEMA.md` or a memory note after verification.

No commits are part of this plan unless Amin explicitly requests a git commit.

---

### Task 1: Backend Estimator Tests

**Files:**
- Add: `functions/preferred-number-estimator.test.js`
- Modify: `functions/package.json`

- [ ] **Step 1: Add a Node test script**

Add this script to `functions/package.json`:

```json
"test": "node --test preferred-number-estimator.test.js"
```

- [ ] **Step 2: Write failing estimator tests**

Create tests that import exported pure helpers from `functions/index.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizePreferredNumbersForTest,
  estimatePreferredNumbersForTest,
} = require('./index.js');

test('validates main and special preferred numbers for Powerball', () => {
  const ranges = { mainCount: 5, mainMin: 1, mainMax: 69, hasSpecial: true, specialMin: 1, specialMax: 26 };
  const result = normalizePreferredNumbersForTest({
    gameType: 'powerball',
    numbers: [1, 2, 3, 4, 5],
    special: 10,
    ranges,
  });

  assert.deepEqual(result.mainNumbers, [1, 2, 3, 4, 5]);
  assert.equal(result.special, 10);
});

test('rejects duplicate numbers except Win 4 digit games', () => {
  const ranges = { mainCount: 5, mainMin: 1, mainMax: 69, hasSpecial: false };
  assert.throws(() => normalizePreferredNumbersForTest({
    gameType: 'powerball',
    numbers: [1, 1, 3, 4, 5],
    ranges,
  }), /duplicados/);
});

test('returns score, margin, sample size and disclaimer', () => {
  const ranges = { mainCount: 5, mainMin: 1, mainMax: 10, hasSpecial: false };
  const history = [
    { mainNumbers: [1, 2, 3, 4, 5], drawDate: '2026-06-12' },
    { mainNumbers: [1, 2, 6, 7, 8], drawDate: '2026-06-11' },
    { mainNumbers: [1, 9, 10, 4, 5], drawDate: '2026-06-10' },
  ];

  const result = estimatePreferredNumbersForTest({
    gameType: 'take5day',
    numbers: [1, 2, 3, 4, 5],
    ranges,
    history,
  });

  assert.equal(result.sampleSize, 3);
  assert.equal(result.numbers.length, 5);
  assert.ok(result.setScorePct > 0);
  assert.match(result.disclaimer, /no garantiza/i);
});
```

- [ ] **Step 3: Verify RED**

Run:

```powershell
cd "C:\Users\Amin\OneDrive\Desktop\01_PROYECTOS-ACTIVOS\Game Lottery\functions"
npm test
```

Expected: tests fail because the exported helper names do not exist yet.

---

### Task 2: Backend Callable

**Files:**
- Modify: `functions/index.js`

- [ ] **Step 1: Add pure helpers**

Implement:

```js
function normalizePreferredNumbers({ gameType, numbers, special, ranges }) {}
function estimatePreferredNumbers({ gameType, numbers, special, ranges, history }) {}
function buildConfidenceLabel(sampleSize) {}
function calculateNumberScores(history, ranges, useSpecial = false) {}
```

Rules:
- Main numbers must match `mainCount`.
- Pick 10 users enter 10 numbers, while draw history may contain 20 drawn numbers.
- Win 4 allows repeated digits and preserves order.
- Other games reject duplicate main numbers.
- Score is a historical signal: frequency 45%, recency 35%, gap balance 20%.
- Confidence is based on sample size only: `<10 low`, `10-49 medium`, `>=50 high`.
- Response always includes a disclaimer that historical statistics do not guarantee future results.

- [ ] **Step 2: Export test-only helpers**

Expose helpers for `node --test` without changing callable behavior:

```js
exports.normalizePreferredNumbersForTest = normalizePreferredNumbers;
exports.estimatePreferredNumbersForTest = estimatePreferredNumbers;
```

- [ ] **Step 3: Add callable endpoint**

Add `exports.estimatePreferredNumbers = onCall(...)` that:
- validates `request.data.gameType`, `numbers`, and optional `special`;
- loads recent history from `lottery_history/{gameType}_{year}/draws`;
- falls back to available model/history windows when needed;
- returns `{ gameType, numbers, special, setScorePct, setMarginVsPoolPct, sampleSize, confidenceLabel, disclaimer }`.

- [ ] **Step 4: Verify GREEN**

Run:

```powershell
cd "C:\Users\Amin\OneDrive\Desktop\01_PROYECTOS-ACTIVOS\Game Lottery\functions"
npm test
```

Expected: all preferred estimator tests pass.

---

### Task 3: Frontend UI Per Tab

**Files:**
- Modify: `sitio/index.html`
- Modify: `sitio/styles.css`

- [ ] **Step 1: Add the preferred-number panel to every lottery section**

Place it after the existing `PREDECIR` / `ESTADISTICAS` button grid and before `.generated-numbers-container`.

Panel structure:

```html
<div class="preferred-prediction-panel" data-lottery="powerball">
  <h3>Evalua tus numeros preferidos</h3>
  <p>Referencia estadistica basada en historial disponible. No garantiza premios.</p>
  <div class="preferred-main-inputs" data-lottery="powerball"></div>
  <div class="preferred-special-wrap" data-lottery="powerball"></div>
  <button class="preferred-estimate-btn" data-lottery="powerball">CALCULAR MARGEN</button>
  <div class="preferred-estimate-result hidden" data-lottery="powerball"></div>
</div>
```

- [ ] **Step 2: Style the panel**

Use the current dark card style, mobile-first inputs of at least 16px, clear focus state, and compact result cards.

---

### Task 4: Frontend Logic

**Files:**
- Modify: `sitio/app.js`

- [ ] **Step 1: Generate inputs from `LOTTERY_CONFIG`**

Add a function:

```js
function hydratePreferredPredictionPanels() {}
```

It creates the correct number of main inputs for each lottery:
- Powerball/M4L/Mega/Take5: `mainCount`.
- Pick10: `mainCount` user selections, not `drawResultCount`.
- Win4: four digit inputs `0-9`.

- [ ] **Step 2: Call the backend**

Add click listeners for `.preferred-estimate-btn`:
- Parse numbers.
- Validate ranges before network call.
- Use `httpsCallable(functions, 'estimatePreferredNumbers')`.
- Render backend result.
- If callable is unavailable, show a clear non-crashing message and leave existing prediction/statistics untouched.

- [ ] **Step 3: Render compliant language**

Result copy must use:
- "score historico"
- "margen vs promedio del juego"
- "confianza por muestra"
- "no garantiza premios"

Avoid:
- "seguro"
- "garantizado"
- "mejor numero para ganar"
- "alta probabilidad de ganar"

---

### Task 5: Verification And Memory

**Files:**
- Update: `DOCUMENTACION_SISTEMA.md` or Obsidian/memory note

- [ ] **Step 1: Static syntax check**

Run:

```powershell
cd "C:\Users\Amin\OneDrive\Desktop\01_PROYECTOS-ACTIVOS\Game Lottery"
node --check "sitio\app.js"
node --check "functions\index.js"
```

- [ ] **Step 2: Tests**

Run:

```powershell
cd "C:\Users\Amin\OneDrive\Desktop\01_PROYECTOS-ACTIVOS\Game Lottery\functions"
npm test
```

- [ ] **Step 3: Deploy only after local verification**

Run:

```powershell
cd "C:\Users\Amin\OneDrive\Desktop\01_PROYECTOS-ACTIVOS\Game Lottery"
firebase deploy --only functions,hosting
```

- [ ] **Step 4: Public verification**

Check:

```powershell
curl -I https://www.prediccionloteria.com/
curl -I https://www.prediccionloteria.com/ads.txt
curl https://www.prediccionloteria.com/ads.txt
curl -I https://www.prediccionloteria.com/robots.txt
curl -I https://www.prediccionloteria.com/sitemap.xml
```

Expected:
- Home: `200 OK`.
- `ads.txt`: `200 OK`, `text/plain`, publisher `pub-8721021745606812`, no HTML.
- `robots.txt`: `200 OK`.
- `sitemap.xml`: `200 OK`, `application/xml`.

- [ ] **Step 5: Save memory**

Create/update a local Obsidian-readable note with:
- feature summary;
- files changed;
- deployment ID if deployed;
- verification results;
- warning that predictions are historical entertainment, not guaranteed outcomes.
