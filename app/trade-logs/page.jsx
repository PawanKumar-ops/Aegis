"use client";

import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { tradeLogs } from "@/data/mockData";
import { Search } from "lucide-react";
const TradeLogs = () => {
    const [search, setSearch] = useState("");
    const [decisionFilter, setDecisionFilter] = useState("all");
    const filtered = useMemo(() => {
        return tradeLogs.filter((log) => {
            const matchesSearch = !search || log.symbol.toLowerCase().includes(search.toLowerCase()) || log.reason.toLowerCase().includes(search.toLowerCase());
            const matchesDecision = decisionFilter === "all" || log.decision === decisionFilter;
            return matchesSearch && matchesDecision;
        });
    }, [search, decisionFilter]);
    return (<div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Trade Decision Log</h1>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
          <Input placeholder="Search symbol or reason..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)}/>
        </div>
        <Select value={decisionFilter} onValueChange={setDecisionFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Decision"/>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="TRADE">Trade</SelectItem>
            <SelectItem value="BLOCKED">Blocked</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead>Time</TableHead>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Strategy</TableHead>
                  <TableHead>LLM Regime</TableHead>
                  <TableHead className="text-right">Confidence</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Decision</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((log) => (<TableRow key={log.id} className="text-xs">
                    <TableCell className="font-mono-data">{log.time}</TableCell>
                    <TableCell className="font-mono-data font-semibold">{log.symbol}</TableCell>
                    <TableCell>{log.strategy}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">{log.llmRegime}</Badge>
                    </TableCell>
                    <TableCell className={`text-right font-mono-data ${log.confidence >= 0.6 ? "text-profit" : "text-loss"}`}>
                      {(log.confidence * 100).toFixed(0)}%
                    </TableCell>
                    <TableCell className={`text-right font-mono-data ${log.indicatorScore >= 6 ? "text-profit" : "text-loss"}`}>
                      {log.indicatorScore}/10
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] ${log.riskStatus === "OK" ? "text-profit border-profit/30" : "text-warning border-warning/30"}`}>
                        {log.riskStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] ${log.decision === "TRADE" ? "bg-success/20 text-success border-success/30" : "bg-loss/20 text-loss border-loss/30"}`}>
                        {log.decision}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate">{log.reason}</TableCell>
                  </TableRow>))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>);
};
export default TradeLogs;
