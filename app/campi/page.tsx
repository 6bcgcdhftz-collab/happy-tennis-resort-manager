
"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

type Campo = {
  id: string;
  name: string;
  sport: string;
  surface: string;
  status: string;
};

function CampiPageContent() {
  const searchParams = useSearchParams();
  const [campi, setCampi] = useState<Campo[]>([]);
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState("");
  const [messaggio, setMessaggio] = useState("");
  const [filtroSport, setFiltroSport] = useState("tutti");
  const [campoSelezionato, setCampoSelezionato] =
    useState<Campo | null>(null);

  const [resortId, setResortId] = useState("");
  const [resortNome, setResortNome] = useState("");
  const [nome, setNome] = useState("");
  const [superficie, setSuperficie] = useState("");
  const [stato, setStato] = useState("active");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    async function caricaCampi() {
      const supabase = getSupabase();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/";
        return;
      }

      const resortRichiesto = searchParams.get("resort");

      const { data: memberships, error: membershipError } =
        await supabase
          .from("resort_memberships")
          .select("resort_id, resorts(name)")
          .eq("user_id", user.id)
          .eq("is_active", true);

      if (membershipError || !memberships?.length) {
        setErrore("Nessun resort associato all'utente.");
        setLoading(false);
        return;
      }

      const membership = resortRichiesto
        ? memberships.find(
            (item) => item.resort_id === resortRichiesto
          )
        : memberships.find((item) => {
            const joined = item.resorts as unknown as
              { name: string } | { name: string }[] | null;
            const resort = Array.isArray(joined)
              ? joined[0]
              : joined;
            return resort?.name?.toLowerCase() === "mare e sole";
          }) ?? memberships[0];

      if (!membership) {
        setErrore("Non hai accesso al resort selezionato.");
        setLoading(false);
        return;
      }

      const joined = membership.resorts as unknown as
        { name: string } | { name: string }[] | null;
      const resort = Array.isArray(joined) ? joined[0] : joined;

      setResortId(membership.resort_id);
      setResortNome(resort?.name ?? "Resort");

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
  }, [searchParams]);

  function apriScheda(campo: Campo) {
    setCampoSelezionato(campo);
    setNome(campo.name);
    setSuperficie(campo.surface);
    setStato(campo.status);
    setErrore("");
    setMessaggio("");
  }

  async function salvaModifiche() {
    if (!campoSelezionato || !resortId) return;

    if (!nome.trim() || !superficie.trim()) {
      setErrore("Inserisci il nome e la superficie.");
      return;
    }

    setSalvando(true);
    setErrore("");
    setMessaggio("");

    try {
      const supabase = getSupabase();

      const { data, error } = await supabase
        .from("sport_courts")
        .update({
          name: nome.trim(),
          surface: superficie.trim(),
          status: stato,
        })
        .eq("id", campoSelezionato.id)
        .eq("resort_id", resortId)
        .select("id, name, sport, surface, status")
        .maybeSingle();

      if (error) {
        setErrore("Errore durante il salvataggio: " + error.message);
        return;
      }

      if (!data) {
        setErrore(
          "Nessun campo aggiornato. Verificare i permessi e l'associazione al resort."
        );
        return;
      }

      setCampi((precedenti) =>
        precedenti.map((campo) =>
          campo.id === data.id ? data : campo
        )
      );

      setCampoSelezionato(data);
      setNome(data.name);
      setSuperficie(data.surface);
      setStato(data.status);
      setMessaggio("Modifiche salvate correttamente!");
    } catch {
      setErrore("Errore imprevisto durante il salvataggio.");
    } finally {
      setSalvando(false);
    }
  }

  const campiFiltrati = campi.filter(
    (campo) =>
      filtroSport === "tutti" || campo.sport === filtroSport
  );

  const conteggio = {
    tennis: campi.filter((campo) => campo.sport === "tennis").length,
    padel: campi.filter((campo) => campo.sport === "padel").length,
    pickleball: campi.filter((campo) => campo.sport === "pickleball").length,
  };

  const totaleAttivi = campi.filter(
    (campo) => campo.status === "active"
  ).length;

  const totaleManutenzione = campi.filter(
    (campo) => campo.status === "maintenance"
  ).length;

  const statoItaliano = (valore: string) => {
    if (valore === "active") return "Attivo";
    if (valore === "maintenance") return "In manutenzione";
    return "Non disponibile";
  };

  const iconaSport = (sport: string) => {
    if (sport === "tennis") return "🎾";
    if (sport === "padel") return "🏓";
    return "🥒";
  };

  return (
    <main className="courts-page">
      <header className="courts-hero">
        <div className="courts-brand">
          <span>🎾</span>
          <div>
            <strong>Happy Tennis</strong>
            <small>RESORT MANAGER</small>
          </div>
        </div>

        <div className="courts-hero-copy">
          <span>GESTIONE SPORTIVA</span>
          <h1>Gestione campi</h1>
          <p>
            Tutti i tuoi campi, organizzati in un unico spazio.
          </p>
        </div>

        <div className="courts-hero-bottom">
          <span>⭐ PREMIUM RESORT MANAGEMENT</span>
          <strong>{resortNome || "Il tuo resort"}</strong>
        </div>
      </header>

      <div className="courts-content">
        <button
          className="courts-back"
          onClick={() => {
            window.location.href = resortId
              ? `/dashboard?resort=${encodeURIComponent(resortId)}`
              : "/dashboard";
          }}
        >
          ← Torna alla dashboard
        </button>

        <div className="courts-heading">
          <div>
            <span className="courts-eyebrow">AREA SPORTIVA</span>
            <h2>I tuoi campi</h2>
            <p>Seleziona un campo per visualizzarne o modificarne i dati.</p>
          </div>
          <div className="courts-resort-name">
            {resortNome}
          </div>
        </div>

        <section className="courts-stats">
          <article className="courts-stat">
            <span>🎾</span>
            <strong>{campi.length}</strong>
            <small>Campi totali</small>
          </article>
          <article className="courts-stat">
            <span>✓</span>
            <strong>{totaleAttivi}</strong>
            <small>Campi attivi</small>
          </article>
          <article className="courts-stat">
            <span>🔧</span>
            <strong>{totaleManutenzione}</strong>
            <small>In manutenzione</small>
          </article>
        </section>

        <section className="courts-sports">
          <div className="courts-section-title">
            <span className="courts-eyebrow">DISCIPLINE</span>
            <h2>Filtra per sport</h2>
          </div>

          <div className="courts-filters">
            {[
              { label: "Tutti", value: "tutti" },
              { label: "Tennis", value: "tennis" },
              { label: "Padel", value: "padel" },
              { label: "Pickleball", value: "pickleball" },
            ].map((sport) => (
              <button
                key={sport.value}
                className={
                  filtroSport === sport.value
                    ? "courts-filter selected"
                    : "courts-filter"
                }
                onClick={() => setFiltroSport(sport.value)}
              >
                {sport.label}
              </button>
            ))}
          </div>

          <div className="courts-counts">
            <span>🎾 Tennis: <strong>{conteggio.tennis}</strong></span>
            <span>🏓 Padel: <strong>{conteggio.padel}</strong></span>
            <span>🥒 Pickleball: <strong>{conteggio.pickleball}</strong></span>
          </div>
        </section>

        {loading && (
          <div className="courts-message">
            Caricamento dei campi in corso...
          </div>
        )}

        {errore && !campoSelezionato && (
          <div className="courts-error">{errore}</div>
        )}

        {!loading && campiFiltrati.length === 0 && !errore && (
          <div className="courts-message">
            Nessun campo presente in questa categoria.
          </div>
        )}

        <section className="courts-grid">
          {!loading &&
            campiFiltrati.map((campo) => (
              <article
                key={campo.id}
                className="court-card"
                onClick={() => apriScheda(campo)}
              >
                <div className="court-card-top">
                  <span className="court-card-icon">
                    {iconaSport(campo.sport)}
                  </span>
                  <span
                    className={`court-status ${
                      campo.status === "active"
                        ? "status-active"
                        : campo.status === "maintenance"
                        ? "status-maintenance"
                        : "status-inactive"
                    }`}
                  >
                    {statoItaliano(campo.status)}
                  </span>
                </div>

                <h3>{campo.name}</h3>
                <p className="court-sport">
                  {campo.sport.toUpperCase()}
                </p>
                <p className="court-surface">
                  Superficie: {campo.surface}
                </p>
                <div className="court-card-link">
                  Apri scheda <span>→</span>
                </div>
              </article>
            ))}
        </section>

        <footer className="courts-footer">
          HAPPY TENNIS RESORT MANAGER · {resortNome}
        </footer>
      </div>

      {campoSelezionato && (
        <div
          className="court-modal-backdrop"
          onClick={() => setCampoSelezionato(null)}
        >
          <section
            className="court-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="court-modal-heading">
              <span>🎾 SCHEDA CAMPO</span>
              <button
                className="court-modal-close"
                onClick={() => setCampoSelezionato(null)}
              >
                ×
              </button>
            </div>

            <h2>{campoSelezionato.name}</h2>
            <p className="court-modal-subtitle">
              Modifica le informazioni del campo
            </p>

            <label>Nome del campo</label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />

            <label>Superficie</label>
            <input
              value={superficie}
              onChange={(e) => setSuperficie(e.target.value)}
            />

            <label>Stato del campo</label>
            <select
              value={stato}
              onChange={(e) => setStato(e.target.value)}
            >
              <option value="active">Attivo</option>
              <option value="maintenance">In manutenzione</option>
              <option value="inactive">Non disponibile</option>
            </select>

            {errore && (
              <p className="court-modal-error">{errore}</p>
            )}
            {messaggio && (
              <p className="court-modal-success">{messaggio}</p>
            )}

            <button
              className="court-save-button"
              onClick={salvaModifiche}
              disabled={salvando}
            >
              {salvando ? "Salvataggio..." : "Salva modifiche"}
            </button>

            <button
              className="court-cancel-button"
              onClick={() => setCampoSelezionato(null)}
            >
              Chiudi scheda
            </button>
          </section>
        </div>
      )}
    </main>
  );
}

export default function CampiPage() {
  return (
    <Suspense fallback={<p>Caricamento campi...</p>}>
      <CampiPageContent />
    </Suspense>
  );
}
