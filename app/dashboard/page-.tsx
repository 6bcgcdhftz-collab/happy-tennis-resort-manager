 "use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";

export default function Dashboard() {
  const [email, setEmail] = useState("");
  const [resort, setResort] = useState("Ambiente resort");
  useEffect(() => {
    const run = async () => {
      const supabase = getSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/"; return; }
      setEmail(user.email ?? "");
      const { data } = await supabase.from("resort_memberships")
        .select("resorts(name)").eq("user_id", user.id).limit(1).maybeSingle();
      const joined = data?.resorts as unknown as { name: string } | null;
      if (!joined?.name) { window.location.href = "/setup"; return; }
      setResort(joined.name);
    };
    run();
  }, []);
  async function logout() {
    const supabase = getSupabase();
    await supabase.auth.signOut();
    window.location.href = "/";
  }
  return <main className="dashboard">
    <header className="dash-head"><div className="brand compact"><span className="ball">●</span><div><strong>Happy Tennis</strong><em>Resort Manager</em></div></div><button onClick={logout}>Esci</button></header>
    <section className="welcome"><span className="eyebrow">AMBIENTE OPERATIVO</span><h1>{resort}</h1><p>Accesso effettuato come {email}</p><div className="notice">Primo modulo attivo: autenticazione e creazione dell'ambiente resort. Le altre sezioni saranno abilitate progressivamente durante lo sviluppo.</div></section>
    <section className="module-grid">{["Manutenzione campi","Inventario","Manutenzione materiale","Lezioni e maestri","Prenotazioni e affitti","Tornei","Eventi","Contabilità","Gestione turisti","Documenti contrattuali"].map((x,i)=><article key={x}><small>{String(i+1).padStart(2,"0")}</small><h3>{x}</h3><span>Modulo in preparazione</span></article>)}</section>
  </main>;
}
