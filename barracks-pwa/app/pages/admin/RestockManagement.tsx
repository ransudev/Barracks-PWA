"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { ApiInventoryItem, ApiSupplier } from "@/app/lib/api";
import { apiRequest, readApiBody } from "@/app/lib/api";
import { Badge, Button, EmptyState, MetricCard, Modal, PageHeader, Panel, SelectField, TextField } from "@/app/components/ui";

type RestockItem = {
  id: number;
  inventoryItemId: number;
  itemName: string;
  requestedQuantity: number;
  deliveredQuantity: number | null;
  unitCost: number | string | null;
};

type Restock = {
  id: number;
  supplier_id: number;
  supplier_name: string;
  status: "Pending" | "Accepted" | "Preparing" | "Shipped" | "Delivered" | "Received" | "Cancelled";
  reference: string | null;
  notes: string;
  created_at: string;
  received_at: string | null;
  items: RestockItem[];
};

type CreateForm = { supplierId:string; inventoryItemId:string; quantity:string; unitCost:string; reference:string; notes:string };
type ReceiveLine = { id:number; deliveredQuantity:string; unitCost:string };

const emptyCreate: CreateForm = { supplierId:"",inventoryItemId:"",quantity:"1",unitCost:"",reference:"",notes:"" };

export function RestockManagement({ onToast }:{ onToast:(message:string)=>void }) {
  const [restocks,setRestocks] = useState<Restock[]>([]);
  const [suppliers,setSuppliers] = useState<ApiSupplier[]>([]);
  const [inventory,setInventory] = useState<ApiInventoryItem[]>([]);
  const [loading,setLoading] = useState(true);
  const [createOpen,setCreateOpen] = useState(false);
  const [createForm,setCreateForm] = useState<CreateForm>(emptyCreate);
  const [creating,setCreating] = useState(false);
  const [receiving,setReceiving] = useState<Restock|null>(null);
  const [receiveLines,setReceiveLines] = useState<ReceiveLine[]>([]);
  const [receiveReference,setReceiveReference] = useState("");
  const [receiveNotes,setReceiveNotes] = useState("");
  const [receiveSubmitting,setReceiveSubmitting] = useState(false);
  const [markingDelivered,setMarkingDelivered] = useState<number|null>(null);

  const load = useCallback(async()=>{
    setLoading(true);
    try{
      const [r,s,i]=await Promise.all([
        apiRequest("/api/restocks",{cache:"no-store"}),
        apiRequest("/api/suppliers",{cache:"no-store"}),
        apiRequest("/api/inventory",{cache:"no-store"}),
      ]);
      const rb=await readApiBody<{success:boolean;restocks?:Restock[];message?:string}>(r);
      const sb=await readApiBody<{success:boolean;suppliers?:ApiSupplier[];message?:string}>(s);
      const ib=await readApiBody<{success:boolean;items?:ApiInventoryItem[];message?:string}>(i);
      if(!r.ok||!rb?.success) throw new Error(rb?.message??"Unable to load restocks");
      if(!s.ok||!sb?.success) throw new Error(sb?.message??"Unable to load suppliers");
      if(!i.ok||!ib?.success) throw new Error(ib?.message??"Unable to load inventory");
      setRestocks(rb.restocks??[]); setSuppliers(sb.suppliers??[]); setInventory(ib.items??[]);
    }catch(error){ onToast(error instanceof Error?error.message:"Unable to load restocks"); }
    finally{ setLoading(false); }
  },[onToast]);

  useEffect(()=>{ void load(); },[load]);

  const supplierItems=useMemo(()=>inventory.filter((item)=>createForm.supplierId && item.supplierId===Number(createForm.supplierId) && item.status==="active"),[inventory,createForm.supplierId]);
  const pending=restocks.filter((r)=>!["Received","Cancelled"].includes(r.status));
  const delivered=restocks.filter((r)=>r.status==="Delivered");
  const received=restocks.filter((r)=>r.status==="Received");

  function openCreate(){ setCreateForm(emptyCreate); setCreateOpen(true); }

  async function createRestock(event:FormEvent){
    event.preventDefault(); setCreating(true);
    try{
      const supplierId=Number(createForm.supplierId); const inventoryItemId=Number(createForm.inventoryItemId); const quantity=Number(createForm.quantity);
      if(!supplierId||!inventoryItemId||!Number.isInteger(quantity)||quantity<=0) throw new Error("Choose a supplier, item, and valid quantity");
      const unitCost=createForm.unitCost.trim()?Number(createForm.unitCost):null;
      const response=await apiRequest("/api/restocks",{method:"POST",body:JSON.stringify({supplierId,reference:createForm.reference.trim()||null,notes:createForm.notes.trim(),items:[{inventoryItemId,requestedQuantity:quantity,unitCost}]})});
      const body=await readApiBody<{success:boolean;message?:string}>(response);
      if(!response.ok||!body?.success) throw new Error(body?.message??"Unable to create restock request");
      setCreateOpen(false); onToast("Restock request sent to supplier"); await load();
    }catch(error){ onToast(error instanceof Error?error.message:"Unable to create restock request"); }
    finally{ setCreating(false); }
  }

  async function markDelivered(restock: Restock) {
    setMarkingDelivered(restock.id);
    try {
      const response = await apiRequest(`/api/restocks/${restock.id}/delivered`, { method: "POST" });
      const body = await readApiBody<{success:boolean;message?:string}>(response);
      if (!response.ok || !body?.success) throw new Error(body?.message ?? "Unable to confirm delivery");
      onToast(`Restock #${restock.id} marked Delivered`);
      await load();
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Unable to confirm delivery");
    } finally {
      setMarkingDelivered(null);
    }
  }

  function openReceive(restock:Restock){
    setReceiving(restock);
    setReceiveLines(restock.items.map((item)=>({id:item.id,deliveredQuantity:String(item.requestedQuantity),unitCost:item.unitCost===null||item.unitCost===undefined?"":String(item.unitCost)})));
    setReceiveReference(restock.reference??""); setReceiveNotes("");
  }

  async function receive(event:FormEvent){
    event.preventDefault(); if(!receiving)return; setReceiveSubmitting(true);
    try{
      const items=receiveLines.map((line)=>({restockRequestItemId:line.id,deliveredQuantity:Number(line.deliveredQuantity),unitCost:line.unitCost.trim()?Number(line.unitCost):null}));
      if(items.some((item)=>!Number.isInteger(item.deliveredQuantity)||item.deliveredQuantity<0)) throw new Error("Delivered quantities must be whole numbers");
      const response=await apiRequest(`/api/restocks/${receiving.id}/receive`,{method:"POST",body:JSON.stringify({reference:receiveReference.trim()||null,notes:receiveNotes.trim(),items})});
      const body=await readApiBody<{success:boolean;message?:string}>(response);
      if(!response.ok||!body?.success) throw new Error(body?.message??"Unable to receive delivery");
      setReceiving(null); onToast("Delivery received and inventory updated"); await load();
    }catch(error){ onToast(error instanceof Error?error.message:"Unable to receive delivery"); }
    finally{ setReceiveSubmitting(false); }
  }

  return <>
    <PageHeader title="Restock requests" action={<Button icon="plus" onClick={openCreate}>New request</Button>} />
    <div className="metrics-grid metrics-grid--four"><MetricCard label="Open requests" value={String(pending.length)} icon="info" accent="amber"/><MetricCard label="Ready to receive" value={String(delivered.length)} icon="box" accent="blue"/><MetricCard label="Received" value={String(received.length)} icon="check" accent="green"/><MetricCard label="Suppliers" value={String(suppliers.filter((s)=>s.status==="active").length)} icon="users" accent="violet"/></div>
    <Panel>
      <div className="staff-table"><div className="staff-table__head"><span>Request</span><span>Supplier</span><span>Items</span><span>Status</span><span>Actions</span></div>
        {loading?<div className="staff-table__empty">Loading restock requests…</div>:restocks.length?restocks.map((restock)=><div className="staff-table__row" key={restock.id}><span><strong>#{restock.id}</strong><small>{restock.reference??new Date(restock.created_at).toLocaleDateString()}</small></span><span>{restock.supplier_name}</span><span>{restock.items.map((item)=>`${item.itemName} × ${item.requestedQuantity}`).join(", ")}</span><span><Badge tone={restock.status==="Received"?"success":restock.status==="Cancelled"?"danger":"warning"}>{restock.status}</Badge></span><span>{restock.status==="Shipped"?<Button size="sm" disabled={markingDelivered===restock.id} onClick={()=>void markDelivered(restock)}>{markingDelivered===restock.id?"Confirming…":"Mark delivered"}</Button>:restock.status==="Delivered"?<Button size="sm" onClick={()=>openReceive(restock)}>Receive</Button>:null}</span></div>):<EmptyState icon="box" title="No restock requests" description="Create a request from a supplier-linked inventory item." action={<Button size="sm" onClick={openCreate}>New request</Button>}/>}</div>
    </Panel>

    <Modal open={createOpen} title="Create restock request" onClose={()=>!creating&&setCreateOpen(false)}>
      <form className="modal-form" onSubmit={createRestock}>
        <SelectField required label="Supplier" value={createForm.supplierId} onChange={(e)=>setCreateForm({...createForm,supplierId:e.target.value,inventoryItemId:""})}><option value="">Choose supplier</option>{suppliers.filter((s)=>s.status==="active").map((s)=><option key={s.id} value={s.id}>{s.companyName}</option>)}</SelectField>
        <SelectField required label="Inventory item" value={createForm.inventoryItemId} onChange={(e)=>{const item=inventory.find((i)=>i.id===Number(e.target.value));setCreateForm({...createForm,inventoryItemId:e.target.value,unitCost:item?String(item.unitCost):createForm.unitCost});}}><option value="">Choose item</option>{supplierItems.map((item)=><option key={item.id} value={item.id}>{item.name} · current {item.quantity} · min {item.minimumStock}</option>)}</SelectField>
        <div className="form-grid"><TextField required label="Requested quantity" type="number" min="1" step="1" value={createForm.quantity} onChange={(e)=>setCreateForm({...createForm,quantity:e.target.value})}/><TextField label="Expected unit cost" type="number" min="0" step="0.01" value={createForm.unitCost} onChange={(e)=>setCreateForm({...createForm,unitCost:e.target.value})}/></div>
        <TextField label="Reference" value={createForm.reference} onChange={(e)=>setCreateForm({...createForm,reference:e.target.value})}/><TextField label="Notes" value={createForm.notes} onChange={(e)=>setCreateForm({...createForm,notes:e.target.value})}/>
        <div className="modal-actions"><Button type="button" variant="secondary" disabled={creating} onClick={()=>setCreateOpen(false)}>Cancel</Button><Button type="submit" disabled={creating}>{creating?"Sending…":"Send request"}</Button></div>
      </form>
    </Modal>

    <Modal open={Boolean(receiving)} title={receiving?`Receive request #${receiving.id}`:"Receive delivery"} onClose={()=>!receiveSubmitting&&setReceiving(null)}>
      <form className="modal-form" onSubmit={receive}>
        {receiving?.items.map((item)=>{const line=receiveLines.find((entry)=>entry.id===item.id);return <div className="form-grid" key={item.id}><TextField label={`${item.itemName} delivered`} type="number" min="0" step="1" value={line?.deliveredQuantity??"0"} onChange={(e)=>setReceiveLines((current)=>current.map((entry)=>entry.id===item.id?{...entry,deliveredQuantity:e.target.value}:entry))}/><TextField label="Unit cost" type="number" min="0" step="0.01" value={line?.unitCost??""} onChange={(e)=>setReceiveLines((current)=>current.map((entry)=>entry.id===item.id?{...entry,unitCost:e.target.value}:entry))}/></div>})}
        <TextField label="Reference number" value={receiveReference} onChange={(e)=>setReceiveReference(e.target.value)}/><TextField label="Notes" value={receiveNotes} onChange={(e)=>setReceiveNotes(e.target.value)}/>
        <p className="form-hint">Receiving updates inventory and writes RECEIVE movement records. The same request cannot be received twice.</p>
        <div className="modal-actions"><Button type="button" variant="secondary" disabled={receiveSubmitting} onClick={()=>setReceiving(null)}>Cancel</Button><Button type="submit" disabled={receiveSubmitting}>{receiveSubmitting?"Receiving…":"Confirm receiving"}</Button></div>
      </form>
    </Modal>
  </>;
}
