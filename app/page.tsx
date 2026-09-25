"use client";

import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Check,
  ChevronDown,
  CircleGauge,
  ClipboardCheck,
  Database,
  FileText,
  Fuel,
  LayoutDashboard,
  MapPin,
  PackageCheck,
  Play,
  RefreshCcw,
  Route,
  ShieldAlert,
  Truck,
  Users,
} from "lucide-react";
import type { MissionDTO, TenantDTO } from "@/lib/missions";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";

type Stage = "draft" | "transit" | "unloading" | "completed";
type Tab = "dashboard" | "operation" | "clients";
type Mission = MissionDTO;

const initialMission: Mission = {
  id: "",
  stage: "draft",
  missionId: "SC-260925-01",
  truck: "CI-4421-AB",
  driver: "Kouamé Diabaté",
  source: "Dépôt GESTOCI — Vridi",
  destination: "Station Cocody Angré",
  product: "Gasoil",
  compartments: [6500, 6500, 6500, 6500, 6500, 6500, 6000],
  tankReceipts: [0, 0],
  alertLoss: 0,
  eventLog: [
    {
      label: "Mission créée",
      detail: "Ordre de transport affecté au camion CI-4421-AB",
      time: "08:15",
      status: "done",
    },
  ],
};

const fallbackClients: TenantDTO[] = [
  {
    name: "Pétro Ivoire Distribution",
    code: "PID-CI",
    stations: 4,
    trucks: 2,
    status: "Actif",
  },
  {
    name: "Client démonstration",
    code: "DEMO-01",
    stations: 1,
    trucks: 1,
    status: "Essai",
  },
];

const formatLiters = (value: number) =>
  `${new Intl.NumberFormat("fr-FR").format(Math.max(0, value))} L`;

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand">
      <Image
        src="/logo-sc.svg"
        alt="Logo Sud Contractors"
        width={52}
        height={44}
        priority
      />
      {!compact && (
        <div className="brand-copy">
          <strong>SUD CONTRACTORS</strong>
          <span>
            Pro<i>Fuel</i>
          </span>
        </div>
      )}
    </div>
  );
}

function StatusPill({
  tone,
  children,
}: {
  tone: "success" | "danger" | "warning" | "info";
  children: React.ReactNode;
}) {
  return <span className={`status status-${tone}`}>{children}</span>;
}

function Stepper({ stage }: { stage: Stage }) {
  const active =
    stage === "draft" ? 0 : stage === "transit" ? 1 : stage === "unloading" ? 2 : 3;
  const steps = [
    ["Chargement", "GESTOCI"],
    ["Transport", "Suivi temps réel"],
    ["Déversement", "Station"],
    ["Rapprochement", "Rapport"],
  ];

  return (
    <div className="stepper">
      {steps.map(([label, sub], index) => (
        <div className={`step ${index <= active ? "step-active" : ""}`} key={label}>
          <div className="step-dot">{index < active ? <Check size={14} /> : index + 1}</div>
          <div>
            <strong>{label}</strong>
            <span>{sub}</span>
          </div>
          {index < steps.length - 1 && <div className="step-line" />}
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [mission, setMission] = useState<Mission>(initialMission);
  const [tenantCode, setTenantCode] = useState("PID-CI");
  const [clients, setClients] = useState<TenantDTO[]>(fallbackClients);
  const [dbState, setDbState] = useState<"loading" | "online" | "offline">(
    "loading",
  );
  const [saving, setSaving] = useState(false);

  const tenantName =
    clients.find((client) => client.code === tenantCode)?.name ?? tenantCode;

  const applyMission = (next: Mission) => {
    setMission(next);
  };

  const loadTenant = useCallback(async (code: string) => {
    const health = await fetch("/api/health").then((response) => response.json());
    setDbState(health.connected ? "online" : "offline");
    const payload = await fetch(`/api/bootstrap?tenant=${code}`).then((response) =>
      response.json(),
    );
    if (payload.tenants) setClients(payload.tenants);
    if (payload.mission) applyMission(payload.mission);
    else if (health.connected) {
      const created = await fetch("/api/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant: code }),
      }).then((response) => response.json());
      if (created.mission) applyMission(created.mission);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadTenant(tenantCode);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadTenant, tenantCode]);

  const runAction = async (
    action: string,
    extra?: { litres?: number[] },
  ) => {
    if (!mission.id || dbState !== "online") return null;
    setSaving(true);
    try {
      const payload = await fetch(`/api/missions/${mission.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      }).then((response) => response.json());
      if (payload.mission) applyMission(payload.mission);
      return payload.mission as Mission | undefined;
    } finally {
      setSaving(false);
    }
  };

  const loaded = useMemo(
    () => mission.compartments.reduce((sum, value) => sum + value, 0),
    [mission.compartments],
  );
  const inTruck = loaded - mission.alertLoss;
  const unloaded = useMemo(
    () => mission.tankReceipts.reduce((sum, value) => sum + value, 0),
    [mission.tankReceipts],
  );
  const finalGap = loaded - unloaded;
  const gapPercent = loaded ? (finalGap / loaded) * 100 : 0;

  const updateCompartment = (index: number, value: number) => {
    const compartments = mission.compartments.map((amount, i) =>
      i === index ? Math.max(0, value || 0) : amount,
    );
    setMission((current) => ({ ...current, compartments }));
    void runAction("compartments", { litres: compartments });
  };

  const confirmLoading = () => {
    if (!loaded) return;
    void runAction("certify");
  };

  const simulateLoss = () => {
    if (mission.alertLoss) return;
    void runAction("simulate-loss");
  };

  const arriveAtStation = () => {
    void runAction("arrive");
  };

  const completeUnloading = () => {
    void runAction("close");
  };

  const resetMission = async () => {
    setSaving(true);
    try {
      const payload = await fetch("/api/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant: tenantCode }),
      }).then((response) => response.json());
      if (payload.mission) applyMission(payload.mission);
      setTab("operation");
    } finally {
      setSaving(false);
    }
  };

  const setReceipt = (index: number, value: number) => {
    const tankReceipts = mission.tankReceipts.map((amount, i) =>
      i === index ? Math.max(0, value || 0) : amount,
    );
    setMission((current) => ({ ...current, tankReceipts }));
    void runAction("receipts", { litres: tankReceipts });
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Logo />
        <div className="tenant-picker">
          <span>ESPACE CLIENT</span>
          <Building2 size={16} />
          <select
            value={tenantCode}
            onChange={(event) => setTenantCode(event.target.value)}
          >
            {clients.map((client) => (
              <option key={client.code} value={client.code}>
                {client.name}
              </option>
            ))}
          </select>
          <ChevronDown size={15} />
        </div>

        <nav>
          <button
            className={tab === "dashboard" ? "active" : ""}
            onClick={() => setTab("dashboard")}
          >
            <LayoutDashboard size={19} /> Vue d’ensemble
          </button>
          <button
            className={tab === "operation" ? "active" : ""}
            onClick={() => setTab("operation")}
          >
            <Route size={19} /> Workflow livraison
            {mission.stage !== "completed" && <span className="nav-dot" />}
          </button>
          <button
            className={tab === "clients" ? "active" : ""}
            onClick={() => setTab("clients")}
          >
            <Users size={19} /> Portail clients
          </button>
        </nav>

        <div className="sidebar-foot">
          <div className="live-chip">
            <span />
            {dbState === "online"
              ? "Neon connecté"
              : dbState === "loading"
                ? "Connexion Neon…"
                : "Neon hors ligne"}
            {saving ? " · sync" : ""}
          </div>
          <small>Mission persistée dans Postgres Neon via Vercel</small>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <div>
            <p className="eyebrow">PROFUEL · CONTRÔLE CARBURANT</p>
            <h1>
              {tab === "dashboard"
                ? "VUE D’ENSEMBLE"
                : tab === "operation"
                  ? "WORKFLOW LIVRAISON"
                  : "PORTAIL CLIENTS"}
            </h1>
          </div>
          <div className="topbar-actions">
            <StatusPill tone={mission.alertLoss ? "danger" : "success"}>
              {mission.alertLoss ? (
                <ShieldAlert size={14} />
              ) : (
                <CircleGauge size={14} />
              )}
              {mission.alertLoss ? "1 anomalie" : "Aucune anomalie"}
            </StatusPill>
            <div className="avatar">AK</div>
            <div className="user-copy">
              <strong>Arnaud Kouassi</strong>
              <span>Responsable opérations</span>
            </div>
          </div>
        </header>

        <div className="page-content">
          {tab === "dashboard" && (
            <Dashboard
              mission={mission}
              loaded={loaded}
              inTruck={inTruck}
              unloaded={unloaded}
              tenant={tenantName}
              openWorkflow={() => setTab("operation")}
            />
          )}

          {tab === "operation" && (
            <section className="workflow-page">
              <div className="page-intro">
                <div>
                  <p className="eyebrow">MISSION {mission.missionId}</p>
                  <h2>GESTOCI → STATION COCODY ANGRÉ</h2>
                  <p>
                    Testez le cycle complet avec ou sans anomalie. La mission est
                    sauvegardée dans ce navigateur.
                  </p>
                </div>
                <button className="button button-ghost" onClick={resetMission}>
                  <RefreshCcw size={16} /> Recommencer
                </button>
              </div>

              <Stepper stage={mission.stage} />

              {mission.stage === "draft" && (
                <LoadingStep
                  mission={mission}
                  loaded={loaded}
                  onChange={updateCompartment}
                  onConfirm={confirmLoading}
                />
              )}
              {mission.stage === "transit" && (
                <TransitStep
                  mission={mission}
                  loaded={loaded}
                  inTruck={inTruck}
                  onSimulate={simulateLoss}
                  onArrive={arriveAtStation}
                />
              )}
              {mission.stage === "unloading" && (
                <UnloadingStep
                  mission={mission}
                  inTruck={inTruck}
                  unloaded={unloaded}
                  onChange={setReceipt}
                  onComplete={completeUnloading}
                />
              )}
              {mission.stage === "completed" && (
                <ReportStep
                  mission={mission}
                  loaded={loaded}
                  inTruck={inTruck}
                  unloaded={unloaded}
                  gap={finalGap}
                  gapPercent={gapPercent}
                  onReset={resetMission}
                />
              )}
            </section>
          )}

          {tab === "clients" && <ClientsPage tenant={tenantName} clients={clients} />}
        </div>
      </main>
    </div>
  );
}

function Dashboard({
  mission,
  loaded,
  inTruck,
  unloaded,
  tenant,
  openWorkflow,
}: {
  mission: Mission;
  loaded: number;
  inTruck: number;
  unloaded: number;
  tenant: string;
  openWorkflow: () => void;
}) {
  return (
    <section>
      <div className="hero">
        <div>
          <p className="eyebrow orange">ESPACE CLIENT · {tenant}</p>
          <h2>
            MAÎTRISEZ VOS <span>OPÉRATIONS,</span>
            <br /> RÉDUISEZ VOS PERTES
          </h2>
          <p>
            Une vue unique du chargement GESTOCI jusqu’au déversement en station.
          </p>
        </div>
        <button className="button button-primary" onClick={openWorkflow}>
          <Play size={17} fill="currentColor" />
          Tester le workflow
        </button>
      </div>

      <div className="kpi-grid">
        <article className="kpi-card">
          <div className="icon-wrap orange-bg">
            <Truck size={21} />
          </div>
          <span>MISSION ACTIVE</span>
          <strong>{mission.missionId}</strong>
          <small>
            {mission.stage === "completed" ? "Terminée" : "GESTOCI → Cocody"}
          </small>
        </article>
        <article className="kpi-card">
          <div className="icon-wrap blue-bg">
            <Fuel size={21} />
          </div>
          <span>VOLUME CHARGÉ</span>
          <strong>{formatLiters(loaded)}</strong>
          <small>7 compartiments télémétrés</small>
        </article>
        <article className="kpi-card">
          <div className="icon-wrap green-bg">
            <Database size={21} />
          </div>
          <span>VOLUME SUIVI</span>
          <strong>{formatLiters(mission.stage === "completed" ? unloaded : inTruck)}</strong>
          <small>Dernière mesure synchronisée</small>
        </article>
        <article className={`kpi-card ${mission.alertLoss ? "danger-card" : ""}`}>
          <div className="icon-wrap red-bg">
            <ShieldAlert size={21} />
          </div>
          <span>ÉCART DÉTECTÉ</span>
          <strong>{formatLiters(mission.alertLoss)}</strong>
          <small>{mission.alertLoss ? "Seuil dépassé" : "Dans la tolérance"}</small>
        </article>
      </div>

      <div className="dashboard-grid">
        <article className="panel mission-card">
          <div className="panel-head">
            <div>
              <p className="eyebrow">LIVRAISON EN COURS</p>
              <h3>{mission.missionId}</h3>
            </div>
            <StatusPill tone={mission.stage === "completed" ? "success" : "info"}>
              {mission.stage === "completed" ? "Terminée" : "En suivi"}
            </StatusPill>
          </div>
          <div className="route-line">
            <div className="route-place">
              <span className="route-icon start">
                <Fuel size={18} />
              </span>
              <div>
                <small>DÉPART</small>
                <strong>GESTOCI Vridi</strong>
              </div>
            </div>
            <div className="route-track">
              <span style={{ width: mission.stage === "draft" ? "8%" : "68%" }} />
              <Truck size={18} />
            </div>
            <div className="route-place end">
              <span className="route-icon">
                <MapPin size={18} />
              </span>
              <div>
                <small>DESTINATION</small>
                <strong>Station Cocody</strong>
              </div>
            </div>
          </div>
          <div className="mission-meta">
            <div>
              <span>Camion</span>
              <strong>{mission.truck}</strong>
            </div>
            <div>
              <span>Chauffeur</span>
              <strong>{mission.driver}</strong>
            </div>
            <div>
              <span>Produit</span>
              <strong>{mission.product}</strong>
            </div>
          </div>
          <button className="inline-link" onClick={openWorkflow}>
            Ouvrir la mission <ArrowRight size={16} />
          </button>
        </article>

        <article className="panel timeline-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">JOURNAL D’OPÉRATION</p>
              <h3>Traçabilité</h3>
            </div>
          </div>
          <EventTimeline events={mission.eventLog.slice(-4)} />
        </article>
      </div>
    </section>
  );
}

function LoadingStep({
  mission,
  loaded,
  onChange,
  onConfirm,
}: {
  mission: Mission;
  loaded: number;
  onChange: (index: number, value: number) => void;
  onConfirm: () => void;
}) {
  return (
    <div className="workflow-grid">
      <article className="panel">
        <div className="section-title">
          <span className="number">01</span>
          <div>
            <p className="eyebrow">EMPOTAGE · DÉPÔT SOURCE</p>
            <h3>Enregistrer le chargement</h3>
          </div>
        </div>
        <div className="form-grid">
          <label>
            Dépôt source
            <input value={mission.source} readOnly />
          </label>
          <label>
            Produit
            <input value={mission.product} readOnly />
          </label>
          <label>
            Camion
            <input value={mission.truck} readOnly />
          </label>
          <label>
            Bon de chargement
            <input value="GESTOCI-BL-88241" readOnly />
          </label>
        </div>
        <div className="compartment-title">
          <div>
            <strong>Répartition par compartiment</strong>
            <span>Mesure initiale certifiée par l’agent de chargement</span>
          </div>
          <StatusPill tone="info">{mission.compartments.length} compartiments</StatusPill>
        </div>
        <div className="compartment-inputs">
          {mission.compartments.map((amount, index) => (
            <label key={index}>
              C{index + 1}
              <div>
                <input
                  aria-label={`Volume compartiment ${index + 1}`}
                  type="number"
                  value={amount}
                  onChange={(event) => onChange(index, Number(event.target.value))}
                />
                <span>L</span>
              </div>
            </label>
          ))}
        </div>
        <div className="action-bar">
          <div>
            <span>VOLUME TOTAL CHARGÉ</span>
            <strong>{formatLiters(loaded)}</strong>
          </div>
          <button className="button button-primary" onClick={onConfirm}>
            Certifier et démarrer <ArrowRight size={17} />
          </button>
        </div>
      </article>
      <OperationAside mission={mission} volume={loaded} />
    </div>
  );
}

function TransitStep({
  mission,
  loaded,
  inTruck,
  onSimulate,
  onArrive,
}: {
  mission: Mission;
  loaded: number;
  inTruck: number;
  onSimulate: () => void;
  onArrive: () => void;
}) {
  return (
    <div className="workflow-grid">
      <article className="panel">
        <div className="section-title">
          <span className="number">02</span>
          <div>
            <p className="eyebrow">TRANSPORT · TÉLÉMÉTRIE ACTIVE</p>
            <h3>Suivi du volume en trajet</h3>
          </div>
          <StatusPill tone={mission.alertLoss ? "danger" : "success"}>
            <span className="pulse" /> EN DIRECT
          </StatusPill>
        </div>
        <div className="map-surface">
          <div className="map-road" />
          <div className="map-origin">
            <Fuel size={18} />
            <strong>GESTOCI</strong>
          </div>
          <div className="map-truck">
            <Truck size={21} />
            <span>{mission.truck}</span>
          </div>
          <div className="map-destination">
            <MapPin size={18} />
            <strong>COCODY</strong>
          </div>
          {mission.alertLoss > 0 && (
            <div className="map-alert">
              <AlertTriangle size={17} />
              <strong>−{mission.alertLoss} L</strong>
              <span>km 42 · hors zone</span>
            </div>
          )}
        </div>

        <div className="tank-visual">
          {mission.compartments.map((amount, index) => {
            const loss = index === 2 ? mission.alertLoss : 0;
            const current = amount - loss;
            return (
              <div className={`tank ${loss ? "tank-alert" : ""}`} key={index}>
                <div
                  className="tank-fill"
                  style={{ height: `${Math.max(14, (current / 7000) * 100)}%` }}
                />
                <span>C{index + 1}</span>
                <strong>{new Intl.NumberFormat("fr-FR").format(current)}</strong>
              </div>
            );
          })}
        </div>

        {mission.alertLoss ? (
          <div className="alert-banner">
            <ShieldAlert size={22} />
            <div>
              <strong>Variation suspecte détectée</strong>
              <span>
                Baisse de {formatLiters(mission.alertLoss)} sur le compartiment 3,
                corrélée à un arrêt hors zone autorisée.
              </span>
            </div>
          </div>
        ) : (
          <div className="safe-banner">
            <Check size={20} />
            Intégrité du chargement confirmée depuis le départ.
          </div>
        )}

        <div className="action-bar">
          <div>
            <span>VOLUME ACTUEL</span>
            <strong>{formatLiters(inTruck)}</strong>
            <small>Chargé : {formatLiters(loaded)}</small>
          </div>
          <div className="button-row">
            <button
              className="button button-danger-outline"
              onClick={onSimulate}
              disabled={Boolean(mission.alertLoss)}
            >
              <ShieldAlert size={16} />
              Simuler une perte
            </button>
            <button className="button button-primary" onClick={onArrive}>
              Confirmer l’arrivée <ArrowRight size={17} />
            </button>
          </div>
        </div>
      </article>
      <OperationAside mission={mission} volume={inTruck} />
    </div>
  );
}

function UnloadingStep({
  mission,
  inTruck,
  unloaded,
  onChange,
  onComplete,
}: {
  mission: Mission;
  inTruck: number;
  unloaded: number;
  onChange: (index: number, value: number) => void;
  onComplete: () => void;
}) {
  const difference = inTruck - unloaded;
  return (
    <div className="workflow-grid">
      <article className="panel">
        <div className="section-title">
          <span className="number">03</span>
          <div>
            <p className="eyebrow">DÉPOTAGE · STATION DESTINATION</p>
            <h3>Enregistrer le déversement</h3>
          </div>
        </div>
        <div className="arrival-summary">
          <div>
            <span>Mesure camion à l’arrivée</span>
            <strong>{formatLiters(inTruck)}</strong>
          </div>
          <ArrowRight size={20} />
          <div>
            <span>Destination</span>
            <strong>{mission.destination}</strong>
          </div>
        </div>
        <div className="receiving-tanks">
          {mission.tankReceipts.map((amount, index) => (
            <label key={index}>
              <div className="receiving-head">
                <span className="tank-icon">
                  <Database size={20} />
                </span>
                <div>
                  <strong>Cuve {index + 1} · {mission.product}</strong>
                  <span>Capacité 30 000 L</span>
                </div>
              </div>
              <div className="receipt-input">
                <input
                  aria-label={`Volume reçu cuve ${index + 1}`}
                  type="number"
                  value={amount}
                  onChange={(event) => onChange(index, Number(event.target.value))}
                />
                <span>litres reçus</span>
              </div>
            </label>
          ))}
        </div>
        <div className={`balance ${Math.abs(difference) > 100 ? "balance-alert" : ""}`}>
          <div>
            <span>TOTAL DÉVERSÉ</span>
            <strong>{formatLiters(unloaded)}</strong>
          </div>
          <div>
            <span>ÉCART DÉPOTAGE</span>
            <strong>{formatLiters(Math.abs(difference))}</strong>
          </div>
          <StatusPill tone={Math.abs(difference) <= 100 ? "success" : "warning"}>
            {Math.abs(difference) <= 100 ? "Conforme" : "À contrôler"}
          </StatusPill>
        </div>
        <div className="action-bar align-end">
          <button className="button button-primary" onClick={onComplete}>
            <PackageCheck size={17} />
            Clôturer le déversement
          </button>
        </div>
      </article>
      <OperationAside mission={mission} volume={inTruck} />
    </div>
  );
}

function ReportStep({
  mission,
  loaded,
  inTruck,
  unloaded,
  gap,
  gapPercent,
  onReset,
}: {
  mission: Mission;
  loaded: number;
  inTruck: number;
  unloaded: number;
  gap: number;
  gapPercent: number;
  onReset: () => void;
}) {
  const conform = Math.abs(gapPercent) <= 0.5;
  return (
    <div className="report-layout">
      <article className="panel report-panel">
        <div className={`report-result ${conform ? "result-ok" : "result-alert"}`}>
          <span className="result-icon">
            {conform ? <ClipboardCheck size={34} /> : <ShieldAlert size={34} />}
          </span>
          <div>
            <p className="eyebrow">RAPPROCHEMENT AUTOMATIQUE</p>
            <h3>{conform ? "MISSION CONFORME" : "ÉCART À INVESTIGUER"}</h3>
            <p>
              {conform
                ? "Les volumes chargés et déversés respectent la tolérance."
                : "L’écart dépasse le seuil de tolérance fixé à 0,5 %."}
            </p>
          </div>
          <StatusPill tone={conform ? "success" : "danger"}>
            {gapPercent.toFixed(2)} %
          </StatusPill>
        </div>
        <div className="reconciliation">
          <div>
            <span>GESTOCI</span>
            <strong>{formatLiters(loaded)}</strong>
            <small>Bon de chargement</small>
          </div>
          <ArrowRight size={20} />
          <div>
            <span>ARRIVÉE STATION</span>
            <strong>{formatLiters(inTruck)}</strong>
            <small>Mesure camion</small>
          </div>
          <ArrowRight size={20} />
          <div>
            <span>CUVES</span>
            <strong>{formatLiters(unloaded)}</strong>
            <small>Volume déversé</small>
          </div>
        </div>
        <div className="report-metrics">
          <div>
            <span>Écart trajet</span>
            <strong className={mission.alertLoss ? "text-danger" : ""}>
              {formatLiters(mission.alertLoss)}
            </strong>
          </div>
          <div>
            <span>Écart déversement</span>
            <strong>{formatLiters(inTruck - unloaded)}</strong>
          </div>
          <div>
            <span>Écart total</span>
            <strong className={gap ? "text-danger" : ""}>{formatLiters(gap)}</strong>
          </div>
        </div>
        <div className="report-actions">
          <button className="button button-secondary">
            <FileText size={17} /> Exporter le rapport
          </button>
          <button className="button button-primary" onClick={onReset}>
            Nouvelle mission <ArrowRight size={17} />
          </button>
        </div>
      </article>
      <article className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">PREUVE D’OPÉRATION</p>
            <h3>Journal horodaté</h3>
          </div>
        </div>
        <EventTimeline events={mission.eventLog} />
      </article>
    </div>
  );
}

function OperationAside({
  mission,
  volume,
}: {
  mission: Mission;
  volume: number;
}) {
  return (
    <aside className="operation-aside">
      <article className="panel identity-card">
        <p className="eyebrow">AFFECTATION</p>
        <div className="truck-badge">
          <Truck size={26} />
        </div>
        <h3>{mission.truck}</h3>
        <span>{mission.driver}</span>
        <div className="identity-stats">
          <div>
            <small>Produit</small>
            <strong>{mission.product}</strong>
          </div>
          <div>
            <small>Volume suivi</small>
            <strong>{formatLiters(volume)}</strong>
          </div>
        </div>
      </article>
      <article className="panel timeline-panel">
        <p className="eyebrow">JOURNAL LIVE</p>
        <EventTimeline events={mission.eventLog.slice(-4)} />
      </article>
    </aside>
  );
}

function EventTimeline({ events }: { events: MissionDTO["eventLog"] }) {
  return (
    <div className="event-list">
      {events.map((event, index) => (
        <div className="event" key={`${event.label}-${index}`}>
          <span className={`event-dot event-${event.status}`}>
            {event.status === "alert" ? (
              <AlertTriangle size={12} />
            ) : (
              <Check size={12} />
            )}
          </span>
          <div>
            <strong>{event.label}</strong>
            <p>{event.detail}</p>
          </div>
          <time>{event.time}</time>
        </div>
      ))}
    </div>
  );
}

function ClientsPage({
  tenant,
  clients,
}: {
  tenant: string;
  clients: TenantDTO[];
}) {
  return (
    <section>
      <div className="page-intro">
        <div>
          <p className="eyebrow">PLATEFORME MULTI-CLIENTS</p>
          <h2>LES CLIENTS DE SUD CONTRACTORS</h2>
          <p>
            Chaque entreprise accède uniquement à ses stations, camions, missions et
            rapports.
          </p>
        </div>
        <button className="button button-primary">
          <Users size={17} /> Inviter un client
        </button>
      </div>
      <div className="client-grid">
        {clients.map((client) => (
          <article className="panel client-card" key={client.code}>
            <div className="client-top">
              <span className="client-logo">{client.name.slice(0, 2).toUpperCase()}</span>
              <StatusPill tone={client.status === "Actif" ? "success" : "warning"}>
                {client.status}
              </StatusPill>
            </div>
            <h3>{client.name}</h3>
            <p>{client.code} · Espace isolé et personnalisé</p>
            <div className="client-stats">
              <div>
                <strong>{client.stations}</strong>
                <span>Stations</span>
              </div>
              <div>
                <strong>{client.trucks}</strong>
                <span>Camions</span>
              </div>
            </div>
            <button className="button button-secondary">
              {tenant === client.name ? "Espace actuel" : "Ouvrir l’espace"}
              <ArrowRight size={16} />
            </button>
          </article>
        ))}
        <article className="add-client-card">
          <span>
            <Users size={26} />
          </span>
          <strong>Nouveau client</strong>
          <p>Créez un espace sécurisé à votre image.</p>
        </article>
      </div>
      <article className="reseller-banner">
        <Logo />
        <div>
          <p className="eyebrow orange">OFFRE SAAS SUD CONTRACTORS</p>
          <h3>UNE SOLUTION, PLUSIEURS CLIENTS</h3>
          <p>
            Sud Contractors administre la plateforme, tandis que chaque client
            dispose de son propre périmètre de données et de ses utilisateurs.
          </p>
        </div>
        <StatusPill tone="info">Architecture multi-tenant</StatusPill>
      </article>
    </section>
  );
}
