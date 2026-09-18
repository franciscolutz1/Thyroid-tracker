# Thyroid Tracker — Project Context & Handoff

A handoff document for working on this project in Claude Code. Claude Code can read
the repo directly, so this file focuses on things that aren't obvious from the source:
conventions, schema, gotchas, and change history.

---

## What it is

- Personal health-tracking Progressive Web App. Francisco is the **sole developer and
  the only user** — it's a private tool, not a product.
- Tracks meals/nutrients, meds & vitamins, symptoms, exercise, weight, and labs, and
  computes a daily thyroid "score" from all of it.
- Grew out of an earlier artifact-based wellness tracker into a full PWA.

## Stack & deploy

- **React + Vite.** Large **single-file architecture**: essentially everything lives in
  `src/App.jsx` (~4,900 lines). Other files: `src/main.jsx`, `src/firebase.js`.
- **Firestore** for cloud sync, with **localStorage fallback**.
- Repo: `github.com/franciscolutz1/Thyroid-tracker` → auto-deploys to **Vercel** at
  `thyroid-trackery.vercel.app` on every push to `main`.
- Vercel **Output Directory must be `dist`** (Vite's default). A wrong value produces the
  "No Output Directory named 'build' found" error.
- Previously deployed via manual Vercel CLI zip uploads; now GitHub-connected auto-deploy.

## Workflow note (changed as of this handoff)

Historically all edits were pasted into **GitHub's web editor from an iPad**, which
created two hard constraints:
- **Smart quotes break the build.** iOS Smart Punctuation converts straight quotes (`"`)
  to curly ones, which crash Vite/esbuild with `Unexpected """`. Fix: keep Smart
  Punctuation off, and only paste code that preserves straight ASCII quotes.
- Code had to be delivered so it could be copied cleanly (no downloadable `.txt`/artifacts
  he couldn't copy-paste from).

**With Claude Code editing files directly, those copy-paste constraints no longer apply** —
but the underlying rule still holds: **source must use straight ASCII quotes**, never curly.

## PWA cache gotcha

Deploys don't always show up because of a stale service-worker cache. The **established
fix is to delete and re-add the PWA icon** (from Safari) rather than just force-closing
the app. Worth telling Francisco to do this whenever "it deployed but I don't see the
change."

## Reliable repo fetch (for chat-based Claude, not Claude Code)

When fetching outside Claude Code, use the **GitHub codeload tarball**
(`codeload.github.com/.../tar.gz/refs/heads/main`) — not `raw.githubusercontent.com`
(CDN cache lag) and not the GitHub API (rate limits). Claude Code has direct repo access
and doesn't need this.

---

## Food database schema

The food database (`FOOD_DB` / Foods list in `App.jsx`) uses **short abbreviated field
names**. A single entry looks like:

```
{ keys:["green superfood power smoothie","green superfood smoothie"], name:"Green Superfood Power Smoothie", cal:790, pro:49, carb:97, fat:29, fib:24, se:4, io:4, zn:4.5, ir:10, mg:260, vd:0, sod:80, asug:0 },
```

Field key:

| Food DB (abbrev) | Log nutrients object (camelCase) | Meaning |
|---|---|---|
| `cal` / `pro` / `carb` / `fat` | — | calories, protein, carbs, fat |
| `fib` | `fiber` | fiber |
| `se` | `selenium` | selenium |
| `io` | `iodine` | iodine |
| `zn` | `zinc` | zinc |
| `ir` | `iron` | iron |
| `mg` | `magnesium` | magnesium |
| `vd` | `vitd` | vitamin D |
| `sod` | `sodium` | sodium |
| `asug` | `addedSugar` | added sugar |

Rules when adding foods or nutrients:
- **`keys[]`** is the match list for Smart Nutrient Lookup. Avoid bare generic words that
  substring-collide (the classic bug: bare `"egg"` matched inside `"veggies"`). The
  matcher is now **whole-word, bidirectional, singular/plural-aware** — keep keys specific.
- The food-DB abbreviations and the log **`nutrients` camelCase names must be kept in
  sync** whenever a new tracked nutrient is added.
- Missing nutrient fields safely default to zero via the `|| 0` pattern in the totals loop,
  so you don't have to specify every field on every entry.
- `asug` tracks **added sugar, not total sugar** — a deliberate choice so fruit isn't
  penalized.
- Optional `mealTypes` tag (Breakfast/Lunch/Dinner/Snack) slots a food into meal-type
  filtering.
- Foods can be marked **"don't suggest"** (exclusion system) via the Foods tab Edit panel.

## Nutrient display logic

- Most nutrients use a **fill-the-bar** `NutrientBar` (more is better).
- **Sodium and added sugar use `RangeBar` with inverted "lower is better"** color logic.
  Sodium thresholds: green ≤2300mg / yellow 2300–3000 / red >3000. Added sugar: green
  <25g / yellow 25–36 / red >36. Both show weekly averages.
- Nutrient goals reflect Francisco's **weight-loss focus**.
- `parseServings()` is a fraction-aware helper (typing `1/2` works) used across Log Meal,
  Foods, Recipes, and recipe log servings.

---

## Tabs

Dashboard, Log Meal, Meds & Vitamins, Symptoms, Schedule, Meals/Foods, Wellness, Labs,
Weekly, Well Week, Insights, Calendar, Weight, Optimize, Exercise, Pantry, Goals, History,
My Profile.

Highlights:
- **Insights** — nutrient trend charts, Pearson correlations, weekly wins/improvement
  areas, lab trends, a doctor-visit summary with clipboard copy, predictive insights, and
  exercise-vs-energy / hydration+exercise compound correlations.
- **Optimize** (formerly "Score Boosts") — calorie-aware food suggestions when under goal,
  lifestyle tips when over, celebration states at high scores, and a "Tomorrow's Best
  Foods" section. Ranking uses fair gap-closure scoring (not the overall score formula,
  which had buried fiber/protein behind micronutrients).
- **Exercise** — activity logging (Walking, Swimming, Strength, Cycling, Running, Other),
  duration/intensity/optional distance-laps-steps-calories, weekly summary, score
  contribution capped at +10/day.
- **Recipes** — structured ingredient builder + free-text parser (draws from food DB,
  pantry, and `SEASONINGS_REF` with unit conversion), per-serving nutrient scaling, full
  scoring integration.
- **Pantry** — managed staples database + `SEASONINGS_REF` auto-fill (populates nutrients
  from a name alone).
- **Goals** — split into Evidence-Based Goals and Personal Goals.
- **Weight** — 7-day / 30-day averages and BMI cards.

---

## Change history (most recent first)

- **Nutrient↔energy correlations locked to 90-day window only** *(this session)*. The
  weekly ("This Week") view computed a Pearson `r` from as few as 4–7 paired days, which
  is far too small for a stable coefficient — weak signals like zinc (r≈0.37 at 90d) and
  iodine (r≈0.36 at 90d) swung wildly week to week and confused interpretation. Fix: the
  nutrient correlation is now **always computed on the 90-day window**; in the This Week
  view that section shows a "a single week is too short — switch to 90 Days" message
  instead of a number. The meds↔symptoms, exercise, and symptom-cluster sections still
  respect the This Week / 90 Days toggle, since those are averages/counts that hold up
  with few days. Touched the `corrResults` / `corrResultsLong` definitions (~L3747) and
  the nutrient-correlation render block (~L4368).
- Fixed symptom-clustering correlation to respect the This Week / 90 Days toggle window
  rather than always using full history.
- Ongoing food-database expansion: mushroom varieties, specialty restaurant dishes,
  sugars, peppers, kale, oils, cheese variants, flours, smoothies, smoked/steamed dishes;
  split a shared "Berries" entry into raspberries/strawberries/blueberries/blackberries.
- Sodium and added sugar added as fully tracked nutrients (RangeBar, thresholds, weekly
  averages) — see display logic above.
- Fixed the food-matcher substring regression (`egg` inside `veggies`).
- Optimize tab ranking fixed to fair gap-closure scoring.
- Food exclusion ("don't suggest") system; oysters excluded by default.
- Exercise tab and exercise/hydration compound correlations added.
- Recipe subsystem, Pantry tab + `SEASONINGS_REF`, meal-type tagging throughout.
- Past-date logging date-picker bar in the Foods tab; inline recipe ingredient viewer.
- Fixed Well Week energy display bugs (wrong data source, dedup on wrong date field,
  symptom form not pre-filling).
- Fixed a variable-shadowing crash: an inner `const pearson` inside Insights shadowed the
  top-level `function pearson`; renamed the inner variable.
- Resolved a Vercel build break from an accidentally deleted `]` closing `SYMPTOMS_LIST`.
- A full-file replacement once overwrote multiple tabs; recovery meant tracing GitHub
  commit history back to the last good commit. **Prefer surgical edits over full-file
  replacement.**

---

## Working conventions

- **Deliberate, incremental development.** Francisco banks ideas and specifies parameters
  before building; prefers small, verifiable changes over big rewrites.
- **Validate before delivering.** JSX syntax checked with esbuild; logic checked with
  small Node test scripts where it matters.
- **Prefer `str_replace`-style surgical edits.** Full-file replacements have caused data
  loss here.
- Straight ASCII quotes only in source (see Smart Punctuation note above).
