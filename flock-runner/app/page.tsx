"use client";

import dynamic from "next/dynamic";

// Oyun tamamen Canvas + tarayıcı API'lerine dayandığı için sadece client'ta
// mount edilir (SSR kapalı). page.tsx görevi: tam ekran kapsayıcı + mount.
const Game = dynamic(() => import("./Game"), { ssr: false });

export default function Home() {
  return (
    <main>
      <Game />
    </main>
  );
}
