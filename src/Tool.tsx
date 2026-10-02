// Gutterly: a maintenance calendar for your actual house, built from its age, features and climate.
import { useMemo } from "react";
import { downloadIcs, localDate } from "./lib/ics";
import { useStored } from "./lib/store";
import { addDays, prettyDate, todayISO } from "./lib/time";
import { Section, Stat, Stats } from "./ui/kit";

const T = "gutterly";
type House = { built: number; type: "flat" | "house"; features: string[]; climate: "hot-dry" | "mild" | "cold-wet" };
type Task = { id: string; what: string; every: number; month?: number; why: string; pro: string; needs?: string; minAge?: number; only?: House["type"]; climate?: House["climate"][] };
const FEATURES = ["Gas boiler", "Water heater", "Air conditioning", "Roof terrace", "Pitched roof with gutters", "Garden", "Pool", "Fireplace", "Solar panels", "Water tank on the roof", "Well or pump", "Septic tank"];
const TASKS: Task[] = [
  { id: "smoke", what: "Test smoke and gas alarms", every: 90, why: "A dead alarm protects nobody.", pro: "" },
  { id: "boiler", what: "Service the gas boiler", every: 365, month: 9, why: "Safety check for carbon monoxide and efficiency before winter.", pro: "Heating engineer", needs: "Gas boiler" },
  { id: "heater", what: "Descale and check the water heater", every: 365, why: "Scale shortens its life and raises the bill, especially with hard water.", pro: "Plumber", needs: "Water heater" },
  { id: "ac", what: "Clean or replace air-conditioning filters", every: 90, why: "Dirty filters cut cooling and push up electricity use.", pro: "", needs: "Air conditioning" },
  { id: "acsvc", what: "Service the air conditioning before summer", every: 365, month: 5, why: "Checks gas levels and drainage before the heavy months.", pro: "AC technician", needs: "Air conditioning" },
  { id: "terrace", what: "Check the roof terrace waterproofing and clear drains", every: 365, month: 9, why: "Autumn rains find every crack. Fixing a seal is far cheaper than a ceiling.", pro: "Waterproofing specialist", needs: "Roof terrace" },
  { id: "gutters", what: "Clear gutters and downpipes", every: 182, month: 10, why: "Blocked gutters overflow into walls and foundations.", pro: "Handyman", needs: "Pitched roof with gutters" },
  { id: "tank", what: "Clean and disinfect the roof water tank", every: 365, month: 4, why: "Sediment and algae build up over a year.", pro: "Plumber", needs: "Water tank on the roof" },
  { id: "pool", what: "Open and balance the pool", every: 365, month: 5, why: "Check the pump, filter and chemistry before swimming season.", pro: "Pool technician", needs: "Pool" },
  { id: "chimney", what: "Sweep the chimney", every: 365, month: 10, why: "Soot build-up is a fire risk.", pro: "Chimney sweep", needs: "Fireplace" },
  { id: "solar", what: "Clean solar panels", every: 182, why: "Dust can cut output by 15% or more in dry climates.", pro: "", needs: "Solar panels", climate: ["hot-dry", "mild"] },
  { id: "pump", what: "Check the pump and pressure tank", every: 365, why: "Catch a failing pump before the taps run dry.", pro: "Plumber", needs: "Well or pump" },
  { id: "septic", what: "Empty the septic tank", every: 1095, why: "Every three years or so, depending on household size.", pro: "Septic service", needs: "Septic tank" },
  { id: "garden", what: "Trim trees away from walls and cables", every: 365, month: 2, why: "Roots and branches damage walls, roofs and lines.", pro: "Gardener", needs: "Garden" },
  { id: "sealant", what: "Redo sealant around the bath, shower and sinks", every: 730, why: "Old sealant lets water into walls and floors.", pro: "" },
  { id: "elec", what: "Have the wiring and earthing inspected", every: 1825, why: "Older installations may lack modern protection.", pro: "Electrician", minAge: 15 },
  { id: "plumb", what: "Check under sinks for slow leaks", every: 180, why: "A slow drip rots cabinets and floors unseen.", pro: "" },
  { id: "damp", what: "Check walls for damp and ventilate bathrooms", every: 182, month: 11, why: "Mould starts in winter when windows stay shut.", pro: "", climate: ["mild", "cold-wet"] },
  { id: "facade", what: "Repaint and seal the exterior walls", every: 1825, why: "Paint protects render from sun and rain.", pro: "Painter", only: "house" },
  { id: "doors", what: "Oil locks, hinges and shutters", every: 365, why: "Salt air and dust wear them out quietly.", pro: "" },
];

export default function Gutterly() {
  const [house, setHouse] = useStored<House>(T, "house", { built: 1998, type: "house", features: ["Water heater", "Air conditioning", "Roof terrace", "Water tank on the roof", "Garden"], climate: "hot-dry" });
  const [done, setDone] = useStored<Record<string, string>>(T, "done", { smoke: addDays(todayISO(), -120), ac: addDays(todayISO(), -40), plumb: addDays(todayISO(), -200) });
  const age = new Date().getFullYear() - house.built;
  const tasks = useMemo(() => TASKS.filter(t => (!t.needs || house.features.includes(t.needs)) && (!t.minAge || age >= t.minAge) && (!t.only || t.only === house.type) && (!t.climate || t.climate.includes(house.climate))).map(t => {
    let due: string;
    if (done[t.id]) due = addDays(done[t.id], t.every);
    else if (t.month) { const y = new Date().getFullYear(); const cand = `${y}-${String(t.month).padStart(2, "0")}-01`; due = cand < todayISO() ? `${y + 1}-${String(t.month).padStart(2, "0")}-01` : cand; if (t.every < 365) due = todayISO(); }
    else due = todayISO();
    return { ...t, due, left: Math.round((new Date(due).getTime() - new Date(todayISO()).getTime()) / 86400000) };
  }).sort((a, b) => a.due.localeCompare(b.due)), [house, done, age]);
  const overdue = tasks.filter(t => t.left < 0 || (!done[t.id] && t.left <= 0));
  const soon = tasks.filter(t => t.left >= 0 && t.left <= 60 && !overdue.includes(t));

  return (
    <div className="stack">
      <Section title="Your home" aside={<button className="btn small primary" onClick={() => downloadIcs("home-maintenance.ics", tasks.map(t => ({ title: `Home: ${t.what}`, start: localDate(t.due < todayISO() ? todayISO() : t.due), allDay: true, description: t.why, rrule: `FREQ=DAILY;INTERVAL=${t.every}` })), "Home maintenance")}>Add all to calendar</button>}>
        <Stats><Stat value={tasks.length} label="Jobs for this home" /><Stat value={overdue.length} label="Due now" tone={overdue.length ? "bad" : "good"} /><Stat value={soon.length} label="Next 2 months" tone="warn" /><Stat value={`${age} years`} label="Age of the building" /></Stats>
        <div className="row" style={{ marginTop: 16 }}>
          <label className="field" style={{ flex: "0 0 130px" }}><span>Year built</span><input id="gu-b" className="input num" value={house.built} onChange={e => setHouse({ ...house, built: parseInt(e.target.value) || 2000 })} /></label>
          <label className="field" style={{ flex: "0 0 140px" }}><span>Type</span><select id="gu-t" className="input" value={house.type} onChange={e => setHouse({ ...house, type: e.target.value as House["type"] })}><option value="house">House</option><option value="flat">Flat</option></select></label>
          <label className="field" style={{ flex: "0 0 200px" }}><span>Climate</span><select id="gu-c" className="input" value={house.climate} onChange={e => setHouse({ ...house, climate: e.target.value as House["climate"] })}><option value="hot-dry">Hot, dry summers</option><option value="mild">Mild</option><option value="cold-wet">Cold, wet winters</option></select></label>
        </div>
        <div className="row" style={{ gap: 8, marginTop: 12 }}>{FEATURES.map(f => <label key={f} className="check note"><input type="checkbox" checked={house.features.includes(f)} onChange={e => setHouse({ ...house, features: e.target.checked ? [...house.features, f] : house.features.filter(x => x !== f) })} />{f}</label>)}</div>
      </Section>
      <Section title="Maintenance calendar">
        <div className="stack" style={{ gap: 4 }}>
          {tasks.map(t => { const st = overdue.includes(t) ? ["Due now", "bad"] : t.left <= 60 ? [`In ${t.left} days`, "warn"] : [prettyDate(t.due), ""]; return (
            <div key={t.id} className="gu-row" style={{ borderLeftColor: st[1] ? `var(--${st[1]})` : "var(--line)" }}>
              <div style={{ flex: 1, minWidth: 0 }}><strong>{t.what}</strong><p className="note">{t.why} Every {t.every >= 365 ? `${Math.round(t.every / 365)} year${t.every >= 730 ? "s" : ""}` : `${Math.round(t.every / 30)} months`}.{done[t.id] ? ` Last done ${prettyDate(done[t.id])}.` : ""}</p></div>
              <span className={"pill " + st[1]}>{st[0]}</span>
              {t.pro && <a className="btn ghost small" href={`https://www.google.com/search?q=${encodeURIComponent(t.pro + " near me")}`} target="_blank" rel="noreferrer">Find a {t.pro.toLowerCase()}</a>}
              <button className="btn small" onClick={() => setDone({ ...done, [t.id]: todayISO() })}>Done today</button>
            </div>); })}
        </div>
      </Section>
      <p className="note">Intervals are common guidance. Follow the manufacturer's manual where it says otherwise.</p>
      <style>{`.gu-row{display:flex;gap:10px;align-items:center;padding:10px 0 10px 12px;border-left:4px solid;border-bottom:1px solid var(--line);flex-wrap:wrap}`}</style>
    </div>
  );
}
