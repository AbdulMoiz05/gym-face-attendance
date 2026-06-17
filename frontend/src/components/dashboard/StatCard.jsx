import { cn } from "@/lib/utils";

export default function StatCard({ title, value, change, changeType = "neutral", icon: Icon }) {
  return (
    <div className="stat-card animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <p className="stat-card-title">{title}</p>
          <p className="stat-card-value">{value}</p>
          {change && <p className={cn("stat-card-change", changeType)}>{change}</p>}
        </div>
        <div className="stat-card-icon">
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}
