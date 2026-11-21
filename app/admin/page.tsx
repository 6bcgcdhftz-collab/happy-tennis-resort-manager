
"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";

type Resort = {
  resort_id: string;
  resort_name: string;
  resort_created_at: string;
  subscription_status: string | null;
  subscription_period_end: string | null;
  staff_count: number;
};

const ruoli = [
  { value: "maestro_responsabile", label: "Maestro responsabile" },
  { value: "maestri_collaboratori", label: "Maestri collaboratori" },
  { value: "reception_sportiva", label: "Reception sportiva" },
  { value: "direttore_sportivo", label: "Direttore sportivo" },
  { value: "amministrazione_resort", label: "Amministrazione resort" },
  { value: "manutenzione", label: "Manutenzione" },
];

const stati = [
  { value: "pending", label: "In attesa" },
  { value: "active", label: "Attivo" },
  { value: "past_due", label: "Pagamento in ritardo" },
  { value: "suspended", label: "Sospeso" },
  { value: "cancelled", label: "Annullato" },
];

const etichetteStato: Record<string, string> = {
  pending: "In attesa",
  active: "Attivo",
  past_due: "Pagamento in ritardo",
  suspended: "Sospeso",
  cancelled: "Annullato",
};

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  padding: "13px 14px",
  border: "1px solid #dfd1c1",
  borderRadius: 9,
  background: "#fff",
  color: "#302b29",
  fontSize: 15,
  marginTop: 7,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  color: "#604c42",
  fontSize: 13,
  fontWeight: 700,
  marginTop: 15,
};

const buttonStyle: React.CSSProperties = {
  padding: "13px 19px",
  border: "none",
  borderRadius: 9,
  background: "#762326",
  color: "white",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};

const panelStyle: React.CSSProperties = {
  background: "#fffdf9",
  border: "1px solid #eadfce",
  borderRadius: 15,
  padding: 22,
  marginTop: 22,
  boxShadow: "0 5px 18px rgba(75,36,16,.06)",
};

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [autorizzato, setAutorizzato] = useState(false);
  const [email, setEmail] = useState("");
  const [resort, setResort] = useState<Resort[]>([]);
  const [errore, setErrore] = useState("");
  const [messaggio, setMessaggio] = useState("");
  const [nuovoNome, setNuovoNome] = useState("");
  const [creazione, setCreazione] = useState(false);
  const [emailUtente, setEmailUtente] = useState("");
  const [ruolo, setRuolo] = useState("maestro_responsabile");
  const [resortSelezionato, setResortSelezionato] = useState("");
  const [associazione, setAssociazione] = useState(false);
  const [statiResort, setStatiResort] = useState<Record<string, string>>({});
  const [salvataggioStato, setSalvataggioStato] = useState("");

  const supabase = getSupabase();

  function tornaDashboard() {
    const resortSalvato = localStorage.getItem("happy-tennis-resort");

    window.location.href = resortSalvato
      ? `/dashboard?resort=${encodeURIComponent(resortSalvato)}`
      : "/dashboard";
  }

  async function caricaResort() {
    setErrore("");
    setMessaggio("");

    const { data, error } = await supabase.rpc(
      "platform_admin_list_resorts"
    );

    if (error) {
      setErrore("Impossibile caricare i resort: " + error.message);
      return;
    }

    const elenco = (data || []) as Resort[];
    setResort(elenco);

    const nuoviStati: Record<string, string> = {};

    elenco.forEach((r) => {
      nuoviStati[r.resort_id] = r.subscription_status || "pending";
    });

    setStatiResort(nuoviStati);

    if (elenco.length > 0 && !resortSelezionato) {
      setResortSelezionato(elenco[0].resort_id);
    }
  }

  useEffect(() => {
    async function verificaAccesso() {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          setErrore("Devi effettuare l'accesso per continuare.");
          setLoading(false);
          return;
        }

        setEmail(user.email || "");

        const { data: admin, error: adminError } = await supabase
          .from("platform_admins")
          .select("user_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (adminError) {
          setErrore(
            "Errore nella verifica amministratore: " + adminError.message
          );
          setLoading(false);
          return;
        }

        if (!admin) {
          setErrore(
            "Questo account non è autorizzato ad amministrare la piattaforma."
          );
          setLoading(false);
          return;
        }

        setAutorizzato(true);

        const { data, error } = await supabase.rpc(
          "platform_admin_list_resorts"
        );

        if (error) {
          setErrore("Errore nel caricamento dei resort: " + error.message);
        } else {
          const elenco = (data || []) as Resort[];
          setResort(elenco);

          const nuoviStati: Record<string, string> = {};

          elenco.forEach((r) => {
            nuoviStati[r.resort_id] = r.subscription_status || "pending";
          });

          setStatiResort(nuoviStati);

          if (elenco.length > 0) {
            setResortSelezionato(elenco[0].resort_id);
          }
        }
      } catch (e) {
        setErrore(e instanceof Error ? e.message : "Errore imprevisto.");
      } finally {
        setLoading(false);
      }
    }

    verificaAccesso();
  }, []);

  async function creaResort(e: React.FormEvent) {
    e.preventDefault();
    setErrore("");
    setMessaggio("");

    if (nuovoNome.trim().length < 2) {
      setErrore("Inserisci un nome di almeno due caratteri.");
      return;
    }

    setCreazione(true);

    const { error } = await supabase.rpc(
      "platform_admin_create_resort",
      { p_resort_name: nuovoNome.trim() }
    );

    if (error) {
      setErrore("Creazione non riuscita: " + error.message);
    } else {
      setNuovoNome("");
      setMessaggio(
        "Nuovo resort creato. Abbonamento in attesa di attivazione."
      );
      await caricaResort();
    }

    setCreazione(false);
  }

  async function associaUtente(e: React.FormEvent) {
    e.preventDefault();
    setErrore("");
    setMessaggio("");

    if (!resortSelezionato || !emailUtente.trim()) {
      setErrore("Seleziona un resort e inserisci l'email dell'utente.");
      return;
    }

    setAssociazione(true);

    const { error } = await supabase.rpc(
      "platform_admin_assign_user",
      {
        p_resort_id: resortSelezionato,
        p_email: emailUtente.trim(),
        p_role: ruolo,
      }
    );

    if (error) {
      setErrore("Associazione non riuscita: " + error.message);
    } else {
      setEmailUtente("");
      setMessaggio("Account associato correttamente al resort.");
      await caricaResort();
    }

    setAssociazione(false);
  }

  async function salvaStato(resortId: string) {
    setErrore("");
    setMessaggio("");
    setSalvataggioStato(resortId);

    const { error } = await supabase.rpc(
      "platform_admin_set_subscription_status",
      {
        p_resort_id: resortId,
        p_status: statiResort[resortId] || "pending",
      }
    );

    if (error) {
      setErrore(
        "Aggiornamento abbonamento non riuscito: " + error.message
      );
    } else {
      setMessaggio("Stato dell'abbonamento aggiornato.");
      await caricaResort();
    }

    setSalvataggioStato("");
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  const dataItaliana = (data: string) => {
    if (!data) return "—";
    return new Date(data).toLocaleDateString("it-IT");
  };

  if (loading) {
    return (
      <main style={{
        minHeight: "100vh",
        padding: 30,
        background: "#fcf9f6",
        color: "#762326",
      }}>
        Verifica accesso e caricamento pannello...
      </main>
    );
  }

  if (!autorizzato) {
    return (
      <main style={{
        minHeight: "100vh",
        padding: 25,
        background: "#fcf9f6",
        color: "#302b29",
      }}>
        <h1 style={{ color: "#762326" }}>Happy Tennis</h1>
        <h2>Accesso non autorizzato</h2>
        <p>{errore}</p>
        <button style={buttonStyle} onClick={logout}>Esci</button>
      </main>
    );
  }

  return (
    <main style={{
      minHeight: "100vh",
      background: "#f8f4ee",
      color: "#302b29",
      fontFamily: "Arial, sans-serif",
      paddingBottom: 30,
    }}>
      <header style={{
        minHeight: 300,
        padding: "25px clamp(18px, 5vw, 65px)",
        color: "white",
        backgroundImage:
          "linear-gradient(90deg, rgba(43,13,15,.91), rgba(43,13,15,.42)), url('/happy-tennis-cover.jpg')",
        backgroundPosition: "center",
        backgroundSize: "cover",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: 30,
      }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 14,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 34 }}>🎾</span>
            <div>
              <strong style={{ display: "block", fontSize: 22 }}>
                Happy Tennis
              </strong>
              <span style={{
                color: "#f1d49b",
                fontSize: 10,
                letterSpacing: 3,
              }}>
                RESORT MANAGER
              </span>
            </div>
          </div>

          <button
            onClick={logout}
            style={{
              ...buttonStyle,
              background: "rgba(255,255,255,.14)",
              border: "1px solid rgba(255,255,255,.55)",
            }}
          >
            Esci ↗
          </button>
        </div>

        <div>
          <span style={{
            color: "#f1d49b",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 3,
          }}>
            CONTROLLO DELLA PIATTAFORMA
          </span>

          <h1 style={{
            fontFamily: "Georgia, serif",
            fontSize: "clamp(34px, 6vw, 54px)",
            margin: "12px 0",
            color: "white",
          }}>
            Amministrazione generale
          </h1>

          <p style={{
            color: "#fff4e8",
            fontSize: 15,
            maxWidth: 580,
            lineHeight: 1.6,
          }}>
            Gestione centralizzata dei resort, degli account dello staff
            e degli abbonamenti Happy Tennis.
          </p>
        </div>

        <div style={{
          color: "#f1d49b",
          fontSize: 11,
          letterSpacing: 2,
          fontWeight: 700,
        }}>
          ⭐ PREMIUM RESORT MANAGEMENT
        </div>
      </header>

      <div style={{
        width: "min(1180px, 100%)",
        boxSizing: "border-box",
        padding: "24px clamp(14px, 4vw, 35px)",
        margin: "0 auto",
      }}>
        <button
          onClick={tornaDashboard}
          style={{
            ...buttonStyle,
            background: "white",
            color: "#762326",
            border: "1px solid #dfd1c1",
            boxShadow: "0 3px 10px rgba(75,36,16,.06)",
          }}
        >
          ← Torna alla Dashboard
        </button>

        <section style={panelStyle}>
          <span style={{
            color: "#b58a42",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 2,
          }}>
            ACCOUNT AMMINISTRATORE
          </span>

          <h2 style={{
            color: "#762326",
            fontFamily: "Georgia, serif",
            marginBottom: 8,
          }}>
            Pannello di controllo
          </h2>

          <p style={{ color: "#70645b", marginBottom: 5 }}>
            Account collegato:
          </p>

          <strong style={{ overflowWrap: "anywhere" }}>{email}</strong>

          <p style={{ color: "#70645b", marginBottom: 0 }}>
            Gestisci resort, account dello staff e abbonamenti.
          </p>
        </section>

        {errore && (
          <div style={{
            padding: 15,
            marginTop: 18,
            borderRadius: 10,
            background: "#fff0ef",
            border: "1px solid #f0c7c3",
            color: "#a52b2b",
            overflowWrap: "anywhere",
          }}>
            {errore}
          </div>
        )}

        {messaggio && (
          <div style={{
            padding: 15,
            marginTop: 18,
            borderRadius: 10,
            background: "#edf7ef",
            border: "1px solid #c9e5d0",
            color: "#287a45",
          }}>
            {messaggio}
          </div>
        )}

        <section style={panelStyle}>
          <span style={{
            color: "#b58a42",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 2,
          }}>
            NUOVO CLIENTE
          </span>

          <h2 style={{
            color: "#762326",
            fontFamily: "Georgia, serif",
            marginTop: 8,
          }}>
            Crea un nuovo resort
          </h2>

          <form
            onSubmit={creaResort}
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              alignItems: "end",
            }}
          >
            <div style={{ flex: "1 1 230px" }}>
              <label style={labelStyle}>Nome del resort</label>
              <input
                style={inputStyle}
                value={nuovoNome}
                onChange={(e) => setNuovoNome(e.target.value)}
                placeholder="Nome del nuovo resort"
                maxLength={120}
              />
            </div>

            <button
              style={buttonStyle}
              disabled={creazione}
            >
              {creazione ? "Creazione..." : "＋ Crea resort"}
            </button>
          </form>

          <p style={{
            color: "#806d5a",
            fontSize: 13,
            marginBottom: 0,
          }}>
            Il nuovo resort verrà creato con abbonamento in attesa.
          </p>
        </section>

        <section style={panelStyle}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}>
            <div>
              <span style={{
                color: "#b58a42",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 2,
              }}>
                PORTAFOGLIO CLIENTI
              </span>

              <h2 style={{
                color: "#762326",
                fontFamily: "Georgia, serif",
                margin: "8px 0",
              }}>
                Resort registrati ({resort.length})
              </h2>
            </div>

            <button
              style={{
                ...buttonStyle,
                background: "#806d5a",
              }}
              onClick={caricaResort}
            >
              ↻ Aggiorna elenco
            </button>
          </div>

          {resort.length === 0 ? (
            <p>Nessun resort registrato.</p>
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
              gap: 16,
              marginTop: 18,
            }}>
              {resort.map((r) => (
                <article
                  key={r.resort_id}
                  style={{
                    border: "1px solid #eadfce",
                    borderRadius: 13,
                    padding: 18,
                    background: "#fff",
                    minWidth: 0,
                  }}
                >
                  <h3 style={{
                    color: "#762326",
                    fontFamily: "Georgia, serif",
                    fontSize: 22,
                    marginTop: 0,
                    overflowWrap: "anywhere",
                  }}>
                    {r.resort_name}
                  </h3>

                  <p>
                    <strong>Registrazione:</strong>{" "}
                    {dataItaliana(r.resort_created_at)}
                  </p>

                  <p>
                    <strong>Collaboratori associati:</strong>{" "}
                    {r.staff_count}
                  </p>

                  <p>
                    <strong>Abbonamento:</strong>{" "}
                    {etichetteStato[r.subscription_status || "pending"]}
                  </p>

                  <p>
                    <strong>Scadenza periodo:</strong>{" "}
                    {dataItaliana(r.subscription_period_end || "")}
                  </p>

                  <label style={labelStyle}>
                    Modifica stato abbonamento
                  </label>

                  <select
                    style={inputStyle}
                    value={statiResort[r.resort_id] || "pending"}
                    onChange={(e) =>
                      setStatiResort({
                        ...statiResort,
                        [r.resort_id]: e.target.value,
                      })
                    }
                  >
                    {stati.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>

                  <button
                    style={{
                      ...buttonStyle,
                      width: "100%",
                      marginTop: 12,
                    }}
                    onClick={() => salvaStato(r.resort_id)}
                    disabled={salvataggioStato === r.resort_id}
                  >
                    {salvataggioStato === r.resort_id
                      ? "Salvataggio..."
                      : "Salva stato abbonamento"}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        <section style={panelStyle}>
          <span style={{
            color: "#b58a42",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 2,
          }}>
            GESTIONE UTENTI
          </span>

          <h2 style={{
            color: "#762326",
            fontFamily: "Georgia, serif",
            marginTop: 8,
          }}>
            Associa un account a un resort
          </h2>

          <p style={{ color: "#70645b" }}>
            L'utente deve avere già creato il proprio account Happy Tennis.
          </p>

          <form onSubmit={associaUtente}>
            <label style={labelStyle}>Resort</label>

            <select
              style={inputStyle}
              value={resortSelezionato}
              onChange={(e) => setResortSelezionato(e.target.value)}
              required
            >
              {resort.map((r) => (
                <option key={r.resort_id} value={r.resort_id}>
                  {r.resort_name}
                </option>
              ))}
            </select>

            <label style={labelStyle}>Email dell'account</label>

            <input
              style={inputStyle}
              type="email"
              value={emailUtente}
              onChange={(e) => setEmailUtente(e.target.value)}
              placeholder="nome@email.it"
              required
            />

            <label style={labelStyle}>Ruolo da assegnare</label>

            <select
              style={inputStyle}
              value={ruolo}
              onChange={(e) => setRuolo(e.target.value)}
            >
              {ruoli.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>

            <button
              style={{
                ...buttonStyle,
                width: "100%",
                marginTop: 20,
              }}
              disabled={associazione || resort.length === 0}
            >
              {associazione ? "Associazione..." : "Associa account"}
            </button>
          </form>
        </section>

        <footer style={{
          textAlign: "center",
          color: "#9a8878",
          fontSize: 11,
          letterSpacing: 1,
          padding: "30px 0 10px",
          borderTop: "1px solid #e8ddcf",
          marginTop: 30,
        }}>
          HAPPY TENNIS RESORT MANAGER
          <br />
          AMMINISTRAZIONE GENERALE DELLA PIATTAFORMA
        </footer>
      </div>
    </main>
  );
}
