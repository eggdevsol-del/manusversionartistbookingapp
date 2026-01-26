import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";
import { registerServiceWorker } from "./lib/pwa";
import { initializeOneSignal } from "./lib/onesignal";

const queryClient = new QueryClient();

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  // Clear auth token and redirect to login
  localStorage.removeItem("authToken");
  localStorage.removeItem("user");
  sessionStorage.removeItem("authToken");
  sessionStorage.removeItem("user");
  window.location.href = "/login";
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        // Get JWT token from localStorage OR sessionStorage
        const token = localStorage.getItem("authToken") || sessionStorage.getItem("authToken");

        // Add Authorization header if token exists
        const headers = {
          ...(init?.headers || {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };

        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
          headers,
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);

// Current app version (baked in at build time)
const APP_VERSION = import.meta.env.VITE_APP_VERSION || '0.0.0';
console.log('[App] Starting version:', APP_VERSION);

// Check for version mismatch by fetching a version endpoint
async function checkForUpdates() {
  try {
    // Fetch version from server with cache-busting
    const response = await fetch(`/api/version?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    });
    
    if (response.ok) {
      const data = await response.json();
      const serverVersion = data.version;
      
      console.log('[App] Server version:', serverVersion);
      console.log('[App] Client version:', APP_VERSION);
      
      if (serverVersion && serverVersion !== APP_VERSION) {
        console.log('[App] Version mismatch! Forcing update...');
        
        // Clear all caches
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map(name => caches.delete(name)));
          console.log('[App] Cleared', cacheNames.length, 'caches');
        }
        
        // Unregister service workers
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map(r => r.unregister()));
          console.log('[App] Unregistered', registrations.length, 'service workers');
        }
        
        // Force reload
        window.location.reload();
        return;
      }
    }
  } catch (err) {
    console.error('[App] Version check failed:', err);
  }
}

// Register service worker for PWA
if (import.meta.env.PROD) {
  registerServiceWorker();
  
  // Check for updates on load
  checkForUpdates();
  
  // Also check when page becomes visible
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkForUpdates();
    }
  });
}

// Initialize OneSignal for push notifications
initializeOneSignal().catch(err => {
  console.error('[OneSignal] Failed to initialize:', err);
});
