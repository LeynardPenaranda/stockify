"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

type Point = {
  day: string; // YYYY-MM-DD
  stockInQty: number;
  stockOutQty: number;
};

export default function StockFlowChart({ data }: { data: Point[] }) {
  return (
    <div className="w-full h-65 sm:h-75">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="day" tickMargin={8} />
          <YAxis tickMargin={8} />
          <Tooltip />
          <Legend />
          <Area type="monotone" dataKey="stockInQty" />
          <Area type="monotone" dataKey="stockOutQty" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
