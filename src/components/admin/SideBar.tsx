"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileText,
  LayoutDashboard,
  Layers,
  LogOut,
  Package,
  Settings,
  Shield,
  ShoppingCart,
  Truck,
  Users,
} from "lucide-react";

import { createClient } from "../../utils/supabase/client";
import { cn } from "../../lib/utils";

const menuItems = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Inventory", href: "/admin/inventory/products", icon: Package },
  { label: "Categories", href: "/admin/inventory/categories", icon: Layers },
  { label: "Orders", href: "/admin/orders", icon: ShoppingCart },
  { label: "Sales", href: "/admin/sales", icon: CreditCard },
  { label: "Customers", href: "/admin/customers", icon: Users },
  { label: "Suppliers", href: "/admin/suppliers", icon: Truck },
  { label: "Reports", href: "/admin/reports/stock-logs", icon: FileText },
  { label: "Team", href: "/admin/users", icon: Shield },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

export default function SideBar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const isActive = (href: string) => {
    if (href === "/admin") {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/auth/login");
  };

  return (
    <aside
      className={cn(
        "group/sidebar relative flex h-screen shrink-0 flex-col transition-all duration-300 ease-in-out",
        "border-r border-slate-800 bg-slate-950 text-slate-100",
        isCollapsed ? "w-[80px]" : "w-[260px]"
      )}
    >
      {/* Toggle Button - positioned on the border */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="absolute -right-3 top-8 z-50 flex h-6 w-6 items-center justify-center rounded-full border border-slate-800 bg-slate-900 text-slate-400 opacity-0 shadow-lg transition-all hover:bg-slate-800 hover:text-white group-hover/sidebar:opacity-100"
      >
        {isCollapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronLeft className="h-3 w-3" />
        )}
      </button>

      {/* Header / Logo */}
      <div className={cn("flex items-center px-6 pt-8 pb-8", isCollapsed ? "justify-center px-2" : "")}>
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/20">
            <span className="text-lg font-bold text-white">F</span>
          </div>
          <div
            className={cn(
              "flex flex-col transition-all duration-300",
              isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100"
            )}
          >
            <span className="whitespace-nowrap text-sm font-bold tracking-wide text-white">
              FLUX POS
            </span>
            <span className="whitespace-nowrap text-[10px] uppercase tracking-wider text-slate-500">
              Management
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-4 py-4 scrollbar-none">
        <div className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={isCollapsed ? item.label : undefined}
                className={cn(
                  "relative flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all duration-200 group",
                  active
                    ? "bg-slate-800/50 text-emerald-400 ring-1 ring-slate-700"
                    : "text-slate-400 hover:bg-slate-900 hover:text-slate-200",
                  isCollapsed && "justify-center px-0"
                )}
              >
                {active && !isCollapsed && (
                   <div className="absolute left-0 h-6 w-1 rounded-r-full bg-emerald-500" />
                )}
                
                <Icon
                  className={cn(
                    "h-5 w-5 shrink-0 transition-colors",
                    active ? "text-emerald-400" : "text-slate-500 group-hover:text-slate-300"
                  )}
                />
                
                <span
                  className={cn(
                    "whitespace-nowrap transition-all duration-300",
                    isCollapsed ? "w-0 overflow-hidden opacity-0" : "w-auto opacity-100"
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4">
        <div className="mb-4 h-px w-full bg-gradient-to-r from-transparent via-slate-800 to-transparent" />
        <button
          onClick={handleLogout}
          className={cn(
            "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-400 transition-all hover:bg-red-500/10 hover:text-red-400",
            isCollapsed && "justify-center px-0"
          )}
          title="Sign Out"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          <span
            className={cn(
              "whitespace-nowrap transition-all duration-300",
              isCollapsed ? "w-0 overflow-hidden opacity-0" : "w-auto opacity-100"
            )}
          >
            Sign Out
          </span>
        </button>
      </div>
    </aside>
  );
}
