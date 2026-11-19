
"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";

type Campo = {
  id: string;
  name: string;
  sport: string;
  surface: string;
  status: string;
};

export default function CampiPage() {
  const [campi, setCampi] = useState<Campo[]>([]);
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState("");
  const [filtroSport, setFiltroSport] = useState("tutti");
  useEffect(() => {
    async function caricaCampi() {
      const supabase = getSupabase();

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/";
        return;
      }

      const { data: membership } = await supabase
        .from("resort_memberships")
        .select("resort_id")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      if (!membership) {
        setErrore("Nessun resort associato all'utente.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("sport_courts")
        .select("id, name, sport, surface, status")
        .eq("resort_id", membership.resort_id)
        .order("name");

      if (error) {
        setErrore(error.message);
      } else {
        setCampi(data || []);
      }

      setLoading(false);
    }

    caricaCampi();
  }, []);

  return (
    <main style={{
      padding: 24,
      background: "#fcf9f6",
      minHeight: "100vh",
      color: "#333"
    }}>
      <h1 style={{ color: "#a52b2b" }}>
        Gestione campi
      </h1>

      <p>Happy Tennis Resort Manager</p>

      <div style={{
        display: "flex",
        gap: 12,
        flexWrap: "wrap",
        margin: "24px 0"
      }}>
        <strong>6 Tennis</strong>
        <strong>6 Padel</strong>
        <strong>6 Pickleball</strong>
      </div>

      {loading && <p>Caricamento campi...</p>}
<div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "20px 0" }}>
  {[
    { label: "Tutti", value: "tutti" },
    { label: "Tennis", value: "tennis" },
    { label: "Padel", value: "padel" },
    { label: "Pickleball", value: "pickleball" }
  ].map((sport) => (
    <button
      key={sport.value}
      onClick={() => setFiltroSport(sport.value)}
      style={{
        padding: "12px 18px",
        borderRadius: 10,
        border: "1px solid #a52b2b",
        background: filtroSport === sport.value ? "#a52b2b" : "white",
        color: filtroSport === sport.value ? "white" : "#a52b2b"
      }}
    >
      {sport.label}
    </button>
  ))}
</div>
      {errore && <p style={{ color: "red" }}>{errore}</p>}

      {!loading && campi.map((campo) => (
        <article key={campo.id} style={{
          background: "white",
          border: "1px solid #e8dccb",
          borderRadius: 14,
          padding: 18,
          marginBottom: 12
        }}>
          <h2 style={{ color: "#a52b2b" }}>
            {campo.name}
          </h2>
          <p>Sport: {campo.sport}</p>
          <p>Superficie: {campo.surface}</p>
          <p>Stato: {campo.status}</p>
        </article>
      ))}
    </main>
  );
}
