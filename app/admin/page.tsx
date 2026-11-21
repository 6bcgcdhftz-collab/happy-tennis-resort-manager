
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

const stileInput: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  border: "1px solid #d8d0c5",
  borderRadius: 8,
  fontSize: 15,
  background: "white",
  boxSizing: "border-box",
};

const stileBottone: React.CSSProperties = {
  padding: "12px 18px",
  background: "#a52b2b",
  color: "white",
  border: "none",
  borderRadius: 8,
  fontWeight: 600,
  cursor: "pointer",
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
        const { data: { user }, error: userError } =
          await supabase.auth.getUser();

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
          setErrore("Errore nella verifica amministratore: " + adminError.message);
          setLoading(false);
          return;
        }

        if (!admin) {
          setErrore("Questo account non è autorizzato ad amministrare la piattaforma.");
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
      setMessaggio("Nuovo resort creato. Abbonamento in attesa di attivazione.");
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
      setErrore("Aggiornamento abbonamento non riuscito: " + error.message);
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
      <main style={{ padding: 30, fontFamily: "Arial" }}>
        Verifica accesso e caricamento pannello...
      </main>
    );
  }

  if (!autorizzato) {
    return (
      <main style={{
        minHeight: "100vh",
        padding: 30,
        background: "#fcf9f6",
        fontFamily: "Arial",
      }}>
        <h1 style={{ color: "#a52b2b" }}>Happy Tennis</h1>
        <h2>Accesso non autorizzato</h2>
        <p>{errore}</p>
        <button style={stileBottone} onClick={logout}>Esci</button>
      </main>
    );
  }

  return (
    <main style={{
      minHeight: "100vh",
      background: "#fcf9f6",
      color: "#292929",
      padding: "20px",
      fontFamily: "Arial, sans-serif",
    }}>
      <header style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 12,
        borderBottom: "1px solid #e5d8c8",
        paddingBottom: 18,
      }}>
        <div>
          <h1 style={{ color: "#a52b2b", margin: 0 }}>
            Happy Tennis
          </h1>
          <p style={{ margin: "6px 0 0", color: "#806d5a" }}>
            Amministrazione generale della piattaforma
          </p>
        </div>
        <button style={stileBottone} onClick={logout}>Esci</button>
      </header>

      <section style={{
        background: "white",
        padding: 20,
        borderRadius: 14,
        border: "1px solid #e8dccb",
        marginTop: 22,
      }}>
        <p style={{ color: "#806d5a", margin: "0 0 5px" }}>
          ACCOUNT AMMINISTRATORE
        </p>
        <strong>{email}</strong>
        <h2 style={{ marginBottom: 5 }}>Pannello di controllo</h2>
        <p style={{ color: "#6d6258", marginTop: 5 }}>
          Gestisci resort, account dello staff e abbonamenti.
        </p>
      </section>

      {errore && (
        <div style={{
          background: "#fff0ef",
          color: "#a52b2b",
          padding: 14,
          borderRadius: 8,
          marginTop: 18,
          overflowWrap: "anywhere",
        }}>
          {errore}
        </div>
      )}

      {messaggio && (
        <div style={{
          background: "#edf7ef",
          color: "#287a45",
          padding: 14,
          borderRadius: 8,
          marginTop: 18,
        }}>
          {messaggio}
        </div>
      )}

      <section style={{
        background: "white",
        padding: 20,
        borderRadius: 14,
        border: "1px solid #e8dccb",
        marginTop: 22,
      }}>
        <h2 style={{ marginTop: 0 }}>Crea un nuovo resort</h2>
        <form onSubmit={creaResort} style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
        }}>
          <input
            style={{ ...stileInput, flex: "1 1 220px" }}
            value={nuovoNome}
            onChange={(e) => setNuovoNome(e.target.value)}
            placeholder="Nome del nuovo resort"
            maxLength={120}
          />
          <button style={stileBottone} disabled={creazione}>
            {creazione ? "Creazione..." : "Crea resort"}
          </button>
        </form>
        <p style={{ color: "#806d5a", fontSize: 13 }}>
          Il nuovo resort verrà creato con abbonamento in attesa.
        </p>
      </section>

      <section style={{
        background: "white",
        padding: 20,
        borderRadius: 14,
        border: "1px solid #e8dccb",
        marginTop: 22,
      }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}>
          <h2 style={{ margin: 0 }}>Resort registrati ({resort.length})</h2>
          <button
            style={{ ...stileBottone, background: "#806d5a" }}
            onClick={caricaResort}
          >
            Aggiorna elenco
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
              <article key={r.resort_id} style={{
                border: "1px solid #e8dccb",
                borderRadius: 12,
                padding: 16,
                minWidth: 0,
              }}>
                <h3 style={{ color: "#a52b2b", marginTop: 0 }}>
                  {r.resort_name}
                </h3>

                <p>Registrazione: {dataItaliana(r.resort_created_at)}</p>
                <p>Collaboratori associati: <strong>{r.staff_count}</strong></p>
                <p>
                  Abbonamento: <strong>
                    {etichetteStato[r.subscription_status || "pending"]}
                  </strong>
                </p>
                <p>Scadenza periodo: {dataItaliana(r.subscription_period_end || "")}</p>

                <label style={{ display: "block", marginTop: 14, marginBottom: 6 }}>
                  Modifica stato abbonamento
                </label>
                <select
                  style={stileInput}
                  value={statiResort[r.resort_id] || "pending"}
                  onChange={(e) => setStatiResort({
                    ...statiResort,
                    [r.resort_id]: e.target.value,
                  })}
                >
                  {stati.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>

                <button
                  style={{ ...stileBottone, width: "100%", marginTop: 10 }}
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

      <section style={{
        background: "white",
        padding: 20,
        borderRadius: 14,
        border: "1px solid #e8dccb",
        marginTop: 22,
      }}>
        <h2 style={{ marginTop: 0 }}>Associa un account a un resort</h2>
        <p style={{ color: "#6d6258" }}>
          L'utente deve avere già creato il proprio account Happy Tennis.
        </p>

        <form onSubmit={associaUtente}>
          <label>Resort</label>
          <select
            style={{ ...stileInput, marginTop: 6, marginBottom: 14 }}
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

          <label>Email dell'account</label>
          <input
            style={{ ...stileInput, marginTop: 6, marginBottom: 14 }}
            type="email"
            value={emailUtente}
            onChange={(e) => setEmailUtente(e.target.value)}
            placeholder="nome@email.it"
            required
          />

          <label>Ruolo da assegnare</label>
          <select
            style={{ ...stileInput, marginTop: 6, marginBottom: 14 }}
            value={ruolo}
            onChange={(e) => setRuolo(e.target.value)}
          >
            {ruoli.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>

          <button
            style={stileBottone}
            disabled={associazione || resort.length === 0}
          >
            {associazione ? "Associazione..." : "Associa account"}
          </button>
        </form>
      </section>

      <footer style={{
        textAlign: "center",
        color: "#806d5a",
        fontSize: 13,
        padding: "28px 0",
      }}>
        Happy Tennis Resort Manager · Amministrazione piattaforma
      </footer>
    </main>
  );
}
