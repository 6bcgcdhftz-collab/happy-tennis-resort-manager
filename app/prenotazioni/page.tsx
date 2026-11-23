
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

function PrenotazioniContent() {
  const searchParams = useSearchParams();
  const resortRichiesto = searchParams.get("resort");

  const [resortId, setResortId] = useState("");
  const [resortNome, setResortNome] = useState("");
  const [isMaestro, setIsMaestro] = useState(false);

  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [campi, setCampi] = useState<Campo[]>([]);
  const [prenotazioni, setPrenotazioni] = useState<Prenotazione[]>([]);

  const [modalitaCliente, setModalitaCliente] = useState<"esistente" | "nuovo">("esistente");
  const [clienteId, setClienteId] = useState("");
  const [nuovoNome, setNuovoNome] = useState("");
  const [nuovoCognome, setNuovoCognome] = useState("");
  const [nuovoTelefono, setNuovoTelefono] = useState("");
  const [nuovaEmail, setNuovaEmail] = useState("");

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
        ? memberships.find((item) => item.resort_id === resortRichiesto)
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
            .select("id, name, sport")
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

    if (!resortId || !campoId || !data) {
      setErrore("Seleziona un campo e inserisci la data.");
      return;
    }

    if (modalitaCliente === "esistente" && !clienteId) {
      setErrore("Seleziona un cliente dall'elenco.");
      return;
    }

    if (
      modalitaCliente === "nuovo" &&
      (!nuovoNome.trim() || !nuovoCognome.trim())
    ) {
      setErrore("Inserisci nome e cognome del nuovo cliente.");
      return;
    }

    if (!oraInizio || !oraFine || oraFine <= oraInizio) {
      setErrore("L'ora di fine deve essere successiva all'ora di inizio.");
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
      setErrore("Controlla la data e gli orari.");
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

      let customerId = clienteId;

      if (modalitaCliente === "nuovo") {
        const { data: nuovoCliente, error: erroreCliente } =
          await supabase
            .from("resort_customers")
            .insert({
              resort_id: resortId,
              first_name: nuovoNome.trim(),
              last_name: nuovoCognome.trim(),
              phone: nuovoTelefono.trim() || null,
              email: nuovaEmail.trim() || null,
            })
            .select("id")
            .single();

        if (erroreCliente || !nuovoCliente) {
          setErrore(
            "Errore nel salvataggio del cliente: " +
              (erroreCliente?.message || "risposta non valida")
          );
          return;
        }

        customerId = nuovoCliente.id;
      }

      const { error } = await supabase
        .from("court_bookings")
        .insert({
          resort_id: resortId,
          customer_id: customerId,
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
            "Il campo è già occupato in questa fascia oraria. Scegli un altro orario o campo."
          );
        } else {
          setErrore("Errore di prenotazione: " + error.message);
        }
        return;
      }

      setMessaggio("Prenotazione registrata correttamente!");
      setClienteId("");
      setNuovoNome("");
      setNuovoCognome("");
      setNuovoTelefono("");
      setNuovaEmail("");
      setModalitaCliente("esistente");
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
    id: string,
    nuovoStato: "cancelled" | "completed"
  ) {
    if (!isMaestro || !resortId) return;

    const domanda =
      nuovoStato === "cancelled"
        ? "Vuoi annullare questa prenotazione?"
        : "Vuoi segnare questa prenotazione come completata?";

    if (!window.confirm(domanda)) return;

    setErrore("");
    setMessaggio("");

    const supabase = getSupabase();

    const { error } = await supabase
      .from("court_bookings")
      .update({ status: nuovoStato })
      .eq("id", id)
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
    return campi.find((item) => item.id === id)?.name ||
      "Campo non disponibile";
  }

  function dataItaliana(valore: string) {
    return new Date(valore).toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function oraItaliana(valore: string) {
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
    <main className="booking-page">
      <div className="booking-container">
        <header className="booking-header">
          <div className="booking-ball">🎾</div>
          <div className="booking-eyebrow">
            HAPPY TENNIS RESORT MANAGER
          </div>
          <h1>Prenotazioni campi</h1>
          <p>Gestione prenotazioni · {resortNome}</p>
        </header>

        <section className="booking-stats">
          <div className="booking-stat">
            <strong>{prenotazioni.length}</strong>
            <span>Prenotazioni totali</span>
          </div>
          <div className="booking-stat">
            <strong>{attive.length}</strong>
            <span>Confermate</span>
          </div>
          <div className="booking-stat">
            <strong>{campi.length}</strong>
            <span>Campi attivi</span>
          </div>
        </section>

        {isMaestro && (
          <section className="booking-panel">
            <h2>＋ Nuova prenotazione</h2>

            <label className="booking-label">Cliente</label>

            <div className="booking-mode-switch">
              <button
                type="button"
                className={
                  modalitaCliente === "esistente"
                    ? "booking-mode active"
                    : "booking-mode"
                }
                onClick={() => {
                  setModalitaCliente("esistente");
                  setErrore("");
                }}
              >
                Scegli esistente
              </button>
              <button
                type="button"
                className={
                  modalitaCliente === "nuovo"
                    ? "booking-mode active"
                    : "booking-mode"
                }
                onClick={() => {
                  setModalitaCliente("nuovo");
                  setClienteId("");
                  setErrore("");
                }}
              >
                ＋ Nuovo cliente
              </button>
            </div>

            {modalitaCliente === "esistente" ? (
              <>
                <select
                  className="booking-input"
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
                  <p className="booking-hint">
                    Non ci sono clienti registrati. Puoi inserirne uno nuovo.
                  </p>
                )}
              </>
            ) : (
              <div className="booking-new-customer">
                <label className="booking-label">Nome *</label>
                <input
                  className="booking-input"
                  value={nuovoNome}
                  onChange={(e) => setNuovoNome(e.target.value)}
                  placeholder="Nome"
                />

                <label className="booking-label">Cognome *</label>
                <input
                  className="booking-input"
                  value={nuovoCognome}
                  onChange={(e) => setNuovoCognome(e.target.value)}
                  placeholder="Cognome"
                />

                <label className="booking-label">Telefono</label>
                <input
                  className="booking-input"
                  type="tel"
                  value={nuovoTelefono}
                  onChange={(e) => setNuovoTelefono(e.target.value)}
                  placeholder="Numero di telefono"
                />

                <label className="booking-label">Email</label>
                <input
                  className="booking-input"
                  type="email"
                  value={nuovaEmail}
                  onChange={(e) => setNuovaEmail(e.target.value)}
                  placeholder="Indirizzo email"
                />

                <p className="booking-hint">
                  Il nuovo cliente verrà salvato nell'anagrafica del resort.
                </p>
              </div>
            )}

            <label className="booking-label">Campo sportivo</label>
            <select
              className="booking-input"
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

            <label className="booking-label">Data</label>
            <input
              className="booking-input"
              type="date"
              value={data}
              min={dataOggi}
              onChange={(e) => setData(e.target.value)}
            />

            <label className="booking-label">Ora inizio</label>
            <input
              className="booking-input"
              type="time"
              value={oraInizio}
              onChange={(e) => setOraInizio(e.target.value)}
            />

            <label className="booking-label">Ora fine</label>
            <input
              className="booking-input"
              type="time"
              value={oraFine}
              onChange={(e) => setOraFine(e.target.value)}
            />

            <label className="booking-label">Prezzo (€)</label>
            <input
              className="booking-input"
              type="number"
              min="0"
              step="0.01"
              value={prezzo}
              onChange={(e) => setPrezzo(e.target.value)}
            />

            <label className="booking-label">Note</label>
            <textarea
              className="booking-input booking-notes"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Eventuali informazioni aggiuntive..."
            />

            {errore && <p className="booking-error">{errore}</p>}
            {messaggio && (
              <p className="booking-success">{messaggio}</p>
            )}

            <button
              className="booking-submit"
              onClick={salvaPrenotazione}
              disabled={salvando || campi.length === 0}
            >
              {salvando
                ? "Registrazione in corso..."
                : "Registra prenotazione"}
            </button>
          </section>
        )}

        {!isMaestro && (
          <p className="booking-hint">
            Puoi consultare le prenotazioni. La registrazione e la modifica
            sono riservate al maestro responsabile.
          </p>
        )}

        <section className="booking-panel">
          <div className="booking-list-heading">
            <h2>Elenco prenotazioni</h2>
            <button
              className="booking-refresh"
              onClick={caricaDati}
            >
              ↻ Aggiorna
            </button>
          </div>

          {loading && <p>Caricamento prenotazioni...</p>}

          {!loading && prenotazioni.length === 0 && (
            <p className="booking-hint">
              Non sono ancora presenti prenotazioni per questo resort.
            </p>
          )}

          {!loading &&
            prenotazioni.map((prenotazione) => (
              <article className="booking-card" key={prenotazione.id}>
                <div className="booking-card-heading">
                  <strong>{nomeCliente(prenotazione.customer_id)}</strong>
                  <span
                    className={`booking-status ${prenotazione.status}`}
                  >
                    {statoItaliano(prenotazione.status)}
                  </span>
                </div>

                <p>🎾 {nomeCampo(prenotazione.court_id)}</p>
                <p>
                  📅 {dataItaliana(prenotazione.starts_at)}
                </p>
                <p>
                  🕒 {oraItaliana(prenotazione.starts_at)} –{" "}
                  {oraItaliana(prenotazione.ends_at)}
                </p>
                <p>
                  💶 {Number(prenotazione.price).toFixed(2)} €
                </p>

                {prenotazione.notes && (
                  <p>Note: {prenotazione.notes}</p>
                )}

                {isMaestro &&
                  prenotazione.status === "confirmed" && (
                    <div className="booking-actions">
                      <button
                        className="booking-complete"
                        onClick={() =>
                          cambiaStato(prenotazione.id, "completed")
                        }
                      >
                        Segna completata
                      </button>
                      <button
                        className="booking-cancel"
                        onClick={() =>
                          cambiaStato(prenotazione.id, "cancelled")
                        }
                      >
                        Annulla
                      </button>
                    </div>
                  )}
              </article>
            ))}
        </section>

        <footer className="booking-footer">
          HAPPY TENNIS RESORT MANAGER · {resortNome}
        </footer>
      </div>

      <style jsx>{`
        .booking-page {
          min-height: 100vh;
          padding: 20px 14px;
          background: #faf7f2;
          color: #302b29;
          overflow-x: hidden;
        }

        .booking-container {
          width: 100%;
          max-width: 760px;
          margin: 0 auto;
        }

        .booking-header {
          padding: 25px 20px;
          border-radius: 15px;
          color: white;
          background: linear-gradient(120deg, #741d20, #451316);
          margin-bottom: 20px;
        }

        .booking-ball {
          font-size: 30px;
        }

        .booking-eyebrow {
          color: #e8c88c;
          font-size: 10px;
          letter-spacing: 2px;
          margin-top: 8px;
        }

        .booking-header h1 {
          font: bold 30px Georgia, serif;
          margin: 10px 0;
        }

        .booking-header p {
          margin: 0;
          color: #f1ded5;
          font-size: 13px;
        }

        .booking-stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 9px;
          margin-bottom: 20px;
        }

        .booking-stat {
          min-width: 0;
          display: grid;
          gap: 5px;
          padding: 13px 10px;
          background: white;
          border: 1px solid #eadfce;
          border-radius: 11px;
        }

        .booking-stat strong {
          color: #742326;
          font-size: 25px;
        }

        .booking-stat span {
          color: #85776b;
          font-size: 11px;
        }

        .booking-panel {
          width: 100%;
          min-width: 0;
          padding: 20px 16px;
          margin-bottom: 20px;
          background: white;
          border: 1px solid #eadfce;
          border-radius: 14px;
          box-shadow: 0 4px 14px #4b241008;
        }

        .booking-panel h2 {
          color: #742326;
          font: bold 24px Georgia, serif;
          margin: 0 0 16px;
        }

        .booking-label {
          display: block;
          margin: 16px 0 7px;
          color: #604c42;
          font-size: 13px;
          font-weight: 700;
        }

        .booking-input {
          display: block;
          width: 100%;
          max-width: 100%;
          min-width: 0;
          box-sizing: border-box;
          min-height: 49px;
          padding: 12px;
          border: 1px solid #dfd1c1;
          border-radius: 9px;
          background: white;
          color: #302b29;
          font-size: 16px;
          appearance: auto;
        }

        .booking-input:focus {
          outline: 2px solid #cba76f;
          outline-offset: 1px;
        }

        .booking-mode-switch {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          width: 100%;
        }

        .booking-mode {
          min-width: 0;
          min-height: 46px;
          padding: 9px 5px;
          border: 1px solid #dfd1c1;
          border-radius: 9px;
          color: #742326;
          background: white;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        .booking-mode.active {
          color: white;
          border-color: #81292c;
          background: #81292c;
        }

        .booking-new-customer {
          padding: 12px;
          margin-top: 10px;
          border: 1px solid #eadfce;
          border-radius: 10px;
          background: #fffdf9;
        }

        .booking-new-customer .booking-label:first-child {
          margin-top: 0;
        }

        .booking-notes {
          min-height: 100px;
          resize: vertical;
          font-family: inherit;
        }

        .booking-hint {
          color: #85776b;
          font-size: 13px;
          line-height: 1.6;
        }

        .booking-error,
        .booking-success {
          padding: 12px;
          border-radius: 8px;
          font-size: 13px;
          line-height: 1.5;
        }

        .booking-error {
          color: #922e2e;
          background: #fbe9e7;
        }

        .booking-success {
          color: #286238;
          background: #e8f3e8;
        }

        .booking-submit {
          width: 100%;
          min-height: 54px;
          padding: 14px;
          margin-top: 20px;
          border: 0;
          border-radius: 9px;
          color: white;
          background: #81292c;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
        }

        .booking-submit:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .booking-list-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 10px;
        }

        .booking-refresh {
          padding: 9px 12px;
          border: 1px solid #dfd1c1;
          border-radius: 8px;
          color: #742326;
          background: white;
          font-weight: 700;
        }

        .booking-card {
          min-width: 0;
          padding: 15px;
          margin-top: 13px;
          border: 1px solid #eadfce;
          border-radius: 11px;
          background: #fffdf9;
          overflow-wrap: anywhere;
        }

        .booking-card-heading {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          flex-wrap: wrap;
          gap: 8px;
        }

        .booking-card-heading strong {
          color: #742326;
          font-size: 15px;
        }

        .booking-card p {
          color: #766b61;
          font-size: 13px;
          margin: 9px 0 0;
        }

        .booking-status {
          padding: 5px 9px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 700;
        }

        .booking-status.confirmed {
          color: #286238;
          background: #e8f3e8;
        }

        .booking-status.cancelled {
          color: #9a3430;
          background: #f8e7e5;
        }

        .booking-status.completed {
          color: #87601e;
          background: #fff1d8;
        }

        .booking-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 13px;
        }

        .booking-actions button {
          min-height: 39px;
          padding: 9px 12px;
          border: 0;
          border-radius: 7px;
          color: white;
          font-size: 12px;
          cursor: pointer;
        }

        .booking-complete {
          background: #397348;
        }

        .booking-cancel {
          background: #9a3430;
        }

        .booking-footer {
          padding: 20px 10px;
          color: #a18e7d;
          font-size: 9px;
          letter-spacing: 1px;
          text-align: center;
        }

        @media (max-width: 380px) {
          .booking-page {
            padding: 12px 9px;
          }

          .booking-panel {
            padding: 16px 12px;
          }

          .booking-stats {
            gap: 6px;
          }

          .booking-stat {
            padding: 11px 7px;
          }

          .booking-stat strong {
            font-size: 22px;
          }

          .booking-stat span {
            font-size: 10px;
          }

          .booking-header h1 {
            font-size: 26px;
          }
        }
      `}</style>
    </main>
  );
}

export default function PrenotazioniPage() {
  return (
    <Suspense fallback={<p>Caricamento prenotazioni...</p>}>
      <PrenotazioniContent />
    </Suspense>
  );
}
