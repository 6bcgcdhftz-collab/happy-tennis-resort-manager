
"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

type Istruttore = {
  user_id: string;
  nome: string;
};

type IstruttoreEsterno = {
  id: string;
  first_name: string;
  last_name: string;
};

type Campo = {
  id: string;
  name: string;
  sport: string;
};

type Lezione = {
  id: string;
  title: string;
  lesson_type: string;
  lesson_date: string;
  start_time: string;
  duration_minutes: number;
  price: number;
  status: string;
  instructor_user_id: string | null;
  external_instructor_id: string | null;
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
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

function LezioniContent() {
  const searchParams = useSearchParams();
  const resortRichiesto = searchParams.get("resort");

  const [resortId, setResortId] = useState("");
  const [resortNome, setResortNome] = useState("");
  const [isMaestro, setIsMaestro] = useState(false);

  const [istruttori, setIstruttori] = useState<Istruttore[]>([]);
  const [esterni, setEsterni] = useState<IstruttoreEsterno[]>([]);
  const [campi, setCampi] = useState<Campo[]>([]);
  const [lezioni, setLezioni] = useState<Lezione[]>([]);

  const [tipoIstruttore, setTipoIstruttore] = useState("interno");
  const [istruttoreId, setIstruttoreId] = useState("");
  const [esternoId, setEsternoId] = useState("");
  const [nomeEsterno, setNomeEsterno] = useState("");
  const [cognomeEsterno, setCognomeEsterno] = useState("");

  const [titolo, setTitolo] = useState("");
  const [tipoLezione, setTipoLezione] = useState("individual");
  const [dataLezione, setDataLezione] = useState("");
  const [oraLezione, setOraLezione] = useState("09:00");
  const [durata, setDurata] = useState("60");
  const [prezzo, setPrezzo] = useState("0");
  const [campoId, setCampoId] = useState("");
  const [partecipanti, setPartecipanti] = useState("");

  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState("");
  const [messaggio, setMessaggio] = useState("");

  async function caricaDati() {
    setLoading(true);
    setErrore("");

    const supabase = getSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/";
      return;
    }

    const { data: memberships, error: membershipError } = await supabase
      .from("resort_memberships")
      .select("resort_id, role, resorts(name)")
      .eq("user_id", user.id)
      .eq("is_active", true);

    if (membershipError || !memberships?.length) {
      setErrore("Non risultano resort associati a questo account.");
      setLoading(false);
      return;
    }

    const membership = resortRichiesto
      ? memberships.find((item) => item.resort_id === resortRichiesto)
      : memberships.find((item) => {
          const joined = item.resorts as unknown as
            { name: string } | { name: string }[] | null;
          const r = Array.isArray(joined) ? joined[0] : joined;
          return r?.name?.toLowerCase() === "mare e sole";
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
    setIsMaestro(membership.role === "maestro_responsabile");

    const [staff, esterniData, campiData, lezioniData] = await Promise.all([
      supabase
        .from("resort_memberships")
        .select("user_id, profiles(full_name)")
        .eq("resort_id", membership.resort_id)
        .eq("is_active", true),

      supabase
        .from("lesson_instructors")
        .select("id, first_name, last_name")
        .eq("resort_id", membership.resort_id)
        .eq("is_active", true)
        .order("last_name"),

      supabase
        .from("sport_courts")
        .select("id, name, sport")
        .eq("resort_id", membership.resort_id)
        .order("name"),

      supabase
        .from("sports_lessons")
        .select("id, title, lesson_type, lesson_date, start_time, duration_minutes, price, status, instructor_user_id, external_instructor_id")
        .eq("resort_id", membership.resort_id)
        .order("lesson_date", { ascending: false }),
    ]);

    if (staff.error || esterniData.error || campiData.error || lezioniData.error) {
      setErrore(
        staff.error?.message ||
        esterniData.error?.message ||
        campiData.error?.message ||
        lezioniData.error?.message ||
        "Errore durante il caricamento."
      );
      setLoading(false);
      return;
    }

    setIstruttori(
      (staff.data || []).map((item: any) => {
        const profilo = Array.isArray(item.profiles)
          ? item.profiles[0]
          : item.profiles;
        return {
          user_id: item.user_id,
          nome: profilo?.full_name || "Collaboratore",
        };
      })
    );

    setEsterni(esterniData.data || []);
    setCampi(campiData.data || []);
    setLezioni(lezioniData.data || []);
    setLoading(false);
  }

  useEffect(() => {
    caricaDati();
  }, [resortRichiesto]);

  async function salvaLezione() {
    if (!resortId || !titolo.trim() || !dataLezione || !oraLezione) {
      setErrore("Inserisci titolo, data e ora della lezione.");
      return;
    }

    if (tipoIstruttore === "interno" && !istruttoreId) {
      setErrore("Seleziona un istruttore dello staff.");
      return;
    }

    if (
      tipoIstruttore === "esterno" &&
      ((!esternoId && (!nomeEsterno.trim() || !cognomeEsterno.trim())))
    ) {
      setErrore("Seleziona un istruttore esterno o inserisci nome e cognome.");
      return;
    }

    setSalvando(true);
    setErrore("");
    setMessaggio("");

    const supabase = getSupabase();
    let idEsterno = esternoId || null;

    if (tipoIstruttore === "esterno" && !idEsterno) {
      const { data, error } = await supabase
        .from("lesson_instructors")
        .insert({
          resort_id: resortId,
          first_name: nomeEsterno.trim(),
          last_name: cognomeEsterno.trim(),
        })
        .select("id")
        .single();

      if (error || !data) {
        setErrore("Errore nel salvataggio dell'istruttore: " + error?.message);
        setSalvando(false);
        return;
      }

      idEsterno = data.id;
    }

    const { data: nuovaLezione, error } = await supabase
      .from("sports_lessons")
      .insert({
        resort_id: resortId,
        instructor_user_id: tipoIstruttore === "interno" ? istruttoreId : null,
        external_instructor_id: tipoIstruttore === "esterno" ? idEsterno : null,
        court_id: campoId || null,
        title: titolo.trim(),
        lesson_type: tipoLezione,
        lesson_date: dataLezione,
        start_time: oraLezione,
        duration_minutes: Number(durata),
        price: Number(prezzo),
        status: "scheduled",
      })
      .select("id")
      .single();

    if (error || !nuovaLezione) {
      setErrore("Errore nel salvataggio della lezione: " + error?.message);
      setSalvando(false);
      return;
    }

    const nomi = partecipanti
      .split("\n")
      .map((nome) => nome.trim())
      .filter(Boolean);

    if (nomi.length > 0) {
      const righe = nomi.map((nome) => {
        const parti = nome.split(/\s+/);
        return {
          resort_id: resortId,
          lesson_id: nuovaLezione.id,
          first_name: parti.shift() || "",
          last_name: parti.join(" ") || "",
          attendance: "expected",
        };
      });

      const { error: partecipantiError } = await supabase
        .from("sports_lesson_participants")
        .insert(righe);

      if (partecipantiError) {
        setErrore(
          "Lezione salvata, ma errore nell'inserimento degli allievi: " +
          partecipantiError.message
        );
        setSalvando(false);
        await caricaDati();
        return;
      }
    }

    setMessaggio("Lezione registrata correttamente!");
    setTitolo("");
    setPartecipanti("");
    setCampoId("");
    setPrezzo("0");
    setEsternoId("");
    setNomeEsterno("");
    setCognomeEsterno("");

    await caricaDati();
    setSalvando(false);
  }

  function nomeIstruttore(lezione: Lezione) {
    if (lezione.instructor_user_id) {
      return istruttori.find(
        (item) => item.user_id === lezione.instructor_user_id
      )?.nome || "Istruttore dello staff";
    }

    const esterno = esterni.find(
      (item) => item.id === lezione.external_instructor_id
    );

    return esterno
      ? `${esterno.first_name} ${esterno.last_name}`
      : "Istruttore esterno";
  }

  function nomeCampo(id: string | null) {
    return campi.find((item) => item.id === id)?.name || "Non assegnato";
  }

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
          <span>ORGANIZZAZIONE SPORTIVA</span>
          <h1>Lezioni e maestri</h1>
          <p>Gestisci istruttori, allievi e lezioni del tuo resort.</p>
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
          ← Torna alla Dashboard
        </button>

        <div className="courts-heading">
          <div>
            <span className="courts-eyebrow">AREA DIDATTICA</span>
            <h2>Registro lezioni</h2>
            <p>Programma le attività e consulta lo storico delle lezioni.</p>
          </div>
          <div className="courts-resort-name">{resortNome}</div>
        </div>

        {errore && <div className="courts-error">{errore}</div>}
        {messaggio && <div className="courts-message">{messaggio}</div>}

        {!isMaestro && !loading && (
          <div className="courts-message">
            Accesso in consultazione. Solo il Maestro responsabile può
            registrare nuove lezioni.
          </div>
        )}

        <section
          style={{
            padding: 22,
            marginBottom: 28,
            border: "1px solid #eadfce",
            borderRadius: 16,
            background: "#fffdf9",
          }}
        >
          <h2 style={{ color: "#762326", fontFamily: "Georgia, serif" }}>
            ＋ Nuova lezione
          </h2>

          <label style={labelStyle}>Titolo della lezione</label>
          <input
            style={inputStyle}
            value={titolo}
            onChange={(e) => setTitolo(e.target.value)}
            placeholder="Es. Lezione di tennis principianti"
            disabled={!isMaestro || salvando}
          />

          <label style={labelStyle}>Tipo di lezione</label>
          <select
            style={inputStyle}
            value={tipoLezione}
            onChange={(e) => setTipoLezione(e.target.value)}
            disabled={!isMaestro || salvando}
          >
            <option value="individual">Individuale</option>
            <option value="group">Di gruppo</option>
          </select>

          <label style={labelStyle}>Istruttore</label>
          <select
            style={inputStyle}
            value={tipoIstruttore}
            onChange={(e) => {
              setTipoIstruttore(e.target.value);
              setIstruttoreId("");
              setEsternoId("");
            }}
            disabled={!isMaestro || salvando}
          >
            <option value="interno">Istruttore dello staff</option>
            <option value="esterno">Istruttore esterno</option>
          </select>

          {tipoIstruttore === "interno" ? (
            <select
              style={inputStyle}
              value={istruttoreId}
              onChange={(e) => setIstruttoreId(e.target.value)}
              disabled={!isMaestro || salvando}
            >
              <option value="">Seleziona un collaboratore</option>
              {istruttori.map((item) => (
                <option key={item.user_id} value={item.user_id}>
                  {item.nome}
                </option>
              ))}
            </select>
          ) : (
            <>
              <label style={labelStyle}>Istruttori esterni già registrati</label>
              <select
                style={inputStyle}
                value={esternoId}
                onChange={(e) => {
                  setEsternoId(e.target.value);
                  setNomeEsterno("");
                  setCognomeEsterno("");
                }}
                disabled={!isMaestro || salvando}
              >
                <option value="">Nuovo istruttore esterno</option>
                {esterni.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.first_name} {item.last_name}
                  </option>
                ))}
              </select>

              {!esternoId && (
                <>
                  <label style={labelStyle}>Nome istruttore esterno</label>
                  <input
                    style={inputStyle}
                    value={nomeEsterno}
                    onChange={(e) => setNomeEsterno(e.target.value)}
                    placeholder="Nome"
                    disabled={!isMaestro || salvando}
                  />
                  <label style={labelStyle}>Cognome istruttore esterno</label>
                  <input
                    style={inputStyle}
                    value={cognomeEsterno}
                    onChange={(e) => setCognomeEsterno(e.target.value)}
                    placeholder="Cognome"
                    disabled={!isMaestro || salvando}
                  />
                </>
              )}
            </>
          )}

          <label style={labelStyle}>Campo (facoltativo)</label>
          <select
            style={inputStyle}
            value={campoId}
            onChange={(e) => setCampoId(e.target.value)}
            disabled={!isMaestro || salvando}
          >
            <option value="">Nessun campo assegnato</option>
            {campi.map((campo) => (
              <option key={campo.id} value={campo.id}>
                {campo.name} · {campo.sport}
              </option>
            ))}
          </select>

          <div className="courts-stats" style={{ marginTop: 12 }}>
            <div>
              <label style={labelStyle}>Data</label>
              <input
                style={inputStyle}
                type="date"
                value={dataLezione}
                onChange={(e) => setDataLezione(e.target.value)}
                disabled={!isMaestro || salvando}
              />
            </div>
            <div>
              <label style={labelStyle}>Ora di inizio</label>
              <input
                style={inputStyle}
                type="time"
                value={oraLezione}
                onChange={(e) => setOraLezione(e.target.value)}
                disabled={!isMaestro || salvando}
              />
            </div>
            <div>
              <label style={labelStyle}>Durata in minuti</label>
              <input
                style={inputStyle}
                type="number"
                min="15"
                step="15"
                value={durata}
                onChange={(e) => setDurata(e.target.value)}
                disabled={!isMaestro || salvando}
              />
            </div>
          </div>

          <label style={labelStyle}>Prezzo (€)</label>
          <input
            style={inputStyle}
            type="number"
            min="0"
            step="0.50"
            value={prezzo}
            onChange={(e) => setPrezzo(e.target.value)}
            disabled={!isMaestro || salvando}
          />

          <label style={labelStyle}>Allievi (un nome e cognome per riga)</label>
          <textarea
            style={{ ...inputStyle, minHeight: 100, resize: "vertical" }}
            value={partecipanti}
            onChange={(e) => setPartecipanti(e.target.value)}
            placeholder={"Mario Rossi\nLuca Bianchi"}
            disabled={!isMaestro || salvando}
          />

          <button
            className="court-save-button"
            style={{ marginTop: 22 }}
            onClick={salvaLezione}
            disabled={!isMaestro || salvando || loading}
          >
            {salvando ? "Salvataggio in corso..." : "Registra lezione"}
          </button>
        </section>

        <div className="courts-section-title">
          <span className="courts-eyebrow">ARCHIVIO</span>
          <h2>Lezioni registrate</h2>
        </div>

        {loading && <div className="courts-message">Caricamento...</div>}

        {!loading && lezioni.length === 0 && (
          <div className="courts-message">
            Non ci sono ancora lezioni registrate.
          </div>
        )}

        <section className="courts-grid">
          {lezioni.map((lezione) => (
            <article className="court-card" key={lezione.id}>
              <div className="court-card-top">
                <span className="court-card-icon">🎓</span>
                <span className="court-status status-active">
                  {lezione.status === "completed"
                    ? "Completata"
                    : lezione.status === "cancelled"
                    ? "Annullata"
                    : "Programm ata".replace(" ", "")}
                </span>
              </div>

              <h3>{lezione.title}</h3>
              <p>{lezione.lesson_type === "group" ? "Lezione di gruppo" : "Lezione individuale"}</p>
              <p><strong>Istruttore:</strong> {nomeIstruttore(lezione)}</p>
              <p><strong>Campo:</strong> {nomeCampo(null)}</p>
              <p>
                <strong>Data:</strong>{" "}
                {new Date(lezione.lesson_date + "T00:00:00").toLocaleDateString("it-IT")}
              </p>
              <p><strong>Ora:</strong> {lezione.start_time.slice(0, 5)}</p>
              <p><strong>Durata:</strong> {lezione.duration_minutes} minuti</p>
              <p><strong>Prezzo:</strong> € {Number(lezione.price).toFixed(2)}</p>
            </article>
          ))}
        </section>

        <footer className="courts-footer">
          HAPPY TENNIS RESORT MANAGER · {resortNome}
        </footer>
      </div>
    </main>
  );
}

export default function LezioniPage() {
  return (
    <Suspense fallback={<p>Caricamento lezioni...</p>}>
      <LezioniContent />
    </Suspense>
  );
}
