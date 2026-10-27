import assert from "node:assert/strict";
import test from "node:test";
import type { Pool, PoolClient } from "pg";
import { applyInventoryMovement } from "@/server/services/inventory-movement.service";
import { receiveRestock } from "@/server/services/restock.service";
import { createDisposableSchema, databaseConfigured } from "./helpers/database";

async function fixture(db: Pool) {
  const branch = Number((await db.query("SELECT id FROM branches WHERE code='MAIN'")).rows[0].id);
  const actor = Number((await db.query(`INSERT INTO users(first_name,last_name,email,password_hash,role_id)
    SELECT 'Stock','Operator','stock-race@test.local','test',id FROM roles WHERE name='administrator' RETURNING id`)).rows[0].id);
  const supplier = Number((await db.query("INSERT INTO suppliers(company_name) VALUES('Race supplier') RETURNING id")).rows[0].id);
  const item = Number((await db.query(`INSERT INTO inventory_items(name,category,branch_id,supplier_id,quantity,unit_cost)
    VALUES('Concurrent stock','Products',$1,$2,5,10) RETURNING id`, [branch, supplier])).rows[0].id);
  return { branch, actor, supplier, item };
}

// Hold stock until every independent transaction is really blocked on a
// database lock. This verifies contention rather than merely scheduling tasks.
async function contend(db: Pool, item: number, actions: ((client: PoolClient) => Promise<unknown>)[]) {
  const blocker = await db.connect();
  const workers = await Promise.all(actions.map(() => db.connect()));
  let locked = false;
  let pending: Promise<unknown>[] = [];
  try {
    await blocker.query("BEGIN"); locked = true;
    await blocker.query("SELECT id FROM inventory_items WHERE id=$1 FOR UPDATE", [item]);
    const pids = await Promise.all(workers.map(async (worker) => Number((await worker.query("SELECT pg_backend_pid() AS pid")).rows[0].pid)));
    pending = workers.map(async (worker, index) => {
      await worker.query("BEGIN");
      try {
        const result = await actions[index](worker);
        await worker.query("COMMIT");
        return result;
      } catch (error) { await worker.query("ROLLBACK"); throw error; }
    });
    // Attach rejection handlers before any transaction can finish.
    const result = Promise.allSettled(pending);
    let waiting = 0;
    const deadline = Date.now() + 3_000;
    do {
      waiting = Number((await db.query(`SELECT count(*)::int AS count FROM pg_stat_activity
        WHERE pid=ANY($1::int[]) AND wait_event_type='Lock'`, [pids])).rows[0].count);
      if (waiting === actions.length) break;
      await new Promise((resolve) => setTimeout(resolve, 20));
    } while (Date.now() < deadline);
    assert.equal(waiting, actions.length, "all stock transactions contend before the blocker releases");
    await blocker.query("COMMIT"); locked = false;
    return await result;
  } finally {
    if (locked) await blocker.query("ROLLBACK");
    await Promise.allSettled(pending);
    workers.forEach((worker) => worker.release());
    blocker.release();
  }
}

test("competing stock use commits only available stock with one auditable movement", { skip: !databaseConfigured }, async () => {
  const { db, cleanup } = await createDisposableSchema();
  try {
    const { branch, actor, item } = await fixture(db);
    const race = await contend(db, item, [1, 2].map(() => (client) =>
      applyInventoryMovement(client, item, actor, { movementType: "USE", quantity: 4, notes: "Competing use" })));
    assert.equal(race.filter((result) => result.status === "fulfilled").length, 1);
    const failures = race.filter((result) => result.status === "rejected");
    assert.equal(failures.length, 1);
    assert.equal(failures[0].reason.message, "NEGATIVE_STOCK");
    assert.equal(Number((await db.query("SELECT quantity FROM inventory_items WHERE id=$1", [item])).rows[0].quantity), 1);
    const movements = (await db.query("SELECT previous_stock,new_stock,quantity,branch_id FROM inventory_movements WHERE inventory_item_id=$1", [item])).rows;
    assert.deepEqual(movements, [{ previous_stock: 5, new_stock: 1, quantity: 4, branch_id: branch }]);
  } finally { await cleanup(); }
});

test("competing use and duplicate delivery receipt reconcile once without lost stock", { skip: !databaseConfigured }, async () => {
  const { db, cleanup } = await createDisposableSchema();
  try {
    const { branch, actor, supplier, item } = await fixture(db);
    const request = Number((await db.query(`INSERT INTO restock_requests(supplier_id,branch_id,status,requested_by)
      VALUES($1,$2,'Delivered',$3) RETURNING id`, [supplier, branch, actor])).rows[0].id);
    const line = Number((await db.query(`INSERT INTO restock_request_items(restock_request_id,inventory_item_id,requested_quantity,unit_cost)
      VALUES($1,$2,5,10) RETURNING id`, [request, item])).rows[0].id);
    const receipt = { notes: "Concurrent delivery", items: [{ restockRequestItemId: line, deliveredQuantity: 5, unitCost: 10 }] };
    const race = await contend(db, item, [
      (client) => applyInventoryMovement(client, item, actor, { movementType: "USE", quantity: 4, notes: "Use during receipt" }),
      (client) => receiveRestock(client, request, actor, receipt),
      (client) => receiveRestock(client, request, actor, receipt),
    ]);
    assert.equal(race[0].status, "fulfilled");
    assert.equal(race.slice(1).filter((result) => result.status === "fulfilled").length, 1);
    const duplicate = race.slice(1).find((result) => result.status === "rejected");
    assert.ok(duplicate && duplicate.status === "rejected");
    assert.equal(duplicate.reason.message, "ALREADY_RECEIVED");
    assert.equal(Number((await db.query("SELECT quantity FROM inventory_items WHERE id=$1", [item])).rows[0].quantity), 6);
    const movements = (await db.query(`SELECT movement_type,quantity,previous_stock,new_stock,branch_id
      FROM inventory_movements WHERE inventory_item_id=$1 ORDER BY id`, [item])).rows;
    assert.equal(movements.length, 2);
    assert.equal(movements.filter((movement) => movement.movement_type === "RECEIVE").length, 1);
    assert.equal(movements.filter((movement) => movement.movement_type === "USE").length, 1);
    assert.equal(movements[0].previous_stock, 5);
    assert.equal(movements[0].new_stock, movements[1].previous_stock);
    assert.equal(movements[1].new_stock, 6);
    assert.ok(movements.every((movement) => movement.new_stock >= 0 && Number(movement.branch_id) === branch));
    const received = (await db.query("SELECT status,received_by,received_at FROM restock_requests WHERE id=$1", [request])).rows[0];
    assert.equal(received.status, "Received");
    assert.equal(Number(received.received_by), actor);
    assert.ok(received.received_at);
    assert.equal(Number((await db.query("SELECT delivered_quantity FROM restock_request_items WHERE id=$1", [line])).rows[0].delivered_quantity), 5);
  } finally { await cleanup(); }
});
