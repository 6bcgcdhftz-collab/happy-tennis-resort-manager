 "use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase";

export default function Setup() {
  const [resortName, setResortName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const supabase = getSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/"; return; }
      const { error } = await supabase.rpc("create_resort_with_owner", {
        p_resort_name: resortName,
        p_owner_name: ownerName
      });
      if (error) throw error;
      window.location.href = "/dashboard";
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Impossibile creare il resort.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="setup-page">
    <section className="auth-card">
      <span className="eyebrow">CONFIGURAZIONE INIZIALE</span>
      <h2>Crea il tuo ambiente resort</h2>
      <p className="muted">Il primo account sarà registrato come Maestro responsabile, con accesso completo.</p>
      <form onSubmit={create}>
        <label>Nome del resort<input required minLength={2} maxLength={120} value={resortName} onChange={e=>setResortName(e.target.value)} placeholder="Es. Resort del Sole"/></label>
        <label>Nome e cognome del Maestro responsabile<input required value={ownerName} onChange={e=>setOwnerName(e.target.value)} placeholder="Nome e cognome"/></label>
        <button className="primary" disabled={busy}>{busy ? "Creazione..." : "Crea ambiente resort"}</button>
      </form>
      {message && <p className="message" role="alert">{message}</p>}
    </section>
  </main>;
}
