"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { isOnboarded } from "@/lib/onboarding";

export default function Home() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (isOnboarded()) {
      setReady(true);
    } else {
      // replace なので、タイトル画面で「戻る」を押してもここへ跳ね返らない。
      router.replace("/welcome");
    }
  }, [router]);

  if (!ready) return null;
  return <Dashboard />;
}
