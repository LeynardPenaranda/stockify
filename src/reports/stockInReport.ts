import { downloadCsv } from "./downloadCsv";
import { isoDay, toLocaleDateTimeString } from "./dateUtils";

type StockInLog = {
  productName: string;
  category: string;
  quantity: number;
  supplier: string | null;
  at: any;

  productImageUrl?: string | null;

  stockInByName?: string | null;
  stockInByEmail?: string | null;
};

export function exportStockInLogsCsv(logs: StockInLog[]) {
  const rows = logs.map((r) => ({
    productName: r.productName,
    category: r.category,
    quantity: r.quantity,
    supplier: r.supplier ?? "",
    date: toLocaleDateTimeString(r.at),

    productImageUrl: r.productImageUrl ?? "",

    stockInByName: r.stockInByName ?? "",
    stockInByEmail: r.stockInByEmail ?? "",
  }));

  downloadCsv(`stock-in-logs-${isoDay()}.csv`, rows);
}
