"use client";

import { useEffect, useState } from "react";
import Script from "next/script";

export default function Home() {
  const [status, setStatus] = useState("⏳ กำลังเริ่มระบบ...");
  const [statusColor, setStatusColor] = useState("text-primary");
  const [profile, setProfile] = useState(null);
  const [logs, setLogs] = useState([]);

  const addLog = (msg) => {
    setLogs((prev) => [...prev, msg]);
  };

  useEffect(() => {
    addLog("Component mounted.");
    if (typeof window !== "undefined" && window.liff) {
      addLog("liff already exists in window, initializing...");
      initLiff();
    }
  }, []);

  const handleScriptLoad = () => {
    addLog("LIFF Script loaded.");
    if (window.liff) {
      initLiff();
    } else {
      addLog("LIFF window object is missing after load.");
    }
  };

  const initLiff = async () => {
    try {
      addLog("Starting initLiff...");
      const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
      addLog(`LIFF ID configured: ${liffId ? liffId : 'MISSING'}`);
      
      if (!liffId) {
        setStatus("Error: LIFF ID is not defined in environment variables");
        setStatusColor("text-danger");
        return;
      }

      await window.liff.init({ liffId });
      addLog("LIFF Init successful.");
      setStatus("Init สำเร็จ! ตรวจสอบสถานะ...");
      setStatusColor("text-success");
      
      if (!window.liff.isLoggedIn()) {
        addLog("Not logged in. Waiting for user to click login.");
        setStatus("กรุณากดปุ่มเพื่อเข้าสู่ระบบ");
        setStatusColor("text-warning");
        return;
      }
      
      addLog("Logged in. Fetching profile...");
      const userProfile = await window.liff.getProfile();
      setProfile(userProfile);
      setStatus("สวัสดีคุณ " + userProfile.displayName);
      setStatusColor("text-success");
      addLog("Profile fetched. Registering via API...");

      // Auto-register member
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register',
          name: userProfile.displayName,
          nickname: userProfile.displayName, // fallback
          line_id: userProfile.userId,
          phone: '', // to be updated later
          bank_account: '' // to be updated later
        })
      });
      const resData = await res.json();
      addLog(`API Response: ${JSON.stringify(resData)}`);

    } catch (err) {
      addLog(`Error in initLiff: ${err.message || err.toString()}`);
      setStatus("Error: " + (err.message || err.toString()));
      setStatusColor("text-danger");
    }
  };

  const handleLoginClick = () => {
    addLog("User clicked Login button.");
    if (window.liff) {
      window.liff.login();
    }
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Kanit, sans-serif", textAlign: "center", minHeight: "100vh" }}>
      <Script 
        src="https://static.line-scdn.net/liff/edge/versions/2.22.1/sdk.js" 
        onLoad={handleScriptLoad}
        onError={() => addLog("Failed to load LIFF script.")}
      />
      
      <h3>🔧 ระบบ Green Share Dashboard</h3>
      
      <div style={{ background: "#f8f9fa", padding: "15px", borderRadius: "10px", margin: "20px 0", border: "1px solid #ddd" }}>
        <p>สถานะปัจจุบัน:</p>
        <h2 className={statusColor} style={{ color: statusColor === "text-danger" ? "red" : statusColor === "text-warning" ? "orange" : statusColor === "text-success" ? "green" : "blue", wordBreak: "break-word", fontSize: "1.2rem" }}>
          {status}
        </h2>
        
        {status === "กรุณากดปุ่มเพื่อเข้าสู่ระบบ" && (
          <button 
            onClick={handleLoginClick} 
            style={{ marginTop: "15px", padding: "10px 20px", fontSize: "16px", background: "#00B900", color: "#fff", border: "none", borderRadius: "5px", cursor: "pointer", fontWeight: "bold" }}
          >
            เข้าสู่ระบบด้วย LINE
          </button>
        )}
        {profile && (
          <div style={{ marginTop: "20px" }}>
            <img src={profile.pictureUrl} alt="Profile" style={{ width: "80px", borderRadius: "50%" }} />
          </div>
        )}
      </div>
      
      <div id="fallback" style={{ marginTop: "20px" }}>
        <a 
          href={`https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}`} 
          style={{ display: "block", padding: "10px", background: "#ffc107", color: "#000", textDecoration: "none", borderRadius: "5px" }}
        >
          🔄 ลองกดโหลดใหม่ หรือเปิดผ่านแอป LINE
        </a>
      </div>

      <div style={{ marginTop: "40px", textAlign: "left", background: "#333", color: "#0f0", padding: "10px", borderRadius: "5px", fontFamily: "monospace", fontSize: "0.8rem", overflowY: "auto", maxHeight: "300px" }}>
        <p>Debug Logs:</p>
        {logs.map((log, i) => (
          <div key={i}>&gt; {log}</div>
        ))}
      </div>
    </div>
  );
}
