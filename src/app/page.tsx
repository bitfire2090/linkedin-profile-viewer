"use client";

import { CSSProperties, FormEvent, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import {
  ApifyTokenDTO,
  AuthMutationResponse,
  AuthSessionDTO,
  UsageDashboardDTO,
  UsagePreset,
  UserDTO,
  UserStatus,
} from "@/types/app";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  CertificationItem,
  EducationItem,
  ExperienceItem,
  ImageAsset,
  LinkedInProfile,
  RecommendationItem,
  RelatedProfile,
  SearchHistoryItem,
  SkillItem,
} from "@/types/linkedin";

const PAGE_SIZE = 8;
const BACKGROUND_FOLDER = "/background%20images";
const BACKGROUND_FILES = [
  "260dba6f4c6b149723d761d9818ed420.jpg",
  "712094.jpg",
  "80-800428_most-beautiful-flowers-free-download.jpg",
  "ai.jpg",
  "All Photos Gallery Flower Wallpaper Flowers.jpg",
  "daisy-712898.jpg",
  "dandelion-1416726.jpg",
  "duck-7406987.jpg",
  "f1.jpg",
  "f180.jpg",
  "f2.jpg",
  "f208.jpg",
  "f245.jpg",
  "f246.jpg",
  "f248.jpg",
  "f8.jpg",
  "f9.jpg",
  "field-5932123.jpg",
  "Flower Wallpaper.jpg",
  "flowers-7525121.jpg",
  "grass-4339191.jpg",
  "grass-9130658.jpg",
  "grass-9197173.jpg",
  "HD-wallpaper-so-pink-flower-pink-water-drops-macro.jpg",
  "mayweed-8120555.jpg",
  "olDdwY.jpg",
  "rose-3412884.jpg",
  "roses-1687547.jpg",
  "spruce-needles-7890105.jpg",
  "StockSnap_R0ZHGZMQE8.jpg",
  "StockSnap_SQZKCAFDMB.jpg",
  "StockSnap_ZOKJT7GLVI.jpg",
  "sunset-7133867.jpg",
  "tree-7619791.jpg",
];
const DEFAULT_BACKGROUND = toBackgroundUrl(BACKGROUND_FILES[0]);
const BACKGROUND_OPTIONS = BACKGROUND_FILES.map((file) => ({
  file,
  label: prettifyFileName(file),
}));

type ActiveTab = "search" | "multi" | "email" | "usage" | "admin";
type AuthMode = "login" | "register";
type AdminAction = "approve" | "disable" | "enable";
type AdminSection = "users" | "tokens";
type ThemeMode = "light" | "dark";

const THEME_STORAGE_KEY = "linkedin-profile-color-theme";

type HistoryResponse = {
  items: SearchHistoryItem[];
  total: number;
  page: number;
  pageSize: number;
};

type EmailLookupRecord = {
  id: string;
  profileId: number | null;
  emails: string[];
  createdAt: string;
  updatedAt: string;
};

type EmailLookupResponse = {
  email: string;
  exists: boolean;
  record: EmailLookupRecord | null;
};

type EmailSubmitResponse = {
  email: string;
  existed: boolean;
  record: EmailLookupRecord | null;
};

type SearchFinder = {
  id: string;
  username: string;
  foundAt: string;
};

type BatchSearchItem = {
  inputUrl: string;
  url: string;
  profile: LinkedInProfile | null;
  source: "cache" | "fresh" | null;
  status: "exists" | "newly_found" | "error";
  createdAt: string | null;
  foundBy: SearchFinder | null;
  error: string | null;
};

type BatchSearchResponse = {
  items: BatchSearchItem[];
  total: number;
  existsCount: number;
  newlyFoundCount: number;
  errorCount: number;
};

class ClientApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ClientApiError";
    this.status = status;
    this.code = code;
  }
}

export default function Home() {
  const headerRef = useRef<HTMLDivElement | null>(null);
  const [profile, setProfile] = useState<LinkedInProfile | null>(null);
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [inputUrl, setInputUrl] = useState("");
  const [batchInput, setBatchInput] = useState("");
  const [batchResults, setBatchResults] = useState<BatchSearchItem[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchSummary, setBatchSummary] = useState<Omit<BatchSearchResponse, "items"> | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const [emailLookup, setEmailLookup] = useState<EmailLookupResponse | null>(null);
  const [emailLookupLoading, setEmailLookupLoading] = useState(false);
  const [emailLookupError, setEmailLookupError] = useState<string | null>(null);
  const [emailSubmitLoading, setEmailSubmitLoading] = useState(false);
  const [emailSubmitMessage, setEmailSubmitMessage] = useState<string | null>(null);
  const [emailSubmitError, setEmailSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"cache" | "fresh" | null>(null);
  const [cacheFinder, setCacheFinder] = useState<SearchFinder | null>(null);
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");
  const [themeReady, setThemeReady] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [selectedBackground, setSelectedBackground] = useState<string | null>(DEFAULT_BACKGROUND);
  const [sectionOpacity, setSectionOpacity] = useState(0.9);
  const [glassBlur, setGlassBlur] = useState(10);
  const [copying, setCopying] = useState(false);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [sessionUser, setSessionUser] = useState<UserDTO | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [headerHeight, setHeaderHeight] = useState(220);
  const [usagePreset, setUsagePreset] = useState<UsagePreset>("today");
  const [customStartDate, setCustomStartDate] = useState(getTodayDateInput());
  const [customEndDate, setCustomEndDate] = useState(getTodayDateInput());
  const [usageDashboard, setUsageDashboard] = useState<UsageDashboardDTO | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [adminActionUserId, setAdminActionUserId] = useState<string | null>(null);
  const [adminMessage, setAdminMessage] = useState<string | null>(null);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("search");

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);
  const batchUrlCount = useMemo(() => splitLinkedInUrlLines(batchInput).length, [batchInput]);

  const topSkillList = useMemo(() => {
    return normalizeTopSkills(profile?.topSkills);
  }, [profile?.topSkills]);

  const combinedSkills = useMemo(() => {
    const map = new Map<string, SkillItem>();
    topSkillList.forEach((name) => {
      map.set(name.toLowerCase(), { name });
    });
    (profile?.skills ?? []).forEach((skill) => {
      if (!skill.name) return;
      map.set(skill.name.toLowerCase(), skill);
    });
    return Array.from(map.values());
  }, [profile?.skills, topSkillList]);

  const backgroundStyle = useMemo<CSSProperties>(() => {
    if (!selectedBackground) return {};
    return {
      backgroundImage: `var(--page-image-overlay), url(${selectedBackground})`,
      backgroundSize: "cover",
      backgroundRepeat: "no-repeat",
      backgroundPosition: "center",
      backgroundAttachment: "fixed",
      transition: "background-image 200ms ease, filter 200ms ease",
    };
  }, [selectedBackground]);

  const surfaceStyle = useMemo(
    () => ({
      backgroundColor: `rgba(var(--surface-rgb), ${sectionOpacity})`,
      backdropFilter: `blur(${glassBlur}px)`,
      WebkitBackdropFilter: `blur(${glassBlur}px)`,
    }),
    [sectionOpacity, glassBlur],
  );

  const mutedSurfaceStyle = useMemo(
    () => ({
      backgroundColor: `rgba(var(--muted-surface-rgb), ${Math.min(1, sectionOpacity + 0.05)})`,
      backdropFilter: `blur(${glassBlur}px)`,
      WebkitBackdropFilter: `blur(${glassBlur}px)`,
    }),
    [sectionOpacity, glassBlur],
  );

  const handleLoadSessionEffect = useEffectEvent(() => {
    void loadSession();
  });

  const handleSessionRefreshEffect = useEffectEvent(() => {
    void loadHistory(1);
  });

  const handleUsageFilterEffect = useEffectEvent(() => {
    void loadUsage();
  });

  const handleClearProtectedStateEffect = useEffectEvent(() => {
    clearProtectedState();
  });

  useEffect(() => {
    handleLoadSessionEffect();
  }, []);

  useEffect(() => {
    const nextThemeMode = resolveThemeMode();
    applyThemeModePreference(nextThemeMode);
    setThemeMode(nextThemeMode);
    setThemeReady(true);
  }, []);

  useEffect(() => {
    if (!themeReady) return;
    applyThemeModePreference(themeMode);
  }, [themeMode, themeReady]);

  useEffect(() => {
    if (!sessionUser) {
      handleClearProtectedStateEffect();
      return;
    }
    handleSessionRefreshEffect();
  }, [sessionUser]);

  useEffect(() => {
    if (!sessionUser) return;
    if (usagePreset === "custom") return;
    handleUsageFilterEffect();
  }, [sessionUser, usagePreset]);

  useEffect(() => {
    if (!copyMessage) return;
    const timer = window.setTimeout(() => setCopyMessage(null), 2000);
    return () => window.clearTimeout(timer);
  }, [copyMessage]);

  useEffect(() => {
    const node = headerRef.current;
    if (!node) return;

    const measure = () => {
      setHeaderHeight(node.offsetHeight + 32);
    };

    measure();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }

    const observer = new ResizeObserver(() => {
      measure();
    });
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (sessionUser?.role !== "admin" && activeTab === "admin") {
      setActiveTab("search");
    }
  }, [activeTab, sessionUser?.role]);

  async function loadSession() {
    try {
      setAuthLoading(true);
      const payload = await fetchJson<AuthSessionDTO>("/api/auth/session", {
        cache: "no-store",
      });
      setSessionUser(payload.user);
      setAuthError(null);
    } catch (err) {
      if (err instanceof ClientApiError && err.status === 401) {
        clearProtectedState();
        setSessionUser(null);
      } else {
        setAuthError(resolveErrorMessage(err, "Unable to verify your session."));
      }
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authUsername.trim() || !authPassword.trim()) {
      return;
    }

    try {
      setAuthSubmitting(true);
      setAuthError(null);
      setAuthMessage(null);

      const payload = await fetchJson<AuthMutationResponse>(
        authMode === "login" ? "/api/auth/login" : "/api/auth/register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: authUsername,
            password: authPassword,
          }),
        },
      );

      setAuthPassword("");

      if (payload.sessionCreated) {
        setSessionUser(payload.user);
        setActiveTab("search");
        return;
      }

      setAuthMode("login");
      setAuthMessage(payload.message);
    } catch (err) {
      setAuthError(
        resolveErrorMessage(
          err,
          authMode === "login" ? "Unable to sign in." : "Unable to create your account.",
        ),
      );
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function handleLogout() {
    try {
      await fetchJson<{ ok: boolean }>("/api/auth/logout", {
        method: "POST",
      });
    } catch {
      // Ignore logout API failures and clear local state anyway.
    }

    clearProtectedState();
    setSessionUser(null);
    setAuthMode("login");
    setAuthMessage("Signed out.");
    setAuthError(null);
    setAuthPassword("");
  }

  async function loadHistory(nextPage: number) {
    try {
      setHistoryLoading(true);
      setError(null);
      const payload = await fetchJson<HistoryResponse>(`/api/history?page=${nextPage}&pageSize=${PAGE_SIZE}`, {
        cache: "no-store",
      });
      setHistory(payload.items ?? []);
      setTotal(payload.total ?? 0);
      setPage(nextPage);
    } catch (err) {
      setError(handleProtectedError(err, "Unable to fetch history."));
    } finally {
      setHistoryLoading(false);
    }
  }

  async function loadUsage() {
    try {
      if (usagePreset === "custom" && (!customStartDate || !customEndDate)) {
        setUsageError("Select both a start date and an end date for the custom range.");
        return;
      }

      setUsageLoading(true);
      setUsageError(null);
      const params = new URLSearchParams();
      params.set("preset", usagePreset);
      if (usagePreset === "custom") {
        params.set("start", customStartDate);
        params.set("end", customEndDate);
      }

      const payload = await fetchJson<UsageDashboardDTO>(`/api/usage?${params.toString()}`, {
        cache: "no-store",
      });
      setUsageDashboard(payload);
    } catch (err) {
      const message = handleProtectedError(err, "Unable to load usage metrics.");
      setUsageError(message);
      setAdminError(message);
    } finally {
      setUsageLoading(false);
    }
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!inputUrl.trim()) return;

    try {
      setLoading(true);
      setError(null);
      setStatus(null);
      setCacheFinder(null);

      const payload = await fetchJson<{
        id: string;
        url: string;
        profile: LinkedInProfile;
        source: "cache" | "fresh";
        createdAt: string;
        foundBy: SearchFinder | null;
      }>("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: inputUrl }),
      });
      setProfile(payload.profile);
      setStatus(payload.source === "cache" ? "Loaded from cache." : "Fresh scrape completed.");
      setStatusTone(payload.source);
      setCacheFinder(payload.source === "cache" ? payload.foundBy : null);
      setInputUrl(payload.url ?? inputUrl);
      void loadHistory(1);
      void loadUsage();
    } catch (err) {
      setError(handleProtectedError(err, "Search failed."));
      setStatusTone(null);
      setCacheFinder(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleBatchSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const urls = splitLinkedInUrlLines(batchInput);

    if (!urls.length) {
      setBatchError("Paste at least one LinkedIn profile URL.");
      return;
    }

    if (urls.length > 100) {
      setBatchError("You can check up to 100 LinkedIn URLs at a time.");
      return;
    }

    try {
      setBatchLoading(true);
      setBatchError(null);
      setBatchSummary(null);
      setBatchResults([]);

      const payload = await fetchJson<BatchSearchResponse>("/api/search/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls }),
      });

      setBatchResults(payload.items ?? []);
      setBatchSummary({
        total: payload.total ?? 0,
        existsCount: payload.existsCount ?? 0,
        newlyFoundCount: payload.newlyFoundCount ?? 0,
        errorCount: payload.errorCount ?? 0,
      });
      void loadHistory(1);
      void loadUsage();
    } catch (err) {
      setBatchError(handleProtectedError(err, "Multi URL check failed."));
    } finally {
      setBatchLoading(false);
    }
  }

  async function handleEmailLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!emailInput.trim()) return;

    try {
      setEmailLookupLoading(true);
      setEmailLookupError(null);
      setEmailSubmitMessage(null);
      setEmailSubmitError(null);

      const payload = await fetchJson<EmailLookupResponse>("/api/email/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailInput }),
      });

      setEmailLookup(payload);
    } catch (err) {
      setEmailLookupError(handleProtectedError(err, "Email lookup failed."));
    } finally {
      setEmailLookupLoading(false);
    }
  }

  async function handleEmailSubmit() {
    const email = emailLookup?.email ?? emailInput.trim();
    if (!email) return;

    try {
      setEmailSubmitLoading(true);
      setEmailSubmitError(null);
      setEmailSubmitMessage(null);

      const payload = await fetchJson<EmailSubmitResponse>("/api/email/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      setEmailLookup({
        email: payload.email,
        exists: Boolean(payload.record),
        record: payload.record,
      });
      setEmailSubmitMessage(payload.existed ? "Email already existed. Timestamp refreshed." : "Email stored.");
    } catch (err) {
      setEmailSubmitError(handleProtectedError(err, "Unable to submit email."));
    } finally {
      setEmailSubmitLoading(false);
    }
  }

  function handleHistoryClick(item: SearchHistoryItem) {
    setProfile(item.profile);
    setStatus(`Loaded cached result from ${formatDate(item.createdAt)}`);
    setStatusTone("cache");
    setCacheFinder(null);
    setInputUrl(item.url);
  }

  function handleBatchResultOpen(item: BatchSearchItem) {
    if (!item.profile) {
      return;
    }

    setProfile(item.profile);
    setInputUrl(item.url);
    setStatus(item.status === "exists" ? "Loaded from batch cache results." : "Loaded from batch fresh results.");
    setStatusTone(item.source);
    setCacheFinder(item.source === "cache" ? item.foundBy : null);
    setActiveTab("search");

    window.setTimeout(() => {
      scrollToSection("preview-section");
    }, 0);
  }

  async function handleCopyProfile() {
    if (!profile) return;
    setCopying(true);
    try {
      const text = buildClipboardText(profile, combinedSkills);
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopyMessage("Copied to clipboard");
    } catch (err) {
      console.error(err);
      setCopyMessage("Copy failed");
    } finally {
      setCopying(false);
    }
  }

  async function handleAdminAction(userId: string, action: AdminAction) {
    try {
      setAdminActionUserId(userId);
      setAdminError(null);
      setAdminMessage(null);

      await fetchJson<{ ok: boolean }>(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      setAdminMessage(getAdminActionMessage(action));
      await loadUsage();
      if (activeTab === "search") {
        await loadHistory(1);
      }
    } catch (err) {
      setAdminError(handleProtectedError(err, "Unable to update that user."));
    } finally {
      setAdminActionUserId(null);
    }
  }

  function scrollToSection(sectionId: string) {
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function clearProtectedState() {
    setProfile(null);
    setHistory([]);
    setPage(1);
    setTotal(0);
    setLoading(false);
    setHistoryLoading(false);
    setError(null);
    setStatus(null);
    setStatusTone(null);
    setCacheFinder(null);
    setBatchInput("");
    setBatchResults([]);
    setBatchLoading(false);
    setBatchError(null);
    setBatchSummary(null);
    setEmailInput("");
    setEmailLookup(null);
    setEmailLookupLoading(false);
    setEmailLookupError(null);
    setEmailSubmitLoading(false);
    setEmailSubmitMessage(null);
    setEmailSubmitError(null);
    setUsageDashboard(null);
    setUsageError(null);
    setAdminError(null);
    setAdminMessage(null);
    setAdminActionUserId(null);
  }

  function handleProtectedError(error: unknown, fallback: string) {
    const message = resolveErrorMessage(error, fallback);

    if (
      error instanceof ClientApiError &&
      (error.status === 401 ||
        error.code === "AUTH_REQUIRED" ||
        error.code === "ACCOUNT_DISABLED" ||
        error.code === "ACCOUNT_PENDING")
    ) {
      clearProtectedState();
      setSessionUser(null);
      setActiveTab("search");
      setAuthMode("login");
      setAuthMessage(message);
      setAuthError(null);
    }

    return message;
  }

  const sectionLinks: Array<{ id: string; label: string; icon: React.ReactNode }> = [
    { id: "page-top", label: "Top", icon: <NavTopIcon /> },
    { id: "preview-section", label: "Preview", icon: <NavPreviewIcon /> },
    { id: "about-section", label: "About", icon: <NavAboutIcon /> },
    { id: "experience-section", label: "Experience", icon: <NavExperienceIcon /> },
    { id: "education-section", label: "Education", icon: <NavEducationIcon /> },
    { id: "skills-section", label: "Skills", icon: <NavSkillsIcon /> },
  ];

  if (authLoading) {
    return (
      <>
        <PreferenceDock themeMode={themeMode} onThemeModeChange={setThemeMode} />
        <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-medium text-slate-600 shadow-sm">
            Checking access...
          </div>
        </div>
      </>
    );
  }

  if (!sessionUser) {
    return (
      <>
        <PreferenceDock themeMode={themeMode} onThemeModeChange={setThemeMode} />
        <AuthScreen
          authMode={authMode}
          onAuthModeChange={setAuthMode}
          onSubmit={handleAuthSubmit}
          username={authUsername}
          onUsernameChange={setAuthUsername}
          password={authPassword}
          onPasswordChange={setAuthPassword}
          submitting={authSubmitting}
          error={authError}
          message={authMessage}
        />
      </>
    );
  }

  return (
    <div id="page-top" className="relative min-h-screen" style={backgroundStyle}>
      <PreferenceDock
        themeMode={themeMode}
        onThemeModeChange={setThemeMode}
        onAppearanceClick={() => setThemeOpen(true)}
      />

      {activeTab === "search" ? (
        <nav className="fixed left-3 top-1/2 z-40 -translate-y-1/2">
          <ul
            className="flex flex-col gap-1.5 rounded-2xl border border-slate-200/80 p-2 shadow-lg shadow-slate-300/40"
            style={surfaceStyle}
          >
            {sectionLinks.map((link) => (
              <li key={link.id}>
                <button
                  type="button"
                  onClick={() => scrollToSection(link.id)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white/75 text-slate-700 transition hover:-translate-y-0.5 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
                  title={link.label}
                  aria-label={`Scroll to ${link.label}`}
                >
                  {link.icon}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {themeOpen ? (
        <ThemeModal
          themeMode={themeMode}
          onThemeModeChange={setThemeMode}
          onClose={() => setThemeOpen(false)}
          selectedBackground={selectedBackground}
          onBackgroundSelect={setSelectedBackground}
          sectionOpacity={sectionOpacity}
          onOpacityChange={setSectionOpacity}
          blur={glassBlur}
          onBlurChange={setGlassBlur}
        />
      ) : null}

      <header className="fixed inset-x-0 top-4 z-30 px-4 sm:px-6 lg:px-10">
        <div
          ref={headerRef}
          className="mx-auto max-w-7xl rounded-3xl border border-white/60 px-4 py-4 shadow-lg shadow-sky-100/30"
          style={surfaceStyle}
        >
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <TabButton label="Search" active={activeTab === "search"} onClick={() => setActiveTab("search")} />
              <TabButton label="Multi" active={activeTab === "multi"} onClick={() => setActiveTab("multi")} />
              <TabButton label="Email" active={activeTab === "email"} onClick={() => setActiveTab("email")} />
              <TabButton label="Usage" active={activeTab === "usage"} onClick={() => setActiveTab("usage")} />
              {sessionUser.role === "admin" ? (
                <TabButton label="Admin" active={activeTab === "admin"} onClick={() => setActiveTab("admin")} />
              ) : null}
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                Sign out
              </button>
            </div>
          </div>

          {activeTab === "search" ? (
            <>
              <form className="mt-4" onSubmit={handleSearch}>
                <label htmlFor="linkedin-url-input" className="sr-only">
                  LinkedIn profile URL
                </label>
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1 rounded-full border border-slate-200 bg-slate-50/80 px-4 py-2 shadow-inner ring-1 ring-transparent focus-within:ring-2 focus-within:ring-sky-500">
                    <input
                      id="linkedin-url-input"
                      value={inputUrl}
                      onChange={(event) => setInputUrl(event.target.value)}
                      placeholder="https://www.linkedin.com/in/johndoe"
                      className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none sm:text-base"
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                          event.currentTarget.form?.requestSubmit();
                        }
                      }}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0a66c2] text-white shadow-md shadow-sky-200 transition hover:bg-[#084a8f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0a66c2] disabled:cursor-not-allowed disabled:bg-slate-400"
                    title="Search and render profile"
                    aria-label="Search and render profile"
                  >
                    {loading ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-transparent" />
                    ) : (
                      <SearchGearIcon />
                    )}
                  </button>
                </div>
              </form>
              {status ? (
                <div
                  className={`mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${
                    statusTone === "cache"
                      ? "bg-amber-50 text-amber-800 ring-1 ring-amber-200"
                      : "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
                  }`}
                  role="alert"
                >
                  <span className="mt-1.5 inline-block h-2 w-2 rounded-full bg-current" />
                  <div className="min-w-0">
                    <p>{status}</p>
                    {statusTone === "cache" && cacheFinder ? (
                      <p className="mt-1 text-md font-medium opacity-90">
                        Already found by <span className="text-sky-600 font-bold">{cacheFinder.username}</span> on{" "}
                        {formatDate(cacheFinder.foundAt)}.
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}
              {error ? <p className="mt-3 text-sm font-medium text-red-600">{error}</p> : null}
            </>
          ) : activeTab === "multi" ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white/70 px-4 py-4 shadow-inner">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-700">Multi URL Check</p>
                  <h2 className="mt-1 text-lg font-bold text-slate-900">Check many LinkedIn profiles in one run</h2>
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="rounded-full bg-sky-50 px-3 py-1 text-sky-700 ring-1 ring-sky-100">
                    {batchUrlCount} URL{batchUrlCount === 1 ? "" : "s"} ready
                  </span>
                  {batchSummary ? (
                    <>
                      <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700 ring-1 ring-amber-100">
                        {batchSummary.existsCount} exists
                      </span>
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700 ring-1 ring-emerald-100">
                        {batchSummary.newlyFoundCount} newly found
                      </span>
                      <span className="rounded-full bg-rose-50 px-3 py-1 text-rose-700 ring-1 ring-rose-100">
                        {batchSummary.errorCount} errors
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          ) : activeTab === "email" ? (
            <>
              <form className="mt-4" onSubmit={handleEmailLookup}>
                <label htmlFor="email-input" className="sr-only">
                  Email address
                </label>
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1 rounded-full border border-slate-200 bg-slate-50/80 px-4 py-2 shadow-inner ring-1 ring-transparent focus-within:ring-2 focus-within:ring-sky-500">
                    <input
                      id="email-input"
                      type="email"
                      value={emailInput}
                      onChange={(event) => {
                        setEmailInput(event.target.value);
                        setEmailLookup(null);
                        setEmailLookupError(null);
                        setEmailSubmitMessage(null);
                        setEmailSubmitError(null);
                      }}
                      placeholder="name@company.com"
                      className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none sm:text-base"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={emailLookupLoading}
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                  >
                    {emailLookupLoading ? "Checking..." : "Check"}
                  </button>
                </div>
              </form>

              {emailLookupError ? (
                <p className="mt-3 text-sm font-medium text-red-600">{emailLookupError}</p>
              ) : null}

              {emailLookup ? (
                <div
                  className={`mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${
                    emailLookup.exists
                      ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
                      : "bg-amber-50 text-amber-800 ring-1 ring-amber-200"
                  }`}
                  role="status"
                >
                  <span className="inline-block h-2 w-2 rounded-full bg-current" />
                  {emailLookup.exists ? "Yes, email exists in database." : "No, email not found."}
                </div>
              ) : null}
            </>
          ) : (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-600 shadow-inner">
              {activeTab === "usage"
                ? "Usage shows your own counts plus live totals across every user account. Fresh searches only increase when a URL was not already cached."
                : "Admin can approve pending accounts, disable access immediately, manage Apify tokens, and select the single active token used by new searches."}
            </div>
          )}
        </div>
      </header>

      <main className="relative mx-auto max-w-7xl px-4 pb-10 sm:px-6 lg:px-10" style={{ paddingTop: headerHeight }}>
        {activeTab === "search" ? (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[2fr_1fr]">
            <section className="space-y-6 xl:col-start-1 xl:row-start-1">
              <section id="preview-section" className="scroll-mt-44">
                <ProfileHero
                  profile={profile}
                  topSkills={topSkillList}
                  surfaceStyle={surfaceStyle}
                  mutedSurfaceStyle={mutedSurfaceStyle}
                  onCopyProfile={handleCopyProfile}
                  copying={copying}
                  copyMessage={copyMessage}
                />
              </section>

              <InfoSection id="about-section" title="About" surfaceStyle={surfaceStyle}>
                {profile?.about ? (
                  <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{profile.about}</p>
                ) : (
                  <EmptyState label="No summary provided yet." />
                )}
              </InfoSection>

              <InfoSection id="experience-section" title="Experience" surfaceStyle={surfaceStyle}>
                {profile?.experience?.length ? (
                  <div className="space-y-4">
                    {profile.experience.map((item, index) => (
                      <ExperienceCard
                        key={`${item.position ?? "role"}-${index}`}
                        item={item}
                        surfaceStyle={mutedSurfaceStyle}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState label="No roles captured for this profile." />
                )}
              </InfoSection>

              <InfoSection id="education-section" title="Education" surfaceStyle={surfaceStyle}>
                {profile?.education?.length ? (
                  <div className="space-y-3">
                    {profile.education.map((item, index) => (
                      <EducationCard
                        key={`${item.schoolName ?? "school"}-${index}`}
                        item={item}
                        surfaceStyle={mutedSurfaceStyle}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState label="No education data available." />
                )}
              </InfoSection>

              <InfoSection id="skills-section" title="Skills" surfaceStyle={surfaceStyle}>
                {combinedSkills.length ? (
                  <div className="flex flex-wrap gap-2">
                    {combinedSkills.map((skill, index) => (
                      <span
                        key={`${skill.name ?? "skill"}-${index}`}
                        className="rounded-full bg-sky-50 px-3 py-1 text-sm font-semibold text-sky-800 ring-1 ring-inset ring-sky-100"
                        title={[skill.assessments, skill.endorsements].filter(Boolean).join(" | ")}
                      >
                        {skill.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <EmptyState label="No highlighted skills yet." />
                )}
              </InfoSection>

              <InfoSection title="Certifications" surfaceStyle={surfaceStyle}>
                {profile?.certifications?.length ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {profile.certifications.map((cert, index) => (
                      <CertificationCard
                        key={`${cert.title ?? "cert"}-${index}`}
                        item={cert}
                        surfaceStyle={mutedSurfaceStyle}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState label="No certifications listed." />
                )}
              </InfoSection>

              <InfoSection title="Recommendations" surfaceStyle={surfaceStyle}>
                {profile?.receivedRecommendations?.length ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {profile.receivedRecommendations.slice(0, 4).map((rec, index) => (
                      <RecommendationCard
                        key={`${rec.givenBy ?? "rec"}-${index}`}
                        item={rec}
                        surfaceStyle={mutedSurfaceStyle}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState label="No recommendations to show." />
                )}
              </InfoSection>

              <InfoSection title="People also viewed" surfaceStyle={surfaceStyle}>
                {profile?.moreProfiles?.length ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {profile.moreProfiles.slice(0, 6).map((person) => (
                      <RelatedProfileCard key={person.id ?? person.publicIdentifier} item={person} />
                    ))}
                  </div>
                ) : (
                  <EmptyState label="No related profiles." />
                )}
              </InfoSection>
            </section>

            <aside className="space-y-4 xl:col-start-2 xl:row-start-1">
              <div className="rounded-3xl border border-slate-100 shadow-sm" style={surfaceStyle}>
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.25em] text-sky-700">History</p>
                    <h2 className="text-lg font-bold text-slate-900">Recent searches</h2>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {total}
                  </span>
                </div>
                <div className="divide-y divide-slate-100">
                  {historyLoading ? (
                    <div className="flex items-center gap-2 px-5 py-3 text-sm text-slate-500">
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-transparent" />
                      Loading history...
                    </div>
                  ) : null}
                  {!historyLoading && history.length === 0 ? (
                    <div className="px-5 py-6 text-sm text-slate-500">Start searching to populate the history.</div>
                  ) : null}
                  {!historyLoading
                    ? history.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleHistoryClick(item)}
                          className="block w-full px-5 py-4 text-left transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-sky-500"
                        >
                          <p className="line-clamp-1 text-sm font-semibold text-slate-900">
                            {buildDisplayName(item.profile) || item.url}
                          </p>
                          <p className="line-clamp-2 text-xs text-slate-600">{item.url}</p>
                          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 ring-1 ring-emerald-100">
                              {item.source === "fresh" ? "New" : "Cached"}
                            </span>
                            <span>{formatDate(item.createdAt)}</span>
                          </div>
                        </button>
                      ))
                    : null}
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-5 py-3 text-xs text-slate-600">
                  <span>
                    Page {page} of {totalPages}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void loadHistory(Math.max(1, page - 1))}
                      disabled={page === 1 || historyLoading}
                      className="rounded-full border border-slate-200 px-3 py-1 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      onClick={() => void loadHistory(Math.min(totalPages, page + 1))}
                      disabled={page >= totalPages || historyLoading}
                      className="rounded-full border border-slate-200 px-3 py-1 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        ) : null}

        {activeTab === "multi" ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
            <section className="space-y-6">
              <div className="rounded-3xl border border-slate-100 p-6 shadow-sm shadow-slate-200/40" style={surfaceStyle}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.25em] text-sky-700">Input</p>
                    <h2 className="mt-1 text-lg font-bold text-slate-900">Paste LinkedIn profile URLs</h2>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    Max 100 URLs
                  </span>
                </div>

                <form className="mt-5 space-y-4" onSubmit={handleBatchSearch}>
                  <div className="rounded-[28px] border border-slate-200 bg-white/80 p-3 shadow-inner ring-1 ring-transparent focus-within:ring-2 focus-within:ring-sky-500">
                    <textarea
                      id="linkedin-multi-input"
                      value={batchInput}
                      onChange={(event) => setBatchInput(event.target.value)}
                      placeholder={`https://www.linkedin.com/in/sawyersweet\nhttps://www.linkedin.com/in/johnathan-burgess-7227a392\nhttps://www.linkedin.com/in/alan-andersen-725aa98`}
                      rows={12}
                      className="min-h-[280px] w-full resize-y bg-transparent px-2 py-1 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                          event.currentTarget.form?.requestSubmit();
                        }
                      }}
                    />
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap gap-2 text-xs font-semibold">
                      <span className="rounded-full bg-sky-50 px-3 py-1 text-sky-700 ring-1 ring-sky-100">
                        {batchUrlCount} parsed
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 text-slate-600 ring-1 ring-slate-200">
                        Cmd/Ctrl + Enter runs the check
                      </span>
                    </div>
                    <button
                      type="submit"
                      disabled={batchLoading}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-[#0a66c2] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-sky-200 transition hover:bg-[#084a8f] disabled:cursor-not-allowed disabled:bg-slate-400"
                    >
                      {batchLoading ? (
                        <>
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-transparent" />
                          Checking URLs...
                        </>
                      ) : (
                        <>Run multi check</>
                      )}
                    </button>
                  </div>
                </form>

                {batchError ? <p className="mt-4 text-sm font-medium text-red-600">{batchError}</p> : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <BatchSummaryStat
                  label="Exists"
                  value={batchSummary?.existsCount ?? 0}
                  accentClassName="bg-amber-50 text-amber-700 ring-amber-100"
                />
                <BatchSummaryStat
                  label="Newly Found"
                  value={batchSummary?.newlyFoundCount ?? 0}
                  accentClassName="bg-emerald-50 text-emerald-700 ring-emerald-100"
                />
                <BatchSummaryStat
                  label="Errors"
                  value={batchSummary?.errorCount ?? 0}
                  accentClassName="bg-rose-50 text-rose-700 ring-rose-100"
                />
              </div>
            </section>

            <section className="space-y-4">
              <div className="rounded-3xl border border-slate-100 shadow-sm" style={surfaceStyle}>
                <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.25em] text-sky-700">Results</p>
                    <h2 className="text-lg font-bold text-slate-900">Per-profile status and preview</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Each card shows whether the URL already existed, was newly scraped, or failed.
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {batchSummary?.total ?? batchResults.length} result{(batchSummary?.total ?? batchResults.length) === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="px-5 py-5">
                  {batchLoading ? (
                    <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-4 py-4 text-sm text-slate-600">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-transparent" />
                      Running cache checks and Apify scrapes...
                    </div>
                  ) : null}

                  {!batchLoading && batchResults.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-5 py-8 text-center text-sm text-slate-500">
                      Paste LinkedIn profile URLs on the left, then run the multi check to populate result cards here.
                    </div>
                  ) : null}

                  {!batchLoading && batchResults.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      {batchResults.map((item, index) => (
                        <BatchProfileResultCard
                          key={`${item.inputUrl}-${index}`}
                          item={item}
                          onOpenPreview={handleBatchResultOpen}
                          surfaceStyle={mutedSurfaceStyle}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === "email" ? (
          <div className="mx-auto max-w-3xl">
            <section id="email-section" className="scroll-mt-44">
              <div className="rounded-3xl border border-slate-100 shadow-sm" style={surfaceStyle}>
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.25em] text-sky-700">Email</p>
                    <h2 className="text-lg font-bold text-slate-900">RocketReach check</h2>
                  </div>
                </div>
                <div className="space-y-3 px-5 py-4">
                  <form className="space-y-2" onSubmit={handleEmailLookup}>
                    <label htmlFor="email-input" className="sr-only">
                      Email address
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1 rounded-full border border-slate-200 bg-slate-50/80 px-4 py-2 shadow-inner ring-1 ring-transparent focus-within:ring-2 focus-within:ring-sky-500">
                        <input
                          id="email-input"
                          type="email"
                          value={emailInput}
                          onChange={(event) => {
                            setEmailInput(event.target.value);
                            setEmailLookup(null);
                            setEmailLookupError(null);
                            setEmailSubmitMessage(null);
                            setEmailSubmitError(null);
                          }}
                          placeholder="name@company.com"
                          className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={emailLookupLoading}
                        className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                      >
                        {emailLookupLoading ? "Checking..." : "Check"}
                      </button>
                    </div>
                  </form>

                  {emailLookupError ? (
                    <p className="text-sm font-medium text-red-600">{emailLookupError}</p>
                  ) : null}

                  {emailLookup ? (
                    <div
                      className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${
                        emailLookup.exists
                          ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
                          : "bg-amber-50 text-amber-800 ring-1 ring-amber-200"
                      }`}
                      role="status"
                    >
                      <span className="inline-block h-2 w-2 rounded-full bg-current" />
                      {emailLookup.exists ? "Yes, email exists in database." : "No, email not found."}
                    </div>
                  ) : null}

                  {emailLookup?.record ? (
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3 text-xs text-slate-600">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-500">Record ID</span>
                        <span className="font-semibold text-slate-900">{emailLookup.record.id}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="font-semibold text-slate-500">Profile ID</span>
                        <span className="font-semibold text-slate-900">
                          {emailLookup.record.profileId ?? "—"}
                        </span>
                      </div>
                      <div className="mt-2">
                        <p className="font-semibold text-slate-500">Emails</p>
                        <p className="mt-1 text-slate-700">{emailLookup.record.emails.join(", ")}</p>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="font-semibold text-slate-500">Created</span>
                        <span className="font-semibold text-slate-900">{formatDate(emailLookup.record.createdAt)}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="font-semibold text-slate-500">Updated</span>
                        <span className="font-semibold text-slate-900">{formatDate(emailLookup.record.updatedAt)}</span>
                      </div>
                    </div>
                  ) : null}

                  {emailLookup ? (
                    <button
                      type="button"
                      onClick={() => void handleEmailSubmit()}
                      disabled={emailSubmitLoading}
                      className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-slate-200 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                    >
                      {emailSubmitLoading ? "Submitting..." : "Submit email"}
                    </button>
                  ) : null}

                  {emailSubmitMessage ? (
                    <p className="text-sm font-medium text-emerald-700">{emailSubmitMessage}</p>
                  ) : null}
                  {emailSubmitError ? <p className="text-sm font-medium text-red-600">{emailSubmitError}</p> : null}
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === "usage" ? (
          <UsagePanel
            dashboard={usageDashboard}
            loading={usageLoading}
            error={usageError}
            usagePreset={usagePreset}
            customStartDate={customStartDate}
            customEndDate={customEndDate}
            surfaceStyle={surfaceStyle}
            mutedSurfaceStyle={mutedSurfaceStyle}
            onPresetChange={setUsagePreset}
            onCustomStartDateChange={setCustomStartDate}
            onCustomEndDateChange={setCustomEndDate}
            onRefresh={loadUsage}
          />
        ) : null}

        {activeTab === "admin" && sessionUser.role === "admin" ? (
          <AdminPanel
            dashboard={usageDashboard}
            loading={usageLoading}
            error={adminError}
            message={adminMessage}
            actionUserId={adminActionUserId}
            currentUserId={sessionUser.id}
            surfaceStyle={surfaceStyle}
            mutedSurfaceStyle={mutedSurfaceStyle}
            onRefresh={loadUsage}
            onAction={handleAdminAction}
            onProtectedError={handleProtectedError}
          />
        ) : null}
      </main>
    </div>
  );
}

function PreferenceDock({
  themeMode,
  onThemeModeChange,
  onAppearanceClick,
}: {
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
  onAppearanceClick?: () => void;
}) {
  return (
    <div
      suppressHydrationWarning
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-[1.5rem] border border-slate-200/80 bg-white/80 p-2 shadow-xl shadow-slate-300/40 backdrop-blur-xl"
    >
      <ThemeModeSegmentedControl themeMode={themeMode} onThemeModeChange={onThemeModeChange} compact />
      {onAppearanceClick ? (
        <button
          type="button"
          onClick={onAppearanceClick}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
          title="Background and surface controls"
          aria-label="Background and surface controls"
        >
          <ThemeIcon />
        </button>
      ) : null}
    </div>
  );
}

function ThemeModeSegmentedControl({
  themeMode,
  onThemeModeChange,
  compact = false,
}: {
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
  compact?: boolean;
}) {
  const containerClassName = compact
    ? "flex items-center gap-1 rounded-full bg-slate-100 p-1"
    : "flex items-center gap-2";
  const buttonClassName = compact
    ? "inline-flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
    : "inline-flex h-12 w-12 items-center justify-center rounded-2xl border text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500";

  const options: Array<{ value: ThemeMode; label: string; icon: React.ReactNode }> = [
    { value: "light", label: "Light", icon: <SunIcon /> },
    { value: "dark", label: "Dark", icon: <MoonIcon /> },
  ];

  return (
    <div suppressHydrationWarning className={containerClassName}>
      {options.map((option) => {
        const active = themeMode === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onThemeModeChange(option.value)}
            aria-pressed={active}
            aria-label={`${option.label} mode`}
            title={option.label}
            className={`${buttonClassName} ${
              active
                ? option.value === "dark"
                  ? "border-slate-900 bg-slate-900 text-white shadow-sm shadow-slate-900/10"
                  : "border-white bg-white text-slate-900 shadow-sm shadow-slate-300/30"
                : compact
                  ? "border-transparent text-slate-500 hover:text-slate-700"
                  : "border-slate-200 bg-white/70 text-slate-600 hover:bg-white"
            }`}
          >
            {option.icon}
          </button>
        );
      })}
    </div>
  );
}

function AuthScreen({
  authMode,
  onAuthModeChange,
  onSubmit,
  username,
  onUsernameChange,
  password,
  onPasswordChange,
  submitting,
  error,
  message,
}: {
  authMode: AuthMode;
  onAuthModeChange: (mode: AuthMode) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  username: string;
  onUsernameChange: (value: string) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  submitting: boolean;
  error: string | null;
  message: string | null;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl shadow-slate-300/30 lg:grid-cols-[1.2fr_0.9fr]">
        <div className="bg-slate-900 px-8 py-10 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-300">Protected workspace</p>
          <h1 className="mt-4 text-4xl font-bold leading-tight">Search access is account-based now.</h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300">
            Create an account with a username and password, wait for admin approval, then use the shared LinkedIn
            cache, search viewer, and usage dashboard.
          </p>
          <div className="mt-8 grid gap-4">
            <AuthFeatureCard
              title="Approval gate"
              description="New accounts stay pending until an admin approves them. Pending or disabled accounts cannot log in."
            />
            <AuthFeatureCard
              title="Admin controls"
              description="Admins can approve users, disable access instantly, and re-enable disabled accounts from the admin panel."
            />
            <AuthFeatureCard
              title="Tracked usage"
              description="Search requests are logged per user, including fresh uncached scrapes versus cache hits."
            />
          </div>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col justify-center px-6 py-8 sm:px-8">
          <div className="flex rounded-full bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => onAuthModeChange("login")}
              className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${
                authMode === "login" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => onAuthModeChange("register")}
              className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${
                authMode === "register" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}
            >
              Create account
            </button>
          </div>

          <div className="mt-6">
            <h2 className="text-2xl font-bold text-slate-900">
              {authMode === "login" ? "Sign in with your account" : "Request a new account"}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {authMode === "login"
                ? "Only approved and enabled users can sign in."
                : "Your account will stay pending until an admin approves it."}
            </p>
          </div>

          <label htmlFor="auth-username" className="mt-6 block text-sm font-semibold text-slate-700">
            Username
          </label>
          <input
            id="auth-username"
            value={username}
            onChange={(event) => onUsernameChange(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 shadow-inner focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            placeholder="your.username"
            autoComplete="username"
            autoFocus
          />

          <label htmlFor="auth-password" className="mt-4 block text-sm font-semibold text-slate-700">
            Password
          </label>
          <input
            id="auth-password"
            type="password"
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 shadow-inner focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            placeholder="At least 8 characters"
            autoComplete={authMode === "login" ? "current-password" : "new-password"}
          />

          {error ? <p className="mt-4 text-sm font-medium text-red-600">{error}</p> : null}
          {message ? (
            <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 ring-1 ring-emerald-100">
              {message}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {submitting
              ? authMode === "login"
                ? "Signing in..."
                : "Creating account..."
              : authMode === "login"
                ? "Sign in"
                : "Create account"}
          </button>

          <p className="mt-4 text-xs leading-6 text-slate-500">
            Usernames allow letters, numbers, dots, dashes, and underscores. Passwords must be at least 8 characters.
          </p>
        </form>
      </div>
    </div>
  );
}

function AuthFeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-300">{description}</p>
    </div>
  );
}

function UsagePanel({
  dashboard,
  loading,
  error,
  usagePreset,
  customStartDate,
  customEndDate,
  surfaceStyle,
  mutedSurfaceStyle,
  onPresetChange,
  onCustomStartDateChange,
  onCustomEndDateChange,
  onRefresh,
}: {
  dashboard: UsageDashboardDTO | null;
  loading: boolean;
  error: string | null;
  usagePreset: UsagePreset;
  customStartDate: string;
  customEndDate: string;
  surfaceStyle: CSSProperties;
  mutedSurfaceStyle: CSSProperties;
  onPresetChange: (preset: UsagePreset) => void;
  onCustomStartDateChange: (value: string) => void;
  onCustomEndDateChange: (value: string) => void;
  onRefresh: () => Promise<void> | void;
}) {
  if (loading && !dashboard) {
    return (
      <InfoSection title="Usage" surfaceStyle={surfaceStyle}>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-transparent" />
          Loading usage metrics...
        </div>
      </InfoSection>
    );
  }

  if (!dashboard) {
    return (
      <InfoSection title="Usage" surfaceStyle={surfaceStyle}>
        <EmptyState label={error ?? "Usage metrics are not available yet."} />
      </InfoSection>
    );
  }

  const usageChartData = dashboard.users.map((user) => ({
    id: user.id,
    username: user.username,
    role: user.role,
    status: user.status,
    freshSearches: user.freshSearches,
    cachedSearches: user.cachedSearches,
    totalSearches: user.totalSearches,
    isCurrentUser: user.id === dashboard.currentUser.id,
    lastSearchAt: user.lastSearchAt,
  }));
  const chartHeight = 420;
  const chartWidth = Math.max(720, usageChartData.length * 92);
  const activeUsersInWindow = dashboard.users.filter((user) => user.totalSearches > 0).length;

  return (
    <div className="space-y-6">
      <InfoSection title="Usage Window" surfaceStyle={surfaceStyle}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {[
              { value: "today", label: "Today" },
              { value: "last3days", label: "Last 3 days" },
              { value: "lastWeek", label: "Last week" },
              { value: "lastMonth", label: "Last month" },
              { value: "total", label: "Total" },
              { value: "custom", label: "Custom" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onPresetChange(option.value as UsagePreset)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  usagePreset === option.value
                    ? "bg-sky-600 text-white shadow-md shadow-sky-200"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {usagePreset === "custom" ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:flex-row sm:items-end">
              <label className="flex-1 text-sm font-semibold text-slate-700">
                Start date
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(event) => onCustomStartDateChange(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                />
              </label>
              <label className="flex-1 text-sm font-semibold text-slate-700">
                End date
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(event) => onCustomEndDateChange(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                />
              </label>
              <button
                type="button"
                onClick={() => void onRefresh()}
                className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
              >
                Apply
              </button>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-600 shadow-inner">
            <div>
              <p className="font-semibold text-slate-800">Current window: {dashboard.filter.label}</p>
              <p className="mt-1 text-xs text-slate-500">
                {activeUsersInWindow.toLocaleString()} active users, {dashboard.totals.totalSearches.toLocaleString()} total requests,{" "}
                {dashboard.totals.freshSearches.toLocaleString()} fresh, {dashboard.totals.cachedSearches.toLocaleString()} cached.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void onRefresh()}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Refresh
            </button>
          </div>
        </div>
      </InfoSection>

      <InfoSection title="User Usage Comparison" surfaceStyle={surfaceStyle}>
        <div
          className="overflow-hidden rounded-[1.8rem] border border-slate-100 p-4 shadow-inner shadow-slate-200/50"
          style={{
            ...mutedSurfaceStyle,
            background: "var(--usage-chart-surface)",
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 px-1 pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Comparison chart</p>
              <h3 className="mt-1 text-xl font-bold text-slate-900">Fresh and cached searches by user</h3>
              <p className="mt-2 text-sm text-slate-600">
                Hover any bar to inspect the user, total volume, fresh vs cached split, and last search time.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-slate-600">
              <span className="rounded-full bg-white px-3 py-1 font-semibold ring-1 ring-slate-200">
                Users {dashboard.totals.totalUsers.toLocaleString()}
              </span>
              <span className="rounded-full bg-white px-3 py-1 font-semibold ring-1 ring-slate-200">
                Cached profiles {dashboard.totals.cachedProfiles.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto pb-2">
            <div style={{ width: chartWidth, height: chartHeight }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={usageChartData}
                  margin={{ top: 16, right: 18, bottom: 84, left: 0 }}
                  barCategoryGap="18%"
                >
                  <CartesianGrid strokeDasharray="4 4" stroke="var(--chart-grid)" vertical={false} />
                  <XAxis
                    dataKey="username"
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                    angle={-28}
                    textAnchor="end"
                    height={72}
                    tick={{ fill: "var(--chart-axis)", fontSize: 12, fontWeight: 600 }}
                    tickFormatter={(value: string) => truncateLabel(value, 14)}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    tick={{ fill: "var(--chart-axis-muted)", fontSize: 12 }}
                    tickFormatter={(value: number) => formatCompactNumber(value)}
                  />
                  <Tooltip content={<UsageChartTooltip />} cursor={{ fill: "var(--chart-cursor)" }} />
                  <Bar
                    dataKey="freshSearches"
                    name="Fresh"
                    stackId="usage"
                    radius={[0, 0, 8, 8]}
                    maxBarSize={46}
                  >
                    {usageChartData.map((entry) => (
                      <Cell
                        key={`fresh-${entry.id}`}
                        fill={entry.isCurrentUser ? "var(--chart-fresh-active)" : "var(--chart-fresh)"}
                      />
                    ))}
                  </Bar>
                  <Bar
                    dataKey="cachedSearches"
                    name="Cached"
                    stackId="usage"
                    radius={[8, 8, 0, 0]}
                    maxBarSize={46}
                  >
                    {usageChartData.map((entry) => (
                      <Cell
                        key={`cached-${entry.id}`}
                        fill={entry.isCurrentUser ? "var(--chart-cached-active)" : "var(--chart-cached)"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </InfoSection>
    </div>
  );
}

function UsageChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    value?: number | string;
    name?: string;
    color?: string;
    payload: {
      username: string;
      totalSearches: number;
      freshSearches: number;
      cachedSearches: number;
      role: "admin" | "user";
      status: UserStatus;
      isCurrentUser: boolean;
      lastSearchAt: string | null;
    };
  }>;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const item = payload[0]?.payload;
  if (!item) {
    return null;
  }

  return (
    <div
      className="min-w-64 rounded-2xl border p-4 backdrop-blur"
      style={{
        backgroundColor: "var(--tooltip-background)",
        borderColor: "var(--tooltip-border)",
        boxShadow: "0 22px 52px var(--tooltip-shadow)",
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-slate-900">{item.username}</p>
        <StatusBadge status={item.status} />
        <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
          {item.role === "admin" ? "Admin" : "User"}
        </span>
        {item.isCurrentUser ? (
          <span className="rounded-full bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-700 ring-1 ring-sky-100">
            You
          </span>
        ) : null}
      </div>
      <div className="mt-3 grid gap-2 text-xs text-slate-600">
        <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-3 py-2">
          <span>Total requests</span>
          <span className="font-semibold text-slate-900">{item.totalSearches.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between gap-4 rounded-xl bg-emerald-50 px-3 py-2 text-emerald-700">
          <span>Fresh searches</span>
          <span className="font-semibold">{item.freshSearches.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between gap-4 rounded-xl bg-amber-50 px-3 py-2 text-amber-700">
          <span>Cached searches</span>
          <span className="font-semibold">{item.cachedSearches.toLocaleString()}</span>
        </div>
      </div>
      {item.lastSearchAt ? <p className="mt-3 text-xs text-slate-500">Last search {formatDate(item.lastSearchAt)}</p> : null}
    </div>
  );
}

function AdminPanel({
  dashboard,
  loading,
  error,
  message,
  actionUserId,
  currentUserId,
  surfaceStyle,
  mutedSurfaceStyle,
  onRefresh,
  onAction,
  onProtectedError,
}: {
  dashboard: UsageDashboardDTO | null;
  loading: boolean;
  error: string | null;
  message: string | null;
  actionUserId: string | null;
  currentUserId: string;
  surfaceStyle: CSSProperties;
  mutedSurfaceStyle: CSSProperties;
  onRefresh: () => Promise<void> | void;
  onAction: (userId: string, action: AdminAction) => Promise<void> | void;
  onProtectedError: (error: unknown, fallback: string) => string;
}) {
  const [adminSection, setAdminSection] = useState<AdminSection>("users");
  const [apifyTokens, setApifyTokens] = useState<ApifyTokenDTO[]>([]);
  const [apifyTokensLoading, setApifyTokensLoading] = useState(false);
  const [apifyTokensError, setApifyTokensError] = useState<string | null>(null);
  const [apifyTokensMessage, setApifyTokensMessage] = useState<string | null>(null);
  const [editingTokenId, setEditingTokenId] = useState<string | null>(null);
  const [apifyTokenValue, setApifyTokenValue] = useState("");
  const [apifyTokenMetadata, setApifyTokenMetadata] = useState("");
  const [apifyTokenActivateNow, setApifyTokenActivateNow] = useState(false);
  const [apifyTokenSubmitting, setApifyTokenSubmitting] = useState(false);
  const [apifyTokenBusyId, setApifyTokenBusyId] = useState<string | null>(null);
  const activeApifyToken = apifyTokens.find((token) => token.isActive) ?? null;
  const isEditingApifyToken = Boolean(editingTokenId);
  const handleLoadApifyTokensEffect = useEffectEvent(() => {
    void loadApifyTokens();
  });

  useEffect(() => {
    if (adminSection !== "tokens") {
      return;
    }

    handleLoadApifyTokensEffect();
  }, [adminSection]);

  useEffect(() => {
    if (!apifyTokensMessage) {
      return;
    }

    const timer = window.setTimeout(() => setApifyTokensMessage(null), 2500);
    return () => window.clearTimeout(timer);
  }, [apifyTokensMessage]);

  if (loading && !dashboard) {
    return (
      <InfoSection title="Admin" surfaceStyle={surfaceStyle}>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-transparent" />
          Loading admin data...
        </div>
      </InfoSection>
    );
  }

  if (!dashboard) {
    return (
      <InfoSection title="Admin" surfaceStyle={surfaceStyle}>
        <EmptyState label={error ?? "Admin data is not available."} />
      </InfoSection>
    );
  }

  async function loadApifyTokens() {
    try {
      setApifyTokensLoading(true);
      setApifyTokensError(null);

      const payload = await fetchJson<{ tokens: ApifyTokenDTO[] }>("/api/admin/apify-tokens", {
        cache: "no-store",
      });
      const nextTokens = payload.tokens ?? [];
      setApifyTokens(nextTokens);

      if (!editingTokenId) {
        setApifyTokenActivateNow(!nextTokens.some((token) => token.isActive));
      }

      return nextTokens;
    } catch (err) {
      setApifyTokensError(onProtectedError(err, "Unable to load Apify tokens."));
      return [];
    } finally {
      setApifyTokensLoading(false);
    }
  }

  function resetApifyTokenForm(nextTokens: ApifyTokenDTO[] = apifyTokens) {
    setEditingTokenId(null);
    setApifyTokenValue("");
    setApifyTokenMetadata("");
    setApifyTokenActivateNow(!nextTokens.some((token) => token.isActive));
  }

  function startEditingApifyToken(token: ApifyTokenDTO) {
    setEditingTokenId(token.id);
    setApifyTokenValue("");
    setApifyTokenMetadata(token.metadata);
    setApifyTokenActivateNow(token.isActive);
    setApifyTokensError(null);
    setApifyTokensMessage(null);
  }

  async function handleApifyTokenSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedMetadata = apifyTokenMetadata.trim();
    const trimmedToken = apifyTokenValue.trim();

    if (!trimmedMetadata) {
      setApifyTokensError("Metadata is required.");
      return;
    }

    if (!isEditingApifyToken && !trimmedToken) {
      setApifyTokensError("Apify token is required.");
      return;
    }

    try {
      setApifyTokenSubmitting(true);
      setApifyTokensError(null);
      setApifyTokensMessage(null);

      if (editingTokenId) {
        await fetchJson<{ ok: boolean }>(`/api/admin/apify-tokens/${editingTokenId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            metadata: trimmedMetadata,
            ...(trimmedToken ? { token: trimmedToken } : {}),
            ...(apifyTokenActivateNow ? { activate: true } : {}),
          }),
        });
      } else {
        await fetchJson<{ ok: boolean }>("/api/admin/apify-tokens", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: trimmedToken,
            metadata: trimmedMetadata,
            activate: apifyTokenActivateNow,
          }),
        });
      }

      const nextTokens = await loadApifyTokens();
      resetApifyTokenForm(nextTokens);
      setApifyTokensMessage(editingTokenId ? "Apify token updated." : "Apify token added.");
    } catch (err) {
      setApifyTokensError(
        onProtectedError(err, editingTokenId ? "Unable to update Apify token." : "Unable to add Apify token."),
      );
    } finally {
      setApifyTokenSubmitting(false);
    }
  }

  async function handleApifyTokenActivate(tokenId: string) {
    try {
      setApifyTokenBusyId(tokenId);
      setApifyTokensError(null);
      setApifyTokensMessage(null);

      await fetchJson<{ ok: boolean }>(`/api/admin/apify-tokens/${tokenId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activate: true }),
      });

      const nextTokens = await loadApifyTokens();
      if (editingTokenId === tokenId) {
        setApifyTokenActivateNow(true);
      } else if (!editingTokenId) {
        setApifyTokenActivateNow(!nextTokens.some((token) => token.isActive));
      }
      setApifyTokensMessage("Apify token activated.");
    } catch (err) {
      setApifyTokensError(onProtectedError(err, "Unable to activate Apify token."));
    } finally {
      setApifyTokenBusyId(null);
    }
  }

  async function handleApifyTokenDelete(tokenId: string) {
    const target = apifyTokens.find((token) => token.id === tokenId);
    if (!target) {
      return;
    }

    const confirmed = window.confirm(
      `Delete the Apify token "${target.metadata}"? If it is active, new searches will stop until another token is activated.`,
    );
    if (!confirmed) {
      return;
    }

    try {
      setApifyTokenBusyId(tokenId);
      setApifyTokensError(null);
      setApifyTokensMessage(null);

      await fetchJson<{ ok: boolean }>(`/api/admin/apify-tokens/${tokenId}`, {
        method: "DELETE",
      });

      const nextTokens = await loadApifyTokens();
      if (editingTokenId === tokenId) {
        resetApifyTokenForm(nextTokens);
      } else if (!editingTokenId) {
        setApifyTokenActivateNow(!nextTokens.some((token) => token.isActive));
      }
      setApifyTokensMessage("Apify token deleted.");
    } catch (err) {
      setApifyTokensError(onProtectedError(err, "Unable to delete Apify token."));
    } finally {
      setApifyTokenBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <InfoSection title="Admin" surfaceStyle={surfaceStyle}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Controls</p>
            <h3 className="mt-1 text-lg font-bold text-slate-900">Users and Apify token management</h3>
            <p className="mt-2 text-sm text-slate-600">
              Approve users, disable access, and choose the single Apify token used for new searches.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <AdminSectionButton
              label="Users"
              active={adminSection === "users"}
              onClick={() => setAdminSection("users")}
            />
            <AdminSectionButton
              label="Apify Tokens"
              active={adminSection === "tokens"}
              onClick={() => setAdminSection("tokens")}
            />
          </div>
        </div>
      </InfoSection>

      {adminSection === "users" ? (
        <>
          <InfoSection title="Admin Controls" surfaceStyle={surfaceStyle}>
            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div
                className="rounded-2xl border border-slate-100 p-5 shadow-inner shadow-slate-200"
                style={mutedSurfaceStyle}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Workflow</p>
                <div className="mt-3 space-y-3 text-sm leading-7 text-slate-700">
                  <p>Approve pending users before they can log in.</p>
                  <p>Disable users to block access immediately and revoke any active sessions.</p>
                  <p>Enable disabled users to restore access. Fresh and cached search counts remain preserved.</p>
                </div>
              </div>
              <div
                className="rounded-2xl border border-slate-100 p-5 shadow-inner shadow-slate-200"
                style={mutedSurfaceStyle}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Overview</p>
                    <h3 className="mt-1 text-lg font-bold text-slate-900">User account state</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => void onRefresh()}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Refresh
                  </button>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <UsageStatChip label="Approved" value={dashboard.totals.approvedUsers} />
                  <UsageStatChip label="Pending" value={dashboard.totals.pendingUsers} />
                  <UsageStatChip label="Disabled" value={dashboard.totals.disabledUsers} />
                  <UsageStatChip label="Sessions" value={dashboard.totals.activeSessions} />
                </div>
              </div>
            </div>
            {message ? (
              <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 ring-1 ring-emerald-100">
                {message}
              </div>
            ) : null}
            {error ? <p className="mt-4 text-sm font-medium text-red-600">{error}</p> : null}
          </InfoSection>

          <InfoSection title="User Management" surfaceStyle={surfaceStyle}>
            <div className="space-y-4">
              {dashboard.users.map((user) => {
                const isSelf = user.id === currentUserId;
                const showApprove = user.status === "pending";
                const showDisable = user.status === "approved" && !isSelf;
                const showEnable = user.status === "disabled";
                const actionBusy = actionUserId === user.id;

                return (
                  <div
                    key={user.id}
                    className="rounded-2xl border border-slate-100 p-4 shadow-sm shadow-slate-200/50"
                    style={mutedSurfaceStyle}
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold text-slate-900">{user.username}</p>
                          <StatusBadge status={user.status} />
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                            {user.role === "admin" ? "Admin" : "User"}
                          </span>
                          {isSelf ? (
                            <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                              Current session
                            </span>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                          <span className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">
                            Fresh {user.freshSearches.toLocaleString()}
                          </span>
                          <span className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">
                            Cached {user.cachedSearches.toLocaleString()}
                          </span>
                          <span className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">
                            Total {user.totalSearches.toLocaleString()}
                          </span>
                          <span className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">
                            Created {formatDateOnly(user.createdAt)}
                          </span>
                          {user.lastLoginAt ? (
                            <span className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">
                              Last login {formatDate(user.lastLoginAt)}
                            </span>
                          ) : null}
                          {user.lastSearchAt ? (
                            <span className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">
                              Last search {formatDate(user.lastSearchAt)}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {showApprove ? (
                          <button
                            type="button"
                            onClick={() => void onAction(user.id, "approve")}
                            disabled={actionBusy}
                            className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                          >
                            {actionBusy ? "Working..." : "Approve"}
                          </button>
                        ) : null}
                        {showEnable ? (
                          <button
                            type="button"
                            onClick={() => void onAction(user.id, "enable")}
                            disabled={actionBusy}
                            className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                          >
                            {actionBusy ? "Working..." : "Enable"}
                          </button>
                        ) : null}
                        {showDisable ? (
                          <button
                            type="button"
                            onClick={() => void onAction(user.id, "disable")}
                            disabled={actionBusy}
                            className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                          >
                            {actionBusy ? "Working..." : "Disable"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </InfoSection>
        </>
      ) : (
        <InfoSection title="Apify Tokens" surfaceStyle={surfaceStyle}>
          <div className="grid gap-5 xl:grid-cols-[0.95fr_1.25fr]">
            <form
              onSubmit={handleApifyTokenSubmit}
              className="rounded-3xl border border-slate-100 p-5 shadow-sm shadow-slate-200/40"
              style={mutedSurfaceStyle}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                    {isEditingApifyToken ? "Edit token" : "Add token"}
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-slate-900">
                    {isEditingApifyToken ? "Update Apify token" : "Register a new Apify token"}
                  </h3>
                </div>
                {isEditingApifyToken ? (
                  <button
                    type="button"
                    onClick={() => resetApifyTokenForm()}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                ) : null}
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-white/70 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Current live token</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {activeApifyToken ? activeApifyToken.metadata : "No active token selected"}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  {activeApifyToken
                    ? `${activeApifyToken.tokenPreview} is currently used for fresh searches.`
                    : "Activate one token so new uncached searches can run."}
                </p>
              </div>

              <label htmlFor="apify-token-metadata" className="mt-5 block text-sm font-semibold text-slate-700">
                Metadata
              </label>
              <input
                id="apify-token-metadata"
                value={apifyTokenMetadata}
                onChange={(event) => setApifyTokenMetadata(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-inner focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                placeholder="Team account, backup token, project owner, etc."
              />

              <label htmlFor="apify-token-value" className="mt-4 block text-sm font-semibold text-slate-700">
                {isEditingApifyToken ? "Replace token" : "Apify token"}
              </label>
              <input
                id="apify-token-value"
                type="password"
                value={apifyTokenValue}
                onChange={(event) => setApifyTokenValue(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-inner focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                placeholder={isEditingApifyToken ? "Leave blank to keep the current secret" : "apify_api_..."}
                autoComplete="off"
              />

              <label className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={apifyTokenActivateNow}
                  onChange={(event) => setApifyTokenActivateNow(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                <span className="font-medium">Use this token for new searches after saving</span>
              </label>

              {apifyTokensError ? <p className="mt-4 text-sm font-medium text-red-600">{apifyTokensError}</p> : null}
              {apifyTokensMessage ? (
                <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 ring-1 ring-emerald-100">
                  {apifyTokensMessage}
                </div>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={apifyTokenSubmitting}
                  className="rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {apifyTokenSubmitting
                    ? isEditingApifyToken
                      ? "Saving..."
                      : "Adding..."
                    : isEditingApifyToken
                      ? "Save token"
                      : "Add token"}
                </button>
                {isEditingApifyToken ? (
                  <button
                    type="button"
                    onClick={() => resetApifyTokenForm()}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Cancel edit
                  </button>
                ) : null}
              </div>
            </form>

            <div
              className="rounded-3xl border border-slate-100 shadow-sm shadow-slate-200/40"
              style={mutedSurfaceStyle}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Token table</p>
                  <h3 className="mt-1 text-lg font-bold text-slate-900">Registered Apify tokens</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Monthly usage and monthly limit are synced live from Apify for each token.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadApifyTokens()}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Refresh
                </button>
              </div>

              {apifyTokensLoading ? (
                <div className="flex items-center gap-2 px-5 py-5 text-sm text-slate-500">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-transparent" />
                  Loading Apify tokens...
                </div>
              ) : null}

              {!apifyTokensLoading && apifyTokens.length === 0 ? (
                <div className="px-5 py-8 text-sm text-slate-500">
                  No Apify tokens are configured yet. Add one and activate it to enable fresh uncached searches.
                </div>
              ) : null}

              {!apifyTokensLoading && apifyTokens.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left">
                    <thead className="bg-white/60 text-xs uppercase tracking-[0.22em] text-slate-500">
                      <tr>
                        <th className="px-5 py-3 font-semibold">Token</th>
                        <th className="px-5 py-3 font-semibold">Monthly usage</th>
                        <th className="px-5 py-3 font-semibold">Billing cycle</th>
                        <th className="px-5 py-3 font-semibold">Status</th>
                        <th className="px-5 py-3 text-right font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {apifyTokens.map((token) => {
                        const rowBusy = apifyTokenBusyId === token.id;

                        return (
                          <tr key={token.id} className="align-top">
                            <td className="px-5 py-4">
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-semibold text-slate-900">{token.metadata}</p>
                                  {token.isActive ? (
                                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-100">
                                      Active
                                    </span>
                                  ) : null}
                                </div>
                                <p className="font-mono text-xs text-slate-500">{token.tokenPreview}</p>
                                <p className="text-xs text-slate-500">Updated {formatDate(token.updatedAt)}</p>
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <ApifyUsageMeter token={token} />
                            </td>
                            <td className="px-5 py-4">
                              <p className="text-sm font-medium text-slate-800">
                                {formatApifyCycle(token.cycleStartAt, token.cycleEndAt)}
                              </p>
                              {token.usageFetchedAt ? (
                                <p className="mt-1 text-xs text-slate-500">Synced {formatDate(token.usageFetchedAt)}</p>
                              ) : null}
                            </td>
                            <td className="px-5 py-4">
                              {token.usageError ? (
                                <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-100">
                                  Usage unavailable
                                </span>
                              ) : token.isActive ? (
                                <span className="rounded-full bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-100">
                                  Serving searches
                                </span>
                              ) : (
                                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                                  Idle
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => startEditingApifyToken(token)}
                                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                                >
                                  Edit
                                </button>
                                {!token.isActive ? (
                                  <button
                                    type="button"
                                    onClick={() => void handleApifyTokenActivate(token.id)}
                                    disabled={rowBusy}
                                    className="rounded-full bg-sky-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                                  >
                                    {rowBusy ? "Working..." : "Activate"}
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => void handleApifyTokenDelete(token.id)}
                                  disabled={rowBusy}
                                  className="rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                                >
                                  {rowBusy ? "Working..." : "Delete"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          </div>
        </InfoSection>
      )}
    </div>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
        active
          ? "bg-sky-600 text-white shadow-md shadow-sky-200"
          : "border border-slate-200 bg-white/80 text-slate-700 hover:bg-white"
      }`}
    >
      {label}
    </button>
  );
}

function StatusBadge({ status }: { status: UserStatus }) {
  const config =
    status === "approved"
      ? { label: "Approved", className: "bg-emerald-50 text-emerald-700 ring-emerald-100" }
      : status === "disabled"
        ? { label: "Disabled", className: "bg-rose-50 text-rose-700 ring-rose-100" }
        : { label: "Pending", className: "bg-amber-50 text-amber-700 ring-amber-100" };

  return (
    <span className={`rounded-full px-2 py-1 text-xs font-semibold ring-1 ${config.className}`}>{config.label}</span>
  );
}

function UsageStatChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-bold text-slate-900">{value.toLocaleString()}</p>
    </div>
  );
}

function AdminSectionButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
        active
          ? "bg-sky-600 text-white shadow-md shadow-sky-200"
          : "border border-slate-200 bg-white/80 text-slate-700 hover:bg-white"
      }`}
    >
      {label}
    </button>
  );
}

function ApifyUsageMeter({ token }: { token: ApifyTokenDTO }) {
  if (token.usageError) {
    return <p className="max-w-56 text-xs leading-5 text-amber-700">{token.usageError}</p>;
  }

  const usage = token.monthlyUsageUsd;
  const limit = token.maxMonthlyUsageUsd;
  const ratio = usage !== null && limit && limit > 0 ? Math.min(100, (usage / limit) * 100) : 0;

  return (
    <div className="min-w-56">
      <div className="flex items-center justify-between gap-3 text-sm font-semibold text-slate-800">
        <span>{formatCurrency(usage)}</span>
        <span className="text-slate-500">/ {formatCurrency(limit)}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-500 transition-all"
          style={{ width: `${ratio}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {limit && limit > 0 ? `${ratio.toFixed(1)}% of monthly usage limit` : "Monthly limit unavailable"}
      </p>
    </div>
  );
}

function ThemeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M12 4.5a7.5 7.5 0 1 0 7.5 7.5A6 6 0 0 1 12 4.5Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m17.5 6.5.8-1.7.8 1.7 1.7.8-1.7.8-.8 1.7-.8-1.7-1.7-.8 1.7-.8Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.2" strokeLinecap="round" />
      <path d="M12 19.3v2.2" strokeLinecap="round" />
      <path d="m4.9 4.9 1.6 1.6" strokeLinecap="round" />
      <path d="m17.5 17.5 1.6 1.6" strokeLinecap="round" />
      <path d="M2.5 12h2.2" strokeLinecap="round" />
      <path d="M19.3 12h2.2" strokeLinecap="round" />
      <path d="m4.9 19.1 1.6-1.6" strokeLinecap="round" />
      <path d="m17.5 6.5 1.6-1.6" strokeLinecap="round" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path
        d="M19.2 14.6a7.7 7.7 0 0 1-9.8-9.8 8.3 8.3 0 1 0 9.8 9.8Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchGearIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="10.5" cy="10.5" r="5" />
      <path d="m14.5 14.5 4 4" strokeLinecap="round" />
      <path d="M17 6.8h2" strokeLinecap="round" />
      <path d="M18 5.8v2" strokeLinecap="round" />
      <path d="m16.8 6.1.9.9" strokeLinecap="round" />
      <path d="m16.8 7.5.9-.9" strokeLinecap="round" />
    </svg>
  );
}

function NavTopIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M12 19V7" strokeLinecap="round" />
      <path d="m7 12 5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function NavPreviewIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M2.5 12c1.5-4 5.1-6.5 9.5-6.5s8 2.5 9.5 6.5c-1.5 4-5.1 6.5-9.5 6.5S4 16 2.5 12Z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function NavAboutIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10v6" strokeLinecap="round" />
      <circle cx="12" cy="7.5" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function NavExperienceIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="3.5" y="7.5" width="17" height="11" rx="2" />
      <path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5" strokeLinecap="round" />
      <path d="M3.5 12.5h17" strokeLinecap="round" />
    </svg>
  );
}

function NavEducationIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="m2.5 9.5 9.5-4 9.5 4-9.5 4-9.5-4Z" strokeLinejoin="round" />
      <path d="M6.5 11.5v4.3c0 .9 2.5 2.7 5.5 2.7s5.5-1.8 5.5-2.7v-4.3" strokeLinecap="round" />
      <path d="M21.5 10v5" strokeLinecap="round" />
    </svg>
  );
}

function NavSkillsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="m12 3.8 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.2-4.1 5.8-.8L12 3.8Z" strokeLinejoin="round" />
    </svg>
  );
}

function ProfileHero({
  profile,
  topSkills,
  surfaceStyle,
  mutedSurfaceStyle,
  onCopyProfile,
  copying,
  copyMessage,
}: {
  profile: LinkedInProfile | null;
  topSkills: string[];
  surfaceStyle: CSSProperties;
  mutedSurfaceStyle: CSSProperties;
  onCopyProfile: () => Promise<void> | void;
  copying: boolean;
  copyMessage: string | null;
}) {
  const coverUrl = imageUrl(profile?.coverPicture);
  const avatarUrl = imageUrl(profile?.profilePicture) ?? imageUrl(profile?.photo);
  const locationText = profile?.location?.linkedinText ?? profile?.location?.parsed?.text;
  const name = buildDisplayName(profile) || "Unnamed profile";
  const currentCompanies = (profile?.currentPosition ?? [])
    .map((pos) => pos.companyName)
    .filter(Boolean)
    .join(", ");
  const followerText = profile?.followerCount
    ? `${profile.followerCount.toLocaleString()} followers`
    : "";
  const connectionText = profile?.connectionsCount 
    ? `${profile.connectionsCount.toLocaleString()} connections` 
    : "";
  const badges = [
    profile?.verified ? "Verified" : null,
    profile?.openToWork ? "Open to work" : null,
    profile?.hiring ? "Hiring" : null,
    profile?.premium ? "Premium" : null,
    profile?.influencer ? "Top voice" : null,
  ].filter(Boolean) as string[];

  const metaChips = [
    profile?.publicIdentifier ? `@${profile.publicIdentifier}` : null,
    profile?.id ? `ID ${profile.id}` : null,
    profile?.objectUrn ?? null,
    profile?.registeredAt ? `Joined ${formatDateOnly(profile.registeredAt)}` : null,
  ].filter(Boolean) as string[];

  if (!profile) {
    return (
      <div
        className="rounded-3xl border border-dashed border-slate-200 p-10 text-center text-slate-600 shadow-sm"
        style={surfaceStyle}
      >
        <p className="text-lg font-semibold text-slate-800">LinkedIn preview</p>
        <p className="mt-2 text-sm">Search for a profile to render a LinkedIn-style view.</p>
      </div>
    );
  }

  return (
    <div
      className="overflow-hidden rounded-3xl border border-slate-100 shadow-lg shadow-slate-200/70"
      style={surfaceStyle}
    >
      <div
        className="relative h-44 w-full overflow-hidden bg-gradient-to-r from-[#0a66c2] via-[#0b75e0] to-[#53b1fd]"
        style={coverUrl ? { backgroundImage: `url(${coverUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : {}}
      >
        <div className="profile-cover-overlay absolute inset-0" />
      </div>
      <div className="space-y-5 px-6 pb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex gap-4">
            <Avatar name={name} url={avatarUrl} size="xl" />
            <div className="space-y-2">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">{name}</h2>
                <p className="text-base text-slate-700">{profile.headline}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                {locationText && <span>{locationText}</span>}
                {currentCompanies && <span>| {currentCompanies}</span>}
                {followerText && <span>| {followerText}</span>}
                {connectionText && <span>| {connectionText}</span>}
              </div>
              {badges.length ? (
                <div className="flex flex-wrap gap-2">
                  {badges.map((badge) => (
                    <span
                      key={badge}
                      className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800 ring-1 ring-sky-100"
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              ) : null}
              {topSkills.length ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {topSkills.slice(0, 3).map((skill) => (
                    <span key={skill} className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                      {skill}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {profile.linkedinUrl ? (
              <a
                href={profile.linkedinUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1 rounded-full border border-sky-200 bg-white/80 px-4 py-2 text-sm font-semibold text-sky-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
              >
                View profile
                <span aria-hidden className="text-[10px]">↗</span>
              </a>
            ) : null}
            <button
              type="button"
              onClick={onCopyProfile}
              disabled={!profile || copying}
              className="inline-flex items-center justify-center gap-1 rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {copying ? (
                <>
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                  Copying...
                </>
              ) : (
                <>Copy profile</>
              )}
            </button>
            {copyMessage ? (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
                {copyMessage}
              </span>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-100 p-4 shadow-sm" style={mutedSurfaceStyle}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Headline</p>
            <p className="mt-1 text-sm text-slate-800">{profile.headline || "Not provided"}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
              {locationText && <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold">{locationText}</span>}
              {followerText && <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold">{followerText}</span>}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-100 p-4 shadow-sm" style={mutedSurfaceStyle}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current company</p>
            <p className="mt-1 text-sm text-slate-800">{currentCompanies || "Not listed"}</p>
            {topSkills.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {topSkills.slice(0, 4).map((skill) => (
                  <span key={skill} className="rounded-full bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-800 ring-1 ring-sky-100">
                    {skill}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <div className="rounded-2xl border border-slate-100 p-4 shadow-sm" style={mutedSurfaceStyle}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Profile details</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-700">
              {metaChips.map((chip) => (
                <span key={chip} className="rounded-full bg-slate-100 px-2 py-1 font-semibold">
                  {chip}
                </span>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function BatchSummaryStat({
  label,
  value,
  accentClassName,
}: {
  label: string;
  value: number;
  accentClassName: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white/75 px-4 py-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-2xl font-bold text-slate-900">{value.toLocaleString()}</p>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${accentClassName}`}>{label}</span>
      </div>
    </div>
  );
}

function BatchProfileResultCard({
  item,
  onOpenPreview,
  surfaceStyle,
}: {
  item: BatchSearchItem;
  onOpenPreview: (item: BatchSearchItem) => void;
  surfaceStyle: CSSProperties;
}) {
  const profile = item.profile;
  const name = buildDisplayName(profile) || profile?.publicIdentifier || "LinkedIn profile";
  const avatarUrl = imageUrl(profile?.profilePicture) ?? imageUrl(profile?.photo);
  const locationText = profile?.location?.linkedinText ?? profile?.location?.parsed?.text;
  const currentCompanies = (profile?.currentPosition ?? [])
    .map((position) => position.companyName)
    .filter(Boolean)
    .join(", ");
  const metrics = [
    profile?.followerCount ? `${formatCompactNumber(profile.followerCount)} followers` : null,
    profile?.connectionsCount ? `${formatCompactNumber(profile.connectionsCount)} connections` : null,
  ].filter(Boolean) as string[];
  const { label, className } = batchStatusConfig(item.status);

  return (
    <article className="rounded-3xl border border-slate-100 p-5 shadow-sm shadow-slate-200/50" style={surfaceStyle}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${className}`}>{label}</span>
          {item.source ? (
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
              {item.source === "cache" ? "Cache hit" : "Fresh scrape"}
            </span>
          ) : null}
        </div>
        {item.createdAt ? <span className="text-xs text-slate-500">{formatDate(item.createdAt)}</span> : null}
      </div>

      <div className="mt-3 rounded-2xl bg-white/70 px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-200">
        <p className="line-clamp-2 break-all font-medium text-slate-700">{item.url}</p>
        {item.inputUrl !== item.url ? <p className="mt-1 line-clamp-2 break-all text-slate-500">Input: {item.inputUrl}</p> : null}
      </div>

      {profile ? (
        <>
          <div className="mt-4 flex items-start gap-3">
            <Avatar name={name} url={avatarUrl} size="sm" />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="line-clamp-1 text-base font-semibold text-slate-900">{name}</p>
              <p className="line-clamp-2 text-sm text-slate-700">{profile.headline || "No headline returned"}</p>
              <p className="line-clamp-2 text-xs text-slate-500">
                {[locationText, currentCompanies].filter(Boolean).join(" | ") || "No extra profile details returned"}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {metrics.map((metric) => (
              <span
                key={metric}
                className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200"
              >
                {metric}
              </span>
            ))}
            {profile?.openToWork ? (
              <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-100">
                Open to work
              </span>
            ) : null}
            {profile?.verified ? (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
                Verified
              </span>
            ) : null}
          </div>

          {item.status === "exists" && item.foundBy ? (
            <p className="mt-4 text-xs text-slate-600">
              First found by <span className="font-semibold text-sky-700">{item.foundBy.username}</span> on{" "}
              {formatDate(item.foundBy.foundAt)}.
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onOpenPreview(item)}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              Load full preview
            </button>
            {profile.linkedinUrl ? (
              <a
                href={profile.linkedinUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Open LinkedIn
              </a>
            ) : null}
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50/80 px-4 py-4 text-sm text-rose-700">
          {item.error ?? "Unable to load this profile."}
        </div>
      )}
    </article>
  );
}

function InfoSection({
  id,
  title,
  children,
  surfaceStyle,
}: {
  id?: string;
  title: string;
  children: React.ReactNode;
  surfaceStyle: CSSProperties;
}) {
  return (
    <section id={id} className="scroll-mt-44 rounded-3xl border border-slate-100 p-6 shadow-sm shadow-slate-200/40" style={surfaceStyle}>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function ExperienceCard({ item, surfaceStyle }: { item: ExperienceItem; surfaceStyle: CSSProperties }) {
  const companyLogoUrl = imageUrl(item.companyLogo);
  const range = formatDateRangeParts(item.startDate, item.endDate, item.duration ?? undefined);
  const startText = formatDatePart(item.startDate);
  const endText = item.endDate ? formatDatePart(item.endDate) || "Present" : item.endDate === null ? "Present" : "";
  return (
    <div className="rounded-2xl border border-slate-100 p-5 shadow-inner shadow-slate-200" style={surfaceStyle}>
      <div className="flex items-start gap-3">
        <LogoCircle url={companyLogoUrl} alt={item.companyName ?? undefined} />
        <div className="space-y-1">
          <p className="text-base font-semibold text-slate-900">{item.position ?? "Role"}</p>
          <p className="text-sm font-medium text-slate-700">{item.companyName}</p>
          <p className="text-xs text-slate-500">
            {[item.employmentType, item.workplaceType].filter(Boolean).join(" | ")}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="rounded-full bg-white px-2 py-1 font-semibold text-slate-700 ring-1 ring-slate-200">
              {range || "Dates not specified"}
            </span>
            {item.location ? <span>{item.location}</span> : null}
          </div>
          {(startText || endText) && (
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
              {startText && <span className="rounded bg-white px-2 py-0.5 ring-1 ring-slate-200">{startText}</span>}
              {endText && <span className="rounded bg-white px-2 py-0.5 ring-1 ring-slate-200">{endText}</span>}
            </div>
          )}
        </div>
      </div>
      {item.description && (
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-700">{item.description}</p>
      )}
      {item.skills?.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {item.skills.map((skill) => (
            <span
              key={skill}
              className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200"
            >
              {skill}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function EducationCard({ item, surfaceStyle }: { item: EducationItem; surfaceStyle: CSSProperties }) {
  const logoUrl = imageUrl(item.schoolLogo);
  const range = item.period ?? formatDateRangeParts(item.startDate, item.endDate, undefined);
  return (
    <div
      className="rounded-2xl border border-slate-100 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      style={surfaceStyle}
    >
      <div className="flex items-start gap-3">
        <LogoCircle url={logoUrl} alt={item.schoolName ?? undefined} />
        <div className="space-y-1">
          <p className="text-base font-semibold text-slate-900">{item.schoolName}</p>
          <p className="text-sm text-slate-700">
            {[item.degree, item.fieldOfStudy].filter(Boolean).join(" | ")}
          </p>
          <p className="text-xs text-slate-500">{range}</p>
        </div>
      </div>
    </div>
  );
}

function CertificationCard({ item, surfaceStyle }: { item: CertificationItem; surfaceStyle: CSSProperties }) {
  const logoUrl = imageUrl(item.issuedByLogo);
  return (
    <div className="flex gap-3 rounded-2xl border border-slate-100 p-4 shadow-inner" style={surfaceStyle}>
      <LogoCircle url={logoUrl} alt={item.issuedBy ?? undefined} />
      <div className="space-y-1">
        <p className="text-sm font-semibold text-slate-900">{item.title}</p>
        <p className="text-xs text-slate-600">
          {[item.issuedBy, item.issuedAt].filter(Boolean).join(" | ")}
        </p>
        {item.issuedByLink && (
          <a
            href={item.issuedByLink}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold text-sky-700 hover:underline"
          >
            View issuer
          </a>
        )}
      </div>
    </div>
  );
}

function RecommendationCard({ item, surfaceStyle }: { item: RecommendationItem; surfaceStyle: CSSProperties }) {
  const avatarUrl = imageUrl(item.givenByPicture);
  return (
    <div className="rounded-2xl border border-slate-100 p-4 shadow-sm" style={surfaceStyle}>
      <div className="flex items-start gap-3">
        <Avatar name={item.givenBy ?? "Recommender"} url={avatarUrl} size="sm" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-900">{item.givenBy}</p>
          <p className="text-xs text-slate-600">{item.givenByHeadline}</p>
          <p className="text-[11px] text-slate-500">{item.givenAt}</p>
        </div>
      </div>
      {item.description && (
        <p className="mt-3 text-sm leading-relaxed text-slate-700">{item.description}</p>
      )}
      {item.givenByLink && (
        <a
          href={item.givenByLink}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-xs font-semibold text-sky-700 hover:underline"
        >
          View profile
        </a>
      )}
    </div>
  );
}

function RelatedProfileCard({ item }: { item: RelatedProfile }) {
  const name = [item.firstName, item.lastName].filter(Boolean).join(" ") || item.publicIdentifier || "Profile";
  return (
    <a
      href={item.linkedinUrl}
      target="_blank"
      rel="noreferrer"
      className="flex flex-col gap-1 rounded-2xl border border-slate-100 bg-slate-50/80 p-3 text-sm text-slate-800 shadow-inner transition hover:-translate-y-0.5 hover:bg-white"
    >
      <span className="font-semibold text-slate-900">{name}</span>
      <span className="text-xs text-slate-600">{item.linkedinUrl}</span>
    </a>
  );
}

type ThemeModalProps = {
  themeMode: ThemeMode;
  onThemeModeChange: (value: ThemeMode) => void;
  selectedBackground: string | null;
  onBackgroundSelect: (value: string | null) => void;
  onClose: () => void;
  sectionOpacity: number;
  onOpacityChange: (value: number) => void;
  blur: number;
  onBlurChange: (value: number) => void;
};

function ThemeModal({
  themeMode,
  onThemeModeChange,
  selectedBackground,
  onBackgroundSelect,
  onClose,
  sectionOpacity,
  onOpacityChange,
  blur,
  onBlurChange,
}: ThemeModalProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm">
      <div
        className="flex w-full overflow-hidden rounded-2xl border border-white/30 bg-white/95 shadow-2xl shadow-slate-900/10"
        style={{ maxWidth: "min(1100px, 92vw)", maxHeight: "85vh" }}
      >
        <div className="flex w-full flex-col">
          <div className="flex items-center justify-between border-b border-slate-200/70 px-5 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Appearance</p>
              <h3 className="text-lg font-bold text-slate-900">Color mode, background, and surface</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onBackgroundSelect(null)}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                No image
              </button>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
                aria-label="Close theme panel"
              >
                X
              </button>
            </div>
          </div>

          <div className="grid gap-6 overflow-y-auto px-5 py-5 md:grid-cols-[2fr_1fr]">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800">Background images</p>
                <span className="text-xs text-slate-500">From /public/background images</span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {BACKGROUND_OPTIONS.map((option) => {
                  const url = toBackgroundUrl(option.file);
                  const active = selectedBackground === url;

                  return (
                    <button
                      key={option.file}
                      type="button"
                      onClick={() => onBackgroundSelect(url)}
                      className={`relative overflow-hidden rounded-xl border text-left shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 ${
                        active
                          ? "border-sky-500 ring-2 ring-sky-100"
                          : "border-slate-200 hover:-translate-y-0.5 hover:shadow-md"
                      }`}
                    >
                      <div className="h-24 w-full bg-cover bg-center" style={{ backgroundImage: `url(${url})` }} />
                      <div className="flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-800">
                        <span className="line-clamp-1">{option.label}</span>
                        {active ? <span className="text-sky-600">Selected</span> : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-inner">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Color mode</p>
                    <p className="mt-1 text-xs text-slate-600">Switch the full workspace between light and dark surfaces.</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                    {themeMode === "dark" ? "Dark" : "Light"}
                  </span>
                </div>
                <div className="mt-3">
                  <ThemeModeSegmentedControl themeMode={themeMode} onThemeModeChange={onThemeModeChange} />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-inner">
                <label className="flex items-center justify-between text-sm font-semibold text-slate-800">
                  Section opacity
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-700 ring-1 ring-slate-200">
                    {(sectionOpacity * 100).toFixed(0)}%
                  </span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={sectionOpacity * 100}
                  onChange={(event) => onOpacityChange(Number(event.target.value) / 100)}
                  className="mt-2 w-full accent-sky-600"
                />
                <p className="mt-2 text-xs text-slate-600">
                  Controls card transparency; 0% shows only the background image.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-inner">
                <label className="flex items-center justify-between text-sm font-semibold text-slate-800">
                  Background blur
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-700 ring-1 ring-slate-200">
                    {blur}px
                  </span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={18}
                  step={1}
                  value={blur}
                  onChange={(event) => onBlurChange(Number(event.target.value))}
                  className="mt-2 w-full accent-sky-600"
                />
                <p className="mt-2 text-xs text-slate-600">Softens content over bright photos.</p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-sky-200 transition hover:bg-sky-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Avatar({ name, url, size = "lg" }: { name?: string; url?: string; size?: "lg" | "sm" | "xl" }) {
  const initials = useMemo(() => {
    if (!name) return "IN";
    const parts = name.split(" ");
    const first = parts[0]?.[0] ?? "";
    const last = parts[parts.length - 1]?.[0] ?? "";
    return `${first}${last}`.toUpperCase();
  }, [name]);

  const dimensions = size === "xl" ? "h-28 w-28" : size === "lg" ? "h-24 w-24" : "h-12 w-12";
  const border = size === "xl" || size === "lg" ? "border-4" : "border-2";

  return (
    <div
      className={`relative ${dimensions} overflow-hidden rounded-full ${border} border-white bg-slate-100 shadow-lg shadow-slate-300/40`}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name ?? "Profile avatar"} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-sky-100 text-xl font-bold text-sky-800">
          {initials}
        </div>
      )}
    </div>
  );
}

function LogoCircle({ url, alt }: { url?: string; alt?: string }) {
  return (
    <div className="mt-0.5 flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={alt ?? "logo"} className="h-full w-full object-contain" />
      ) : (
        <div className="logo-circle-placeholder h-full w-full" />
      )}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <p className="text-sm text-slate-500">{label}</p>;
}

function prettifyFileName(file: string) {
  const base = file.replace(/\.[^.]+$/, "");
  return base
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

function toBackgroundUrl(file: string) {
  const encodedFile = encodeURIComponent(file).replace(/%2F/g, "/");
  return `${BACKGROUND_FOLDER}/${encodedFile}`;
}

function resolveThemeMode(): ThemeMode {
  if (typeof document !== "undefined") {
    const currentTheme = document.documentElement.dataset.colorTheme;
    if (currentTheme === "light" || currentTheme === "dark") {
      return currentTheme;
    }
  }

  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }

  return "light";
}

function applyThemeModePreference(themeMode: ThemeMode) {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  root.dataset.colorTheme = themeMode;
  root.style.colorScheme = themeMode;

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  } catch {
    // Ignore storage failures and keep the current theme in memory.
  }
}

function getTodayDateInput() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function imageUrl(asset?: ImageAsset | null) {
  if (!asset) return undefined;
  return asset.url ?? asset.sizes?.[0]?.url;
}

function splitLinkedInUrlLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function batchStatusConfig(status: BatchSearchItem["status"]) {
  if (status === "exists") {
    return {
      label: "Exists",
      className: "bg-amber-50 text-amber-700 ring-amber-100",
    };
  }

  if (status === "newly_found") {
    return {
      label: "Newly found",
      className: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    };
  }

  return {
    label: "Error",
    className: "bg-rose-50 text-rose-700 ring-rose-100",
  };
}

const TOP_SKILL_TEXT_KEYS = ["name", "skill", "title", "text", "label", "value"] as const;

function normalizeTopSkills(raw: unknown) {
  const seen = new Set<string>();

  return collectTopSkillValues(raw)
    .flatMap((value) => value.split(/\u2022|,/))
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

function collectTopSkillValues(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectTopSkillValues(item));
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  const record = value as Record<string, unknown>;
  const prioritizedValues = TOP_SKILL_TEXT_KEYS.flatMap((key) => collectTopSkillValues(record[key]));

  if (prioritizedValues.length) {
    return prioritizedValues;
  }

  return Object.values(record).flatMap((item) => collectTopSkillValues(item));
}

function formatDateOnly(value: string) {
  try {
    return new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatCompactNumber(value: number) {
  try {
    return new Intl.NumberFormat("en", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  } catch {
    return `${value}`;
  }
}

function formatCurrency(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "--";
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `$${value.toFixed(2)}`;
  }
}

function formatApifyCycle(startAt: string | null, endAt: string | null) {
  if (!startAt && !endAt) {
    return "Cycle unavailable";
  }

  if (!startAt) {
    return `Until ${formatDateOnly(endAt!)}`;
  }

  if (!endAt) {
    return `From ${formatDateOnly(startAt)}`;
  }

  return `${formatDateOnly(startAt)} - ${formatDateOnly(endAt)}`;
}

function truncateLabel(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 1))}\u2026`;
}

function formatDateRangeParts(
  start?: { month?: number | string | null; year?: number; text?: string },
  end?: { month?: number | string | null; year?: number; text?: string } | null,
  duration?: string,
) {
  if (duration) return duration;
  const startText = formatDatePart(start);
  const endText = formatDatePart(end) || "Present";

  if (!startText && !endText) return "";
  if (!startText) return endText;
  return `${startText} - ${endText}`;
}

function formatDatePart(part?: { month?: number | string | null; year?: number; text?: string } | null) {
  if (!part) return "";
  if (part.text) return part.text;
  const month = part.month;
  const year = part.year;
  const monthText =
    typeof month === "number"
      ? monthName(month)
      : typeof month === "string"
        ? month
        : "";
  if (monthText && year) return `${monthText} ${year}`;
  if (year) return `${year}`;
  return monthText;
}

function monthName(month: number) {
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return names[Math.max(0, Math.min(11, month - 1))] ?? "";
}

function buildDisplayName(profile: LinkedInProfile | null) {
  if (!profile) return "";
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim();
  return name || profile.publicIdentifier || "";
}

function buildClipboardText(profile: LinkedInProfile, skills: SkillItem[]) {
  const lines: string[] = [];
  const name = buildDisplayName(profile) || "Profile";
  const headline = profile.headline ?? "";
  const locationText = profile?.location?.linkedinText ?? profile?.location?.parsed?.text ?? "";
  const currentCompanies = (profile?.currentPosition ?? [])
    .map((pos) => pos.companyName)
    .filter(Boolean)
    .join(", ");
  const followerText = profile?.followerCount ? `${profile.followerCount.toLocaleString()} followers` : "";
  const connectionText = profile?.connectionsCount ? `${profile.connectionsCount.toLocaleString()} connections` : "";

  lines.push(name);
  if (headline) lines.push(headline);
  const meta = [locationText, currentCompanies, followerText, connectionText].filter(Boolean).join(" | ");
  if (meta) lines.push(meta);

  lines.push("");
  lines.push("ABOUT");
  lines.push(profile.about?.trim() ? profile.about : "Not provided.");

  lines.push("");
  lines.push("EXPERIENCE");
  if (profile.experience?.length) {
    profile.experience.forEach((item) => {
      const range = formatDateRangeParts(item.startDate, item.endDate, item.duration ?? undefined);
      const title = item.position ?? "Role";
      const company = item.companyName ?? "Company";
      const loc = item.location ? ` | ${item.location}` : "";
      const rangeText = range ? ` (${range})` : "";
      lines.push(`- ${title} - ${company}${rangeText}${loc}`);
      if (item.description) {
        lines.push(`  ${item.description.replace(/\n/g, "\n  ")}`);
      }
      if (item.skills?.length) {
        lines.push(`  Skills: ${item.skills.join(", ")}`);
      }
    });
  } else {
    lines.push("- None");
  }

  lines.push("");
  lines.push("EDUCATION");
  if (profile.education?.length) {
    profile.education.forEach((item) => {
      const range = item.period ?? formatDateRangeParts(item.startDate, item.endDate, undefined);
      const degreeLine = [item.degree, item.fieldOfStudy].filter(Boolean).join(" | ");
      const base = [item.schoolName, degreeLine].filter(Boolean).join(" - ");
      const rangeText = range ? ` (${range})` : "";
      lines.push(`- ${base}${rangeText}`);
    });
  } else {
    lines.push("- None");
  }

  lines.push("");
  lines.push("SKILLS");
  if (skills.length) {
    lines.push(skills.map((s) => s.name).filter(Boolean).join(", "));
  } else {
    lines.push("None listed.");
  }

  lines.push("");
  lines.push("CERTIFICATIONS");
  if (profile.certifications?.length) {
    profile.certifications.forEach((cert) => {
      const issuer = [cert.issuedBy, cert.issuedAt].filter(Boolean).join(" | ");
      lines.push(`- ${cert.title}${issuer ? ` - ${issuer}` : ""}`);
    });
  } else {
    lines.push("- None");
  }

  return lines.join("\n");
}

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ClientApiError(
      typeof payload === "object" && payload && "error" in payload ? String(payload.error) : "Request failed.",
      response.status,
      typeof payload === "object" && payload && "code" in payload ? String(payload.code) : undefined,
    );
  }

  return payload as T;
}

function resolveErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ClientApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

function getAdminActionMessage(action: AdminAction) {
  if (action === "approve") return "User approved successfully.";
  if (action === "disable") return "User disabled and active sessions revoked.";
  return "User enabled successfully.";
}
