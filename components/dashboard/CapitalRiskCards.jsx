import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { capitalRisk } from "@/data/mockData";
import { DollarSign, TrendingUp, TrendingDown, Shield, AlertTriangle } from "lucide-react";
function formatCurrency(value) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(value);
}
function getPnlColor(value) {
    return value >= 0 ? "text-profit" : "text-loss";
}
function getRiskColor(used, limit) {
    const pct = (used / limit) * 100;
    if (pct >= 80)
        return "text-loss";
    if (pct >= 50)
        return "text-warning";
    return "text-profit";
}
function getRiskBarColor(used, limit) {
    const pct = (used / limit) * 100;
    if (pct >= 80)
        return "[&>div]:bg-loss";
    if (pct >= 50)
        return "[&>div]:bg-warning";
    return "[&>div]:bg-success";
}
export function CapitalRiskCards() {
    const data = capitalRisk;
    const lossLimitPct = (data.dailyLossUsed / data.dailyLossLimit) * 100;
    return (<div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
      <Card>
        <CardHeader className="pb-2 p-4">
          <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <DollarSign className="h-3 w-3"/> Total Capital
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <p className="text-xl font-bold font-mono-data">{formatCurrency(data.totalCapital)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 p-4">
          <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Shield className="h-3 w-3"/> Available Margin
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <p className="text-xl font-bold font-mono-data">{formatCurrency(data.availableMargin)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 p-4">
          <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <TrendingUp className="h-3 w-3"/> Today&apos;s PnL
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <p className={`text-xl font-bold font-mono-data ${getPnlColor(data.todayPnl)}`}>
            {data.todayPnl >= 0 ? "+" : ""}{formatCurrency(data.todayPnl)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 p-4">
          <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <TrendingUp className="h-3 w-3"/> Overall PnL
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <p className={`text-xl font-bold font-mono-data ${getPnlColor(data.overallPnl)}`}>
            {data.overallPnl >= 0 ? "+" : ""}{formatCurrency(data.overallPnl)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 p-4">
          <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <TrendingDown className="h-3 w-3"/> Max Drawdown
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <p className="text-xl font-bold font-mono-data text-loss">{data.maxDrawdown}%</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 p-4">
          <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <AlertTriangle className="h-3 w-3"/> Daily Loss Limit
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <p className={`text-sm font-bold font-mono-data mb-1 ${getRiskColor(data.dailyLossUsed, data.dailyLossLimit)}`}>
            {formatCurrency(data.dailyLossUsed)} / {formatCurrency(data.dailyLossLimit)}
          </p>
          <Progress value={lossLimitPct} className={`h-2 ${getRiskBarColor(data.dailyLossUsed, data.dailyLossLimit)}`}/>
        </CardContent>
      </Card>
    </div>);
}
