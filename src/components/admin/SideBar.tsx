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
        "relative flex h-screen shrink-0 flex-col text-white transition-all duration-300 ease-in-out",
        "rounded-r-2xl border-r border-zinc-800 bg-[#09090b] shadow-xl",
        isCollapsed ? "w-[80px]" : "w-[240px]"
      )}
    >
      <div
        aria-hidden="true"
        className="absolute left-5 top-5 flex gap-1.5"
      >
        <span className="h-2.5 w-2.5 rounded-full bg-[#FF5A52]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#E6C02A]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#53C22B]" />
      </div>

      {/* Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="absolute -right-3 top-14 z-50 flex h-6 w-6 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-zinc-400 shadow-md transition hover:bg-zinc-800 hover:text-white"
      >
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </button>

      {/* Header / Logo */}
      <div className="px-5 pt-12">
        <div
          className={cn(
            "flex items-center gap-3 transition-all duration-300",
            isCollapsed && "justify-center"
          )}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F2C7BA] text-sm font-bold text-[#242220] shadow-sm">
            F
          </div>
          <div
            className={cn(
              "flex flex-col transition-all duration-300",
              isCollapsed && "w-0 overflow-hidden opacity-0"
            )}
          >
            <span className="text-[10px] uppercase tracking-wider text-zinc-500">
              Admin Panel
            </span>
            <span
              className="text-sm font-semibold text-zinc-100"
            >
              FLUX ADMIN
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden pt-6">
        <div
          className={cn(
            "px-5 text-[10px] uppercase tracking-wider text-zinc-500",
            isCollapsed && "px-0 text-center"
          )}
        >
          <span className={cn(isCollapsed && "sr-only")}>Main</span>
        </div>
        <ul
          className={cn(
            "mt-2 space-y-1 px-3",
            isCollapsed && "px-0"
          )}
        >
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-zinc-800/50 text-white"
                      : "text-zinc-400 hover:bg-zinc-800/30 hover:text-zinc-100",
                    isCollapsed && "mx-auto w-10 justify-center px-0"
                  )}
                  title={isCollapsed ? item.label : undefined}
                >
                  {active && (
                    <span className="pointer-events-none absolute inset-0 rounded-lg bg-gradient-to-r from-zinc-800/50 to-transparent opacity-50" />
                  )}
                  <Icon
                    className={cn(
                      "relative z-10 h-5 w-5 shrink-0 transition-colors",
                      active
                        ? "text-white"
                        : "text-zinc-500 group-hover:text-zinc-300"
                    )}
                  />
                  <span
                    className={cn(
                      "relative z-10 whitespace-nowrap transition-all duration-300",
                      isCollapsed
                        ? "w-0 overflow-hidden opacity-0"
                        : "w-auto opacity-100"
                    )}
                  >
                    {item.label}
                  </span>

                  {/* Active Indicator (optional polish) */}
                  {!isCollapsed && active && (
                    <div className="absolute right-2 z-10 h-1.5 w-1.5 rounded-full bg-[#CC8B8B] shadow-[0_0_8px_rgba(204,139,139,0.8)]" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer / Logout */}
      <div className="px-5 pb-5">
        <div className="mb-3 h-px w-full bg-zinc-800" />
        <button
          type="button"
          onClick={handleLogout}
          className={cn(
            "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
            "text-[#FF8E8E] hover:bg-zinc-800/30 hover:text-red-400",
            isCollapsed && "mx-auto w-10 justify-center px-0"
          )}
          title={isCollapsed ? "Sign Out" : undefined}
        >
          <LogOut className="h-5 w-5 shrink-0 text-[#FF8E8E] group-hover:text-red-400" />
          <span
            className={cn(
              "whitespace-nowrap transition-all duration-300",
              isCollapsed
                ? "w-0 overflow-hidden opacity-0"
                : "w-auto opacity-100"
            )}
          >
            Sign Out
          </span>
        </button>
      </div>
    </aside>
  );
}
