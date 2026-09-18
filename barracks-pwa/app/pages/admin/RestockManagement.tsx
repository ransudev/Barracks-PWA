"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { ApiInventoryItem, ApiSupplier } from "@/app/lib/api";
import { apiRequest, readApiBody } from "@/app/lib/api";
import { Badge, Button, EmptyState, MetricCard, Modal, PageHeader, Panel, SelectField, TextField } from "@/app/components/ui";

type RestockItem = {
  id: number;
  inventoryItemId: number;
  itemName: string;
  branch: string;
  requestedQuantity: number;
  deliveredQuantity: number | null;
  unitCost: number | string | null;
};

type Restock = {
  id: number;
  supplier_id: number;
  supplier_name: string;
  status: "Pending" | "Accepted" | "Preparing" | "Shipped" | "Delivered" | "Received" | "Cancelled";
  branch: string;
  reference: string | null;
  notes: string;
  created_at: string;
  received_at: string | null;
  items: RestockItem[];
};

type DraftLine = { key: number; inventoryItemId: string; quantity: string; unitCost: string };
type CreateForm = { supplierId: string; branch: string; items: DraftLine[]; reference: string; notes: string };
type ReceiveLine = { id: number; deliveredQuantity: string; unitCost: string };

const emptyCreate: CreateForm = {
  supplierId: "",
  branch: "",
  items: [{ key: 1, inventoryItemId: "", quantity: "1", unitCost: "" }],
  reference: "",
  notes: "",
};

function responseMessage(body: { message?: string; errors?: Record<string, string[]> } | null, fallback: string): string {
  const validationMessage = body?.errors ? Object.values(body.errors).flat().filter(Boolean).join(" ") : "";
  return validationMessage || body?.message || fallback;
}

export function RestockManagement({ onToast }: { onToast: (message: string) => void }) {
  const [restocks, setRestocks] = useState<Restock[]>([]);
  const [suppliers, setSuppliers] = useState<ApiSupplier[]>([]);
  const [inventory, setInventory] = useState<ApiInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(emptyCreate);
  const [creating, setCreating] = useState(false);
  const [receiving, setReceiving] = useState<Restock | null>(null);
  const [receiveLines, setReceiveLines] = useState<ReceiveLine[]>([]);
  const [receiveReference, setReceiveReference] = useState("");
  const [receiveNotes, setReceiveNotes] = useState("");
  const [receiveSubmitting, setReceiveSubmitting] = useState(false);
  const [markingDelivered, setMarkingDelivered] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [restockResponse, supplierResponse, inventoryResponse] = await Promise.all([
        apiRequest("/api/restocks", { cache: "no-store" }),
        apiRequest("/api/suppliers", { cache: "no-store" }),
        apiRequest("/api/inventory", { cache: "no-store" }),
      ]);
      const restockBody = await readApiBody<{ success: boolean; restocks?: Restock[]; message?: string }>(restockResponse);
      const supplierBody = await readApiBody<{ success: boolean; suppliers?: ApiSupplier[]; message?: string }>(supplierResponse);
      const inventoryBody = await readApiBody<{ success: boolean; items?: ApiInventoryItem[]; message?: string }>(inventoryResponse);
      if (!restockResponse.ok || !restockBody?.success) throw new Error(restockBody?.message ?? "Unable to load restock requests");
      if (!supplierResponse.ok || !supplierBody?.success) throw new Error(supplierBody?.message ?? "Unable to load suppliers");
      if (!inventoryResponse.ok || !inventoryBody?.success) throw new Error(inventoryBody?.message ?? "Unable to load inventory");
      setRestocks(restockBody.restocks ?? []);
      setSuppliers(supplierBody.suppliers ?? []);
      setInventory(inventoryBody.items ?? []);
      setLoadError("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load restock requests";
      setLoadError(message);
      onToast(message);
    } finally {
      setLoading(false);
    }
  }, [onToast]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => { void load(); });
    return () => window.cancelAnimationFrame(frame);
  }, [load]);

  const supplierBranches = useMemo(
    () => [...new Set(inventory.filter((item) => item.status === "active" && item.supplierId === Number(createForm.supplierId)).map((item) => item.branch))].sort(),
    [createForm.supplierId, inventory],
  );

  function itemsForLine(lineKey: number) {
    const selectedElsewhere = new Set(createForm.items.filter((line) => line.key !== lineKey).map((line) => Number(line.inventoryItemId)));
    return inventory.filter((item) => item.status === "active"
      && item.supplierId === Number(createForm.supplierId)
      && item.branch === createForm.branch
      && !selectedElsewhere.has(item.id));
  }

  function openCreate() {
    setCreateForm({ ...emptyCreate, items: [{ ...emptyCreate.items[0], key: Date.now() }] });
    setCreateOpen(true);
  }

  function updateLine(key: number, patch: Partial<DraftLine>) {
    setCreateForm((current) => ({
      ...current,
      items: current.items.map((line) => line.key === key ? { ...line, ...patch } : line),
    }));
  }

  function chooseItem(key: number, value: string) {
    const item = inventory.find((candidate) => candidate.id === Number(value));
    updateLine(key, { inventoryItemId: value, unitCost: item ? String(item.unitCost) : "" });
  }

  function addLine() {
    setCreateForm((current) => ({
      ...current,
      items: [...current.items, { key: Date.now() + current.items.length, inventoryItemId: "", quantity: "1", unitCost: "" }],
    }));
  }

  function removeLine(key: number) {
    setCreateForm((current) => ({
      ...current,
      items: current.items.length === 1 ? current.items : current.items.filter((line) => line.key !== key),
    }));
  }

  async function createRestock(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    try {
      const supplierId = Number(createForm.supplierId);
      if (!supplierId || !createForm.branch) throw new Error("Choose a supplier and branch");
      if (!createForm.items.length) throw new Error("Add at least one inventory item");
      const selectedIds = createForm.items.map((line) => Number(line.inventoryItemId));
      if (selectedIds.some((id) => !Number.isInteger(id) || id <= 0)) throw new Error("Choose an inventory item for every line");
      if (new Set(selectedIds).size !== selectedIds.length) throw new Error("An item can only appear once per request");
      const items = createForm.items.map((line) => {
        const quantity = Number(line.quantity);
        if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("Requested quantities must be positive whole numbers");
        const unitCost = line.unitCost.trim() ? Number(line.unitCost) : null;
        if (unitCost !== null && (!Number.isFinite(unitCost) || unitCost < 0)) throw new Error("Unit costs must be non-negative amounts");
        return { inventoryItemId: Number(line.inventoryItemId), requestedQuantity: quantity, unitCost };
      });
      const response = await apiRequest("/api/restocks", {
        method: "POST",
        body: JSON.stringify({ supplierId, branch: createForm.branch, reference: createForm.reference.trim() || null, notes: createForm.notes.trim(), items }),
      });
      const body = await readApiBody<{ success: boolean; message?: string; errors?: Record<string, string[]> }>(response);
      if (!response.ok || !body?.success) throw new Error(responseMessage(body, "Unable to create restock request"));
      setCreateOpen(false);
      onToast("Restock request sent to supplier");
      await load();
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Unable to create restock request");
    } finally {
      setCreating(false);
    }
  }

  async function markDelivered(restock: Restock) {
    setMarkingDelivered(restock.id);
    try {
      const response = await apiRequest(`/api/restocks/${restock.id}/delivered`, { method: "POST" });
      const body = await readApiBody<{ success: boolean; message?: string }>(response);
      if (!response.ok || !body?.success) throw new Error(body?.message ?? "Unable to confirm delivery");
      onToast(`Restock #${restock.id} marked Delivered`);
      await load();
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Unable to confirm delivery");
    } finally {
      setMarkingDelivered(null);
    }
  }

  function openReceive(restock: Restock) {
    setReceiving(restock);
    setReceiveLines(restock.items.map((item) => ({ id: item.id, deliveredQuantity: String(item.requestedQuantity), unitCost: item.unitCost === null || item.unitCost === undefined ? "" : String(item.unitCost) })));
    setReceiveReference(restock.reference ?? "");
    setReceiveNotes("");
  }

  async function receive(event: FormEvent) {
    event.preventDefault();
    if (!receiving) return;
    setReceiveSubmitting(true);
    try {
      const items = receiveLines.map((line) => {
        const deliveredQuantity = Number(line.deliveredQuantity);
        const unitCost = line.unitCost.trim() ? Number(line.unitCost) : null;
        if (!Number.isInteger(deliveredQuantity) || deliveredQuantity < 0) throw new Error("Delivered quantities must be whole numbers");
        if (unitCost !== null && (!Number.isFinite(unitCost) || unitCost < 0)) throw new Error("Unit costs must be non-negative amounts");
        return { restockRequestItemId: line.id, deliveredQuantity, unitCost };
      });
      const response = await apiRequest(`/api/restocks/${receiving.id}/receive`, {
        method: "POST",
        body: JSON.stringify({ reference: receiveReference.trim() || null, notes: receiveNotes.trim(), items }),
      });
      const body = await readApiBody<{ success: boolean; message?: string }>(response);
      if (!response.ok || !body?.success) throw new Error(body?.message ?? "Unable to receive delivery");
      setReceiving(null);
      onToast("Delivery received and inventory updated");
      await load();
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Unable to receive delivery");
    } finally {
      setReceiveSubmitting(false);
    }
  }

  const pending = restocks.filter((restock) => !["Received", "Cancelled"].includes(restock.status));
  const delivered = restocks.filter((restock) => restock.status === "Delivered");
  const received = restocks.filter((restock) => restock.status === "Received");

  return <>
    <PageHeader title="Restock requests" action={<Button icon="plus" onClick={openCreate}>New request</Button>} />
    <div className="metrics-grid metrics-grid--four"><MetricCard label="Open requests" value={String(pending.length)} icon="info" accent="amber" /><MetricCard label="Ready to receive" value={String(delivered.length)} icon="box" accent="blue" /><MetricCard label="Received" value={String(received.length)} icon="check" accent="green" /><MetricCard label="Suppliers" value={String(suppliers.filter((supplier) => supplier.status === "active").length)} icon="users" accent="violet" /></div>
    <Panel>
      <div className="staff-table staff-table--cols-6"><div className="staff-table__head"><span>Request</span><span>Supplier</span><span>Branch</span><span>Items</span><span>Status</span><span>Actions</span></div>
        {loading ? <div className="staff-table__empty">Loading restock requests…</div> : loadError ? <div className="staff-table__empty" role="alert">{loadError}</div> : restocks.length ? restocks.map((restock) => <div className="staff-table__row" key={restock.id}><span><strong>#{restock.id}</strong><small>{restock.reference ?? new Date(restock.created_at).toLocaleDateString()}</small></span><span>{restock.supplier_name}</span><span>{restock.branch}</span><span>{restock.items.map((item) => `${item.itemName} × ${item.requestedQuantity}`).join(", ")}</span><span><Badge tone={restock.status === "Received" ? "success" : restock.status === "Cancelled" ? "danger" : "warning"}>{restock.status}</Badge></span><span>{restock.status === "Shipped" ? <Button size="sm" disabled={markingDelivered === restock.id} onClick={() => void markDelivered(restock)}>{markingDelivered === restock.id ? "Confirming…" : "Mark delivered"}</Button> : restock.status === "Delivered" ? <Button size="sm" onClick={() => openReceive(restock)}>Receive</Button> : null}</span></div>) : <EmptyState icon="box" title="No restock requests" description="Create a request from supplier-linked inventory items." action={<Button size="sm" onClick={openCreate}>New request</Button>} />}
      </div>
    </Panel>

    <Modal open={createOpen} title="Create restock request" onClose={() => !creating && setCreateOpen(false)}>
      <form className="modal-form" onSubmit={createRestock}>
        <SelectField required label="Supplier" value={createForm.supplierId} onChange={(event) => setCreateForm({ ...createForm, supplierId: event.target.value, branch: "", items: [{ key: Date.now(), inventoryItemId: "", quantity: "1", unitCost: "" }] })}><option value="">Choose supplier</option>{suppliers.filter((supplier) => supplier.status === "active").map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.companyName}</option>)}</SelectField>
        <SelectField required label="Branch" value={createForm.branch} onChange={(event) => setCreateForm({ ...createForm, branch: event.target.value, items: createForm.items.map((line) => ({ ...line, inventoryItemId: "", unitCost: "" })) })}><option value="">Choose branch</option>{supplierBranches.map((branch) => <option key={branch} value={branch}>{branch}</option>)}</SelectField>
        <div className="modal-form__section"><div className="section-heading"><div><h3>Request items</h3><p className="form-hint">Items are limited to the selected supplier and branch. Each item may appear once.</p></div><Button type="button" variant="secondary" size="sm" icon="plus" onClick={addLine}>Add item</Button></div>
          {createForm.items.map((line, index) => <div className="form-grid form-grid--three" key={line.key}><SelectField required label={`Item ${index + 1}`} value={line.inventoryItemId} onChange={(event) => chooseItem(line.key, event.target.value)}><option value="">Choose item</option>{itemsForLine(line.key).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.quantity} {item.unit} · min {item.minimumStock}</option>)}</SelectField><TextField required label="Quantity" type="number" min="1" step="1" value={line.quantity} onChange={(event) => updateLine(line.key, { quantity: event.target.value })} /><div><TextField label="Expected unit cost" type="number" min="0" step="0.01" value={line.unitCost} onChange={(event) => updateLine(line.key, { unitCost: event.target.value })} /><Button type="button" variant="ghost" size="sm" disabled={createForm.items.length === 1} onClick={() => removeLine(line.key)}>Remove line</Button></div></div>)}
        </div>
        <TextField label="Reference" value={createForm.reference} onChange={(event) => setCreateForm({ ...createForm, reference: event.target.value })} /><TextField label="Notes" value={createForm.notes} onChange={(event) => setCreateForm({ ...createForm, notes: event.target.value })} />
        <div className="modal-actions"><Button type="button" variant="secondary" disabled={creating} onClick={() => setCreateOpen(false)}>Cancel</Button><Button type="submit" disabled={creating}>{creating ? "Sending…" : "Send request"}</Button></div>
      </form>
    </Modal>

    <Modal open={Boolean(receiving)} title={receiving ? `Receive request #${receiving.id}` : "Receive delivery"} onClose={() => !receiveSubmitting && setReceiving(null)}>
      <form className="modal-form" onSubmit={receive}>
        {receiving?.items.map((item) => { const line = receiveLines.find((entry) => entry.id === item.id); return <div className="form-grid" key={item.id}><TextField label={`${item.itemName} delivered`} type="number" min="0" step="1" value={line?.deliveredQuantity ?? "0"} onChange={(event) => setReceiveLines((current) => current.map((entry) => entry.id === item.id ? { ...entry, deliveredQuantity: event.target.value } : entry))} /><TextField label="Unit cost" type="number" min="0" step="0.01" value={line?.unitCost ?? ""} onChange={(event) => setReceiveLines((current) => current.map((entry) => entry.id === item.id ? { ...entry, unitCost: event.target.value } : entry))} /></div>; })}
        <TextField label="Reference number" value={receiveReference} onChange={(event) => setReceiveReference(event.target.value)} /><TextField label="Notes" value={receiveNotes} onChange={(event) => setReceiveNotes(event.target.value)} />
        <p className="form-hint">Receiving updates every line transactionally and writes RECEIVE history with the item, supplier, branch, timestamp, and responsible user. A delivered request cannot be received twice.</p>
        <div className="modal-actions"><Button type="button" variant="secondary" disabled={receiveSubmitting} onClick={() => setReceiving(null)}>Cancel</Button><Button type="submit" disabled={receiveSubmitting}>{receiveSubmitting ? "Receiving…" : "Confirm receiving"}</Button></div>
      </form>
    </Modal>
  </>;
}
