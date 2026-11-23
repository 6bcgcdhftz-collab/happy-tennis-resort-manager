
"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

type Cliente = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
};

type Campo = {
  id: string;
  name: string;
  sport: string;
  status: string;
};

type Prenotazione = {
  id: string;
  customer_id: string;
  court_id: string;
  starts_at: string;
  ends_at: string;
  price: number;
  status: "confirmed" | "cancelled" | "completed";
  notes: string | null;
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 13,
  marginTop: 7,
  border: "1px solid #dfd1c1",
  borderRadius: 9,
  background: "white",
  color: "#302b29",
  fontSize: 15,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginTop: 15,
  color: "#604c42",
  fontSize: 13,
  fontWeight: 700,
};

function PrenotazioniContent() {
  const searchParams = useSearchParams();
  const resortRichiesto = searchParams.get("resort");

  const [resortId, setResortId] = useState("");
  const [resortNome, setResortNome] = useState("");
  const [isMaestro, setIsMaestro] = useState(false);

  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [campi, setCampi] = useState<Campo[]>([]);
  const [prenotazioni, setPrenotazioni] = useState<Prenotazione[]>([]);

  const [clienteId, setClienteId] = useState("");
  const [campoId, setCampoId] = useState("");
  const [data, setData] = useState("");
  const [oraInizio, setOraInizio] = useState("09:00");
  const [oraFine, setOraFine] = useState("10:00");
  const [prezzo, setPrezzo] = useState("0");
  const [note, setNote] = useState("");

  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState("");
  const [messaggio, setMessaggio] = useState("");

  async function caricaDati() {
    setLoading(true);
    setErrore("");

    try {
      const supabase = getSupabase();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/";
        return;
      }

      const { data: memberships, error: membershipError } =
        await supabase
          .from("resort_memberships")
          .select("resort_id, role, resorts(name)")
          .eq("user_id", user.id)
          .eq("is_active", true);

      if (membershipError || !memberships?.length) {
        setErrore(
          membershipError?.message ||
            "Non risultano resort associati a questo account."
        );
        setLoading(false);
        return;
      }

      const membership = resortRichiesto
        ? memberships.find(
            (item) => item.resort_id === resortRichiesto
          )
        : memberships.find((item) => {
            const joined = item.resorts as unknown as
              | { name: string }
              | { name: string }[]
              | null;
            const resort = Array.isArray(joined) ? joined[0] : joined;
            return resort?.name?.toLowerCase() === "mare e sole";
          }) ?? memberships[0];

      if (!membership) {
        setErrore("Non hai accesso al resort selezionato.");
        setLoading(false);
        return;
      }

      const joined = membership.resorts as unknown as
        | { name: string }
        | { name: string }[]
        | null;
      const resort = Array.isArray(joined) ? joined[0] : joined;

      setResortId(membership.resort_id);
      setResortNome(resort?.name ?? "Resort");
      setIsMaestro(membership.role === "maestro_responsabile");

      const [clientiData, campiData, prenotazioniData] =
        await Promise.all([
          supabase
            .from("resort_customers")
            .select("id, first_name, last_name, phone, email")
            .eq("resort_id", membership.resort_id)
            .order("last_name"),

          supabase
            .from("sport_courts")
            .select("id, name, sport, status")
            .eq("resort_id", membership.resort_id)
            .eq("status", "active")
            .order("name"),

          supabase
            .from("court_bookings")
            .select(
              "id, customer_id, court_id, starts_at, ends_at, price, status, notes"
            )
            .eq("resort_id", membership.resort_id)
            .order("starts_at", { ascending: false }),
        ]);

      if (
        clientiData.error ||
        campiData.error ||
        prenotazioniData.error
      ) {
        setErrore(
          "Errore di caricamento: " +
            (clientiData.error?.message ||
              campiData.error?.message ||
              prenotazioniData.error?.message)
        );
        setLoading(false);
        return;
      }

      setClienti(clientiData.data || []);
      setCampi(campiData.data || []);
      setPrenotazioni(prenotazioniData.data || []);
    } catch (err) {
      setErrore(
        err instanceof Error ? err.message : "Errore imprevisto."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    caricaDati();
  }, [resortRichiesto]);

  async function salvaPrenotazione() {
    setErrore("");
    setMessaggio("");

    if (!resortId || !clienteId || !campoId || !data) {
      setErrore(
        "DATI MANCANTI: seleziona cliente, campo e data."
      );
      return;
    }

    if (!oraInizio || !oraFine || oraFine <= oraInizio) {
      setErrore(
        "ORARIO NON VALIDO: l'ora di fine deve essere successiva all'inizio."
      );
      return;
    }

    const prezzoNumerico = Number(prezzo);

    if (!Number.isFinite(prezzoNumerico) || prezzoNumerico < 0) {
      setErrore("Inserisci un prezzo valido.");
      return;
    }

    const inizio = new Date(`${data}T${oraInizio}:00`);
    const fine = new Date(`${data}T${oraFine}:00`);

    if (
      Number.isNaN(inizio.getTime()) ||
      Number.isNaN(fine.getTime()) ||
      fine <= inizio
    ) {
      setErrore("Controlla la data e gli orari inseriti.");
      return;
    }

    setSalvando(true);

    try {
      const supabase = getSupabase();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setErrore("Sessione scaduta. Accedi nuovamente.");
        return;
      }

      const { error } = await supabase
        .from("court_bookings")
        .insert({
          resort_id: resortId,
          customer_id: clienteId,
          court_id: campoId,
          starts_at: inizio.toISOString(),
          ends_at: fine.toISOString(),
          price: prezzoNumerico,
          status: "confirmed",
          notes: note.trim() || null,
          created_by: user.id,
        });

      if (error) {
        if (error.code === "23P01") {
          setErrore(
            "OVERBOOKING: il campo è già occupato in questa fascia oraria. Scegli un altro orario o un altro campo."
          );
        } else {
          setErrore(
            "Errore durante la prenotazione: " + error.message
          );
        }
        return;
      }

      setMessaggio("Prenotazione registrata correttamente!");
      setClienteId("");
      setCampoId("");
      setOraInizio("09:00");
      setOraFine("10:00");
      setPrezzo("0");
      setNote("");

      await caricaDati();
    } catch (err) {
      setErrore(
        err instanceof Error ? err.message : "Errore imprevisto."
      );
    } finally {
      setSalvando(false);
    }
  }

  async function cambiaStato(
    prenotazioneId: string,
    nuovoStato: "cancelled" | "completed"
  ) {
    if (!isMaestro || !resortId) return;

    const conferma =
      nuovoStato === "cancelled"
        ? "Vuoi annullare questa prenotazione?"
        : "Vuoi segnare questa prenotazione come completata?";

    if (!window.confirm(conferma)) return;

    setErrore("");
    setMessaggio("");

    const supabase = getSupabase();

    const { error } = await supabase
      .from("court_bookings")
      .update({ status: nuovoStato })
      .eq("id", prenotazioneId)
      .eq("resort_id", resortId);

    if (error) {
      setErrore("Errore durante l'aggiornamento: " + error.message);
      return;
    }

    setMessaggio(
      nuovoStato === "cancelled"
        ? "Prenotazione annullata."
        : "Prenotazione completata."
    );

    await caricaDati();
  }

  function nomeCliente(id: string) {
    const cliente = clienti.find((item) => item.id === id);
    return cliente
      ? `${cliente.first_name} ${cliente.last_name}`
      : "Cliente non disponibile";
  }

  function nomeCampo(id: string) {
    return (
      campi.find((item) => item.id === id)?.name ||
      "Campo non disponibile"
    );
  }

  function formattaData(valore: string) {
    return new Date(valore).toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function formattaOra(valore: string) {
    return new Date(valore).toLocaleTimeString("it-IT", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function statoItaliano(stato: string) {
    if (stato === "confirmed") return "Confermata";
    if (stato === "cancelled") return "Annullata";
    if (stato === "completed") return "Completata";
    return stato;
  }

  const oggi = new Date();
  const dataOggi = [
    oggi.getFullYear(),
    String(oggi.getMonth() + 1).padStart(2, "0"),
    String(oggi.getDate()).padStart(2, "0"),
  ].join("-");

  const attive = prenotazioni.filter(
    (item) => item.status === "confirmed"
  );

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "25px clamp(14px, 4vw, 45px)",
        background: "#faf7f2",
        color: "#302b29",
      }}
    >
      <div style={{ maxWidth: 1150, margin: "0 auto" }}>
        <header
          style={{
            padding: "25px",
            borderRadius: 15,
            color: "white",
            background: "linear-gradient(120deg, #741d20, #451316)",
            marginBottom: 25,
          }}
        >
          <div style={{ fontSize: 30 }}>📅</div>
          <div
            style={{
              color: "#e8c88c",
              fontSize: 11,
              letterSpacing: 2,
              marginTop: 8,
            }}
          >
            HAPPY TENNIS RESORT MANAGER
          </div>
          <h1
            style={{
              font: "bold 32px Georgia, serif",
              margin: "10px 0",
            }}
          >
            Prenotazioni campi
          </h1>
          <p style={{ margin: 0, color: "#f1ded5" }}>
            Gestione delle prenotazioni · {resortNome}
          </p>
        </header>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))",
            gap: 12,
            marginBottom: 25,
          }}
        >
          <div style={statStyle}>
            <strong style={statNumberStyle}>{prenotazioni.length}</strong>
            <span style={statLabelStyle}>Prenotazioni totali</span>
          </div>
          <div style={statStyle}>
            <strong style={statNumberStyle}>{attive.length}</strong>
            <span style={statLabelStyle}>Confermate</span>
          </div>
          <div style={statStyle}>
            <strong style={statNumberStyle}>{campi.length}</strong>
            <span style={statLabelStyle}>Campi attivi</span>
          </div>
        </section>

        {isMaestro && (
          <section style={panelStyle}>
            <h2 style={headingStyle}>＋ Nuova prenotazione</h2>

            <label style={labelStyle}>Cliente</label>
            <select
              style={inputStyle}
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
            >
              <option value="">Seleziona un cliente</option>
              {clienti.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.first_name} {cliente.last_name}
                  {cliente.phone ? ` · ${cliente.phone}` : ""}
                </option>
              ))}
            </select>

            {clienti.length === 0 && (
              <p style={hintStyle}>
                Non ci sono ancora clienti registrati in questo resort.
              </p>
            )}

            <label style={labelStyle}>Campo sportivo</label>
            <select
              style={inputStyle}
              value={campoId}
              onChange={(e) => setCampoId(e.target.value)}
            >
              <option value="">Seleziona un campo</option>
              {campi.map((campo) => (
                <option key={campo.id} value={campo.id}>
                  {campo.name} · {campo.sport}
                </option>
              ))}
            </select>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))",
                gap: 12,
              }}
            >
              <div>
                <label style={labelStyle}>Data</label>
                <input
                  type="date"
                  style={inputStyle}
                  value={data}
                  min={dataOggi}
                  onChange={(e) => setData(e.target.value)}
                />
              </div>

              <div>
                <label style={labelStyle}>Ora inizio</label>
                <input
                  type="time"
                  style={inputStyle}
                  value={oraInizio}
                  onChange={(e) => setOraInizio(e.target.value)}
                />
              </div>

              <div>
                <label style={labelStyle}>Ora fine</label>
                <input
                  type="time"
                  style={inputStyle}
                  value={oraFine}
                  onChange={(e) => setOraFine(e.target.value)}
                />
              </div>

              <div>
                <label style={labelStyle}>Prezzo (€)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  style={inputStyle}
                  value={prezzo}
                  onChange={(e) => setPrezzo(e.target.value)}
                />
              </div>
            </div>

            <label style={labelStyle}>Note</label>
            <textarea
              style={{ ...inputStyle, minHeight: 85, resize: "vertical" }}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Eventuali informazioni aggiuntive..."
            />

            {errore && (
              <p style={errorStyle}>{errore}</p>
            )}

            {messaggio && (
              <p style={successStyle}>{messaggio}</p>
            )}

            <button
              onClick={salvaPrenotazione}
              disabled={salvando || clienti.length === 0 || campi.length === 0}
              style={primaryButtonStyle}
            >
              {salvando ? "Registrazione in corso..." : "Registra prenotazione"}
            </button>
          </section>
        )}

        {!isMaestro && (
          <p style={hintStyle}>
            Puoi consultare le prenotazioni. La registrazione e la modifica
            sono riservate al maestro responsabile.
          </p>
        )}

        <section style={panelStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <h2 style={headingStyle}>Elenco prenotazioni</h2>
            <button
              onClick={caricaDati}
              style={refreshButtonStyle}
            >
              ↻ Aggiorna
            </button>
          </div>

          {loading && <p>Caricamento prenotazioni...</p>}

          {!loading && prenotazioni.length === 0 && (
            <p style={hintStyle}>
              Non sono ancora presenti prenotazioni per questo resort.
            </p>
          )}

          {!loading &&
            prenotazioni.map((prenotazione) => (
              <article
                key={prenotazione.id}
                style={{
                  padding: 16,
                  marginTop: 13,
                  border: "1px solid #eadfce",
                  borderRadius: 11,
                  background: "#fffdf9",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  <strong style={{ color: "#742326", fontSize: 16 }}>
                    {nomeCliente(prenotazione.customer_id)}
                  </strong>

                  <span
                    style={{
                      padding: "5px 9px",
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: 700,
                      background:
                        prenotazione.status === "confirmed"
                          ? "#e8f3e8"
                          : prenotazione.status === "cancelled"
                          ? "#f8e7e5"
                          : "#fff1d8",
                      color:
                        prenotazione.status === "confirmed"
                          ? "#286238"
                          : prenotazione.status === "cancelled"
                          ? "#9a3430"
                          : "#87601e",
                    }}
                  >
                    {statoItaliano(prenotazione.status)}
                  </span>
                </div>

                <p style={detailStyle}>
                  🎾 {nomeCampo(prenotazione.court_id)}
                </p>
                <p style={detailStyle}>
                  📅 {formattaData(prenotazione.starts_at)}
                  {" · "}
                  {formattaOra(prenotazione.starts_at)}
                  {" – "}
                  {formattaOra(prenotazione.ends_at)}
                </p>
                <p style={detailStyle}>
                  💶 {Number(prenotazione.price).toFixed(2)} €
                </p>

                {prenotazione.notes && (
                  <p style={detailStyle}>
                    Note: {prenotazione.notes}
                  </p>
                )}

                {isMaestro &&
                  prenotazione.status === "confirmed" && (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 8,
                        marginTop: 12,
                      }}
                    >
                      <button
                        onClick={() =>
                          cambiaStato(prenotazione.id, "completed")
                        }
                        style={completeButtonStyle}
                      >
                        Segna completata
                      </button>
                      <button
                        onClick={() =>
                          cambiaStato(prenotazione.id, "cancelled")
                        }
                        style={cancelButtonStyle}
                      >
                        Annulla
                      </button>
                    </div>
                  )}
              </article>
            ))}
        </section>

        <footer
          style={{
            textAlign: "center",
            padding: "25px 10px",
            color: "#a18e7d",
            fontSize: 10,
            letterSpacing: 1,
          }}
        >
          HAPPY TENNIS RESORT MANAGER · {resortNome}
        </footer>
      </div>
    </main>
  );
}

const panelStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid #eadfce",
  borderRadius: 14,
  padding: 20,
  marginBottom: 22,
  boxShadow: "0 4px 14px #4b241008",
};

const statStyle: React.CSSProperties = {
  display: "grid",
  gap: 5,
  padding: 17,
  background: "white",
  border: "1px solid #eadfce",
  borderRadius: 12,
};

const statNumberStyle: React.CSSProperties = {
  color: "#742326",
  fontSize: 27,
};

const statLabelStyle: React.CSSProperties = {
  color: "#85776b",
  fontSize: 12,
};

const headingStyle: React.CSSProperties = {
  color: "#742326",
  font: "bold 22px Georgia, serif",
  margin: "0 0 12px",
};

const hintStyle: React.CSSProperties = {
  color: "#85776b",
  fontSize: 13,
  lineHeight: 1.6,
};

const detailStyle: React.CSSProperties = {
  color: "#766b61",
  fontSize: 13,
  margin: "9px 0 0",
};

const errorStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 8,
  color: "#922e2e",
  background: "#fbe9e7",
  fontSize: 13,
};

const successStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 8,
  color: "#286238",
  background: "#e8f3e8",
  fontSize: 13,
};

const primaryButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: 15,
  marginTop: 20,
  border: 0,
  borderRadius: 9,
  color: "white",
  background: "#81292c",
  fontSize: 15,
  fontWeight: 700,
  cursor: "pointer",
};

const refreshButtonStyle: React.CSSProperties = {
  padding: "9px 13px",
  border: "1px solid #dfd1c1",
  borderRadius: 8,
  color: "#742326",
  background: "white",
  fontWeight: 700,
  cursor: "pointer",
};

const completeButtonStyle: React.CSSProperties = {
  padding: "9px 12px",
  border: 0,
  borderRadius: 7,
  color: "white",
  background: "#397348",
  fontSize: 12,
  cursor: "pointer",
};

const cancelButtonStyle: React.CSSProperties = {
  padding: "9px 12px",
  border: 0,
  borderRadius: 7,
  color: "white",
  background: "#9a3430",
  fontSize: 12,
  cursor: "pointer",
};

export default function PrenotazioniPage() {
  return (
    <Suspense fallback={<p>Caricamento prenotazioni...</p>}>
      <PrenotazioniContent />
    </Suspense>
  );
}
