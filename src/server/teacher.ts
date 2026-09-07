import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password.server";

const TEACHER_KEY = "teacher";

type ConfigRow = { password_hash: string | null; salt: string | null };

/** True once a shared teacher password has been set. */
export const getTeacherStatus = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ hasPassword: boolean }> => {
    const sql = await getSql();
    const rows = await sql<ConfigRow>`select password_hash, salt from app_config where id = ${TEACHER_KEY}`;
    return { hasPassword: Boolean(rows[0]?.password_hash) };
  },
);

/** Set the shared teacher password the first time only (no password exists yet). */
export const setTeacherPassword = createServerFn({ method: "POST" })
  .validator((input: { password: string }) => {
    if (typeof input?.password !== "string" || input.password.trim().length < 4) {
      throw new Error("Choose a password of at least 4 characters.");
    }
    return { password: input.password.trim() };
  })
  .handler(async ({ data }): Promise<{ ok: boolean; alreadySet?: boolean }> => {
    const sql = await getSql();
    const existing = await sql<ConfigRow>`select password_hash from app_config where id = ${TEACHER_KEY}`;
    if (existing[0]?.password_hash) return { ok: false, alreadySet: true };
    const { hash, salt } = hashPassword(data.password);
    await sql`
      insert into app_config (id, password_hash, salt, updated_at)
      values (${TEACHER_KEY}, ${hash}, ${salt}, now())
      on conflict (id) do update set password_hash = ${hash}, salt = ${salt}, updated_at = now()
    `;
    return { ok: true };
  });

/** Verify the shared teacher password to unlock editing. */
export const verifyTeacherPassword = createServerFn({ method: "POST" })
  .validator((input: { password: string }) => {
    if (typeof input?.password !== "string") throw new Error("Password required.");
    return { password: input.password };
  })
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const sql = await getSql();
    const rows = await sql<ConfigRow>`select password_hash, salt from app_config where id = ${TEACHER_KEY}`;
    const row = rows[0];
    if (!row?.password_hash || !row.salt) return { ok: false };
    return { ok: verifyPassword(data.password, row.salt, row.password_hash) };
  });
