
"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase";

type Mode = "login" | "resort" | "staff";

export default function Home() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resortName, setResortName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  function cambiaModalita(nuovaModalita: Mode) {
    setMode(nuovaModalita);
    setMessage("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      const supabase = getSupabase();

      if (mode === "resort" || mode === "staff") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: ownerName.trim(),
              registration_type:
                mode === "staff" ? "staff" : "resort_owner",
            },
          },
        });

        if (error) throw error;
        if (!data.user) {
          throw new Error("Registrazione non completata.");
        }

        if (mode === "staff") {
          setMode("login");

          if (!data.session) {
            setMessage(
              "Registrazione ricevuta! Conferma la tua email. " +
              "Dopo la conferma potrai accedere e attendere " +
              "che il Maestro responsabile ti associ a un resort."
            );
          } else {
            setMessage(
              "Account creato correttamente! Ora attendi che " +
              "il Maestro responsabile ti associ al suo resort."
            );
          }
        } else {
          if (!data.session) {
            setMessage(
              "Registrazione ricevuta. Conferma l'email e poi accedi: " +
              "potrai completare la creazione del resort."
            );
          } else {
            window.location.href = "/setup";
          }
        }

        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Sessione non disponibile.");
      }

      const { data: memberships, error: membershipError } =
        await supabase
          .from("resort_memberships")
          .select("id")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .limit(1);

      if (membershipError) throw membershipError;

      if (memberships && memberships.length > 0) {
        window.location.href = "/dashboard";
        return;
      }

      if (user.user_metadata?.registration_type === "staff") {
        setMessage(
          "Accesso effettuato. Il tuo account non è ancora associato " +
          "a un resort. Attendi che il Maestro responsabile ti aggiunga."
        );
        return;
      }

      window.location.href = "/setup";
    } catch (err) {
      setMessage(
        err instanceof Error
          ? err.message
          : "Si è verificato un errore."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <section className="hero">
        <div className="brand">
          <span className="ball">●</span>
          <div>
            <strong>Happy Tennis</strong>
            <em>Resort Manager</em>
            <small>★★★★★</small>
          </div>
        </div>

        <div className="hero-copy">
          <span className="eyebrow">RESORT MANAGEMENT</span>
          <h1>
            La gestione sportiva,
            <br />
            con un nuovo standard.
          </h1>
          <p>
            Un unico spazio professionale per tennis, padel e pickleball.
          </p>
        </div>

        <div className="court-strip">
          <div className="court grass">TENNIS</div>
          <div className="court blue">PADEL</div>
          <div className="court clay">PICKLEBALL</div>
        </div>
      </section>

      <section className="auth-wrap">
        <div className="auth-card">
          <span className="eyebrow">
            AREA RISERVATA AL PERSONALE
          </span>

          <h2>
            {mode === "login"
              ? "Bentornato"
              : mode === "resort"
                ? "Registra un nuovo resort"
                : "Registrati come membro dello staff"}
          </h2>

          <p className="muted">
            {mode === "login"
              ? "Accedi al tuo ambiente di lavoro."
              : mode === "resort"
                ? "Crea un nuovo ambiente come Maestro responsabile."
                : "Crea il tuo account per entrare nello staff di un resort esistente."}
          </p>

          <div className="switch">
            <button
              type="button"
              className={mode === "login" ? "selected" : ""}
              onClick={() => cambiaModalita("login")}
            >
              Accedi
            </button>

            <button
              type="button"
              className={mode === "resort" ? "selected" : ""}
              onClick={() => cambiaModalita("resort")}
            >
              Nuovo resort
            </button>

            <button
              type="button"
              className={mode === "staff" ? "selected" : ""}
              onClick={() => cambiaModalita("staff")}
            >
              Nuovo membro staff
            </button>
          </div>

          <form onSubmit={submit}>
            {mode === "resort" && (
              <>
                <label>
                  Nome del resort
                  <input
                    required
                    minLength={2}
                    maxLength={120}
                    value={resortName}
                    onChange={(e) => setResortName(e.target.value)}
                    placeholder="Es. Resort del Sole"
                  />
                </label>

                <label>
                  Nome del Maestro responsabile
                  <input
                    required
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="Nome e cognome"
                  />
                </label>
              </>
            )}

            {mode === "staff" && (
              <label>
                Nome e cognome
                <input
                  required
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="Nome e cognome"
                />
              </label>
            )}

            <label>
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@resort.it"
              />
            </label>

            <label>
              Password
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Almeno 8 caratteri"
              />
            </label>

            <button className="primary" disabled={busy}>
              {busy
                ? "Attendere..."
                : mode === "login"
                  ? "Accedi"
                  : mode === "resort"
                    ? "Crea account e resort"
                    : "Registrati come membro staff"}
            </button>
          </form>

          {message && (
            <p className="message" role="status">
              {message}
            </p>
          )}

          <p className="fine">
            Accesso riservato agli utenti autorizzati del resort.
            Gli ospiti non dispongono di account.
          </p>
        </div>

        <footer>
          ITALIANO · ENGLISH · ESPAÑOL · FRANÇAIS
        </footer>
      </section>
    </main>
  );
}
