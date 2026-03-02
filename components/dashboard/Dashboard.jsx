import { SystemStatusBar } from "@/components/dashboard/SystemStatusBar";
import { CapitalRiskCards } from "@/components/dashboard/CapitalRiskCards";
import { OpenPositions } from "@/components/dashboard/OpenPositions";
import { LLMContextPanel } from "@/components/dashboard/LLMContextPanel";
import { IndicatorScores } from "@/components/dashboard/IndicatorScores";
import { AlertsPanel } from "@/components/dashboard/AlertsPanel";
const Dashboard = () => {
    return (<div className="p-4 space-y-4">
      <SystemStatusBar />
      <CapitalRiskCards />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 flex flex-col gap-4">
          <OpenPositions/>
          <IndicatorScores />
        </div>
        <div className="space-y-4">
          <LLMContextPanel />
          
          <AlertsPanel />
        </div>
      </div>
    </div>);
};
export default Dashboard;
