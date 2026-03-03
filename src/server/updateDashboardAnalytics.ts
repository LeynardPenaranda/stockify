import { adminDb } from "@/src/lib/firebase/admin";

function n(v: any) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

export async function recalcDashboardAnalyticsTx(
  tx: FirebaseFirestore.Transaction,
) {
  // If you have many products, you’ll later want incremental counters instead of full scan.
  // For a capstone/admin-sized dataset, this is fine.
  const snap = await tx.get(adminDb.collection("products"));
  let totalProducts = 0;
  let totalQuantity = 0;
  let lowStockProducts = 0;

  snap.forEach((d) => {
    totalProducts += 1;
    const p = d.data() as any;
    const qty = n(p.quantity);
    const min = n(p.minStock);
    totalQuantity += qty;
    if (qty <= min) lowStockProducts += 1;
  });

  tx.set(
    adminDb.collection("analytics").doc("dashboard"),
    {
      totalProducts,
      totalQuantity,
      lowStockProducts,
      updatedAt: new Date(),
    },
    { merge: true },
  );
}
