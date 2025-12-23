import type { ReactNode } from "react";
import SideBar from "../../components/admin/SideBar";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen w-full">
      <SideBar />
      <main className="flex-1 overflow-y-auto bg-slate-50 p-8">
        {children}
      </main>
    </div>
  );
}
