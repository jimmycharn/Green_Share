"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function ClientLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState(null);

  // Mock checking if logged in / getting profile
  useEffect(() => {
    // In a real app, you'd fetch user from your DB or LIFF here
  }, []);

  const navItems = [
    { label: "หน้าแรก", icon: "🏠", path: "/" },
    { label: "ไทม์ไลน์", icon: "📊", path: "/circles/view" },
    { label: "สมาชิก", icon: "👥", path: "/members" },
    { label: "กิจกรรม", icon: "🔔", path: "/activity" },
    { label: "ตั้งค่า", icon: "⚙️", path: "/profile" },
  ];

  return (
    <>
      {/* Top Header */}
      <header className="app-header">
        <div className="app-title">GreenShare</div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ fontSize: "1.2rem" }}>🔔</div>
            <div style={{ width: "35px", height: "35px", borderRadius: "50%", background: "var(--primary-gradient)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "bold", fontSize: "0.8rem" }}>
                GS
            </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="app-container">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        {navItems.map((item) => {
          // Logic for active tab: exact match or starts with if it's a sub-route
          const isActive = item.path === "/" 
            ? pathname === "/" 
            : pathname.startsWith(item.path);

          return (
            <Link 
              key={item.path} 
              href={item.path} 
              className={`nav-item ${isActive ? "active" : ""}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
