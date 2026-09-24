import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Shield,
  LayoutDashboard,
  ScanLine,
  Network as NetworkIcon,
  Activity,
  HardDrive,
  MessageSquareText,
  Settings as SettingsIcon,
  ArrowUpRight,
  ArrowRight,
  Download,
  Github,
  ChevronRight,
  Check,
  Lock,
  FolderSearch,
  RefreshCw,
  AlertTriangle,
  Cpu,
  MemoryStick,
  Thermometer,
  BatteryCharging,
  Wifi,
  Globe,
  SlidersHorizontal,
  Zap,
  Leaf,
  Scale,
  Trash2,
  Archive,
  Square,
  Menu,
  FileText,
  X,
  Info,
  Terminal,
  LoaderCircle,
} from "lucide-react";
import type {
  Diagnostics,
  Scan,
  Finding,
  Network,
  Provider,
  Engine,
  Quarantine,
  Progress,
  Settings,
  CleanupItem,
} from "./types";
import { sampleDevice, sampleScan } from "./demo";
const REPO = "https://github.com/heinrichryodigital/aegis-ai";
const desktop = !!window.aegis;
const nav = [
  ["Overview", LayoutDashboard],
  ["Security scan", ScanLine],
  ["Network", NetworkIcon],
  ["Performance", Activity],
  ["Device cleanup", HardDrive],
  ["Quarantine", Archive],
  ["AI assistant", MessageSquareText],
  ["Settings", SettingsIcon],
] as const;
const bytes = (n: number) =>
  n >= 1073741824
    ? `${(n / 1073741824).toFixed(1)} GB`
    : `${(n / 1048576).toFixed(1)} MB`;
const pct = (n: number) => (Number.isFinite(n) ? Math.round(n) : 0);
function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
function Toggle({
  label,
  detail,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  detail: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="toggle-row">
      <div>
        <strong>{label}</strong>
        <p>{detail}</p>
      </div>
      <button
        type="button"
        className={`switch ${checked ? "on" : ""}`}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={onChange}
        disabled={disabled}
      >
        <span />
      </button>
    </div>
  );
}
function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M8 8h48v29L32 59 8 37V8Zm12 33 12-26 12 26h-8l-4-10-4 10h-8Z"
      />
    </svg>
  );
}
const SEVERITIES = ["critical", "high", "medium", "low", "info"] as const;
const SEVERITY_LABEL: Record<string, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Info",
};
const sevTone = (severity: string) =>
  severity === "critical"
    ? "critical"
    : severity === "high"
      ? "danger"
      : severity === "medium"
        ? "amber"
        : severity === "low"
          ? "slate"
          : "neutral";
const loadState = (percent?: number) =>
  percent == null
    ? "none"
    : percent >= 88
      ? "high"
      : percent >= 70
        ? "warn"
        : "ok";
function ReviewRing({ findings }: { findings: Finding[] }) {
  const total = findings.length;
  const groups = SEVERITIES.map((severity) => ({
    severity,
    count: findings.filter((f) => f.severity === severity).length,
  })).filter((group) => group.count > 0);
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const gap = groups.length > 1 ? 11 : 0;
  let travelled = 0;
  return (
    <div className="review-ring">
      <div className="ring-plot">
        <svg viewBox="0 0 140 140" aria-hidden="true">
          <circle className="ring-track" cx="70" cy="70" r={radius} />
          {groups.map(({ severity, count }) => {
            const length = (count / total) * circumference;
            const dash = Math.max(length - gap, 3);
            const arc = (
              <circle
                key={severity}
                className="ring-arc"
                data-severity={severity}
                cx="70"
                cy="70"
                r={radius}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-travelled}
              />
            );
            travelled += length;
            return arc;
          })}
        </svg>
        <div className="ring-center">
          <strong>{total}</strong>
          <span>{total === 1 ? "item to review" : "items to review"}</span>
        </div>
      </div>
      <ul className="ring-legend">
        {groups.length ? (
          groups.map(({ severity, count }) => (
            <li key={severity} data-severity={severity}>
              <i />
              {SEVERITY_LABEL[severity]}
              <b>{count}</b>
            </li>
          ))
        ) : (
          <li className="ring-empty">Nothing recorded yet</li>
        )}
      </ul>
    </div>
  );
}
function Metric({
  icon,
  title,
  value,
  unit,
  sub,
  percent,
  preview,
}: {
  icon: ReactNode;
  title: string;
  value: string | number;
  unit?: string;
  sub: string;
  percent?: number;
  preview: boolean;
}) {
  return (
    <article className="metric" data-load={loadState(percent)}>
      <div className="metric-top">
        <span>
          {icon}
          {title}
        </span>
        <span className="micro">{preview ? "EXAMPLE" : "CURRENT"}</span>
      </div>
      <div className="metric-value">
        {value}
        <span>{unit}</span>
      </div>
      <div
        className={`meter ${percent == null ? "meter-unscaled" : ""}`}
        aria-hidden="true"
      >
        <i style={{ width: `${Math.max(0, Math.min(percent ?? 0, 100))}%` }} />
      </div>
      <div className="metric-bottom">{sub}</div>
    </article>
  );
}
export default function App() {
  const [page, setPage] = useState("Overview");
  const [device, setDevice] = useState<Diagnostics | null>(
    desktop ? null : sampleDevice,
  );
  const [scan, setScan] = useState<Scan | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [engines, setEngines] = useState<Engine[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [quarantine, setQuarantine] = useState<Quarantine[]>([]);
  const [settings, setSettings] = useState<Settings>({
    autoQuarantine: false,
    watchDownloads: false,
    watchNetwork: false,
  });
  const [network, setNetwork] = useState<Network | null>(null);
  const [provider, setProvider] = useState("local");
  const [question, setQuestion] = useState(
    "Explain the findings and prioritize what I should do next.",
  );
  const [answer, setAnswer] = useState("");
  const [profile, setProfile] = useState("balanced");
  const [cleanup, setCleanup] = useState<CleanupItem[]>([]);
  const [cleanupReady, setCleanupReady] = useState(false);
  const [download, setDownload] = useState(false);
  const [menu, setMenu] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [filter, setFilter] = useState("all");
  async function call<T>(action: string, payload?: unknown) {
    if (!window.aegis)
      throw new Error("Install the desktop app to access this device.");
    return window.aegis.call<T>(action, payload);
  }
  async function run(label: string, task: () => Promise<void>) {
    if (busy) return;
    setBusy(label);
    setNotice("");
    try {
      await task();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
      if (label === "Scanning") setProgress(null);
    }
  }
  async function refresh() {
    await run("Refreshing", async () => {
      if (!desktop) {
        setNotice(
          "Preview refreshed. These are example readings, not measurements from your device.",
        );
        return;
      }
      const d = await call<Diagnostics>("diagnostics");
      setDevice(d);
      setNotice("Device readings refreshed.");
    });
  }
  useEffect(() => {
    if (!desktop) return;
    let active = true;
    void Promise.all([
      call<Diagnostics>("diagnostics"),
      call<Engine[]>("engines"),
      call<Provider[]>("providers"),
      call<Quarantine[]>("quarantine.list"),
      call<Settings>("settings.get"),
    ])
      .then(([d, e, p, q, s]) => {
        if (active) {
          setDevice(d);
          setEngines(e);
          setProviders(p);
          setQuarantine(q);
          setSettings(s);
        }
      })
      .catch((e) => setNotice(String(e)));
    const off = window.aegis!.onEvent((event) => {
      if (event.type === "progress") setProgress(event.data as Progress);
      if (event.type === "scan") {
        setScan(event.data as Scan);
        setProgress(null);
      }
      if (event.type === "notice") setNotice(String(event.data));
      if (event.type === "settings") setSettings(event.data as Settings);
    });
    return () => {
      active = false;
      off();
    };
  }, []);
  useEffect(() => {
    if (download) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [download]);
  useEffect(() => {
    if (!menu) return;
    const sidebar = sidebarRef.current;
    sidebar?.querySelector<HTMLButtonElement>('[aria-current="page"]')?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenu(false);
        menuButtonRef.current?.focus();
      }
      if (event.key === "Tab") {
        const controls = [
          ...Array.from(
            sidebar?.querySelectorAll<HTMLElement>(
              "a[href], button:not(:disabled)",
            ) ?? [],
          ),
          menuButtonRef.current,
        ].filter((element): element is HTMLElement => !!element);
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    const media = window.matchMedia("(max-width: 720px)");
    const resize = () => {
      if (!media.matches) setMenu(false);
    };
    window.addEventListener("keydown", dismiss);
    media.addEventListener("change", resize);
    return () => {
      window.removeEventListener("keydown", dismiss);
      media.removeEventListener("change", resize);
      document.body.style.overflow = previousOverflow;
    };
  }, [menu]);
  const findings = [
    ...(scan?.findings ?? []),
    ...(device?.findings ?? []),
  ].filter((f, i, a) => a.findIndex((x) => x.id === f.id) === i);
  const displayed = findings.filter(
    (f) => filter === "all" || f.severity === filter,
  );
  const isolatedCount = quarantine.filter((item) => !item.restoredAt).length;
  const d = device;
  const activeEngine = engines.find((e) => e.available && e.id !== "eicar");
  const scanTitle =
    busy === "Scanning" || progress
      ? "Your scan is in progress."
      : scan?.status === "error"
        ? "Your scan needs attention."
        : scan?.status === "cancelled"
          ? "Your scan was stopped."
          : scan
            ? "Your scan is ready to review."
            : "Ready for your first scan.";
  async function startScan() {
    go("Security scan");
    await run("Scanning", async () => {
      if (!desktop) {
        setProgress({
          scanned: 0,
          current: "Example Downloads",
          status: "Simulating",
        });
        await new Promise((r) => setTimeout(r, 900));
        setScan(sampleScan());
        setProgress(null);
        setNotice("Demo complete. No files on your device were accessed.");
        return;
      }
      const selected = await call<string | null>("chooseFolder");
      if (!selected) return;
      const result = await call<Scan>("scan", { root: selected });
      setScan(result);
      setProgress(null);
      setQuarantine(await call<Quarantine[]>("quarantine.list"));
    });
  }
  async function toggle(key: keyof Settings) {
    if (!desktop) {
      setNotice(
        "Protection switches require the desktop app. The website cannot monitor your device.",
      );
      return;
    }
    await run("Saving protection", async () => {
      setSettings(
        await call<Settings>("settings.set", {
          ...settings,
          [key]: !settings[key],
        }),
      );
    });
  }
  function exportReport() {
    const report = {
      createdAt: new Date().toISOString(),
      mode: desktop ? "desktop" : "demo",
      scan,
      diagnostics: device,
      network,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "aegis-report.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(
      "Report saved. It may contain device names, paths, and network addresses; review it before sharing.",
    );
  }
  async function analyze() {
    await run("Analyzing", async () => {
      if (!desktop) {
        setAnswer(
          "DEMO ANALYSIS\n\n1. Review the example memory-heavy process. Save work before closing unused projects.\n\n2. Check whether you intentionally enabled remote desktop. Use your OS firewall to restrict access.\n\n3. Install and update ClamAV in the desktop app before a malware scan.\n\nThese are sample recommendations. No AI provider was contacted and no device was assessed.",
        );
        return;
      }
      const result = await call<{ text: string }>("analyze", {
        provider,
        question,
        report: { scan, diagnostics: device, network },
      });
      setAnswer(result.text);
    });
  }
  const go = (p: string) => {
    setPage(p);
    setMenu(false);
    setNotice("");
    requestAnimationFrame(() => {
      headingRef.current?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "instant" });
    });
  };
  return (
    <div className="app">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <aside ref={sidebarRef} className={`sidebar ${menu ? "expanded" : ""}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            go("Overview");
          }}
        >
          <span className="brand-icon">
            <BrandMark />
          </span>
          <span>
            aegis<span className="brand-ai">AI</span>
            <small>Device security</small>
          </span>
        </a>
        <div className="workspace">
          <div className="device-mark">
            <Cpu size={19} />
          </div>
          <div>
            <strong>{desktop ? "This device" : "Example device"}</strong>
            <small>
              {desktop ? (d?.os ?? "Reading device…") : "Windows & macOS"}
            </small>
          </div>
          <ChevronRight size={15} />
        </div>
        <div className="nav-label">Device</div>
        <nav id="primary-navigation" aria-label="Main navigation">
          {nav.map(([label, Icon]) => (
            <button
              key={label}
              onClick={() => go(label)}
              className={`${page === label ? "selected" : ""} ${label === "AI assistant" ? "nav-section-start" : ""}`}
              aria-current={page === label ? "page" : undefined}
            >
              <Icon size={19} />
              <span>{label}</span>
              {label === "Quarantine" && isolatedCount > 0 && (
                <span className="nav-count">{isolatedCount}</span>
              )}
              {page === label && <span className="active-mark" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="open-source">
            <span className="tiny-shield">
              <Github size={21} />
            </span>
            <strong>Free. Open source.</strong>
            <p>
              Built by Heinrich.
              <br />
              Available for everyone.
            </p>
            <a href={REPO} target="_blank" rel="noreferrer">
              View source code <ArrowUpRight size={15} />
            </a>
          </div>
          <a
            className="author"
            href="https://github.com/heinrichryodigital"
            target="_blank"
            rel="noreferrer"
          >
            <span className="avatar">H</span>
            <span>
              Made by Heinrich<small>Open-source · MIT license</small>
            </span>
            <ArrowUpRight size={14} />
          </a>
        </div>
      </aside>
      {menu && (
        <button
          className="menu-scrim"
          aria-label="Close navigation"
          tabIndex={-1}
          onClick={() => {
            setMenu(false);
            menuButtonRef.current?.focus();
          }}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <button
            ref={menuButtonRef}
            className="mobile-menu icon-button"
            aria-label="Toggle navigation"
            aria-expanded={menu}
            aria-controls="primary-navigation"
            onClick={() => setMenu(!menu)}
          >
            <Menu />
          </button>
          <div className="breadcrumbs">
            My device <ChevronRight size={14} />
            <span>{page}</span>
          </div>
          <div className="top-actions" inert={menu}>
            <Badge tone={desktop ? "mint" : "amber"}>
              {desktop ? <Cpu size={12} /> : <Globe size={12} />}{" "}
              {desktop ? "DESKTOP CONNECTED" : "WEB PREVIEW"}
            </Badge>
            <a
              href={REPO}
              target="_blank"
              rel="noreferrer"
              className="icon-button"
              aria-label="View GitHub source"
            >
              <Github size={19} />
            </a>
            <button className="button small" onClick={() => setDownload(true)}>
              <Download size={15} /> Get desktop app
            </button>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} inert={menu}>
          <div className="page-heading">
            <div>
              <h1 ref={headingRef} tabIndex={-1}>
                {page === "Overview" ? "Device overview" : page}
              </h1>
              <p>
                {
                  (
                    {
                      Overview:
                        "Review your security and keep your device running well.",
                      "Security scan":
                        "Inspect the files you choose. Review every finding.",
                      Network:
                        "Understand your connections and local exposure.",
                      Performance:
                        "Review resource usage and choose a power profile.",
                      "Device cleanup":
                        "Reclaim space carefully, with a review before removal.",
                      Quarantine: "Detected files, isolated and recoverable.",
                      "AI assistant":
                        "Turn security findings into a clear next step.",
                      Settings:
                        "Manage scanning, monitoring, and connected tools.",
                    } as Record<string, string>
                  )[page]
                }
              </p>
            </div>
            <button
              className="button subtle"
              onClick={refresh}
              disabled={!!busy}
            >
              <RefreshCw
                size={15}
                className={busy === "Refreshing" ? "spin" : ""}
              />
              Refresh readings
            </button>
          </div>
          {!desktop && (
            <div className="preview-notice">
              <Globe size={17} />
              <span>
                <strong>Web preview</strong>
                <span className="preview-divider" /> These readings are
                examples. Use the desktop app to check your device.
              </span>
              <button onClick={() => setDownload(true)}>
                Get the app <ArrowRight size={14} />
              </button>
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              <Info size={17} />
              <span>{notice}</span>
              <button
                aria-label="Dismiss notification"
                onClick={() => setNotice("")}
              >
                <X size={17} />
              </button>
            </div>
          )}
          {page === "Overview" && (
            <>
              <section className="hero-grid" aria-label="Security overview">
                <article className="protection-card">
                  <div className="protection-copy">
                    <span className="eyebrow">Security scan</span>
                    <h2>{scanTitle}</h2>
                    <p>
                      {desktop
                        ? "Check your files for threats, review the results, and decide what happens next."
                        : "See how Aegis checks files, explains findings, and keeps detected threats in quarantine."}
                    </p>
                    <div className="hero-buttons">
                      <button
                        className="button primary"
                        onClick={startScan}
                        disabled={!!busy}
                      >
                        <ScanLine size={19} />
                        {desktop ? "Start scan" : "Run demo scan"}
                        <ArrowRight size={17} />
                      </button>
                      <button
                        className="text-button"
                        onClick={() => go("Security scan")}
                      >
                        Scan options <ChevronRight size={16} />
                      </button>
                    </div>
                    <div className="hero-foot">
                      <Lock size={14} />
                      {desktop
                        ? "File scanning happens on your device"
                        : "No files are accessed in this preview"}
                    </div>
                  </div>
                  <ReviewRing findings={findings} />
                  <div className="scan-summary">
                    <span>
                      <FolderSearch size={15} />
                      {scan
                        ? `${scan.scanned.toLocaleString()} files inspected${desktop ? "" : " · demo"}`
                        : "No scan performed"}
                    </span>
                    <span>
                      <Archive size={15} />
                      {isolatedCount} quarantined
                    </span>
                    <span>
                      <AlertTriangle size={15} />
                      {findings.length} to review
                    </span>
                  </div>
                </article>
                <article className="card coverage">
                  <div className="card-heading">
                    <h3>Protection status</h3>
                    <Shield size={20} />
                  </div>
                  <div className="coverage-row">
                    <span>
                      <ScanLine size={18} />
                      Malware engine
                    </span>
                    <Badge tone={activeEngine ? "mint" : "amber"}>
                      {desktop
                        ? activeEngine
                          ? "Available"
                          : "Setup needed"
                        : "Desktop only"}
                    </Badge>
                  </div>
                  <div className="coverage-row">
                    <span>
                      <Download size={18} />
                      Download watch
                    </span>
                    <span
                      className={`status-value ${settings.watchDownloads ? "enabled" : ""}`}
                    >
                      {settings.watchDownloads ? "On" : "Off"}
                      <i />
                    </span>
                  </div>
                  <div className="coverage-row">
                    <span>
                      <NetworkIcon size={18} />
                      Network watch
                    </span>
                    <span
                      className={`status-value ${settings.watchNetwork ? "enabled" : ""}`}
                    >
                      {settings.watchNetwork ? "On" : "Off"}
                      <i />
                    </span>
                  </div>
                  <div className="coverage-row">
                    <span>
                      <Archive size={18} />
                      Auto-quarantine
                    </span>
                    <span
                      className={`status-value ${settings.autoQuarantine ? "enabled" : ""}`}
                    >
                      {settings.autoQuarantine ? "On" : "Off"}
                      <i />
                    </span>
                  </div>
                  <button
                    className="coverage-settings text-button"
                    onClick={() => go("Settings")}
                  >
                    Manage protection <ArrowRight size={16} />
                  </button>
                  <p className="coverage-note">
                    {desktop
                      ? "Coverage depends on your installed engine."
                      : "Protection requires the desktop app."}
                  </p>
                </article>
              </section>
              <div className="section-heading">
                <h3>Device vitals</h3>
                <span>{desktop ? "Current readings" : "Example readings"}</span>
              </div>
              <div className="metrics-grid">
                <Metric
                  icon={<Cpu size={17} />}
                  title="CPU usage"
                  value={d ? pct(d.cpu.usage) : "—"}
                  unit="%"
                  sub={d?.cpu.brand ?? "Waiting for device"}
                  percent={d?.cpu.usage ?? 0}
                  preview={!desktop}
                />
                <Metric
                  icon={<MemoryStick size={17} />}
                  title="Memory"
                  value={d ? bytes(d.memory.used).split(" ")[0] : "—"}
                  unit={d ? bytes(d.memory.used).split(" ")[1] : "GB"}
                  sub={
                    d
                      ? `${bytes(d.memory.total)} total · ${pct(d.memory.percent)}% used`
                      : "Waiting for device"
                  }
                  percent={d?.memory.percent ?? 0}
                  preview={!desktop}
                />
                <Metric
                  icon={<HardDrive size={17} />}
                  title="Storage"
                  value={d?.disks[0] ? pct(d.disks[0].percent) : "—"}
                  unit="%"
                  sub={
                    d?.disks[0]
                      ? `${bytes(d.disks[0].total - d.disks[0].used)} available`
                      : "No reading available"
                  }
                  percent={d?.disks[0]?.percent ?? 0}
                  preview={!desktop}
                />
                <Metric
                  icon={<Thermometer size={17} />}
                  title="CPU temperature"
                  value={d?.cpu.temperature ?? "—"}
                  unit="°C"
                  sub={
                    d?.cpu.temperature == null
                      ? "Sensor unavailable"
                      : "Temperature reading · limits vary by device"
                  }
                  preview={!desktop}
                />
              </div>
              <section className="bottom-grid">
                <article className="card findings-card">
                  <div className="card-heading">
                    <h3>
                      {desktop ? "Recommended actions" : "Example findings"}
                      <span className="count">{findings.length}</span>
                    </h3>
                    <button
                      className="text-button"
                      onClick={() => go("Security scan")}
                    >
                      View findings <ArrowUpRight size={15} />
                    </button>
                  </div>
                  {findings.length ? (
                    findings.slice(0, 3).map((f) => (
                      <button
                        className="finding-preview"
                        key={f.id}
                        onClick={() =>
                          go(
                            f.category.toLowerCase() === "performance"
                              ? "Performance"
                              : "Security scan",
                          )
                        }
                      >
                        <span className={`finding-icon ${f.severity}`}>
                          <AlertTriangle size={18} />
                        </span>
                        <span>
                          <strong>{f.title}</strong>
                          <small>
                            {f.category} <span>·</span>{" "}
                            {desktop ? "Review recommended" : "Example finding"}
                          </small>
                        </span>
                        <ChevronRight size={16} />
                      </button>
                    ))
                  ) : (
                    <div className="empty compact">
                      <ScanLine />
                      <p>Run a scan to see findings here.</p>
                    </div>
                  )}
                </article>
                <article className="card ai-card">
                  <div className="ai-symbol">
                    <MessageSquareText size={24} />
                  </div>
                  <span className="eyebrow">AI assistant</span>
                  <h3>Understand a finding.</h3>
                  <p>
                    Get an explanation and practical next steps. Connect your
                    existing Codex or Claude login, or use offline guidance.
                  </p>
                  <button className="button" onClick={() => go("AI assistant")}>
                    Explain my findings <ArrowRight size={15} />
                  </button>
                  <div className="provider-logos">
                    <span>
                      <Terminal size={14} />
                      Codex
                    </span>
                    <span>Claude</span>
                    <span>Offline</span>
                  </div>
                </article>
              </section>
            </>
          )}
          {page === "Security scan" && (
            <>
              <div className="scan-options">
                <article className="card scan-control">
                  <div className="large-icon">
                    <FolderSearch size={30} />
                  </div>
                  <h2>Choose what to inspect.</h2>
                  <p>
                    Select a folder, or a drive you have permission to scan.
                    Inaccessible, changing, and oversized files are reported as
                    skipped.
                  </p>
                  <button
                    className="button primary"
                    onClick={startScan}
                    disabled={!!busy}
                  >
                    <ScanLine size={18} />
                    {desktop ? "Choose folder & scan" : "Run demo scan"}
                  </button>
                  {busy === "Scanning" && desktop && (
                    <button
                      className="button"
                      onClick={() => void call("scan.cancel")}
                    >
                      <Square size={13} />
                      Stop scan
                    </button>
                  )}
                  <p className="fine-print">
                    {desktop
                      ? "ClamAV signatures are required for malware detection. Without ClamAV, only EICAR test files can be identified."
                      : "This simulation accesses no files."}
                  </p>
                </article>
                <article className="card">
                  <div className="card-heading">
                    <h3>Scan activity</h3>
                    <FileText size={18} />
                  </div>
                  {progress ? (
                    <div className="scan-progress" role="status">
                      <LoaderCircle className="spin" size={28} />
                      <h2>
                        {progress.scanned.toLocaleString()} files inspected
                      </h2>
                      <p>{progress.current}</p>
                      <div className="indeterminate" />
                    </div>
                  ) : scan ? (
                    <>
                      <Badge
                        tone={
                          scan.status === "error"
                            ? "danger"
                            : scan.status === "cancelled"
                              ? "amber"
                              : "mint"
                        }
                      >
                        {desktop
                          ? scan.status === "error"
                            ? "Scan incomplete"
                            : scan.status === "cancelled"
                              ? "Scan stopped"
                              : "Scan complete"
                          : "Demo complete"}
                      </Badge>
                      <div className="scan-stats">
                        <div>
                          <strong>{scan.scanned.toLocaleString()}</strong>
                          <small>Files inspected</small>
                        </div>
                        <div>
                          <strong>{scan.findings.length}</strong>
                          <small>Findings</small>
                        </div>
                        <div>
                          <strong>{scan.skipped}</strong>
                          <small>Skipped</small>
                        </div>
                      </div>
                      <p className="mono break">{scan.engine}</p>
                      {scan.warnings.map((w, i) => (
                        <p className="warning-text" key={i}>
                          {w}
                        </p>
                      ))}
                      <button className="text-button" onClick={exportReport}>
                        <Download size={15} />
                        Export report
                      </button>
                    </>
                  ) : (
                    <div className="empty">
                      <ScanLine size={36} />
                      <h3>No scan yet</h3>
                      <p>Your scan results and coverage will appear here.</p>
                    </div>
                  )}
                </article>
              </div>
              <div className="section-heading">
                <h3>Findings to review</h3>
                <select
                  aria-label="Filter findings"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">All severities</option>
                  {["critical", "high", "medium", "low", "info"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="finding-list">
                {displayed.map((f) => (
                  <article
                    className="card finding-detail"
                    data-severity={f.severity}
                    key={f.id}
                  >
                    <div>
                      <Badge tone={sevTone(f.severity)}>{f.severity}</Badge>
                      <span className="micro">{f.category}</span>
                    </div>
                    <h3>{f.title}</h3>
                    <p>{f.evidence}</p>
                    {f.path && <code>{f.path}</code>}
                    <div className="recommendation">
                      <ArrowRight size={16} />
                      <span>{f.recommendation}</span>
                    </div>
                    {f.quarantinable && !f.quarantined && desktop && (
                      <button
                        className="button"
                        disabled={!!busy}
                        onClick={() =>
                          void run("Quarantining", async () => {
                            await call("quarantine.add", { id: f.id });
                            setQuarantine(await call("quarantine.list"));
                            setScan((s) =>
                              s
                                ? {
                                    ...s,
                                    findings: s.findings.map((x) =>
                                      x.id === f.id
                                        ? { ...x, quarantined: true }
                                        : x,
                                    ),
                                  }
                                : s,
                            );
                            setNotice("File moved to quarantine.");
                          })
                        }
                      >
                        <Archive size={15} />
                        Quarantine confirmed detection
                      </button>
                    )}
                    {f.quarantined && <Badge tone="mint">Quarantined</Badge>}
                  </article>
                ))}
                {!displayed.length && (
                  <div className="card empty">
                    <Info />
                    <p>
                      No findings in this view. This does not certify the device
                      as safe.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
          {page === "Network" && (
            <>
              <div className="card network-banner">
                <div className="network-graphic">
                  <Globe size={68} strokeWidth={1} />
                  <Wifi size={24} />
                </div>
                <div>
                  <Badge tone="mint">LOCAL EXPOSURE AUDIT</Badge>
                  <h2>Review your network connections.</h2>
                  <p>
                    Review network interfaces, listening services, and firewall
                    status. Network monitoring flags gateway changes; it cannot
                    prove the absence of spying.
                  </p>
                </div>
                <button
                  className="button primary"
                  disabled={!!busy}
                  onClick={() =>
                    void run("Auditing network", async () => {
                      if (!desktop) {
                        setNetwork(sampleDevice.network);
                        setNotice(
                          "Example network audit loaded. Your network was not scanned.",
                        );
                        return;
                      }
                      setNetwork(await call<Network>("network.audit"));
                      setNotice("Local network audit complete.");
                    })
                  }
                >
                  <NetworkIcon size={17} />
                  {desktop ? "Audit this device" : "Explore network audit"}
                </button>
              </div>
              <div className="two-grid">
                <article className="card">
                  <h3>Network interfaces</h3>
                  {(network ?? d?.network)?.interfaces.map((i, index) => (
                    <div className="detail-row" key={index}>
                      <span>
                        <Wifi size={18} />
                        {i.name}
                      </span>
                      <code>{i.address}</code>
                    </div>
                  ))}
                  <div className="detail-row">
                    <span>Default gateway</span>
                    <code>
                      {(network ?? d?.network)?.gateway ?? "Unavailable"}
                    </code>
                  </div>
                </article>
                <article className="card">
                  <h3>Network watch</h3>
                  <Toggle
                    label="Monitor gateway changes"
                    detail="Checks every 60 seconds while the app is open. Changes need review; they are not proof of hijacking."
                    checked={settings.watchNetwork}
                    onChange={() => void toggle("watchNetwork")}
                    disabled={!!busy}
                  />
                  <p className="fine-print">
                    This audit covers connections on this device. Other devices
                    on your Wi-Fi are not assessed.
                  </p>
                </article>
              </div>
              <article className="card">
                <div className="card-heading">
                  <h3>Connections</h3>
                  <Badge>{desktop ? "LOCAL SNAPSHOT" : "EXAMPLE DATA"}</Badge>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Protocol</th>
                        <th>Local endpoint</th>
                        <th>Remote endpoint</th>
                        <th>Status</th>
                        <th>Process</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(network ?? d?.network)?.connections
                        .slice(0, 60)
                        .map((c, i) => (
                          <tr key={i}>
                            <td>{c.protocol}</td>
                            <td className="mono">{c.local}</td>
                            <td className="mono">{c.remote}</td>
                            <td>{c.state}</td>
                            <td>{c.process || "Unknown"}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                {network?.findings?.map((f) => (
                  <div className="inline-finding" key={f.id}>
                    <strong>{f.title}</strong>
                    <p>{f.evidence}</p>
                    <p>{f.recommendation}</p>
                  </div>
                ))}
                {network?.limitations?.map((l, i) => (
                  <p className="fine-print" key={i}>
                    {l}
                  </p>
                ))}
              </article>
            </>
          )}
          {page === "Performance" && (
            <>
              <div className="two-grid">
                <article className="card">
                  <div className="card-heading">
                    <h3>Power profile</h3>
                    <SlidersHorizontal size={19} />
                  </div>
                  <p>
                    Use an operating system profile. Availability and
                    permissions vary by device.
                  </p>
                  <div className="profiles">
                    {(
                      [
                        ["battery", "Battery saver", Leaf],
                        ["balanced", "Balanced", Scale],
                        ["performance", "Performance", Zap],
                      ] as const
                    ).map(([id, label, Icon]) => (
                      <button
                        className={profile === id ? "active" : ""}
                        aria-pressed={profile === id}
                        key={id}
                        onClick={() => setProfile(id)}
                      >
                        <Icon size={23} />
                        {label}
                        {profile === id && <Check size={13} />}
                      </button>
                    ))}
                  </div>
                  <button
                    className="button primary"
                    disabled={!!busy}
                    onClick={() =>
                      void run("Applying profile", async () => {
                        if (!desktop) {
                          setNotice(
                            `${profile} selected in preview. No device settings changed.`,
                          );
                          return;
                        }
                        const result = await call<{
                          applied: boolean;
                          message: string;
                        }>("power.set", { profile });
                        setNotice(result.message);
                      })
                    }
                  >
                    Apply profile <ArrowRight size={15} />
                  </button>
                </article>
                <article className="card">
                  <h3>Hardware health</h3>
                  <div className="detail-row">
                    <span>
                      <Thermometer size={17} />
                      CPU temperature
                    </span>
                    <strong>
                      {d?.cpu.temperature == null
                        ? "Unavailable"
                        : `${d.cpu.temperature} °C`}
                    </strong>
                  </div>
                  <div className="detail-row">
                    <span>
                      <BatteryCharging size={17} />
                      Battery
                    </span>
                    <strong>
                      {d?.battery.available
                        ? `${d.battery.percent}%${d.battery.charging ? " · Charging" : ""}`
                        : "Unavailable"}
                    </strong>
                  </div>
                  <div className="detail-row">
                    <span>
                      <HardDrive size={17} />
                      Disk SMART
                    </span>
                    <strong>{d?.disks[0]?.smart ?? "Unavailable"}</strong>
                  </div>
                  <div className="detail-row">
                    <span>
                      <MemoryStick size={17} />
                      Physical RAM health
                    </span>
                    <Badge>Separate test required</Badge>
                  </div>
                  <p className="fine-print">
                    Use Apple Diagnostics or Windows Memory Diagnostic for
                    physical memory tests. Missing sensors are never shown as
                    healthy.
                  </p>
                </article>
              </div>
              <article className="card">
                <div className="card-heading">
                  <h3>Processes & resource use</h3>
                  <Badge>{desktop ? "CURRENT SNAPSHOT" : "EXAMPLE DATA"}</Badge>
                </div>
                <p>
                  High resource use can be legitimate. A process name alone
                  cannot confirm mining or surveillance.
                </p>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Process</th>
                        <th>PID</th>
                        <th>CPU</th>
                        <th>Memory</th>
                        <th>Scheduling priority</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d?.processes.slice(0, 30).map((p) => (
                        <tr key={p.pid}>
                          <td>
                            <span className="process-icon">
                              <Square size={12} />
                            </span>
                            {p.name}
                          </td>
                          <td className="mono">{p.pid}</td>
                          <td>{p.cpu.toFixed(1)}%</td>
                          <td>{p.memory.toFixed(1)}%</td>
                          <td>
                            <select
                              aria-label={`Priority for ${p.name}`}
                              defaultValue=""
                              disabled={!!busy}
                              onChange={(e) => {
                                const priority = e.target.value;
                                e.target.value = "";
                                void run("Setting priority", async () => {
                                  if (!desktop) {
                                    setNotice(
                                      "Preview only. No process priority changed.",
                                    );
                                    return;
                                  }
                                  const r = await call<{ message: string }>(
                                    "process.priority",
                                    { pid: p.pid, priority },
                                  );
                                  setNotice(r.message);
                                });
                              }}
                            >
                              <option value="" disabled>
                                Choose priority
                              </option>
                              <option value="normal">Normal</option>
                              <option value="low">Low</option>
                              <option value="high">High</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
              {d?.limitations.map((l, i) => (
                <p className="fine-print" key={i}>
                  {l}
                </p>
              ))}
            </>
          )}
          {page === "Device cleanup" && (
            <>
              <article className="card cleanup-hero">
                <div className="large-icon">
                  <HardDrive size={32} />
                </div>
                <h2>Review files you can remove.</h2>
                <p>
                  Choose a folder to find temporary files and logs (.tmp, .temp,
                  .log) older than 7 days. Review candidates, then move them to
                  your operating system’s Trash. Personal documents and active
                  downloads are excluded.
                </p>
                <button
                  className="button primary"
                  disabled={!!busy}
                  onClick={() =>
                    void run("Reviewing cleanup", async () => {
                      if (!desktop) {
                        setCleanup([
                          {
                            id: "demo-tmp",
                            path: "Example folder / old-session.tmp",
                            size: 4816896,
                            modified: "Example: 14 days old",
                          },
                        ]);
                        setCleanupReady(true);
                        return;
                      }
                      const root = await call<string | null>("chooseFolder");
                      if (!root) return;
                      setCleanup(
                        await call<CleanupItem[]>("cleanup.preview", { root }),
                      );
                      setCleanupReady(true);
                    })
                  }
                >
                  <FolderSearch size={18} />
                  {desktop ? "Choose folder to review" : "Preview a cleanup"}
                </button>
                <p className="fine-print">
                  No “RAM boosting,” registry sweeping, or silent deletion.
                  Unused memory is managed by your operating system.
                </p>
              </article>
              {cleanupReady && (
                <article className="card">
                  <div className="card-heading">
                    <h3>Review candidates</h3>
                    <Badge>
                      {bytes(cleanup.reduce((a, b) => a + b.size, 0))}{" "}
                      reclaimable
                    </Badge>
                  </div>
                  {cleanup.map((c) => (
                    <div className="detail-row" key={c.id}>
                      <span className="break">{c.path}</span>
                      <strong>{bytes(c.size)}</strong>
                    </div>
                  ))}
                  {!cleanup.length && (
                    <p>No eligible temporary files found within scan limits.</p>
                  )}
                  <button
                    className="button"
                    disabled={!cleanup.length || !!busy}
                    onClick={() =>
                      void run("Cleaning up", async () => {
                        if (!desktop) {
                          setNotice("Demo complete. No files were removed.");
                          setCleanup([]);
                          return;
                        }
                        const r = await call<{ message: string }>(
                          "cleanup.trash",
                          { ids: cleanup.map((c) => c.id) },
                        );
                        setNotice(r.message);
                        setCleanup([]);
                      })
                    }
                  >
                    <Trash2 size={16} />
                    Move reviewed files to Trash
                  </button>
                </article>
              )}
            </>
          )}
          {page === "Quarantine" && (
            <article className="card">
              <div className="card-heading">
                <h3>Isolated files</h3>
                <Badge>{quarantine.length} records</Badge>
              </div>
              <p>
                Only confirmed file detections can be quarantined. Restore
                returns a file to its original location without overwriting an
                existing file.
              </p>
              {!quarantine.length ? (
                <div className="empty tall">
                  <Archive size={45} />
                  <h2>No files in quarantine.</h2>
                  <p>Detected files will appear here when you isolate them.</p>
                  <button
                    className="button"
                    onClick={startScan}
                    disabled={!!busy}
                  >
                    Start a scan <ArrowRight size={15} />
                  </button>
                </div>
              ) : (
                quarantine.map((q) => (
                  <div className="quarantine-row" key={q.id}>
                    <div>
                      <strong>{q.title ?? "Quarantined file"}</strong>
                      <p className="break">
                        {q.originalPath ?? q.path ?? q.id}
                      </p>
                      <small>{q.quarantinedAt}</small>
                    </div>
                    {q.restoredAt ? (
                      <Badge>Restored</Badge>
                    ) : (
                      <button
                        className="button"
                        disabled={!!busy}
                        onClick={() =>
                          void run("Restoring", async () => {
                            await call("quarantine.restore", { id: q.id });
                            setQuarantine(await call("quarantine.list"));
                            setScan((previous) =>
                              previous
                                ? {
                                    ...previous,
                                    findings: previous.findings.map(
                                      (finding) =>
                                        finding.id === q.findingId
                                          ? { ...finding, quarantined: false }
                                          : finding,
                                    ),
                                  }
                                : previous,
                            );
                            setNotice(
                              "File restored. Re-scan it before opening.",
                            );
                          })
                        }
                      >
                        Review & restore
                      </button>
                    )}
                  </div>
                ))
              )}
            </article>
          )}
          {page === "AI assistant" && (
            <div className="assistant-grid">
              <article className="card">
                <div className="ai-symbol">
                  <MessageSquareText size={25} />
                </div>
                <h2>Explain your scan results.</h2>
                <p>
                  Analyze a redacted summary of your readings and findings. File
                  contents stay on your device. Selecting a cloud provider sends
                  the summary to that provider and uses your account’s limits.
                </p>
                <label className="field-label" htmlFor="provider">
                  Analysis provider
                </label>
                <select
                  id="provider"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                >
                  <option value="local">
                    Offline guidance · No account needed
                  </option>
                  {providers
                    .filter((p) => p.id !== "local")
                    .map((p) => (
                      <option
                        value={p.id}
                        disabled={!p.available || p.authenticated === false}
                        key={p.id}
                      >
                        {p.name} ·{" "}
                        {p.available
                          ? p.authenticated
                            ? "Signed in"
                            : "Authentication unverified"
                          : "Unavailable"}
                      </option>
                    ))}
                </select>
                {providers.find((p) => p.id === provider)?.detail && (
                  <p className="fine-print">
                    {providers.find((p) => p.id === provider)?.detail}
                  </p>
                )}
                <label className="field-label" htmlFor="question">
                  What would you like to understand?
                </label>
                <textarea
                  id="question"
                  rows={4}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  maxLength={2000}
                />
                <button
                  className="button primary"
                  disabled={!!busy || !question.trim()}
                  onClick={analyze}
                >
                  {busy === "Analyzing" ? (
                    <LoaderCircle className="spin" size={17} />
                  ) : (
                    <MessageSquareText size={17} />
                  )}{" "}
                  {provider === "local"
                    ? "Analyze locally"
                    : "Send summary & analyze"}
                </button>
                <p className="fine-print">
                  AI explanations cannot certify safety. Automatic actions are
                  limited to your selected, deterministic protection settings.
                </p>
              </article>
              <article className="card assistant-output">
                <div className="card-heading">
                  <h3>Your analysis</h3>
                  <Badge>{provider === "local" ? "OFFLINE" : "OPT-IN"}</Badge>
                </div>
                {answer ? (
                  <pre className="analysis-text">{answer}</pre>
                ) : (
                  <div className="empty tall">
                    <MessageSquareText size={38} />
                    <h3>Your explanation will appear here.</h3>
                    <p>Run a scan, then ask for an explanation.</p>
                  </div>
                )}
              </article>
            </div>
          )}
          {page === "Settings" && (
            <>
              <div className="two-grid">
                <article className="card">
                  <h3>Continuous protection</h3>
                  <Toggle
                    label="Watch new downloads"
                    detail="Scan new or changed files in Downloads while Aegis is open. Requires an installed malware engine for virus coverage."
                    checked={settings.watchDownloads}
                    onChange={() => void toggle("watchDownloads")}
                    disabled={!!busy}
                  />
                  <Toggle
                    label="Auto-quarantine detections"
                    detail="Automatically isolate confirmed detections in the folders you scan or watch. Files remain restorable."
                    checked={settings.autoQuarantine}
                    onChange={() => void toggle("autoQuarantine")}
                    disabled={!!busy}
                  />
                  <Toggle
                    label="Monitor gateway changes"
                    detail="Notify when the default network gateway changes while Aegis is open."
                    checked={settings.watchNetwork}
                    onChange={() => void toggle("watchNetwork")}
                    disabled={!!busy}
                  />
                  <p className="fine-print">
                    Aegis is a user-space companion. It does not intercept files
                    before execution, provide a kernel firewall, or replace
                    built-in OS protection.
                  </p>
                </article>
                <article className="card">
                  <h3>Engines & integrations</h3>
                  {desktop ? (
                    engines.map((e) => (
                      <div className="integration" key={e.id}>
                        <div>
                          <strong>{e.name}</strong>
                          <Badge tone={e.available ? "mint" : "neutral"}>
                            {e.available ? "Available" : "Not installed"}
                          </Badge>
                        </div>
                        <p>{e.detail}</p>
                      </div>
                    ))
                  ) : (
                    <div className="integration">
                      <strong>ClamAV</strong>
                      <p>
                        Install locally and keep signatures updated with
                        freshclam. ClamAV is not bundled in the app.
                      </p>
                    </div>
                  )}
                  {providers
                    .filter((p) => p.id !== "local")
                    .map((p) => (
                      <div className="integration" key={p.id}>
                        <div>
                          <strong>{p.name}</strong>
                          <Badge>
                            {p.available ? "Detected" : "Unavailable"}
                          </Badge>
                        </div>
                        <p>{p.detail}</p>
                      </div>
                    ))}
                  <a
                    className="text-button"
                    href={`${REPO}#getting-started`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Installation guide <ArrowUpRight size={15} />
                  </a>
                </article>
              </div>
              <article className="card">
                <h3>Privacy & project</h3>
                <p>
                  Readings stay in the desktop app unless you export a report or
                  request cloud AI analysis. Aegis does not collect telemetry.
                  Exported reports contain device metadata.
                </p>
                <div className="settings-footer">
                  <button className="button" onClick={exportReport}>
                    <Download size={16} />
                    Export current report
                  </button>
                  <a
                    className="button"
                    href={REPO}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Github size={16} />
                    Source code & license
                  </a>
                  <span>Version 0.2.0 · Created by Heinrich</span>
                </div>
              </article>
            </>
          )}
          <footer>
            <span>
              <Shield size={13} /> AEGIS AI <span className="separator">/</span>{" "}
              Device security & performance
            </span>
            <span>
              Created by{" "}
              <a
                href="https://github.com/heinrichryodigital"
                target="_blank"
                rel="noreferrer"
              >
                Heinrich
              </a>{" "}
              <span className="separator">·</span> MIT licensed
            </span>
          </footer>
        </main>
      </div>
      <dialog
        aria-labelledby="download-title"
        ref={dialogRef}
        onCancel={() => setDownload(false)}
        onClick={(e) => {
          if (e.target === dialogRef.current) setDownload(false);
        }}
      >
        <button
          className="close-dialog icon-button"
          aria-label="Close downloads"
          onClick={() => setDownload(false)}
        >
          <X />
        </button>
        <div className="large-icon">
          <Shield size={33} />
        </div>
        <Badge>AEGIS AI / DESKTOP</Badge>
        <h2 id="download-title">Get Aegis for your desktop.</h2>
        <p>
          Download an executable from GitHub Releases, or build from source.
          These early builds are unsigned and are not a certified antivirus
          product.
        </p>
        <div className="download-options">
          <a
            className="button primary"
            href={`${REPO}/releases/latest`}
            target="_blank"
            rel="noreferrer"
          >
            <Download size={18} /> Windows & macOS releases{" "}
            <ArrowUpRight size={16} />
          </a>
          <a
            className="button"
            href={`${REPO}#getting-started`}
            target="_blank"
            rel="noreferrer"
          >
            <Github size={18} /> Build from source
          </a>
        </div>
        <p className="fine-print">
          Keep Microsoft Defender or macOS built-in protections enabled. Install
          ClamAV separately for malware scanning. Apple Silicon and Intel Mac
          builds are provided.
        </p>
      </dialog>
    </div>
  );
}
