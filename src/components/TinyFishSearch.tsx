import { useState } from "react";
import {
  Search,
  Globe,
  ExternalLink,
  FileText,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Loader2,
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  Info,
} from "lucide-react";
import {
  searchTinyFish,
  fetchTinyFishUrl,
  type TinyFishDepartment,
  type TinyFishSearchResultItem,
} from "@/lib/tinyfish";
import { DEPT_COLOR } from "@/lib/demo-data";

export function TinyFishSearch() {
  const [department, setDepartment] = useState<TinyFishDepartment>("All");
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [results, setResults] = useState<TinyFishSearchResultItem[] | null>(null);

  // Expanded fetch content state per URL
  const [fetchedContent, setFetchedContent] = useState<Record<string, { loading: boolean; text?: string; error?: string }>>({});
  const [expandedUrls, setExpandedUrls] = useState<Record<string, boolean>>({});

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setIsSearching(true);

    try {
      const resp = await searchTinyFish({ data: { query: query.trim(), department } });
      setIsConfigured(resp.configured);
      if (!resp.success) {
        setError(resp.error || "Failed to retrieve search results.");
        setResults([]);
      } else {
        setResults(resp.results);
      }
    } catch (err: any) {
      console.error("Search execution error:", err);
      setError(err?.message || "An unexpected error occurred while contacting the search service.");
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleFetch = async (url: string) => {
    // Toggle if already fetched
    if (fetchedContent[url]?.text) {
      setExpandedUrls((prev) => ({ ...prev, [url]: !prev[url] }));
      return;
    }

    setFetchedContent((prev) => ({ ...prev, [url]: { loading: true } }));
    setExpandedUrls((prev) => ({ ...prev, [url]: true }));

    try {
      const resp = await fetchTinyFishUrl({ data: { url } });
      if (resp.success && resp.content) {
        setFetchedContent((prev) => ({
          ...prev,
          [url]: { loading: false, text: resp.content },
        }));
      } else {
        setFetchedContent((prev) => ({
          ...prev,
          [url]: { loading: false, error: resp.error || "Could not extract page text." },
        }));
      }
    } catch (err: any) {
      setFetchedContent((prev) => ({
        ...prev,
        [url]: { loading: false, error: err?.message || "Failed to fetch content." },
      }));
    }
  };

  const departmentList: TinyFishDepartment[] = ["All", "State PWD", "NHAI", "PMGSY"];

  return (
    <div className="space-y-6">
      {/* Search Header & Controls */}
      <div className="rounded-lg border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-accent" />
              <h2 className="text-lg font-bold text-primary">Live Web Road Search</h2>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Search real-time public records, notices, and progress reports across NHAI, State PWD, and PMGSY via TinyFish API.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded bg-secondary px-2.5 py-1 text-xs font-semibold text-primary">
            Citizen Search & Fetch
          </span>
        </div>

        {/* Department Filters */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Department:</span>
          {departmentList.map((dept) => {
            const isSelected = department === dept;
            const dotColor = dept === "All" ? "var(--color-primary)" : DEPT_COLOR[dept];
            return (
              <button
                key={dept}
                type="button"
                onClick={() => setDepartment(dept)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-muted"
                }`}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: dotColor }} />
                {dept}
              </button>
            );
          })}
        </div>

        {/* Search Input Box */}
        <form onSubmit={handleSearch} className="mt-4 flex flex-wrap gap-2">
          <div className="relative min-w-64 flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search highway number, road stretch, district, or project (e.g. NH-48, Kolar bypass)..."
              className="input-field !pl-9"
            />
          </div>
          <button
            type="submit"
            disabled={isSearching}
            className="btn-primary inline-flex items-center gap-2 !px-5 !py-2 shrink-0"
          >
            {isSearching ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Searching…
              </>
            ) : (
              <>
                <Search className="h-4 w-4" /> Search Live Web
              </>
            )}
          </button>
        </form>

        {/* Query Suggestions */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <span>Suggestions:</span>
          {["NH-44 Four Laning", "PMGSY rural road package", "State PWD highway widening", "Bhopal bypass tender"].map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => {
                setQuery(tag);
              }}
              className="rounded bg-muted px-2 py-0.5 hover:bg-muted/80 hover:text-primary"
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Unconfigured API Key Banner */}
      {isConfigured === false && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-5">
          <div className="flex items-start gap-3">
            <KeyRound className="h-5 w-5 text-warning-foreground shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-warning-foreground">TinyFish API Key Required</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                To fetch real-time public records and extract road project details from official websites, configure your TinyFish API key:
              </p>
              <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
                <li>
                  Get a free API key at{" "}
                  <a
                    href="https://agent.tinyfish.ai"
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-primary underline"
                  >
                    agent.tinyfish.ai
                  </a>{" "}
                  (free search & fetch, no credit card required).
                </li>
                <li>
                  Open your <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">.env</code> file in the project root.
                </li>
                <li>
                  Set <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">TINYFISH_API_KEY=&quot;your_key_here&quot;</code> and restart your development server.
                </li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && isConfigured !== false && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {/* Results List */}
      {results && results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-primary">
              Live Web Results ({results.length}) {department !== "All" && `· Filtered for ${department}`}
            </h3>
            <span className="text-[11px] text-muted-foreground">Powered by TinyFish Search & Fetch</span>
          </div>

          <div className="space-y-3">
            {results.map((item) => {
              const dotColor = item.department === "General" ? "var(--color-primary)" : DEPT_COLOR[item.department];
              const isExpanded = expandedUrls[item.url] ?? false;
              const contentState = fetchedContent[item.url];

              return (
                <div key={item.url + item.position} className="rounded-lg border bg-card p-4 transition-shadow hover:shadow-sm">
                  {/* Top Metadata Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 font-semibold">
                        <span className="h-2 w-2 rounded-full" style={{ background: dotColor }} />
                        {item.department}
                      </span>
                      <span className="text-muted-foreground">·</span>
                      <span className="font-mono text-[11px] text-muted-foreground">{item.site_name}</span>
                    </div>

                    {/* Official vs Unverified Badge */}
                    <div className="flex items-center gap-1">
                      {item.isOfficialSource ? (
                        <span className="inline-flex items-center gap-1 rounded border border-warning/40 bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning-foreground">
                          <ShieldCheck className="h-3 w-3" /> Official Portal Record
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          <ShieldAlert className="h-3 w-3" /> Unverified Public Source
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Title & Link */}
                  <h4 className="mt-2 text-base font-semibold leading-snug">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1"
                    >
                      {item.title}
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    </a>
                  </h4>

                  {/* Snippet */}
                  <p className="mt-1.5 text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                    {item.snippet}
                  </p>

                  {/* Source Notice & Fetch Button */}
                  <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Info className="h-3 w-3" />
                      Live web data — verify with official tender gazette before relying on figures.
                    </p>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleFetch(item.url)}
                        className="btn-outline inline-flex items-center gap-1.5 !px-3 !py-1 text-xs"
                      >
                        <FileText className="h-3.5 w-3.5 text-accent" />
                        {isExpanded ? "Hide Fetched Text" : "Fetch Page Content"}
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Fetched Page Content View */}
                  {isExpanded && (
                    <div className="mt-3 rounded border bg-muted/40 p-4 text-xs">
                      {contentState?.loading ? (
                        <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin text-accent" />
                          <span>Extracting clean page text with TinyFish Chromium browser…</span>
                        </div>
                      ) : contentState?.error ? (
                        <div className="text-destructive">
                          <p className="font-semibold">Unable to fetch page content:</p>
                          <p className="mt-1 text-[11px]">{contentState.error}</p>
                        </div>
                      ) : contentState?.text ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between border-b pb-2">
                            <span className="font-mono text-[10px] text-muted-foreground uppercase">
                              Clean Extracted Content (Markdown)
                            </span>
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-primary underline"
                            >
                              Visit original source
                            </a>
                          </div>
                          <div className="max-h-80 overflow-y-auto whitespace-pre-wrap font-sans text-xs text-foreground/90 leading-relaxed pr-2">
                            {contentState.text}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {results && results.length === 0 && !error && isConfigured !== false && (
        <div className="rounded-lg border bg-card p-10 text-center">
          <Globe className="mx-auto h-8 w-8 text-muted-foreground/60" />
          <h3 className="mt-2 text-sm font-semibold">No public road records found</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Try adjusting your search terms or selecting another department filter (All, NHAI, State PWD, PMGSY).
          </p>
        </div>
      )}
    </div>
  );
}
