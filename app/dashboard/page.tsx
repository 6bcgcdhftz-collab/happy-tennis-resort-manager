
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

export default function Dashboard() {
  const [email, setEmail] = useState("");
  const [resort, setResort] = useState("Ambiente resort");

  useEffect(() => {
    const run = async () => {
      const supabase = getSupabase();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/";
        return;
      }

      setEmail(user.email ?? "");

      const { data } = await supabase
        .from("resort_memberships")
        .select("resorts(name)")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      const joined = data?.resorts as unknown as
        { name: string } | null;

      if (!joined?.name) {
        window.location.href = "/setup";
        return;
      }

      setResort(joined.name);
    };

    run();
  }, []);

  async function logout() {
    const supabase = getSupabase();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

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
        <h1>{resort}</h1>
        <p>Accesso effettuato come {email}</p>
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
                window.location.href = modulo.percorso;
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
