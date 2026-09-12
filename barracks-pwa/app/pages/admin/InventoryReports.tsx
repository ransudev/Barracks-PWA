"use client";

import { useEffect, useState } from "react";
import { apiRequest, readApiBody } from "@/app/lib/api";
import { formatCurrency } from "@/app/utils/format";
import { EmptyState, MetricCard, PageHeader, Panel, SectionHeading } from "@/app/components/ui";

type ReportBody = {
  success: boolean;
  message?: string;
  valuation?: { totalValue:number; activeItems:number; lowStockItems:number };
  supplierSpending?: Array<{ supplierId:number; supplierName:string; totalSpend:number; receivedDeliveries:number }>;
  movements?: Array<{ id:number; movement_type:string; quantity:number; previous_stock:number; new_stock:number; item_name:string; supplier_name:string|null; created_by_name:string; created_at:string }>;
};

export function InventoryReports({ onToast }:{ onToast:(message:string)=>void }) {
  const [data,setData] = useState<ReportBody|null>(null);
  const [loading,setLoading] = useState(true);

  useEffect(()=>{
    async function load(){
      try{
        const response=await apiRequest("/api/reports/inventory",{cache:"no-store"});
        const body=await readApiBody<ReportBody>(response);
        if(!response.ok||!body?.success) throw new Error(body?.message??"Unable to load reports");
        setData(body);
      }catch(error){ onToast(error instanceof Error?error.message:"Unable to load reports"); }
      finally{ setLoading(false); }
    }
    void load();
  },[onToast]);

  const valuation=data?.valuation;
  return <>
    <PageHeader title="Inventory reports" />
    <div className="metrics-grid metrics-grid--four">
      <MetricCard label="Inventory valuation" value={loading||!valuation?"—":formatCurrency(valuation.totalValue)} icon="box" accent="blue" />
      <MetricCard label="Active items" value={loading||!valuation?"—":String(valuation.activeItems)} icon="check" accent="green" />
      <MetricCard label="Low stock items" value={loading||!valuation?"—":String(valuation.lowStockItems)} icon="info" accent="amber" />
      <MetricCard label="Suppliers with spend" value={loading?"—":String((data?.supplierSpending??[]).filter((s)=>s.totalSpend>0).length)} icon="users" accent="violet" />
    </div>
    <Panel>
      <SectionHeading title="Supplier spending" />
      {loading?<div className="staff-table__empty">Loading supplier spending…</div>:(data?.supplierSpending?.length??0)>0?<div className="staff-table"><div className="staff-table__head"><span>Supplier</span><span>Received deliveries</span><span>Total spend</span></div>{data?.supplierSpending?.map((supplier)=><div className="staff-table__row" key={supplier.supplierId}><span><strong>{supplier.supplierName}</strong></span><span>{supplier.receivedDeliveries}</span><span>{formatCurrency(supplier.totalSpend)}</span></div>)}</div>:<EmptyState icon="users" title="No supplier spending yet" description="Received restock deliveries will appear here." />}
    </Panel>
    <Panel>
      <SectionHeading title="Recent stock movements" />
      {loading?<div className="staff-table__empty">Loading movements…</div>:(data?.movements?.length??0)>0?<div className="staff-table"><div className="staff-table__head"><span>Item</span><span>Movement</span><span>Stock</span><span>Supplier</span><span>Recorded by</span></div>{data?.movements?.map((movement)=><div className="staff-table__row" key={movement.id}><span><strong>{movement.item_name}</strong><small>{new Date(movement.created_at).toLocaleString()}</small></span><span>{movement.movement_type} × {movement.quantity}</span><span>{movement.previous_stock} → {movement.new_stock}</span><span>{movement.supplier_name??"—"}</span><span>{movement.created_by_name}</span></div>)}</div>:<EmptyState icon="box" title="No stock movements yet" description="Audited inventory operations will appear here." />}
    </Panel>
  </>;
}
