"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { ApiInventoryItem } from "@/app/lib/api";
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

type ItemForm = {
  name: string;
  category: ApiInventoryItem["category"];
  quantity: string;
  minimumStock: string;
  unitCost: string;
};

const emptyForm: ItemForm = {
  name: "",
  category: "Supplies",
  quantity: "0",
  minimumStock: "10",
  unitCost: "0",
};

function stockStatus(item: ApiInventoryItem): StockFilter {
  if (item.quantity === 0) return "out_of_stock";
  return item.quantity <= item.minimumStock ? "low_stock" : "in_stock";
}

function stockStatusLabel(status: StockFilter): string {
  return status === "out_of_stock" ? "Out of stock" : status === "low_stock" ? "Low stock" : "In stock";
}

function statusTone(item: ApiInventoryItem): "danger" | "warning" | "success" {
  const status = stockStatus(item);
  return status === "out_of_stock" ? "danger" : status === "low_stock" ? "warning" : "success";
}

function responseMessage(body: { message?: string; errors?: Record<string, string[]> } | null, fallback: string): string {
  const validationMessage = body?.errors ? Object.values(body.errors).flat().join(" ") : "";
  return validationMessage || body?.message || fallback;
}

function parseNumber(value: string, label: string, integer = false): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || (integer && !Number.isInteger(parsed)) || parsed < 0) {
    throw new Error(`${label} must be a non-negative ${integer ? "whole number" : "amount"}.`);
  }
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
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState<StockFilter>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ApiInventoryItem | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ApiInventoryItem | null>(null);
  const [form, setForm] = useState<ItemForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState("");

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

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void loadInventory());
    return () => window.cancelAnimationFrame(frame);
  }, [loadInventory]);

  const normalizedSearch = search.trim().toLowerCase();
  const filtered = items.filter((item) => {
    const matchesSearch = !normalizedSearch || `${item.name} ${item.category}`.toLowerCase().includes(normalizedSearch);
    const matchesCategory = category === "all" || item.category === category;
    const matchesStatus = status === "all" || stockStatus(item) === status;
    return matchesSearch && matchesCategory && matchesStatus;
  });
  const lowStock = items.filter((item) => stockStatus(item) === "low_stock");
  const outOfStock = items.filter((item) => stockStatus(item) === "out_of_stock");

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
      quantity: String(item.quantity),
      minimumStock: String(item.minimumStock),
      unitCost: String(item.unitCost),
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
      const payload = {
        name,
        category: form.category,
        quantity: parseNumber(form.quantity, "Quantity", true),
        minimumStock: parseNumber(form.minimumStock, "Minimum stock", true),
        unitCost: parseNumber(form.unitCost, "Unit cost"),
      };
      const response = await apiRequest(editing ? `/api/inventory/${editing.id}` : "/api/inventory", {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      const body = await readApiBody<{ success: boolean; item?: ApiInventoryItem; message?: string; errors?: Record<string, string[]> }>(response);
      if (!response.ok || !body?.success || !body.item) throw new Error(responseMessage(body, "Unable to save inventory item"));
      const savedItem = body.item;
      setItems((current) => editing ? current.map((item) => item.id === savedItem.id ? savedItem : item) : [savedItem, ...current]);
      setModalOpen(false);
      onToast(`${savedItem.name} ${editing ? "updated" : "added to inventory"}`);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to save inventory item");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteItem(item: ApiInventoryItem) {
    setDeleting(true);
    try {
      const response = await apiRequest(`/api/inventory/${item.id}`, { method: "DELETE" });
      const body = await readApiBody<{ success: boolean; message?: string }>(response);
      if (!response.ok || !body?.success) throw new Error(body?.message ?? "Unable to delete inventory item");
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      onToast(`${item.name} removed from inventory`);
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Unable to delete inventory item");
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
        <MetricCard label="In stock" value={String(items.filter((item) => stockStatus(item) === "in_stock").length)} icon="check" accent="green" />
        <MetricCard label="Low stock" value={String(lowStock.length)} icon="info" accent="amber" />
        <MetricCard label="Out of stock" value={String(outOfStock.length)} icon="x" accent="red" />
      </div>

      {(lowStock.length > 0 || outOfStock.length > 0) && <div className="alert-banner" role="status"><span className="alert-banner__icon"><Icon name="info" size={17} /></span><span><strong>Stock needs attention.</strong><small>{[...outOfStock, ...lowStock].map((item) => item.name).join(", ")}</small></span></div>}

      <Panel className="inventory-panel">
        <SectionHeading title="Stock levels" action={<div className="panel-toolbar panel-toolbar--filters"><SearchInput value={search} onChange={setSearch} placeholder="Search stock" /><SelectField value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter inventory by category"><option value="all">All categories</option><option value="Supplies">Supplies</option><option value="Equipment">Equipment</option><option value="Products">Products</option></SelectField><SelectField value={status} onChange={(event) => setStatus(event.target.value as StockFilter)} aria-label="Filter inventory by stock status"><option value="all">All stock statuses</option><option value="in_stock">In stock</option><option value="low_stock">Low stock</option><option value="out_of_stock">Out of stock</option></SelectField></div>} />
        <div className="inventory-table">
          <div className="inventory-table__head"><span>Item</span><span>Category</span><span>Current</span><span>Min level</span><span>Stock status</span><span>Actions</span></div>
          {loading ? <div className="staff-table__empty" role="status">Loading inventory…</div> : loadError ? <div className="staff-table__empty" role="alert">{loadError}</div> : filtered.length ? filtered.map((item) => <div className="inventory-table__row" key={item.id}>
            <span><strong>{item.name}</strong><small>{formatCurrency(item.unitCost)} / unit</small></span>
            <span>{item.category}</span>
            <span className={item.quantity <= item.minimumStock ? "text-red" : "text-strong"}>{item.quantity}</span>
            <span>{item.minimumStock}</span>
            <span><Badge tone={statusTone(item)}>{stockStatusLabel(stockStatus(item))}</Badge></span>
            <span className="row-actions"><button className="row-action row-action--icon" type="button" onClick={() => openEdit(item)} aria-label={`Edit ${item.name}`} title={`Edit ${item.name}`}><Icon name="edit" size={16} /></button>{canDelete && <button className="row-action row-action--icon row-action--danger" type="button" onClick={() => setPendingDelete(item)} aria-label={`Delete ${item.name}`} title={`Delete ${item.name}`}><Icon name="trash" size={16} /></button>}</span>
          </div>) : <EmptyState icon="box" title="No stock matches" description="Try a different item name, category, or stock status." action={<Button size="sm" icon="plus" onClick={openCreate}>Add item</Button>} />}
        </div>
      </Panel>

      <Modal open={modalOpen} title={editing ? "Edit inventory item" : "Add inventory item"} onClose={closeEditor}>
        <form className="modal-form" onSubmit={saveItem}>
          <TextField label="Item name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Neck strips" />
          <div className="form-grid form-grid--three"><SelectField label="Category" required value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as ItemForm["category"] })}><option>Supplies</option><option>Equipment</option><option>Products</option></SelectField><TextField label="Quantity" required type="number" min="0" step="1" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /><TextField label="Minimum stock" required type="number" min="0" step="1" value={form.minimumStock} onChange={(event) => setForm({ ...form, minimumStock: event.target.value })} /></div>
          <TextField label="Unit cost" required type="number" min="0" step="0.01" value={form.unitCost} onChange={(event) => setForm({ ...form, unitCost: event.target.value })} />
          {formError && <p className="form-error" role="alert">{formError}</p>}
          <div className="modal-actions"><Button variant="secondary" type="button" disabled={submitting} onClick={closeEditor}>Cancel</Button><Button type="submit" icon="check" disabled={submitting}>{submitting ? "Saving…" : "Save item"}</Button></div>
        </form>
      </Modal>

      <ConfirmDialog open={Boolean(pendingDelete)} title="Delete this inventory item?" description={pendingDelete ? `${pendingDelete.name} will be removed from the inventory records. This cannot be undone.` : undefined} confirmLabel="Delete item" danger busy={deleting} onClose={() => !deleting && setPendingDelete(null)} onConfirm={() => pendingDelete && void deleteItem(pendingDelete)} />
    </>
  );
}
