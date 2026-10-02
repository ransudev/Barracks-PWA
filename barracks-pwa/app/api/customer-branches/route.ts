import { requireRolesUser } from "@/server/auth/require-role";
import { pool } from "@/server/db/pool";
import { listBranches } from "@/server/services/branch.service";

export const runtime = "nodejs";
export async function GET() {
  const actor = await requireRolesUser(["customer"]);
  if (actor instanceof Response) return actor;
  try {
    const branches = (await listBranches(pool, true)).map(({ id, name, code, address, phone }) => ({ id, name, code, address, phone }));
    return Response.json({ success: true, branches });
  } catch (error) {
    console.error("Unable to load customer branches", error);
    return Response.json({ success: false, message: "Unable to load branches" }, { status: 500 });
  }
}
