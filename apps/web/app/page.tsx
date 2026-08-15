"use client";

import { useEffect, useState } from "react";
import { Dashboard } from "./Dashboard";
import { TitleScreen } from "./TitleScreen";

const ONBOARDED_KEY = "yomitore:onboarded";

export default function Home() {
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    setOnboarded(localStorage.getItem(ONBOARDED_KEY) === "1");
  }, []);

  if (onboarded === null) return null;
  return onboarded ? <Dashboard /> : <TitleScreen />;
}
