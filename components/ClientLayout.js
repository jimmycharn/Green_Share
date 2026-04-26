"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useUser } from "@/contexts/UserContext";

export default function ClientLayout({ children }) {
  const pathname = usePathname();
  const { profile, dbUser, isLoading } = useUser();

  // Format Header Name: Nickname (RealName)
  const headerName = dbUser 
    ? (dbUser.nickname && dbUser.name && dbUser.nickname !== dbUser.name 
        ? `${dbUser.nickname} (${dbUser.name})` 
        : (dbUser.nickname || dbUser.name))
    : (profile ? profile.displayName : "GreenShare");

  const navItems = [
    { label: "หน้าแรก", icon: "🏠", path: "/" },
    { label: "ไทม์ไลน์", icon: "📊", path: "/circles/view" },
    { label: "สมาชิก", icon: "👥", path: "/members" },
    { label: "กิจกรรม", icon: "🔔", path: "/activity" },
    { label: "ตั้งค่า", icon: "⚙️", path: "/profile" },
  ];

  // Removed global loading to prevent flicker

  return (
    <>
      {/* Top Header */}
      <header className="app-header">
        <div className="app-title" style={{ fontSize: "0.95rem", fontWeight: "700", display: "flex", alignItems: "center" }}>
            {headerName}
        </div>
        
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Link href="/activity" style={{ textDecoration: "none", fontSize: "1.1rem" }}>🔔</Link>
            <Link href="/profile" style={{ width: "36px", height: "36px", borderRadius: "50%", background: "var(--primary-gradient)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "bold", fontSize: "0.8rem", overflow: "hidden", border: "2px solid white", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
                {profile?.pictureUrl ? (
                    <img src={profile.pictureUrl} alt="User" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                    "GS"
                )}
            </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="app-container">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        {navItems.map((item) => {
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
