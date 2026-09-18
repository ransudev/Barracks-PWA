"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { ApiInventoryItem, ApiSupplier } from "@/app/lib/api";
import { apiRequest, readApiBody } from "@/app/lib/api";
import { formatCurrency } from "@/app/utils/format";
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  MetricCard,
  Modal,
  PageHeader,
  Panel,
  SearchInput,
  SectionHeading,
  SelectField,
  TextField,
} from "@/app/components/ui";
import { Icon } from "@/app/components/ui/icons";

type StockFilter = "all" | "in_stock" | "low_stock" | "out_of_stock";
type MovementType = "RECEIVE" | "USE" | "CUSTOMER_PURCHASE" | "STAFF_USAGE" | "DAMAGE" | "DISCARD" | "RETURN" | "ADJUSTMENT";

type ItemForm = {
  name: string;
  category: ApiInventoryItem["category"];
  branch: string;
  initialQuantity: string;
  minimumStock: string;
  maximumStock: string;
  unitCost: string;
  unit: string;
  sku: string;
  supplierId: string;
  status: "active" | "inactive";
};

type MovementForm = {
  movementType: MovementType;
  quantity: string;
  unitCost: string;
  reference: string;
  notes: string;
  adjustmentDirection: "increase" | "decrease";
};

type Movement = {
  id: number;
  movement_type: MovementType;
  quantity: number;
  previous_stock: number;
  new_stock: number;
  reference: string | null;
  notes: string;
  created_by_name: string;
  branch: string;
  created_at: string;
};

const emptyForm: ItemForm = {
  name: "",
  category: "Supplies",
  branch: "Main Branch",
  initialQuantity: "0",
  minimumStock: "10",
  maximumStock: "",
  unitCost: "0",
  unit: "unit",
  sku: "",
  supplierId: "",
  status: "active",
};

const emptyMovement: MovementForm = {
  movementType: "STAFF_USAGE",
  quantity: "1",
  unitCost: "",
  reference: "",
  notes: "",
  adjustmentDirection: "increase",
};

function stockStatus(item: ApiInventoryItem): StockFilter {
  if (item.quantity === 0) return "out_of_stock";
  return item.quantity <= item.minimumStock ? "low_stock" : "in_stock";
}

function stockStatusLabel(status: StockFilter): string {
  return status === "out_of_stock" ? "Out of stock" : status === "low_stock" ? "Low stock" : "In stock";
}

function movementLabel(type: MovementType): string {
  const labels: Record<MovementType, string> = {
    RECEIVE: "Received stock",
    USE: "Used stock",
    CUSTOMER_PURCHASE: "Sold to customer",
    STAFF_USAGE: "Used by barber",
    DAMAGE: "Damaged stock",
    DISCARD: "Discarded stock",
    RETURN: "Returned stock",
    ADJUSTMENT: "Manual adjustment",
  };
  return labels[type];
}

function statusTone(item: ApiInventoryItem): "danger" | "warning" | "success" {
  const status = stockStatus(item);
  return status === "out_of_stock" ? "danger" : status === "low_stock" ? "warning" : "success";
}

function responseMessage(body: { message?: string; errors?: Record<string, string[]> } | null, fallback: string): string {
  const validationMessage = body?.errors ? Object.values(body.errors).flat().filter(Boolean).join(" ") : "";
  return validationMessage || body?.message || fallback;
}

function parseNumber(value: string, label: string, integer = false): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || (integer && !Number.isInteger(parsed)) || parsed < 0) {
    throw new Error(`${label} must be a non-negative ${integer ? "whole number" : "amount"}.`);
  }
  return parsed;
}

function parsePositiveInt(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${label} must be a positive whole number.`);
  return parsed;
}

export function InventoryPage({
  onToast,
  admin = false,
  canDelete,
}: {
  onToast: (message: string) => void;
  admin?: boolean;
  canDelete: boolean;
}) {
  const [items, setItems] = useState<ApiInventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<ApiSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [status, setStatus] = useState<StockFilter>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ApiInventoryItem | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ApiInventoryItem | null>(null);
  const [form, setForm] = useState<ItemForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState("");
  const [movementItem, setMovementItem] = useState<ApiInventoryItem | null>(null);
  const [movementForm, setMovementForm] = useState<MovementForm>(emptyMovement);
  const [movementSubmitting, setMovementSubmitting] = useState(false);
  const [movementError, setMovementError] = useState("");
  const [historyItem, setHistoryItem] = useState<ApiInventoryItem | null>(null);
  const [history, setHistory] = useState<Movement[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [restockItem, setRestockItem] = useState<ApiInventoryItem | null>(null);
  const [restockQuantity, setRestockQuantity] = useState("1");
  const [restockNotes, setRestockNotes] = useState("");
  const [restockSubmitting, setRestockSubmitting] = useState(false);
  const [restockError, setRestockError] = useState("");
  const [operationsItem, setOperationsItem] = useState<ApiInventoryItem | null>(null);

  const loadInventory = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiRequest("/api/inventory", { cache: "no-store" });
      const body = await readApiBody<{ success: boolean; items?: ApiInventoryItem[]; message?: string }>(response);
      if (!response.ok || !body?.success || !body.items) throw new Error(body?.message ?? "Unable to load inventory");
      setItems(body.items);
      setLoadError("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load inventory";
      setLoadError(message);
      onToast(message);
    } finally {
      setLoading(false);
    }
  }, [onToast]);

  const loadSuppliers = useCallback(async () => {
    try {
      const response = await apiRequest("/api/suppliers", { cache: "no-store" });
      const body = await readApiBody<{ success: boolean; suppliers?: ApiSupplier[] }>(response);
      if (response.ok && body?.success) setSuppliers(body.suppliers ?? []);
    } catch {
      // Inventory remains usable if supplier options fail to load.
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void loadInventory();
      void loadSuppliers();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loadInventory, loadSuppliers]);

  const supplierOptions = useMemo(() => {
    const byId = new Map<number, string>();
    for (const supplier of suppliers) byId.set(supplier.id, supplier.companyName);
    for (const item of items) if (item.supplierId && item.supplierName) byId.set(item.supplierId, item.supplierName);
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [items, suppliers]);
  const branchOptions = useMemo(
    () => [...new Set(items.map((item) => item.branch).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [items],
  );

  const normalizedSearch = search.trim().toLowerCase();
  const filtered = items.filter((item) => {
    const matchesSearch = !normalizedSearch || `${item.name} ${item.category} ${item.supplierName ?? ""} ${item.sku ?? ""} ${item.branch}`.toLowerCase().includes(normalizedSearch);
    const matchesCategory = category === "all" || item.category === category;
    const matchesBranch = branchFilter === "all" || item.branch === branchFilter;
    const matchesSupplier = supplierFilter === "all" || String(item.supplierId ?? "none") === supplierFilter;
    const matchesStatus = status === "all" || stockStatus(item) === status;
    return matchesSearch && matchesCategory && matchesBranch && matchesSupplier && matchesStatus;
  });
  const lowStock = items.filter((item) => item.status === "active" && stockStatus(item) === "low_stock");
  const outOfStock = items.filter((item) => item.status === "active" && stockStatus(item) === "out_of_stock");
  const inventoryValue = items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(item: ApiInventoryItem) {
    setEditing(item);
    setForm({
      name: item.name,
      category: item.category,
      branch: item.branch,
      initialQuantity: String(item.quantity),
      minimumStock: String(item.minimumStock),
      maximumStock: item.maximumStock === null ? "" : String(item.maximumStock),
      unitCost: String(item.unitCost),
      unit: item.unit,
      sku: item.sku ?? "",
      supplierId: item.supplierId === null ? "" : String(item.supplierId),
      status: item.status,
    });
    setFormError("");
    setModalOpen(true);
  }

  function closeEditor() {
    if (submitting) return;
    setModalOpen(false);
    setFormError("");
  }

  async function saveItem(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    setSubmitting(true);
    try {
      const name = form.name.trim();
      if (!name) throw new Error("Item name is required.");
      const basePayload = {
        name,
        category: form.category,
        branch: form.branch.trim() || "Main Branch",
        supplierId: form.supplierId ? Number(form.supplierId) : null,
        unit: form.unit.trim() || "unit",
        sku: form.sku.trim() || null,
        minimumStock: parseNumber(form.minimumStock, "Minimum stock", true),
        maximumStock: form.maximumStock.trim() ? parseNumber(form.maximumStock, "Maximum stock", true) : null,
        unitCost: parseNumber(form.unitCost, "Unit cost"),
        status: form.status,
      };
      const payload = editing ? basePayload : {
        ...basePayload,
        initialQuantity: parseNumber(form.initialQuantity, "Initial quantity", true),
      };
      const response = await apiRequest(editing ? `/api/inventory/${editing.id}` : "/api/inventory", {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      const body = await readApiBody<{ success: boolean; item?: ApiInventoryItem; message?: string; errors?: Record<string, string[]> }>(response);
      if (!response.ok || !body?.success || !body.item) throw new Error(responseMessage(body, "Unable to save inventory item"));
      setModalOpen(false);
      onToast(`${body.item.name} ${editing ? "updated" : "added to inventory"}`);
      await loadInventory();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to save inventory item");
    } finally {
      setSubmitting(false);
    }
  }

  function openMovement(item: ApiInventoryItem, movementType: MovementType) {
    setMovementItem(item);
    setMovementError("");
    setMovementForm({ ...emptyMovement, movementType, unitCost: movementType === "RECEIVE" ? String(item.unitCost) : "" });
  }

  async function submitMovement(event: FormEvent) {
    event.preventDefault();
    if (!movementItem) return;
    setMovementError("");
    setMovementSubmitting(true);
    try {
      if (movementForm.movementType === "ADJUSTMENT" && !movementForm.notes.trim()) throw new Error("A reason is required for manual adjustments.");
      const payload = {
        movementType: movementForm.movementType,
        quantity: parsePositiveInt(movementForm.quantity, "Quantity"),
        supplierId: movementItem.supplierId,
        unitCost: movementForm.unitCost.trim() ? parseNumber(movementForm.unitCost, "Unit cost") : null,
        reference: movementForm.reference.trim() || null,
        notes: movementForm.notes.trim(),
        ...(movementForm.movementType === "ADJUSTMENT" ? { adjustmentDirection: movementForm.adjustmentDirection } : {}),
      };
      const response = await apiRequest(`/api/inventory/${movementItem.id}/movements`, { method: "POST", body: JSON.stringify(payload) });
      const body = await readApiBody<{ success: boolean; message?: string; errors?: Record<string,string[]> }>(response);
      if (!response.ok || !body?.success) throw new Error(responseMessage(body, "Unable to record stock operation"));
      setMovementItem(null);
      onToast(`${movementForm.movementType.replaceAll("_", " ")} recorded for ${movementItem.name}`);
      await loadInventory();
    } catch (error) {
      setMovementError(error instanceof Error ? error.message : "Unable to record stock operation");
    } finally {
      setMovementSubmitting(false);
    }
  }

  async function openHistory(item: ApiInventoryItem) {
    setHistoryItem(item);
    setHistoryLoading(true);
    try {
      const response = await apiRequest(`/api/inventory/${item.id}/movements`, { cache: "no-store" });
      const body = await readApiBody<{ success: boolean; movements?: Movement[]; message?: string }>(response);
      if (!response.ok || !body?.success) throw new Error(body?.message ?? "Unable to load movement history");
      setHistory(body.movements ?? []);
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Unable to load movement history");
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  function openRestock(item: ApiInventoryItem) {
    if (!item.supplierId) { onToast("Assign a supplier before requesting a restock"); return; }
    const target = item.maximumStock ?? Math.max(item.minimumStock * 2, item.quantity + 1);
    setRestockItem(item);
    setRestockQuantity(String(Math.max(1, target - item.quantity)));
    setRestockNotes("");
    setRestockError("");
  }

  function chooseOperation(movementType: MovementType) {
    const item = operationsItem;
    if (!item) return;
    setOperationsItem(null);
    openMovement(item, movementType);
  }

  function chooseRestock() {
    const item = operationsItem;
    if (!item) return;
    setOperationsItem(null);
    openRestock(item);
  }

  async function submitRestock(event: FormEvent) {
    event.preventDefault();
    if (!restockItem?.supplierId) return;
    setRestockSubmitting(true);
    setRestockError("");
    try {
      const requestedQuantity = parsePositiveInt(restockQuantity, "Requested quantity");
      const response = await apiRequest("/api/restocks", {
        method: "POST",
        body: JSON.stringify({
          supplierId: restockItem.supplierId,
          branch: restockItem.branch,
          reference: null,
          notes: restockNotes.trim(),
          items: [{ inventoryItemId: restockItem.id, requestedQuantity, unitCost: restockItem.unitCost }],
        }),
      });
      const body = await readApiBody<{ success:boolean; message?:string; errors?:Record<string,string[]> }>(response);
      if(!response.ok||!body?.success) throw new Error(responseMessage(body,"Unable to create restock request"));
      setRestockItem(null);
      onToast(`Restock request submitted for ${restockItem.name}`);
    } catch(error) {
      setRestockError(error instanceof Error?error.message:"Unable to create restock request");
    } finally {
      setRestockSubmitting(false);
    }
  }

  async function deleteItem(item: ApiInventoryItem) {
    setDeleting(true);
    try {
      const response = await apiRequest(`/api/inventory/${item.id}`, { method: "DELETE" });
      const body = await readApiBody<{ success: boolean; message?: string }>(response);
      if (!response.ok || !body?.success) throw new Error(body?.message ?? "Unable to deactivate inventory item");
      onToast(`${item.name} deactivated or removed`);
      await loadInventory();
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Unable to deactivate inventory item");
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  }

  return (
    <>
      <PageHeader title={admin ? "Inventory management" : "Inventory"} action={<Button icon="plus" onClick={openCreate}>Add item</Button>} />
      <div className="metrics-grid metrics-grid--four">
        <MetricCard label="Total items" value={String(items.length)} icon="box" accent="blue" />
        <MetricCard label="Low stock" value={String(lowStock.length)} icon="info" accent="amber" />
        <MetricCard label="Out of stock" value={String(outOfStock.length)} icon="x" accent="red" />
        <MetricCard label="Inventory value" value={formatCurrency(inventoryValue)} icon="check" accent="green" />
      </div>

      <Panel className="inventory-panel">
          <SectionHeading title="Stock levels" action={<div className="panel-toolbar panel-toolbar--filters"><SearchInput value={search} onChange={setSearch} placeholder="Search stock" /><SelectField value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)} aria-label="Filter inventory by branch"><option value="all">All branches</option>{branchOptions.map((branch) => <option key={branch} value={branch}>{branch}</option>)}</SelectField><SelectField value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter inventory by category"><option value="all">All categories</option><option value="Supplies">Supplies</option><option value="Equipment">Equipment</option><option value="Products">Products</option></SelectField><SelectField value={supplierFilter} onChange={(event) => setSupplierFilter(event.target.value)} aria-label="Filter inventory by supplier"><option value="all">All suppliers</option><option value="none">No supplier</option>{supplierOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</SelectField><SelectField value={status} onChange={(event) => setStatus(event.target.value as StockFilter)} aria-label="Filter inventory by stock status"><option value="all">All stock statuses</option><option value="in_stock">In stock</option><option value="low_stock">Low stock</option><option value="out_of_stock">Out of stock</option></SelectField></div>} />
        <div className="inventory-table">
          <div className="inventory-table__head"><span>Item</span><span>Supplier</span><span>Current</span><span>Min / Max</span><span>Status</span><span>Actions</span></div>
          {loading ? <div className="staff-table__empty" role="status">Loading inventory…</div> : loadError ? <div className="staff-table__empty" role="alert">{loadError}</div> : filtered.length ? filtered.map((item) => <div className="inventory-table__row" key={item.id}>
            <span><strong>{item.name}</strong><small>{item.category} · {item.sku ?? "No SKU"} · {item.branch} · {formatCurrency(item.unitCost)} / {item.unit}</small></span>
            <span>{item.supplierName ?? "Unassigned"}</span>
            <span className={item.quantity <= item.minimumStock ? "text-red" : "text-strong"}>{item.quantity} {item.unit}</span>
            <span>{item.minimumStock} / {item.maximumStock ?? "—"}</span>
            <span><Badge tone={item.status === "inactive" ? "danger" : statusTone(item)}>{item.status === "inactive" ? "Inactive" : stockStatusLabel(stockStatus(item))}</Badge></span>
            <span className="row-actions">
              <button className="row-action row-action--icon" type="button" onClick={() => setOperationsItem(item)} aria-label={`Stock operations for ${item.name}`} title={`Stock operations for ${item.name}`}><Icon name="stockIn" size={16} /></button>
              <button className="row-action row-action--icon" type="button" onClick={() => openEdit(item)} aria-label={`Edit ${item.name}`} title={`Edit ${item.name}`}><Icon name="edit" size={16} /></button>
              <button className="row-action row-action--icon" type="button" onClick={() => void openHistory(item)} aria-label={`History for ${item.name}`} title="Movement history"><Icon name="info" size={16} /></button>
              {canDelete && <button className="row-action row-action--icon row-action--danger" type="button" onClick={() => setPendingDelete(item)} aria-label={`Deactivate ${item.name}`} title={`Deactivate ${item.name}`}><Icon name="trash" size={16} /></button>}
            </span>
          </div>) : <EmptyState icon="box" title="No stock matches" description="Try a different item name, category, supplier, or stock status." action={<Button size="sm" icon="plus" onClick={openCreate}>Add item</Button>} />}
        </div>
      </Panel>

      <Modal open={modalOpen} title={editing ? "Edit inventory item" : "Add inventory item"} onClose={closeEditor}>
        <form className="modal-form" onSubmit={saveItem}>
          <TextField label="Item name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <div className="form-grid form-grid--three"><SelectField label="Category" required value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as ItemForm["category"] })}><option>Supplies</option><option>Equipment</option><option>Products</option></SelectField><TextField label="Branch" required value={form.branch} onChange={(event) => setForm({ ...form, branch: event.target.value })} placeholder="Main Branch" /><TextField label="Unit" required value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} /></div>
          <TextField label="SKU" value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} />
          <SelectField label="Supplier" value={form.supplierId} onChange={(event) => setForm({ ...form, supplierId: event.target.value })}><option value="">No supplier</option>{suppliers.filter((supplier) => supplier.status === "active" || String(supplier.id) === form.supplierId).map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.companyName}</option>)}</SelectField>
          <div className="form-grid form-grid--three">{!editing && <TextField label="Initial quantity" required type="number" min="0" step="1" value={form.initialQuantity} onChange={(event) => setForm({ ...form, initialQuantity: event.target.value })} />}<TextField label="Minimum stock" required type="number" min="0" step="1" value={form.minimumStock} onChange={(event) => setForm({ ...form, minimumStock: event.target.value })} /><TextField label="Maximum stock" type="number" min="0" step="1" value={form.maximumStock} onChange={(event) => setForm({ ...form, maximumStock: event.target.value })} /></div>
          {editing && <p className="form-hint">Current stock is {editing.quantity} {editing.unit}. Use a stock operation to change it. Threshold changes are saved to the audit history.</p>}
          <div className="form-grid"><TextField label="Unit cost" required type="number" min="0" step="0.01" value={form.unitCost} onChange={(event) => setForm({ ...form, unitCost: event.target.value })} /><SelectField label="Status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ItemForm["status"] })}><option value="active">Active</option><option value="inactive">Inactive</option></SelectField></div>
          {formError && <p className="form-error" role="alert">{formError}</p>}
          <div className="modal-actions"><Button variant="secondary" type="button" disabled={submitting} onClick={closeEditor}>Cancel</Button><Button type="submit" icon="check" disabled={submitting}>{submitting ? "Saving…" : "Save item"}</Button></div>
        </form>
      </Modal>

      <Modal open={Boolean(movementItem)} title={movementItem ? `Stock operation · ${movementItem.name}` : "Stock operation"} onClose={() => !movementSubmitting && setMovementItem(null)}>
        <form className="modal-form" onSubmit={submitMovement}>
          <SelectField label="Operation" value={movementForm.movementType} onChange={(event) => setMovementForm({ ...movementForm, movementType: event.target.value as MovementType })}>
            <option value="RECEIVE">Receive stock</option>
            {(movementItem?.category === "Products" || movementItem?.category === "Supplies") && <option value="CUSTOMER_PURCHASE">Sold to customer</option>}
            {(movementItem?.category === "Products" || movementItem?.category === "Supplies") && <option value="STAFF_USAGE">Used by barber</option>}
            <option value="DAMAGE">Damaged stock</option>
            <option value="DISCARD">Discard stock</option>
            <option value="RETURN">Return stock</option>
            <option value="ADJUSTMENT">Manual adjustment</option>
          </SelectField>
          <TextField required label="Quantity" type="number" min="1" step="1" value={movementForm.quantity} onChange={(event) => setMovementForm({ ...movementForm, quantity: event.target.value })} />
          {movementForm.movementType === "ADJUSTMENT" && <SelectField label="Adjustment direction" value={movementForm.adjustmentDirection} onChange={(event) => setMovementForm({ ...movementForm, adjustmentDirection: event.target.value as MovementForm["adjustmentDirection"] })}><option value="increase">Increase</option><option value="decrease">Decrease</option></SelectField>}
          {(movementForm.movementType === "RECEIVE" || movementForm.movementType === "RETURN") && <TextField label="Unit cost" type="number" min="0" step="0.01" value={movementForm.unitCost} onChange={(event) => setMovementForm({ ...movementForm, unitCost: event.target.value })} />}
          <TextField label="Reference" value={movementForm.reference} onChange={(event) => setMovementForm({ ...movementForm, reference: event.target.value })} placeholder="PO, delivery receipt, sale or service ref" />
          <TextField label={movementForm.movementType === "ADJUSTMENT" ? "Reason" : "Notes"} required={movementForm.movementType === "ADJUSTMENT"} value={movementForm.notes} onChange={(event) => setMovementForm({ ...movementForm, notes: event.target.value })} placeholder={movementForm.movementType === "STAFF_USAGE" ? "Barber, service, or purpose" : movementForm.movementType === "CUSTOMER_PURCHASE" ? "Sale or receipt reference" : undefined} />
          {movementError && <p className="form-error" role="alert">{movementError}</p>}
          <div className="modal-actions"><Button variant="secondary" type="button" disabled={movementSubmitting} onClick={() => setMovementItem(null)}>Cancel</Button><Button type="submit" disabled={movementSubmitting}>{movementSubmitting ? "Recording…" : "Record operation"}</Button></div>
        </form>
      </Modal>

      <Modal open={Boolean(restockItem)} title={restockItem ? `Request restock · ${restockItem.name}` : "Request restock"} onClose={() => !restockSubmitting && setRestockItem(null)}>
        <form className="modal-form" onSubmit={submitRestock}>
          {restockItem && <p className="form-hint">Supplier: {restockItem.supplierName ?? "Assigned supplier"} · Branch: {restockItem.branch} · Current stock: {restockItem.quantity} {restockItem.unit}</p>}
          <TextField required label="Requested quantity" type="number" min="1" step="1" value={restockQuantity} onChange={(event)=>setRestockQuantity(event.target.value)} />
          <TextField label="Notes" value={restockNotes} onChange={(event)=>setRestockNotes(event.target.value)} placeholder="Optional restock notes" />
          {restockError && <p className="form-error" role="alert">{restockError}</p>}
          <div className="modal-actions"><Button variant="secondary" type="button" disabled={restockSubmitting} onClick={()=>setRestockItem(null)}>Cancel</Button><Button type="submit" disabled={restockSubmitting}>{restockSubmitting?"Submitting…":"Submit request"}</Button></div>
        </form>
      </Modal>

      <Modal open={Boolean(historyItem)} title={historyItem ? `${historyItem.name} movement history` : "Movement history"} onClose={() => setHistoryItem(null)}>
        {historyLoading ? <p>Loading history…</p> : history.length ? <div className="staff-table staff-table--cols-4">{history.map((movement) => <div className="staff-table__row" key={movement.id}><span><strong>{movementLabel(movement.movement_type)}</strong><small>{new Date(movement.created_at).toLocaleString()} · {movement.created_by_name} · {movement.branch}</small></span><span>{movement.previous_stock} → {movement.new_stock}</span><span>{movement.reference ?? "No reference"}</span><span>{movement.notes || "No notes"}</span></div>)}</div> : <p>No stock movements have been recorded yet.</p>}
      </Modal>

      <Modal open={Boolean(operationsItem)} title={operationsItem ? `Stock operations · ${operationsItem.name}` : "Stock operations"} description="Choose the operation to record for this item." width="sm" onClose={() => setOperationsItem(null)}>
        {operationsItem && <div className="modal-form">
          <p className="modal-copy">{operationsItem.quantity} {operationsItem.unit} on hand · minimum {operationsItem.minimumStock} · {operationsItem.branch}</p>
          <p className="form-hint">Supplies and products can either be used by a barber during a service or sold to a customer. Choose the action that matches what happened.</p>
          <div className="operation-choices">
            <Button variant="secondary" icon="plus" onClick={() => chooseOperation("RECEIVE")}>Receive stock</Button>
            {(operationsItem.category === "Products" || operationsItem.category === "Supplies") && <Button variant="secondary" icon="cash" onClick={() => chooseOperation("CUSTOMER_PURCHASE")}>Sold to customer</Button>}
            {(operationsItem.category === "Products" || operationsItem.category === "Supplies") && <Button variant="secondary" icon="scissors" onClick={() => chooseOperation("STAFF_USAGE")}>Used by barber</Button>}
            {operationsItem.supplierId && <Button variant="secondary" icon="box" onClick={chooseRestock}>Request restock</Button>}
          </div>
          <div className="modal-actions"><Button variant="secondary" type="button" onClick={() => setOperationsItem(null)}>Cancel</Button></div>
        </div>}
      </Modal>

      <ConfirmDialog open={Boolean(pendingDelete)} title="Deactivate this inventory item?" description={pendingDelete ? `${pendingDelete.name} will no longer be active. Items with movement history are kept for audit purposes.` : undefined} confirmLabel="Deactivate item" danger busy={deleting} onClose={() => !deleting && setPendingDelete(null)} onConfirm={() => pendingDelete && void deleteItem(pendingDelete)} />
    </>
  );
}
