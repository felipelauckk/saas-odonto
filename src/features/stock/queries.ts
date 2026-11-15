import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function getStockData() {
  const supabase = await createClient();
  const [products, lots, movements, suppliers] = await Promise.all([
    supabase.from("stock_products").select("id, name, measure, category, min_qty, active").order("name"),
    supabase.from("stock_lots").select("id, product_id, unit_id, lot_code, expires_on, qty, unit_cost_cents").gt("qty", 0).limit(5000),
    supabase
      .from("stock_movements")
      .select("id, unit_id, product_id, kind, qty, unit_cost_cents, note, shortage, created_at, stock_products(name, measure), units(name)")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("suppliers").select("id, name").eq("active", true).order("name"),
  ]);
  if (products.error) throw products.error;
  return {
    products: (products.data ?? []).map((p) => ({ id: p.id, name: p.name, measure: p.measure, category: p.category, minQty: Number(p.min_qty), active: p.active })),
    lots: (lots.data ?? []).map((l) => ({
      id: l.id,
      productId: l.product_id,
      unitId: l.unit_id,
      lotCode: l.lot_code,
      expiresOn: l.expires_on,
      qty: Number(l.qty),
      unitCostCents: l.unit_cost_cents,
    })),
    movements: (movements.data ?? []).map((m) => ({
      id: m.id,
      unitName: m.units?.name ?? "",
      productName: m.stock_products?.name ?? "",
      measure: m.stock_products?.measure ?? "",
      kind: m.kind,
      qty: Number(m.qty),
      shortage: Number(m.shortage),
      note: m.note,
      createdAt: m.created_at,
    })),
    suppliers: suppliers.data ?? [],
  };
}

export async function getKits() {
  const supabase = await createClient();
  const [kits, procedures, products] = await Promise.all([
    supabase.from("procedure_kits").select("id, procedure_id, product_id, qty"),
    supabase.from("procedures").select("id, name").eq("active", true).order("name"),
    supabase.from("stock_products").select("id, name, measure").eq("active", true).order("name"),
  ]);
  return { kits: (kits.data ?? []).map((k) => ({ ...k, qty: Number(k.qty) })), procedures: procedures.data ?? [], products: products.data ?? [] };
}
