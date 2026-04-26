"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import Script from "next/script";

export default function ClientLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [dbUser, setDbUser] = useState(null);

  useEffect(() => {
    if (typeof window !== "undefined" && window.liff) {
      initLiff();
    }
  }, []);

  const handleScriptLoad = () => {
    if (window.liff) initLiff();
  };

  const initLiff = async () => {
    try {
      const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
      await window.liff.init({ liffId });
      if (window.liff.isLoggedIn()) {
        const userProfile = await window.liff.getProfile();
        setProfile(userProfile);
        
        // Fetch DB user for nickname (real name) label
        const res = await fetch('/api/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'register',
              name: userProfile.displayName,
              nickname: userProfile.displayName,
              line_id: userProfile.userId
            })
        });
        const data = await res.json();
        if (data.status === 'success') {
            setDbUser(data);
        }
      }
    } catch (err) {
      console.error("LIFF init failed in ClientLayout", err);
    }
  };

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

  return (
    <>
      <Script 
        src="https://static.line-scdn.net/liff/edge/versions/2.22.1/sdk.js" 
        onLoad={handleScriptLoad}
      />
      
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
