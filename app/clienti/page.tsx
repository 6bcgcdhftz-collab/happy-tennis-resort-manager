
"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
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

type Spostamento = {
  id: string;
  booking_id: string;
  customer_id: string;
  old_court_id: string;
  new_court_id: string;
  old_starts_at: string;
  old_ends_at: string;
  new_starts_at: string;
  new_ends_at: string;
  moved_at: string;
};

function ClientiContent() {
  const searchParams = useSearchParams();
  const resortRichiesto = searchParams.get("resort");

  const [resortId, setResortId] = useState("");
  const [resortNome, setResortNome] = useState("");
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [campi, setCampi] = useState<Campo[]>([]);
  const [prenotazioni, setPrenotazioni] = useState<Prenotazione[]>([]);
  const [spostamenti, setSpostamenti] = useState<Spostamento[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [ricerca, setRicerca] = useState("");
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState("");
  const [erroreStorico, setErroreStorico] = useState("");

  const [puoCreareCliente, setPuoCreareCliente] = useState(false);
  const [puoModificareCliente, setPuoModificareCliente] = useState(false);

  const [mostraNuovoCliente, setMostraNuovoCliente] = useState(false);
  const [nuovoNome, setNuovoNome] = useState("");
  const [nuovoCognome, setNuovoCognome] = useState("");
  const [nuovoTelefono, setNuovoTelefono] = useState("");
  const [nuovaEmail, setNuovaEmail] = useState("");
  const [nuoveNote, setNuoveNote] = useState("");

  const [mostraModificaCliente, setMostraModificaCliente] = useState(false);
  const [modificaNome, setModificaNome] = useState("");
  const [modificaCognome, setModificaCognome] = useState("");
  const [modificaTelefono, setModificaTelefono] = useState("");
  const [modificaEmail, setModificaEmail] = useState("");

  const [salvataggioCliente, setSalvataggioCliente] = useState(false);
  const [erroreCliente, setErroreCliente] = useState("");
  const [messaggioCliente, setMessaggioCliente] = useState("");

  useEffect(() => {
    let attivo = true;

    async function caricaDati() {
      setLoading(true);
      setErrore("");
      setErroreStorico("");

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
            .select("resort_id, resorts(name)")
            .eq("user_id", user.id)
            .eq("is_active", true);

        if (membershipError || !memberships?.length) {
          throw new Error(
            membershipError?.message ||
              "Non risultano resort associati a questo account."
          );
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
          throw new Error("Non hai accesso al resort selezionato.");
        }

        const joined = membership.resorts as unknown as
          | { name: string }
          | { name: string }[]
          | null;
        const resort = Array.isArray(joined) ? joined[0] : joined;

        const [permessoCreazione, permessoModifica] = await Promise.all([
          supabase.rpc("can_manage_resort_customers", {
            p_resort_id: membership.resort_id,
            p_permission: "create",
          }),
          supabase.rpc("can_manage_resort_customers", {
            p_resort_id: membership.resort_id,
            p_permission: "edit",
          }),
        ]);

        if (!attivo) return;

        setPuoCreareCliente(permessoCreazione.data === true);
        setPuoModificareCliente(permessoModifica.data === true);

        const [clientiResult, campiResult, prenotazioniResult, storicoResult] =
          await Promise.all([
            supabase
              .from("resort_customers")
              .select("id, first_name, last_name, phone, email")
              .eq("resort_id", membership.resort_id)
              .order("last_name")
              .order("first_name"),

            supabase
              .from("sport_courts")
              .select("id, name, sport")
              .eq("resort_id", membership.resort_id)
              .order("name"),

            supabase
              .from("court_bookings")
              .select(
                "id, customer_id, court_id, starts_at, ends_at, price, status, notes"
              )
              .eq("resort_id", membership.resort_id)
              .order("starts_at", { ascending: false }),

            supabase
              .from("court_booking_history")
              .select(
                "id, booking_id, customer_id, old_court_id, new_court_id, old_starts_at, old_ends_at, new_starts_at, new_ends_at, moved_at"
              )
              .eq("resort_id", membership.resort_id)
              .order("moved_at", { ascending: false })
              .limit(500),
          ]);

        if (!attivo) return;

        if (clientiResult.error) throw new Error(clientiResult.error.message);
        if (campiResult.error) throw new Error(campiResult.error.message);
        if (prenotazioniResult.error)
          throw new Error(prenotazioniResult.error.message);

        setResortId(membership.resort_id);
        setResortNome(resort?.name ?? "Resort");
        setClienti(clientiResult.data ?? []);
        setCampi(campiResult.data ?? []);
        setPrenotazioni(prenotazioniResult.data ?? []);

        if (storicoResult.error) {
          setErroreStorico(
            "Storico non disponibile: " + storicoResult.error.message
          );
          setSpostamenti([]);
        } else {
          setSpostamenti(storicoResult.data ?? []);
        }

        setClienteId((corrente) => {
          if (
            corrente &&
            (clientiResult.data ?? []).some((item) => item.id === corrente)
          ) {
            return corrente;
          }
          return clientiResult.data?.[0]?.id ?? "";
        });
      } catch (err) {
        if (attivo) {
          setErrore(
            err instanceof Error ? err.message : "Errore durante il caricamento."
          );
        }
      } finally {
        if (attivo) setLoading(false);
      }
    }

    caricaDati();

    return () => {
      attivo = false;
    };
  }, [resortRichiesto]);

  async function salvaNuovoCliente(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!nuovoNome.trim() || !nuovoCognome.trim()) {
      setErroreCliente("Inserisci nome e cognome del cliente.");
      return;
    }

    if (!resortId) {
      setErroreCliente("Resort non identificato. Ricarica la pagina.");
      return;
    }

    setSalvataggioCliente(true);
    setErroreCliente("");
    setMessaggioCliente("");

    try {
      const supabase = getSupabase();

      const { data, error } = await supabase
        .from("resort_customers")
        .insert({
          resort_id: resortId,
          first_name: nuovoNome.trim(),
          last_name: nuovoCognome.trim(),
          phone: nuovoTelefono.trim() || null,
          email: nuovaEmail.trim() || null,
          notes: nuoveNote.trim() || null,
        })
        .select("id, first_name, last_name, phone, email")
        .single();

      if (error) throw new Error(error.message);

      setClienti((precedenti) =>
        [...precedenti, data].sort((a, b) => {
          const cognome = a.last_name.localeCompare(b.last_name);
          return cognome !== 0
            ? cognome
            : a.first_name.localeCompare(b.first_name);
        })
      );

      setClienteId(data.id);
      setRicerca("");
      setNuovoNome("");
      setNuovoCognome("");
      setNuovoTelefono("");
      setNuovaEmail("");
      setNuoveNote("");
      setMostraNuovoCliente(false);
      setMessaggioCliente("Cliente registrato correttamente.");
    } catch (err) {
      setErroreCliente(
        err instanceof Error
          ? err.message
          : "Errore durante il salvataggio del cliente."
      );
    } finally {
      setSalvataggioCliente(false);
    }
  }

  function apriModificaCliente() {
    if (!cliente) return;

    setModificaNome(cliente.first_name);
    setModificaCognome(cliente.last_name);
    setModificaTelefono(cliente.phone ?? "");
    setModificaEmail(cliente.email ?? "");
    setErroreCliente("");
    setMessaggioCliente("");
    setMostraNuovoCliente(false);
    setMostraModificaCliente(true);
  }

  async function salvaModificheCliente(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!cliente) return;

    if (!modificaNome.trim() || !modificaCognome.trim()) {
      setErroreCliente("Nome e cognome sono obbligatori.");
      return;
    }

    setSalvataggioCliente(true);
    setErroreCliente("");
    setMessaggioCliente("");

    try {
      const supabase = getSupabase();

      const { data, error } = await supabase
        .from("resort_customers")
        .update({
          first_name: modificaNome.trim(),
          last_name: modificaCognome.trim(),
          phone: modificaTelefono.trim() || null,
          email: modificaEmail.trim() || null,
        })
        .eq("id", cliente.id)
        .eq("resort_id", resortId)
        .select("id, first_name, last_name, phone, email")
        .single();

      if (error) throw new Error(error.message);

      setClienti((precedenti) =>
        precedenti
          .map((item) => (item.id === data.id ? data : item))
          .sort((a, b) => {
            const cognome = a.last_name.localeCompare(b.last_name);
            return cognome !== 0
              ? cognome
              : a.first_name.localeCompare(b.first_name);
          })
      );

      setMostraModificaCliente(false);
      setMessaggioCliente("Dati del cliente aggiornati correttamente.");
    } catch (err) {
      setErroreCliente(
        err instanceof Error
          ? err.message
          : "Errore durante la modifica del cliente."
      );
    } finally {
      setSalvataggioCliente(false);
    }
  }

  const clientiFiltrati = useMemo(() => {
    const termine = ricerca.trim().toLowerCase();
    if (!termine) return clienti;

    return clienti.filter((cliente) =>
      [
        cliente.first_name,
        cliente.last_name,
        cliente.phone ?? "",
        cliente.email ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(termine)
    );
  }, [clienti, ricerca]);

  const cliente = clienti.find((item) => item.id === clienteId);

  const prenotazioniCliente = prenotazioni.filter(
    (item) => item.customer_id === clienteId
  );

  const spostamentiCliente = spostamenti.filter(
    (item) => item.customer_id === clienteId
  );

  function nomeCampo(id: string) {
    return campi.find((item) => item.id === id)?.name ??
      "Campo non disponibile";
  }

  function dataOra(valore: string) {
    return new Date(valore).toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function ora(valore: string) {
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

  const totaleSpeso = prenotazioniCliente
    .filter((item) => item.status === "completed")
    .reduce((somma, item) => somma + Number(item.price || 0), 0);

  const pannello = {
    background: "#ffffff",
    border: "1px solid #e9e9e9",
    borderRadius: 13,
    padding: 18,
    boxShadow: "0 3px 14px rgba(0,0,0,0.035)",
  } as const;

  const etichetta = {
    color: "#777777",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.7,
    textTransform: "uppercase" as const,
  };

  return (
    <main className="clienti-page">
      <div className="clienti-container">
        <header className="clienti-header">
          <div className="clienti-eyebrow">
            HAPPY TENNIS RESORT MANAGER
          </div>
          <h1>Clienti</h1>
          <p>Anagrafica, prenotazioni e storico clienti · {resortNome}</p>
          <button
            className="clienti-back"
            onClick={() => {
              window.location.href = resortId
                ? `/dashboard?resort=${encodeURIComponent(resortId)}`
                : "/dashboard";
            }}
          >
            ← Torna alla dashboard
          </button>
        </header>

        {errore && <div className="clienti-error">{errore}</div>}

        {messaggioCliente && (
          <div className="clienti-success">{messaggioCliente}</div>
        )}

        {loading && <div style={pannello}>Caricamento clienti...</div>}

        {!loading && !errore && (
          <>
            <section className="clienti-stats">
              <div style={pannello}>
                <span style={etichetta}>Clienti registrati</span>
                <strong>{clienti.length}</strong>
              </div>
              <div style={pannello}>
                <span style={etichetta}>Prenotazioni totali</span>
                <strong>{prenotazioni.length}</strong>
              </div>
              <div style={pannello}>
                <span style={etichetta}>Spostamenti registrati</span>
                <strong>{spostamentiCount(spostamenti)}</strong>
              </div>
            </section>

            <div className="clienti-layout">
              <aside style={pannello}>
                <h2>Elenco clienti</h2>

                {puoCreareCliente && (
                  <button
                    className="clienti-nuovo"
                    onClick={() => {
                      setMostraNuovoCliente(!mostraNuovoCliente);
                      setMostraModificaCliente(false);
                      setErroreCliente("");
                      setMessaggioCliente("");
                    }}
                  >
                    {mostraNuovoCliente ? "Chiudi" : "+ Nuovo cliente"}
                  </button>
                )}

                {mostraNuovoCliente && (
                  <form
                    className="cliente-form"
                    onSubmit={salvaNuovoCliente}
                  >
                    <h3>Registra nuovo cliente</h3>

                    <label>Nome *</label>
                    <input
                      className="clienti-input"
                      value={nuovoNome}
                      onChange={(event) => setNuovoNome(event.target.value)}
                      placeholder="Nome"
                      required
                    />

                    <label>Cognome *</label>
                    <input
                      className="clienti-input"
                      value={nuovoCognome}
                      onChange={(event) => setNuovoCognome(event.target.value)}
                      placeholder="Cognome"
                      required
                    />

                    <label>Telefono</label>
                    <input
                      className="clienti-input"
                      type="tel"
                      value={nuovoTelefono}
                      onChange={(event) => setNuovoTelefono(event.target.value)}
                      placeholder="Numero di telefono"
                    />

                    <label>Email</label>
                    <input
                      className="clienti-input"
                      type="email"
                      value={nuovaEmail}
                      onChange={(event) => setNuovaEmail(event.target.value)}
                      placeholder="Indirizzo email"
                    />

                    <label>Note</label>
                    <textarea
                      className="clienti-input"
                      value={nuoveNote}
                      onChange={(event) => setNuoveNote(event.target.value)}
                      placeholder="Note sul cliente"
                      rows={3}
                    />

                    {erroreCliente && (
                      <div className="clienti-error">{erroreCliente}</div>
                    )}

                    <button
                      className="clienti-salva"
                      type="submit"
                      disabled={salvataggioCliente}
                    >
                      {salvataggioCliente
                        ? "Salvataggio..."
                        : "Salva cliente"}
                    </button>
                  </form>
                )}

                <input
                  className="clienti-input"
                  value={ricerca}
                  onChange={(event) => setRicerca(event.target.value)}
                  placeholder="Cerca nome, telefono, email..."
                />

                <div className="clienti-lista">
                  {clientiFiltrati.map((item) => (
                    <button
                      key={item.id}
                      className={
                        item.id === clienteId
                          ? "cliente-item selezionato"
                          : "cliente-item"
                      }
                      onClick={() => {
                        setClienteId(item.id);
                        setMostraModificaCliente(false);
                        setErroreCliente("");
                        setMessaggioCliente("");
                      }}
                    >
                      <strong>
                        {item.first_name} {item.last_name}
                      </strong>
                      <span>
                        {item.phone || item.email || "Nessun contatto"}
                      </span>
                    </button>
                  ))}

                  {clientiFiltrati.length === 0 && (
                    <p>Nessun cliente trovato.</p>
                  )}
                </div>
              </aside>

              <div className="clienti-dettaglio">
                {!cliente && (
                  <section style={pannello}>
                    Seleziona un cliente dall'elenco.
                  </section>
                )}

                {cliente && (
                  <>
                    <section style={pannello}>
                      <div style={etichetta}>Scheda cliente</div>
                      <h2>
                        {cliente.first_name} {cliente.last_name}
                      </h2>

                      {puoModificareCliente && !mostraModificaCliente && (
                        <button
                          className="clienti-modifica"
                          onClick={apriModificaCliente}
                        >
                          Modifica cliente
                        </button>
                      )}

                      {mostraModificaCliente && (
                        <form
                          className="cliente-form"
                          onSubmit={salvaModificheCliente}
                        >
                          <h3>Modifica dati cliente</h3>

                          <label>Nome *</label>
                          <input
                            className="clienti-input"
                            value={modificaNome}
                            onChange={(event) =>
                              setModificaNome(event.target.value)
                            }
                            required
                          />

                          <label>Cognome *</label>
                          <input
                            className="clienti-input"
                            value={modificaCognome}
                            onChange={(event) =>
                              setModificaCognome(event.target.value)
                            }
                            required
                          />

                          <label>Telefono</label>
                          <input
                            className="clienti-input"
                            type="tel"
                            value={modificaTelefono}
                            onChange={(event) =>
                              setModificaTelefono(event.target.value)
                            }
                          />

                          <label>Email</label>
                          <input
                            className="clienti-input"
                            type="email"
                            value={modificaEmail}
                            onChange={(event) =>
                              setModificaEmail(event.target.value)
                            }
                          />

                          {erroreCliente && (
                            <div className="clienti-error">
                              {erroreCliente}
                            </div>
                          )}

                          <button
                            className="clienti-salva"
                            type="submit"
                            disabled={salvataggioCliente}
                          >
                            {salvataggioCliente
                              ? "Salvataggio..."
                              : "Salva modifiche"}
                          </button>

                          <button
                            className="clienti-annulla"
                            type="button"
                            disabled={salvataggioCliente}
                            onClick={() => {
                              setMostraModificaCliente(false);
                              setErroreCliente("");
                            }}
                          >
                            Annulla
                          </button>
                        </form>
                      )}

                      {!mostraModificaCliente && (
                        <div className="cliente-contatti">
                          <div>
                            <span style={etichetta}>Telefono</span>
                            <p>
                              {cliente.phone ? (
                                <a href={`tel:${cliente.phone}`}>
                                  {cliente.phone}
                                </a>
                              ) : "Non indicato"}
                            </p>
                          </div>
                          <div>
                            <span style={etichetta}>Email</span>
                            <p>
                              {cliente.email ? (
                                <a href={`mailto:${cliente.email}`}>
                                  {cliente.email}
                                </a>
                              ) : "Non indicata"}
                            </p>
                          </div>
                        </div>
                      )}
                    </section>

                    <section className="clienti-stats">
                      <div style={pannello}>
                        <span style={etichetta}>Prenotazioni</span>
                        <strong>{prenotazioniCliente.length}</strong>
                      </div>
                      <div style={pannello}>
                        <span style={etichetta}>Spostamenti</span>
                        <strong>{spostamentiCount(spostamentiCliente)}</strong>
                      </div>
                      <div style={pannello}>
                        <span style={etichetta}>Totale completato</span>
                        <strong>€ {totaleSpeso.toFixed(2)}</strong>
                      </div>
                    </section>

                    <section style={pannello}>
                      <h2>Prenotazioni del cliente</h2>

                      {prenotazioniCliente.length === 0 ? (
                        <p>Nessuna prenotazione registrata.</p>
                      ) : (
                        <div className="clienti-records">
                          {prenotazioniCliente.map((item) => (
                            <article className="cliente-record" key={item.id}>
                              <div className="record-top">
                                <strong>{nomeCampo(item.court_id)}</strong>
                                <span className={`stato stato-${item.status}`}>
                                  {statoItaliano(item.status)}
                                </span>
                              </div>
                              <p>
                                {dataOra(item.starts_at)} – {ora(item.ends_at)}
                              </p>
                              <small>
                                Importo: € {Number(item.price).toFixed(2)}
                              </small>
                              {item.notes && <small>Note: {item.notes}</small>}
                            </article>
                          ))}
                        </div>
                      )}
                    </section>

                    <section style={pannello}>
                      <h2>Storico spostamenti</h2>

                      {erroreStorico && (
                        <p className="clienti-error">{erroreStorico}</p>
                      )}

                      {!erroreStorico &&
                        spostamentiCount(spostamentiCliente) === 0 && (
                          <p>
                            Nessuno spostamento registrato per questo cliente.
                          </p>
                        )}

                      {!erroreStorico &&
                        spostamentiCount(spostamentiCliente) > 0 && (
                          <div className="clienti-records">
                            {spostamentiCliente.map((item) => (
                              <article
                                className="cliente-record spostamento"
                                key={item.id}
                              >
                                <strong>Prenotazione spostata</strong>
                                <p>
                                  <b>Da:</b> {nomeCampo(item.old_court_id)} ·{" "}
                                  {dataOra(item.old_starts_at)} –{" "}
                                  {ora(item.old_ends_at)}
                                </p>
                                <p>
                                  <b>A:</b> {nomeCampo(item.new_court_id)} ·{" "}
                                  {dataOra(item.new_starts_at)} –{" "}
                                  {ora(item.new_ends_at)}
                                </p>
                                <small>
                                  Registrato il {dataOra(item.moved_at)}
                                </small>
                              </article>
                            ))}
                          </div>
                        )}
                    </section>
                  </>
                )}
              </div>
            </div>
          </>
        )}

        <footer className="clienti-footer">
          HAPPY TENNIS RESORT MANAGER · {resortNome}
        </footer>
      </div>

      <style jsx>{`
        .clienti-page {
          min-height: 100vh;
          padding: 28px 16px 45px;
          background: #f7f7f8;
          color: #252525;
          font-family: Arial, sans-serif;
        }
        .clienti-container {
          max-width: 1180px;
          margin: 0 auto;
        }
        .clienti-eyebrow {
          color: #762326;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 1.5px;
        }
        .clienti-header h1 {
          margin: 8px 0 5px;
          font-size: 32px;
        }
        .clienti-header p {
          color: #777;
          margin: 0 0 16px;
        }
        .clienti-back {
          background: #762326;
          color: white;
          border: 0;
          border-radius: 8px;
          padding: 11px 15px;
          font-weight: 700;
          cursor: pointer;
        }
        .clienti-stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin: 20px 0;
        }
        .clienti-stats strong {
          display: block;
          font-size: 27px;
          margin-top: 8px;
        }
        .clienti-layout {
          display: grid;
          grid-template-columns: minmax(230px, 0.8fr) minmax(0, 1.8fr);
          gap: 18px;
          align-items: start;
        }
        .clienti-layout h2 {
          font-size: 19px;
          margin: 0 0 14px;
        }
        .clienti-input {
          width: 100%;
          box-sizing: border-box;
          padding: 12px;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-size: 14px;
          font-family: inherit;
        }
        .cliente-form {
          display: grid;
          gap: 9px;
          margin: 14px 0;
          padding: 14px;
          border: 1px solid #eadada;
          border-radius: 10px;
          background: #fffafa;
        }
        .cliente-form h3 {
          margin: 0 0 5px;
          font-size: 16px;
        }
        .cliente-form label {
          font-size: 12px;
          font-weight: 700;
          color: #555;
        }
        .clienti-nuovo,
        .clienti-salva,
        .clienti-modifica,
        .clienti-annulla {
          width: 100%;
          border: 0;
          border-radius: 8px;
          padding: 12px;
          background: #762326;
          color: white;
          font-weight: 700;
          cursor: pointer;
          margin-bottom: 12px;
        }
        .clienti-salva {
          margin: 5px 0 0;
        }
        .clienti-modifica {
          max-width: 220px;
          margin: 0 0 16px;
        }
        .clienti-annulla {
          background: #777;
          margin: 0;
        }
        .clienti-salva:disabled,
        .clienti-annulla:disabled {
          opacity: 0.6;
          cursor: wait;
        }
        .clienti-success {
          background: #edf8f0;
          color: #176b3a;
          border-radius: 9px;
          padding: 13px;
          margin: 14px 0;
        }
        .clienti-lista,
        .clienti-records,
        .clienti-dettaglio {
          display: grid;
          gap: 10px;
        }
        .clienti-lista {
          margin-top: 14px;
        }
        .cliente-item {
          text-align: left;
          padding: 12px;
          border: 1px solid #eee;
          border-radius: 9px;
          background: white;
          cursor: pointer;
          color: #252525;
        }
        .cliente-item.selezionato {
          border-color: #762326;
          background: #fff5f5;
        }
        .cliente-item strong,
        .cliente-item span {
          display: block;
        }
        .cliente-item span {
          color: #777;
          font-size: 12px;
          margin-top: 4px;
        }
        .clienti-dettaglio {
          min-width: 0;
        }
        .clienti-dettaglio h2 {
          margin: 8px 0 16px;
        }
        .cliente-contatti {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }
        .cliente-contatti p {
          margin-bottom: 0;
        }
        .cliente-contatti a {
          color: #762326;
        }
        .cliente-record {
          border: 1px solid #eee;
          border-radius: 9px;
          padding: 13px;
        }
        .cliente-record p {
          margin: 7px 0;
          font-size: 13px;
          color: #666;
        }
        .cliente-record small {
          display: block;
          margin-top: 5px;
          color: #777;
        }
        .record-top {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
        }
        .stato {
          font-size: 12px;
          font-weight: 700;
        }
        .stato-confirmed {
          color: #176b3a;
        }
        .stato-cancelled {
          color: #a32020;
        }
        .stato-completed {
          color: #666;
        }
        .spostamento {
          border-left: 4px solid #762326;
        }
        .clienti-error {
          background: #fff0f0;
          color: #a32020;
          border-radius: 9px;
          padding: 13px;
          margin-bottom: 15px;
          font-size: 13px;
        }
        .clienti-footer {
          text-align: center;
          color: #999;
          font-size: 11px;
          margin-top: 28px;
          letter-spacing: 1px;
        }
        @media (max-width: 760px) {
          .clienti-layout {
            grid-template-columns: 1fr;
          }
          .clienti-stats {
            grid-template-columns: 1fr;
          }
          .cliente-contatti {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}

function spostamentiCount(items: Spostamento[]) {
  return items.length;
}

export default function ClientiPage() {
  return (
    <Suspense fallback={<p style={{ padding: 24 }}>Caricamento clienti...</p>}>
      <ClientiContent />
    </Suspense>
  );
}
