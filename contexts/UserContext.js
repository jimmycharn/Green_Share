"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Script from "next/script";

const UserContext = createContext();

export function UserProvider({ children }) {
  const [liff, setLiff] = useState(null);
  const [profile, setProfile] = useState(null);
  const [dbUser, setDbUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const initLiff = async () => {
    try {
      const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
      if (!liffId) throw new Error("LIFF ID missing");

      await window.liff.init({ liffId });
      setLiff(window.liff);

      if (window.liff.isLoggedIn()) {
        const userProfile = await window.liff.getProfile();
        setProfile(userProfile);

        // Fetch DB user once and cache it
        // Better house param detection (handling LIFF's various URL formats)
        const urlParams = new URLSearchParams(window.location.search);
        let houseParam = urlParams.get('house');
        
        // Fallback: Check if it's in the hash or after LIFF redirect
        if (!houseParam && window.location.hash.includes('house=')) {
          const hashParams = new URLSearchParams(window.location.hash.split('?')[1]);
          houseParam = hashParams.get('house');
        }

        console.log("Registering user with House Param:", houseParam);

        const res = await fetch('/api/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'register',
            name: userProfile.displayName,
            nickname: userProfile.displayName,
            line_id: userProfile.userId,
            house: houseParam
          })
        });
        const data = await res.json();
        if (data.status === 'success') {
          setDbUser(data);
          // Redirect to onboarding if profile is incomplete (no phone number)
          if (!data.phone && window.location.pathname !== '/onboarding') {
            window.location.href = '/onboarding';
          }
        }
      }
    } catch (err) {
      console.error("UserContext Init Error:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined" && window.liff) {
      initLiff();
    }
  }, []);

  const handleScriptLoad = () => {
    if (window.liff) initLiff();
  };

  return (
    <UserContext.Provider value={{ liff, profile, dbUser, isLoading, error }}>
      <Script 
        src="https://static.line-scdn.net/liff/edge/versions/2.22.1/sdk.js" 
        onLoad={handleScriptLoad}
        strategy="beforeInteractive"
      />
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
