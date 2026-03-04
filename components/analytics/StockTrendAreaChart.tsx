"use client";

import React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export type TrendPoint = {
  day: string; // "YYYY-MM-DD"
  [key: string]: string | number;
};

type Props = {
  title: string;
  subtitle?: string;
  data: TrendPoint[];
  dataKey: string;
  label: string;
  strokeColor?: string;
  fillColor?: string;
  height?: number;
};

export default function StockTrendAreaChart({
  title,
  subtitle,
  data,
  dataKey,
  label,
  strokeColor = "#ef4444",
  fillColor = "#fecaca",
  height = 280,
}: Props) {
  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold text-gray-900">
          {title}{" "}
          {subtitle ? (
            <span className="text-gray-500">({subtitle})</span>
          ) : null}
        </div>

        <span className="text-xs font-medium" style={{ color: strokeColor }}>
          ● {label}
        </span>
      </div>

      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>
          <AreaChart
            data={data}
            margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" />
            <YAxis />
            <Tooltip />
            <Legend
              formatter={(value) => (
                <span style={{ color: strokeColor, fontWeight: 600 }}>
                  {value}
                </span>
              )}
            />
            <Area
              type="monotone"
              dataKey={dataKey}
              name={label}
              stroke={strokeColor}
              fill={fillColor}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
