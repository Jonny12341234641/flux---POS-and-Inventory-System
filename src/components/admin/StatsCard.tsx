import type { LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import { cn } from "../../lib/utils";

export interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  loading?: boolean;
  className?: string;
}

export function StatsCard({
  title,
  value,
  icon: Icon,
  description,
  loading = false,
  className,
}: StatsCardProps) {
  return (
    <Card className={cn("transition-all hover:shadow-lg", className)}>
      <CardContent className="flex items-center gap-4 p-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-DEFAULT/15 text-brand-DEFAULT">
          <Icon className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-zinc-400">{title}</p>
          {loading ? (
            <Skeleton className="h-8 w-[100px] bg-zinc-800" />
          ) : (
            <h3 className="text-3xl font-bold tracking-tight text-zinc-50">
              {value}
            </h3>
          )}
          {description ? (
            <p className="text-xs text-zinc-500">{description}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
