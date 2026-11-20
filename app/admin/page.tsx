
"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [esito, setEsito] = useState("");
  const [errore, setErrore] = useState("");

  useEffect(() => {
    async function verificaAdmin() {
      try {
        const supabase = getSupabase();

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          setErrore("Errore di autenticazione: " + userError.message);
          setLoading(false);
          return;
        }

        if (!user) {
          setErrore("Nessun utente autenticato.");
          setLoading(false);
          return;
        }

        setEmail(user.email || "Email non disponibile");
        setUserId(user.id);

        const { data: admin, error: adminError } = await supabase
          .from("platform_admins")
          .select("user_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (adminError) {
          setErrore(
            "Errore nella verifica amministratore: " +
              adminError.message +
              (adminError.code ? " (codice: " + adminError.code + ")" : "")
          );
          setLoading(false);
          return;
        }

        if (!admin) {
          setEsito(
            "Nessuna registrazione amministratore trovata per questo account."
          );
          setLoading(false);
          return;
        }

        setEsito("Account riconosciuto come amministratore della piattaforma.");

        setLoading(false);
      } catch (error) {
        setErrore(
          error instanceof Error
            ? error.message
            : "Errore imprevisto durante la verifica."
        );
        setLoading(false);
      }
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
        <p style={{ color: "#a52b2b", fontWeight: "bold" }}>
          DIAGNOSTICA AMMINISTRAZIONE
        </p>

        {loading ? (
          <p>Verifica dell'account in corso...</p>
        ) : (
          <>
            <h2>Account riconosciuto</h2>

            <p>
              <strong>Email:</strong> {email || "Non disponibile"}
            </p>

            <p style={{ overflowWrap: "anywhere" }}>
              <strong>ID account:</strong> {userId || "Non disponibile"}
            </p>

            <hr />

            <h2>Risultato verifica</h2>

            {errore ? (
              <p style={{ color: "#b42318", overflowWrap: "anywhere" }}>
                {errore}
              </p>
            ) : (
              <p style={{ color: esito.startsWith("Account riconosciuto") ? "#287a45" : "#b42318" }}>
                {esito}
              </p>
            )}
          </>
        )}
      </section>
    </main>
  );
}
