import React, { useEffect } from "react";
import { useLocation } from "@docusaurus/router";

interface RootProps {
  children: React.ReactNode;
}

export default function Root({ children }: RootProps): JSX.Element {
  const location = useLocation();

  // Scroll to top on every page navigation
  useEffect(() => {
    window.scrollTo(0, 0);
    const interval = setInterval(() => window.scrollTo(0, 0), 16);
    const cleanup = setTimeout(() => clearInterval(interval), 400);
    return () => { clearInterval(interval); clearTimeout(cleanup); };
  }, [location.pathname]);

  return <>{children}</>;
}
