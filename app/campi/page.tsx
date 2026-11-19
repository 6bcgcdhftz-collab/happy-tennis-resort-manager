
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
  const [campoSelezionato, setCampoSelezionato] =
    useState<Campo | null>(null);

  useEffect(() => {
    async function caricaCampi() {
      const supabase = getSupabase();

      const { data: { user } } =
        await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/";
        return;
      }

      const { data: membership, error: membershipError } =
        await supabase
          .from("resort_memberships")
          .select("resort_id")
          .eq("user_id", user.id)
          .limit(1)
          .single();

      if (membershipError || !membership) {
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

  const campiFiltrati = campi.filter(
    (campo) =>
      filtroSport === "tutti" ||
      campo.sport === filtroSport
  );

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

      <div style={{
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
        margin: "20px 0"
      }}>
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
              background:
                filtroSport === sport.value
                  ? "#a52b2b"
                  : "white",
              color:
                filtroSport === sport.value
                  ? "white"
                  : "#a52b2b"
            }}
          >
            {sport.label}
          </button>
        ))}
      </div>

      {loading && <p>Caricamento campi...</p>}
      {errore && <p style={{ color: "red" }}>{errore}</p>}

      {!loading && campiFiltrati.map((campo) => (
        <article
          key={campo.id}
          onClick={() => setCampoSelezionato(campo)}
          style={{
            background: "white",
            border: "1px solid #e8dccb",
            borderRadius: 14,
            padding: 18,
            marginBottom: 12,
            cursor: "pointer"
          }}
        >
          <h2 style={{ color: "#a52b2b" }}>
            {campo.name}
          </h2>
          <p>Sport: {campo.sport}</p>
          <p>Superficie: {campo.surface}</p>
          <p>Stato: {campo.status}</p>
          <strong style={{ color: "#a52b2b" }}>
            Apri scheda →
          </strong>
        </article>
      ))}

      {campoSelezionato && (
        <div
          onClick={() => setCampoSelezionato(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 18,
            zIndex: 1000
          }}
        >
          <section
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 18,
              padding: 24,
              width: "100%",
              maxWidth: 500,
              color: "#333"
            }}
          >
            <h2 style={{ color: "#a52b2b" }}>
              Scheda {campoSelezionato.name}
            </h2>

            <p>
              <strong>Sport:</strong>{" "}
              {campoSelezionato.sport}
            </p>

            <p>
              <strong>Superficie:</strong>{" "}
              {campoSelezionato.surface}
            </p>

            <p>
              <strong>Stato:</strong>{" "}
              {campoSelezionato.status}
            </p>

            <p style={{ color: "#777" }}>
              Qui aggiungeremo la modifica dei dati
              e lo storico della manutenzione.
            </p>

            <button
              onClick={() => setCampoSelezionato(null)}
              style={{
                width: "100%",
                padding: 14,
                marginTop: 16,
                border: "none",
                borderRadius: 10,
                background: "#a52b2b",
                color: "white",
                fontSize: 16
              }}
            >
              Chiudi scheda
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
