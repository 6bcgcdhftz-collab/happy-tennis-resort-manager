"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";

const moduli = [
  { nome: "Gestione campi", icona: "🎾", percorso: "/campi", attivo: true },
  { nome: "Manutenzione", icona: "🔧", percorso: "/manutenzione", attivo: true },
  { nome: "Inventario", icona: "📦", attivo: false },
  { nome: "Manutenzione materiale", icona: "🛠️", attivo: false },
  { nome: "Lezioni e maestri", icona: "🎓", attivo: false },
  { nome: "Prenotazioni e affitti", icona: "📅", attivo: false },
  { nome: "Tornei", icona: "🏆", attivo: false },
  { nome: "Eventi", icona: "⭐", attivo: false },
  { nome: "Contabilità", icona: "💶", attivo: false },
  { nome: "Gestione turisti", icona: "👥", attivo: false },
  { nome: "Documenti contrattuali", icona: "📄", attivo: false },
];

type ResortOption = {
  id: string;
  name: string;
};

export default function Dashboard() {
  const [email, setEmail] = useState("");
  const [resorts, setResorts] = useState<ResortOption[]>([]);
  const [selectedResortId, setSelectedResortId] = useState("");
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [totalCourts, setTotalCourts] = useState(0);
  const [activeCourts, setActiveCourts] = useState(0);
  const [maintenanceCourts, setMaintenanceCourts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);

    window.addEventListener("online", online);
    window.addEventListener("offline", offline);

    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, []);

  useEffect(() => {
    const run = async () => {
      const supabase = getSupabase();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/";
        return;
      }

      setEmail(user.email ?? "");

      const { data: adminData } = await supabase
        .from("platform_admins")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      setIsPlatformAdmin(!!adminData);

      const { data, error } = await supabase
        .from("resort_memberships")
        .select("resort_id, resorts(name)")
        .eq("user_id", user.id)
        .eq("is_active", true);

      if (error || !data || data.length === 0) {
        window.location.href = "/setup";
        return;
      }

      const options = data.map((item) => {
        const joined = item.resorts as unknown as
          | { name: string }
          | { name: string }[]
          | null;

        const resortData = Array.isArray(joined)
          ? joined[0]
          : joined;

        return {
          id: item.resort_id,
          name: resortData?.name ?? "Resort",
        };
      });

      setResorts(options);

      const resortNellIndirizzo = new URLSearchParams(
        window.location.search
      ).get("resort");

      const resortSalvato = localStorage.getItem(
        "happy-tennis-resort"
      );

      const resortPredefinito = options.find(
        (item) => item.name.toLowerCase() === "mare e sole"
      );

      const resortDaAprire =
        options.find(
          (item) => item.id === resortNellIndirizzo
        ) ??
        options.find(
          (item) => item.id === resortSalvato
        ) ??
        resortPredefinito ??
        options[0];

      setSelectedResortId(resortDaAprire.id);

      localStorage.setItem(
        "happy-tennis-resort",
        resortDaAprire.id
      );

      setLoading(false);
    };

    run();
  }, []);

  useEffect(() => {
    if (!selectedResortId) return;

    const caricaCampi = async () => {
      const supabase = getSupabase();

      const { data, error } = await supabase
        .from("sport_courts")
        .select("id, status")
        .eq("resort_id", selectedResortId);

      if (error || !data) return;

      setTotalCourts(data.length);

      setActiveCourts(
        data.filter((court) => court.status === "active").length
      );

      setMaintenanceCourts(
        data.filter((court) => court.status === "maintenance").length
      );
    };

    caricaCampi();
  }, [selectedResortId]);

  async function logout() {
    const supabase = getSupabase();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  function cambiaResort(nuovoResortId: string) {
    setSelectedResortId(nuovoResortId);

    localStorage.setItem(
      "happy-tennis-resort",
      nuovoResortId
    );

    window.history.replaceState(
      null,
      "",
      `/dashboard?resort=${encodeURIComponent(nuovoResortId)}`
    );
  }

  function apriModulo(percorso: string) {
    if (!selectedResortId) return;

    window.location.href =
      `${percorso}?resort=${encodeURIComponent(selectedResortId)}`;
  }

  const selectedResort = resorts.find(
    (item) => item.id === selectedResortId
  );

  return (
    <main className="home-dashboard">
      <aside className="dashboard-sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-ball">🎾</div>
          <strong>Happy Tennis</strong>
          <span>RESORT MANAGER</span>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-label">MENU PRINCIPALE</div>

          <a
            className="sidebar-link selected"
            href={
              selectedResortId
                ? `/dashboard?resort=${encodeURIComponent(selectedResortId)}`
                : "/dashboard"
            }
          >
            <span>⌂</span> Dashboard
          </a>

          {moduli.map((modulo) => (
            <button
              key={modulo.nome}
              className={`sidebar-link ${!modulo.attivo ? "disabled" : ""}`}
              disabled={!modulo.attivo}
              onClick={() => {
                if (modulo.attivo && modulo.percorso) {
                  apriModulo(modulo.percorso);
                }
              }}
            >
              <span>{modulo.icona}</span>
              {modulo.nome}
              {!modulo.attivo && <small>Presto</small>}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className={`connection-status ${isOnline ? "online" : "offline"}`}>
            <span className="connection-dot" />
            {isOnline ? "Online" : "Offline"}
          </div>

          <p>
            {isOnline
              ? "Connessione disponibile"
              : "Connessione assente. La modalità offline completa è in sviluppo."}
          </p>

          <div className="sidebar-version">
            Happy Tennis Resort Manager
          </div>
        </div>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-topbar">
          <div>
            <span className="topbar-eyebrow">AMBIENTE OPERATIVO</span>
            <strong>
              {selectedResort?.name ?? "Caricamento resort..."}
            </strong>
          </div>

          <div className="topbar-actions">
            {isPlatformAdmin && (
              <button
                className="admin-button"
                onClick={() => {
                  window.location.href = "/admin";
                }}
              >
                ⚙ Amministrazione generale
              </button>
            )}

            <button className="logout-button" onClick={logout}>
              Esci ↗
            </button>
          </div>
        </header>

        <div className="dashboard-content">
          <section className="dashboard-welcome">
            <div>
              <span className="welcome-eyebrow">
                BENVENUTO IN HAPPY TENNIS
              </span>

              <h1>Il tuo resort, sotto controllo.</h1>

              <p>
                Tutte le attività sportive e operative in un unico spazio.
              </p>

              <span className="welcome-email">{email}</span>
            </div>

            <div className="resort-selector-box">
              <label htmlFor="resort-selector">
                RESORT ATTIVO
              </label>

              <select
                id="resort-selector"
                value={selectedResortId}
                onChange={(event) =>
                  cambiaResort(event.target.value)
                }
              >
                {resorts.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
          </section>

          <section className="dashboard-stats">
            <article className="stat-card stat-red">
              <span className="stat-icon">🎾</span>
              <div>
                <strong>{loading ? "—" : totalCourts}</strong>
                <span>Campi registrati</span>
              </div>
            </article>

            <article className="stat-card stat-green">
              <span className="stat-icon">✓</span>
              <div>
                <strong>{loading ? "—" : activeCourts}</strong>
                <span>Campi attivi</span>
              </div>
            </article>

            <article className="stat-card stat-gold">
              <span className="stat-icon">🔧</span>
              <div>
                <strong>{loading ? "—" : maintenanceCourts}</strong>
                <span>Campi in manutenzione</span>
              </div>
            </article>
          </section>

          <section className="modules-heading">
            <div>
              <span className="welcome-eyebrow">ORGANIZZAZIONE</span>
              <h2>Moduli del resort</h2>
              <p>
                Seleziona un'area per accedere alle sue funzioni.
              </p>
            </div>
          </section>

          <section className="dashboard-module-grid">
            {moduli.map((modulo, index) => (
              <button
                key={modulo.nome}
                className={`dashboard-module-card ${
                  modulo.attivo ? "module-active" : "module-disabled"
                }`}
                disabled={!modulo.attivo}
                onClick={() => {
                  if (modulo.attivo && modulo.percorso) {
                    apriModulo(modulo.percorso);
                  }
                }}
              >
                <span className="module-number">
                  {String(index + 1).padStart(2, "0")}
                </span>

                <span className="module-icon">{modulo.icona}</span>

                <span className="module-name">{modulo.nome}</span>

                <span className="module-description">
                  {modulo.attivo
                    ? "Apri sezione"
                    : "Modulo in preparazione"}
                </span>

                <span className="module-arrow">
                  {modulo.attivo ? "→" : "•"}
                </span>
              </button>
            ))}
          </section>

          <footer className="dashboard-footer">
            <span>HAPPY TENNIS RESORT MANAGER</span>
            <span>Gestione professionale del tuo resort</span>
          </footer>
        </div>
      </section>
    </main>
  );
}
