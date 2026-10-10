/**
 * TinyFish Search & Fetch API Client for Citizen/User Side
 * 
 * Provides server-side functions using TanStack Start createServerFn
 * so that TINYFISH_API_KEY is never exposed to the client or browser requests.
 * 
 * Supported departments:
 * - NHAI (National Highways Authority of India)
 * - State PWD (State Public Works Department)
 * - PMGSY (Pradhan Mantri Gram Sadak Yojana)
 */

import { createServerFn } from "@tanstack/react-start";

export type TinyFishDepartment = "All" | "State PWD" | "NHAI" | "PMGSY";

export interface TinyFishSearchResultItem {
  position: number;
  site_name: string;
  title: string;
  snippet: string;
  url: string;
  date?: string;
  department: "State PWD" | "NHAI" | "PMGSY" | "General";
  isOfficialSource: boolean;
  verificationLabel: string;
}

export interface TinyFishSearchResponse {
  success: boolean;
  configured: boolean;
  query: string;
  department: TinyFishDepartment;
  results: TinyFishSearchResultItem[];
  total_results?: number;
  error?: string;
}

export interface TinyFishFetchResponse {
  success: boolean;
  configured: boolean;
  url: string;
  title?: string;
  content?: string;
  format?: string;
  error?: string;
}

/**
 * Checks whether the given URL or site originates from an official government domain (.gov.in or .nic.in).
 * Official domains include nhai.gov.in, morth.nic.in, omms.nic.in, pmgsy.nic.in, state pwd portals (*.gov.in).
 */
export function isOfficialGovernmentSource(url: string, siteName?: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host.endsWith(".gov.in") || host.endsWith(".nic.in")) return true;
    if (host === "nhai.gov.in" || host === "morth.nic.in" || host === "omms.nic.in" || host === "pmgsy.nic.in") return true;
  } catch {
    if (url.includes(".gov.in") || url.includes(".nic.in")) return true;
  }
  if (siteName) {
    const s = siteName.toLowerCase();
    if (s.endsWith(".gov.in") || s.endsWith(".nic.in") || s.includes("nhai.gov.in") || s.includes("omms.nic.in")) {
      return true;
    }
  }
  return false;
}

/**
 * Builds an optimal targeted search query for the selected department.
 */
export function buildSearchQuery(rawQuery: string, department: TinyFishDepartment): string {
  const q = rawQuery.trim();
  switch (department) {
    case "NHAI":
      return q ? `${q} NHAI National Highway road project` : `NHAI National Highway road projects India`;
    case "State PWD":
      return q ? `${q} State PWD road construction work` : `State PWD road construction projects India`;
    case "PMGSY":
      return q ? `${q} PMGSY rural road connectivity` : `PMGSY Pradhan Mantri Gram Sadak Yojana road projects`;
    case "All":
    default:
      return q ? `${q} road project India NHAI PWD PMGSY` : `government road highway construction projects India`;
  }
}

/**
 * Infers department category from result metadata when "All" is queried.
 */
export function inferDepartment(
  selectedDept: TinyFishDepartment,
  title: string,
  snippet: string,
  url: string,
): "State PWD" | "NHAI" | "PMGSY" | "General" {
  if (selectedDept !== "All") {
    return selectedDept;
  }
  const text = `${title} ${snippet} ${url}`.toLowerCase();
  if (text.includes("nhai") || text.includes("national highway") || text.includes("morth")) {
    return "NHAI";
  }
  if (text.includes("pmgsy") || text.includes("gram sadak") || text.includes("omms.nic.in")) {
    return "PMGSY";
  }
  if (text.includes("pwd") || text.includes("public works department")) {
    return "State PWD";
  }
  return "General";
}

/**
 * Helper to get the secret TINYFISH_API_KEY from the server environment.
 * NEVER read VITE_ prefixed variables to prevent client bundle injection.
 */
function getServerApiKey(): string {
  if (typeof process !== "undefined" && process.env?.TINYFISH_API_KEY) {
    return process.env.TINYFISH_API_KEY.trim();
  }
  return "";
}

/**
 * Server function to query TinyFish Search API.
 * Securely uses TINYFISH_API_KEY from the server environment.
 */
export const searchTinyFish = createServerFn({ method: "GET" })
  .validator((d: { query: string; department?: TinyFishDepartment }) => d)
  .handler(async ({ data }): Promise<TinyFishSearchResponse> => {
    const apiKey = getServerApiKey();
    const department: TinyFishDepartment = data.department || "All";
    const userQuery = data.query || "";

    if (!apiKey) {
      return {
        success: false,
        configured: false,
        query: userQuery,
        department,
        results: [],
        error:
          "TinyFish API key (TINYFISH_API_KEY) is not configured. Please add TINYFISH_API_KEY to your .env file to enable live citizen search & fetch.",
      };
    }

    const fullQuery = buildSearchQuery(userQuery, department);

    try {
      const endpoint = new URL("https://api.search.tinyfish.ai");
      endpoint.searchParams.set("query", fullQuery);
      endpoint.searchParams.set("location", "IN");
      endpoint.searchParams.set("language", "en");
      endpoint.searchParams.set("purpose", "Citizen road transparency and government project search");

      const res = await fetch(endpoint.toString(), {
        method: "GET",
        headers: {
          "X-API-Key": apiKey,
          Accept: "application/json",
        },
      });

      if (res.status === 401 || res.status === 403) {
        return {
          success: false,
          configured: true,
          query: userQuery,
          department,
          results: [],
          error: "Invalid TinyFish API key. Please check TINYFISH_API_KEY in your .env file.",
        };
      }

      if (res.status === 429) {
        return {
          success: false,
          configured: true,
          query: userQuery,
          department,
          results: [],
          error: "TinyFish Search rate limit reached. Please wait a moment before searching again.",
        };
      }

      if (!res.ok) {
        return {
          success: false,
          configured: true,
          query: userQuery,
          department,
          results: [],
          error: `TinyFish API returned an error (${res.status}: ${res.statusText}).`,
        };
      }

      const json = await res.json();
      const rawResults = Array.isArray(json?.results) ? json.results : [];

      const processedResults: TinyFishSearchResultItem[] = rawResults.map((item: any, idx: number) => {
        const urlStr = String(item.url || "");
        const siteName = String(item.site_name || "");
        const title = String(item.title || "Untitled Project Link");
        const snippet = String(item.snippet || "");
        const isOfficial = isOfficialGovernmentSource(urlStr, siteName);
        const itemDept = inferDepartment(department, title, snippet, urlStr);

        return {
          position: typeof item.position === "number" ? item.position : idx + 1,
          site_name: siteName || (urlStr ? new URL(urlStr).hostname : "Web Source"),
          title,
          snippet,
          url: urlStr,
          date: item.date ? String(item.date) : undefined,
          department: itemDept,
          isOfficialSource: isOfficial,
          verificationLabel: isOfficial
            ? "Awaiting Confirmation (Official Portal Record)"
            : "Unverified Public Web Source",
        };
      });

      return {
        success: true,
        configured: true,
        query: userQuery,
        department,
        results: processedResults,
        total_results: typeof json.total_results === "number" ? json.total_results : processedResults.length,
      };
    } catch (err: any) {
      console.error("TinyFish Search error:", err);
      return {
        success: false,
        configured: true,
        query: userQuery,
        department,
        results: [],
        error: err?.message ? `Failed to connect to TinyFish Search: ${err.message}` : "Failed to connect to TinyFish API.",
      };
    }
  });

/**
 * Server function to fetch and clean full content from a public URL using TinyFish Fetch API.
 * Securely uses TINYFISH_API_KEY from the server environment.
 */
export const fetchTinyFishUrl = createServerFn({ method: "POST" })
  .validator((d: { url: string }) => d)
  .handler(async ({ data }): Promise<TinyFishFetchResponse> => {
    const apiKey = getServerApiKey();
    const targetUrl = data.url || "";

    if (!apiKey) {
      return {
        success: false,
        configured: false,
        url: targetUrl,
        error:
          "TinyFish API key (TINYFISH_API_KEY) is not configured. Please add TINYFISH_API_KEY to your .env file to enable live content fetching.",
      };
    }

    if (!targetUrl || !targetUrl.startsWith("http")) {
      return {
        success: false,
        configured: true,
        url: targetUrl,
        error: "A valid http/https URL is required to fetch content.",
      };
    }

    // SSRF protection: reject local and internal addresses
    try {
      const parsedUrl = new URL(targetUrl);
      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        return { success: false, configured: true, url: targetUrl, error: "Only http and https protocols are supported." };
      }
      const host = parsedUrl.hostname.toLowerCase();
      if (
        host === "localhost" ||
        host === "127.0.0.1" ||
        host === "0.0.0.0" ||
        host.startsWith("192.168.") ||
        host.startsWith("10.") ||
        host.startsWith("172.16.") ||
        host.endsWith(".internal") ||
        host.endsWith(".local")
      ) {
        return { success: false, configured: true, url: targetUrl, error: "Private and local network addresses cannot be fetched." };
      }
    } catch {
      return { success: false, configured: true, url: targetUrl, error: "Invalid URL provided." };
    }

    try {
      const res = await fetch("https://api.fetch.tinyfish.ai", {
        method: "POST",
        headers: {
          "X-API-Key": apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          urls: [targetUrl],
          format: "markdown",
          purpose: "Citizen road project details and public notice extraction",
        }),
      });

      if (res.status === 401 || res.status === 403) {
        return {
          success: false,
          configured: true,
          url: targetUrl,
          error: "Invalid TinyFish API key. Please check TINYFISH_API_KEY in your .env file.",
        };
      }

      if (res.status === 429) {
        return {
          success: false,
          configured: true,
          url: targetUrl,
          error: "TinyFish Fetch rate limit reached. Please wait a moment before retrying.",
        };
      }

      if (!res.ok) {
        return {
          success: false,
          configured: true,
          url: targetUrl,
          error: `TinyFish Fetch API error (${res.status}: ${res.statusText}).`,
        };
      }

      const json = await res.json();
      const firstResult = Array.isArray(json?.results) ? json.results[0] : null;

      if (!firstResult) {
        return {
          success: false,
          configured: true,
          url: targetUrl,
          error: "No readable content could be extracted from this page.",
        };
      }

      return {
        success: true,
        configured: true,
        url: firstResult.url || targetUrl,
        title: firstResult.title || undefined,
        content: firstResult.text || "",
        format: firstResult.format || "markdown",
      };
    } catch (err: any) {
      console.error("TinyFish Fetch error:", err);
      return {
        success: false,
        configured: true,
        url: targetUrl,
        error: err?.message ? `Failed to fetch page content: ${err.message}` : "Failed to connect to TinyFish Fetch API.",
      };
    }
  });
