import { useState, useEffect, useCallback } from "react";

const COLORS = {
  tealDeep: "#1a4a4a", tealMid: "#2d7a7a", tealLight: "#5ab5b5",
  tealPale: "#e8f6f6", amber: "#d4872a", amberPale: "#fdf3e7",
  coral: "#c0504a", coralPale: "#fdecea", sage: "#6b8f71",
  sagePale: "#eef4ef", ink: "#1c2a2a", mist: "#f2f7f7",
  divider: "#d4e5e5", white: "#ffffff", textSec: "#4a6868"
};

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};const dedupeSymptoms = (logs) => {
  const seen = {};
  logs.forEach(l => { if (l.type === "symptom") seen[l.date] = l; });
  return logs.filter(l => l.type !== "symptom" || seen[l.date] === l);
};
const nowTime = () => new Date().toTimeString().slice(0, 5);
const dateLabel = d => {
  const t = today();
  const y = new Date(); y.setDate(y.getDate() - 1);
  const ye = y.toISOString().split("T")[0];
  if (d === t) return "Today";
  if (d === ye) return "Yesterday";
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
};

const DEFAULT_GOALS = { calories:1800, protein:100, carbs:200, fat:65, fiber:25, water:8, selenium:55, iodine:150, zinc:8, iron:18, magnesium:320, vitd:2000, vitk:6090, b12:1000 };
const DEFAULT_PRESETS = {
  meds: [{name:"Synthroid (Levothyroxine)",dose:"125mcg"},{name:"Lamotrigine",dose:"25mg"},{name:"Sertraline",dose:"100mg"}],
  vits: [{name:"Vitamin K",dose:"6090mcg"},{name:"Vitamin D3",dose:"2000IU"},{name:"Vitamin B12",dose:"1mg"},{name:"Selenium",dose:"200mcg"},{name:"Magnesium Glycinate",dose:"200mg"},{name:"Valerian Root",dose:"320mg"},{name:"GABA",dose:"250mg"}]
};
const NUTRIENT_KEYS = ["calories","protein","carbs","fat","fiber","water","selenium","iodine","zinc","iron","magnesium","vitd","vitk","b12"];
const SYMPTOMS_LIST = [
  {key:"fatigue",emoji:"😴",label:"Fatigue"},{key:"brain fog",emoji:"🌫️",label:"Brain Fog"},
  {key:"weight gain",emoji:"⚖️",label:"Wt. Gain"},{key:"weight loss",emoji:"📉",label:"Wt. Loss"},
  {key:"cold sensitivity",emoji:"🥶",label:"Cold Sens."},{key:"heat sensitivity",emoji:"🥵",label:"Heat Sens."},
  {key:"anxiety",emoji:"😰",label:"Anxiety"},{key:"mood swings",emoji:"🎭",label:"Mood"},
  {key:"hair loss",emoji:"💇",label:"Hair Loss"},{key:"dry skin",emoji:"🌵",label:"Dry Skin"},
  {key:"constipation",emoji:"🐌",label:"Constip."},{key:"bloated",emoji:"🫃",label:"Bloated"},{key:"palpitations",emoji:"💓",label:"Palpit."},
  {key:"insomnia",emoji:"🌙",label:"Insomnia"},{key:"neck pressure",emoji:"🦢",label:"Neck"},
  {key:"good day",emoji:"✨",label:"Good Day!"}
];

const EMPTY_STATE = () => ({ goals: {...DEFAULT_GOALS}, presets: { meds:[...DEFAULT_PRESETS.meds], vits:[...DEFAULT_PRESETS.vits] }, logs: [], weightLog: [], wellnessLog: [], labLog: [] });

async function loadFromStorage() {
  // Always try Firebase first — this is the cross-device sync source
  try {
    const { db } = await import("./firebase.js");
    const { doc, getDoc } = await import("firebase/firestore");
    const ref = doc(db, "tracker", "main");
    const snap = await getDoc(ref);
    if (snap.exists() && snap.data().state) {
      console.log("✅ Loaded from Firebase");
      return snap.data().state;
    }
  } catch(e) { console.log("Firebase load error:", e.message); }
  // Fallback to localStorage only if Firebase fails
  try {
    const raw = localStorage.getItem("thyroid_tracker_v2");
    if (raw) { console.log("⚠️ Loaded from localStorage fallback"); return JSON.parse(raw); }
  } catch(e) {}
  return EMPTY_STATE();
}

async function saveToStorage(data) {
  // Save to Firebase first (cross-device)
  try {
    const { db } = await import("./firebase.js");
    const { doc, setDoc } = await import("firebase/firestore");
    const ref = doc(db, "tracker", "main");
    await setDoc(ref, { state: data, updatedAt: new Date().toISOString() });
    console.log("✅ Saved to Firebase");
  } catch(e) { console.log("Firebase save error:", e.message); }
  // Also save to localStorage as backup
  try { localStorage.setItem("thyroid_tracker_v2", JSON.stringify(data)); } catch(e) {}
}

// Styles
const s = {
  app: { fontFamily:"'Inter',sans-serif", background:COLORS.mist, minHeight:"100vh", color:COLORS.ink, fontSize:"14px" },
  header: { background:COLORS.tealDeep, color:"white", padding:"16px 20px", position:"sticky", top:0, zIndex:100, display:"flex", alignItems:"center", justifyContent:"space-between" },
  h1: { fontFamily:"Georgia,serif", fontSize:"1.2rem", fontWeight:400 },
  dateBadge: { fontFamily:"monospace", fontSize:"0.72rem", background:"rgba(255,255,255,0.12)", borderRadius:6, padding:"4px 10px" },
  nav: { background:COLORS.white, borderBottom:`1px solid ${COLORS.divider}`, display:"flex", overflowX:"auto", padding:"0 12px" },
  navBtn: (active) => ({ background:"none", border:"none", borderBottom: active ? `2px solid ${COLORS.tealMid}` : "2px solid transparent", padding:"12px 14px", fontFamily:"inherit", fontSize:"0.8rem", fontWeight:500, color: active ? COLORS.tealMid : COLORS.textSec, cursor:"pointer", whiteSpace:"nowrap" }),
  main: { maxWidth:660, margin:"0 auto", padding:"16px 14px 80px" },
  card: { background:COLORS.white, borderRadius:12, border:`1px solid ${COLORS.divider}`, padding:16, marginBottom:14 },
  sectionTitle: { fontFamily:"Georgia,serif", fontSize:"1rem", color:COLORS.tealDeep, marginBottom:12, fontWeight:400 },
  label: { display:"block", fontSize:"0.74rem", fontWeight:600, color:COLORS.textSec, marginBottom:4, letterSpacing:"0.02em" },
  input: { width:"100%", border:`1px solid ${COLORS.divider}`, borderRadius:8, padding:"8px 11px", fontFamily:"inherit", fontSize:"0.84rem", color:COLORS.ink, background:COLORS.white, outline:"none", boxSizing:"border-box" },
  select: { width:"100%", border:`1px solid ${COLORS.divider}`, borderRadius:8, padding:"8px 11px", fontFamily:"inherit", fontSize:"0.84rem", color:COLORS.ink, background:COLORS.white, outline:"none", boxSizing:"border-box" },
  textarea: { width:"100%", border:`1px solid ${COLORS.divider}`, borderRadius:8, padding:"8px 11px", fontFamily:"inherit", fontSize:"0.84rem", color:COLORS.ink, background:COLORS.white, outline:"none", resize:"vertical", minHeight:70, boxSizing:"border-box" },
  formRow: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 },
  formGroup: { marginBottom:10 },
  btnPrimary: { background:COLORS.tealMid, color:"white", border:"none", borderRadius:8, padding:"9px 18px", fontFamily:"inherit", fontSize:"0.83rem", fontWeight:500, cursor:"pointer" },
  btnOutline: { background:"transparent", color:COLORS.tealMid, border:`1px solid ${COLORS.tealMid}`, borderRadius:8, padding:"9px 18px", fontFamily:"inherit", fontSize:"0.83rem", fontWeight:500, cursor:"pointer" },
  btnSm: { padding:"5px 12px", fontSize:"0.76rem" },
  btnDanger: { background:COLORS.coralPale, color:COLORS.coral, border:`1px solid ${COLORS.coral}`, borderRadius:8, padding:"5px 10px", fontFamily:"inherit", fontSize:"0.76rem", cursor:"pointer" },
  aiBadge: { fontSize:"0.68rem", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.07em", color:COLORS.tealMid, marginBottom:8, display:"flex", alignItems:"center", gap:6 },
  aiBox: { background:`linear-gradient(135deg, ${COLORS.tealPale}, #f0fafa)`, border:`1.5px solid ${COLORS.tealLight}`, borderRadius:12, padding:16, marginBottom:14 },
  chip: { background:COLORS.white, border:`1px solid ${COLORS.tealLight}`, borderRadius:5, padding:"2px 8px", fontSize:"0.7rem", fontFamily:"monospace", color:COLORS.tealDeep, display:"inline-block", margin:"2px" },
  logItem: { display:"flex", alignItems:"flex-start", gap:10, padding:"11px 0", borderBottom:`1px solid ${COLORS.divider}` },
  logIcon: (type) => ({ width:32, height:32, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.95rem", flexShrink:0, background: type==="meal"?COLORS.tealPale: type==="med"?COLORS.amberPale: COLORS.sagePale }),
  emptyState: { textAlign:"center", padding:"28px 12px", color:COLORS.textSec, fontSize:"0.82rem" },
  insight: (type) => ({ display:"flex", gap:10, alignItems:"flex-start", padding:11, borderRadius:8, marginBottom:8, background: type==="good"?COLORS.sagePale: type==="warn"?COLORS.amberPale: COLORS.tealPale }),
};

function NutrientBar({ label, badge, current, goal, unit, thyroid }) {
  const pct = Math.min(100, (current / (goal||1)) * 100);
  const color = pct >= 90 ? COLORS.tealLight : pct >= 50 ? COLORS.amber : pct > 0 ? "#cce5e5" : COLORS.divider;
  return (
    <div style={{ ...s.card, padding:"11px 13px", marginBottom:0, borderLeft: thyroid ? `3px solid ${COLORS.tealLight}` : undefined }}>
      <div style={{ fontSize:"0.69rem", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em", color:COLORS.textSec, marginBottom:5, display:"flex", gap:5, alignItems:"center" }}>
        {label}
        {badge && <span style={{ background:COLORS.tealPale, color:COLORS.tealMid, borderRadius:3, padding:"1px 4px", fontSize:"0.58rem", fontWeight:700 }}>{badge}</span>}
      </div>
      <div style={{ display:"flex", alignItems:"baseline", gap:4, marginBottom:5 }}>
        <span style={{ fontFamily:"monospace", fontSize:"1rem", fontWeight:500 }}>{Number.isInteger(current)?current:current.toFixed(1)}</span>
        <span style={{ fontSize:"0.7rem", color:COLORS.textSec }}>/ {goal}{unit}</span>
      </div>
      <div style={{ height:5, background:COLORS.mist, borderRadius:3, overflow:"hidden" }}>
        <div style={{ height:"100%", width:`${pct}%`, background:color, borderRadius:3, transition:"width 0.4s" }} />
      </div>
    </div>
  );
}

function LogItem({ log, onDelete, onEdit }) {
  let icon, iconType, name, meta=[];
  if (log.type==="meal") {
    icon="🍽️"; iconType="meal"; name=log.name;
    if (log.nutrients?.calories) meta.push(`${log.nutrients.calories} cal`);
    if (log.nutrients?.protein) meta.push(`${log.nutrients.protein}g pro`);
    if (log.nutrients?.selenium) meta.push(`${log.nutrients.selenium}mcg Se`);
  } else if (log.type==="med") {
    icon="💊"; iconType="med"; name=`${log.name}${log.dose?" — "+log.dose:""}`;
  } else if (log.type==="vit") {
    icon="🌿"; iconType="vit"; name=`${log.name}${log.dose?" — "+log.dose:""}`;
  } else {
    icon="📊"; iconType="vit"; name="Symptom Check-in";
    if (log.energy) meta.push(`Energy: ${log.energy}/10`);
    if (log.symptoms?.length) meta.push(log.symptoms.slice(0,2).join(", "));
  }
  return (
    <div style={s.logItem}>
      <div style={s.logIcon(iconType)}>{icon}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:"0.86rem", fontWeight:500, marginBottom:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{name}</div>
        <div style={{ fontSize:"0.71rem", color:COLORS.textSec, display:"flex", flexWrap:"wrap", gap:5 }}>
          {meta.map((m,i) => <span key={i} style={{ background:COLORS.mist, borderRadius:4, padding:"1px 6px", fontFamily:"monospace", fontSize:"0.67rem" }}>{m}</span>)}
        </div>
      </div>
      <span style={{ fontFamily:"monospace", fontSize:"0.69rem", color:COLORS.textSec, whiteSpace:"nowrap", marginRight:4 }}>{log.time}</span>
      {(log.type==="meal"||log.type==="med"||log.type==="vit") && onEdit && (
        <button onClick={() => onEdit(log)} style={{ background:"none", border:"none", color:COLORS.tealLight, cursor:"pointer", fontSize:"0.85rem", padding:"2px 4px" }} title="Edit">✏️</button>
      )}
      <button onClick={() => onDelete(log.id)} style={{ background:"none", border:"none", color:COLORS.divider, cursor:"pointer", fontSize:"0.9rem", padding:"2px 4px" }}>✕</button>
    </div>
  );
}

// ── EDIT MEAL MODAL ────────────────────────────────────────────────────────────
function EditMealModal({ log, onSave, onClose }) {
  const [form, setForm] = useState({
    name: log.name,
    time: log.time,
    mealType: log.mealType || "Breakfast",
    notes: log.notes || "",
    nutrients: { ...log.nutrients }
  });
  const set  = (k,v) => setForm(f=>({...f,[k]:v}));
  const setN = (k,v) => setForm(f=>({...f,nutrients:{...f.nutrients,[k]:v}}));

  const save = () => {
    if (!form.name.trim()) { alert("Please enter a meal name."); return; }
    const n = {};
    NUTRIENT_KEYS.forEach(k => { n[k] = parseFloat(form.nutrients[k])||0; });
    onSave({ ...log, name:form.name.trim(), time:form.time, mealType:form.mealType, notes:form.notes, nutrients:n });
  };

  const overlayStyle = {
    position:"fixed", top:0, left:0, right:0, bottom:0,
    background:"rgba(0,0,0,0.45)", zIndex:200,
    display:"flex", alignItems:"flex-end", justifyContent:"center"
  };
  const sheetStyle = {
    background:COLORS.white, borderRadius:"16px 16px 0 0",
    width:"100%", maxWidth:660, maxHeight:"88vh",
    overflowY:"auto", padding:20, boxSizing:"border-box"
  };

  return (
    <div style={overlayStyle} onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div style={sheetStyle}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <span style={{ fontFamily:"Georgia,serif", fontSize:"1rem", color:COLORS.tealDeep }}>Edit Meal</span>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:"1.2rem", cursor:"pointer", color:COLORS.textSec }}>✕</button>
        </div>

        <div style={s.formRow}>
          <div style={s.formGroup}><label style={s.label}>Meal name</label><input style={s.input} value={form.name} onChange={e=>set("name",e.target.value)}/></div>
          <div style={s.formGroup}><label style={s.label}>Time</label><input type="time" style={s.input} value={form.time} onChange={e=>set("time",e.target.value)}/></div>
        </div>
        <div style={s.formGroup}><label style={s.label}>Meal type</label>
          <select style={s.select} value={form.mealType} onChange={e=>set("mealType",e.target.value)}>
            {["Breakfast","Lunch","Dinner","Snack"].map(t=><option key={t}>{t}</option>)}
          </select>
        </div>

        <div style={{ fontSize:"0.74rem", fontWeight:700, color:COLORS.textSec, textTransform:"uppercase", letterSpacing:"0.05em", margin:"6px 0 8px" }}>Macros</div>
        <div style={s.formRow}>
          <div style={s.formGroup}><label style={s.label}>Calories</label><input type="number" style={s.input} value={form.nutrients.calories||""} onChange={e=>setN("calories",e.target.value)} min="0"/></div>
          <div style={s.formGroup}><label style={s.label}>Protein (g)</label><input type="number" style={s.input} value={form.nutrients.protein||""} onChange={e=>setN("protein",e.target.value)} min="0"/></div>
        </div>
        <div style={s.formRow}>
          <div style={s.formGroup}><label style={s.label}>Carbs (g)</label><input type="number" style={s.input} value={form.nutrients.carbs||""} onChange={e=>setN("carbs",e.target.value)} min="0"/></div>
          <div style={s.formGroup}><label style={s.label}>Fat (g)</label><input type="number" style={s.input} value={form.nutrients.fat||""} onChange={e=>setN("fat",e.target.value)} min="0"/></div>
        </div>
        <div style={s.formRow}>
          <div style={s.formGroup}><label style={s.label}>Fiber (g)</label><input type="number" style={s.input} value={form.nutrients.fiber||""} onChange={e=>setN("fiber",e.target.value)} min="0"/></div>
          <div style={s.formGroup}><label style={s.label}>Water (cups)</label><input type="number" style={s.input} value={form.nutrients.water||""} onChange={e=>setN("water",e.target.value)} min="0" step="0.5"/></div>
        </div>

        <div style={{ fontSize:"0.74rem", fontWeight:700, color:COLORS.textSec, textTransform:"uppercase", letterSpacing:"0.05em", margin:"6px 0 8px" }}>Thyroid Micros</div>
        <div style={s.formRow}>
          <div style={s.formGroup}><label style={s.label}>Selenium (mcg)</label><input type="number" style={s.input} value={form.nutrients.selenium||""} onChange={e=>setN("selenium",e.target.value)} min="0"/></div>
          <div style={s.formGroup}><label style={s.label}>Iodine (mcg)</label><input type="number" style={s.input} value={form.nutrients.iodine||""} onChange={e=>setN("iodine",e.target.value)} min="0"/></div>
        </div>
        <div style={s.formRow}>
          <div style={s.formGroup}><label style={s.label}>Zinc (mg)</label><input type="number" style={s.input} value={form.nutrients.zinc||""} onChange={e=>setN("zinc",e.target.value)} min="0" step="0.1"/></div>
          <div style={s.formGroup}><label style={s.label}>Iron (mg)</label><input type="number" style={s.input} value={form.nutrients.iron||""} onChange={e=>setN("iron",e.target.value)} min="0" step="0.1"/></div>
        </div>
        <div style={s.formRow}>
          <div style={s.formGroup}><label style={s.label}>Magnesium (mg)</label><input type="number" style={s.input} value={form.nutrients.magnesium||""} onChange={e=>setN("magnesium",e.target.value)} min="0"/></div>
          <div style={s.formGroup}><label style={s.label}>Vitamin D (IU)</label><input type="number" style={s.input} value={form.nutrients.vitd||""} onChange={e=>setN("vitd",e.target.value)} min="0"/></div>
        </div>

        <div style={s.formGroup}><label style={s.label}>Notes</label><textarea style={s.textarea} value={form.notes} onChange={e=>set("notes",e.target.value)}/></div>

        <div style={{ display:"flex", gap:8 }}>
          <button style={s.btnPrimary} onClick={save}>Save Changes</button>
          <button style={s.btnOutline} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// Nutrient contributions from common supplements (keyed by lowercase name fragment)
const SUPP_NUTRIENTS = [
  { keys:["selenium"],                        nutrients:{ selenium:200 } },
  { keys:["vitamin d3","vitamin d","vitd"],   nutrients:{ vitd:2000 } },
  { keys:["magnesium"],                       nutrients:{ magnesium:200 } },
  { keys:["zinc"],                            nutrients:{ zinc:15 } },
  { keys:["iron"],                            nutrients:{ iron:18 } },
  { keys:["iodine","kelp"],                   nutrients:{ iodine:150 } },
  { keys:["vitamin k","vitamin k2","vit k"],  nutrients:{ vitk:100 } },
  { keys:["b12","vitamin b12"],               nutrients:{ b12:1000 } },
];

function suppNutrients(name, dose) {
  const q = (name||"").toLowerCase();
  for (const s of SUPP_NUTRIENTS) {
    if (s.keys.some(k => q.includes(k))) {
      const result = {...s.nutrients};
      // Try to parse dose override (e.g. "200mcg", "1000IU")
      if (dose) {
        const num = parseFloat(dose);
        if (!isNaN(num)) {
          // scale to the parsed dose
          const key = Object.keys(result)[0];
          if (key) result[key] = num;
        }
      }
      return result;
    }
  }
  return {};
}

// ── TABS ──────────────────────────────────────────────────────────────────────

function Dashboard({ logs, goals, onDelete, onEdit }) {
  const todayLogs = logs.filter(l => l.date === today());
  const totals = Object.fromEntries(NUTRIENT_KEYS.map(k => [k, 0]));
  todayLogs.filter(l => l.type==="meal").forEach(l => NUTRIENT_KEYS.forEach(k => { totals[k] += l.nutrients?.[k]||0; }));
  // Add supplement nutrient contributions
  todayLogs.filter(l => l.type==="vit").forEach(l => {
    const n = suppNutrients(l.name, l.dose);
    Object.entries(n).forEach(([k,v]) => { if(totals[k]!==undefined) totals[k] += v; });
  });
  const symptomEntry = todayLogs.find(l => l.type==="symptom");
  const medLogged = todayLogs.some(l => l.type==="med"||l.type==="vit");

  const thyroidKeys = ["selenium","iodine","zinc","iron","vitd"];
  let scoreSum=0, scoreCount=0;
  thyroidKeys.forEach(k => { scoreSum += Math.min(1, totals[k]/(goals[k]||1)); scoreCount++; });
  ["protein","fiber","water"].forEach(k => { scoreSum += Math.min(1, totals[k]/(goals[k]||1))*0.5; scoreCount+=0.5; });
  if (symptomEntry?.energy) { scoreSum += symptomEntry.energy/10; scoreCount++; }
  if (medLogged) { scoreSum+=1; scoreCount++; }
  const score = scoreCount>0 ? Math.round((scoreSum/scoreCount)*100) : null;
  const circumference = 226;
  const offset = score!=null ? circumference-(score/100)*circumference : circumference;
  const ringColor = score==null ? COLORS.divider : score>=75 ? COLORS.tealLight : score>=50 ? COLORS.amber : COLORS.coral;

  const insights = [];
  const pct = k => totals[k] / (goals[k]||1);

  // Selenium
  if (pct("selenium") < 0.5)  insights.push({type:"warn", icon:"⚠️", title:"Low Selenium",     text:"Selenium converts T4 to active T3. Try eggs, Brazil nuts, or your Thorne supplement."});
  else if (pct("selenium")>=1) insights.push({type:"good", icon:"✅", title:"Selenium goal met", text:"Great! Selenium supports healthy thyroid hormone conversion."});

  // Iodine
  if (pct("iodine") < 0.5)    insights.push({type:"warn", icon:"⚠️", title:"Low Iodine",        text:"Iodine is needed to make thyroid hormones. Try seafood, dairy, or iodized salt."});
  else if (pct("iodine")>=1)   insights.push({type:"good", icon:"✅", title:"Iodine goal met",    text:"Good iodine levels support thyroid hormone production."});

  // Vitamin D
  if (pct("vitd") < 0.5)      insights.push({type:"warn", icon:"☀️", title:"Low Vitamin D",      text:"Vitamin D supports thyroid receptor function. Consider your D3 supplement or sunlight."});
  else if (pct("vitd")>=1)     insights.push({type:"good", icon:"✅", title:"Vitamin D goal met", text:"Great! Vitamin D supports thyroid receptor sensitivity."});

  // Zinc
  if (pct("zinc") < 0.5)      insights.push({type:"warn", icon:"⚠️", title:"Low Zinc",           text:"Zinc is needed for thyroid hormone production. Try meat, shellfish, or your zinc supplement."});
  else if (pct("zinc")>=1)     insights.push({type:"good", icon:"✅", title:"Zinc goal met",       text:"Good zinc levels support thyroid hormone synthesis."});

  // Iron
  if (pct("iron") < 0.5)      insights.push({type:"warn", icon:"⚠️", title:"Low Iron",            text:"Iron is needed to make thyroid hormones. Try meat, lentils, or your iron supplement."});
  else if (pct("iron")>=1)     insights.push({type:"good", icon:"✅", title:"Iron goal met",        text:"Good iron levels support thyroid hormone production."});

  // Meds
  if (!medLogged) insights.push({type:"warn", icon:"💊", title:"Meds not yet logged",   text:"Have you taken your thyroid medication today?"});

  // Water
  if (totals.water < goals.water*0.5) insights.push({type:"info", icon:"💧", title:"Drink more water", text:"Hydration supports metabolism and thyroid function."});

  // Fatigue + low iron
  if (symptomEntry?.symptoms?.includes("fatigue") && pct("iron")<0.5)
    insights.push({type:"warn", icon:"🩸", title:"Fatigue + Low Iron", text:"Low iron is linked to thyroid fatigue. Check with your doctor."});

  // High energy
  if (symptomEntry?.energy>=8) insights.push({type:"good", icon:"✨", title:"High energy today!", text:"Note what you ate — it may reflect well on your thyroid habits."});

  if (!insights.length) insights.push({type:"info", icon:"💡", title:"Looking good so far", text:"Keep logging through the day for more personalized insights."});

  const sorted = [...todayLogs].sort((a,b) => a.time>b.time?1:-1);

  return (
    <div>
      {/* Score */}
      <div style={s.card}>
        <div style={{ display:"flex", alignItems:"center", gap:18 }}>
          <div style={{ position:"relative", width:88, height:88, flexShrink:0 }}>
            <svg width="88" height="88" viewBox="0 0 88 88" style={{ transform:"rotate(-90deg)" }}>
              <circle cx="44" cy="44" r="36" fill="none" stroke={COLORS.tealPale} strokeWidth="7"/>
              <circle cx="44" cy="44" r="36" fill="none" stroke={ringColor} strokeWidth="7" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} style={{ transition:"stroke-dashoffset 0.5s, stroke 0.3s" }}/>
            </svg>
            <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", textAlign:"center" }}>
              <div style={{ fontFamily:"Georgia,serif", fontSize:"1.5rem", color:COLORS.tealDeep, lineHeight:1 }}>{score??'—'}</div>
              <div style={{ fontSize:"0.52rem", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.06em", color:COLORS.textSec }}>score</div>
            </div>
          </div>
          <div>
            <div style={{ fontFamily:"Georgia,serif", fontSize:"0.95rem", marginBottom:4 }}>Today's Thyroid Score</div>
            <div style={{ fontSize:"0.76rem", color:COLORS.textSec, lineHeight:1.5 }}>
              {score==null ? "Log meals, meds, and symptoms to generate your score." :
               score>=75 ? "Great thyroid support day! Nutrients and habits on track." :
               score>=50 ? (() => {
                 const low = ["selenium","iodine","zinc","iron","vitd"].filter(k => totals[k] < goals[k]*0.5);
                 return low.length ? `Decent progress. Consider boosting: ${low.join(", ")}.` : "Decent progress. Keep logging through the day!";
               })() :
               (() => {
                 const low = ["selenium","iodine","zinc","iron","vitd"].filter(k => totals[k] < goals[k]*0.5);
                 return low.length ? `Focus on: ${low.join(", ")} — and take meds on time.` : "Focus on thyroid-key nutrients and taking meds on time.";
               })()}
            </div>
          </div>
        </div>
      </div>

      {/* Nutrients grid */}
      <p style={s.sectionTitle}>Today's Nutrients</p>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:9, marginBottom:14 }}>
        <NutrientBar label="Protein" badge="Macro" current={totals.protein} goal={goals.protein} unit="g" thyroid />
        <NutrientBar label="Carbs" badge="Macro" current={totals.carbs} goal={goals.carbs} unit="g" />
        <NutrientBar label="Fat" badge="Macro" current={totals.fat} goal={goals.fat} unit="g" />
        <NutrientBar label="Fiber" badge="Macro" current={totals.fiber} goal={goals.fiber} unit="g" thyroid />
        <NutrientBar label="Selenium" badge="Thyroid ★" current={totals.selenium} goal={goals.selenium} unit="mcg" thyroid />
        <NutrientBar label="Iodine" badge="Thyroid ★" current={totals.iodine} goal={goals.iodine} unit="mcg" thyroid />
        <NutrientBar label="Zinc" badge="Thyroid ★" current={totals.zinc} goal={goals.zinc} unit="mg" thyroid />
        <NutrientBar label="Iron" badge="Thyroid ★" current={totals.iron} goal={goals.iron} unit="mg" thyroid />
        <NutrientBar label="Vitamin D" badge="Thyroid ★" current={totals.vitd} goal={goals.vitd} unit="IU" thyroid />
        <NutrientBar label="Magnesium" current={totals.magnesium} goal={goals.magnesium} unit="mg" />
        <NutrientBar label="Calories" current={totals.calories} goal={goals.calories} unit="" />
        <NutrientBar label="Water" current={totals.water} goal={goals.water} unit=" cups" />
        <NutrientBar label="Vitamin K" current={totals.vitk||0} goal={goals.vitk} unit="mcg" />
        <NutrientBar label="Vitamin B12" current={totals.b12||0} goal={goals.b12} unit="mcg" />
      </div>

      {/* Insights */}
      <p style={s.sectionTitle}>Thyroid Insights</p>
      {insights.map((ins,i) => (
        <div key={i} style={s.insight(ins.type)}>
          <div style={{ fontSize:"1rem", flexShrink:0, marginTop:1 }}>{ins.icon}</div>
          <div style={{ fontSize:"0.78rem", lineHeight:1.5 }}>
            <strong style={{ fontWeight:600, display:"block", marginBottom:2 }}>{ins.title}</strong>
            {ins.text}
          </div>
        </div>
      ))}

      {/* Supplement status */}
      {(() => {
        const vitLogs = todayLogs.filter(l => l.type==="vit");
        if (!vitLogs.length) return null;
        return (
          <div style={{ marginBottom:14 }}>
            <p style={s.sectionTitle}>Supplements Counted Today</p>
            <div style={s.card}>
              {vitLogs.map(l => {
                const n = suppNutrients(l.name, l.dose);
                const entries = Object.entries(n);
                return (
                  <div key={l.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 0", borderBottom:`1px solid ${COLORS.divider}` }}>
                    <div style={{ width:32, height:32, borderRadius:8, background:COLORS.sagePale, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.95rem", flexShrink:0 }}>🌿</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:"0.85rem", fontWeight:500 }}>{l.name} {l.dose && <span style={{ color:COLORS.textSec, fontWeight:400 }}>— {l.dose}</span>}</div>
                      <div style={{ fontSize:"0.72rem", marginTop:2, display:"flex", flexWrap:"wrap", gap:4 }}>
                        {entries.length > 0
                          ? entries.map(([k,v]) => (
                              <span key={k} style={{ background:COLORS.tealPale, color:COLORS.tealDeep, borderRadius:4, padding:"1px 7px", fontFamily:"monospace", fontSize:"0.68rem" }}>
                                +{v} {k==="vitd"?"IU":k==="calories"?"cal":k==="selenium"||k==="iodine"?"mcg":"mg"} {k}
                              </span>
                            ))
                          : <span style={{ color:COLORS.textSec }}>Logged — no nutrient data tracked</span>
                        }
                      </div>
                    </div>
                    <span style={{ fontSize:"0.68rem", color: entries.length>0 ? COLORS.sage : COLORS.textSec, fontWeight:600 }}>
                      {entries.length>0 ? "✓ counted" : "logged"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Today log */}
      <p style={{ ...s.sectionTitle, marginTop:16 }}>Today's Log</p>
      <div style={s.card}>
        {sorted.length===0
          ? <div style={s.emptyState}><div style={{ fontSize:"1.8rem", marginBottom:8 }}>📋</div>Nothing logged yet today.</div>
          : sorted.map(l => <LogItem key={l.id} log={l} onDelete={onDelete} onEdit={onEdit} />)
        }
      </div>
    </div>
  );
}


// ── FOOD DATABASE ─────────────────────────────────────────────────────────────
const FOOD_DB = [
 { keys:["scrambled egg","fried egg","boiled egg","poached egg","omelette","omelet","egg"], name:"Eggs (2)", cal:145, pro:12, carb:1, fat:10, fib:0, se:30, io:52, zn:1.1, ir:1.8, mg:12, vd:82 },
 { keys:["greek yogurt","greek yoghurt"], name:"Greek Yogurt (1 cup)",cal:130, pro:17, carb:9, fat:4, fib:0, se:15, io:75, zn:1.1, ir:0.1, mg:19, vd:0 },
 { keys:["yogurt","yoghurt"], name:"Yogurt (1 cup)", cal:150, pro:8, carb:17, fat:4, fib:0, se:8, io:75, zn:1.0, ir:0.1, mg:19, vd:0 },
 { keys:["chocolate milk"], name:"Chocolate Milk (1 cup)", cal:210, pro:8, carb:26, fat:8, fib:1, se:8, io:56, zn:1.0, ir:0.6, mg:33, vd:120 },
 { keys:["milk","whole milk"], name:"Milk (1 cup)", cal:150, pro:8, carb:12, fat:8, fib:0, se:8, io:56, zn:0.9, ir:0.1, mg:24, vd:120 },
 { keys:["cheese","cheddar"], name:"Cheddar (1oz)", cal:110, pro:7, carb:0, fat:9, fib:0, se:4, io:8, zn:0.9, ir:0.2, mg:8, vd:6 },
 { keys:["cottage cheese"], name:"Cottage Cheese", cal:100, pro:13, carb:4, fat:2, fib:0, se:10, io:26, zn:0.4, ir:0.2, mg:8, vd:0 },
 { keys:["mozzarella"], name:"Mozzarella (1oz)", cal:85, pro:6, carb:1, fat:6, fib:0, se:5, io:10, zn:0.8, ir:0.1, mg:7, vd:2 },
 { keys:["feta"], name:"Feta (1oz)", cal:75, pro:4, carb:1, fat:6, fib:0, se:4, io:12, zn:0.8, ir:0.2, mg:5, vd:0 },
 { keys:["parmesan"], name:"Parmesan (1oz)", cal:110, pro:10, carb:1, fat:7, fib:0, se:5, io:12, zn:1.2, ir:0.2, mg:12, vd:4 },
 { keys:["salmon","grilled salmon","baked salmon"], name:"Salmon (4oz)", cal:230, pro:28, carb:0, fat:13, fib:0, se:40, io:14, zn:0.5, ir:0.4, mg:32, vd:640 },
 { keys:["tuna","canned tuna"], name:"Tuna (3oz)", cal:110, pro:25, carb:0, fat:1, fib:0, se:68, io:17, zn:0.7, ir:1.3, mg:25, vd:150 },
 { keys:["shrimp","prawn"], name:"Shrimp (3oz)", cal:84, pro:18, carb:0, fat:1, fib:0, se:33, io:35, zn:1.3, ir:2.6, mg:29, vd:0 },
 { keys:["cod","tilapia","white fish","fish fillet"], name:"White Fish (4oz)", cal:120, pro:26, carb:0, fat:1, fib:0, se:40, io:130, zn:0.5, ir:0.3, mg:38, vd:44 },
 { keys:["sardine","sardines"], name:"Sardines (3oz)", cal:177, pro:21, carb:0, fat:10, fib:0, se:45, io:35, zn:1.3, ir:2.5, mg:35, vd:193 },
 { keys:["oyster","oysters"], name:"Oysters (6)", cal:100, pro:10, carb:9, fat:3, fib:0, se:51, io:93, zn:39, ir:7.8, mg:47, vd:320 },
 { keys:["seaweed","nori","kelp"], name:"Seaweed/Nori", cal:10, pro:1, carb:1, fat:0, fib:0.5, se:1, io:232, zn:0.1, ir:0.4, mg:7, vd:0 },
 { keys:["mussel","mussels","steamed mussels"], name:"Mussels (3oz)", cal:146, pro:20, carb:6, fat:4, fib:0, se:76, io:140, zn:2.3, ir:6.7, mg:30, vd:0 },
 { keys:["chicken breast","grilled chicken","baked chicken","chicken"], name:"Chicken Breast (4oz)",cal:185, pro:35, carb:0, fat:4, fib:0, se:27, io:8, zn:1.0, ir:1.1, mg:32, vd:4 },
 { keys:["chicken thigh"], name:"Chicken Thigh (4oz)", cal:240, pro:28, carb:0, fat:14, fib:0, se:24, io:8, zn:2.2, ir:1.2, mg:24, vd:8 },
 { keys:["chicken wing","wings"], name:"Chicken Wings (4)", cal:290, pro:27, carb:0, fat:19, fib:0, se:22, io:6, zn:1.8, ir:1.0, mg:20, vd:5 },
 { keys:["chicken liver"], name:"Chicken Liver (3oz)", cal:142, pro:21, carb:1, fat:5, fib:0, se:38, io:14, zn:3.0, ir:9.9, mg:20, vd:19 },
 { keys:["turkey","ground turkey","turkey breast"], name:"Turkey (4oz)", cal:170, pro:34, carb:0, fat:3, fib:0, se:31, io:12, zn:2.3, ir:1.5, mg:28, vd:0 },
 { keys:["ground beef","beef","burger","hamburger"], name:"Ground Beef (4oz)", cal:290, pro:28, carb:0, fat:19, fib:0, se:16, io:8, zn:5.4, ir:2.7, mg:21, vd:8 },
 { keys:["steak","ribeye","sirloin","filet mignon"], name:"Steak (6oz)", cal:380, pro:42, carb:0, fat:22, fib:0, se:28, io:8, zn:7.0, ir:3.5, mg:35, vd:8 },
 { keys:["beef liver","calf liver"], name:"Beef Liver (3oz)", cal:175, pro:26, carb:4, fat:5, fib:0, se:28, io:12, zn:5.0, ir:6.2, mg:18, vd:36 },
 { keys:["meatball","meatballs"], name:"Meatballs (4)", cal:280, pro:20, carb:10, fat:18, fib:0.5, se:16, io:10, zn:3.5, ir:2.5, mg:20, vd:8 },
 { keys:["beef stew","stew"], name:"Beef Stew (1.5 cups)", cal:340, pro:26, carb:22, fat:16, fib:3, se:22, io:8, zn:5.5, ir:3.2, mg:38, vd:5 },
 { keys:["stew meat","stewing beef","beef chunks"], name:"Stew Meat (4oz cooked)", cal:250, pro:33, carb:0, fat:12, fib:0, se:24, io:8, zn:6.5, ir:3.0, mg:24, vd:5 },
 { keys:["sweetbread","sweetbreads","mollejas"], name:"Sweetbreads/Mollejas (4oz)", cal:250, pro:25, carb:0, fat:17, fib:0, se:38, io:8, zn:2.5, ir:2.8, mg:20, vd:5 },
 { keys:["beef empanada","beef empanadas","empanada","empanadas"], name:"Beef Empanada (1)", cal:280, pro:11, carb:26, fat:15, fib:1.5, se:12, io:6, zn:1.8, ir:1.8, mg:16, vd:4 },
 { keys:["choripan","chori pan"], name:"Choripán (1)", cal:450, pro:18, carb:36, fat:26, fib:2, se:20, io:8, zn:2.5, ir:2.2, mg:22, vd:10 },
 { keys:["filet mignon","filet","beef tenderloin"], name:"Filet Mignon (6oz)", cal:340, pro:44, carb:0, fat:17, fib:0, se:30, io:8, zn:7.2, ir:3.2, mg:38, vd:8 },
 { keys:["spinach tart","tarta de espinaca","spinach quiche"], name:"Spinach Tart (1 slice)", cal:280, pro:10, carb:22, fat:17, fib:2.5, se:14, io:20, zn:1.2, ir:2.5, mg:45, vd:30 },
 { keys:["ham and cheese tart","tarta de jamon y queso","ham cheese tart"], name:"Ham & Cheese Tart (1 slice)", cal:320, pro:14, carb:22, fat:20, fib:1, se:18, io:18, zn:1.8, ir:1.5, mg:18, vd:15 },
 { keys:["provoleta","grilled provolone"], name:"Provoleta (3oz)", cal:300, pro:22, carb:2, fat:23, fib:0, se:14, io:30, zn:2.8, ir:0.4, mg:24, vd:15 },
 { keys:["sweet bread","pan dulce","concha"], name:"Sweet Bread (1 piece)", cal:220, pro:4, carb:38, fat:6, fib:1, se:8, io:5, zn:0.4, ir:1.5, mg:12, vd:0 },
 { keys:["baguette"], name:"Baguette (⅓ loaf)", cal:220, pro:7, carb:44, fat:1, fib:2, se:20, io:4, zn:0.6, ir:2.2, mg:18, vd:0 },
 { keys:["outside skirt steak","skirt steak"], name:"Skirt Steak (6oz)", cal:350, pro:40, carb:0, fat:20, fib:0, se:26, io:8, zn:6.8, ir:3.8, mg:34, vd:8 },
 { keys:["tri-tip","tri tip","tritip"], name:"Tri-Tip Steak (6oz)", cal:340, pro:42, carb:0, fat:18, fib:0, se:28, io:8, zn:6.5, ir:3.2, mg:36, vd:8 },
 { keys:["flank steak","flank"], name:"Flank Steak (6oz)", cal:320, pro:44, carb:0, fat:14, fib:0, se:28, io:8, zn:7.0, ir:3.0, mg:38, vd:8 },
 { keys:["new york strip","ny strip","strip steak"], name:"NY Strip Steak (6oz)", cal:390, pro:44, carb:0, fat:22, fib:0, se:28, io:8, zn:7.5, ir:3.5, mg:36, vd:8 },
 { keys:["pork iberico","iberico","iberico pork"], name:"Pork Iberico (4oz)", cal:330, pro:26, carb:0, fat:25, fib:0, se:36, io:5, zn:2.8, ir:1.2, mg:24, vd:18 },
 { keys:["lettuce and tomato salad","lettuce tomato salad","lettuce and tomato"], name:"Lettuce & Tomato Salad", cal:35, pro:1.5, carb:7, fat:0.3, fib:2.5, se:0.2, io:0, zn:0.3, ir:0.6, mg:18, vd:0 },
 { keys:["pastina soup","pastina","chicken pastina"], name:"Pastina Soup (1 bowl)", cal:180, pro:9, carb:26, fat:4, fib:1.5, se:14, io:8, zn:0.8, ir:1.5, mg:20, vd:2 },
 { keys:["pork chop","pork","pork loin","pork tenderloin"], name:"Pork (4oz)", cal:220, pro:29, carb:0, fat:11, fib:0, se:38, io:5, zn:2.5, ir:0.9, mg:26, vd:20 },
 { keys:["pork sausage","sausage","bratwurst"], name:"Sausage (2 links)", cal:290, pro:14, carb:2, fat:25, fib:0, se:18, io:6, zn:2.0, ir:1.0, mg:14, vd:10 },
 { keys:["ham","deli ham"], name:"Ham (3oz)", cal:140, pro:18, carb:3, fat:6, fib:0, se:22, io:6, zn:2.0, ir:1.0, mg:14, vd:8 },
 { keys:["ham slice","slice of ham","deli ham slice"], name:"Ham (1 slice)", cal:35, pro:4.5, carb:0.8, fat:1.5, fib:0, se:5, io:1.5, zn:0.5, ir:0.25, mg:3, vd:2 },
 { keys:["prosciutto baguette","prosciutto sandwich","prosciutto in a baguette"], name:"Prosciutto Baguette Sandwich", cal:420, pro:22, carb:52, fat:14, fib:2, se:32, io:10, zn:2.0, ir:3.5, mg:30, vd:0 },
 { keys:["prosciutto"], name:"Prosciutto (2 slices/1oz)", cal:55, pro:8, carb:0, fat:2.5, fib:0, se:10, io:4, zn:0.8, ir:0.3, mg:6, vd:0 },
 { keys:["ham sandwich with mayo","ham sandwich mayo mustard","ham sandwich with olives","ham sandwich"], name:"Ham Sandwich (mayo, mustard, olives)", cal:420, pro:20, carb:38, fat:21, fib:2.5, se:26, io:10, zn:2.2, ir:2.8, mg:24, vd:8 },
 { keys:["lamb","lamb chop"], name:"Lamb (4oz)", cal:280, pro:28, carb:0, fat:18, fib:0, se:18, io:6, zn:4.5, ir:2.0, mg:24, vd:0 },
 { keys:["liver","offal"], name:"Liver (3oz)", cal:175, pro:26, carb:4, fat:5, fib:0, se:28, io:12, zn:5.0, ir:6.2, mg:18, vd:36 },
 { keys:["blood sausage","black pudding","blood pudding"], name:"Blood Sausage (2sl)", cal:190, pro:9, carb:5, fat:15, fib:0, se:14, io:4, zn:1.4, ir:5.0, mg:10, vd:12 },
 { keys:["apple"], name:"Apple", cal:95, pro:0, carb:25, fat:0, fib:4, se:0, io:0, zn:0.1, ir:0.2, mg:9, vd:0 },
 { keys:["banana"], name:"Banana", cal:105, pro:1, carb:27, fat:0, fib:3, se:1, io:3, zn:0.2, ir:0.3, mg:32, vd:0 },
 { keys:["orange"], name:"Orange", cal:62, pro:1, carb:15, fat:0, fib:3, se:0.7, io:0, zn:0.1, ir:0.1, mg:13, vd:0 },
 { keys:["blueberr","strawberr","raspberr","blackberr","berries"], name:"Berries (1 cup)", cal:70, pro:1, carb:17, fat:0, fib:4, se:0.4, io:0, zn:0.2, ir:0.9, mg:15, vd:0 },
 { keys:["avocado"], name:"Avocado (½)", cal:120, pro:2, carb:6, fat:11, fib:5, se:0.6, io:0, zn:0.4, ir:0.4, mg:29, vd:0 },
 { keys:["mango"], name:"Mango (1 cup)", cal:100, pro:1, carb:25, fat:1, fib:3, se:1, io:0, zn:0.1, ir:0.2, mg:15, vd:0 },
 { keys:["pineapple"], name:"Pineapple (1 cup)", cal:82, pro:1, carb:22, fat:0, fib:2, se:0.2, io:0, zn:0.2, ir:0.3, mg:20, vd:0 },
 { keys:["grape","grapes"], name:"Grapes (1 cup)", cal:104, pro:1, carb:27, fat:0, fib:1, se:0.2, io:0, zn:0.1, ir:0.5, mg:11, vd:0 },
 { keys:["watermelon"], name:"Watermelon (1 cup)", cal:46, pro:1, carb:12, fat:0, fib:0.6, se:0.6, io:0, zn:0.2, ir:0.4, mg:15, vd:0 },
 { keys:["peach"], name:"Peach", cal:59, pro:1, carb:14, fat:0, fib:2, se:0.1, io:0, zn:0.3, ir:0.4, mg:9, vd:0 },
 { keys:["pear"], name:"Pear", cal:100, pro:1, carb:27, fat:0, fib:5, se:0.1, io:0, zn:0.2, ir:0.3, mg:12, vd:0 },
 { keys:["plum","prune"], name:"Plum / Prune", cal:75, pro:1, carb:19, fat:0, fib:2, se:0.1, io:0, zn:0.2, ir:0.3, mg:12, vd:0 },
 { keys:["cherry","cherries"], name:"Cherries (1 cup)", cal:95, pro:2, carb:24, fat:0, fib:3, se:0, io:0, zn:0.1, ir:0.5, mg:15, vd:0 },
 { keys:["kiwi"], name:"Kiwi (2)", cal:90, pro:2, carb:22, fat:1, fib:4, se:0.2, io:0, zn:0.2, ir:0.6, mg:26, vd:0 },
 { keys:["grapefruit"], name:"Grapefruit (½)", cal:52, pro:1, carb:13, fat:0, fib:2, se:0.1, io:0, zn:0.1, ir:0.1, mg:11, vd:0 },
 { keys:["papaya"], name:"Papaya (1 cup)", cal:55, pro:1, carb:14, fat:0, fib:3, se:0.6, io:0, zn:0.1, ir:0.1, mg:30, vd:0 },
 { keys:["cantaloupe","honeydew","melon"], name:"Melon (1 cup)", cal:56, pro:1, carb:14, fat:0, fib:1, se:0.5, io:0, zn:0.2, ir:0.3, mg:18, vd:0 },
 { keys:["apricot","apricots"], name:"Apricots (3)", cal:50, pro:1, carb:12, fat:0, fib:2, se:0.1, io:0, zn:0.2, ir:0.4, mg:10, vd:0 },
 { keys:["fig","figs"], name:"Figs (2)", cal:74, pro:1, carb:19, fat:0, fib:3, se:0.2, io:0, zn:0.2, ir:0.4, mg:14, vd:0 },
 { keys:["dates"], name:"Dates (3)", cal:200, pro:2, carb:54, fat:0, fib:5, se:0.2, io:0, zn:0.2, ir:0.9, mg:38, vd:0 },
 { keys:["pomegranate"], name:"Pomegranate (½)", cal:70, pro:1, carb:17, fat:1, fib:4, se:0.5, io:0, zn:0.4, ir:0.3, mg:10, vd:0 },
 { keys:["lemon"], name:"Lemon", cal:17, pro:1, carb:5, fat:0, fib:2, se:0.4, io:0, zn:0.1, ir:0.4, mg:7, vd:0 },
 { keys:["lime"], name:"Lime", cal:20, pro:0.5,carb:7, fat:0, fib:2, se:0.4, io:0, zn:0.1, ir:0.4, mg:4, vd:0 },
 { keys:["raisin","raisins","sultana"], name:"Raisins (¼ cup)", cal:120, pro:1, carb:32, fat:0, fib:1, se:0.1, io:0, zn:0.1, ir:0.8, mg:10, vd:0 },
 { keys:["spinach","baby spinach"], name:"Spinach (2 cups)", cal:14, pro:2, carb:2, fat:0, fib:1.4, se:0.6, io:0, zn:0.3, ir:1.6, mg:47, vd:0 },
 { keys:["broccoli"], name:"Broccoli (1 cup)", cal:55, pro:4, carb:11, fat:1, fib:5, se:1.6, io:8, zn:0.4, ir:0.7, mg:33, vd:0 },
 { keys:["cauliflower"], name:"Cauliflower (1 cup)", cal:27, pro:2, carb:5, fat:0, fib:3, se:0.6, io:0, zn:0.3, ir:0.4, mg:16, vd:0 },
 { keys:["sweet potato","yam"], name:"Sweet Potato", cal:103, pro:2, carb:24, fat:0, fib:4, se:0.2, io:0, zn:0.3, ir:0.7, mg:27, vd:0 },
 { keys:["potato","baked potato"], name:"Potato (medium)", cal:161, pro:4, carb:37, fat:0, fib:4, se:0.4, io:0, zn:0.4, ir:1.9, mg:48, vd:0 },
 { keys:["carrot","carrots"], name:"Carrots (1 cup)", cal:52, pro:1, carb:12, fat:0, fib:3.6, se:0.1, io:0, zn:0.3, ir:0.4, mg:15, vd:0 },
 { keys:["tomato","tomatoes"], name:"Tomato (medium)", cal:22, pro:1, carb:5, fat:0, fib:1.5, se:0, io:0, zn:0.2, ir:0.3, mg:11, vd:0 },
 { keys:["cucumber"], name:"Cucumber (1 cup)", cal:16, pro:0.7,carb:4, fat:0, fib:0.5, se:0.3, io:0, zn:0.2, ir:0.3, mg:13, vd:0 },
 { keys:["celery"], name:"Celery (2 stalks)", cal:12, pro:0.5,carb:3, fat:0, fib:1.5, se:0.4, io:0, zn:0.1, ir:0.2, mg:9, vd:0 },
 { keys:["bell pepper","red pepper","green pepper"], name:"Bell Pepper (1 cup)", cal:46, pro:1, carb:9, fat:0, fib:3, se:0.1, io:0, zn:0.3, ir:0.5, mg:12, vd:0 },
 { keys:["mushroom","mushrooms"], name:"Mushrooms (1 cup)", cal:21, pro:3, carb:3, fat:0, fib:1, se:8.9, io:0, zn:0.5, ir:0.3, mg:9, vd:0 },
 { keys:["zucchini","courgette"], name:"Zucchini (1 cup)", cal:20, pro:1.5, carb:4, fat:0, fib:1, se:0.2, io:0, zn:0.3, ir:0.4, mg:18, vd:0 },
 { keys:["onion","onions"], name:"Onion (medium)", cal:44, pro:1, carb:10, fat:0, fib:2, se:0.5, io:0, zn:0.2, ir:0.2, mg:10, vd:0 },
 { keys:["garlic"], name:"Garlic (3 cloves)", cal:13, pro:0.6,carb:3, fat:0, fib:0.2, se:1.3, io:0, zn:0.1, ir:0.2, mg:2, vd:0 },
 { keys:["corn","sweetcorn"], name:"Corn (1 ear)", cal:132, pro:5, carb:29, fat:2, fib:3, se:0.7, io:0, zn:0.7, ir:0.5, mg:37, vd:0 },
 { keys:["pea","peas","green peas"], name:"Green Peas (½ cup)", cal:62, pro:4, carb:11, fat:0, fib:4, se:1.8, io:0, zn:0.6, ir:1.2, mg:26, vd:0 },
 { keys:["green bean","string bean","french bean"], name:"Green Beans (1 cup)", cal:31, pro:2, carb:7, fat:0, fib:3, se:0.6, io:0, zn:0.2, ir:1.0, mg:25, vd:0 },
 { keys:["asparagus"], name:"Asparagus (6)", cal:22, pro:2, carb:4, fat:0, fib:2, se:2.3, io:0, zn:0.4, ir:1.0, mg:13, vd:0 },
 { keys:["bok choy","pak choi"], name:"Bok Choy (1 cup)", cal:20, pro:3, carb:3, fat:0, fib:2, se:0.5, io:0, zn:0.2, ir:1.8, mg:19, vd:0 },
 { keys:["edamame"], name:"Edamame (½ cup)", cal:90, pro:8, carb:7, fat:4, fib:4, se:1, io:0, zn:1.0, ir:1.8, mg:48, vd:0 },
 { keys:["tofu"], name:"Tofu (½ cup)", cal:90, pro:9, carb:2, fat:5, fib:0.5, se:10, io:0, zn:1.0, ir:3.4, mg:37, vd:0 },
 { keys:["american blend","american blend lettuce","american salad blend","salad blend"], name:"American Blend Lettuce (2 cups)", cal:15, pro:1, carb:3, fat:0, fib:1.5, se:0.2, io:0, zn:0.2, ir:0.5, mg:10, vd:0 },
 { keys:["lettuce","romaine","iceberg"], name:"Lettuce (2 cups)", cal:10, pro:1, carb:2, fat:0, fib:1, se:0.1, io:0, zn:0.1, ir:0.3, mg:7, vd:0 },
 { keys:["brazil nut","brazil nuts"], name:"Brazil Nuts (1oz)", cal:185, pro:4, carb:3, fat:19, fib:2, se:544, io:1, zn:1.2, ir:0.7, mg:107, vd:0 },
 { keys:["almond","almonds"], name:"Almonds (1oz)", cal:165, pro:6, carb:6, fat:14, fib:3.5, se:1, io:0, zn:0.9, ir:1.1, mg:76, vd:0 },
 { keys:["walnut","walnuts"], name:"Walnuts (1oz)", cal:185, pro:4, carb:4, fat:18, fib:2, se:1.2, io:0, zn:0.9, ir:0.8, mg:45, vd:0 },
 { keys:["sunflower seed"], name:"Sunflower Seeds (1oz)",cal:165,pro:6, carb:7, fat:14, fib:3, se:23, io:0, zn:1.5, ir:1.5, mg:37, vd:0 },
 { keys:["cashew","cashews"], name:"Cashews (1oz)", cal:157, pro:5, carb:9, fat:12, fib:1, se:3, io:0, zn:1.6, ir:1.9, mg:83, vd:0 },
 { keys:["pistachio","pistachios"], name:"Pistachios (1oz)", cal:160, pro:6, carb:8, fat:13, fib:3, se:2, io:0, zn:0.6, ir:1.1, mg:34, vd:0 },
 { keys:["pecan","pecans"], name:"Pecans (1oz)", cal:196, pro:3, carb:4, fat:20, fib:3, se:1, io:0, zn:1.3, ir:0.7, mg:34, vd:0 },
 { keys:["oatmeal","oats","overnight oats","porridge"], name:"Oatmeal (1 cup)", cal:165, pro:6, carb:28, fat:4, fib:4, se:13, io:0, zn:1.1, ir:2.1, mg:63, vd:0 },
 { keys:["whole wheat toast","wholegrain toast","wheat toast","brown toast"], name:"Whole Wheat Toast (2sl)",cal:160,pro:8, carb:30, fat:2, fib:4, se:14, io:4, zn:1.0, ir:2.0, mg:48, vd:0 },
 { keys:["white toast","white bread","toast"], name:"White Toast (2sl)", cal:140, pro:5, carb:26, fat:2, fib:1, se:10, io:4, zn:0.5, ir:1.5, mg:15, vd:0 },
 { keys:["sourdough"], name:"Sourdough (2 slices)", cal:180, pro:7, carb:34, fat:1, fib:2, se:16, io:4, zn:0.7, ir:2.0, mg:20, vd:0 },
 { keys:["brown rice","white rice","rice"], name:"Rice (1 cup cooked)", cal:215, pro:5, carb:45, fat:0, fib:2, se:12, io:0, zn:0.8, ir:0.4, mg:21, vd:0 },
 { keys:["quinoa"], name:"Quinoa (1 cup)", cal:222, pro:8, carb:39, fat:4, fib:5, se:5, io:0, zn:2.0, ir:2.8, mg:118, vd:0 },
 { keys:["couscous","cous cous"], name:"Couscous (1 cup cooked)", cal:176, pro:6, carb:36, fat:0, fib:2, se:28, io:0, zn:0.4, ir:0.6, mg:13, vd:0 },
 { keys:["spaghetti","pasta","penne","rigatoni","fusilli","linguine","fettuccine","farfalle","macaroni","rotini","ziti","pappardelle","orzo","bucatini","conchiglie","shells"],
 name:"Pasta (1 cup cooked)",cal:220, pro:8, carb:43, fat:1, fib:2, se:37, io:0, zn:0.7, ir:1.8, mg:25, vd:0 },
 { keys:["whole wheat pasta","wholemeal pasta","whole grain pasta"], name:"Whole Wheat Pasta", cal:174, pro:7, carb:37, fat:1, fib:6, se:36, io:0, zn:1.1, ir:1.5, mg:42, vd:0 },
 { keys:["chickpea pasta","lentil pasta","protein pasta"], name:"Chickpea Pasta", cal:190, pro:14, carb:32, fat:3, fib:8, se:6, io:0, zn:2.0, ir:3.5, mg:50, vd:0 },
 { keys:["lasagna","lasagne"], name:"Lasagna (1 piece)", cal:480, pro:26, carb:42, fat:22, fib:3, se:22, io:28, zn:3.0, ir:3.5, mg:38, vd:25 },
 { keys:["carbonara","pasta carbonara"], name:"Pasta Carbonara", cal:580, pro:22, carb:55, fat:28, fib:2, se:32, io:35, zn:2.0, ir:2.5, mg:30, vd:60 },
 { keys:["bolognese","spaghetti bolognese","meat sauce"], name:"Spaghetti Bolognese", cal:520, pro:28, carb:58, fat:16, fib:5, se:24, io:12, zn:4.0, ir:4.5, mg:45, vd:5 },
 { keys:["lentil","lentils"], name:"Lentils (1 cup)", cal:230, pro:18, carb:40, fat:1, fib:16, se:5.5, io:0, zn:2.5, ir:6.6, mg:71, vd:0 },
 { keys:["black bean","kidney bean","chickpea","beans"], name:"Beans (1 cup)", cal:225, pro:15, carb:40, fat:1, fib:15, se:2, io:0, zn:1.8, ir:3.9, mg:60, vd:0 },
 { keys:["double espresso","espresso"], name:"Double Espresso", cal:6, pro:0.4,carb:1, fat:0, fib:0, se:0, io:0, zn:0.1, ir:0.1, mg:12, vd:0 },
 { keys:["coffee","black coffee"], name:"Coffee (1 cup)", cal:2, pro:0, carb:0, fat:0, fib:0, se:0, io:0, zn:0, ir:0, mg:7, vd:0 },
 { keys:["latte","cappuccino","coffee with milk"], name:"Latte (medium)", cal:120, pro:6, carb:12, fat:5, fib:0, se:4, io:40, zn:0.5, ir:0.1, mg:18, vd:60 },
 { keys:["green tea"], name:"Green Tea", cal:2, pro:0, carb:0, fat:0, fib:0, se:0, io:0, zn:0, ir:0, mg:3, vd:0 },
 { keys:["black tea","tea"], name:"Black Tea", cal:2, pro:0, carb:0, fat:0, fib:0, se:0, io:0, zn:0, ir:0.4, mg:4, vd:0 },
 { keys:["orange juice","oj"], name:"Orange Juice (8oz)", cal:110, pro:2, carb:26, fat:0, fib:0.5, se:0.1, io:0, zn:0.1, ir:0.5, mg:27, vd:137 },
 { keys:["glass of wine","glasses of wine","red wine","wine"], name:"Red Wine (5oz)", cal:125, pro:0.1,carb:4, fat:0, fib:0, se:0.2, io:0, zn:0.1, ir:0.4, mg:12, vd:0 },
 { keys:["beer","lager","ale","draft beer"], name:"Beer (12oz)", cal:150, pro:1, carb:13, fat:0, fib:0, se:1, io:0, zn:0.1, ir:0.1, mg:14, vd:0 },
 { keys:["jack daniels and coke","jack and coke","whiskey and coke","whiskey coke"], name:"Jack & Coke", cal:200, pro:0, carb:26, fat:0, fib:0, se:0, io:0, zn:0, ir:0, mg:2, vd:0 },
 { keys:["rum and coke","rum coke","cuba libre"], name:"Rum & Coke", cal:185, pro:0, carb:24, fat:0, fib:0, se:0, io:0, zn:0, ir:0, mg:2, vd:0 },
 { keys:["fruity drink","fruity cocktail","tropical drink","daiquiri","pina colada","margarita"], name:"Fruity Cocktail", cal:280, pro:0.5, carb:38, fat:2, fib:0.5, se:0.3, io:0, zn:0.1, ir:0.2, mg:8, vd:0 },
 { keys:["white wine"], name:"White Wine (5oz)", cal:120, pro:0.1,carb:4, fat:0, fib:0, se:0.1, io:0, zn:0.1, ir:0.3, mg:10, vd:0 },
 { keys:["protein shake","protein smoothie","whey"], name:"Protein Shake", cal:150, pro:25, carb:8, fat:2, fib:1, se:10, io:20, zn:1.5, ir:2.5, mg:50, vd:100 },
 { keys:["my smoothie","berry spinach smoothie","francisco smoothie"], name:"My Berry-Spinach Smoothie", cal:400, pro:12, carb:68, fat:8, fib:13, se:4, io:60, zn:1.5, ir:2.5, mg:105, vd:120 },
 { keys:["my salad","avocado tomato salad","francisco salad"], name:"My Avocado-Tomato Salad", cal:430, pro:5, carb:25, fat:36, fib:13, se:1, io:0, zn:1.2, ir:1.4, mg:80, vd:0 },
 { keys:["smoothie","fruit smoothie"], name:"Fruit Smoothie", cal:200, pro:4, carb:45, fat:1, fib:4, se:2, io:10, zn:0.3, ir:0.5, mg:35, vd:0 },
 { keys:["hummus"], name:"Hummus (¼ cup)", cal:100, pro:5, carb:12, fat:4, fib:4, se:2, io:0, zn:1.0, ir:1.5, mg:20, vd:0 },
 { keys:["belgian chocolate","belgian dark chocolate","belgian milk chocolate"], name:"Belgian Chocolate (1oz)", cal:165, pro:2, carb:15, fat:11, fib:2, se:2, io:8, zn:0.8, ir:1.2, mg:45, vd:0 },
 { keys:["toblerone"], name:"Toblerone (1 triangle/10g)", cal:55, pro:0.6, carb:6, fat:3, fib:0.2, se:0.5, io:3, zn:0.2, ir:0.2, mg:8, vd:0 },
 { keys:["soup","chicken soup","vegetable soup"], name:"Soup (1 bowl)", cal:140, pro:8, carb:18, fat:4, fib:3, se:5, io:5, zn:0.5, ir:1.0, mg:20, vd:0 },
  { keys:["homemade scrambled eggs with ham","scrambled eggs with ham"], name:"Homemade Scrambled Eggs with Ham", cal:220, pro:24, carb:5, fat:12, fib:1.5, se:43, io:24, zn:2.5, ir:3.2, mg:47, vd:90 },
{ keys:["homemade scrambled eggs","scrambled eggs"], name:"Homemade Scrambled Eggs", cal:160, pro:14, carb:4, fat:10, fib:1.5, se:33, io:24, zn:1.5, ir:2.7, mg:39, vd:90 },
  { keys:["homemade avocado salad","avocado salad"], name:"Homemade Avocado Salad", cal:500, pro:7, carb:31, fat:43, fib:17, se:1, io:0, zn:1.3, ir:1.5, mg:90, vd:0 },
{ keys:["nature valley bar","nature valley bars","nature valley granola bar"], name:"Nature Valley Bars (1 pouch/2 bars)", cal:190, pro:3, carb:29, fat:7, fib:2, se:2, io:0, zn:0.3, ir:1.0, mg:24, vd:0 },
{ keys:["publix japanese blend","japanese blend"], name:"Publix Japanese Blend (1 cup)", cal:30, pro:2, carb:5, fat:0, fib:2.5, se:2, io:0, zn:0.4, ir:0.8, mg:20, vd:0 },
  { keys:["ham and toast","toast with ham","ham toast"], name:"Ham and Toast", cal:200, pro:15, carb:27, fat:4, fib:1, se:20, io:4, zn:1.5, ir:2.0, mg:23, vd:0 },
{ keys:["avocado toast"], name:"Avocado Toast", cal:230, pro:6, carb:24, fat:15, fib:8, se:5, io:0, zn:0.7, ir:1.3, mg:45, vd:0 },
  { keys:["spinach ravioli"], name:"Spinach Ravioli", cal:260, pro:11, carb:40, fat:7, fib:3, se:1, io:5, zn:1.1, ir:2.0, mg:30, vd:2 },
{ keys:["ham and cheese sandwich", "ham cheese sandwich", "jambon fromage"], name:"Ham and Cheese Sandwich", cal:300, pro:15, carb:32, fat:12, fib:1.5, se:20, io:15, zn:1.5, ir:1.3, mg:15, vd:0.1 },
{ keys:["beef milanesa", "milanesa de carne", "milanesa"], name:"Beef Milanesa (Baked, Top Sirloin)", cal:280, pro:32, carb:16, fat:11, fib:1, se:25, io:5, zn:4.8, ir:2.6, mg:24, vd:0.2 },
  { keys:["chicken milanesa","milanesa de pollo"], name:"Chicken Milanesa", cal:350, pro:30, carb:20, fat:15, fib:1, se:24, io:2, zn:1.3, ir:1.2, mg:28, vd:0 },
  { keys:["havana alfajor","alfajor"], name:"Havana Alfajor", cal:200, pro:3, carb:30, fat:7, fib:1, se:1, io:2, zn:0.3, ir:0.5, mg:10, vd:0 },
{ keys:["beef lentil","beef lentil stew"], name:"Homemade Beef Lentil Stew", cal:385, pro:38, carb:33, fat:12, fib:16, se:21, io:26, zn:6.3, ir:6.5, mg:66, vd:0 },
  { keys:["salad","green salad"], name:"Green Salad", cal:80, pro:3, carb:10, fat:4, fib:3, se:0.5, io:0, zn:0.3, ir:1.2, mg:22, vd:0 },
 { keys:["blood sausage","black pudding"], name:"Blood Sausage (2sl)", cal:190, pro:9, carb:5, fat:15, fib:0, se:14, io:4, zn:1.4, ir:5.0, mg:10, vd:12 },
];

function estimateNutrients(q) {
  // Find best matching food
  let best = null, bestScore = 0;
  for (const food of FOOD_DB) {
    for (const key of food.keys) {
      if (q.includes(key)) {
        const score = key.length;
        if (score > bestScore) { bestScore = score; best = food; }
      }
    }
  }

  // Parse multiplier (e.g. "2 eggs" → ×1, already per serving; "2 cups" etc.)
  let mult = 1;
  const numMatch = q.match(/^(\d+(?:\.\d+)?)\s/);
  if (numMatch) {
    const n = parseFloat(numMatch[1]);
    if (n >= 1 && n <= 6) mult = n > 1 ? (best && best.keys[0].includes("egg") ? n/2 : 1) : 1;
  }

  if (!best) {
    // Generic fallback estimate
    return { name: q.slice(0,40), calories:300, protein:15, carbs:30, fat:10, fiber:3,
             selenium:10, iodine:20, zinc:1, iron:1.5, magnesium:30, vitd:20,
             thyroid_note:"Estimated values — verify with a nutrition label for accuracy." };
  }

  const thyroidNotes = {
    salmon:   "Excellent thyroid food — high selenium and vitamin D support T3 conversion.",
    tuna:     "Great selenium source. Supports thyroid hormone synthesis.",
    egg:      "Eggs provide selenium and iodine — key thyroid nutrients.",
    "brazil nut": "Just 1–2 Brazil nuts meets your full daily selenium need!",
    seaweed:  "Very high iodine — good for thyroid but avoid excess if hyperthyroid.",
    spinach:  "Iron-rich but contains goitrogens — cooking reduces their effect.",
    kale:     "Contains goitrogens; cook rather than eat raw to support thyroid.",
    broccoli: "Contains goitrogens; steaming reduces impact on thyroid.",
    milk:     "Good iodine and vitamin D source — supports thyroid function.",
    yogurt:   "High in iodine and protein — beneficial for thyroid health.",
  };

  let note = "Good addition to a balanced thyroid-supportive diet.";
  for (const [k, v] of Object.entries(thyroidNotes)) {
    if (q.includes(k)) { note = v; break; }
  }

  return {
    name: best.name, calories: Math.round(best.cal*mult), protein: Math.round(best.pro*mult*10)/10,
    carbs: Math.round(best.carb*mult*10)/10, fat: Math.round(best.fat*mult*10)/10,
    fiber: Math.round(best.fib*mult*10)/10, selenium: Math.round(best.se*mult*10)/10,
    iodine: Math.round(best.io*mult*10)/10, zinc: Math.round(best.zn*mult*10)/10,
    iron: Math.round(best.ir*mult*10)/10, magnesium: Math.round(best.mg*mult), vitd: Math.round(best.vd*mult),
    thyroid_note: note
  };
}

function LogMeal({ onSave }) {
  const [query, setQuery] = useState("");
  const [servings, setServings] = useState(1);
  const [aiState, setAiState] = useState("idle"); // idle | loading | done | error
  const [aiMsg, setAiMsg] = useState("");
  const [aiChips, setAiChips] = useState([]);
  const [aiNote, setAiNote] = useState("");
  const emptyNutrients = () => Object.fromEntries(NUTRIENT_KEYS.map(k => [k,""]));
  const [logDate, setLogDate] = useState(today());
  const [form, setForm] = useState({ name:"", time:nowTime(), mealType:"Breakfast", notes:"", nutrients: emptyNutrients() });

  const set = (k,v) => setForm(f => ({...f, [k]:v}));
  const setN = (k,v) => setForm(f => ({...f, nutrients:{...f.nutrients, [k]:v}}));

  const lookupNutrients = () => {
    if (!query.trim()) return;
    setAiState("loading"); setAiMsg(""); setAiChips([]); setAiNote("");
    setTimeout(() => {
    try {
      const q = query.toLowerCase();
      const raw = estimateNutrients(q);
      const sv = parseFloat(servings)||1;
      const multiply = (v) => v ? Math.round(v * sv * 10) / 10 : "";
      const n = {
        ...raw,
        calories:  multiply(raw.calories),  protein:   multiply(raw.protein),
        carbs:     multiply(raw.carbs),     fat:       multiply(raw.fat),
        fiber:     multiply(raw.fiber),     selenium:  multiply(raw.selenium),
        iodine:    multiply(raw.iodine),    zinc:      multiply(raw.zinc),
        iron:      multiply(raw.iron),      magnesium: multiply(raw.magnesium),
        vitd:      multiply(raw.vitd),
      };
      const servLabel = sv !== 1 ? ` (×${sv})` : "";
      setForm(f => ({
        ...f,
        name: (raw.name || f.name) + servLabel,
        nutrients: {
          calories: n.calories, protein: n.protein, carbs: n.carbs,
          fat: n.fat, fiber: n.fiber, water: f.nutrients.water,
          selenium: n.selenium, iodine: n.iodine, zinc: n.zinc,
          iron: n.iron, magnesium: n.magnesium, vitd: n.vitd
        }
      }));
      setAiChips([`${n.calories} cal`,`${n.protein}g protein`,`${n.carbs}g carbs`,`${n.fat}g fat`,`${n.selenium}mcg Se`,`${n.iodine}mcg iodine`,`${n.zinc}mg zinc`,`${n.iron}mg iron`]);
      setAiNote(n.thyroid_note||"");
      setAiState("done");
    } catch(err) {
      setAiMsg(err.message);
      setAiState("error");
    }
    }, 300);
  };

  const save = () => {
    if (!form.name.trim()) { alert("Please enter a meal name."); return; }
    const n = {};
    NUTRIENT_KEYS.forEach(k => { n[k] = parseFloat(form.nutrients[k])||0; });
    onSave({ id:Date.now(), date:logDate, type:"meal", mealType:form.mealType, time:form.time||nowTime(), name:form.name.trim(), nutrients:n, notes:form.notes });
    setForm({ name:"", time:nowTime(), mealType:"Breakfast", notes:"", nutrients:emptyNutrients() });
    setQuery(""); setServings(1); setAiState("idle"); setAiChips([]); setAiNote("");
  };

  return (
    <div>
      <p style={s.sectionTitle}>Log a Meal</p>

    <div style={{ ...s.card, padding:"10px 14px", marginBottom:10, background:COLORS.tealPale, borderColor:COLORS.tealLight }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <span style={{ fontSize:"0.8rem", fontWeight:600, color:COLORS.tealDeep, whiteSpace:"nowrap" }}>📅 Logging for:</span>
        <input type="date" style={{ ...s.input, flex:1, borderColor:COLORS.tealLight }}
          value={logDate} onChange={e=>setLogDate(e.target.value)} max={today()}/>
        {logDate !== today() && <span style={{ fontSize:"0.72rem", background:COLORS.amber, color:"white", borderRadius:6, padding:"2px 8px", whiteSpace:"nowrap" }}>Past date</span>}
      </div>
    </div>

      {/* AI Lookup */}
      <div style={s.aiBox}>
        <div style={s.aiBadge}>🔍 Smart Nutrient Lookup</div>
        <div style={{ display:"flex", gap:8, marginBottom:8 }}>
          <input style={{...s.input, flex:1, borderColor:COLORS.tealLight}}
            placeholder="e.g. scrambled eggs, salmon, spinach"
            value={query} onChange={e=>setQuery(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&lookupNutrients()} />
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:4 }}>
          <div style={{ flex:1 }}>
            <label style={{ ...s.label, marginBottom:4 }}>Servings</label>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <button onClick={()=>setServings(s=>Math.max(0.5, Math.round((parseFloat(s)-0.5)*10)/10))}
                style={{ width:30, height:30, borderRadius:"50%", border:`1px solid ${COLORS.tealLight}`, background:COLORS.white, color:COLORS.tealMid, cursor:"pointer", fontSize:"1rem", fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>−</button>
              <input type="number" min="0.5" step="0.5"
                style={{...s.input, width:60, textAlign:"center", borderColor:COLORS.tealLight}}
                value={servings} onChange={e=>setServings(parseFloat(e.target.value)||1)}/>
              <button onClick={()=>setServings(s=>Math.round((parseFloat(s)+0.5)*10)/10)}
                style={{ width:30, height:30, borderRadius:"50%", border:`1px solid ${COLORS.tealLight}`, background:COLORS.tealMid, color:"white", cursor:"pointer", fontSize:"1rem", fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>+</button>
              <span style={{ fontSize:"0.74rem", color:COLORS.textSec }}>× nutrients</span>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"flex-end", paddingBottom:1 }}>
            <button style={{...s.btnPrimary, whiteSpace:"nowrap", opacity:aiState==="loading"?0.6:1}}
              onClick={lookupNutrients} disabled={aiState==="loading"}>
              {aiState==="loading" ? "..." : "Look up"}
            </button>
          </div>
        </div>
        {aiState==="loading" && <div style={{ fontSize:"0.76rem", color:COLORS.tealMid, marginTop:8 }}>Looking up nutrients…</div>}
        {aiState==="done" && (
          <div style={{ marginTop:10 }}>
            <div style={{ fontWeight:600, fontSize:"0.83rem", marginBottom:6, color:COLORS.tealDeep }}>✅ {form.name}</div>
            <div style={{ marginBottom:6 }}>{aiChips.map((c,i)=><span key={i} style={s.chip}>{c}</span>)}</div>
            {aiNote && <div style={{ fontSize:"0.74rem", color:COLORS.tealMid }}>🦋 {aiNote}</div>}
          </div>
        )}
        {aiState==="error" && <div style={{ fontSize:"0.76rem", color:COLORS.coral, marginTop:8 }}>⚠️ {aiMsg} — fill in manually below.</div>}
      </div>

      <div style={s.card}>
        <div style={s.formRow}>
          <div style={s.formGroup}><label style={s.label}>Meal name</label><input style={s.input} value={form.name} onChange={e=>set("name",e.target.value)} placeholder="e.g. Scrambled eggs"/></div>
          <div style={s.formGroup}><label style={s.label}>Time</label><input type="time" style={s.input} value={form.time} onChange={e=>set("time",e.target.value)}/></div>
        </div>
        <div style={s.formGroup}><label style={s.label}>Meal type</label>
          <select style={s.select} value={form.mealType} onChange={e=>set("mealType",e.target.value)}>
            {["Breakfast","Lunch","Dinner","Snack"].map(t=><option key={t}>{t}</option>)}
          </select>
        </div>

        <div style={{ fontSize:"0.76rem", fontWeight:700, color:COLORS.textSec, textTransform:"uppercase", letterSpacing:"0.05em", margin:"8px 0 8px" }}>Macros</div>
        <div style={s.formRow}>
          <div style={s.formGroup}><label style={s.label}>Calories</label><input type="number" style={s.input} value={form.nutrients.calories} onChange={e=>setN("calories",e.target.value)} placeholder="0" min="0"/></div>
          <div style={s.formGroup}><label style={s.label}>Protein (g)</label><input type="number" style={s.input} value={form.nutrients.protein} onChange={e=>setN("protein",e.target.value)} placeholder="0" min="0"/></div>
        </div>
        <div style={s.formRow}>
          <div style={s.formGroup}><label style={s.label}>Carbs (g)</label><input type="number" style={s.input} value={form.nutrients.carbs} onChange={e=>setN("carbs",e.target.value)} placeholder="0" min="0"/></div>
          <div style={s.formGroup}><label style={s.label}>Fat (g)</label><input type="number" style={s.input} value={form.nutrients.fat} onChange={e=>setN("fat",e.target.value)} placeholder="0" min="0"/></div>
        </div>
        <div style={s.formRow}>
          <div style={s.formGroup}><label style={s.label}>Fiber (g)</label><input type="number" style={s.input} value={form.nutrients.fiber} onChange={e=>setN("fiber",e.target.value)} placeholder="0" min="0"/></div>
        </div>

        {/* Water tracker */}
        <div style={{ background:COLORS.tealPale, border:`1px solid ${COLORS.tealLight}`, borderRadius:10, padding:"12px 14px", marginBottom:10 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
            <label style={{ ...s.label, marginBottom:0, color:COLORS.tealDeep, fontSize:"0.8rem" }}>💧 Water intake</label>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <button onClick={()=>setN("water", Math.max(0,(parseFloat(form.nutrients.water)||0)-0.5))}
                style={{ width:28, height:28, borderRadius:"50%", border:`1px solid ${COLORS.tealLight}`, background:COLORS.white, color:COLORS.tealMid, cursor:"pointer", fontSize:"1rem", fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center" }}>−</button>
              <span style={{ fontFamily:"monospace", fontSize:"1.1rem", fontWeight:600, color:COLORS.tealDeep, minWidth:36, textAlign:"center" }}>
                {parseFloat(form.nutrients.water)||0} <span style={{ fontSize:"0.65rem", fontWeight:400, color:COLORS.textSec }}>cups</span>
              </span>
              <button onClick={()=>setN("water", (parseFloat(form.nutrients.water)||0)+0.5)}
                style={{ width:28, height:28, borderRadius:"50%", border:`1px solid ${COLORS.tealLight}`, background:COLORS.tealMid, color:"white", cursor:"pointer", fontSize:"1rem", fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center" }}>+</button>
            </div>
          </div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {[
              { label:"½ cup",  val:0.5 },
              { label:"1 cup",  val:1   },
              { label:"2 cups", val:2   },
              { label:"Glass",  val:1.5 },
              { label:"Bottle", val:2.5 },
            ].map(opt=>(
              <button key={opt.label} onClick={()=>setN("water", Math.round(((parseFloat(form.nutrients.water)||0)+opt.val)*10)/10)}
                style={{ background:COLORS.white, border:`1px solid ${COLORS.tealLight}`, borderRadius:20, padding:"5px 12px", fontSize:"0.76rem", fontWeight:500, color:COLORS.tealMid, cursor:"pointer", fontFamily:"inherit" }}>
                + {opt.label}
              </button>
            ))}
            <button onClick={()=>setN("water",0)}
              style={{ background:"transparent", border:`1px solid ${COLORS.divider}`, borderRadius:20, padding:"5px 12px", fontSize:"0.76rem", color:COLORS.textSec, cursor:"pointer", fontFamily:"inherit" }}>
              Reset
            </button>
          </div>
          <button onClick={()=>{ if((parseFloat(form.nutrients.water)||0)===0){alert("Add some water first!");return;} onSave({id:Date.now(),date:logDate,type:"meal",mealType:"Drink",time:nowTime(),name:`💧 Water — ${parseFloat(form.nutrients.water)||0} cups`,nutrients:{...Object.fromEntries(NUTRIENT_KEYS.map(k=>[k,0])),water:parseFloat(form.nutrients.water)||0},notes:""}); setN("water",0); }}
            style={{ marginTop:10, width:"100%", background:COLORS.tealMid, color:"white", border:"none", borderRadius:8, padding:"8px 0", fontFamily:"inherit", fontSize:"0.82rem", fontWeight:500, cursor:"pointer" }}>
            💾 Save Water Intake
          </button>
        </div>

        {/* Sprite Zero tracker */}
        <div style={{ background:"#f0f8f0", border:"1px solid #b8ddb8", borderRadius:10, padding:"12px 14px", marginBottom:10 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
            <label style={{ ...s.label, marginBottom:0, color:"#2a5a2a", fontSize:"0.8rem" }}>🥤 Sprite Zero</label>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <button onClick={()=>setN("sprite", Math.max(0,(parseFloat(form.nutrients.sprite)||0)-1))}
                style={{ width:28, height:28, borderRadius:"50%", border:"1px solid #b8ddb8", background:COLORS.white, color:"#3a7a3a", cursor:"pointer", fontSize:"1rem", fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center" }}>−</button>
              <span style={{ fontFamily:"monospace", fontSize:"1.1rem", fontWeight:600, color:"#2a5a2a", minWidth:36, textAlign:"center" }}>
                {parseFloat(form.nutrients.sprite)||0} <span style={{ fontSize:"0.65rem", fontWeight:400, color:COLORS.textSec }}>cans</span>
              </span>
              <button onClick={()=>setN("sprite", (parseFloat(form.nutrients.sprite)||0)+1)}
                style={{ width:28, height:28, borderRadius:"50%", border:"1px solid #b8ddb8", background:"#3a7a3a", color:"white", cursor:"pointer", fontSize:"1rem", fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center" }}>+</button>
            </div>
          </div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {[
              { label:"1 can",    val:1 },
              { label:"2 cans",   val:2 },
              { label:"½ can",    val:0.5 },
            ].map(opt=>(
              <button key={opt.label} onClick={()=>setN("sprite", Math.round(((parseFloat(form.nutrients.sprite)||0)+opt.val)*10)/10)}
                style={{ background:COLORS.white, border:"1px solid #b8ddb8", borderRadius:20, padding:"5px 12px", fontSize:"0.76rem", fontWeight:500, color:"#3a7a3a", cursor:"pointer", fontFamily:"inherit" }}>
                + {opt.label}
              </button>
            ))}
            <button onClick={()=>setN("sprite",0)}
              style={{ background:"transparent", border:`1px solid ${COLORS.divider}`, borderRadius:20, padding:"5px 12px", fontSize:"0.76rem", color:COLORS.textSec, cursor:"pointer", fontFamily:"inherit" }}>
              Reset
            </button>
          </div>
          <p style={{ fontSize:"0.7rem", color:"#5a7a5a", marginTop:8, lineHeight:1.4 }}>⚠️ Tip: Drink Sprite Zero at least 1 hour away from thyroid medication for best absorption.</p>
          <button onClick={()=>{ if((parseFloat(form.nutrients.sprite)||0)===0){alert("Add some Sprite Zero first!");return;} onSave({id:Date.now(),date:logDate,type:"meal",mealType:"Drink",time:nowTime(),name:`🥤 Sprite Zero — ${parseFloat(form.nutrients.sprite)||0} can${(parseFloat(form.nutrients.sprite)||0)!==1?"s":""}`,nutrients:{...Object.fromEntries(NUTRIENT_KEYS.map(k=>[k,0])),sprite:parseFloat(form.nutrients.sprite)||0},notes:""}); setN("sprite",0); }}
            style={{ marginTop:8, width:"100%", background:"#3a7a3a", color:"white", border:"none", borderRadius:8, padding:"8px 0", fontFamily:"inherit", fontSize:"0.82rem", fontWeight:500, cursor:"pointer" }}>
            💾 Save Sprite Zero
          </button>
        </div>

        <div style={{ fontSize:"0.76rem", fontWeight:700, color:COLORS.textSec, textTransform:"uppercase", letterSpacing:"0.05em", margin:"8px 0 8px" }}>Thyroid Micros</div>
        <div style={s.formRow}>
          <div style={s.formGroup}><label style={s.label}>Selenium (mcg)</label><input type="number" style={s.input} value={form.nutrients.selenium} onChange={e=>setN("selenium",e.target.value)} placeholder="0" min="0"/></div>
          <div style={s.formGroup}><label style={s.label}>Iodine (mcg)</label><input type="number" style={s.input} value={form.nutrients.iodine} onChange={e=>setN("iodine",e.target.value)} placeholder="0" min="0"/></div>
        </div>
        <div style={s.formRow}>
          <div style={s.formGroup}><label style={s.label}>Zinc (mg)</label><input type="number" style={s.input} value={form.nutrients.zinc} onChange={e=>setN("zinc",e.target.value)} placeholder="0" min="0" step="0.1"/></div>
          <div style={s.formGroup}><label style={s.label}>Iron (mg)</label><input type="number" style={s.input} value={form.nutrients.iron} onChange={e=>setN("iron",e.target.value)} placeholder="0" min="0" step="0.1"/></div>
        </div>
        <div style={s.formRow}>
          <div style={s.formGroup}><label style={s.label}>Magnesium (mg)</label><input type="number" style={s.input} value={form.nutrients.magnesium} onChange={e=>setN("magnesium",e.target.value)} placeholder="0" min="0"/></div>
          <div style={s.formGroup}><label style={s.label}>Vitamin D (IU)</label><input type="number" style={s.input} value={form.nutrients.vitd} onChange={e=>setN("vitd",e.target.value)} placeholder="0" min="0"/></div>
        </div>

        <div style={s.formGroup}><label style={s.label}>Notes</label><textarea style={s.textarea} value={form.notes} onChange={e=>set("notes",e.target.value)} placeholder="e.g. Had raw kale, or took meds near this meal…"/></div>
        <div style={{ display:"flex", gap:8 }}>
          <button style={s.btnPrimary} onClick={save}>Save Meal</button>
          <button style={s.btnOutline} onClick={()=>{setForm({name:"",time:nowTime(),mealType:"Breakfast",notes:"",nutrients:emptyNutrients()});setQuery("");setAiState("idle");setLogDate(today());}}>Clear</button>
        </div>
      </div>

      <div style={{ ...s.card, background:COLORS.tealPale, borderColor:COLORS.tealLight }}>
        <p style={{ fontSize:"0.76rem", color:COLORS.tealDeep, lineHeight:1.6 }}>
          <strong>🦋 Thyroid tip:</strong> Selenium, iodine, zinc, and iron are critical for thyroid hormone production and conversion. Foods rich in selenium include Brazil nuts, fish, and eggs.
        </p>
      </div>
    </div>
  );
}

function LogMed({ presets, onSave, onUpdatePresets }) {
  const [logDate, setLogDate] = useState(today());
  const [form, setForm] = useState({ name:"", dose:"", type:"med", time:nowTime(), notes:"" });
  const [flash, setFlash] = useState(null);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const quickAdd = (name, dose, type) => {
    onSave({ id:Date.now(), date:logDate, type, time:nowTime(), name, dose, notes:"" });
    setFlash(name); setTimeout(()=>setFlash(null), 1200);
  };

  const save = () => {
    if (!form.name.trim()) { alert("Please enter a name."); return; }
    onSave({ id:Date.now(), date:logDate, type:form.type, time:form.time||nowTime(), name:form.name.trim(), dose:form.dose, notes:form.notes });
    setForm({ name:"", dose:"", type:"med", time:nowTime(), notes:"" });
  };

  return (
    <div>
      <p style={s.sectionTitle}>Medications & Vitamins</p>
    <div style={{ ...s.card, padding:"10px 14px", marginBottom:10, background:COLORS.tealPale, borderColor:COLORS.tealLight }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <span style={{ fontSize:"0.8rem", fontWeight:600, color:COLORS.tealDeep, whiteSpace:"nowrap" }}>📅 Logging for:</span>
        <input type="date" style={{ ...s.input, flex:1, borderColor:COLORS.tealLight }}
          value={logDate} onChange={e=>setLogDate(e.target.value)} max={today()}/>
        {logDate !== today() && <span style={{ fontSize:"0.72rem", background:COLORS.amber, color:"white", borderRadius:6, padding:"2px 8px", whiteSpace:"nowrap" }}>Past date</span>}
      </div>
    </div>
      <div style={s.card}>
        <div style={{ fontSize:"0.74rem", fontWeight:700, color:COLORS.textSec, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:8 }}>Quick Add — Thyroid Meds</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:12 }}>
          {presets.meds.map((p,i)=>(
            <span key={i} onClick={()=>quickAdd(p.name,p.dose,"med")}
              style={{ background: flash===p.name?"#2d7a7a":COLORS.amberPale, color: flash===p.name?"white":COLORS.amber, border:`1px solid ${flash===p.name?"#2d7a7a":"#e8c089"}`, borderRadius:20, padding:"4px 11px", fontSize:"0.73rem", fontWeight:500, cursor:"pointer" }}>
              {flash===p.name?"✓ Logged":`${p.name} ${p.dose}`}
            </span>
          ))}
        </div>
        <div style={{ fontSize:"0.74rem", fontWeight:700, color:COLORS.textSec, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:8 }}>Quick Add — Vitamins</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:14 }}>
          {presets.vits.map((p,i)=>(
            <span key={i} onClick={()=>quickAdd(p.name,p.dose,"vit")}
              style={{ background: flash===p.name?COLORS.sage:COLORS.sagePale, color: flash===p.name?"white":COLORS.sage, border:`1px solid ${flash===p.name?COLORS.sage:"#a5c4a9"}`, borderRadius:20, padding:"4px 11px", fontSize:"0.73rem", fontWeight:500, cursor:"pointer" }}>
              {flash===p.name?"✓ Logged":`${p.name} ${p.dose}`}
            </span>
          ))}
        </div>
        <hr style={{ border:"none", borderTop:`1px solid ${COLORS.divider}`, margin:"0 0 14px" }}/>
        <div style={s.formRow}>
          <div style={s.formGroup}><label style={s.label}>Name</label><input style={s.input} value={form.name} onChange={e=>set("name",e.target.value)} placeholder="e.g. Levothyroxine"/></div>
          <div style={s.formGroup}><label style={s.label}>Dose</label><input style={s.input} value={form.dose} onChange={e=>set("dose",e.target.value)} placeholder="e.g. 50mcg"/></div>
        </div>
        <div style={s.formRow}>
          <div style={s.formGroup}><label style={s.label}>Type</label>
            <select style={s.select} value={form.type} onChange={e=>set("type",e.target.value)}>
              <option value="med">Medication</option><option value="vit">Vitamin / Supplement</option>
            </select>
          </div>
          <div style={s.formGroup}><label style={s.label}>Time</label><input type="time" style={s.input} value={form.time} onChange={e=>set("time",e.target.value)}/></div>
        </div>
        <div style={s.formGroup}><label style={s.label}>Notes</label><textarea style={s.textarea} value={form.notes} onChange={e=>set("notes",e.target.value)} placeholder="e.g. Taken 30 min before breakfast, fasting"/></div>
        <div style={{ display:"flex", gap:8 }}>
          <button style={s.btnPrimary} onClick={save}>Log It</button>
          <button style={s.btnOutline} onClick={()=>setForm({name:"",dose:"",type:"med",time:nowTime(),notes:""})}>Clear</button>
        </div>
      </div>
      <div style={{ ...s.card, background:COLORS.amberPale, borderColor:"#e8c089" }}>
        <p style={{ fontSize:"0.76rem", color:"#6b4a10", lineHeight:1.6 }}>
          <strong>⚠️ Timing matters:</strong> Levothyroxine is best absorbed on an empty stomach, 30–60 min before food. Iron, calcium, and magnesium can block absorption — take them 4+ hours apart.
        </p>
      </div>
    </div>
  );
}

function Symptoms({ onSave, logs }) {
  const [sympDate, setSympDate] = useState(today());
  const [energy, setEnergy] = useState(null);
  const [selected, setSelected] = useState([]);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const existing = logs.find(l => l.type === "symptom" && l.date === sympDate);
    setEnergy(existing?.energy ?? null);
    setSelected(existing?.symptoms ? [...existing.symptoms] : []);
    setNotes(existing?.notes || "");
  }, [sympDate, logs]);

  const toggle = sym => setSelected(s => s.includes(sym) ? s.filter(x=>x!==sym) : [...s,sym]);
  const save = () => {
    onSave({ id:Date.now(), date:sympDate, type:"symptom", time:nowTime(), energy, symptoms:[...selected], notes });
    alert("Check-in saved!");
  };
  return (
    <div>
      <p style={s.sectionTitle}>How do you feel today?</p>
    <div style={{ ...s.card, padding:"10px 14px", marginBottom:10, background:COLORS.tealPale, borderColor:COLORS.tealLight }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <span style={{ fontSize:"0.8rem", fontWeight:600, color:COLORS.tealDeep, whiteSpace:"nowrap" }}>📅 Logging for:</span>
        <input type="date" style={{ ...s.input, flex:1, borderColor:COLORS.tealLight }}
          value={sympDate} onChange={e=>setSympDate(e.target.value)} max={today()}/>
        {sympDate !== today() && <span style={{ fontSize:"0.72rem", background:COLORS.amber, color:"white", borderRadius:6, padding:"2px 8px", whiteSpace:"nowrap" }}>Past date</span>}
      </div>
    </div>
      <div style={s.card}>
        <label style={s.label}>Energy level</label>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
          {[1,2,3,4,5,6,7,8,9,10].map(n=>(
            <div key={n} onClick={()=>setEnergy(n)} style={{ width:30, height:30, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.76rem", fontWeight:500, cursor:"pointer", fontFamily:"monospace", border:`1.5px solid ${energy===n?COLORS.tealMid:COLORS.divider}`, background:energy===n?COLORS.tealMid:"transparent", color:energy===n?"white":COLORS.textSec }}>{n}</div>
          ))}
        </div>
        <p style={{ fontSize:"0.7rem", color:COLORS.textSec }}>1 = exhausted · 10 = full energy</p>
      </div>
      <p style={s.sectionTitle}>Symptoms (tap all that apply)</p>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:7, marginBottom:14 }}>
        {SYMPTOMS_LIST.map(sym=>(
          <button key={sym.key} onClick={()=>toggle(sym.key)} style={{ background: selected.includes(sym.key)?COLORS.tealPale:COLORS.white, border:`1px solid ${selected.includes(sym.key)?COLORS.tealLight:COLORS.divider}`, borderRadius:8, padding:"8px 4px", fontSize:"0.72rem", textAlign:"center", cursor:"pointer", color:selected.includes(sym.key)?COLORS.tealDeep:COLORS.textSec, fontFamily:"inherit", fontWeight:500 }}>
            <div style={{ fontSize:"1.1rem", marginBottom:3 }}>{sym.emoji}</div>{sym.label}
          </button>
        ))}
      </div>
      <div style={s.card}>
        <div style={s.formGroup}><label style={s.label}>Additional notes</label><textarea style={s.textarea} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="e.g. Woke up puffy, great after selenium…"/></div>
        <button style={s.btnPrimary} onClick={save}>Save Check-in</button>
      </div>
    </div>
  );
}

function History({ logs, onDelete }) {
  const days = {};
  logs.forEach(l => { if(!days[l.date]) days[l.date]=[]; days[l.date].push(l); });
  const sortedDays = Object.keys(days).sort((a,b)=>b>a?1:-1).slice(0,7);
  return (
    <div>
      <p style={s.sectionTitle}>Past 7 Days</p>
      {sortedDays.length===0
        ? <div style={s.emptyState}><div style={{ fontSize:"1.8rem", marginBottom:8 }}>📅</div>No history yet. Start logging to see trends.</div>
        : sortedDays.map(d=>(
          <div key={d} style={{ marginBottom:16 }}>
            <div style={{ fontSize:"0.7rem", fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", color:COLORS.textSec, marginBottom:8, paddingBottom:6, borderBottom:`1px solid ${COLORS.divider}` }}>{dateLabel(d)}</div>
            <div style={s.card}>
              {days[d].sort((a,b)=>a.time>b.time?1:-1).map(l=><LogItem key={l.id} log={l} onDelete={onDelete}/>)}
            </div>
          </div>
        ))
      }
    </div>
  );
}

function Settings({ goals, presets, onSaveGoals, onUpdatePresets }) {
  const [form, setForm] = useState({...goals});
  const [pName, setPName] = useState(""); const [pDose, setPDose] = useState(""); const [pType, setPType] = useState("med");
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const addPreset = () => {
    if (!pName.trim()) return;
    const updated = { meds:[...presets.meds], vits:[...presets.vits] };
    if (pType==="med") updated.meds.push({name:pName,dose:pDose});
    else updated.vits.push({name:pName,dose:pDose});
    onUpdatePresets(updated); setPName(""); setPDose("");
  };
  const removePreset = (type,idx) => {
    const updated = { meds:[...presets.meds], vits:[...presets.vits] };
    updated[type+"s"].splice(idx,1); onUpdatePresets(updated);
  };

  return (
    <div>
      <p style={s.sectionTitle}>My Nutrient Goals</p>
      <div style={s.card}>
        {[["calories","Calories / day"],["protein","Protein (g)"],["carbs","Carbs (g)"],["fat","Fat (g)"],["fiber","Fiber (g)"],["water","Water (cups)"]].reduce((rows,item,i,arr)=>{
          if(i%2===0) rows.push([item, arr[i+1]]);
          return rows;
        },[]).map((pair,i)=>(
          <div key={i} style={s.formRow}>
            {pair.filter(Boolean).map(([k,lbl])=>(
              <div key={k} style={s.formGroup}><label style={s.label}>{lbl}</label><input type="number" style={s.input} value={form[k]} onChange={e=>set(k,e.target.value)}/></div>
            ))}
          </div>
        ))}
        <div style={{ fontSize:"0.76rem", fontWeight:700, color:COLORS.textSec, textTransform:"uppercase", letterSpacing:"0.05em", margin:"8px 0 8px" }}>Thyroid Micros</div>
        {[["selenium","Selenium (mcg)"],["iodine","Iodine (mcg)"],["zinc","Zinc (mg)"],["iron","Iron (mg)"],["magnesium","Magnesium (mg)"],["vitd","Vitamin D (IU)"]].reduce((rows,item,i,arr)=>{ if(i%2===0) rows.push([item,arr[i+1]]); return rows; },[]).map((pair,i)=>(
          <div key={i} style={s.formRow}>
            {pair.filter(Boolean).map(([k,lbl])=>(
              <div key={k} style={s.formGroup}><label style={s.label}>{lbl}</label><input type="number" style={s.input} value={form[k]} onChange={e=>set(k,e.target.value)}/></div>
            ))}
          </div>
        ))}
        <button style={s.btnPrimary} onClick={()=>onSaveGoals(Object.fromEntries(Object.entries(form).map(([k,v])=>[k,parseFloat(v)||DEFAULT_GOALS[k]])))}>Save Goals</button>
      </div>

      <p style={s.sectionTitle}>My Medications & Vitamins</p>
      <div style={s.card}>
        <p style={{ fontSize:"0.76rem", color:COLORS.textSec, marginBottom:10 }}>Add your regular meds/vitamins as quick-add chips.</p>
        <div style={s.formRow}>
          <div style={s.formGroup}><label style={s.label}>Name</label><input style={s.input} value={pName} onChange={e=>setPName(e.target.value)} placeholder="Levothyroxine"/></div>
          <div style={s.formGroup}><label style={s.label}>Dose</label><input style={s.input} value={pDose} onChange={e=>setPDose(e.target.value)} placeholder="50mcg"/></div>
        </div>
        <div style={s.formGroup}><label style={s.label}>Type</label>
          <select style={s.select} value={pType} onChange={e=>setPType(e.target.value)}>
            <option value="med">Medication</option><option value="vit">Vitamin / Supplement</option>
          </select>
        </div>
        <button style={{...s.btnPrimary,...s.btnSm}} onClick={addPreset}>Add to Quick List</button>
        <div style={{ marginTop:14 }}>
          {[...presets.meds.map((p,i)=>({...p,type:"med",idx:i})),...presets.vits.map((p,i)=>({...p,type:"vit",idx:i}))].map((p,i)=>(
            <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 0", borderBottom:`1px solid ${COLORS.divider}` }}>
              <span style={{ fontSize:"0.82rem" }}>{p.name} <span style={{ color:COLORS.textSec }}>{p.dose}</span></span>
              <button style={s.btnDanger} onClick={()=>removePreset(p.type,p.idx)}>Remove</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}



// ── EDIT MED/VIT MODAL ─────────────────────────────────────────────────────────
function EditMedModal({ log, onSave, onClose }) {
  const [time, setTime] = useState(log.time || "");
  const [dose, setDose] = useState(log.dose || "");
  const [notes, setNotes] = useState(log.notes || "");

  const overlayStyle = {
    position:"fixed", top:0, left:0, right:0, bottom:0,
    background:"rgba(0,0,0,0.45)", zIndex:200,
    display:"flex", alignItems:"flex-end", justifyContent:"center"
  };
  const sheetStyle = {
    background:COLORS.white, borderRadius:"16px 16px 0 0",
    width:"100%", maxWidth:660, padding:20, boxSizing:"border-box"
  };

  return (
    <div style={overlayStyle} onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div style={sheetStyle}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <span style={{ fontFamily:"Georgia,serif", fontSize:"1rem", color:COLORS.tealDeep }}>
            {log.type==="med" ? "✏️ Edit Medication" : "✏️ Edit Vitamin"}
          </span>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:"1.2rem", cursor:"pointer", color:COLORS.textSec }}>✕</button>
        </div>
        <div style={{ fontSize:"0.88rem", fontWeight:500, marginBottom:14, color:COLORS.ink }}>
          {log.name}{log.dose ? ` — ${log.dose}` : ""}
        </div>
        <div style={s.formRow}>
          <div style={s.formGroup}>
            <label style={s.label}>Time taken</label>
            <input type="time" style={s.input} value={time} onChange={e=>setTime(e.target.value)}/>
          </div>
          <div style={s.formGroup}>
            <label style={s.label}>Dose</label>
            <input style={s.input} value={dose} onChange={e=>setDose(e.target.value)} placeholder="e.g. 200mcg"/>
          </div>
        </div>
        <div style={s.formGroup}>
          <label style={s.label}>Notes</label>
          <textarea style={s.textarea} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="e.g. taken with food, fasting…"/>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button style={s.btnPrimary} onClick={()=>onSave({...log, time, dose, notes})}>Save Changes</button>
          <button style={s.btnOutline} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── CALENDAR ──────────────────────────────────────────────────────────────────
function Calendar({ logs, onDelete }) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth()); // 0-indexed
  const [selectedDay, setSelectedDay] = useState(null);

  // Build a map: date string -> summary
  const dayMap = {};
  logs.forEach(l => {
    if (!dayMap[l.date]) dayMap[l.date] = { meals:0, meds:0, symptom:null };
    if (l.type==="meal") dayMap[l.date].meals++;
    if (l.type==="med"||l.type==="vit") dayMap[l.date].meds++;
    if (l.type==="symptom") dayMap[l.date].symptom = l;
  });

  const firstDay = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(viewYear, viewMonth+1, 0).getDate();
  const monthName = new Date(viewYear, viewMonth).toLocaleDateString("en-US",{month:"long",year:"numeric"});

  const prevMonth = () => { if(viewMonth===0){setViewMonth(11);setViewYear(y=>y-1);}else setViewMonth(m=>m-1); setSelectedDay(null); };
  const nextMonth = () => { if(viewMonth===11){setViewMonth(0);setViewYear(y=>y+1);}else setViewMonth(m=>m+1); setSelectedDay(null); };

  const todayStr = today();

  const getDotColor = (d) => {
    const info = dayMap[d];
    if (!info) return null;
    const energy = info.symptom?.energy;
    if (energy >= 7) return COLORS.sage;
    if (energy >= 4) return COLORS.amber;
    if (energy) return COLORS.coral;
    if (info.meals > 0 || info.meds > 0) return COLORS.tealLight;
    return null;
  };

  // Selected day logs
  const selLogs = selectedDay ? (logs.filter(l=>l.date===selectedDay).sort((a,b)=>a.time>b.time?1:-1)) : [];
  const selInfo = selectedDay ? dayMap[selectedDay] : null;

  return (
    <div>
      <p style={s.sectionTitle}>Calendar</p>

      {/* Month nav */}
      <div style={s.card}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
          <button onClick={prevMonth} style={{ background:"none", border:`1px solid ${COLORS.divider}`, borderRadius:8, width:34, height:34, cursor:"pointer", fontSize:"1rem", color:COLORS.tealMid }}>‹</button>
          <span style={{ fontFamily:"Georgia,serif", fontSize:"1rem", color:COLORS.tealDeep }}>{monthName}</span>
          <button onClick={nextMonth} style={{ background:"none", border:`1px solid ${COLORS.divider}`, borderRadius:8, width:34, height:34, cursor:"pointer", fontSize:"1rem", color:COLORS.tealMid }}>›</button>
        </div>

        {/* Day headers */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", marginBottom:6 }}>
          {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d=>(
            <div key={d} style={{ textAlign:"center", fontSize:"0.68rem", fontWeight:700, color:COLORS.textSec, textTransform:"uppercase", letterSpacing:"0.05em", paddingBottom:6 }}>{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3 }}>
          {/* Empty cells before first day */}
          {Array.from({length:firstDay}).map((_,i)=><div key={"e"+i}/>)}

          {/* Day cells */}
          {Array.from({length:daysInMonth}).map((_,i)=>{
            const day = i+1;
            const dateStr = `${viewYear}-${String(viewMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
            const isToday = dateStr===todayStr;
            const isSelected = dateStr===selectedDay;
            const dot = getDotColor(dateStr);
            const hasData = !!dayMap[dateStr];

            return (
              <div key={day} onClick={()=>setSelectedDay(isSelected?null:dateStr)}
                style={{
                  aspectRatio:"1", display:"flex", flexDirection:"column", alignItems:"center",
                  justifyContent:"center", borderRadius:8, cursor: hasData?"pointer":"default",
                  background: isSelected ? COLORS.tealMid : isToday ? COLORS.tealPale : "transparent",
                  border: isToday && !isSelected ? `1.5px solid ${COLORS.tealLight}` : "1.5px solid transparent",
                  transition:"background 0.15s",
                  position:"relative"
                }}>
                <span style={{ fontSize:"0.78rem", fontWeight: isToday?700:400, color: isSelected?"white": isToday?COLORS.tealDeep: COLORS.ink, lineHeight:1 }}>{day}</span>
                {dot && <div style={{ width:5, height:5, borderRadius:"50%", background: isSelected?"rgba(255,255,255,0.8)":dot, marginTop:2 }}/>}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div style={{ display:"flex", gap:12, marginTop:12, flexWrap:"wrap" }}>
          {[
            {color:COLORS.sage,     label:"High energy (7-10)"},
            {color:COLORS.amber,    label:"Mid energy (4-6)"},
            {color:COLORS.coral,    label:"Low energy (1-3)"},
            {color:COLORS.tealLight,label:"Logged, no check-in"},
          ].map(({color,label})=>(
            <div key={label} style={{ display:"flex", alignItems:"center", gap:5, fontSize:"0.69rem", color:COLORS.textSec }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:color, flexShrink:0 }}/>
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Selected day detail */}
      {selectedDay && (
        <div>
          <p style={s.sectionTitle}>{dateLabel(selectedDay)}</p>
          {selLogs.length===0
            ? <div style={{ ...s.card, ...s.emptyState }}>Nothing logged this day.</div>
            : (
              <div>
                {/* Summary chips */}
                {selInfo && (
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:10 }}>
                    {selInfo.meals>0 && <span style={{ background:COLORS.tealPale, color:COLORS.tealDeep, borderRadius:20, padding:"4px 12px", fontSize:"0.74rem", fontWeight:500 }}>🍽️ {selInfo.meals} meal{selInfo.meals>1?"s":""}</span>}
                    {selInfo.meds>0  && <span style={{ background:COLORS.amberPale, color:COLORS.amber, borderRadius:20, padding:"4px 12px", fontSize:"0.74rem", fontWeight:500 }}>💊 {selInfo.meds} med{selInfo.meds>1?"s":""}</span>}
                    {selInfo.symptom?.energy && <span style={{ background:COLORS.sagePale, color:COLORS.sage, borderRadius:20, padding:"4px 12px", fontSize:"0.74rem", fontWeight:500 }}>⚡ Energy {selInfo.symptom.energy}/10</span>}
                    {selInfo.symptom?.symptoms?.length>0 && <span style={{ background:COLORS.coralPale, color:COLORS.coral, borderRadius:20, padding:"4px 12px", fontSize:"0.74rem", fontWeight:500 }}>🩺 {selInfo.symptom.symptoms.length} symptom{selInfo.symptom.symptoms.length>1?"s":""}</span>}
                  </div>
                )}
                <div style={s.card}>
                  {selLogs.map(l=><LogItem key={l.id} log={l} onDelete={onDelete}/>)}
                </div>
              </div>
            )
          }
        </div>
      )}
    </div>
  );
}


// ── WEIGHT TRACKER ────────────────────────────────────────────────────────────
function WeightTracker({ weightLog, onSave, onDelete }) {
  const [weightDate, setWeightDate] = useState(today());
  const [weight, setWeight] = useState("");
  const [unit, setUnit] = useState("lbs");
  const [note, setNote] = useState("");

  const save = () => {
    if (!weight || isNaN(parseFloat(weight))) { alert("Please enter a weight."); return; }
    onSave({ id:Date.now(), date:weightDate, time:nowTime(), weight:parseFloat(weight), unit, note });
    setWeight(""); setNote("");
  };

  // Sort by date descending
  const sorted = [...weightLog].sort((a,b) => b.date > a.date ? 1 : b.date < a.date ? -1 : 0);

  // Chart: last 30 entries
  const chartData = [...weightLog]
    .sort((a,b) => a.date > b.date ? 1 : -1)
    .slice(-30);

  // Convert all to same unit for chart
  const toDisplay = (w, u) => unit === "kg"
    ? (u === "lbs" ? Math.round(w * 0.453592 * 10) / 10 : w)
    : (u === "kg"  ? Math.round(w * 2.20462 * 10) / 10  : w);

  const chartWeights = chartData.map(e => toDisplay(e.weight, e.unit));
  const minW = chartWeights.length ? Math.floor(Math.min(...chartWeights) - 3) : 0;
  const maxW = chartWeights.length ? Math.ceil(Math.max(...chartWeights)  + 3) : 100;
  const chartH = 140;
  const chartW = 280;
  const pad = { t:10, r:10, b:24, l:36 };
  const innerW = chartW - pad.l - pad.r;
  const innerH = chartH - pad.t - pad.b;

  const toX = i => pad.l + (chartWeights.length > 1 ? (i / (chartWeights.length-1)) * innerW : innerW/2);
  const toY = w  => pad.t + innerH - ((w - minW) / (maxW - minW || 1)) * innerH;

  const polyline = chartWeights.map((w,i) => `${toX(i)},${toY(w)}`).join(" ");
  const area     = chartWeights.length
    ? `${toX(0)},${pad.t+innerH} ` + chartWeights.map((w,i)=>`${toX(i)},${toY(w)}`).join(" ") + ` ${toX(chartWeights.length-1)},${pad.t+innerH}`
    : "";

  const latest = sorted[0];
  const prev   = sorted[1];
  const diff   = latest && prev ? (toDisplay(latest.weight, latest.unit) - toDisplay(prev.weight, prev.unit)) : null;

  return (
    <div>
      <p style={s.sectionTitle}>Weight Tracker</p>

      {/* Log entry */}
      <div style={s.card}>
        <div style={{ display:"flex", gap:8, alignItems:"flex-end", marginBottom:10 }}>
          <div style={{ flex:1 }}>
            <div style={{ marginBottom:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontSize:"0.8rem", fontWeight:600, color:COLORS.tealDeep, whiteSpace:"nowrap" }}>📅 Logging for:</span>
            <input type="date" style={{ ...s.input, flex:1, borderColor:COLORS.tealLight }}
              value={weightDate} onChange={e=>setWeightDate(e.target.value)} max={today()}/>
            {weightDate !== today() && <span style={{ fontSize:"0.72rem", background:COLORS.amber, color:"white", borderRadius:6, padding:"2px 8px", whiteSpace:"nowrap" }}>Past date</span>}
          </div>
        </div>
        <label style={s.label}>Weight</label>
            <input type="number" style={s.input} value={weight} onChange={e=>setWeight(e.target.value)}
              placeholder={unit==="lbs"?"e.g. 145":"e.g. 65"} step="0.1" min="0"/>
          </div>
          <div style={{ width:80 }}>
            <label style={s.label}>Unit</label>
            <select style={s.select} value={unit} onChange={e=>setUnit(e.target.value)}>
              <option value="lbs">lbs</option>
              <option value="kg">kg</option>
            </select>
          </div>
          <button style={{ ...s.btnPrimary, whiteSpace:"nowrap", paddingTop:9, paddingBottom:9 }} onClick={save}>Log</button>
        </div>
        <div style={s.formGroup}>
          <label style={s.label}>Note (optional)</label>
          <input style={s.input} value={note} onChange={e=>setNote(e.target.value)} placeholder="e.g. Morning, after breakfast…"/>
        </div>
      </div>

      {/* Summary */}
      {latest && (
        <div style={{ display:"flex", gap:10, marginBottom:14 }}>
          <div style={{ ...s.card, flex:1, textAlign:"center", marginBottom:0 }}>
            <div style={{ fontSize:"0.68rem", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em", color:COLORS.textSec, marginBottom:4 }}>Latest</div>
            <div style={{ fontFamily:"Georgia,serif", fontSize:"1.5rem", color:COLORS.tealDeep }}>{toDisplay(latest.weight, latest.unit)}</div>
            <div style={{ fontSize:"0.7rem", color:COLORS.textSec }}>{unit}</div>
          </div>
          {diff !== null && (
            <div style={{ ...s.card, flex:1, textAlign:"center", marginBottom:0 }}>
              <div style={{ fontSize:"0.68rem", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em", color:COLORS.textSec, marginBottom:4 }}>Change</div>
              <div style={{ fontFamily:"Georgia,serif", fontSize:"1.5rem", color: diff<0?COLORS.sage: diff>0?COLORS.coral: COLORS.ink }}>
                {diff > 0 ? "+" : ""}{Math.round(diff*10)/10}
              </div>
              <div style={{ fontSize:"0.7rem", color:COLORS.textSec }}>{unit} from last</div>
            </div>
          )}
          <div style={{ ...s.card, flex:1, textAlign:"center", marginBottom:0 }}>
            <div style={{ fontSize:"0.68rem", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em", color:COLORS.textSec, marginBottom:4 }}>Entries</div>
            <div style={{ fontFamily:"Georgia,serif", fontSize:"1.5rem", color:COLORS.tealDeep }}>{weightLog.length}</div>
            <div style={{ fontSize:"0.7rem", color:COLORS.textSec }}>logged</div>
          </div>
        </div>
      )}

      {/* Chart */}
      {chartWeights.length > 1 && (
        <div style={s.card}>
          <div style={{ fontSize:"0.76rem", fontWeight:600, color:COLORS.textSec, marginBottom:8, textTransform:"uppercase", letterSpacing:"0.05em" }}>Trend (last {chartWeights.length} entries)</div>
          <svg width="100%" viewBox={`0 0 ${chartW} ${chartH}`} style={{ overflow:"visible" }}>
            {/* Grid lines */}
            {[0,0.25,0.5,0.75,1].map(t => {
              const y = pad.t + innerH * (1-t);
              const val = Math.round(minW + (maxW-minW)*t);
              return (
                <g key={t}>
                  <line x1={pad.l} y1={y} x2={pad.l+innerW} y2={y} stroke={COLORS.divider} strokeWidth="0.5"/>
                  <text x={pad.l-4} y={y+4} fontSize="8" fill={COLORS.textSec} textAnchor="end">{val}</text>
                </g>
              );
            })}
            {/* Area fill */}
            <polygon points={area} fill={COLORS.tealPale} opacity="0.6"/>
            {/* Line */}
            <polyline points={polyline} fill="none" stroke={COLORS.tealMid} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
            {/* Dots */}
            {chartWeights.map((w,i) => (
              <circle key={i} cx={toX(i)} cy={toY(w)} r="3" fill={COLORS.tealMid}/>
            ))}
            {/* X-axis labels: first, mid, last */}
            {chartData.length >= 2 && [0, Math.floor(chartData.length/2), chartData.length-1].map(i => (
              <text key={i} x={toX(i)} y={chartH-6} fontSize="7.5" fill={COLORS.textSec} textAnchor="middle">
                {new Date(chartData[i].date+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})}
              </text>
            ))}
          </svg>
        </div>
      )}

      {/* Log list */}
      {sorted.length > 0 && (
        <div>
          <p style={s.sectionTitle}>History</p>
          <div style={s.card}>
            {sorted.slice(0,20).map(e => (
              <div key={e.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 0", borderBottom:`1px solid ${COLORS.divider}` }}>
                <div style={{ width:34, height:34, borderRadius:8, background:COLORS.tealPale, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1rem", flexShrink:0 }}>⚖️</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:"0.86rem", fontWeight:500 }}>{toDisplay(e.weight, e.unit)} {unit}</div>
                  <div style={{ fontSize:"0.71rem", color:COLORS.textSec }}>{dateLabel(e.date)}{e.note ? " · "+e.note : ""}</div>
                </div>
                <span style={{ fontFamily:"monospace", fontSize:"0.69rem", color:COLORS.textSec, marginRight:4 }}>{e.time}</span>
                <button onClick={()=>onDelete(e.id)} style={{ background:"none", border:"none", color:COLORS.divider, cursor:"pointer", fontSize:"0.9rem", padding:"2px 4px" }}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {sorted.length === 0 && (
        <div style={s.emptyState}><div style={{ fontSize:"1.8rem", marginBottom:8 }}>⚖️</div>No weight entries yet. Log your first one above!</div>
      )}

      <div style={{ ...s.card, background:COLORS.tealPale, borderColor:COLORS.tealLight, marginTop:4 }}>
        <p style={{ fontSize:"0.76rem", color:COLORS.tealDeep, lineHeight:1.6 }}>
          <strong>🦋 Thyroid tip:</strong> Unexplained weight gain or loss is a key thyroid symptom. Tracking your weight alongside energy and symptoms helps you spot patterns to share with your doctor.
        </p>
      </div>
    </div>
  );
}


// ── MEDICATION SCHEDULE ───────────────────────────────────────────────────────
const SCHEDULE = [
  { time:"8:30 AM",  items:[
    { name:"Synthroid (Levothyroxine)", dose:"125mcg", type:"med", note:"Take on empty stomach, 30 min before food" }
  ]},
  { time:"9:00 AM",  items:[
    { name:"Sertraline", dose:"100mg", type:"med", note:"Take 30 min after Synthroid" }
  ]},
  { time:"12:30 PM", items:[
    { name:"Vitamin K",  dose:"6090mcg", type:"vit", note:"Take with lunch" },
    { name:"Vitamin D3", dose:"2000IU",  type:"vit", note:"Take with lunch" },
    { name:"Vitamin B12",dose:"1mg",     type:"vit", note:"Take with lunch" },
    { name:"Selenium",   dose:"200mcg",  type:"vit", note:"Take with lunch" },
  ]},
  { time:"9:00 PM",  items:[
    { name:"Lamotrigine",        dose:"25mg",  type:"med", note:"Take at night for mood" },
    { name:"Magnesium Glycinate",dose:"200mg", type:"vit", note:"Take at night, well clear of Synthroid" },
  ]},
];

function MedSchedule({ logs }) {
  const todayLogs = logs.filter(l => l.date === today());

  const isLogged = (name) => todayLogs.some(l =>
    (l.type==="med"||l.type==="vit") && l.name.toLowerCase().includes(name.toLowerCase().split(" ")[0])
  );

  const now = new Date();
  const currentMins = now.getHours()*60 + now.getMinutes();

  const timeToMins = (t) => {
    const [time, period] = t.split(" ");
    let [h, m] = time.split(":").map(Number);
    if (period==="PM" && h!==12) h+=12;
    if (period==="AM" && h===12) h=0;
    return h*60 + m;
  };

  const totalItems = SCHEDULE.reduce((a,s) => a+s.items.length, 0);
  const loggedItems = SCHEDULE.reduce((a,s) => a+s.items.filter(i=>isLogged(i.name)).length, 0);
  const pct = Math.round((loggedItems/totalItems)*100);

  return (
    <div>
      <p style={s.sectionTitle}>Daily Schedule</p>

      {/* Progress bar */}
      <div style={s.card}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
          <span style={{ fontSize:"0.82rem", fontWeight:600, color:COLORS.tealDeep }}>Today's progress</span>
          <span style={{ fontFamily:"monospace", fontSize:"0.82rem", color:COLORS.tealMid, fontWeight:600 }}>{loggedItems}/{totalItems} taken</span>
        </div>
        <div style={{ height:8, background:COLORS.mist, borderRadius:4, overflow:"hidden" }}>
          <div style={{ height:"100%", width:`${pct}%`, background: pct===100?COLORS.sage:COLORS.tealMid, borderRadius:4, transition:"width 0.4s" }}/>
        </div>
        {pct===100 && <p style={{ fontSize:"0.76rem", color:COLORS.sage, marginTop:8, fontWeight:500 }}>✅ All medications and vitamins taken today!</p>}
      </div>

      {/* Schedule blocks */}
      {SCHEDULE.map((block, bi) => {
        const blockMins = timeToMins(block.time);
        const isPast = currentMins > blockMins + 30;
        const isCurrent = Math.abs(currentMins - blockMins) <= 30;
        const allLogged = block.items.every(i => isLogged(i.name));

        return (
          <div key={bi} style={{ marginBottom:12 }}>
            {/* Time header */}
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
              <div style={{ background: allLogged?COLORS.sage: isCurrent?COLORS.tealMid: isPast?COLORS.coral: COLORS.divider,
                width:10, height:10, borderRadius:"50%", flexShrink:0 }}/>
              <span style={{ fontFamily:"monospace", fontSize:"0.82rem", fontWeight:600,
                color: isCurrent?COLORS.tealDeep: isPast&&!allLogged?COLORS.coral: COLORS.textSec }}>
                {block.time}
                {isCurrent && <span style={{ marginLeft:6, fontSize:"0.7rem", background:COLORS.tealPale, color:COLORS.tealMid, borderRadius:4, padding:"1px 6px" }}>Now</span>}
                {isPast && !allLogged && <span style={{ marginLeft:6, fontSize:"0.7rem", background:COLORS.coralPale, color:COLORS.coral, borderRadius:4, padding:"1px 6px" }}>Missed</span>}
                {allLogged && <span style={{ marginLeft:6, fontSize:"0.7rem", background:COLORS.sagePale, color:COLORS.sage, borderRadius:4, padding:"1px 6px" }}>✓ Done</span>}
              </span>
            </div>

            {/* Items */}
            <div style={{ ...s.card, padding:"10px 14px" }}>
              {block.items.map((item, ii) => {
                const logged = isLogged(item.name);
                return (
                  <div key={ii} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0",
                    borderBottom: ii<block.items.length-1?`1px solid ${COLORS.divider}`:"none",
                    opacity: logged?0.6:1 }}>
                    <div style={{ width:24, height:24, borderRadius:"50%", flexShrink:0,
                      background: logged?COLORS.sage: item.type==="med"?COLORS.amberPale:COLORS.sagePale,
                      border: logged?`2px solid ${COLORS.sage}`: `2px solid ${item.type==="med"?"#e8c089":"#a5c4a9"}`,
                      display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.7rem" }}>
                      {logged ? "✓" : item.type==="med" ? "💊" : "🌿"}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:"0.84rem", fontWeight:500, textDecoration:logged?"line-through":"none", color:logged?COLORS.textSec:COLORS.ink }}>
                        {item.name} <span style={{ fontWeight:400, color:COLORS.textSec }}>— {item.dose}</span>
                      </div>
                      <div style={{ fontSize:"0.7rem", color:COLORS.textSec, marginTop:1 }}>{item.note}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div style={{ ...s.card, background:COLORS.amberPale, borderColor:"#e8c089" }}>
        <p style={{ fontSize:"0.76rem", color:"#6b4a10", lineHeight:1.6 }}>
          <strong>⚠️ Reminder:</strong> Synthroid works best on an empty stomach. Wait 30 min before eating and take Sertraline after. Keep Magnesium and Lamotrigine at 9PM — well away from your morning meds.
        </p>
      </div>
    </div>
  );
}


// ── MEALS & NUTRIENTS ─────────────────────────────────────────────────────────
function MealsNutrients({ logs }) {
  const [selectedDate, setSelectedDate] = useState(today());

  const dates = [...new Set(logs.filter(l=>l.type==="meal").map(l=>l.date))].sort((a,b)=>b>a?1:-1);
  const dayMeals = logs.filter(l=>l.type==="meal" && l.date===selectedDate);

  // Daily totals
  const totals = Object.fromEntries(NUTRIENT_KEYS.map(k=>[k,0]));
  dayMeals.forEach(l => NUTRIENT_KEYS.forEach(k=>{ totals[k] += l.nutrients?.[k]||0; }));

  const MACRO_COLS = [
    {key:"calories", label:"Cal",    unit:""},
    {key:"protein",  label:"Protein",unit:"g"},
    {key:"carbs",    label:"Carbs",  unit:"g"},
    {key:"fat",      label:"Fat",    unit:"g"},
    {key:"fiber",    label:"Fiber",  unit:"g"},
  ];

  const MICRO_COLS = [
    {key:"selenium",  label:"Se",   unit:"mcg", thyroid:true},
    {key:"iodine",    label:"Iod",  unit:"mcg", thyroid:true},
    {key:"zinc",      label:"Zinc", unit:"mg",  thyroid:true},
    {key:"iron",      label:"Iron", unit:"mg",  thyroid:true},
    {key:"vitd",      label:"Vit D",unit:"IU",  thyroid:true},
    {key:"magnesium", label:"Mag",  unit:"mg",  thyroid:false},
    {key:"vitk",      label:"Vit K",unit:"mcg", thyroid:false},
    {key:"b12",       label:"B12",  unit:"mcg", thyroid:false},
  ];

  const fmt = (v) => v ? (Number.isInteger(v) ? v : parseFloat(v.toFixed(1))) : 0;

  return (
    <div>
      <p style={s.sectionTitle}>Meals & Nutrients</p>

      {/* Date selector */}
      <div style={{ ...s.card, padding:"10px 14px", marginBottom:14 }}>
        <label style={s.label}>Select day</label>
        <select style={s.select} value={selectedDate} onChange={e=>setSelectedDate(e.target.value)}>
          {dates.length === 0
            ? <option value={today()}>Today</option>
            : dates.map(d => <option key={d} value={d}>{dateLabel(d)}</option>)
          }
        </select>
      </div>

      {dayMeals.length === 0
        ? <div style={s.emptyState}><div style={{fontSize:"1.8rem",marginBottom:8}}>🍽️</div>No meals logged for this day.</div>
        : (
          <>
            {/* Meal cards */}
            {dayMeals.map(meal => (
              <div key={meal.id} style={{ ...s.card, marginBottom:10 }}>
                {/* Meal header */}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                  <div>
                    <div style={{ fontSize:"0.9rem", fontWeight:600, color:COLORS.ink }}>{meal.name}</div>
                    <div style={{ fontSize:"0.72rem", color:COLORS.textSec, marginTop:2 }}>
                      {meal.mealType} · {meal.time}
                    </div>
                  </div>
                  <span style={{ background:COLORS.tealPale, color:COLORS.tealDeep, borderRadius:6, padding:"3px 10px", fontSize:"0.78rem", fontWeight:600 }}>
                    {fmt(meal.nutrients?.calories)} cal
                  </span>
                </div>

                {/* Macros row */}
                <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:6, marginBottom:8 }}>
                  {[
                    {key:"protein", label:"Protein", unit:"g", color:COLORS.tealMid},
                    {key:"carbs",   label:"Carbs",   unit:"g", color:COLORS.amber},
                    {key:"fat",     label:"Fat",     unit:"g", color:"#c07a3a"},
                    {key:"fiber",   label:"Fiber",   unit:"g", color:COLORS.sage},
                  ].map(m => (
                    <div key={m.key} style={{ background:COLORS.mist, borderRadius:8, padding:"7px 8px", textAlign:"center" }}>
                      <div style={{ fontFamily:"monospace", fontSize:"0.9rem", fontWeight:600, color:m.color }}>{fmt(meal.nutrients?.[m.key])}<span style={{fontSize:"0.65rem"}}>{m.unit}</span></div>
                      <div style={{ fontSize:"0.65rem", color:COLORS.textSec, marginTop:1 }}>{m.label}</div>
                    </div>
                  ))}
                </div>

                {/* Thyroid micros */}
                <div style={{ borderTop:`1px solid ${COLORS.divider}`, paddingTop:8 }}>
                  <div style={{ fontSize:"0.68rem", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em", color:COLORS.textSec, marginBottom:6 }}>Thyroid Micros</div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                    {MICRO_COLS.slice(0,5).map(m => (
                      <span key={m.key} style={{ background: meal.nutrients?.[m.key]>0?COLORS.tealPale:COLORS.mist, color: meal.nutrients?.[m.key]>0?COLORS.tealDeep:COLORS.textSec, borderRadius:5, padding:"2px 8px", fontSize:"0.71rem", fontFamily:"monospace" }}>
                        {m.label}: {fmt(meal.nutrients?.[m.key])}{m.unit}
                      </span>
                    ))}
                  </div>
                </div>

                {meal.notes && (
                  <div style={{ marginTop:8, fontSize:"0.74rem", color:COLORS.textSec, fontStyle:"italic" }}>
                    📝 {meal.notes}
                  </div>
                )}
              </div>
            ))}

            {/* Daily totals */}
            <p style={{...s.sectionTitle, marginTop:16}}>Daily Totals</p>
            <div style={s.card}>
              {/* Macros totals */}
              <div style={{ fontSize:"0.72rem", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em", color:COLORS.textSec, marginBottom:8 }}>Macros</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:6, marginBottom:14 }}>
                {MACRO_COLS.map(m => (
                  <div key={m.key} style={{ background:COLORS.mist, borderRadius:8, padding:"8px 6px", textAlign:"center" }}>
                    <div style={{ fontFamily:"monospace", fontSize:"0.9rem", fontWeight:600, color:COLORS.tealDeep }}>{fmt(totals[m.key])}</div>
                    <div style={{ fontSize:"0.62rem", color:COLORS.textSec, marginTop:1 }}>{m.label}{m.unit?` (${m.unit})`:""}</div>
                  </div>
                ))}
              </div>

              {/* Micros totals */}
              <div style={{ fontSize:"0.72rem", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em", color:COLORS.textSec, marginBottom:8 }}>Thyroid Micros</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:6 }}>
                {MICRO_COLS.map(m => (
                  <div key={m.key} style={{ background: m.thyroid?COLORS.tealPale:COLORS.mist, borderRadius:8, padding:"8px 6px", textAlign:"center", border: m.thyroid?`1px solid ${COLORS.tealLight}`:"none" }}>
                    <div style={{ fontFamily:"monospace", fontSize:"0.85rem", fontWeight:600, color:COLORS.tealDeep }}>{fmt(totals[m.key])}</div>
                    <div style={{ fontSize:"0.62rem", color:COLORS.textSec, marginTop:1 }}>{m.label} ({m.unit})</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )
      }
    </div>
  );
}


// ── WELLNESS TRACKING ─────────────────────────────────────────────────────────
function WellnessTracker({ wellnessLog, onSave, onDeleteEntry }) {
  const [wellDate, setWellDate] = useState(today());
  const existingEntry = wellnessLog.find(e => e.date === wellDate) || {};
  const [form, setForm] = useState({
    heartRate: "", coldSensitivity: null, sleepHours: "",
    wokeUp: false, wokeUpTimes: "", mood: null, anxiety: null, stress: null, notes: "",
  });

  // When date changes, load that day's existing entry
  useEffect(() => {
    const entry = wellnessLog.find(e => e.date === wellDate) || {};
    setForm({
      heartRate: entry.heartRate || "",
      coldSensitivity: entry.coldSensitivity || null,
      sleepHours: entry.sleepHours || "",
      wokeUp: entry.wokeUp || false,
      wokeUpTimes: entry.wokeUpTimes || "",
      mood: entry.mood || null,
      anxiety: entry.anxiety || null,
      stress: entry.stress || null,
      notes: entry.notes || "",
    });
  }, [wellDate, wellnessLog.length]);

  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const save = () => {
    onSave({ id: existingEntry.id || Date.now(), date: wellDate, ...form });
    alert("Wellness check-in saved!");
  };

  const ScaleSelector = ({ label, value, onChange, color, low, high }) => (
    <div style={{ marginBottom:12 }}>
      <label style={s.label}>{label}</label>
      <div style={{ display:"flex", justifyContent:"space-between", gap:4 }}>
        {[1,2,3,4,5,6,7,8,9,10].map(n => (
          <div key={n} onClick={()=>onChange(n)} style={{
            flex:1, height:34, borderRadius:6, display:"flex", alignItems:"center",
            justifyContent:"center", fontSize:"0.72rem", fontWeight:500, cursor:"pointer",
            fontFamily:"monospace",
            background: value===n ? color : COLORS.mist,
            color: value===n ? "white" : COLORS.textSec,
            border: `1.5px solid ${value===n ? color : COLORS.divider}`,
            transition:"all 0.15s"
          }}>{n}</div>
        ))}
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:"0.64rem", color:COLORS.textSec, marginTop:3 }}>
        <span>{low}</span><span>{high}</span>
      </div>
    </div>
  );

  return (
    <div>
      <p style={s.sectionTitle}>Daily Wellness Check-in</p>

    <div style={{ ...s.card, padding:"10px 14px", marginBottom:10, background:COLORS.tealPale, borderColor:COLORS.tealLight }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <span style={{ fontSize:"0.8rem", fontWeight:600, color:COLORS.tealDeep, whiteSpace:"nowrap" }}>📅 Logging for:</span>
        <input type="date" style={{ ...s.input, flex:1, borderColor:COLORS.tealLight }}
          value={wellDate} onChange={e=>setWellDate(e.target.value)} max={today()}/>
        {wellDate !== today() && <span style={{ fontSize:"0.72rem", background:COLORS.amber, color:"white", borderRadius:6, padding:"2px 8px", whiteSpace:"nowrap" }}>Past date</span>}
        {wellnessLog.find(e=>e.date===wellDate) && <span style={{ fontSize:"0.72rem", background:COLORS.sage, color:"white", borderRadius:6, padding:"2px 8px", whiteSpace:"nowrap" }}>✓ Logged</span>}
      </div>
    </div>

      <div style={s.card}>
        {/* Heart Rate */}
        <div style={s.formGroup}>
          <label style={s.label}>❤️ Heart Rate (bpm)</label>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <input type="number" style={{...s.input, width:100}} value={form.heartRate}
              onChange={e=>set("heartRate",e.target.value)} placeholder="e.g. 72" min="40" max="200"/>
            <span style={{ fontSize:"0.76rem", color:COLORS.textSec }}>
              {form.heartRate ? (form.heartRate < 60 ? "⚠️ Low" : form.heartRate > 100 ? "⚠️ High" : "✅ Normal") : ""}
            </span>
          </div>
        </div>

        {/* Cold Sensitivity */}
        <div style={s.formGroup}>
          <label style={s.label}>🥶 Cold Sensitivity today</label>
          <div style={{ display:"flex", gap:8 }}>
            {["None","Mild","Moderate","Severe"].map(level => (
              <button key={level} onClick={()=>set("coldSensitivity",level)}
                style={{ flex:1, padding:"7px 4px", borderRadius:8, border:`1.5px solid ${form.coldSensitivity===level?COLORS.tealMid:COLORS.divider}`,
                  background: form.coldSensitivity===level?COLORS.tealPale:"white",
                  color: form.coldSensitivity===level?COLORS.tealDeep:COLORS.textSec,
                  fontSize:"0.72rem", fontWeight:500, cursor:"pointer", fontFamily:"inherit" }}>
                {level}
              </button>
            ))}
          </div>
        </div>

        {/* Sleep */}
        <div style={s.formRow}>
          <div style={s.formGroup}>
            <label style={s.label}>😴 Hours slept</label>
            <input type="number" style={s.input} value={form.sleepHours}
              onChange={e=>set("sleepHours",e.target.value)} placeholder="e.g. 7.5" min="0" max="24" step="0.5"/>
          </div>
          <div style={s.formGroup}>
            <label style={s.label}>🌙 Woke up during night?</label>
            <div style={{ display:"flex", gap:8, marginTop:4 }}>
              {["No","Yes"].map(v => (
                <button key={v} onClick={()=>set("wokeUp", v==="Yes")}
                  style={{ flex:1, padding:"9px", borderRadius:8,
                    border:`1.5px solid ${form.wokeUp===(v==="Yes")?COLORS.tealMid:COLORS.divider}`,
                    background: form.wokeUp===(v==="Yes")?COLORS.tealPale:"white",
                    color: form.wokeUp===(v==="Yes")?COLORS.tealDeep:COLORS.textSec,
                    fontSize:"0.82rem", fontWeight:500, cursor:"pointer", fontFamily:"inherit" }}>
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>

        {form.wokeUp && (
          <div style={s.formGroup}>
            <label style={s.label}>How many times?</label>
            <input type="number" style={{...s.input, width:80}} value={form.wokeUpTimes}
              onChange={e=>set("wokeUpTimes",e.target.value)} placeholder="e.g. 2" min="1" max="10"/>
          </div>
        )}

        {/* Mood */}
        <ScaleSelector label="😊 Mood" value={form.mood} onChange={v=>set("mood",v)}
          color={COLORS.tealMid} low="Very low" high="Excellent"/>

        {/* Anxiety */}
        <ScaleSelector label="😰 Anxiety level" value={form.anxiety} onChange={v=>set("anxiety",v)}
          color={COLORS.amber} low="None" high="Severe"/>

        {/* Stress */}
        <ScaleSelector label="😤 Stress level" value={form.stress} onChange={v=>set("stress",v)}
          color={COLORS.coral} low="None" high="Extreme"/>

        <div style={s.formGroup}>
          <label style={s.label}>Notes</label>
          <textarea style={s.textarea} value={form.notes} onChange={e=>set("notes",e.target.value)}
            placeholder="e.g. Felt groggy in the morning, anxious after coffee..."/>
        </div>

        <button style={s.btnPrimary} onClick={save}>Save Check-in</button>
      </div>

      {/* History */}
      {wellnessLog.length > 0 && (
        <div>
          <p style={{...s.sectionTitle, marginTop:16}}>Recent History</p>
          {[...wellnessLog].sort((a,b)=>b.date>a.date?1:-1).slice(0,7).map(e => (
            <div key={e.id} style={{...s.card, marginBottom:10}}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <span style={{ fontFamily:"Georgia,serif", fontSize:"0.9rem", color:COLORS.tealDeep }}>{dateLabel(e.date)}</span>
                <button onClick={()=>onDeleteEntry(e.id)} style={{ background:"none", border:"none", color:COLORS.divider, cursor:"pointer", fontSize:"0.9rem" }}>✕</button>
              </div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {e.heartRate && <span style={{ background:COLORS.coralPale, color:COLORS.coral, borderRadius:20, padding:"3px 10px", fontSize:"0.73rem" }}>❤️ {e.heartRate} bpm</span>}
                {e.sleepHours && <span style={{ background:COLORS.tealPale, color:COLORS.tealDeep, borderRadius:20, padding:"3px 10px", fontSize:"0.73rem" }}>😴 {e.sleepHours}h sleep{e.wokeUp?` (woke ${e.wokeUpTimes||""}x)`:""}</span>}
                {e.coldSensitivity && e.coldSensitivity!=="None" && <span style={{ background:"#e8f0ff", color:"#3a5a9a", borderRadius:20, padding:"3px 10px", fontSize:"0.73rem" }}>🥶 {e.coldSensitivity}</span>}
                {e.mood && <span style={{ background:COLORS.sagePale, color:COLORS.sage, borderRadius:20, padding:"3px 10px", fontSize:"0.73rem" }}>😊 Mood {e.mood}/10</span>}
                {e.anxiety && <span style={{ background:COLORS.amberPale, color:COLORS.amber, borderRadius:20, padding:"3px 10px", fontSize:"0.73rem" }}>😰 Anxiety {e.anxiety}/10</span>}
                {e.stress && <span style={{ background:COLORS.coralPale, color:COLORS.coral, borderRadius:20, padding:"3px 10px", fontSize:"0.73rem" }}>😤 Stress {e.stress}/10</span>}
              </div>
              {e.notes && <p style={{ fontSize:"0.74rem", color:COLORS.textSec, marginTop:6, fontStyle:"italic" }}>📝 {e.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── LAB RESULTS ───────────────────────────────────────────────────────────────
const THYROID_LABS = [
  { key:"tsh",   label:"TSH",      unit:"mIU/L",  normal:"0.4 – 4.0",  low:0.4,  high:4.0  },
  { key:"ft4",   label:"Free T4",  unit:"ng/dL",  normal:"0.8 – 1.8",  low:0.8,  high:1.8  },
  { key:"ft3",   label:"Free T3",  unit:"pg/mL",  normal:"2.3 – 4.2",  low:2.3,  high:4.2  },
  { key:"tpo",   label:"TPO Ab",   unit:"IU/mL",  normal:"< 35",       low:0,    high:35   },
];

const METABOLIC_LABS = [
  { key:"glucose",  label:"Glucose",     unit:"mg/dL", normal:"70 – 99",   low:70,   high:99   },
  { key:"cholTotal",label:"Cholesterol", unit:"mg/dL", normal:"< 200",     low:0,    high:200  },
  { key:"hdl",      label:"HDL",         unit:"mg/dL", normal:"> 40",      low:40,   high:999  },
  { key:"ldl",      label:"LDL",         unit:"mg/dL", normal:"< 100",     low:0,    high:100  },
  { key:"trigly",   label:"Triglycerides",unit:"mg/dL",normal:"< 150",     low:0,    high:150  },
  { key:"sodium",   label:"Sodium",      unit:"mEq/L", normal:"136 – 145", low:136,  high:145  },
  { key:"potassium",label:"Potassium",   unit:"mEq/L", normal:"3.5 – 5.0", low:3.5,  high:5.0  },
  { key:"creatinine",label:"Creatinine", unit:"mg/dL", normal:"0.6 – 1.2", low:0.6,  high:1.2  },
  { key:"bun",      label:"BUN",         unit:"mg/dL", normal:"7 – 20",    low:7,    high:20   },
  { key:"alt",      label:"ALT",         unit:"U/L",   normal:"7 – 56",    low:7,    high:56   },
  { key:"ast",      label:"AST",         unit:"U/L",   normal:"10 – 40",   low:10,   high:40   },
  { key:"psa",      label:"PSA",         unit:"ng/mL", normal:"< 4.0",     low:0,    high:4.0  },
];

function LabResults({ labLog, onSave, onDelete }) {
  const [date, setDate] = useState(today());
  const [labType, setLabType] = useState("thyroid");
  const [values, setValues] = useState({});
  const [notes, setNotes] = useState("");

  const setV = (k,v) => setValues(prev=>({...prev,[k]:v}));

  const save = () => {
    const hasValues = Object.values(values).some(v=>v!=="");
    if (!hasValues) { alert("Please enter at least one lab value."); return; }
    onSave({ id:Date.now(), date, labType, values:{...values}, notes });
    setValues({}); setNotes("");
    alert("Lab results saved!");
  };

  const labs = labType==="thyroid" ? THYROID_LABS : METABOLIC_LABS;

  const getStatus = (lab, val) => {
    const n = parseFloat(val);
    if (isNaN(n)) return null;
    if (lab.key==="hdl") return n >= lab.low ? "normal" : "low";
    if (lab.key==="tpo") return n < lab.high ? "normal" : "high";
    if (n < lab.low) return "low";
    if (n > lab.high) return "high";
    return "normal";
  };

  const statusColor = (status) => status==="normal" ? COLORS.sage : status==="low" ? "#3a5aaa" : COLORS.coral;
  const statusBg = (status) => status==="normal" ? COLORS.sagePale : status==="low" ? "#e8f0ff" : COLORS.coralPale;

  return (
    <div>
      <p style={s.sectionTitle}>Lab Results</p>

      <div style={s.card}>
        <div style={s.formRow}>
          <div style={s.formGroup}>
            <label style={s.label}>Date of labs</label>
            <input type="date" style={s.input} value={date} onChange={e=>setDate(e.target.value)}/>
          </div>
          <div style={s.formGroup}>
            <label style={s.label}>Lab type</label>
            <select style={s.select} value={labType} onChange={e=>setLabType(e.target.value)}>
              <option value="thyroid">Thyroid Panel</option>
              <option value="metabolic">Metabolic Panel</option>
            </select>
          </div>
        </div>

        {labs.map(lab => {
          const status = getStatus(lab, values[lab.key]);
          return (
            <div key={lab.key} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
              <div style={{ flex:1 }}>
                <label style={s.label}>{lab.label} <span style={{ fontWeight:400, color:COLORS.textSec }}>({lab.unit})</span></label>
                <input type="number" style={s.input} value={values[lab.key]||""}
                  onChange={e=>setV(lab.key,e.target.value)} placeholder={`Normal: ${lab.normal}`} step="0.01"/>
              </div>
              {status && (
                <div style={{ background:statusBg(status), color:statusColor(status), borderRadius:8,
                  padding:"4px 10px", fontSize:"0.72rem", fontWeight:600, whiteSpace:"nowrap", marginTop:18 }}>
                  {status==="normal"?"✅ Normal":status==="low"?"⬇ Low":"⬆ High"}
                </div>
              )}
            </div>
          );
        })}

        <div style={s.formGroup}>
          <label style={s.label}>Notes</label>
          <textarea style={s.textarea} value={notes} onChange={e=>setNotes(e.target.value)}
            placeholder="e.g. Doctor said TSH is improving, recheck in 3 months..."/>
        </div>
        <button style={s.btnPrimary} onClick={save}>Save Lab Results</button>
      </div>

      {/* History */}
      {labLog.length > 0 && (
        <div>
          <p style={{...s.sectionTitle, marginTop:16}}>Lab History</p>
          {[...labLog].sort((a,b)=>b.date>a.date?1:-1).map(entry => {
            const labDefs = entry.labType==="thyroid" ? THYROID_LABS : METABOLIC_LABS;
            return (
              <div key={entry.id} style={{...s.card, marginBottom:10}}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                  <div>
                    <span style={{ fontFamily:"Georgia,serif", fontSize:"0.9rem", color:COLORS.tealDeep }}>{dateLabel(entry.date)}</span>
                    <span style={{ marginLeft:8, background:entry.labType==="thyroid"?COLORS.tealPale:COLORS.amberPale,
                      color:entry.labType==="thyroid"?COLORS.tealDeep:COLORS.amber,
                      borderRadius:4, padding:"1px 8px", fontSize:"0.72rem", fontWeight:500 }}>
                      {entry.labType==="thyroid"?"🦋 Thyroid Panel":"🧪 Metabolic Panel"}
                    </span>
                  </div>
                  <button onClick={()=>onDelete(entry.id)} style={{ background:"none", border:"none", color:COLORS.divider, cursor:"pointer", fontSize:"0.9rem" }}>✕</button>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6 }}>
                  {labDefs.filter(l=>entry.values[l.key]).map(lab => {
                    const status = (() => {
                      const n = parseFloat(entry.values[lab.key]);
                      if(isNaN(n)) return null;
                      if(lab.key==="hdl") return n>=lab.low?"normal":"low";
                      if(lab.key==="tpo") return n<lab.high?"normal":"high";
                      if(n<lab.low) return "low";
                      if(n>lab.high) return "high";
                      return "normal";
                    })();
                    return (
                      <div key={lab.key} style={{ background:status?statusBg(status):COLORS.mist, borderRadius:8, padding:"8px 10px" }}>
                        <div style={{ fontSize:"0.68rem", color:COLORS.textSec, marginBottom:2 }}>{lab.label}</div>
                        <div style={{ fontFamily:"monospace", fontSize:"0.9rem", fontWeight:600, color:status?statusColor(status):COLORS.ink }}>
                          {entry.values[lab.key]} <span style={{ fontSize:"0.62rem", fontWeight:400 }}>{lab.unit}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {entry.notes && <p style={{ fontSize:"0.74rem", color:COLORS.textSec, marginTop:8, fontStyle:"italic" }}>📝 {entry.notes}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


// ── WEEKLY NUTRIENT DASHBOARD ─────────────────────────────────────────────────
function WeeklyDashboard({ logs }) {
  const [weekOffset, setWeekOffset] = useState(0);

  // Get 7 days for the selected week
  const getDays = () => {
    const days = [];
    const now = new Date();
    now.setDate(now.getDate() - (weekOffset * 7));
    // Start from Monday
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(monday.getDate() + diff);
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      days.push({ dateStr, label: d.toLocaleDateString("en-US",{weekday:"short"}), dayNum: d.getDate() });
    }
    return days;
  };

  const days = getDays();

  // Get supplement nutrients for a day
  const getDayTotals = (dateStr) => {
    const dayLogs = logs.filter(l => l.date === dateStr);
    const totals = Object.fromEntries(NUTRIENT_KEYS.map(k => [k, 0]));
    dayLogs.filter(l => l.type === "meal").forEach(l => {
      NUTRIENT_KEYS.forEach(k => { totals[k] += l.nutrients?.[k] || 0; });
    });
    dayLogs.filter(l => l.type === "vit").forEach(l => {
      const n = suppNutrients(l.name, l.dose);
      Object.entries(n).forEach(([k,v]) => { if (totals[k] !== undefined) totals[k] += v; });
    });
    return totals;
  };

  const allTotals = days.map(d => getDayTotals(d.dateStr));

  // Weekly averages
  const weeklyAvg = Object.fromEntries(NUTRIENT_KEYS.map(k => [
    k, Math.round((allTotals.reduce((sum, t) => sum + (t[k]||0), 0) / 7) * 10) / 10
  ]));

  const NUTRIENT_GROUPS = [
    { label:"Macros", keys:[
      {key:"calories", label:"Calories", unit:""},
      {key:"protein",  label:"Protein",  unit:"g"},
      {key:"carbs",    label:"Carbs",    unit:"g"},
      {key:"fat",      label:"Fat",      unit:"g"},
      {key:"fiber",    label:"Fiber",    unit:"g"},
      {key:"water",    label:"Water",    unit:"cups"},
    ]},
    { label:"Thyroid Micros ★", keys:[
      {key:"selenium",  label:"Selenium",  unit:"mcg"},
      {key:"iodine",    label:"Iodine",    unit:"mcg"},
      {key:"zinc",      label:"Zinc",      unit:"mg"},
      {key:"iron",      label:"Iron",      unit:"mg"},
      {key:"vitd",      label:"Vit D",     unit:"IU"},
      {key:"magnesium", label:"Magnesium", unit:"mg"},
      {key:"vitk",      label:"Vit K",     unit:"mcg"},
      {key:"b12",       label:"B12",       unit:"mcg"},
    ]},
  ];

  const getCellColor = (key, value) => {
    const goal = DEFAULT_GOALS[key] || 1;
    const pct = value / goal;
    if (pct === 0) return { bg:"transparent", color:COLORS.divider };
    if (pct >= 0.9) return { bg:"#d4edda", color:"#2d6a3f" };
    if (pct >= 0.5) return { bg:COLORS.amberPale, color:"#7a4a10" };
    return { bg:COLORS.coralPale, color:COLORS.coral };
  };

  const fmt = (v) => {
    if (!v || v === 0) return "—";
    return Number.isInteger(v) ? v : parseFloat(v.toFixed(1));
  };

  const weekLabel = weekOffset === 0 ? "This Week" : weekOffset === 1 ? "Last Week" : `${weekOffset} weeks ago`;

  return (
    <div>
      <p style={s.sectionTitle}>Weekly Nutrient Dashboard</p>

      {/* Week navigation */}
      <div style={{ ...s.card, padding:"10px 14px", marginBottom:14 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <button onClick={()=>setWeekOffset(w=>w+1)}
            style={{ background:"none", border:`1px solid ${COLORS.divider}`, borderRadius:8, width:34, height:34, cursor:"pointer", fontSize:"1rem", color:COLORS.tealMid }}>‹</button>
          <span style={{ fontFamily:"Georgia,serif", fontSize:"0.95rem", color:COLORS.tealDeep }}>{weekLabel}</span>
          <button onClick={()=>setWeekOffset(w=>Math.max(0,w-1))}
            style={{ background:"none", border:`1px solid ${COLORS.divider}`, borderRadius:8, width:34, height:34, cursor:"pointer", fontSize:"1rem", color: weekOffset===0?COLORS.divider:COLORS.tealMid }}
            disabled={weekOffset===0}>›</button>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display:"flex", gap:12, marginBottom:12, flexWrap:"wrap" }}>
        {[
          {color:"#d4edda", textColor:"#2d6a3f", label:"≥ 90% of goal"},
          {color:COLORS.amberPale, textColor:"#7a4a10", label:"50–89%"},
          {color:COLORS.coralPale, textColor:COLORS.coral, label:"< 50%"},
          {color:"transparent", textColor:COLORS.divider, label:"Not logged"},
        ].map(({color,textColor,label})=>(
          <div key={label} style={{ display:"flex", alignItems:"center", gap:5, fontSize:"0.7rem", color:COLORS.textSec }}>
            <div style={{ width:14, height:14, borderRadius:3, background:color, border:`1px solid ${COLORS.divider}` }}/>
            {label}
          </div>
        ))}
      </div>

      {NUTRIENT_GROUPS.map(group => (
        <div key={group.label} style={{ marginBottom:16 }}>
          <p style={{ fontSize:"0.76rem", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em", color:COLORS.textSec, marginBottom:8 }}>
            {group.label}
          </p>
          <div style={{ ...s.card, padding:0, overflow:"hidden" }}>
            {/* Header row */}
            <div style={{ display:"grid", gridTemplateColumns:"90px repeat(7,1fr) 70px", background:COLORS.tealDeep }}>
              <div style={{ padding:"8px 10px", fontSize:"0.68rem", fontWeight:700, color:"rgba(255,255,255,0.7)", textTransform:"uppercase" }}>Nutrient</div>
              {days.map(d => (
                <div key={d.dateStr} style={{ padding:"8px 4px", textAlign:"center", fontSize:"0.7rem", fontWeight:600, color:"white" }}>
                  <div>{d.label}</div>
                  <div style={{ fontSize:"0.65rem", opacity:0.7 }}>{d.dayNum}</div>
                </div>
              ))}
              <div style={{ padding:"8px 6px", textAlign:"center", fontSize:"0.68rem", fontWeight:700, color:"rgba(255,255,255,0.7)", textTransform:"uppercase" }}>Avg</div>
            </div>

            {/* Data rows */}
            {group.keys.map((nutrient, ni) => (
              <div key={nutrient.key} style={{ display:"grid", gridTemplateColumns:"90px repeat(7,1fr) 70px", borderTop:`1px solid ${COLORS.divider}`, background: ni%2===0?"white":COLORS.mist }}>
                <div style={{ padding:"7px 10px", fontSize:"0.72rem", fontWeight:600, color:COLORS.ink, display:"flex", flexDirection:"column", justifyContent:"center" }}>
                  <span>{nutrient.label}</span>
                  <span style={{ fontSize:"0.62rem", color:COLORS.textSec, fontWeight:400 }}>{nutrient.unit}</span>
                </div>
                {allTotals.map((dayTotal, di) => {
                  const val = dayTotal[nutrient.key] || 0;
                  const {bg, color} = getCellColor(nutrient.key, val);
                  return (
                    <div key={di} style={{ padding:"7px 4px", textAlign:"center", background:bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <span style={{ fontFamily:"monospace", fontSize:"0.72rem", fontWeight:500, color }}>{fmt(val)}</span>
                    </div>
                  );
                })}
                {/* Average */}
                <div style={{ padding:"7px 6px", textAlign:"center", background:COLORS.tealPale, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <span style={{ fontFamily:"monospace", fontSize:"0.72rem", fontWeight:600, color:COLORS.tealDeep }}>{fmt(weeklyAvg[nutrient.key])}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Weekly summary cards */}
      <p style={{...s.sectionTitle, marginTop:4}}>Weekly Highlights</p>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
        {[
          {key:"selenium", label:"Avg Selenium", unit:"mcg", icon:"🦋"},
          {key:"iodine",   label:"Avg Iodine",   unit:"mcg", icon:"🌊"},
          {key:"protein",  label:"Avg Protein",  unit:"g",   icon:"💪"},
          {key:"vitd",     label:"Avg Vitamin D", unit:"IU", icon:"☀️"},
        ].map(({key,label,unit,icon}) => {
          const avg = weeklyAvg[key];
          const goal = DEFAULT_GOALS[key]||1;
          const pct = Math.min(100, Math.round((avg/goal)*100));
          return (
            <div key={key} style={s.card}>
              <div style={{ fontSize:"0.7rem", color:COLORS.textSec, marginBottom:4 }}>{icon} {label}</div>
              <div style={{ fontFamily:"monospace", fontSize:"1.1rem", fontWeight:600, color:COLORS.tealDeep, marginBottom:6 }}>
                {fmt(avg)} <span style={{ fontSize:"0.65rem", fontWeight:400 }}>{unit}</span>
              </div>
              <div style={{ height:5, background:COLORS.mist, borderRadius:3, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${pct}%`, background: pct>=90?COLORS.sage: pct>=50?COLORS.amber:COLORS.coral, borderRadius:3 }}/>
              </div>
              <div style={{ fontSize:"0.65rem", color:COLORS.textSec, marginTop:3 }}>{pct}% of daily goal avg</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


// ── WEEKLY WELLNESS DASHBOARD ─────────────────────────────────────────────────
function WeeklyWellness({ logs, wellnessLog }) {
  const [weekOffset, setWeekOffset] = useState(0);

  const getDays = () => {
    const days = [];
    const now = new Date();
    now.setDate(now.getDate() - (weekOffset * 7));
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(monday.getDate() + diff);
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      days.push({ dateStr, label: d.toLocaleDateString("en-US",{weekday:"short"}), dayNum: d.getDate() });
    }
    return days;
  };

  const days = getDays();
  const weekLabel = weekOffset === 0 ? "This Week" : weekOffset === 1 ? "Last Week" : `${weekOffset} weeks ago`;

  // Get wellness entry for each day
  const getWellness = (dateStr) => wellnessLog.find(e => e.date === dateStr) || null;
  // Get symptom entry for each day
  const getSymptoms = (dateStr) => logs.find(l => l.type === "symptom" && l.date === dateStr) || null;

  const ALL_SYMPTOMS = [
    {key:"fatigue",         emoji:"😴", label:"Fatigue"},
    {key:"brain fog",       emoji:"🌫️", label:"Brain Fog"},
    {key:"cold sensitivity",emoji:"🥶", label:"Cold"},
    {key:"anxiety",         emoji:"😰", label:"Anxiety"},
    {key:"mood swings",     emoji:"🎭", label:"Mood"},
    {key:"hair loss",       emoji:"💇", label:"Hair Loss"},
    {key:"dry skin",        emoji:"🌵", label:"Dry Skin"},
    {key:"constipation",    emoji:"🐌", label:"Constip."},
    {key:"bloated",         emoji:"🫃", label:"Bloated"},
    {key:"palpitations",    emoji:"💓", label:"Palpit."},
    {key:"insomnia",        emoji:"🌙", label:"Insomnia"},
    {key:"weight gain",     emoji:"⚖️", label:"Wt. Gain"},
    {key:"good day",        emoji:"✨", label:"Good Day"},
  ];

  // Compute weekly stats
  const wellnessDays = days.map(d => getWellness(d.dateStr));
  const symptomDays  = days.map(d => getSymptoms(d.dateStr));

 const avgEnergy  = (() => { const v = symptomDays.filter(s=>s?.energy).map(s=>s.energy); return v.length ? (v.reduce((a,b)=>a+b,0)/v.length).toFixed(1) : null; })();
  const avgMood    = (() => { const v = wellnessDays.filter(w=>w?.mood).map(w=>w.mood);     return v.length ? (v.reduce((a,b)=>a+b,0)/v.length).toFixed(1) : null; })();
  const avgAnxiety = (() => { const v = wellnessDays.filter(w=>w?.anxiety).map(w=>w.anxiety); return v.length ? (v.reduce((a,b)=>a+b,0)/v.length).toFixed(1) : null; })();
  const avgStress  = (() => { const v = wellnessDays.filter(w=>w?.stress).map(w=>w.stress);   return v.length ? (v.reduce((a,b)=>a+b,0)/v.length).toFixed(1) : null; })();
  const avgSleep   = (() => { const v = wellnessDays.filter(w=>w?.sleepHours).map(w=>parseFloat(w.sleepHours)); return v.length ? (v.reduce((a,b)=>a+b,0)/v.length).toFixed(1) : null; })();

  const bestDay = (() => {
    let best = null, bestScore = -1;
    days.forEach((d,i) => {
      const w = wellnessDays[i]; const s = symptomDays[i];
      if (!w && !s) return;
      const energy = w?.energy||5; const mood = w?.mood||5;
      const anxiety = w?.anxiety||5; const stress = w?.stress||5;
      const symCount = s?.symptoms?.filter(x=>x!=="good day").length||0;
      const score = (energy + mood + (10-anxiety) + (10-stress)) / 4 - symCount;
      if (score > bestScore) { bestScore = score; best = d; }
    });
    return best;
  })();

  const hardestDay = (() => {
    let worst = null, worstScore = 999;
    days.forEach((d,i) => {
      const w = wellnessDays[i]; const s = symptomDays[i];
      if (!w && !s) return;
      const energy = w?.energy||5; const mood = w?.mood||5;
      const anxiety = w?.anxiety||5; const stress = w?.stress||5;
      const symCount = s?.symptoms?.filter(x=>x!=="good day").length||0;
      const score = (energy + mood + (10-anxiety) + (10-stress)) / 4 - symCount;
      if (score < worstScore) { worstScore = score; worst = d; }
    });
    return worst;
  })();

  // Most frequent symptoms
  const symptomCounts = {};
  symptomDays.forEach(s => {
    s?.symptoms?.forEach(sym => {
      if (sym !== "good day") symptomCounts[sym] = (symptomCounts[sym]||0) + 1;
    });
  });
  const topSymptoms = Object.entries(symptomCounts).sort((a,b)=>b[1]-a[1]).slice(0,4);

  const barColor = (val, max, inverse=false) => {
    if (!val) return COLORS.divider;
    const pct = val / max;
    if (inverse) return pct > 0.7 ? COLORS.coral : pct > 0.4 ? COLORS.amber : COLORS.sage;
    return pct >= 0.7 ? COLORS.sage : pct >= 0.4 ? COLORS.amber : COLORS.coral;
  };

  return (
    <div>
      <p style={s.sectionTitle}>Weekly Wellness Overview</p>

      {/* Week navigation */}
      <div style={{ ...s.card, padding:"10px 14px", marginBottom:14 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <button onClick={()=>setWeekOffset(w=>w+1)}
            style={{ background:"none", border:`1px solid ${COLORS.divider}`, borderRadius:8, width:34, height:34, cursor:"pointer", fontSize:"1rem", color:COLORS.tealMid }}>‹</button>
          <span style={{ fontFamily:"Georgia,serif", fontSize:"0.95rem", color:COLORS.tealDeep }}>{weekLabel}</span>
          <button onClick={()=>setWeekOffset(w=>Math.max(0,w-1))}
            style={{ background:"none", border:`1px solid ${COLORS.divider}`, borderRadius:8, width:34, height:34, cursor:"pointer", fontSize:"1rem", color: weekOffset===0?COLORS.divider:COLORS.tealMid }}
            disabled={weekOffset===0}>›</button>
        </div>
      </div>

      {/* Weekly summary cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:14 }}>
        {[
          {label:"Avg Energy",  val:avgEnergy,  max:10, icon:"⚡", inverse:false},
          {label:"Avg Mood",    val:avgMood,    max:10, icon:"😊", inverse:false},
          {label:"Avg Anxiety", val:avgAnxiety, max:10, icon:"😰", inverse:true},
          {label:"Avg Stress",  val:avgStress,  max:10, icon:"😤", inverse:true},
          {label:"Avg Sleep",   val:avgSleep,   max:10, icon:"😴", inverse:false},
        ].map(item => (
          <div key={item.label} style={{ ...s.card, textAlign:"center", padding:"10px 8px", marginBottom:0 }}>
            <div style={{ fontSize:"1rem", marginBottom:4 }}>{item.icon}</div>
            <div style={{ fontFamily:"monospace", fontSize:"1.1rem", fontWeight:600,
              color: item.val ? barColor(item.val, item.max, item.inverse) : COLORS.divider }}>
              {item.val || "—"}
            </div>
            <div style={{ fontSize:"0.64rem", color:COLORS.textSec, marginTop:2 }}>{item.label}</div>
          </div>
        ))}
        {bestDay && (
          <div style={{ ...s.card, textAlign:"center", padding:"10px 8px", marginBottom:0, background:COLORS.sagePale, borderColor:COLORS.sage }}>
            <div style={{ fontSize:"1rem", marginBottom:4 }}>✨</div>
            <div style={{ fontSize:"0.82rem", fontWeight:600, color:COLORS.sage }}>{bestDay.label} {bestDay.dayNum}</div>
            <div style={{ fontSize:"0.64rem", color:COLORS.textSec, marginTop:2 }}>Best Day</div>
          </div>
        )}
        {hardestDay && bestDay?.dateStr !== hardestDay?.dateStr && (
          <div style={{ ...s.card, textAlign:"center", padding:"10px 8px", marginBottom:0, background:COLORS.coralPale, borderColor:COLORS.coral }}>
            <div style={{ fontSize:"1rem", marginBottom:4 }}>💙</div>
            <div style={{ fontSize:"0.82rem", fontWeight:600, color:COLORS.coral }}>{hardestDay.label} {hardestDay.dayNum}</div>
            <div style={{ fontSize:"0.64rem", color:COLORS.textSec, marginTop:2 }}>Hardest Day</div>
          </div>
        )}
      </div>

      {/* Daily bar charts */}
      <p style={s.sectionTitle}>Daily Trends</p>
      <div style={s.card}>
        {[
          {label:"Energy",  key:"energy",     max:10, inverse:false, icon:"⚡"},
          {label:"Mood",    key:"mood",        max:10, inverse:false, icon:"😊"},
          {label:"Anxiety", key:"anxiety",     max:10, inverse:true,  icon:"😰"},
          {label:"Stress",  key:"stress",      max:10, inverse:true,  icon:"😤"},
          {label:"Sleep hrs",key:"sleepHours", max:10, inverse:false, icon:"😴"},
          {label:"Heart Rate",key:"heartRate", max:120,inverse:false, icon:"❤️"},
        ].map((metric, mi) => (
          <div key={metric.key} style={{ marginBottom: mi < 5 ? 14 : 0 }}>
            <div style={{ fontSize:"0.72rem", fontWeight:600, color:COLORS.textSec, marginBottom:6 }}>
              {metric.icon} {metric.label}
            </div>
            <div style={{ display:"flex", gap:4, alignItems:"flex-end", height:50 }}>
                           {days.map((d,i) => {
                const w = metric.key === "energy" ? symptomDays[i] : wellnessDays[i];
                const rawVal = metric.key === "heartRate" || metric.key === "sleepHours"
                  ? parseFloat(w?.[metric.key]) || 0
                  : w?.[metric.key] || 0;
                const pct = Math.min(100, (rawVal / metric.max) * 100);
                const color = rawVal ? barColor(rawVal, metric.max, metric.inverse) : COLORS.divider;
                return (
                  <div key={d.dateStr} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                    <div style={{ fontSize:"0.62rem", fontFamily:"monospace", color: rawVal ? COLORS.ink : COLORS.divider }}>
                      {rawVal || ""}
                    </div>
                    <div style={{ width:"100%", height:36, background:COLORS.mist, borderRadius:4, overflow:"hidden", display:"flex", alignItems:"flex-end" }}>
                      <div style={{ width:"100%", height:`${pct}%`, background:color, borderRadius:4, minHeight: rawVal?2:0, transition:"height 0.3s" }}/>
                    </div>
                    <div style={{ fontSize:"0.62rem", color:COLORS.textSec }}>{d.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Symptom heatmap */}
      <p style={{...s.sectionTitle, marginTop:16}}>Symptom Heatmap</p>
      <div style={{ ...s.card, padding:0, overflow:"hidden" }}>
        {/* Header */}
        <div style={{ display:"grid", gridTemplateColumns:"90px repeat(7,1fr)", background:COLORS.tealDeep }}>
          <div style={{ padding:"8px 10px", fontSize:"0.68rem", fontWeight:700, color:"rgba(255,255,255,0.7)" }}>Symptom</div>
          {days.map(d => (
            <div key={d.dateStr} style={{ padding:"8px 4px", textAlign:"center", fontSize:"0.7rem", fontWeight:600, color:"white" }}>
              <div>{d.label}</div>
              <div style={{ fontSize:"0.62rem", opacity:0.7 }}>{d.dayNum}</div>
            </div>
          ))}
        </div>
        {ALL_SYMPTOMS.map((sym, si) => (
          <div key={sym.key} style={{ display:"grid", gridTemplateColumns:"90px repeat(7,1fr)", borderTop:`1px solid ${COLORS.divider}`, background: si%2===0?"white":COLORS.mist }}>
            <div style={{ padding:"7px 10px", fontSize:"0.71rem", fontWeight:500, color:COLORS.ink, display:"flex", alignItems:"center", gap:5 }}>
              <span>{sym.emoji}</span><span>{sym.label}</span>
            </div>
            {days.map((d,i) => {
              const syms = symptomDays[i]?.symptoms || [];
              const present = syms.includes(sym.key);
              const isGood = sym.key === "good day";
              return (
                <div key={d.dateStr} style={{
                  padding:"7px 4px", textAlign:"center",
                  background: present ? (isGood ? COLORS.sagePale : COLORS.coralPale) : "transparent",
                  display:"flex", alignItems:"center", justifyContent:"center"
                }}>
                  {present && <span style={{ fontSize:"0.85rem" }}>{isGood ? "✨" : "●"}</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Top symptoms */}
      {topSymptoms.length > 0 && (
        <div style={{ marginTop:14 }}>
          <p style={s.sectionTitle}>Most Frequent This Week</p>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
            {topSymptoms.map(([sym, count]) => {
              const def = ALL_SYMPTOMS.find(s=>s.key===sym);
              return (
                <div key={sym} style={{ ...s.card, display:"flex", alignItems:"center", gap:8, padding:"10px 14px", marginBottom:0, flex:"0 0 auto" }}>
                  <span style={{ fontSize:"1.1rem" }}>{def?.emoji}</span>
                  <div>
                    <div style={{ fontSize:"0.82rem", fontWeight:500 }}>{def?.label || sym}</div>
                    <div style={{ fontSize:"0.7rem", color:COLORS.textSec }}>{count} day{count>1?"s":""} this week</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sleep summary */}
      {wellnessDays.some(w=>w?.wokeUp) && (
        <div style={{ marginTop:14 }}>
          <p style={s.sectionTitle}>Sleep Disruptions</p>
          <div style={s.card}>
            {days.map((d,i) => {
              const w = wellnessDays[i];
              if (!w?.wokeUp) return null;
              return (
                <div key={d.dateStr} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:`1px solid ${COLORS.divider}` }}>
                  <span style={{ fontSize:"0.82rem", fontFamily:"monospace", color:COLORS.textSec, minWidth:40 }}>{d.label} {d.dayNum}</span>
                  <span style={{ fontSize:"0.8rem" }}>🌙 Woke up {w.wokeUpTimes||""}x</span>
                  {w.sleepHours && <span style={{ fontSize:"0.76rem", color:COLORS.textSec }}>· {w.sleepHours}h total</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── INSIGHTS ──────────────────────────────────────────────────────────────────
function LineChart({ data, color = COLORS.tealMid, goal, height = 90 }) {
  const w = 300;
  const max = Math.max(goal || 0, ...data.map(d => d.value), 1);
  const stepX = data.length > 1 ? w / (data.length - 1) : w;
  const pts = data.map((d, i) => `${i * stepX},${height - (d.value / max) * height}`).join(" ");
  const goalY = goal ? height - (goal / max) * height : null;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} preserveAspectRatio="none">
      {goalY != null && <line x1="0" y1={goalY} x2={w} y2={goalY} stroke={COLORS.divider} strokeDasharray="4,3" strokeWidth="1" />}
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => {
        const x = i * stepX, y = height - (d.value / max) * height;
        return <circle key={i} cx={x} cy={y} r="2.5" fill={color} />;
      })}
    </svg>
  );
}

function pearson(xs, ys, minN = 5) {
  const n = xs.length;
  if (n < minN) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; num += dx * dy; dx2 += dx * dx; dy2 += dy * dy; }
  const denom = Math.sqrt(dx2 * dy2);
  return denom === 0 ? null : num / denom;
}
function describeCorr(r) {
  const abs = Math.abs(r);
  const strength = abs >= 0.6 ? "strong" : abs >= 0.35 ? "moderate" : "weak";
  const dir = r > 0 ? "positive" : "negative";
  return { strength, dir };
}

function Insights({ logs, labLog = [], weightLog = [], goals }) {
  const GOALS = goals || DEFAULT_GOALS;
  const [section, setSection] = useState("overview");
  const [range, setRange] = useState(14);
  const [nutrient, setNutrient] = useState("selenium");
  const [corrWindow, setCorrWindow] = useState("week");
  const [labKey, setLabKey] = useState("tsh");

  const fmtDate = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const windowDates = (endDaysAgo, count) => {
    const arr = [];
    for (let i = count - 1; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - endDaysAgo - i); arr.push(fmtDate(d)); }
    return arr;
  };

  const days = windowDates(0, range).map(dateStr => {
    const d = new Date(dateStr + "T12:00:00");
    return { dateStr, label: d.toLocaleDateString("en-US", { weekday: "short" }), dayNum: d.getDate() };
  });

  const getDayTotals = (dateStr) => {
    const dayLogs = logs.filter(l => l.date === dateStr);
    const totals = Object.fromEntries(NUTRIENT_KEYS.map(k => [k, 0]));
    dayLogs.filter(l => l.type === "meal").forEach(l => { NUTRIENT_KEYS.forEach(k => { totals[k] += l.nutrients?.[k] || 0; }); });
    dayLogs.filter(l => l.type === "vit").forEach(l => { const n = suppNutrients(l.name, l.dose); Object.entries(n).forEach(([k, v]) => { if (totals[k] !== undefined) totals[k] += v; }); });
    return totals;
  };

  const NUTRIENT_OPTIONS = [
    { key: "selenium", label: "Selenium", unit: "mcg" }, { key: "iodine", label: "Iodine", unit: "mcg" },
    { key: "zinc", label: "Zinc", unit: "mg" }, { key: "iron", label: "Iron", unit: "mg" },
    { key: "magnesium", label: "Magnesium", unit: "mg" }, { key: "protein", label: "Protein", unit: "g" },
    { key: "calories", label: "Calories", unit: "" },
  ];
  const WIN_KEYS = [
    { key: "selenium", label: "Selenium" }, { key: "iodine", label: "Iodine" },
    { key: "zinc", label: "Zinc" }, { key: "iron", label: "Iron" },
    { key: "magnesium", label: "Magnesium" }, { key: "protein", label: "Protein" },
  ];
  const nutOpt = NUTRIENT_OPTIONS.find(n => n.key === nutrient);
  const nutrientData = days.map(d => ({ label: d.label, value: getDayTotals(d.dateStr)[nutrient] || 0 }));
  const avgVal = Math.round((nutrientData.reduce((s, d) => s + d.value, 0) / days.length) * 10) / 10;

  const medDays = days.map(d => ({ ...d, taken: logs.some(l => l.type === "med" && l.date === d.dateStr) }));
  const adherencePct = Math.round((medDays.filter(d => d.taken).length / days.length) * 100);
  let streak = 0;
  for (let i = medDays.length - 1; i >= 0; i--) { if (medDays[i].taken) streak++; else break; }

  const symptomLogs = logs.filter(l => l.type === "symptom" && days.some(d => d.dateStr === l.date));
  const freq = {};
  symptomLogs.forEach(l => (l.symptoms || []).forEach(sym => { freq[sym] = (freq[sym] || 0) + 1; }));
  const topSymptoms = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([key, count]) => ({ label: SYMPTOMS_LIST.find(s => s.key === key)?.label || key, value: count }));
  const energyData = days.map(d => {
    const l = symptomLogs.find(l => l.date === d.dateStr);
    return { label: d.label, value: l?.energy || 0 };
  });
  const energyVals = energyData.filter(d => d.value > 0).map(d => d.value);
  const avgEnergy = energyVals.length ? Math.round((energyVals.reduce((a, b) => a + b, 0) / energyVals.length) * 10) / 10 : null;

  // ── Shared all-time lookups ──
  const mealDateSet = new Set(logs.filter(l => l.type === "meal").map(l => l.date));
  const medDateSet = new Set(logs.filter(l => l.type === "med").map(l => l.date));
  const symptomMap = {};
  logs.filter(l => l.type === "symptom").forEach(l => { symptomMap[l.date] = l; });

  const computeCorrForDates = (dates) => {
    const paired = dates.filter(dt => mealDateSet.has(dt) && symptomMap[dt]?.energy);
    return WIN_KEYS.map(k => {
      const xs = paired.map(dt => getDayTotals(dt)[k.key] || 0);
      const ys = paired.map(dt => symptomMap[dt].energy);
      const r = pearson(xs, ys, dates.length <= 7 ? 4 : 5);
      return r == null ? null : { ...k, r };
    }).filter(Boolean).sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
  };

  // ── Correlations (This Week / 90 Days toggle) ──
  const corrDates = windowDates(0, corrWindow === "week" ? 7 : 90);
  const corrResults = computeCorrForDates(corrDates).slice(0, 3);
  const corrResultsLong = computeCorrForDates(windowDates(0, 90)); // fixed 90-day, used by Recommendations & Predictions

  const symDates = corrDates.filter(dt => symptomMap[dt]);
  const takenSym = symDates.filter(dt => medDateSet.has(dt));
  const missedSym = symDates.filter(dt => !medDateSet.has(dt));
  const avgSympCount = arr => arr.length ? arr.reduce((s, dt) => s + (symptomMap[dt].symptoms?.length || 0), 0) / arr.length : null;
  const avgEnergyFor = arr => { const vs = arr.map(dt => symptomMap[dt].energy).filter(Boolean); return vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null; };
  const minGroupSize = corrWindow === "week" ? 2 : 3;
  const medComparison = (takenSym.length >= minGroupSize && missedSym.length >= minGroupSize) ? {
    symptomsTaken: Math.round(avgSympCount(takenSym) * 10) / 10,
    symptomsMissed: Math.round(avgSympCount(missedSym) * 10) / 10,
    energyTaken: avgEnergyFor(takenSym) != null ? Math.round(avgEnergyFor(takenSym) * 10) / 10 : null,
    energyMissed: avgEnergyFor(missedSym) != null ? Math.round(avgEnergyFor(missedSym) * 10) / 10 : null,
  } : null;

  const pairCounts = {};
  corrDates.forEach(dt => {
    const entry = symptomMap[dt];
    if (!entry) return;
    const syms = (entry.symptoms || []).filter(sm => sm !== "good day");
    for (let i = 0; i < syms.length; i++) for (let j = i + 1; j < syms.length; j++) {
      const key = [syms[i], syms[j]].sort().join("|");
      pairCounts[key] = (pairCounts[key] || 0) + 1;
    }
  });
  const topPairEntry = Object.entries(pairCounts).sort((a, b) => b[1] - a[1])[0];
  const pairMinCount = corrWindow === "week" ? 2 : 3;
  const topPair = (topPairEntry && topPairEntry[1] >= pairMinCount) ? {
    a: SYMPTOMS_LIST.find(s => s.key === topPairEntry[0].split("|")[0])?.label || topPairEntry[0].split("|")[0],
    b: SYMPTOMS_LIST.find(s => s.key === topPairEntry[0].split("|")[1])?.label || topPairEntry[0].split("|")[1],
    count: topPairEntry[1],
  } : null;

  // ── Weekly Wins & Areas to Improve (this week vs last week) ──
  const thisWeekDates = windowDates(0, 7);
  const lastWeekDates = windowDates(7, 7);
  const weekAvg = (dates, key) => dates.reduce((s, dt) => s + (getDayTotals(dt)[key] || 0), 0) / dates.length;
  const weekCompare = WIN_KEYS.map(k => {
    const thisAvg = weekAvg(thisWeekDates, k.key), lastAvg = weekAvg(lastWeekDates, k.key);
    const goal = GOALS[k.key] || 1;
    const thisPct = thisAvg / goal, lastPct = lastAvg / goal;
    return { ...k, thisAvg, lastAvg, thisPct, lastPct, delta: thisPct - lastPct };
  });
  const wins = weekCompare.filter(w => w.delta >= 0.1 || (w.thisPct >= 0.9 && w.lastPct < 0.9));
  const improveAreas = weekCompare.filter(w => w.thisPct < 0.5 || w.delta <= -0.1);
  const medPctFor = dates => dates.filter(dt => medDateSet.has(dt)).length / dates.length;
  const medThisWk = medPctFor(thisWeekDates), medLastWk = medPctFor(lastWeekDates);
  const energyAvgFor = dates => { const vs = dates.map(dt => symptomMap[dt]?.energy).filter(Boolean); return vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null; };
  const sympCountFor = dates => { const vs = dates.map(dt => symptomMap[dt]?.symptoms?.length).filter(v => v != null); return vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null; };
  const energyThisWk = energyAvgFor(thisWeekDates), energyLastWk = energyAvgFor(lastWeekDates);
  const sympThisWk = sympCountFor(thisWeekDates), sympLastWk = sympCountFor(lastWeekDates);

  // ── Daily Personalized Recommendations ──
  const todayStr = fmtDate(new Date());
  const todayTotals = getDayTotals(todayStr);
  const lowToday = WIN_KEYS.filter(k => (todayTotals[k.key] || 0) / (GOALS[k.key] || 1) < 0.5);
  const medTakenToday = medDateSet.has(todayStr);
  const topCorrLong = corrResultsLong[0];
  const recTips = [];
  if (!medTakenToday) recTips.push({ icon: "💊", text: "You haven't logged your medication yet today — a good first step." });
  if (lowToday.length) recTips.push({ icon: "🍽️", text: `${lowToday.map(k => k.label).join(", ")} ${lowToday.length > 1 ? "are" : "is"} under half your goal today — worth topping up.` });
  if (topCorrLong && Math.abs(topCorrLong.r) >= 0.35) {
    const { dir } = describeCorr(topCorrLong.r);
    recTips.push({ icon: "🔗", text: dir === "positive"
      ? `${topCorrLong.label} has tracked closely with your energy — a good one to prioritize today.`
      : `Your energy has tended to dip on higher-${topCorrLong.label.toLowerCase()} days — worth keeping an eye on.` });
  }
  if (streak >= 3) recTips.push({ icon: "🔥", text: `You're on a ${streak}-day medication streak — keep it going!` });
  if (recTips.length === 0) recTips.push({ icon: "✨", text: "Nothing stands out today — you're on track. Keep logging to unlock more personalized tips." });

  // ── Lab Trends with Medication Changes ──
  const ALL_LABS = [...THYROID_LABS, ...METABOLIC_LABS];
  const labDef = ALL_LABS.find(l => l.key === labKey);
  const sortedLabs = [...labLog].filter(l => l.values?.[labKey] != null && l.values[labKey] !== "").sort((a, b) => a.date > b.date ? 1 : -1);
  const labChartData = sortedLabs.map(l => ({ label: l.date.slice(5), value: parseFloat(l.values[labKey]) }));
  const medLogsAll = logs.filter(l => l.type === "med").sort((a, b) => a.date > b.date ? 1 : -1);
  const doseChanges = [];
  const lastDoseByName = {};
  medLogsAll.forEach(l => {
    const prevDose = lastDoseByName[l.name];
    if (prevDose !== undefined && prevDose !== l.dose) doseChanges.push({ date: l.date, name: l.name, from: prevDose, to: l.dose });
    lastDoseByName[l.name] = l.dose;
  });

  // ── Doctor Visit Summary (90-day) ──
  const days90 = windowDates(0, 90);
  const nutrientAvg90 = key => Math.round((days90.reduce((s, dt) => s + (getDayTotals(dt)[key] || 0), 0) / 90) * 10) / 10;
  const symptomLogs90 = days90.map(dt => symptomMap[dt]).filter(Boolean);
  const freq90 = {};
  symptomLogs90.forEach(l => (l.symptoms || []).filter(sm => sm !== "good day").forEach(sym => { freq90[sym] = (freq90[sym] || 0) + 1; }));
  const topSymptoms90 = Object.entries(freq90).sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([key, count]) => `${SYMPTOMS_LIST.find(s => s.key === key)?.label || key} (${count}x)`);
  const energy90Vals = symptomLogs90.map(l => l.energy).filter(Boolean);
  const avgEnergy90 = energy90Vals.length ? Math.round((energy90Vals.reduce((a, b) => a + b, 0) / energy90Vals.length) * 10) / 10 : null;
  const adherence90 = Math.round((days90.filter(dt => medDateSet.has(dt)).length / 90) * 100);
  const weightsInRange = [...weightLog].filter(w => days90.includes(w.date)).sort((a, b) => a.date > b.date ? 1 : -1);
  const weightChange = weightsInRange.length >= 2 ? Math.round((weightsInRange[weightsInRange.length - 1].weight - weightsInRange[0].weight) * 10) / 10 : null;
  const labsInRange = [...labLog].filter(l => days90.includes(l.date)).sort((a, b) => a.date > b.date ? 1 : -1);
  const latestThyroidLab = [...labsInRange].reverse().find(l => l.labType === "thyroid");

  const buildSummaryText = () => {
    const lines = [];
    lines.push(`Thyroid Tracker — 90-Day Summary (${days90[0]} to ${days90[89]})`);
    lines.push("");
    lines.push("Nutrient averages (daily):");
    WIN_KEYS.forEach(k => { lines.push(`  ${k.label}: ${nutrientAvg90(k.key)} (goal ${GOALS[k.key] || "—"})`); });
    lines.push("");
    lines.push(`Medication adherence: ${adherence90}%`);
    lines.push(`Average energy: ${avgEnergy90 != null ? avgEnergy90 + "/10" : "not enough data"}`);
    lines.push(`Most frequent symptoms: ${topSymptoms90.length ? topSymptoms90.join(", ") : "none logged"}`);
    if (weightChange != null) lines.push(`Weight change: ${weightChange > 0 ? "+" : ""}${weightChange} lbs`);
    if (latestThyroidLab) {
      lines.push("");
      lines.push(`Latest thyroid panel (${latestThyroidLab.date}):`);
      THYROID_LABS.forEach(l => { if (latestThyroidLab.values[l.key]) lines.push(`  ${l.label}: ${latestThyroidLab.values[l.key]} ${l.unit}`); });
    }
    if (doseChanges.length) {
      lines.push("");
      lines.push("Medication dose changes:");
      doseChanges.forEach(c => lines.push(`  ${c.date}: ${c.name} ${c.from} → ${c.to}`));
    }
    return lines.join("\n");
  };
  const copySummary = () => {
    const text = buildSummaryText();
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => alert("Summary copied — paste it anywhere to share with your doctor."));
    else alert(text);
  };

  // ── Monthly Progress Report (calendar month vs previous calendar month) ──
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const datesInMonth = (start, end) => { const arr = []; const d = new Date(start); while (d <= end) { arr.push(fmtDate(d)); d.setDate(d.getDate() + 1); } return arr; };
  const thisMonthDates = datesInMonth(thisMonthStart, now);
  const lastMonthDates = datesInMonth(lastMonthStart, lastMonthEnd);
  const monthNutrientCompare = WIN_KEYS.map(k => {
    const thisAvg = weekAvg(thisMonthDates, k.key), lastAvg = weekAvg(lastMonthDates, k.key);
    return { ...k, thisAvg: Math.round(thisAvg * 10) / 10, lastAvg: Math.round(lastAvg * 10) / 10, delta: Math.round((thisAvg - lastAvg) * 10) / 10 };
  });
  const monthAdherence = { thisM: Math.round(medPctFor(thisMonthDates) * 100), lastM: Math.round(medPctFor(lastMonthDates) * 100) };
  const monthEnergy = { thisM: energyAvgFor(thisMonthDates), lastM: energyAvgFor(lastMonthDates) };
  const monthSymptoms = { thisM: sympCountFor(thisMonthDates), lastM: sympCountFor(lastMonthDates) };
  const monthLabel = thisMonthStart.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const lastMonthLabel = lastMonthStart.toLocaleDateString("en-US", { month: "long" });

  // ── Predictive Insights (personal pattern flags, not medical predictions) ──
  const predictions = [];
  WIN_KEYS.forEach(k => {
    const lowDaysNextEnergy = [];
    const normalDaysNextEnergy = [];
    for (let i = 1; i < days90.length; i++) {
      const prevDt = days90[i - 1], curDt = days90[i];
      const curEnergy = symptomMap[curDt]?.energy;
      if (!curEnergy || !mealDateSet.has(prevDt)) continue;
      const pct = (getDayTotals(prevDt)[k.key] || 0) / (GOALS[k.key] || 1);
      if (pct < 0.5) lowDaysNextEnergy.push(curEnergy); else normalDaysNextEnergy.push(curEnergy);
    }
    if (lowDaysNextEnergy.length >= 3 && normalDaysNextEnergy.length >= 3) {
      const lowAvg = lowDaysNextEnergy.reduce((a, b) => a + b, 0) / lowDaysNextEnergy.length;
      const normAvg = normalDaysNextEnergy.reduce((a, b) => a + b, 0) / normalDaysNextEnergy.length;
      if (normAvg - lowAvg >= 1) predictions.push({
        icon: "🔮", text: `Days after low ${k.label.toLowerCase()} intake, your energy has averaged ${lowAvg.toFixed(1)}/10 vs ${normAvg.toFixed(1)}/10 otherwise — a pattern worth watching.`
      });
    }
  });
  if (topSymptoms.length) {
    const top = topSymptoms[0];
    const rate90 = Math.round(((freq90[SYMPTOMS_LIST.find(s => s.label === top.label)?.key] || 0) / 90) * 100);
    if (rate90 >= 20) predictions.push({ icon: "📈", text: `You've logged ${top.label} on about ${rate90}% of the last 90 days — likely to show up again this week based on that pattern.` });
  }
  if (streak >= 5) predictions.push({ icon: "🔥", text: `At your current pace, you're on track to hit a ${streak + 7}-day medication streak by next week.` });

  const SECTIONS = [
    { key: "overview", label: "Overview" },
    { key: "correlations", label: "Correlations" },
    { key: "weekly", label: "Weekly Review" },
    { key: "reports", label: "Reports" },
    { key: "predictions", label: "Predictions" },
  ];

  const fmt2 = v => v == null ? "—" : (Number.isInteger(v) ? v : v.toFixed(1));
  const pctFmt = v => `${Math.round(v * 100)}%`;

  return (
    <div>
      <p style={s.sectionTitle}>Insights</p>

      <div style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto", paddingBottom: 2 }}>
        {SECTIONS.map(sec => (
          <button key={sec.key} onClick={() => setSection(sec.key)}
            style={{ flexShrink: 0, padding: "7px 12px", borderRadius: 16, border: `1px solid ${section === sec.key ? COLORS.tealMid : COLORS.divider}`,
              background: section === sec.key ? COLORS.tealDeep : COLORS.white, color: section === sec.key ? COLORS.white : COLORS.textSec,
              fontSize: "0.74rem", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
            {sec.label}
          </button>
        ))}
      </div>

      {section === "overview" && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {[7, 14, 30].map(r => (
              <button key={r} onClick={() => setRange(r)}
                style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: `1px solid ${r === range ? COLORS.tealMid : COLORS.divider}`,
                  background: r === range ? COLORS.tealPale : COLORS.white, color: r === range ? COLORS.tealDeep : COLORS.textSec,
                  fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}>
                {r} days
              </button>
            ))}
          </div>

          <div style={s.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: COLORS.tealDeep }}>🦋 Nutrient Trend</span>
              <select value={nutrient} onChange={e => setNutrient(e.target.value)}
                style={{ fontSize: "0.75rem", padding: "4px 8px", borderRadius: 6, border: `1px solid ${COLORS.divider}` }}>
                {NUTRIENT_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            </div>
            <LineChart data={nutrientData} goal={GOALS[nutrient]} color={COLORS.tealMid} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: COLORS.textSec, marginTop: 6 }}>
              <span>{days[0].label} {days[0].dayNum}</span>
              <span>Avg: {avgVal}{nutOpt.unit} {GOALS[nutrient] ? `(goal ${GOALS[nutrient]}${nutOpt.unit})` : ""}</span>
              <span>{days[days.length - 1].label} {days[days.length - 1].dayNum}</span>
            </div>
          </div>

          <div style={s.card}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: COLORS.tealDeep }}>💊 Medication Adherence</span>
            <div style={{ display: "flex", gap: 4, marginTop: 10, marginBottom: 8 }}>
              {medDays.map((d, i) => (
                <div key={i} title={d.dateStr} style={{ flex: 1, height: 28, borderRadius: 5, background: d.taken ? COLORS.sage : COLORS.coralPale }} />
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.76rem", color: COLORS.textSec }}>
              <span>{adherencePct}% of days logged</span>
              <span>🔥 {streak} day streak</span>
            </div>
          </div>

          <div style={s.card}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: COLORS.tealDeep }}>🩺 Symptom Patterns</span>
            {topSymptoms.length === 0 ? (
              <p style={{ fontSize: "0.78rem", color: COLORS.textSec, marginTop: 8 }}>No symptoms logged in this period.</p>
            ) : (
              <div style={{ marginTop: 10 }}>
                {topSymptoms.map(sm => (
                  <div key={sm.label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: "0.74rem", color: COLORS.textSec, minWidth: 90 }}>{sm.label}</span>
                    <div style={{ flex: 1, height: 10, background: COLORS.mist, borderRadius: 5, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(sm.value / topSymptoms[0].value) * 100}%`, background: COLORS.coral, borderRadius: 5 }} />
                    </div>
                    <span style={{ fontSize: "0.72rem", color: COLORS.textSec }}>{sm.value}x</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={s.card}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: COLORS.tealDeep }}>⚡ Energy Trend</span>
            <div style={{ marginTop: 8 }}>
              <LineChart data={energyData} goal={null} color={COLORS.amber} />
            </div>
            <div style={{ fontSize: "0.76rem", color: COLORS.textSec, marginTop: 6 }}>
              {avgEnergy != null ? `Average energy: ${avgEnergy}/10` : "Log symptoms to see your energy trend."}
            </div>
          </div>
        </div>
      )}

      {section === "correlations" && (
        <div style={s.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: COLORS.tealDeep }}>🔗 Correlations</span>
            <div style={{ display: "flex", gap: 4 }}>
              {[{ key: "week", label: "This Week" }, { key: "90d", label: "90 Days" }].map(o => (
                <button key={o.key} onClick={() => setCorrWindow(o.key)}
                  style={{ padding: "4px 9px", borderRadius: 6, border: `1px solid ${corrWindow === o.key ? COLORS.tealMid : COLORS.divider}`,
                    background: corrWindow === o.key ? COLORS.tealPale : COLORS.white, color: corrWindow === o.key ? COLORS.tealDeep : COLORS.textSec,
                    fontSize: "0.68rem", fontWeight: 600, cursor: "pointer" }}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <p style={{ fontSize: "0.68rem", color: COLORS.textSec, marginTop: 4, marginBottom: 10 }}>
            {corrWindow === "week" ? "Based on the last 7 days" : "Based on your last 90 days of logs"}
          </p>

          {corrResults.length === 0 ? (
            <p style={{ fontSize: "0.78rem", color: COLORS.textSec }}>
              {corrWindow === "week" ? "Not enough overlapping meal + symptom logs this week yet." : "Log more meals alongside symptoms to see nutrient ↔ energy correlations."}
            </p>
          ) : (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: "0.74rem", fontWeight: 600, color: COLORS.ink, marginBottom: 6 }}>Nutrients ↔ Energy</p>
              {corrResults.map(c => {
                const { strength, dir } = describeCorr(c.r);
                return (
                  <div key={c.key} style={{ fontSize: "0.76rem", color: COLORS.textSec, marginBottom: 5, lineHeight: 1.4 }}>
                    <b style={{ color: COLORS.tealDeep }}>{c.label}</b>: {strength} {dir} correlation with energy (r={c.r.toFixed(2)})
                    {dir === "positive" ? " — higher intake tends to line up with better energy days." : " — higher intake tends to line up with lower energy days."}
                  </div>
                );
              })}
            </div>
          )}

          {medComparison && (
            <div style={{ marginBottom: 12, paddingTop: 10, borderTop: `1px solid ${COLORS.divider}` }}>
              <p style={{ fontSize: "0.74rem", fontWeight: 600, color: COLORS.ink, marginBottom: 6 }}>Meds ↔ Symptoms</p>
              <p style={{ fontSize: "0.76rem", color: COLORS.textSec, lineHeight: 1.4 }}>
                On days you logged meds, you averaged <b style={{ color: COLORS.tealDeep }}>{medComparison.symptomsTaken} symptoms</b>{medComparison.energyTaken != null ? ` and energy ${medComparison.energyTaken}/10` : ""}.
                On days you missed them, that was <b style={{ color: COLORS.coral }}>{medComparison.symptomsMissed} symptoms</b>{medComparison.energyMissed != null ? ` and energy ${medComparison.energyMissed}/10` : ""}.
              </p>
            </div>
          )}

          {topPair && (
            <div style={{ paddingTop: 10, borderTop: `1px solid ${COLORS.divider}` }}>
              <p style={{ fontSize: "0.74rem", fontWeight: 600, color: COLORS.ink, marginBottom: 6 }}>Symptoms That Cluster</p>
              <p style={{ fontSize: "0.76rem", color: COLORS.textSec, lineHeight: 1.4 }}>
                <b style={{ color: COLORS.tealDeep }}>{topPair.a}</b> and <b style={{ color: COLORS.tealDeep }}>{topPair.b}</b> showed up together on {topPair.count} days.
              </p>
            </div>
          )}

          {!medComparison && !topPair && corrResults.length === 0 && (
            <p style={{ fontSize: "0.72rem", color: COLORS.textSec }}>Keep logging daily — correlations get more reliable with more data.</p>
          )}
        </div>
      )}

      {section === "weekly" && (
        <div>
          <div style={s.card}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: COLORS.tealDeep }}>📊 Weekly Wins & Areas to Improve</span>
            <p style={{ fontSize: "0.68rem", color: COLORS.textSec, marginTop: 4, marginBottom: 10 }}>This week vs last week</p>

            <p style={{ fontSize: "0.74rem", fontWeight: 600, color: COLORS.sage, marginBottom: 6 }}>✅ Wins</p>
            {wins.length === 0 ? (
              <p style={{ fontSize: "0.76rem", color: COLORS.textSec, marginBottom: 10 }}>No clear wins yet this week — keep logging to track progress.</p>
            ) : wins.map(w => (
              <div key={w.key} style={{ fontSize: "0.76rem", color: COLORS.textSec, marginBottom: 5, lineHeight: 1.4 }}>
                <b style={{ color: COLORS.tealDeep }}>{w.label}</b>: {pctFmt(w.thisPct)} of goal (was {pctFmt(w.lastPct)})
              </div>
            ))}

            <p style={{ fontSize: "0.74rem", fontWeight: 600, color: COLORS.coral, marginTop: 12, marginBottom: 6 }}>🎯 Areas to Improve</p>
            {improveAreas.length === 0 ? (
              <p style={{ fontSize: "0.76rem", color: COLORS.textSec }}>Nothing significantly behind this week — nice work.</p>
            ) : improveAreas.map(w => (
              <div key={w.key} style={{ fontSize: "0.76rem", color: COLORS.textSec, marginBottom: 5, lineHeight: 1.4 }}>
                <b style={{ color: COLORS.coral }}>{w.label}</b>: {pctFmt(w.thisPct)} of goal (was {pctFmt(w.lastPct)})
              </div>
            ))}

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, paddingTop: 10, borderTop: `1px solid ${COLORS.divider}`, fontSize: "0.74rem", color: COLORS.textSec }}>
              <span>💊 {Math.round(medThisWk * 100)}% adherence <span style={{ opacity: 0.7 }}>(was {Math.round(medLastWk * 100)}%)</span></span>
              <span>⚡ {fmt2(energyThisWk)} energy <span style={{ opacity: 0.7 }}>(was {fmt2(energyLastWk)})</span></span>
            </div>
          </div>

          <div style={s.card}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: COLORS.tealDeep }}>✨ Today's Recommendations</span>
            <div style={{ marginTop: 10 }}>
              {recTips.map((t, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-start" }}>
                  <span style={{ fontSize: "0.9rem" }}>{t.icon}</span>
                  <span style={{ fontSize: "0.78rem", color: COLORS.textSec, lineHeight: 1.4 }}>{t.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {section === "reports" && (
        <div>
          <div style={s.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: COLORS.tealDeep }}>📈 Lab Trends</span>
              <select value={labKey} onChange={e => setLabKey(e.target.value)}
                style={{ fontSize: "0.75rem", padding: "4px 8px", borderRadius: 6, border: `1px solid ${COLORS.divider}` }}>
                {ALL_LABS.map(l => <option key={l.key} value={l.key}>{l.label}</option>)}
              </select>
            </div>
            {labChartData.length < 2 ? (
              <p style={{ fontSize: "0.78rem", color: COLORS.textSec }}>Log at least two {labDef?.label} results to see a trend.</p>
            ) : (
              <>
                <LineChart data={labChartData} goal={null} color={COLORS.tealMid} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: COLORS.textSec, marginTop: 6 }}>
                  <span>{labChartData[0].label}: {labChartData[0].value} {labDef?.unit}</span>
                  <span>{labChartData[labChartData.length - 1].label}: {labChartData[labChartData.length - 1].value} {labDef?.unit}</span>
                </div>
              </>
            )}
            {doseChanges.length > 0 && (
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${COLORS.divider}` }}>
                <p style={{ fontSize: "0.74rem", fontWeight: 600, color: COLORS.ink, marginBottom: 6 }}>Medication Dose Changes</p>
                {doseChanges.map((c, i) => (
                  <div key={i} style={{ fontSize: "0.74rem", color: COLORS.textSec, marginBottom: 4 }}>
                    {dateLabel(c.date)}: <b style={{ color: COLORS.tealDeep }}>{c.name}</b> {c.from} → {c.to}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={s.card}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: COLORS.tealDeep }}>🩺 Doctor Visit Summary</span>
            <p style={{ fontSize: "0.68rem", color: COLORS.textSec, marginTop: 4, marginBottom: 10 }}>Last 90 days — ready to bring to an appointment</p>
            <div style={{ fontSize: "0.76rem", color: COLORS.textSec, lineHeight: 1.6 }}>
              <div>💊 Medication adherence: <b style={{ color: COLORS.tealDeep }}>{adherence90}%</b></div>
              <div>⚡ Average energy: <b style={{ color: COLORS.tealDeep }}>{avgEnergy90 != null ? avgEnergy90 + "/10" : "—"}</b></div>
              <div>🩺 Top symptoms: <b style={{ color: COLORS.tealDeep }}>{topSymptoms90.length ? topSymptoms90.join(", ") : "none logged"}</b></div>
              {weightChange != null && <div>⚖️ Weight change: <b style={{ color: COLORS.tealDeep }}>{weightChange > 0 ? "+" : ""}{weightChange} lbs</b></div>}
              {latestThyroidLab && <div>🦋 Latest TSH: <b style={{ color: COLORS.tealDeep }}>{latestThyroidLab.values.tsh || "—"} mIU/L</b> ({dateLabel(latestThyroidLab.date)})</div>}
            </div>
            <button onClick={copySummary} style={{ ...s.btnOutline, marginTop: 12, width: "100%" }}>📋 Copy Full Summary</button>
          </div>

          <div style={s.card}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: COLORS.tealDeep }}>🗓️ Monthly Progress Report</span>
            <p style={{ fontSize: "0.68rem", color: COLORS.textSec, marginTop: 4, marginBottom: 10 }}>{monthLabel} vs {lastMonthLabel}</p>
            {monthNutrientCompare.map(m => (
              <div key={m.key} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.76rem", color: COLORS.textSec, marginBottom: 5 }}>
                <span>{m.label}</span>
                <span>{fmt2(m.thisAvg)} <span style={{ opacity: 0.6 }}>(was {fmt2(m.lastAvg)})</span> {m.delta > 0 ? "↑" : m.delta < 0 ? "↓" : "—"}</span>
              </div>
            ))}
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${COLORS.divider}`, fontSize: "0.76rem", color: COLORS.textSec, lineHeight: 1.6 }}>
              <div>💊 Adherence: {monthAdherence.thisM}% <span style={{ opacity: 0.6 }}>(was {monthAdherence.lastM}%)</span></div>
              <div>⚡ Energy: {fmt2(monthEnergy.thisM)} <span style={{ opacity: 0.6 }}>(was {fmt2(monthEnergy.lastM)})</span></div>
              <div>🩺 Avg symptoms/day: {fmt2(monthSymptoms.thisM)} <span style={{ opacity: 0.6 }}>(was {fmt2(monthSymptoms.lastM)})</span></div>
            </div>
          </div>
        </div>
      )}

      {section === "predictions" && (
        <div style={s.card}>
          <span style={{ fontSize: "0.85rem", fontWeight: 600, color: COLORS.tealDeep }}>🔮 Predictive Insights</span>
          <p style={{ fontSize: "0.68rem", color: COLORS.textSec, marginTop: 4, marginBottom: 10 }}>Personal patterns from your own data — not medical predictions</p>
          {predictions.length === 0 ? (
            <p style={{ fontSize: "0.78rem", color: COLORS.textSec }}>Not enough history yet to spot reliable patterns. Keep logging daily and check back.</p>
          ) : (
            predictions.map((p, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "flex-start" }}>
                <span style={{ fontSize: "0.9rem" }}>{p.icon}</span>
                <span style={{ fontSize: "0.78rem", color: COLORS.textSec, lineHeight: 1.4 }}>{p.text}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [data, setData] = useState(EMPTY_STATE);
  const [tab, setTab] = useState("dashboard");
  const [loaded, setLoaded] = useState(false);

  // Load from persistent storage on mount
    useEffect(() => {
    loadFromStorage().then(saved => {
      const cleaned = { ...saved, logs: dedupeSymptoms(saved.logs || []) };
      setData(cleaned);
      setLoaded(true);
    });
  }, []);

  // Save to persistent storage whenever data changes (after initial load)
  useEffect(() => {
    if (!loaded) return;
    saveToStorage(data);
  }, [data, loaded]);

  const addLog = useCallback(entry => {
    setData(d => {
      let logs = [...d.logs];
    if (entry.type==="symptom") logs = logs.filter(l=>!(l.type==="symptom"&&l.date===entry.date));
      return {...d, logs:[...logs, entry]};
    });
    setTab("dashboard");
  }, []);

  const deleteLog = useCallback(id => setData(d=>({...d, logs:d.logs.filter(l=>l.id!==id)})), []);
  const editLog   = useCallback(updated => setData(d=>({...d, logs:d.logs.map(l=>l.id===updated.id?updated:l)})), []);
  const [editingLog, setEditingLog] = useState(null);
  const addWeight     = useCallback(entry => setData(d=>({...d, weightLog:[...(d.weightLog||[]), entry]})), []);
  const addWellness   = useCallback(entry => setData(d=>({...d, wellnessLog:[...(d.wellnessLog||[]).filter(e=>e.date!==entry.date), entry]})), []);
  const deleteWellness = useCallback(id => setData(d=>({...d, wellnessLog:(d.wellnessLog||[]).filter(e=>e.id!==id)})), []);
  const addLab        = useCallback(entry => setData(d=>({...d, labLog:[...(d.labLog||[]), entry]})), []);
  const deleteLab     = useCallback(id => setData(d=>({...d, labLog:(d.labLog||[]).filter(e=>e.id!==id)})), []);
  const deleteWeight = useCallback(id => setData(d=>({...d, weightLog:(d.weightLog||[]).filter(e=>e.id!==id)})), []);
  const saveGoals = useCallback(goals => setData(d=>({...d,goals})), []);
  const updatePresets = useCallback(presets => setData(d=>({...d,presets})), []);

  const TABS = ["dashboard","log-meal","log-med","symptoms","schedule","meals","wellness","labs","weekly","wellweek","insights","calendar","weight","history","settings"];
  const LABELS = ["Dashboard","Log Meal","Meds & Vitamins","Symptoms","Schedule","Meals","Wellness","Labs","Weekly","Well. Week","Insights","Calendar","Weight","History","My Profile"];

  if (!loaded) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:COLORS.mist, flexDirection:"column", gap:12 }}>
      <div style={{ fontFamily:"Georgia,serif", fontSize:"1.4rem", color:COLORS.tealDeep }}>🦋</div>
      <div style={{ fontSize:"0.82rem", color:COLORS.textSec }}>Loading your data…</div>
    </div>
  );

  return (
    <div style={s.app}>
      <header style={s.header}>
        <div style={{ display:"flex", alignItems:"baseline", gap:8 }}>
          <h1 style={s.h1}>🦋 Thyroid Tracker</h1>
          <span style={{ fontSize:"0.66rem", opacity:0.6, textTransform:"uppercase", letterSpacing:"0.08em" }}>Wellness Log</span>
        </div>
        <div style={s.dateBadge}>{new Date().toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}</div>
      </header>

      <nav style={s.nav}>
        {TABS.map((t,i)=>(
          <button key={t} style={s.navBtn(tab===t)} onClick={()=>setTab(t)}>{LABELS[i]}</button>
        ))}
      </nav>

      <main style={s.main}>
        {tab==="dashboard"  && <Dashboard logs={data.logs} goals={data.goals} onDelete={deleteLog} onEdit={setEditingLog}/>}
        {tab==="log-meal"   && <LogMeal onSave={addLog}/>}
        {tab==="log-med"    && <LogMed presets={data.presets} onSave={addLog} onUpdatePresets={updatePresets}/>}
     {tab==="symptoms"   && <Symptoms onSave={addLog} logs={data.logs}/>}
        {tab==="schedule"   && <MedSchedule logs={data.logs}/>}
        {tab==="meals"      && <MealsNutrients logs={data.logs}/>}
        {tab==="wellness"   && <WellnessTracker wellnessLog={data.wellnessLog||[]} onSave={addWellness} onDeleteEntry={deleteWellness}/>}
        {tab==="labs"       && <LabResults labLog={data.labLog||[]} onSave={addLab} onDelete={deleteLab}/>}
        {tab==="weekly"     && <WeeklyDashboard logs={data.logs}/>}
        {tab==="wellweek"   && <WeeklyWellness logs={data.logs} wellnessLog={data.wellnessLog||[]}/>}
        {tab==="insights"   && <Insights logs={data.logs} labLog={data.labLog||[]} weightLog={data.weightLog||[]} goals={data.goals}/>}
        {tab==="calendar"   && <Calendar logs={data.logs} onDelete={deleteLog}/>}
        {tab==="weight"     && <WeightTracker weightLog={data.weightLog||[]} onSave={addWeight} onDelete={deleteWeight}/>}
        {tab==="history"    && <History logs={data.logs} onDelete={deleteLog}/>}
        {tab==="settings"   && <Settings goals={data.goals} presets={data.presets} onSaveGoals={saveGoals} onUpdatePresets={updatePresets}/>}
      </main>
      {editingLog && editingLog.type==="meal" && <EditMealModal log={editingLog} onSave={updated=>{ editLog(updated); setEditingLog(null); }} onClose={()=>setEditingLog(null)}/>}
      {editingLog && (editingLog.type==="med"||editingLog.type==="vit") && <EditMedModal log={editingLog} onSave={updated=>{ editLog(updated); setEditingLog(null); }} onClose={()=>setEditingLog(null)}/>}
    </div>
  );
}
