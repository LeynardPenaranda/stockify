"use client";

import React from "react";
import StockTrendAreaChart, { TrendPoint } from "./StockTrendAreaChart";

export type StockInDailyPoint = {
  day: string;
  stockInQty: number;
};

export default function StockInChart({ data }: { data: StockInDailyPoint[] }) {
  const chartData: TrendPoint[] = data;

  return (
    <StockTrendAreaChart
      title="Stock-In Trend"
      subtitle="Daily Quantity"
      data={chartData}
      dataKey="stockInQty"
      label="Stock-In Qty"
      strokeColor="#22c55e"
      fillColor="#bbf7d0"
    />
  );
}
