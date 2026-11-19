
"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";

type Campo = {
  id: string;
  name: string;
  sport: string;
};

type Intervento = {
  id: string;
  court_id: string;
  title: string;
  description: string | null;
  maintenance_type: string;
  priority: string;
  status: string;
  created_at: string;
};

export default function ManutenzionePage() {
  const [campi, setCampi] = useState<Campo[]>([]);
  const [interventi, setInterventi] = useState<Intervento[]>([]);
  const [resortId, setResortId] = useState("");
  const [isMaestro, setIsMaestro] = useState(false);

  const [campoId, setCampoId] = useState("");
  const [titolo, setTitolo] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [tipo, setTipo] = useState("damage");
  const [priorita, setPriorita] = useState("medium");

  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [completandoId, setCompletandoId] = useState("");
  const [errore, setErrore] = useState("");
  const [messaggio, setMessaggio] = useState("");

  async function caricaDati() {
    const supabase = getSupabase();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      window.location.href = "/";
      return;
    }

    const { data: membership, error: membershipError } =
      await supabase
        .from("resort_memberships")
        .select("resort_id, role")
        .eq("user_id", user.id)
        
        .limit(1)
        .maybeSingle();

    if (membershipError || !membership) {
      setErrore("Nessun resort attivo associato all'utente.");
      setLoading(false);
      return;
    }

    setResortId(membership.resort_id);
    setIsMaestro(membership.role === "maestro_responsabile");

    const { data: campiData, error: campiError } =
      await supabase
        .from("sport_courts")
        .select("id, name, sport")
        .eq("resort_id", membership.resort_id)
        .order("name");

    if (campiError) {
      setErrore(campiError.message);
      setLoading(false);
      return;
    }

    setCampi(campiData || []);

    const { data: interventiData, error: interventiError } =
      await supabase
        .from("court_maintenance")
        .select(
          "id, court_id, title, description, maintenance_type, priority, status, created_at"
        )
        .eq("resort_id", membership.resort_id)
        .order("created_at", { ascending: false });

    if (interventiError) {
      setErrore(interventiError.message);
    } else {
      setInterventi(interventiData || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    caricaDati();
  }, []);

  async function creaSegnalazione() {
    if (!campoId || !titolo.trim()) {
      setErrore("Seleziona un campo e inserisci un titolo.");
      return;
    }

    if (!isMaestro || !resortId) {
      setErrore(
        "Solo il Maestro responsabile può registrare interventi."
      );
      return;
    }

    setSalvando(true);
    setErrore("");
    setMessaggio("");

    const supabase = getSupabase();

    const { error } = await supabase.rpc(
      "apri_intervento_manutenzione",
      {
        p_resort_id: resortId,
        p_court_id: campoId,
        p_title: titolo.trim(),
        p_description: descrizione.trim() || null,
        p_maintenance_type: tipo,
        p_priority: priorita,
      }
    );

    if (error) {
      setErrore("Errore nella segnalazione: " + error.message);
      setSalvando(false);
      return;
    }

    setMessaggio(
      "Segnalazione registrata. Il campo è stato messo in manutenzione."
    );

    setTitolo("");
    setDescrizione("");
    setCampoId("");
    setTipo("damage");
    setPriorita("medium");

    await caricaDati();
    setSalvando(false);
  }

  async function completaIntervento(intervento: Intervento) {
    if (!isMaestro || !resortId) {
      setErrore(
        "Solo il Maestro responsabile può confermare il completamento."
      );
      return;
    }

    const conferma = window.confirm(
      "Confermi il completamento dell'intervento? Il campo sarà riattivato solo se non ci sono altri interventi aperti."
    );

    if (!conferma) return;

    setCompletandoId(intervento.id);
    setErrore("");
    setMessaggio("");

    const supabase = getSupabase();

    const { error } = await supabase.rpc(
      "completa_intervento_manutenzione",
      {
        p_resort_id: resortId,
        p_maintenance_id: intervento.id,
      }
    );

    if (error) {
      setErrore("Errore nel completamento: " + error.message);
      setCompletandoId("");
      return;
    }

    setMessaggio(
      "Intervento completato. Lo stato del campo è stato verificato."
    );

    await caricaDati();
    setCompletandoId("");
  }

  function nomeCampo(id: string) {
    return campi.find((campo) => campo.id === id)?.name || "Campo";
  }

  function etichettaTipo(valore: string) {
    if (valore === "damage") return "Guasto";
    if (valore === "extraordinary") return "Straordinaria";
    return "Ordinaria";
  }

  function etichettaPriorita(valore: string) {
    if (valore === "urgent") return "Urgente";
    if (valore === "high") return "Alta";
    if (valore === "low") return "Bassa";
    return "Media";
  }

  function etichettaStato(valore: string) {
    if (valore === "in_progress") return "In lavorazione";
    if (valore === "completed") return "Completato";
    if (valore === "cancelled") return "Annullato";
    return "Aperto";
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#fcf9f6",
        color: "#333",
        padding: 24,
      }}
    >
      <button
        onClick={() => (window.location.href = "/dashboard")}
        style={{
          padding: "10px 16px",
          border: "1px solid #e8dccb",
          borderRadius: 9,
          background: "white",
          color: "#a52b2b",
        }}
      >
        ← Dashboard
      </button>

      <h1 style={{ color: "#a52b2b", marginTop: 28 }}>
        Manutenzione
      </h1>

      <p>Happy Tennis Resort Manager · Stagione 2027</p>

      {errore && (
        <p style={{ color: "#b42318", marginTop: 16 }}>
          {errore}
        </p>
      )}

      {messaggio && (
        <p style={{ color: "#287a45", marginTop: 16 }}>
          {messaggio}
        </p>
      )}

      <section
        style={{
          background: "white",
          border: "1px solid #e8dccb",
          borderRadius: 16,
          padding: 20,
          marginTop: 24,
        }}
      >
        <h2 style={{ color: "#a52b2b" }}>
          Nuova segnalazione
        </h2>

        {!isMaestro && !loading && (
          <p>
            Accesso in consultazione. Solo il Maestro responsabile
            può aprire e completare gli interventi.
          </p>
        )}

        <label>Campo interessato</label>
        <select
          value={campoId}
          onChange={(e) => setCampoId(e.target.value)}
          disabled={!isMaestro || loading || salvando}
          style={stileInput}
        >
          <option value="">Seleziona un campo</option>
          {campi.map((campo) => (
            <option key={campo.id} value={campo.id}>
              {campo.name} · {campo.sport}
            </option>
          ))}
        </select>

        <label>Titolo della segnalazione</label>
        <input
          value={titolo}
          onChange={(e) => setTitolo(e.target.value)}
          placeholder="Es. Rete danneggiata"
          disabled={!isMaestro || loading || salvando}
          style={stileInput}
        />

        <label>Descrizione</label>
        <textarea
          value={descrizione}
          onChange={(e) => setDescrizione(e.target.value)}
          placeholder="Descrivi il problema riscontrato..."
          disabled={!isMaestro || loading || salvando}
          rows={4}
          style={stileInput}
        />

        <label>Tipo di intervento</label>
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          disabled={!isMaestro || loading || salvando}
          style={stileInput}
        >
          <option value="damage">Guasto</option>
          <option value="ordinary">Manutenzione ordinaria</option>
          <option value="extraordinary">
            Manutenzione straordinaria
          </option>
        </select>

        <label>Priorità</label>
        <select
          value={priorita}
          onChange={(e) => setPriorita(e.target.value)}
          disabled={!isMaestro || loading || salvando}
          style={stileInput}
        >
          <option value="low">Bassa</option>
          <option value="medium">Media</option>
          <option value="high">Alta</option>
          <option value="urgent">Urgente</option>
        </select>

        <button
          onClick={creaSegnalazione}
          disabled={!isMaestro || salvando || loading}
          style={{
            width: "100%",
            padding: 15,
            marginTop: 16,
            border: "none",
            borderRadius: 10,
            background: "#a52b2b",
            color: "white",
            fontSize: 16,
            opacity: !isMaestro ? 0.5 : 1,
          }}
        >
          {salvando ? "Salvataggio..." : "Registra segnalazione"}
        </button>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ color: "#a52b2b" }}>
          Registro interventi
        </h2>

        {loading && <p>Caricamento interventi...</p>}

        {!loading && interventi.length === 0 && (
          <p>Non ci sono ancora interventi registrati.</p>
        )}

        {interventi.map((intervento) => (
          <article
            key={intervento.id}
            style={{
              background: "white",
              border: "1px solid #e8dccb",
              borderRadius: 14,
              padding: 18,
              marginBottom: 14,
            }}
          >
            <h3 style={{ color: "#a52b2b", marginTop: 0 }}>
              {intervento.title}
            </h3>

            <p>
              <strong>Campo:</strong>{" "}
              {nomeCampo(intervento.court_id)}
            </p>

            <p>
              <strong>Tipo:</strong>{" "}
              {etichettaTipo(intervento.maintenance_type)}
            </p>

            <p>
              <strong>Priorità:</strong>{" "}
              {etichettaPriorita(intervento.priority)}
            </p>

            <p>
              <strong>Stato:</strong>{" "}
              {etichettaStato(intervento.status)}
            </p>

            {intervento.description && (
              <p>{intervento.description}</p>
            )}

            <small>
              Registrato il{" "}
              {new Date(intervento.created_at).toLocaleString("it-IT")}
            </small>

            {isMaestro &&
              (intervento.status === "open" ||
                intervento.status === "in_progress") && (
                <button
                  onClick={() => completaIntervento(intervento)}
                  disabled={completandoId === intervento.id}
                  style={{
                    display: "block",
                    width: "100%",
                    padding: 13,
                    marginTop: 16,
                    border: "none",
                    borderRadius: 9,
                    background: "#287a45",
                    color: "white",
                    opacity:
                      completandoId === intervento.id ? 0.6 : 1,
                  }}
                >
                  {completandoId === intervento.id
                    ? "Completamento..."
                    : "Conferma completamento"}
                </button>
              )}
          </article>
        ))}
      </section>
    </main>
  );
}

const stileInput = {
  display: "block",
  width: "100%",
  boxSizing: "border-box" as const,
  padding: 12,
  margin: "8px 0 18px",
  border: "1px solid #d8c9ba",
  borderRadius: 8,
  fontSize: 16,
  background: "white",
};
