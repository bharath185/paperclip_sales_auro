import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface SidebarContextValue {
  // Mobile drawer + back-compat (existing behavior, unchanged).
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  isMobile: boolean;
  // Back-compat collapse API. The global navigation is permanently expanded;
  // these values remain for callers that have not removed old requests.
  collapsed: boolean;
  setCollapsed: (next: boolean) => void;
  toggleCollapsed: () => void;
  // Retained compatibility value; always false now that the rail is retired.
  collapseLocked: boolean;
  // Retained compatibility value; the retired rail can no longer peek.
  peeking: boolean;
  setPeeking: (next: boolean) => void;
  // Legacy requests remain observable without affecting the global nav.
  forceCollapsed: boolean;
  setForceCollapsed: (next: boolean) => void;
  // Route-requested collapse retained for integration compatibility.
  routeRequestsCollapsed: boolean;
  setRouteRequestsCollapsed: (next: boolean) => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

const MOBILE_BREAKPOINT = 768;
const SIDEBAR_COLLAPSED_KEY = "auro.sidebar.collapsed";
const LEGACY_SIDEBAR_COLLAPSED_KEY = "paperclip.sidebar.collapsed";

function readCollapsedPreference() {
  try {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY) ?? localStorage.getItem(LEGACY_SIDEBAR_COLLAPSED_KEY);
    return saved === "1";
  } catch {
    return false;
  }
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < MOBILE_BREAKPOINT);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= MOBILE_BREAKPOINT);
  const [userCollapsed, setUserCollapsed] = useState(readCollapsedPreference);
  const [peeking, setPeeking] = useState(false);
  const [routeRequestsCollapsed, setRouteRequestsCollapsed] = useState(false);
  const [forceCollapsed, setForceCollapsed] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
      setSidebarOpen(!e.matches);
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const collapsed = !isMobile && (userCollapsed || routeRequestsCollapsed || forceCollapsed);
  const collapseLocked = false;
  const setCollapsed = useCallback((next: boolean) => setUserCollapsed(next), []);
  const toggleCollapsed = useCallback(() => setUserCollapsed((current) => !current), []);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, userCollapsed ? "1" : "0");
      localStorage.removeItem(LEGACY_SIDEBAR_COLLAPSED_KEY);
    } catch {
      // Navigation remains usable when browser storage is unavailable.
    }
  }, [userCollapsed]);

  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);

  const value = useMemo<SidebarContextValue>(
    () => ({
      sidebarOpen,
      setSidebarOpen,
      toggleSidebar,
      isMobile,
      collapsed,
      setCollapsed,
      toggleCollapsed,
      collapseLocked,
      peeking,
      setPeeking,
      forceCollapsed,
      setForceCollapsed,
      routeRequestsCollapsed,
      setRouteRequestsCollapsed,
    }),
    [
      sidebarOpen,
      setSidebarOpen,
      toggleSidebar,
      isMobile,
      collapsed,
      setCollapsed,
      toggleCollapsed,
      collapseLocked,
      peeking,
      setPeeking,
      forceCollapsed,
      setForceCollapsed,
      routeRequestsCollapsed,
      setRouteRequestsCollapsed,
    ],
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) {
    throw new Error("useSidebar must be used within SidebarProvider");
  }
  return ctx;
}
