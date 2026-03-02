"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { equityCurveData, performanceStats } from "@/data/mockData";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { TrendingUp, TrendingDown, Target, BarChart3 } from "lucide-react";
const Performance = () => {
    const [period, setPeriod] = useState("weekly");
    const stats = performanceStats;
    return (<div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Performance</h1>
        <Tabs value={period} onValueChange={setPeriod}>
          <TabsList>
            <TabsTrigger value="daily" className="text-xs">Daily</TabsTrigger>
            <TabsTrigger value="weekly" className="text-xs">Weekly</TabsTrigger>
            <TabsTrigger value="monthly" className="text-xs">Monthly</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Equity Curve */}
      <Card>
        <CardHeader className="pb-3 p-4">
          <CardTitle className="text-sm font-medium">Equity Curve</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={equityCurveData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 18%)"/>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false}/>
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}/>
                <Tooltip contentStyle={{ backgroundColor: "hsl(220, 13%, 10%)", border: "1px solid hsl(220, 13%, 18%)", borderRadius: 8, fontSize: 12 }} formatter={(value) => [`$${value.toLocaleString()}`, "Equity"]}/>
                <Line type="monotone" dataKey="equity" stroke="hsl(142, 71%, 45%)" strokeWidth={2} dot={{ r: 3, fill: "hsl(142, 71%, 45%)" }}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card>
          <CardHeader className="pb-2 p-4">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><Target className="h-3 w-3"/> Win Rate</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xl font-bold font-mono-data text-profit">{stats.winRate}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 p-4">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3"/> Avg Win</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xl font-bold font-mono-data text-profit">+${stats.avgWin}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 p-4">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><TrendingDown className="h-3 w-3"/> Avg Loss</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xl font-bold font-mono-data text-loss">-${Math.abs(stats.avgLoss)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 p-4">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><TrendingDown className="h-3 w-3"/> Max DD</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xl font-bold font-mono-data text-loss">{stats.maxDrawdown}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 p-4">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1"><BarChart3 className="h-3 w-3"/> Trades/Day</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xl font-bold font-mono-data">{stats.tradesPerDay}</p>
          </CardContent>
        </Card>
      </div>

      {/* Strategy Breakdown */}
      <Card>
        <CardHeader className="pb-3 p-4">
          <CardTitle className="text-sm font-medium">Strategy Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead>Strategy</TableHead>
                <TableHead className="text-right">Trades</TableHead>
                <TableHead className="text-right">Win Rate</TableHead>
                <TableHead className="text-right">PnL</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.strategyBreakdown.map((s) => (<TableRow key={s.strategy} className="text-xs">
                  <TableCell className="font-medium">{s.strategy}</TableCell>
                  <TableCell className="text-right font-mono-data">{s.trades}</TableCell>
                  <TableCell className="text-right font-mono-data">{s.winRate}%</TableCell>
                  <TableCell className={`text-right font-mono-data font-semibold ${s.pnl >= 0 ? "text-profit" : "text-loss"}`}>
                    +${s.pnl.toLocaleString()}
                  </TableCell>
                </TableRow>))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>);
};
export default Performance;
