import type { Pool, PoolClient } from "pg";
export type Db = Pool | PoolClient;
// PoolClient callers already own the transaction (for authorization + mutation).
export async function inTransaction<T>(db: Db, work: (client: PoolClient) => Promise<T>): Promise<T> {
  if ("release" in db) return work(db);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally { client.release(); }
}
