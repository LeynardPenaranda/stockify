import { downloadCsv } from "./downloadCsv";
import { isoDay, toLocaleDateTimeString } from "./dateUtils";

type StockOutLog = {
  productName: string;
  category: string;
  quantity: number;
  releasedTo: string | null;
  purpose: string | null;

  productImageUrl?: string | null;

  stockOutByName?: string | null;
  stockOutByEmail?: string | null;

  at: any;
};

export function exportStockOutLogsCsv(logs: StockOutLog[]) {
  const rows = logs.map((r) => ({
    productName: r.productName,
    category: r.category,
    quantity: r.quantity,
    releasedTo: r.releasedTo ?? "",
    purpose: r.purpose ?? "",
    productImageUrl: r.productImageUrl ?? "",
    stockOutByName: r.stockOutByName ?? "",
    stockOutByEmail: r.stockOutByEmail ?? "",
    date: toLocaleDateTimeString(r.at),
  }));

  downloadCsv(`stock-out-logs-${isoDay()}.csv`, rows);
}
