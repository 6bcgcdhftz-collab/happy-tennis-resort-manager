 "use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase";

type Mode = "login" | "register";

export default function Home() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resortName, setResortName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const supabase = getSupabase();
      if (mode === "register") {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: ownerName } }
        });
        if (error) throw error;
        if (!data.user) throw new Error("Registrazione non completata.");
        if (!data.session) {
          setMessage("Registrazione ricevuta. Conferma l'email e poi accedi: potrai completare la creazione del resort.");
        } else {
          window.location.href = "/setup";
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Sessione non disponibile.");
        const { data: memberships, error: membershipError } = await supabase
          .from("resort_memberships").select("id").eq("user_id", user.id).eq("is_active", true).limit(1);
        if (membershipError) throw membershipError;
        window.location.href = memberships && memberships.length > 0 ? "/dashboard" : "/setup";
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Si è verificato un errore.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <section className="hero">
        <div className="brand"><span className="ball">●</span><div><strong>Happy Tennis</strong><em>Resort Manager</em><small>★★★★★</small></div></div>
        <div className="hero-copy"><span className="eyebrow">RESORT MANAGEMENT</span><h1>La gestione sportiva,<br/>con un nuovo standard.</h1><p>Un unico spazio professionale per tennis, padel e pickleball.</p></div>
        <div className="court-strip"><div className="court grass">TENNIS</div><div className="court blue">PADEL</div><div className="court clay">PICKLEBALL</div></div>
      </section>
      <section className="auth-wrap">
        <div className="auth-card">
          <span className="eyebrow">AREA RISERVATA AL PERSONALE</span>
          <h2>{mode === "login" ? "Bentornato" : "Registra il tuo resort"}</h2>
          <p className="muted">{mode === "login" ? "Accedi al tuo ambiente di lavoro." : "Crea l'account iniziale del Maestro responsabile."}</p>
          <div className="switch"><button className={mode === "login" ? "selected" : ""} onClick={() => setMode("login")}>Accedi</button><button className={mode === "register" ? "selected" : ""} onClick={() => setMode("register")}>Nuovo resort</button></div>
          <form onSubmit={submit}>
            {mode === "register" && <>
              <label>Nome del resort<input required value={resortName} onChange={e => setResortName(e.target.value)} placeholder="Es. Resort del Sole"/></label>
              <label>Nome del Maestro responsabile<input required value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="Nome e cognome"/></label>
            </>}
            <label>Email<input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="nome@resort.it"/></label>
            <label>Password<input type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} placeholder="Almeno 8 caratteri"/></label>
            <button className="primary" disabled={busy}>{busy ? "Attendere..." : mode === "login" ? "Accedi" : "Crea account"}</button>
          </form>
          {message && <p className="message" role="status">{message}</p>}
          <p className="fine">Accesso riservato agli utenti autorizzati del resort. Gli ospiti non dispongono di account.</p>
        </div>
        <footer>ITALIANO · ENGLISH · ESPAÑOL · FRANÇAIS</footer>
      </section>
    </main>
  );
}
