
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
  status?: string;
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
  court_id: string | null;
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

  const [calendarioAperto, setCalendarioAperto] = useState(false);
  const [meseCalendario, setMeseCalendario] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );

  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState("");
  const [messaggio, setMessaggio] = useState("");

  async function caricaDati() {
    setLoading(true);
    setErrore("");

    const supabase = getSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

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
      setErrore(
        "ERRORE DI CARICAMENTO: " +
          (membershipError?.message ||
            "Non risultano resort associati a questo account.")
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
      setErrore("ERRORE DI ACCESSO: non hai accesso al resort selezionato.");
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

    const [staff, esterniData, campiData, lezioniData] = await Promise.all([
      supabase
        .from("resort_memberships")
        .select("user_id")
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
        .select("id, name, sport, status")
        .eq("resort_id", membership.resort_id)
        .eq("status", "active")
        .order("name"),

      supabase
        .from("sports_lessons")
        .select(
          "id, title, lesson_type, lesson_date, start_time, duration_minutes, price, status, instructor_user_id, external_instructor_id, court_id"
        )
        .eq("resort_id", membership.resort_id)
        .order("lesson_date", { ascending: false }),
    ]);

    if (
      staff.error ||
      esterniData.error ||
      campiData.error ||
      lezioniData.error
    ) {
      setErrore(
        "ERRORE DI CARICAMENTO: " +
          (staff.error?.message ||
            esterniData.error?.message ||
            campiData.error?.message ||
            lezioniData.error?.message ||
            "Errore durante il caricamento.")
      );
      setLoading(false);
      return;
    }

    const userIds = (staff.data || []).map((item) => item.user_id);

    const { data: profili, error: profiliError } = userIds.length
      ? await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds)
      : { data: [], error: null };

    if (profiliError) {
      setErrore(
        "ERRORE DI CARICAMENTO: nomi dello staff: " +
          profiliError.message
      );
      setLoading(false);
      return;
    }

    setIstruttori(
      (staff.data || []).map((item) => ({
        user_id: item.user_id,
        nome:
          profili?.find((profilo) => profilo.id === item.user_id)?.full_name ||
          "Collaboratore",
      }))
    );

    setEsterni(esterniData.data || []);
    setCampi(campiData.data || []);
    setLezioni(lezioniData.data || []);
    setLoading(false);
  }

  useEffect(() => {
    caricaDati();
  }, [resortRichiesto]);

  function cambiaMese(differenza: number) {
    setMeseCalendario(
      new Date(
        meseCalendario.getFullYear(),
        meseCalendario.getMonth() + differenza,
        1
      )
    );
  }

  function selezionaData(giorno: number) {
    const anno = meseCalendario.getFullYear();
    const mese = String(meseCalendario.getMonth() + 1).padStart(2, "0");
    const giornoFormattato = String(giorno).padStart(2, "0");

    setDataLezione(`${anno}-${mese}-${giornoFormattato}`);
    setCalendarioAperto(false);
    setErrore("");
  }

  function selezionaOggi() {
    const oggi = new Date();

    const valore = [
      oggi.getFullYear(),
      String(oggi.getMonth() + 1).padStart(2, "0"),
      String(oggi.getDate()).padStart(2, "0"),
    ].join("-");

    setDataLezione(valore);
    setMeseCalendario(
      new Date(oggi.getFullYear(), oggi.getMonth(), 1)
    );
    setCalendarioAperto(false);
    setErrore("");
  }

  async function salvaLezione() {
    setErrore("");
    setMessaggio("");

    if (!campoId) {
      setErrore(
        "CAMPO OBBLIGATORIO: seleziona un campo prima di registrare la lezione."
      );
      return;
    }

    if (!resortId || !titolo.trim() || !dataLezione || !oraLezione) {
      setErrore(
        "DATI OBBLIGATORI MANCANTI: inserisci titolo, data e ora della lezione."
      );
      return;
    }

    if (tipoIstruttore === "interno" && !istruttoreId) {
      setErrore("ISTRUTTORE MANCANTE: seleziona un istruttore dello staff.");
      return;
    }

    if (
      tipoIstruttore === "esterno" &&
      !esternoId &&
      (!nomeEsterno.trim() || !cognomeEsterno.trim())
    ) {
      setErrore(
        "ISTRUTTORE ESTERNO MANCANTE: seleziona un istruttore esterno oppure inserisci nome e cognome."
      );
      return;
    }

    const durataNumerica = Number(durata);
    const prezzoNumerico = Number(prezzo);

    if (
      !Number.isFinite(durataNumerica) ||
      durataNumerica <= 0 ||
      !Number.isFinite(prezzoNumerico) ||
      prezzoNumerico < 0
    ) {
      setErrore(
        "DATI NON VALIDI: controlla la durata e il prezzo della lezione."
      );
      return;
    }

    setSalvando(true);

    try {
      const supabase = getSupabase();

      // Verifica preventiva della disponibilità del campo.
      const { data: disponibile, error: disponibilitaError } =
        await supabase.rpc("verifica_disponibilita_campo", {
          p_resort_id: resortId,
          p_court_id: campoId,
          p_data: dataLezione,
          p_ora: oraLezione,
          p_durata: durataNumerica,
        });

      if (disponibilitaError) {
        setErrore(
          "ERRORE DI VERIFICA: non è stato possibile controllare la disponibilità del campo. " +
            disponibilitaError.message
        );
        return;
      }

      if (disponibile !== true) {
        // Distingue un campo non attivo da un campo occupato.
        const { data: campoControllato, error: campoError } = await supabase
          .from("sport_courts")
          .select("status")
          .eq("id", campoId)
          .eq("resort_id", resortId)
          .maybeSingle();

        if (campoError) {
          setErrore(
            "ERRORE DI VERIFICA: impossibile determinare il motivo dell'indisponibilità. " +
              campoError.message
          );
        } else if (!campoControllato || campoControllato.status !== "active") {
          setErrore(
            "CAMPO NON DISPONIBILE: il campo selezionato non è attivo oppure è in manutenzione. La lezione non è stata registrata. Scegli un altro campo."
          );
        } else {
          setErrore(
            "OVERBOOKING: il campo selezionato è già occupato nella fascia oraria richiesta. La lezione NON è stata registrata. Scegli un altro orario o un altro campo."
          );
        }

        return;
      }

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
          setErrore(
            "ERRORE DI SALVATAGGIO ISTRUTTORE: " +
              (error?.message || "risposta non valida")
          );
          return;
        }

        idEsterno = data.id;
      }

      const { data: nuovaLezione, error } = await supabase
        .from("sports_lessons")
        .insert({
          resort_id: resortId,
          instructor_user_id:
            tipoIstruttore === "interno" ? istruttoreId : null,
          external_instructor_id:
            tipoIstruttore === "esterno" ? idEsterno : null,
          court_id: campoId,
          title: titolo.trim(),
          lesson_type: tipoLezione,
          lesson_date: dataLezione,
          start_time: oraLezione,
          duration_minutes: durataNumerica,
          price: prezzoNumerico,
          status: "scheduled",
        })
        .select("id")
        .single();

      if (error || !nuovaLezione) {
        if (error?.code === "23P01") {
          setErrore(
            "OVERBOOKING: il campo è stato occupato da un'altra prenotazione nello stesso orario. La lezione NON è stata registrata. Scegli un altro orario o un altro campo."
          );
        } else {
          setErrore(
            "ERRORE DI SALVATAGGIO LEZIONE: " +
              (error?.message || "risposta non valida")
          );
        }

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
            "LEZIONE SALVATA, MA ERRORE ALLIEVI: la lezione è stata registrata, ma non è stato possibile inserire tutti gli allievi. " +
              partecipantiError.message
          );
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
    } catch (err) {
      const dettaglio =
        err instanceof Error ? err.message : "Errore imprevisto.";

      setErrore(
        "ERRORE IMPREVISTO: non è stato possibile completare la registrazione. " +
          dettaglio
      );
    } finally {
      setSalvando(false);
    }
  }

  function titoloErrore(testo: string) {
    if (testo.startsWith("OVERBOOKING")) {
      return "⚠️ OVERBOOKING – CAMPO GIÀ OCCUPATO";
    }

    if (testo.startsWith("CAMPO NON DISPONIBILE")) {
      return "⚠️ CAMPO NON DISPONIBILE";
    }

    if (testo.startsWith("CAMPO OBBLIGATORIO")) {
      return "⚠️ CAMPO OBBLIGATORIO";
    }

    if (testo.startsWith("ISTRUTTORE")) {
      return "⚠️ ISTRUTTORE NON SELEZIONATO";
    }

    if (testo.startsWith("DATI")) {
      return "⚠️ CONTROLLA I DATI INSERITI";
    }

    if (testo.startsWith("LEZIONE SALVATA")) {
      return "⚠️ ATTENZIONE: REGISTRAZIONE PARZIALE";
    }

    if (testo.startsWith("ERRORE DI CARICAMENTO")) {
      return "⚠️ ERRORE DI CARICAMENTO";
    }

    return "⚠️ ERRORE – OPERAZIONE NON COMPLETATA";
  }

  function nomeIstruttore(lezione: Lezione) {
    if (lezione.instructor_user_id) {
      return (
        istruttori.find(
          (item) => item.user_id === lezione.instructor_user_id
        )?.nome || "Istruttore dello staff"
      );
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

  const primoGiornoMese = new Date(
    meseCalendario.getFullYear(),
    meseCalendario.getMonth(),
    1
  );

  const giorniNelMese = new Date(
    meseCalendario.getFullYear(),
    meseCalendario.getMonth() + 1,
    0
  ).getDate();

  const spaziIniziali = (primoGiornoMese.getDay() + 6) % 7;

  const dataVisualizzata = dataLezione
    ? new Date(dataLezione + "T00:00:00").toLocaleDateString("it-IT", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "Seleziona una data";

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

        {errore && (
          <div
            role="alert"
            aria-live="assertive"
            style={{
              margin: "18px 0",
              padding: 18,
              border: "2px solid #c62828",
              borderRadius: 12,
              background: "#fff0f0",
              color: "#8b1e1e",
              fontSize: 15,
              lineHeight: 1.6,
              boxShadow: "0 4px 14px rgba(160, 30, 30, 0.08)",
            }}
          >
            <strong
              style={{
                display: "block",
                fontSize: 17,
                marginBottom: 7,
              }}
            >
              {titoloErrore(errore)}
            </strong>
            {errore}
          </div>
        )}

        {messaggio && (
          <div
            role="status"
            aria-live="polite"
            style={{
              margin: "18px 0",
              padding: 16,
              border: "1px solid #39845a",
              borderRadius: 12,
              background: "#effaf2",
              color: "#21643a",
              fontWeight: 700,
            }}
          >
            ✓ {messaggio}
          </div>
        )}

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
            onChange={(e) => {
              setTitolo(e.target.value);
              setErrore("");
            }}
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
              setErrore("");
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
              onChange={(e) => {
                setIstruttoreId(e.target.value);
                setErrore("");
              }}
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
              <label style={labelStyle}>
                Istruttori esterni già registrati
              </label>
              <select
                style={inputStyle}
                value={esternoId}
                onChange={(e) => {
                  setEsternoId(e.target.value);
                  setNomeEsterno("");
                  setCognomeEsterno("");
                  setErrore("");
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
                    onChange={(e) => {
                      setNomeEsterno(e.target.value);
                      setErrore("");
                    }}
                    placeholder="Nome"
                    disabled={!isMaestro || salvando}
                  />
                  <label style={labelStyle}>Cognome istruttore esterno</label>
                  <input
                    style={inputStyle}
                    value={cognomeEsterno}
                    onChange={(e) => {
                      setCognomeEsterno(e.target.value);
                      setErrore("");
                    }}
                    placeholder="Cognome"
                    disabled={!isMaestro || salvando}
                  />
                </>
              )}
            </>
          )}

          <label style={labelStyle}>Campo obbligatorio</label>
          <select
            style={inputStyle}
            value={campoId}
            onChange={(e) => {
              setCampoId(e.target.value);
              setErrore("");
            }}
            disabled={!isMaestro || salvando}
          >
            <option value="">Seleziona un campo disponibile</option>
            {campi.map((campo) => (
              <option key={campo.id} value={campo.id}>
                {campo.name} · {campo.sport}
              </option>
            ))}
          </select>

          <div className="courts-stats" style={{ marginTop: 12 }}>
            <div>
              <label style={labelStyle}>Data della lezione</label>

              <button
                type="button"
                onClick={() => setCalendarioAperto(!calendarioAperto)}
                disabled={!isMaestro || salvando}
                style={{
                  ...inputStyle,
                  marginTop: 7,
                  textAlign: "left",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  cursor: "pointer",
                  minHeight: 48,
                }}
              >
                <span>{dataVisualizzata}</span>
                <span>📅</span>
              </button>

              {calendarioAperto && (
                <div
                  style={{
                    marginTop: 8,
                    padding: 14,
                    background: "#ffffff",
                    border: "1px solid #dfd1c1",
                    borderRadius: 12,
                    boxShadow: "0 8px 24px rgba(50,30,20,0.12)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 14,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => cambiaMese(-1)}
                      aria-label="Mese precedente"
                      style={{
                        padding: 8,
                        border: 0,
                        background: "transparent",
                        color: "#762326",
                        fontSize: 24,
                        cursor: "pointer",
                      }}
                    >
                      ‹
                    </button>

                    <strong
                      style={{
                        color: "#762326",
                        textTransform: "capitalize",
                      }}
                    >
                      {meseCalendario.toLocaleDateString("it-IT", {
                        month: "long",
                        year: "numeric",
                      })}
                    </strong>

                    <button
                      type="button"
                      onClick={() => cambiaMese(1)}
                      aria-label="Mese successivo"
                      style={{
                        padding: 8,
                        border: 0,
                        background: "transparent",
                        color: "#762326",
                        fontSize: 24,
                        cursor: "pointer",
                      }}
                    >
                      ›
                    </button>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                      gap: 4,
                      textAlign: "center",
                      marginBottom: 6,
                    }}
                  >
                    {["L", "M", "M", "G", "V", "S", "D"].map(
                      (giorno, i) => (
                        <strong
                          key={i}
                          style={{
                            color: "#806b60",
                            fontSize: 12,
                            padding: 5,
                          }}
                        >
                          {giorno}
                        </strong>
                      )
                    )}

                    {Array.from({ length: spaziIniziali }).map((_, i) => (
                      <span key={`vuoto-${i}`} />
                    ))}

                    {Array.from(
                      { length: giorniNelMese },
                      (_, i) => i + 1
                    ).map((giorno) => {
                      const anno = meseCalendario.getFullYear();
                      const mese = String(
                        meseCalendario.getMonth() + 1
                      ).padStart(2, "0");
                      const giornoFormattato = String(giorno).padStart(
                        2,
                        "0"
                      );
                      const valore = `${anno}-${mese}-${giornoFormattato}`;
                      const selezionato = dataLezione === valore;

                      return (
                        <button
                          key={valore}
                          type="button"
                          onClick={() => selezionaData(giorno)}
                          style={{
                            minWidth: 0,
                            minHeight: 38,
                            padding: 2,
                            border: selezionato
                              ? "1px solid #762326"
                              : "1px solid transparent",
                            borderRadius: 8,
                            background: selezionato
                              ? "#762326"
                              : "#fffaf5",
                            color: selezionato ? "#ffffff" : "#302b29",
                            fontWeight: selezionato ? 700 : 500,
                            cursor: "pointer",
                            fontSize: 14,
                          }}
                        >
                          {giorno}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={selezionaOggi}
                    style={{
                      width: "100%",
                      marginTop: 10,
                      padding: 10,
                      border: "1px solid #dfd1c1",
                      borderRadius: 8,
                      background: "#fffaf5",
                      color: "#762326",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Oggi
                  </button>
                </div>
              )}
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

          <label style={labelStyle}>
            Allievi (un nome e cognome per riga)
          </label>
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
            {salvando ? "Verifica e salvataggio..." : "Registra lezione"}
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
                      : "Programmata"}
                </span>
              </div>

              <h3>{lezione.title}</h3>
              <p>
                {lezione.lesson_type === "group"
                  ? "Lezione di gruppo"
                  : "Lezione individuale"}
              </p>
              <p>
                <strong>Istruttore:</strong> {nomeIstruttore(lezione)}
              </p>
              <p>
                <strong>Campo:</strong> {nomeCampo(lezione.court_id)}
              </p>
              <p>
                <strong>Data:</strong>{" "}
                {new Date(
                  lezione.lesson_date + "T00:00:00"
                ).toLocaleDateString("it-IT")}
              </p>
              <p>
                <strong>Ora:</strong> {lezione.start_time.slice(0, 5)}
              </p>
              <p>
                <strong>Durata:</strong> {lezione.duration_minutes} minuti
              </p>
              <p>
                <strong>Prezzo:</strong> €{" "}
                {Number(lezione.price).toFixed(2)}
              </p>
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
