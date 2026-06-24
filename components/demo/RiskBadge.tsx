import { Badge } from "@/components/ui/badge";
import { Shield, AlertTriangle, XCircle, CheckCircle } from "lucide-react";

interface Props { score?: number; level?: string; }

export default function RiskBadge({ score, level }: Props) {
  const l = level ?? (score !== undefined ? (score >= 80 ? "critical" : score >= 60 ? "high" : score >= 30 ? "medium" : "low") : "low");
  const map: Record<string, { cls: string; icon: React.ElementType; label: string }> = {
    low:      { cls: "bg-green-500/10 text-green-400 border-green-500/20",   icon: CheckCircle,    label: "Low Risk" },
    medium:   { cls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", icon: Shield,         label: "Medium Risk" },
    high:     { cls: "bg-orange-500/10 text-orange-400 border-orange-500/20", icon: AlertTriangle,  label: "High Risk" },
    critical: { cls: "bg-red-500/10 text-red-400 border-red-500/20",          icon: XCircle,        label: "Critical" },
  };
  const { cls, icon: Icon, label } = map[l] ?? map.low;
  return (
    <Badge variant="outline" className={`${cls} flex items-center gap-1 text-xs`}>
      <Icon className="w-3 h-3" />
      {label}{score !== undefined ? ` (${score})` : ""}
    </Badge>
  );
}
