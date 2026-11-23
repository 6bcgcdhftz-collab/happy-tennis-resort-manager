
"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

type Campo = {
  id: string;
  name: string;
  sport: string;
  status: string;
};

type Attivita = {
  id: string;
  court_id: string;
  source_type: string;
  source_id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  titolo: string;
};

type Giorno = {
  data: Date;
  chiave: string;
};

const COLORI: Record<string, string> = {
  lesson: "#963e50",
  maintenance: "#65a33b",
};

const NOMI_SPORT: Record<string, string> = {
  tennis: "Tennis",
  padel: "Padel",
  pickleball: "Pickleball",
};

function chiaveData(data: Date) {
  return [
    data.getFullYear(),
    String(data.getMonth() + 1).padStart(2, "0"),
    String(data.getDate()).padStart(2, "0"),
  ].join("-");
}

function inizioSettimana(data: Date) {
  const risultato = new Date(data);
  const giorno = risultato.getDay();
  risultato.setDate(risultato.getDate() - (giorno === 0 ? 6 : giorno - 1));
  risultato.setHours(0, 0, 0, 0);
  return risultato;
}

function aggiungiGiorni(data: Date, giorni: number) {
  const risultato = new Date(data);
  risultato.setDate(risultato.getDate() + giorni);
  return risultato;
}

function ora(data: string) {
  return new Date(data).toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function etichettaGiorno(data: Date) {
  return data.toLocaleDateString("it-IT", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function titoloSettimana(data: Date) {
  const fine = aggiungiGiorni(data, 6);
  const inizioTesto = data.toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
  });
  const fineTesto = fine.toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return `${inizioTesto} – ${fineTesto}`;
}

function CalendarioContent() {
  const searchParams = useSearchParams();
  const resortRichiesto = searchParams.get("resort");

  const [resortId, setResortId] = useState("");
  const [resortNome, setResortNome] = useState("");
  const [campi, setCampi] = useState<Campo[]>([]);
  const [attivita, setAttivita] = useState<Attivita[]>([]);
  const [vista, setVista] = useState<"giorno" | "settimana">("giorno");
  const [sportFiltro, setSportFiltro] = useState("tutti");
  const [dataSelezionata, setDataSelezionata] = useState(
    chiaveData(new Date())
  );
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState("");

  const dataCorrente = useMemo(
    () => new Date(`${dataSelezionata}T12:00:00`),
    [dataSelezionata]
  );

  const lunedi = useMemo(
    () => inizioSettimana(dataCorrente),
    [dataCorrente]
  );

  const giorni: Giorno[] = useMemo(
    () =>
      Array.from({ length: 7 }, (_, indice) => {
        const data = aggiungiGiorni(lunedi, indice);
        return { data, chiave: chiaveData(data) };
      }),
    [lunedi]
  );

  async function caricaDati() {
    setLoading(true);
    setErrore("");

    const supabase = getSupabase();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      window.location.href = "/";
      return;
    }

    const { data: memberships, error: membershipError } = await supabase
      .from("resort_memberships")
      .select("resort_id, resorts(name)")
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

    const { data: campiData, error: campiError } = await supabase
      .from("sport_courts")
      .select("id, name, sport, status")
      .eq("resort_id", membership.resort_id)
      .order("name");

    if (campiError) {
      setErrore("Errore nel caricamento dei campi: " + campiError.message);
      setLoading(false);
      return;
    }

    setCampi(campiData || []);

    const inizio = inizioSettimana(new Date(`${dataSelezionata}T12:00:00`));
    const fine = aggiungiGiorni(inizio, 7);
    const inizioISO = inizio.toISOString();
    const fineISO = fine.toISOString();

    const { data: prenotazioni, error: prenotazioniError } = await supabase
      .from("court_reservations")
      .select(
        "id, court_id, source_type, source_id, starts_at, ends_at, status"
      )
      .eq("resort_id", membership.resort_id)
      .in("status", [
        "scheduled",
        "confirmed",
        "open",
        "in_progress",
        "maintenance",
      ])
      .lt("starts_at", fineISO)
      .gt("ends_at", inizioISO)
      .order("starts_at");

    if (prenotazioniError) {
      setErrore(
        "Errore nel caricamento del calendario: " +
          prenotazioniError.message
      );
      setLoading(false);
      return;
    }

    const righe = prenotazioni || [];
    const idLezioni = righe
      .filter((item) => item.source_type === "lesson")
      .map((item) => item.source_id);

    const idManutenzioni = righe
      .filter((item) => item.source_type === "maintenance")
      .map((item) => item.source_id);

    const [lezioniData, manutenzioniData] = await Promise.all([
      idLezioni.length
        ? supabase
            .from("sports_lessons")
            .select("id, title")
            .in("id", idLezioni)
        : Promise.resolve({ data: [], error: null }),

      idManutenzioni.length
        ? supabase
            .from("court_maintenance")
            .select("id, title")
            .in("id", idManutenzioni)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (lezioniData.error || manutenzioniData.error) {
      setErrore(
        "Le attività sono state lette, ma non è stato possibile caricare tutti i dettagli."
      );
      setLoading(false);
      return;
    }

    const nuoveAttivita: Attivita[] = righe.map((item) => {
      const lezione = lezioniData.data?.find(
        (elemento) => elemento.id === item.source_id
      );
      const manutenzione = manutenzioniData.data?.find(
        (elemento) => elemento.id === item.source_id
      );

      let titolo = "Attività";

      if (item.source_type === "lesson") {
        titolo = lezione?.title || "Lezione";
      } else if (item.source_type === "maintenance") {
        titolo = manutenzione?.title || "Manutenzione";
      }

      return {
        ...item,
        titolo,
      };
    });

    setAttivita(nuoveAttivita);
    setLoading(false);
  }

  useEffect(() => {
    caricaDati();
  }, [resortRichiesto, dataSelezionata]);

  const campiVisibili = useMemo(
    () =>
      campi.filter(
        (campo) =>
          sportFiltro === "tutti" ||
          campo.sport.toLowerCase() === sportFiltro
      ),
    [campi, sportFiltro]
  );

  const attivitaVisibili = useMemo(
    () =>
      attivita.filter((elemento) =>
        campiVisibili.some((campo) => campo.id === elemento.court_id)
      ),
    [attivita, campiVisibili]
  );

  const attivitaDelGiorno = useMemo(
    () =>
      attivitaVisibili.filter(
        (elemento) =>
          chiaveData(new Date(elemento.starts_at)) === dataSelezionata
      ),
    [attivitaVisibili, dataSelezionata]
  );

  const lezioniCount = attivitaDelGiorno.filter(
    (item) => item.source_type === "lesson"
  ).length;

  const manutenzioniCount = attivitaDelGiorno.filter(
    (item) => item.source_type === "maintenance"
  ).length;

  function cambiaGiorno(differenza: number) {
    const nuovaData = aggiungiGiorni(dataCorrente, differenza);
    setDataSelezionata(chiaveData(nuovaData));
  }

  function vaiASettimana(differenza: number) {
    const nuovaData = aggiungiGiorni(dataCorrente, differenza * 7);
    setDataSelezionata(chiaveData(nuovaData));
  }

  function tornaOggi() {
    setDataSelezionata(chiaveData(new Date()));
  }

  function nomeCampo(courtId: string) {
    return campi.find((campo) => campo.id === courtId)?.name || "Campo";
  }

  function attivitaCampo(courtId: string, giorno?: string) {
    return attivitaVisibili.filter((item) => {
      if (item.court_id !== courtId) return false;
      if (!giorno) return true;
      return chiaveData(new Date(item.starts_at)) === giorno;
    });
  }

  function stileBlocco(item: Attivita) {
    const colore =
      COLORI[item.source_type] || "#477eae";

    return {
      background: colore,
      color: "white",
      borderRadius: 7,
      padding: "7px 5px",
      fontSize: 11,
      lineHeight: 1.35,
      minWidth: 0,
      overflow: "hidden" as const,
      border: "1px solid rgba(255,255,255,.35)",
    };
  }

  function renderAttivita(item: Attivita) {
    return (
      <div
        key={item.id}
        style={{
          ...stileBlocco(item),
          marginBottom: 6,
        }}
      >
        <strong>
          {ora(item.starts_at)} – {ora(item.ends_at)}
        </strong>
        <div>{item.titolo}</div>
        <small>
          {item.source_type === "lesson" ? "Lezione" : "Manutenzione"}
        </small>
      </div>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#fcf8f3",
        color: "#332723",
        padding: "22px",
      }}
    >
      <header
        style={{
          background:
            "linear-gradient(110deg, #591923, #8d3546 60%, #b56b52)",
          color: "white",
          borderRadius: 17,
          padding: "25px 28px",
          marginBottom: 20,
          boxShadow: "0 8px 24px rgba(76,28,32,.15)",
        }}
      >
        <div style={{ fontSize: 13, letterSpacing: 2 }}>
          HAPPY TENNIS · RESORT MANAGER
        </div>
        <h1 style={{ fontSize: 32, margin: "10px 0 4px" }}>
          Calendario campi
        </h1>
        <p style={{ margin: 0, opacity: 0.9 }}>
          Pianificazione delle attività · {resortNome || "Resort"}
        </p>
      </header>

      <button
        onClick={() => {
          window.location.href = resortId
            ? `/dashboard?resort=${encodeURIComponent(resortId)}`
            : "/dashboard";
        }}
        style={bottoneSecondario}
      >
        ← Torna alla Dashboard
      </button>

      <section
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "end",
          gap: 16,
          flexWrap: "wrap",
          margin: "24px 0 18px",
        }}
      >
        <div>
          <div style={occhiello}>PIANIFICAZIONE SPORTIVA</div>
          <h2 style={{ color: "#641f2a", margin: "5px 0" }}>
            {vista === "giorno" ? "Programma giornaliero" : "Programma settimanale"}
          </h2>
          <p style={{ margin: 0, color: "#6b625d" }}>
            Consulta le attività registrate sui campi del resort.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <label style={etichetta}>
            Sport
            <select
              value={sportFiltro}
              onChange={(e) => setSportFiltro(e.target.value)}
              style={selectStyle}
            >
              <option value="tutti">Tutti gli sport</option>
              <option value="tennis">Tennis</option>
              <option value="padel">Padel</option>
              <option value="pickleball">Pickleball</option>
            </select>
          </label>

          <label style={etichetta}>
            Vista
            <select
              value={vista}
              onChange={(e) =>
                setVista(e.target.value as "giorno" | "settimana")
              }
              style={selectStyle}
            >
              <option value="giorno">Giornaliera</option>
              <option value="settimana">Settimanale</option>
            </select>
          </label>
        </div>
      </section>

      <section
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
          background: "white",
          border: "1px solid #eaded2",
          borderRadius: 13,
          padding: 13,
          marginBottom: 18,
        }}
      >
        <button
          style={bottoneFreccia}
          onClick={() =>
            vista === "giorno" ? cambiaGiorno(-1) : vaiASettimana(-1)
          }
        >
          ‹
        </button>

        <strong style={{ color: "#67232e", fontSize: 17 }}>
          {vista === "giorno"
            ? dataCorrente.toLocaleDateString("it-IT", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })
            : titoloSettimana(lunedi)}
        </strong>

        <div style={{ display: "flex", gap: 8 }}>
          <button style={bottoneSecondario} onClick={tornaOggi}>
            Oggi
          </button>
          <button
            style={bottoneFreccia}
            onClick={() =>
              vista === "giorno" ? cambiaGiorno(1) : vaiASettimana(1)
            }
          >
            ›
          </button>
        </div>
      </section>

      <div
        style={{
          display: "flex",
          gap: 18,
          flexWrap: "wrap",
          marginBottom: 16,
          fontSize: 13,
        }}
      >
        <span><i style={pallino("#963e50")} /> Lezione</span>
        <span><i style={pallino("#477eae")} /> Affitto / occupazione</span>
        <span><i style={pallino("#65a33b")} /> Manutenzione</span>
        <span><i style={pallino("#fff")} /> Disponibile</span>
      </div>

      {errore && (
        <div style={erroreStyle}>
          {errore}
        </div>
      )}

      {loading ? (
        <div style={pannello}>Caricamento calendario...</div>
      ) : vista === "giorno" ? (
        <section style={pannello}>
          {campiVisibili.length === 0 ? (
            <p>Non ci sono campi registrati per questo sport.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <div
                style={{
                  minWidth: 900,
                  display: "grid",
                  gridTemplateColumns: "155px repeat(14, minmax(48px, 1fr))",
                }}
              >
                <div style={intestazione}>Campo</div>
                {Array.from({ length: 14 }, (_, indice) => (
                  <div key={indice} style={intestazioneOra}>
                    {String(indice + 8).padStart(2, "0")}:00
                  </div>
                ))}

                {campiVisibili.map((campo) => (
                  <div
                    key={campo.id}
                    style={{
                      display: "contents",
                    }}
                  >
                    <div style={cellaCampo}>
                      <strong>{campo.name}</strong>
                      <small>{NOMI_SPORT[campo.sport.toLowerCase()] || campo.sport}</small>
                      {campo.status === "maintenance" && (
                        <small style={{ color: "#65a33b" }}>In manutenzione</small>
                      )}
                    </div>

                    <div
                      style={{
                        gridColumn: "span 14",
                        borderBottom: "1px solid #eaded2",
                        padding: 6,
                        minHeight: 68,
                        display: "grid",
                        gridTemplateColumns: "repeat(14, minmax(48px, 1fr))",
                        backgroundImage:
                          "linear-gradient(to right, #eaded2 1px, transparent 1px)",
                        backgroundSize: "calc(100% / 14) 100%",
                      }}
                    >
                      <div
                        style={{
                          gridColumn: "1 / -1",
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 6,
                        }}
                      >
                        {attivitaCampo(campo.id)
                          .filter(
                            (item) =>
                              chiaveData(new Date(item.starts_at)) ===
                              dataSelezionata
                          )
                          .map(renderAttivita)}
                      </div>
                      {attivitaCampo(campo.id).filter(
                        (item) =>
                          chiaveData(new Date(item.starts_at)) ===
                          dataSelezionata
                      ).length === 0 && (
                        <div style={{ color: "#8b817a", fontSize: 12 }}>
                          Nessuna attività registrata
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      ) : (
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          {giorni.map((giorno) => {
            const attivitaGiorno = attivitaVisibili.filter(
              (item) =>
                chiaveData(new Date(item.starts_at)) === giorno.chiave
            );

            return (
              <article
                key={giorno.chiave}
                style={{
                  ...pannello,
                  padding: 14,
                  minHeight: 180,
                }}
              >
                <h3
                  style={{
                    color: "#67232e",
                    margin: "0 0 12px",
                    textTransform: "capitalize",
                  }}
                >
                  {etichettaGiorno(giorno.data)}
                </h3>

                {attivitaGiorno.length === 0 ? (
                  <p style={{ color: "#8b817a", fontSize: 13 }}>
                    Nessuna attività registrata
                  </p>
                ) : (
                  attivitaGiorno
                    .sort(
                      (a, b) =>
                        new Date(a.starts_at).getTime() -
                        new Date(b.starts_at).getTime()
                    )
                    .map((item) => (
                      <div
                        key={item.id}
                        style={{
                          ...stileBlocco(item),
                          marginBottom: 8,
                        }}
                      >
                        <strong>
                          {ora(item.starts_at)} – {ora(item.ends_at)}
                        </strong>
                        <div>{nomeCampo(item.court_id)}</div>
                        <div>{item.titolo}</div>
                        <small>
                          {item.source_type === "lesson"
                            ? "Lezione"
                            : "Manutenzione"}
                        </small>
                      </div>
                    ))
                )}
              </article>
            );
          })}
        </section>
      )}

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
          marginTop: 20,
        }}
      >
        <div style={riassunto}>
          <strong>{lezioniCount}</strong>
          <span>Lezioni del giorno</span>
        </div>
        <div style={riassunto}>
          <strong>{manutenzioniCount}</strong>
          <span>Manutenzioni del giorno</span>
        </div>
        <div style={riassunto}>
          <strong>{campiVisibili.length}</strong>
          <span>Campi visualizzati</span>
        </div>
      </section>

      <footer
        style={{
          textAlign: "center",
          color: "#82756c",
          padding: "25px 10px",
          fontSize: 12,
        }}
      >
        HAPPY TENNIS RESORT MANAGER · {resortNome}
      </footer>
    </main>
  );
}

export default function CalendarioPage() {
  return (
    <Suspense fallback={<p>Caricamento calendario...</p>}>
      <CalendarioContent />
    </Suspense>
  );
}

const bottoneSecondario: React.CSSProperties = {
  padding: "10px 15px",
  border: "1px solid #d9c5b7",
  borderRadius: 9,
  background: "white",
  color: "#702632",
  fontWeight: 700,
  cursor: "pointer",
};

const bottoneFreccia: React.CSSProperties = {
  width: 40,
  height: 40,
  border: "1px solid #eaded2",
  borderRadius: 10,
  background: "#fffaf5",
  color: "#702632",
  fontSize: 25,
  cursor: "pointer",
};

const selectStyle: React.CSSProperties = {
  display: "block",
  minWidth: 155,
  padding: 11,
  border: "1px solid #ddcfc3",
  borderRadius: 9,
  background: "white",
  color: "#332723",
  marginTop: 6,
};

const etichetta: React.CSSProperties = {
  color: "#604c42",
  fontSize: 13,
  fontWeight: 700,
};

const occhiello: React.CSSProperties = {
  color: "#9b6c51",
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: 1.5,
};

const pannello: React.CSSProperties = {
  background: "white",
  border: "1px solid #eaded2",
  borderRadius: 14,
  padding: 18,
  boxShadow: "0 4px 14px rgba(65,40,30,.04)",
};

const intestazione: React.CSSProperties = {
  background: "#f5e9dd",
  padding: 12,
  fontWeight: 800,
  color: "#67232e",
  borderBottom: "1px solid #eaded2",
};

const intestazioneOra: React.CSSProperties = {
  background: "#f5e9dd",
  padding: "12px 3px",
  textAlign: "center",
  fontSize: 11,
  fontWeight: 800,
  color: "#67232e",
  borderBottom: "1px solid #eaded2",
  borderLeft: "1px solid #eaded2",
};

const cellaCampo: React.CSSProperties = {
  padding: 12,
  borderBottom: "1px solid #eaded2",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  gap: 4,
  color: "#382b27",
};

const riassunto: React.CSSProperties = {
  background: "white",
  border: "1px solid #eaded2",
  borderRadius: 12,
  padding: 17,
  display: "flex",
  flexDirection: "column",
  gap: 5,
};

const erroreStyle: React.CSSProperties = {
  background: "#fff0ee",
  color: "#a52b2b",
  border: "1px solid #edc4be",
  borderRadius: 10,
  padding: 14,
  marginBottom: 15,
};

function pallino(colore: string): React.CSSProperties {
  return {
    display: "inline-block",
    width: 12,
    height: 12,
    borderRadius: 3,
    background: colore,
    border: "1px solid #cfc4bb",
    marginRight: 5,
    verticalAlign: "middle",
  };
}
