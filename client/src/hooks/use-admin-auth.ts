import { useCallback, useEffect, useState } from "react";
import { checkSession } from "@/lib/auth";

export function useAdminAuth() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;

    checkSession()
      .then((isLoggedIn) => {
        if (!active) return;
        setAuthenticated(isLoggedIn);
        setChecking(false);
      })
      .catch(() => {
        if (!active) return;
        setAuthenticated(false);
        setChecking(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const markAuthenticated = useCallback(() => {
    setAuthenticated(true);
  }, []);

  const markLoggedOut = useCallback(() => {
    setAuthenticated(false);
  }, []);

  return { authenticated, checking, markAuthenticated, markLoggedOut };
}

