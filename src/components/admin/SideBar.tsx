"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
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
    router.replace("/login");
  };

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col bg-slate-900 text-white">
      <div className="p-6">
        <h1 className="text-lg font-bold tracking-wider">FLUX ADMIN</h1>
      </div>

      <nav className="flex-1">
        <ul>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={[
                    "flex items-center gap-3 px-6 py-3 text-sm font-medium",
                    active
                      ? "bg-blue-600 text-white"
                      : "text-slate-400 transition-colors hover:bg-slate-800 hover:text-white",
                  ].join(" ")}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-auto">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 p-4 text-red-400 hover:bg-slate-800 hover:text-red-300"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
