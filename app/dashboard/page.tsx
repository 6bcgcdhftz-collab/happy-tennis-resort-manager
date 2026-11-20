
"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";

const moduli = [
  { nome: "Gestione campi", percorso: "/campi", attivo: true },
  { nome: "Manutenzione", percorso: "/manutenzione", attivo: true },
  { nome: "Inventario", attivo: false },
  { nome: "Manutenzione materiale", attivo: false },
  { nome: "Lezioni e maestri", attivo: false },
  { nome: "Prenotazioni e affitti", attivo: false },
  { nome: "Tornei", attivo: false },
  { nome: "Eventi", attivo: false },
  { nome: "Contabilità", attivo: false },
  { nome: "Gestione turisti", attivo: false },
  { nome: "Documenti contrattuali", attivo: false },
];

type ResortOption = {
  id: string;
  name: string;
};

export default function Dashboard() {
  const [email, setEmail] = useState("");
  const [resorts, setResorts] = useState<ResortOption[]>([]);
  const [selectedResortId, setSelectedResortId] = useState("");

  useEffect(() => {
    const run = async () => {
      const supabase = getSupabase();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/";
        return;
      }

      setEmail(user.email ?? "");

      const { data, error } = await supabase
        .from("resort_memberships")
        .select("resort_id, resorts(name)")
        .eq("user_id", user.id);

      if (error || !data || data.length === 0) {
        window.location.href = "/setup";
        return;
      }

      const options = data.map((item) => {
        const joined = item.resorts as unknown as
          { name: string } | { name: string }[] | null;

        const resortData = Array.isArray(joined)
          ? joined[0]
          : joined;

        return {
          id: item.resort_id,
          name: resortData?.name ?? "Resort",
        };
      });

      setResorts(options);

      const mareESole = options.find(
        (item) => item.name.toLowerCase() === "mare e sole"
      );

      setSelectedResortId(
        mareESole?.id ?? options[0].id
      );
    };

    run();
  }, []);

  async function logout() {
    const supabase = getSupabase();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  function apriModulo(percorso: string) {
    if (!selectedResortId) return;

    window.location.href =
      `${percorso}?resort=${encodeURIComponent(selectedResortId)}`;
  }

  const selectedResort = resorts.find(
    (item) => item.id === selectedResortId
  );

  return (
    <main className="dashboard">
      <header className="dash-head">
        <div className="brand compact">
          <span className="ball">●</span>
          <div>
            <strong>Happy Tennis</strong>
            <em>Resort Manager</em>
          </div>
        </div>
        <button onClick={logout}>Esci</button>
      </header>

      <section className="welcome">
        <span className="eyebrow">AMBIENTE OPERATIVO</span>
        <h1>{selectedResort?.name ?? "Caricamento..."}</h1>
        <p>Accesso effettuato come {email}</p>

        <label htmlFor="resort-selector">
          Seleziona il resort
        </label>

        <select
          id="resort-selector"
          value={selectedResortId}
          onChange={(event) =>
            setSelectedResortId(event.target.value)
          }
        >
          {resorts.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>

        <div className="notice">
          Le sezioni operative saranno abilitate progressivamente
          durante lo sviluppo.
        </div>
      </section>

      <section className="module-grid">
        {moduli.map((modulo, i) => (
          <article
            key={modulo.nome}
            onClick={() => {
              if (modulo.attivo && modulo.percorso) {
                apriModulo(modulo.percorso);
              }
            }}
            style={{
              cursor: modulo.attivo ? "pointer" : "default",
            }}
          >
            <small>{String(i + 1).padStart(2, "0")}</small>
            <h3>{modulo.nome}</h3>
            <span>
              {modulo.attivo
                ? "Apri sezione →"
                : "Modulo in preparazione"}
            </span>
          </article>
        ))}
      </section>
    </main>
  );
}
