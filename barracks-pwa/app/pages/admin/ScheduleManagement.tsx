"use client";

import { useEffect, useState } from "react";
import type { ApiBarber } from "@/app/lib/api";
import { apiRequest, readApiBody } from "@/app/lib/api";
import { Button, Panel } from "@/app/components/ui";

type Hours = { dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean };
type Break = { startTime: string; endTime: string };
type Shift = { dayOfWeek: number; isWorking: boolean; startTime: string; endTime: string; breaks: Break[] };
type Absence = { id: number; startsAt: string; endsAt: string; reason: string };
const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const timeInput = (value: string, onChange: (value: string) => void) => <input type="time" value={value} onChange={(event) => onChange(event.target.value)} />;

export function ScheduleManagement({ barbers, onToast }: { barbers: ApiBarber[]; onToast: (message: string) => void }) {
  const [hours, setHours] = useState<Hours[]>([]);
  const [barberId, setBarberId] = useState(0);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [start, setStart] = useState(""); const [end, setEnd] = useState(""); const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadedBarberId, setLoadedBarberId] = useState(0);

  useEffect(() => { const id = window.requestAnimationFrame(() => { void (async () => {
    try { const response = await apiRequest("/api/shop-hours", { cache: "no-store" }); const body = await readApiBody<{ hours?: Hours[]; message?: string }>(response); if (!response.ok || !body?.hours) throw new Error(body?.message ?? "Unable to load hours"); setHours(body.hours); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load hours"); }
  })(); }); return () => window.cancelAnimationFrame(id); }, []);
  useEffect(() => { const id = window.requestAnimationFrame(() => { void (async () => {
    setLoadedBarberId(0);
    if (!barberId) { setShifts([]); setAbsences([]); return; }
    try { const response = await apiRequest(`/api/barbers/${barberId}/schedule`, { cache: "no-store" }); const body = await readApiBody<{ schedules?: Shift[]; unavailability?: Absence[]; message?: string }>(response); if (!response.ok || !body?.schedules) throw new Error(body?.message ?? "Unable to load schedule"); setShifts(body.schedules); setAbsences(body.unavailability ?? []); setError(""); setLoadedBarberId(barberId); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load schedule"); }
  })(); }); return () => window.cancelAnimationFrame(id); }, [barberId]);
  async function saveHour(hour: Hours) { setBusy(true); setError(""); try { const response = await apiRequest("/api/shop-hours", { method: "PUT", body: JSON.stringify(hour) }); const body = await readApiBody<{ hours?: Hours[]; message?: string }>(response); if (!response.ok || !body?.hours) throw new Error(body?.message ?? "Unable to save hours"); setHours(body.hours); onToast(`${days[hour.dayOfWeek]} shop hours saved`); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save hours"); } finally { setBusy(false); } }
  async function saveShift(shift: Shift) { setBusy(true); setError(""); try { const response = await apiRequest(`/api/barbers/${barberId}/schedule`, { method: "PUT", body: JSON.stringify(shift) }); const body = await readApiBody<{ schedules?: Shift[]; message?: string; errors?: Record<string, string[]> }>(response); if (!response.ok || !body?.schedules) throw new Error(Object.values(body?.errors ?? {}).flat().join(" ") || body?.message || "Unable to save shift"); setShifts(body.schedules); onToast(`${days[shift.dayOfWeek]} shift saved`); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save shift"); } finally { setBusy(false); } }
  async function addAbsence() { setBusy(true); setError(""); try { const response = await apiRequest(`/api/barbers/${barberId}/schedule`, { method: "POST", body: JSON.stringify({ startsAt: new Date(`${start}:00+08:00`).toISOString(), endsAt: new Date(`${end}:00+08:00`).toISOString(), reason }) }); const body = await readApiBody<{ unavailability?: Absence; message?: string }>(response); if (!response.ok || !body?.unavailability) throw new Error(body?.message ?? "Unable to add absence"); setAbsences((current) => [...current, body.unavailability!]); setStart(""); setEnd(""); setReason(""); onToast("Unavailable period added"); } catch (cause) { setError(cause instanceof Error ? cause.message : "Check the dates and reason"); } finally { setBusy(false); } }
  async function removeAbsence(id: number) { setBusy(true); setError(""); try { const response = await apiRequest(`/api/barbers/${barberId}/schedule?periodId=${id}`, { method: "DELETE" }); if (!response.ok) throw new Error("Unable to remove period"); setAbsences((current) => current.filter((item) => item.id !== id)); onToast("Unavailable period removed"); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to remove period"); } finally { setBusy(false); } }
  const updateHour = (day: number, patch: Partial<Hours>) => setHours((current) => current.map((item) => item.dayOfWeek === day ? { ...item, ...patch } : item));
  const updateShift = (day: number, patch: Partial<Shift>) => setShifts((current) => current.map((item) => item.dayOfWeek === day ? { ...item, ...patch } : item));
  return <Panel className="operational-panel"><h2>Shop hours and barber schedules</h2><p>Times use Asia/Manila. Save each day after editing.</p>{error && <p role="alert" className="form-error">{error}</p>}
    <h3>Shop operating hours</h3><div className="schedule-rows">{hours.map((hour) => <div className="schedule-row" key={hour.dayOfWeek}><strong>{days[hour.dayOfWeek]}</strong><label><input type="checkbox" checked={hour.isClosed} onChange={(event) => updateHour(hour.dayOfWeek, { isClosed: event.target.checked })} /> Closed</label>{timeInput(hour.openTime, (value) => updateHour(hour.dayOfWeek, { openTime: value }))}{timeInput(hour.closeTime, (value) => updateHour(hour.dayOfWeek, { closeTime: value }))}<Button size="sm" disabled={busy} onClick={() => void saveHour(hour)}>Save</Button></div>)}</div>
    <h3>Barber schedule</h3><label>Barber <select value={barberId} onChange={(event) => setBarberId(Number(event.target.value))}><option value={0}>Select barber</option>{barbers.map((barber) => <option key={barber.id} value={barber.id}>{barber.firstName} {barber.lastName}</option>)}</select></label>
    {barberId > 0 && <>{loadedBarberId === barberId && shifts.length < 7 && <p role="alert" className="form-hint">This barber needs a complete weekly schedule. Save each missing day before taking appointments for it.</p>}<div className="schedule-rows">{days.map((day, dayOfWeek) => { const shift = shifts.find((item) => item.dayOfWeek === dayOfWeek) ?? { dayOfWeek, isWorking: false, startTime: "09:00", endTime: "19:30", breaks: [] }; const update = (patch: Partial<Shift>) => { if (!shifts.some((item) => item.dayOfWeek === dayOfWeek)) setShifts((current) => [...current, { ...shift, ...patch }]); else updateShift(dayOfWeek, patch); }; return <div className="schedule-row" key={day}><strong>{day}</strong><label><input type="checkbox" checked={shift.isWorking} onChange={(event) => update({ isWorking: event.target.checked })} /> Working</label>{timeInput(shift.startTime, (value) => update({ startTime: value }))}{timeInput(shift.endTime, (value) => update({ endTime: value }))}<Button size="sm" disabled={busy} onClick={() => void saveShift(shift)}>Save shift</Button><div className="schedule-breaks"><span>Breaks</span>{shift.breaks.map((item, index) => <div key={index}>{timeInput(item.startTime, (value) => update({ breaks: shift.breaks.map((entry, i) => i === index ? { ...entry, startTime: value } : entry) }))}{timeInput(item.endTime, (value) => update({ breaks: shift.breaks.map((entry, i) => i === index ? { ...entry, endTime: value } : entry) }))}<button type="button" onClick={() => update({ breaks: shift.breaks.filter((_, i) => i !== index) })}>Remove</button></div>)}<button type="button" onClick={() => update({ breaks: [...shift.breaks, { startTime: "12:00", endTime: "13:00" }] })}>Add break</button></div></div>; })}</div>
    <h3>Temporary unavailability</h3><div className="schedule-row"><label>Start <input type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} /></label><label>End <input type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} /></label><label>Reason <input value={reason} maxLength={200} onChange={(event) => setReason(event.target.value)} /></label><Button size="sm" disabled={busy || !start || !end || !reason.trim()} onClick={() => void addAbsence()}>Add period</Button></div>{absences.map((item) => <div className="schedule-row" key={item.id}><span>{new Date(item.startsAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })} – {new Date(item.endsAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</span><span>{item.reason}</span><button type="button" disabled={busy} onClick={() => void removeAbsence(item.id)}>Remove</button></div>)}</>}
  </Panel>;
}
