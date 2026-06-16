import { NextResponse, type NextRequest } from "next/server";
import { requireCoupled } from "@/lib/couple";
import { supabaseServer } from "@/lib/supabase/server";
import { collectionConfig } from "@/lib/collections";

export const dynamic = "force-dynamic";

// Generic couple-scoped insert. Returns the created row so the client can swap
// its optimistic placeholder for the real record.
export async function POST(req: NextRequest, { params }: { params: Promise<{ table: string }> }) {
  const { table } = await params;
  const cfg = collectionConfig(table);
  if (!cfg) return NextResponse.json({ error: "Unknown collection" }, { status: 400 });

  const me = await requireCoupled();
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Bad body" }, { status: 400 });

  const row: Record<string, unknown> = {};
  for (const col of cfg.columns) {
    if (body[col] !== undefined && body[col] !== null && body[col] !== "") row[col] = body[col];
  }
  if (cfg.scope === "couple") row.couple_id = me.coupleId;
  else row.owner_id = me.userId;
  if (cfg.setAuthor) row.author_id = me.userId;

  const supabase = await supabaseServer();
  const { data, error } = await supabase.from(table).insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ row: data });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ table: string }> }) {
  const { table } = await params;
  const cfg = collectionConfig(table);
  if (!cfg?.updatable) return NextResponse.json({ error: "Not updatable" }, { status: 400 });

  const me = await requireCoupled();
  const body = (await req.json().catch(() => null)) as { id?: string; fields?: Record<string, unknown> } | null;
  if (!body?.id || !body.fields) return NextResponse.json({ error: "Missing id/fields" }, { status: 400 });

  const fields: Record<string, unknown> = {};
  for (const col of cfg.updatable) {
    if (body.fields[col] !== undefined) fields[col] = body.fields[col];
  }
  if (Object.keys(fields).length === 0) return NextResponse.json({ error: "No valid fields" }, { status: 400 });

  const supabase = await supabaseServer();
  let q = supabase.from(table).update(fields).eq("id", body.id);
  q = cfg.scope === "couple" ? q.eq("couple_id", me.coupleId) : q.eq("owner_id", me.userId);
  const { data, error } = await q.select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ row: data });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ table: string }> }) {
  const { table } = await params;
  const cfg = collectionConfig(table);
  if (!cfg) return NextResponse.json({ error: "Unknown collection" }, { status: 400 });

  const me = await requireCoupled();
  const body = (await req.json().catch(() => null)) as { id?: string } | null;
  if (!body?.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const supabase = await supabaseServer();
  let q = supabase.from(table).delete().eq("id", body.id);
  q = cfg.scope === "couple" ? q.eq("couple_id", me.coupleId) : q.eq("owner_id", me.userId);
  const { error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
