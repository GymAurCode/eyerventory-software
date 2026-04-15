import { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "../api/client";

const BRANDING_KEY = "company_name";
const DEFAULT_COMPANY = "Inventory Management System";
const BrandingContext = createContext(null);

export function BrandingProvider({ children }) {
  const [companyName, setCompanyName] = useState(localStorage.getItem(BRANDING_KEY) || DEFAULT_COMPANY);
  const [loadingBranding, setLoadingBranding] = useState(false);

  const refreshBranding = async () => {
    setLoadingBranding(true);
    try {
      const { data } = await api.get("/settings/branding");
      const nextName = data?.company_name?.trim() || DEFAULT_COMPANY;
      setCompanyName(nextName);
      localStorage.setItem(BRANDING_KEY, nextName);
      return nextName;
    } catch {
      return companyName;
    } finally {
      setLoadingBranding(false);
    }
  };

  useEffect(() => {
    refreshBranding();
  }, []);

  const updateCompanyName = async (nextName) => {
    const cleanName = nextName.trim();
    const { data } = await api.put("/settings/branding", { company_name: cleanName });
    const saved = data?.company_name?.trim() || cleanName;
    setCompanyName(saved);
    localStorage.setItem(BRANDING_KEY, saved);
    return saved;
  };

  const setLocalCompanyName = (nextName) => {
    const cleanName = nextName.trim() || DEFAULT_COMPANY;
    setCompanyName(cleanName);
    localStorage.setItem(BRANDING_KEY, cleanName);
  };

  const value = useMemo(
    () => ({ companyName, loadingBranding, refreshBranding, updateCompanyName, setLocalCompanyName }),
    [companyName, loadingBranding],
  );

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  return useContext(BrandingContext);
}
