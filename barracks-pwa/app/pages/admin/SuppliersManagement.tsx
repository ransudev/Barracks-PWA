"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { ApiSupplier } from "@/app/lib/api";
import { apiRequest, readApiBody } from "@/app/lib/api";
import { Badge, Button, EmptyState, Modal, PageHeader, Panel, SearchInput, SelectField, TextField } from "@/app/components/ui";
import { Icon } from "@/app/components/ui/icons";

type SupplierForm = {
  companyName: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  status: "active" | "inactive";
};

type AccountForm = { firstName:string; lastName:string; email:string; password:string };

const emptySupplier: SupplierForm = { companyName:"",contactPerson:"",phone:"",email:"",address:"",notes:"",status:"active" };
const emptyAccount: AccountForm = { firstName:"",lastName:"",email:"",password:"" };

export function SuppliersManagement({ onToast }: { onToast:(message:string)=>void }) {
  const [suppliers,setSuppliers] = useState<ApiSupplier[]>([]);
  const [search,setSearch] = useState("");
  const [loading,setLoading] = useState(true);
  const [editing,setEditing] = useState<ApiSupplier|null>(null);
  const [form,setForm] = useState<SupplierForm>(emptySupplier);
  const [modalOpen,setModalOpen] = useState(false);
  const [submitting,setSubmitting] = useState(false);
  const [accountSupplier,setAccountSupplier] = useState<ApiSupplier|null>(null);
  const [accountForm,setAccountForm] = useState<AccountForm>(emptyAccount);
  const [accountSubmitting,setAccountSubmitting] = useState(false);

  const load = useCallback(async()=>{
    setLoading(true);
    try {
      const response = await apiRequest("/api/suppliers",{cache:"no-store"});
      const body = await readApiBody<{success:boolean;suppliers?:ApiSupplier[];message?:string}>(response);
      if(!response.ok || !body?.success) throw new Error(body?.message ?? "Unable to load suppliers");
      setSuppliers(body.suppliers ?? []);
    } catch(error) { onToast(error instanceof Error ? error.message : "Unable to load suppliers"); }
    finally { setLoading(false); }
  },[onToast]);

  useEffect(()=>{ void load(); },[load]);

  const filtered = useMemo(()=>{
    const q=search.trim().toLowerCase();
    return suppliers.filter((s)=>!q || `${s.companyName} ${s.contactPerson} ${s.email} ${s.phone}`.toLowerCase().includes(q));
  },[search,suppliers]);

  function openCreate(){ setEditing(null); setForm(emptySupplier); setModalOpen(true); }
  function openEdit(s:ApiSupplier){ setEditing(s); setForm({companyName:s.companyName,contactPerson:s.contactPerson,phone:s.phone,email:s.email,address:s.address,notes:s.notes,status:s.status}); setModalOpen(true); }

  async function save(event:FormEvent){
    event.preventDefault(); setSubmitting(true);
    try{
      const response=await apiRequest(editing?`/api/suppliers/${editing.id}`:"/api/suppliers",{method:editing?"PUT":"POST",body:JSON.stringify(form)});
      const body=await readApiBody<{success:boolean;supplier?:ApiSupplier;message?:string}>(response);
      if(!response.ok || !body?.success) throw new Error(body?.message ?? "Unable to save supplier");
      setModalOpen(false); onToast(editing?"Supplier updated":"Supplier created"); await load();
    }catch(error){ onToast(error instanceof Error?error.message:"Unable to save supplier"); }
    finally{ setSubmitting(false); }
  }

  async function deactivate(s:ApiSupplier){
    const response=await apiRequest(`/api/suppliers/${s.id}`,{method:"DELETE"});
    const body=await readApiBody<{success:boolean;message?:string}>(response);
    if(!response.ok || !body?.success){ onToast(body?.message ?? "Unable to deactivate supplier"); return; }
    onToast("Supplier deactivated"); await load();
  }

  async function createAccount(event:FormEvent){
    event.preventDefault(); if(!accountSupplier) return; setAccountSubmitting(true);
    try{
      const response=await apiRequest(`/api/suppliers/${accountSupplier.id}/account`,{method:"POST",body:JSON.stringify(accountForm)});
      const body=await readApiBody<{success:boolean;message?:string}>(response);
      if(!response.ok || !body?.success) throw new Error(body?.message ?? "Unable to create supplier account");
      setAccountSupplier(null); setAccountForm(emptyAccount); onToast("Supplier login created");
    }catch(error){ onToast(error instanceof Error?error.message:"Unable to create supplier account"); }
    finally{ setAccountSubmitting(false); }
  }

  return <>
    <PageHeader title="Suppliers" action={<Button icon="plus" onClick={openCreate}>Add supplier</Button>} />
    <Panel>
      <div className="panel-toolbar"><SearchInput value={search} onChange={setSearch} placeholder="Search suppliers" /></div>
      <div className="staff-table">
        <div className="staff-table__head"><span>Supplier</span><span>Contact</span><span>Status</span><span>Actions</span></div>
        {loading ? <div className="staff-table__empty">Loading suppliers…</div> : filtered.length ? filtered.map((supplier)=><div className="staff-table__row" key={supplier.id}>
          <span><strong>{supplier.companyName}</strong><small>{supplier.email || "No email"}</small></span>
          <span><strong>{supplier.contactPerson || "Not set"}</strong><small>{supplier.phone || "No phone"}</small></span>
          <span><Badge tone={supplier.status==="active"?"success":"danger"}>{supplier.status==="active"?"Active":"Inactive"}</Badge></span>
          <span className="row-actions">
            <button className="row-action row-action--icon" type="button" onClick={()=>openEdit(supplier)} title="Edit supplier"><Icon name="edit" size={16}/></button>
            <Button size="sm" variant="secondary" onClick={()=>{setAccountSupplier(supplier);setAccountForm({firstName:supplier.contactPerson.split(" ")[0] ?? "",lastName:supplier.contactPerson.split(" ").slice(1).join(" "),email:supplier.email,password:""});}}>Create login</Button>
            {supplier.status==="active" && <Button size="sm" variant="secondary" onClick={()=>void deactivate(supplier)}>Deactivate</Button>}
          </span>
        </div>) : <EmptyState icon="users" title="No suppliers found" description="Create a supplier profile to link inventory and restock requests." action={<Button size="sm" icon="plus" onClick={openCreate}>Add supplier</Button>} />}
      </div>
    </Panel>

    <Modal open={modalOpen} title={editing?"Edit supplier":"Add supplier"} onClose={()=>!submitting&&setModalOpen(false)}>
      <form className="modal-form" onSubmit={save}>
        <TextField required label="Company name" value={form.companyName} onChange={(e)=>setForm({...form,companyName:e.target.value})}/>
        <TextField label="Contact person" value={form.contactPerson} onChange={(e)=>setForm({...form,contactPerson:e.target.value})}/>
        <div className="form-grid"><TextField label="Phone" value={form.phone} onChange={(e)=>setForm({...form,phone:e.target.value})}/><TextField label="Email" type="email" value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})}/></div>
        <TextField label="Address" value={form.address} onChange={(e)=>setForm({...form,address:e.target.value})}/>
        <TextField label="Notes" value={form.notes} onChange={(e)=>setForm({...form,notes:e.target.value})}/>
        <SelectField label="Status" value={form.status} onChange={(e)=>setForm({...form,status:e.target.value as SupplierForm["status"]})}><option value="active">Active</option><option value="inactive">Inactive</option></SelectField>
        <div className="modal-actions"><Button variant="secondary" type="button" onClick={()=>setModalOpen(false)} disabled={submitting}>Cancel</Button><Button type="submit" disabled={submitting}>{submitting?"Saving…":"Save supplier"}</Button></div>
      </form>
    </Modal>

    <Modal open={Boolean(accountSupplier)} title={accountSupplier?`Create login for ${accountSupplier.companyName}`:"Create supplier login"} onClose={()=>!accountSubmitting&&setAccountSupplier(null)}>
      <form className="modal-form" onSubmit={createAccount}>
        <div className="form-grid"><TextField required label="First name" value={accountForm.firstName} onChange={(e)=>setAccountForm({...accountForm,firstName:e.target.value})}/><TextField required label="Last name" value={accountForm.lastName} onChange={(e)=>setAccountForm({...accountForm,lastName:e.target.value})}/></div>
        <TextField required type="email" label="Email" value={accountForm.email} onChange={(e)=>setAccountForm({...accountForm,email:e.target.value})}/>
        <TextField required type="password" label="Temporary password" value={accountForm.password} onChange={(e)=>setAccountForm({...accountForm,password:e.target.value})}/>
        <div className="modal-actions"><Button variant="secondary" type="button" onClick={()=>setAccountSupplier(null)} disabled={accountSubmitting}>Cancel</Button><Button type="submit" disabled={accountSubmitting}>{accountSubmitting?"Creating…":"Create login"}</Button></div>
      </form>
    </Modal>
  </>;
}
