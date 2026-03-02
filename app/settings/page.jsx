"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from "@/components/ui/alert-dialog";
import { Shield, Lock } from "lucide-react";
const SettingsPage = () => {
    const [strategies, setStrategies] = useState({ trend: true, range: true, momentum: false });
    const [maxTrades, setMaxTrades] = useState(10);
    const [riskPct, setRiskPct] = useState([2]);
    const [llmEnabled, setLlmEnabled] = useState(true);
    const [paperMode, setPaperMode] = useState(true);
    const [confirmDialog, setConfirmDialog] = useState(null);
    const [password, setPassword] = useState("");
    const requireConfirm = (action, callback) => {
        setConfirmDialog({ action, callback });
        setPassword("");
    };
    const handleConfirm = () => {
        if (password === "admin") {
            confirmDialog?.callback();
        }
        setConfirmDialog(null);
        setPassword("");
    };
    return (<div className="p-4 space-y-4 max-w-2xl">
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5"/>
        <h1 className="text-lg font-semibold">Settings & Controls</h1>
      </div>

      {/* Strategies */}
      <Card>
        <CardHeader className="p-4 pb-3">
          <CardTitle className="text-sm">Strategy Toggles</CardTitle>
          <CardDescription className="text-xs">Enable or disable trading strategies</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          {Object.entries(strategies).map(([key, val]) => (<div key={key} className="flex items-center justify-between">
              <Label className="capitalize text-sm">{key} Trading</Label>
              <Switch checked={val} onCheckedChange={() => requireConfirm(`Toggle ${key} trading`, () => setStrategies(s => ({ ...s, [key]: !s[key] })))}/>
            </div>))}
        </CardContent>
      </Card>

      {/* Risk Controls */}
      <Card>
        <CardHeader className="p-4 pb-3">
          <CardTitle className="text-sm">Risk Controls</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-4">
          <div>
            <Label className="text-sm">Max Trades / Day</Label>
            <Input type="number" value={maxTrades} onChange={(e) => setMaxTrades(Number(e.target.value))} className="mt-1 w-32 font-mono-data"/>
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <Label className="text-sm">Risk % per Trade</Label>
              <span className="text-sm font-mono-data">{riskPct[0]}%</span>
            </div>
            <Slider value={riskPct} onValueChange={setRiskPct} max={10} step={0.5} className="w-full"/>
          </div>
        </CardContent>
      </Card>

      {/* LLM & Mode */}
      <Card>
        <CardHeader className="p-4 pb-3">
          <CardTitle className="text-sm">System Mode</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm">LLM Context Engine</Label>
            <Switch checked={llmEnabled} onCheckedChange={() => requireConfirm("Toggle LLM engine", () => setLlmEnabled(!llmEnabled))}/>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label className="text-sm">Trading Mode</Label>
              <Badge variant="outline" className={`text-[10px] ${paperMode ? "text-warning border-warning/30" : "text-profit border-profit/30"}`}>
                {paperMode ? "PAPER" : "LIVE"}
              </Badge>
            </div>
            <Switch checked={!paperMode} onCheckedChange={() => requireConfirm("Switch trading mode", () => setPaperMode(!paperMode))}/>
          </div>
        </CardContent>
      </Card>

      {/* Confirm Dialog */}
      <AlertDialog open={!!confirmDialog} onOpenChange={() => setConfirmDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4"/> Confirm: {confirmDialog?.action}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Enter admin password to confirm this change.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="my-2"/>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={!password}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>);
};
export default SettingsPage;
