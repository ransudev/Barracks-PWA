"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { apiRequest, readApiBody } from "@/app/lib/api";
import { formatCurrency } from "@/app/utils/format";
import { Badge, Button, EmptyState, MetricCard, PageHeader, Panel, SectionHeading, TextField } from "@/app/components/ui";

type UsageRow = {
  itemId:number;
  itemName:string;
  branch:string;
  currentQuantity:number;
  minimumStock:number;
  received:number;
  used:number;
  sold:number;
  wasted:number;
  adjusted:number;
  currentActivity:number;
  previousActivity:number;
};

type ReportBody = {
  success: boolean;
  message?: string;
  range?: { from:string; to:string; previousFrom:string; previousTo:string };
  valuation?: { totalValue:number; activeItems:number; lowStockItems:number };
  supplierSpending?: Array<{ supplierId:number; supplierName:string; totalSpend:number; receivedDeliveries:number }>;
  usageSummary?: UsageRow[];
  movements?: Array<{ id:number; movement_type:string; quantity:number; previous_stock:number; new_stock:number; item_name:string; branch:string; supplier_name:string|null; created_by_name:string; created_at:string }>;
};

function dateOnly(date: Date): string { return date.toISOString().slice(0,10); }
function defaultDates() {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate()-29);
  return { from:dateOnly(from), to:dateOnly(to) };
}

export function InventoryReports({ onToast }:{ onToast:(message:string)=>void }) {
  const defaults = useMemo(defaultDates,[]);
  const [from,setFrom] = useState(defaults.from);
  const [to,setTo] = useState(defaults.to);
  const [appliedRange,setAppliedRange] = useState(defaults);
  const [data,setData] = useState<ReportBody|null>(null);
  const [loading,setLoading] = useState(true);

  const load = useCallback(async(range:{from:string;to:string})=>{
    setLoading(true);
    try{
      const params=new URLSearchParams({from:range.from,to:range.to});
      const response=await apiRequest(`/api/reports/inventory?${params.toString()}`,{cache:"no-store"});
      const body=await readApiBody<ReportBody>(response);
      if(!response.ok||!body?.success) throw new Error(body?.message??"Unable to load reports");
      setData(body);
    }catch(error){ onToast(error instanceof Error?error.message:"Unable to load reports"); }
    finally{ setLoading(false); }
  },[onToast]);

  useEffect(()=>{ void load(appliedRange); },[appliedRange,load]);

  function applyRange(event:FormEvent){
    event.preventDefault();
    if(!from||!to||from>to){ onToast("Choose a valid report date range"); return; }
    setAppliedRange({from,to});
  }

  const valuation=data?.valuation;
  const usage=data?.usageSummary??[];
  const highestActivity=Math.max(0,...usage.map((row)=>row.currentActivity));

  return <>
    <PageHeader title="Inventory reports" description="Track stock activity, usage, waste, sales, and supplier spending by period." />
    <Panel>
      <form className="panel-toolbar" onSubmit={applyRange}>
        <TextField label="From" type="date" value={from} onChange={(event)=>setFrom(event.target.value)} />
        <TextField label="To" type="date" value={to} onChange={(event)=>setTo(event.target.value)} />
        <Button type="submit" disabled={loading}>{loading?"Loading…":"Apply period"}</Button>
      </form>
      {data?.range && <p className="form-hint">Comparing {data.range.from} to {data.range.to} with the previous period {data.range.previousFrom} to {data.range.previousTo}.</p>}
    </Panel>

    <div className="metrics-grid metrics-grid--four">
      <MetricCard label="Inventory valuation" value={loading||!valuation?"—":formatCurrency(valuation.totalValue)} icon="box" accent="blue" />
      <MetricCard label="Active items" value={loading||!valuation?"—":String(valuation.activeItems)} icon="check" accent="green" />
      <MetricCard label="Low stock items" value={loading||!valuation?"—":String(valuation.lowStockItems)} icon="info" accent="amber" />
      <MetricCard label="Suppliers with spend" value={loading?"—":String((data?.supplierSpending??[]).filter((s)=>s.totalSpend>0).length)} icon="users" accent="violet" />
    </div>

    <Panel>
      <SectionHeading title="Inventory usage analytics" description="Movement totals are grouped by item and branch for the selected period." />
      {loading?<div className="staff-table__empty">Loading usage analytics…</div>:usage.length?<div className="staff-table">
        <div className="staff-table__head"><span>Item / branch</span><span>Used / sold / wasted</span><span>Received / adjusted</span><span>Period comparison</span><span>Stock status</span></div>
        {usage.map((row)=><div className="staff-table__row" key={row.itemId}>
          <span><strong>{row.itemName}</strong><small>{row.branch}</small></span>
          <span>{row.used} used · {row.sold} sold · {row.wasted} wasted</span>
          <span>{row.received} received · {row.adjusted} adjusted</span>
          <span><strong>{row.currentActivity}</strong><small>Previous: {row.previousActivity}{highestActivity>0&&row.currentActivity===highestActivity?" · Highest usage":""}</small></span>
          <span><Badge tone={row.currentQuantity<=row.minimumStock?"warning":"success"}>{row.currentQuantity<=row.minimumStock?"Low stock":"In stock"}</Badge></span>
        </div>)}
      </div>:<EmptyState icon="box" title="No usage in this period" description="Choose another date range or record inventory movements first." />}
    </Panel>

    <Panel>
      <SectionHeading title="Supplier spending" />
      {loading?<div className="staff-table__empty">Loading supplier spending…</div>:(data?.supplierSpending?.length??0)>0?<div className="staff-table"><div className="staff-table__head"><span>Supplier</span><span>Received deliveries</span><span>Total spend</span></div>{data?.supplierSpending?.map((supplier)=><div className="staff-table__row" key={supplier.supplierId}><span><strong>{supplier.supplierName}</strong></span><span>{supplier.receivedDeliveries}</span><span>{formatCurrency(supplier.totalSpend)}</span></div>)}</div>:<EmptyState icon="users" title="No supplier spending yet" description="Received restock deliveries will appear here." />}
    </Panel>

    <Panel>
      <SectionHeading title="Recent stock movements" />
      {loading?<div className="staff-table__empty">Loading movements…</div>:(data?.movements?.length??0)>0?<div className="staff-table"><div className="staff-table__head"><span>Item</span><span>Movement</span><span>Stock</span><span>Branch / supplier</span><span>Recorded by</span></div>{data?.movements?.map((movement)=><div className="staff-table__row" key={movement.id}><span><strong>{movement.item_name}</strong><small>{new Date(movement.created_at).toLocaleString()}</small></span><span>{movement.movement_type} × {movement.quantity}</span><span>{movement.previous_stock} → {movement.new_stock}</span><span>{movement.branch}<small>{movement.supplier_name??"No supplier"}</small></span><span>{movement.created_by_name}</span></div>)}</div>:<EmptyState icon="box" title="No stock movements yet" description="Audited inventory operations will appear here." />}
    </Panel>
  </>;
}
