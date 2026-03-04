export function downloadCsv(filename: string, rows: Record<string, any>[]) {
  const headers = Object.keys(rows[0] ?? {});

  const esc = (v: any) => {
    const s = String(v ?? "");
    return `"${s.replaceAll('"', '""')}"`;
  };

  const csv = [headers.join(",")]
    .concat(rows.map((r) => headers.map((h) => esc(r[h])).join(",")))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}
