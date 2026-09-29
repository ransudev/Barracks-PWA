import assert from "node:assert/strict";
import test from "node:test";
import { updateSupplier } from "@/server/services/supplier.service";
import { createDisposableSchema, databaseConfigured } from "./helpers/database";

test("Manager supplier edits cannot deactivate an active supplier; Administrator can", { skip: !databaseConfigured }, async () => {
  const { db, cleanup } = await createDisposableSchema();
  try {
    const id = Number((await db.query("INSERT INTO suppliers(company_name,phone) VALUES('Audit Supplier','09123456789') RETURNING id")).rows[0].id);
    const input = { companyName: "Audit Supplier", contactPerson: "Sam", phone: "09123456789", email: "", address: "", notes: "", status: "inactive" as const };
    assert.equal(await updateSupplier(db, id, input, false), null);
    assert.equal((await db.query("SELECT status FROM suppliers WHERE id=$1", [id])).rows[0].status, "active");
    const changed = await updateSupplier(db, id, input, true);
    assert.equal(changed?.status, "inactive");
    assert.equal((await updateSupplier(db, id, { ...input, notes: "New contact note" }, false))?.notes, "New contact note");
  } finally { await cleanup(); }
});
