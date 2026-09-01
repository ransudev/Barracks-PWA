"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { ApiInventoryItem } from "@/app/lib/api";
import { apiRequest, readApiBody } from "@/app/lib/api";
import { formatCurrency } from "@/app/utils/format";
import {
  Badge,
  Button,
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

function stockStatus(item: ApiInventoryItem) {
  if (item.quantity === 0) return "Out of stock";
  return item.quantity <= item.minimumStock ? "Low stock" : "In stock";
}

function statusTone(item: ApiInventoryItem): "danger" | "warning" | "success" {
  return item.quantity === 0 ? "danger" : item.quantity <= item.minimumStock ? "warning" : "success";
}

export function InventoryPage({ onToast, admin = false, canDelete }: { onToast: (message: string) => void; admin?: boolean; canDelete: boolean }) {
  const [items, setItems] = useState<ApiInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All categories");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ApiInventoryItem | null>(null);
  const [form, setForm] = useState<ItemForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const response = await apiRequest("/api/inventory");
        const body = await readApiBody<{ success: boolean; items?: ApiInventoryItem[]; message?: string }>(response);
        if (!response.ok || !body?.success || !body.items) throw new Error(body?.message ?? "Unable to load inventory");
        setItems(body.items);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to load inventory";
        setLoadError(message);
        onToast(message);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [onToast]);

  const filtered = items.filter((item) =>
    `${item.name} ${item.category}`.toLowerCase().includes(search.toLowerCase()) &&
    (category === "All categories" || item.category === category),
  );
  const lowStock = items.filter((item) => item.quantity > 0 && item.quantity <= item.minimumStock);
  const outOfStock = items.filter((item) => item.quantity === 0);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
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
    setModalOpen(true);
  }

  async function saveItem(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        category: form.category,
        quantity: Number(form.quantity),
        minimumStock: Number(form.minimumStock),
        unitCost: Number(form.unitCost),
      };
      const response = await apiRequest(editing ? `/api/inventory/${editing.id}` : "/api/inventory", {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      const body = await readApiBody<{ success: boolean; item?: ApiInventoryItem; message?: string }>(response);
      if (!response.ok || !body?.success || !body.item) throw new Error(body?.message ?? "Unable to save inventory item");
      const savedItem = body.item;
      setItems((current) => editing ? current.map((item) => item.id === savedItem.id ? savedItem : item) : [savedItem, ...current]);
      setModalOpen(false);
      onToast(`${savedItem.name} ${editing ? "updated" : "added to inventory"}`);
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Unable to save inventory item");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteItem(item: ApiInventoryItem) {
    if (!window.confirm(`Delete ${item.name} from inventory?`)) return;
    const response = await apiRequest(`/api/inventory/${item.id}`, { method: "DELETE" });
    const body = await readApiBody<{ success: boolean; message?: string }>(response);
    if (!response.ok || !body?.success) {
      onToast(body?.message ?? "Unable to delete inventory item");
      return;
    }
    setItems((current) => current.filter((entry) => entry.id !== item.id));
    onToast(`${item.name} removed from inventory`);
  }

  return (
    <>
      <PageHeader title={admin ? "Inventory management" : "Inventory"} action={<Button icon="plus" onClick={openCreate}>Add item</Button>} />
      <div className="metrics-grid metrics-grid--four">
        <MetricCard label="Total items" value={String(items.length)} icon="box" accent="blue" />
        <MetricCard label="In stock" value={String(items.filter((item) => item.quantity > item.minimumStock).length)} icon="check" accent="green" />
        <MetricCard label="Low stock" value={String(lowStock.length)} icon="info" accent="amber" />
        <MetricCard label="Out of stock" value={String(outOfStock.length)} icon="x" accent="red" />
      </div>

      {(lowStock.length > 0 || outOfStock.length > 0) && <div className="alert-banner"><span className="alert-banner__icon"><Icon name="info" size={17} /></span><span><strong>Stock needs attention.</strong><small>{[...outOfStock, ...lowStock].map((item) => item.name).join(", ")}</small></span></div>}

      <Panel className="inventory-panel">
        <SectionHeading title="Stock levels" action={<div className="panel-toolbar"><SearchInput value={search} onChange={setSearch} placeholder="Search stock" /><SelectField value={category} onChange={(event) => setCategory(event.target.value)}><option>All categories</option><option>Supplies</option><option>Equipment</option><option>Products</option></SelectField></div>} />
        <div className="inventory-table">
          <div className="inventory-table__head"><span>Item</span><span>Category</span><span>Current</span><span>Min level</span><span>Stock status</span><span>Actions</span></div>
          {loading ? <div className="staff-table__empty">Loading inventory…</div> : loadError ? <div className="staff-table__empty">{loadError}</div> : filtered.map((item) => <div className="inventory-table__row" key={item.id}>
            <span><strong>{item.name}</strong><small>{formatCurrency(item.unitCost)} / unit</small></span>
            <span>{item.category}</span>
            <span className={item.quantity <= item.minimumStock ? "text-red" : "text-strong"}>{item.quantity}</span>
            <span>{item.minimumStock}</span>
            <span><Badge tone={statusTone(item)}>{stockStatus(item)}</Badge></span>
            <span className="row-actions">
              <button className="row-action row-action--icon" type="button" onClick={() => openEdit(item)} aria-label={`Edit ${item.name}`} title={`Edit ${item.name}`}><Icon name="edit" size={16} /></button>
              {canDelete && <button className="row-action row-action--icon row-action--danger" type="button" onClick={() => void deleteItem(item)} aria-label={`Delete ${item.name}`} title={`Delete ${item.name}`}><Icon name="trash" size={16} /></button>}
            </span>
          </div>)}
        </div>
        {!loading && !loadError && filtered.length === 0 && <EmptyState icon="box" title="No stock matches" description="Try a different item name or category." />}
      </Panel>

      <Modal open={modalOpen} title={editing ? "Edit inventory item" : "Add inventory item"} description="Keep quantities and minimum levels current for the shop team." onClose={() => !submitting && setModalOpen(false)}>
        <form className="modal-form" onSubmit={saveItem}>
          <TextField label="Item name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Neck strips" />
          <div className="form-grid form-grid--three">
            <SelectField label="Category" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as ItemForm["category"] })}><option>Supplies</option><option>Equipment</option><option>Products</option></SelectField>
            <TextField label="Quantity" type="number" min="0" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} />
            <TextField label="Minimum stock" type="number" min="0" value={form.minimumStock} onChange={(event) => setForm({ ...form, minimumStock: event.target.value })} />
          </div>
          <TextField label="Unit cost" type="number" min="0" step="0.01" value={form.unitCost} onChange={(event) => setForm({ ...form, unitCost: event.target.value })} />
          <div className="modal-actions"><Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>Cancel</Button><Button type="submit" icon="check" disabled={submitting}>{submitting ? "Saving…" : "Save item"}</Button></div>
        </form>
      </Modal>
    </>
  );
}
