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
    <Card className={cn(className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-4 w-[100px]" />
        ) : (
          <div className="text-2xl font-bold">{value}</div>
        )}
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
