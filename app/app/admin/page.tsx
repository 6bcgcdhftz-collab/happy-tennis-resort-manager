"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";

export default function AdminPage() {
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState("");

  useEffect(() => {
    async function verificaAdmin() {
      const supabase = getSupabase();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        window.location.href = "/";
        return;
      }

      const { data: admin, error: adminError } = await supabase
        .from("platform_admins")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (adminError || !admin) {
        setErrore("Accesso non autorizzato.");
        setLoading(false);
        return;
      }

      const { data: profilo } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();

      setNome(profilo?.full_name || user.email || "Amministratore");
      setLoading(false);
    }

    verificaAdmin();
  }, []);

  async function logout() {
    const supabase = getSupabase();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#fcf9f6",
        padding: 24,
        color: "#333",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <strong style={{ color: "#a52b2b", fontSize: 20 }}>
          Happy Tennis
        </strong>

        <button onClick={logout}>Esci</button>
      </header>

      <section
        style={{
          background: "white",
          border: "1px solid #e8dccb",
          borderRadius: 16,
          padding: 24,
          marginTop: 32,
        }}
      >
        {loading ? (
          <p>Verifica autorizzazione in corso...</p>
        ) : errore ? (
          <p style={{ color: "#b42318" }}>{errore}</p>
        ) : (
          <>
            <p style={{ color: "#a52b2b", fontWeight: "bold" }}>
              AMMINISTRAZIONE PIATTAFORMA
            </p>

            <h1>Benvenuto, {nome}</h1>

            <p>
              Questa è l'area di amministrazione generale di
              Happy Tennis Resort Manager.
            </p>

            <hr />

            <h2>Gestione piattaforma</h2>

            <p>
              Qui svilupperemo la gestione dei resort,
              degli abbonamenti e degli account.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
