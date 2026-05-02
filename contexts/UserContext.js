'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import Script from 'next/script';
import { callAction } from '@/lib/api';

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
      if (!liffId) throw new Error('LIFF ID missing');

      await window.liff.init({ liffId });
      setLiff(window.liff);

      if (window.liff.isLoggedIn()) {
        const userProfile = await window.liff.getProfile();
        setProfile(userProfile);

        // Check if user exists in DB without registering yet
        const data = await callAction('check_user', {
          line_id: userProfile.userId,
          name: userProfile.displayName,
          picture_url: userProfile.pictureUrl || null,
        });

        if (data.status === 'success' && data.user) {
          setDbUser(data.user);
        } else {
          setDbUser(null);
          if (window.location.pathname !== '/onboarding') {
            window.location.href = '/onboarding';
          }
        }
      }
    } catch (err) {
      console.error('UserContext Init Error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && window.liff) {
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
