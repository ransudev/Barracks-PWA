"use client";
import { useBranchContext } from "@/app/utils/use-branch-context";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { apiRequest, readApiBody, type ApiAttendance, type ApiAttendanceCorrection, type ApiBarberAvailability } from "@/app/lib/api";
import { Badge, Button, EmptyState, Modal, PageHeader, Panel, SelectField, TextField } from "@/app/components/ui";
import { FilterToolbar, ResponsiveTable } from "@/app/components/operations/OperationalPrimitives";

const todayInManila = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const dateTimeInManila = (value: string | null) => value ? new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
}).format(new Date(value)).replace(" ", "T") : "";
const clockLabel = (value: string | null) => value ? new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
const toInstant = (value: string) => value ? new Date(`${value}:00+08:00`).toISOString() : null;

export function AttendanceManagement() {
  const { branches, branchId, setBranchId, branchError } = useBranchContext();
  return <><SelectField label="Branch" value={branchId || ""} onChange={(event) => setBranchId(Number(event.target.value))}>
    {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
  </SelectField>{branchError && <p role="alert">{branchError}</p>}
  {branchId > 0 && <AttendanceBranch key={branchId} branchId={branchId} />}</>;
}

function AttendanceBranch({ branchId }: { branchId: number }) {
  const loadVersion = useRef(0);
  const [records, setRecords] = useState<ApiAttendance[]>([]);
  const [barbers, setBarbers] = useState<ApiBarberAvailability[]>([]);
  const [date, setDate] = useState(todayInManila);
  const [barberId, setBarberId] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<ApiAttendance | null>(null);
  const [corrections, setCorrections] = useState<ApiAttendanceCorrection[]>([]);
  const [draftStatus, setDraftStatus] = useState<ApiAttendance["status"]>("present");
  const [clockIn, setClockIn] = useState("");
  const [clockOut, setClockOut] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({ branchId: String(branchId) });
      if (date) params.set("date", date);
      if (barberId) params.set("barberId", barberId);
      if (status) params.set("status", status);
      const [historyResponse, barbersResponse] = await Promise.all([
        apiRequest(`/api/attendance/history${params.size ? `?${params}` : ""}`, { cache: "no-store" }),
        apiRequest(`/api/barbers?branchId=${branchId}`, { cache: "no-store" }),
      ]);
      const [historyBody, barbersBody] = await Promise.all([
        readApiBody<{ success: boolean; attendance?: ApiAttendance[]; message?: string }>(historyResponse),
        readApiBody<{ success: boolean; barbers?: ApiBarberAvailability[]; message?: string }>(barbersResponse),
      ]);
      if (!historyResponse.ok || !historyBody?.success || !historyBody.attendance) throw new Error(historyBody?.message ?? "Unable to load attendance");
      if (!barbersResponse.ok || !barbersBody?.success || !barbersBody.barbers) throw new Error(barbersBody?.message ?? "Unable to load barbers");
      if (version !== loadVersion.current) return;
      setRecords(historyBody.attendance);
      setBarbers(barbersBody.barbers);
      setError("");
    } catch (cause) { if (version === loadVersion.current) setError(cause instanceof Error ? cause.message : "Unable to load attendance"); }
    finally { if (version === loadVersion.current) setLoading(false); }
  }, [branchId, date, barberId, status]);

  const invalidateLoad = useCallback(() => { ++loadVersion.current; }, []);
  useEffect(() => { const frame = window.requestAnimationFrame(() => { void load(); }); return () => { invalidateLoad(); window.cancelAnimationFrame(frame); }; }, [load, invalidateLoad]);

  async function openRecord(record: ApiAttendance) {
    setSelected(record);
    setDraftStatus(record.status);
    setClockIn(dateTimeInManila(record.clockIn));
    setClockOut(dateTimeInManila(record.clockOut));
    setReason("");
    setCorrections([]);
    setError("");
    try {
      const response = await apiRequest(`/api/attendance/${record.id}/corrections`, { cache: "no-store" });
      const body = await readApiBody<{ success: boolean; corrections?: ApiAttendanceCorrection[]; message?: string }>(response);
      if (!response.ok || !body?.success) throw new Error(body?.message ?? "Unable to load correction history");
      setCorrections(body.corrections ?? []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load correction history"); }
  }

  async function saveCorrection(event: FormEvent) {
    event.preventDefault();
    if (!selected || !reason.trim()) { setError("A correction reason is required"); return; }
    setSaving(true); setError("");
    try {
      const response = await apiRequest(`/api/attendance/${selected.id}/corrections`, { method: "POST", body: JSON.stringify({
        status: draftStatus, clockIn: toInstant(clockIn), clockOut: toInstant(clockOut), reason: reason.trim(),
      }) });
      const body = await readApiBody<{ success: boolean; attendance?: ApiAttendance; message?: string }>(response);
      if (!response.ok || !body?.success || !body.attendance) throw new Error(body?.message ?? "Unable to save correction");
      await load();
      setSelected(body.attendance);
      setReason("");
      const history = await apiRequest(`/api/attendance/${selected.id}/corrections`, { cache: "no-store" });
      const historyBody = await readApiBody<{ success: boolean; corrections?: ApiAttendanceCorrection[]; message?: string }>(history);
      if (history.ok && historyBody?.success) setCorrections(historyBody.corrections ?? []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save correction"); }
    finally { setSaving(false); }
  }

  const historicalBarbers = new Map(barbers.map((barber) => [barber.id, `${barber.firstName} ${barber.lastName}`]));
  records.forEach((record) => historicalBarbers.set(record.barberId, record.barberName));
  return <div className="operational-workspace">
    <PageHeader title="Barber attendance" description="Review daily records and correct attendance with a reason." action={<Button variant="secondary" icon="refresh" onClick={() => void load()} disabled={loading}>Refresh</Button>} />
    <Panel className="operational-panel">
      <FilterToolbar resultCount={records.length} filters={<>
        <TextField label="Date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        <SelectField label="Barber" value={barberId} onChange={(event) => setBarberId(event.target.value)}><option value="">All barbers</option>{[...historicalBarbers].map(([id, name]) => <option key={id} value={id}>{name}</option>)}</SelectField>
        <SelectField label="Status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option><option value="present">Present</option><option value="late">Late</option><option value="absent">Absent</option></SelectField>
        <Button variant="secondary" onClick={() => setDate(todayInManila())}>Today</Button>
        <Button variant="secondary" onClick={() => setDate("")}>All dates</Button>
      </>} />
      {error && !selected && <p role="alert" className="operational-loading">{error}</p>}
      {loading ? <p role="status" className="operational-loading">Loading attendance…</p> : records.length === 0 ? <EmptyState icon="calendar" title="No attendance records" description="Change the filters or record today's attendance on the Barber Floor." /> :
        <ResponsiveTable headers={["Date", "Barber", "Attendance", "Clock In", "Clock Out", "Details"]}>
          {records.map((record) => <tr key={record.id}><td>{record.date}</td><td>{record.barberName}</td><td><Badge tone={record.status === "present" ? "success" : record.status === "late" ? "warning" : "danger"}>{record.status}</Badge></td><td>{clockLabel(record.clockIn)}</td><td>{clockLabel(record.clockOut)}</td><td><Button size="sm" variant="secondary" onClick={() => void openRecord(record)}>View record</Button></td></tr>)}
        </ResponsiveTable>}
    </Panel>
    <Modal open={Boolean(selected)} title={selected ? `${selected.barberName} · ${selected.date}` : "Attendance"} onClose={() => { setSelected(null); setError(""); }} width="lg">
      {selected && <div className="attendance-detail">
        <p>Recorded by staff #{selected.recordedBy} · Last updated by staff #{selected.updatedBy}</p>
        <p>Current: {selected.status} · In {clockLabel(selected.clockIn)} · Out {clockLabel(selected.clockOut)}</p>
        <form onSubmit={(event) => void saveCorrection(event)} className="attendance-correction-form">
          <SelectField label="Corrected status" value={draftStatus} onChange={(event) => setDraftStatus(event.target.value as ApiAttendance["status"])}><option value="present">Present</option><option value="late">Late</option><option value="absent">Absent</option></SelectField>
          <TextField label="Clock In (Manila)" type="datetime-local" value={clockIn} onChange={(event) => setClockIn(event.target.value)} />
          <TextField label="Clock Out (Manila)" type="datetime-local" value={clockOut} onChange={(event) => setClockOut(event.target.value)} />
          <TextField label="Correction reason" required value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} />
          {error && <p role="alert">{error}</p>}
          <Button type="submit" disabled={saving}>Save correction</Button>
        </form>
        <h3>Correction history</h3>
        {corrections.length === 0 ? <p>No corrections recorded.</p> : corrections.map((entry) => <div key={entry.id} className="attendance-audit-entry">
          <strong>{entry.correctedByName} · {clockLabel(entry.createdAt)}</strong><p>{entry.reason}</p>
          <p>Before: {entry.previousValues.status}, {clockLabel(entry.previousValues.clockIn)} – {clockLabel(entry.previousValues.clockOut)}</p>
          <p>After: {entry.newValues.status}, {clockLabel(entry.newValues.clockIn)} – {clockLabel(entry.newValues.clockOut)}</p>
        </div>)}
      </div>}
    </Modal>
  </div>;
}
