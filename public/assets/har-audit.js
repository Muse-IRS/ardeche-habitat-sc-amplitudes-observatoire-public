(() => {
  "use strict";

  const root = document.querySelector("[data-har-audit]");
  if (!root) return;

  const targetInput = root.querySelector("[data-har-target]");
  const contextInput = root.querySelector("[data-har-context]");
  const fileInput = root.querySelector("[data-har-file]");
  const vpnInput = root.querySelector("[data-har-vpn]");
  const browserInput = root.querySelector("[data-har-browser]");
  const phaseInput = root.querySelector("[data-har-phase]");
  const localStorageInput = root.querySelector("[data-storage-local]");
  const sessionStorageInput = root.querySelector("[data-storage-session]");
  const analyzeButton = root.querySelector("[data-har-analyze]");
  const exportButton = root.querySelector("[data-har-export]");
  const clearButton = root.querySelector("[data-har-clear]");
  const statusNode = root.querySelector("[data-har-status]");
  const summaryNode = root.querySelector("[data-har-summary]");
  const jsonNode = root.querySelector("[data-har-json]");
  const a11yInputs = [...root.querySelectorAll("[data-a11y]")];

  const MAX_BYTES = 50 * 1024 * 1024;
  const SECURITY_HEADERS = [
    "strict-transport-security",
    "content-security-policy",
    "content-security-policy-report-only",
    "x-content-type-options",
    "referrer-policy",
    "permissions-policy",
    "x-frame-options",
    "cross-origin-opener-policy",
    "cross-origin-resource-policy",
    "cross-origin-embedder-policy"
  ];

  const SIGNALS = {
    analytics: ["google-analytics", "googletagmanager", "gtag", "matomo", "plausible", "hotjar", "clarity.ms"],
    captcha: ["recaptcha", "hcaptcha", "turnstile", "captcha"],
    payment: ["systempay", "payzen", "lyra", "stripe", "paypal", "adyen", "monetico"]
  };

  let report = null;
  let downloadUrl = null;

  function setStatus(message) {
    statusNode.textContent = message;
  }

  function sanitizePath(pathname) {
    return pathname
      .split("/")
      .map(segment => {
        if (!segment) return segment;
        if (/^\d{7,}$/.test(segment)) return "[redacted-id]";
        if (/^[0-9a-f-]{24,}$/i.test(segment)) return "[redacted-id]";
        return segment.length > 80 ? "[redacted-segment]" : segment;
      })
      .join("/");
  }

  function sanitizeUrl(raw) {
    try {
      const url = new URL(raw);
      return url.origin + sanitizePath(url.pathname);
    } catch {
      return "[invalid-url]";
    }
  }

  function hostname(raw) {
    try {
      return new URL(raw).hostname.toLowerCase();
    } catch {
      return "";
    }
  }

  function normalizeTargetDomain(value) {
    const raw = String(value || "").trim().toLowerCase();
    if (!raw) return "";
    try {
      const candidate = raw.includes("://") ? new URL(raw).hostname : new URL("https://" + raw).hostname;
      return candidate.replace(/^www\./, "");
    } catch {
      return "";
    }
  }

  function isFirstPartyHost(host, targetDomain) {
    return Boolean(targetDomain) && (host === targetDomain || host.endsWith("." + targetDomain));
  }

  function headerMap(headers) {
    const out = new Map();
    for (const item of Array.isArray(headers) ? headers : []) {
      const name = String(item?.name || "").toLowerCase();
      if (!name) continue;
      const value = String(item?.value || "");
      if (!out.has(name)) out.set(name, []);
      out.get(name).push(value);
    }
    return out;
  }

  function firstHeader(headers, name) {
    const values = headerMap(headers).get(name.toLowerCase());
    return values && values.length ? values[0] : null;
  }

  function sanitizeSecurityHeaderValue(name, value) {
    const text = String(value || "");
    if (name === "content-security-policy" || name === "content-security-policy-report-only") {
      return text.replace(/'nonce-[^']+'/gi, "'nonce-[redacted]'");
    }
    return text;
  }

  function securityHeaders(entry) {
    const map = headerMap(entry?.response?.headers);
    const out = {};
    for (const name of SECURITY_HEADERS) {
      if (map.has(name)) {
        out[name] = map.get(name).map(value => sanitizeSecurityHeaderValue(name, value)).join(", ");
      }
    }
    return out;
  }

  function cookieMetadata(cookies, direction, fallbackDomain) {
    return (Array.isArray(cookies) ? cookies : []).map(cookie => ({
      direction,
      name: String(cookie?.name || ""),
      domain: String(cookie?.domain || fallbackDomain || ""),
      path: String(cookie?.path || ""),
      secure: Boolean(cookie?.secure),
      httpOnly: Boolean(cookie?.httpOnly),
      sameSite: cookie?.sameSite || null,
      expires: cookie?.expires || null
    }));
  }

  function extractTls(entry) {
    const d = entry?._securityDetails || entry?.securityDetails || {};
    const tls = {
      protocol: d.protocol || entry?._tlsVersion || entry?.response?._tlsVersion || null,
      issuer: d.issuer || null,
      subjectName: d.subjectName || null,
      validFrom: d.validFrom || null,
      validTo: d.validTo || null
    };
    return Object.values(tls).some(Boolean) ? tls : null;
  }

  function signalMatch(url, keywords) {
    const value = String(url || "").toLowerCase();
    return keywords.some(keyword => value.includes(keyword));
  }

  function summarizeDomains(entries, targetDomain) {
    const counts = new Map();
    for (const entry of entries) {
      const host = hostname(entry?.request?.url);
      if (!host) continue;
      counts.set(host, (counts.get(host) || 0) + 1);
    }
    return [...counts.entries()]
      .map(([domain, requests]) => ({
        domain,
        requests,
        first_party: isFirstPartyHost(domain, targetDomain)
      }))
      .sort((a, b) => b.requests - a.requests || a.domain.localeCompare(b.domain));
  }

  function a11yState() {
    return Object.fromEntries(a11yInputs.map(input => [input.dataset.a11y, input.value]));
  }

  function storageKeyNames(input) {
    return String(input?.value || "")
      .split(/\r?\n|,/)
      .map(value => value.trim())
      .filter(Boolean)
      .map(value => {
        if (value.length > 80) return "[redacted-long-key]";
        if (value.includes("@")) return "[redacted-key]";
        return value;
      })
      .slice(0, 200);
  }

  function buildReport(har, fileName) {
    const entries = Array.isArray(har?.log?.entries) ? har.log.entries : [];
    if (!entries.length) throw new Error("Le fichier ne contient aucune entrée HAR exploitable.");

    const targetDomain = normalizeTargetDomain(targetInput?.value);
    if (!targetDomain) throw new Error("Renseignez un domaine cible valide.");
    const domains = summarizeDomains(entries, targetDomain);
    const firstPartyEntries = entries.filter(entry => isFirstPartyHost(hostname(entry?.request?.url), targetDomain));
    const documentCandidates = firstPartyEntries.filter(entry => {
      const mime = String(entry?.response?.content?.mimeType || "").toLowerCase();
      const type = String(entry?._resourceType || entry?.resourceType || "").toLowerCase();
      return type === "document" || mime.includes("text/html");
    });
    const mainEntry = documentCandidates[0] || firstPartyEntries[0] || entries[0];

    const redirects = entries
      .filter(entry => {
        const status = Number(entry?.response?.status || 0);
        return (status >= 300 && status < 400) || Boolean(firstHeader(entry?.response?.headers, "location"));
      })
      .map(entry => ({
        status: Number(entry?.response?.status || 0),
        from: sanitizeUrl(entry?.request?.url || ""),
        to: sanitizeUrl(firstHeader(entry?.response?.headers, "location") || entry?.response?.redirectURL || "")
      }));

    const insecureRequests = entries
      .filter(entry => String(entry?.request?.url || "").toLowerCase().startsWith("http://"))
      .map(entry => ({
        method: String(entry?.request?.method || "GET"),
        url: sanitizeUrl(entry?.request?.url || ""),
        status: Number(entry?.response?.status || 0)
      }));

    const cookies = [];
    for (const entry of entries) {
      const host = hostname(entry?.request?.url);
      cookies.push(...cookieMetadata(entry?.request?.cookies, "request", host));
      cookies.push(...cookieMetadata(entry?.response?.cookies, "response", host));
    }

    const uniqueCookies = [];
    const seenCookies = new Set();
    for (const cookie of cookies) {
      const key = [cookie.direction, cookie.name, cookie.domain, cookie.path, cookie.secure, cookie.httpOnly, cookie.sameSite, cookie.expires].join("|");
      if (seenCookies.has(key)) continue;
      seenCookies.add(key);
      uniqueCookies.push(cookie);
    }

    const heuristics = {};
    for (const [label, keywords] of Object.entries(SIGNALS)) {
      heuristics[label] = entries
        .filter(entry => signalMatch(entry?.request?.url, keywords))
        .map(entry => ({
          domain: hostname(entry?.request?.url),
          url: sanitizeUrl(entry?.request?.url || "")
        }))
        .filter((item, index, arr) => arr.findIndex(x => x.domain === item.domain && x.url === item.url) === index);
    }

    const targetStatuses = firstPartyEntries.map(entry => Number(entry?.response?.status || 0)).filter(Boolean);
    const mainHeaders = securityHeaders(mainEntry);
    const tls = extractTls(mainEntry);

    return {
      schema_version: "1.0",
      audit_id: "PUBLIC-RGPD-HAR-AUDIT-001",
      generated_at: new Date().toISOString(),
      processing: "browser-local-only",
      source_file: {
        name: "[local-har-redacted]",
        raw_har_exported: false
      },
      session: {
        context: contextInput?.value.trim().slice(0, 120) || "UNSPECIFIED",
        vpn: vpnInput.value || "UNKNOWN",
        browser: browserInput.value.trim().slice(0, 120) || "UNKNOWN",
        phase: phaseInput.value || "UNKNOWN"
      },
      target: {
        domain: targetDomain,
        first_party_request_count: firstPartyEntries.length,
        observed_status_codes: [...new Set(targetStatuses)].sort((a, b) => a - b),
        main_document: {
          url: sanitizeUrl(mainEntry?.request?.url || ""),
          status: Number(mainEntry?.response?.status || 0),
          http_version: mainEntry?.response?.httpVersion || mainEntry?.request?.httpVersion || null,
          security_headers: mainHeaders,
          tls
        }
      },
      transport: {
        redirects,
        insecure_http_requests_observed: insecureRequests
      },
      browser_data: {
        cookies_metadata_only: uniqueCookies,
        third_party_domains: domains.filter(item => !item.first_party),
        all_domains_summary: domains,
        local_storage: {
          source: "MANUAL_KEY_NAMES_ONLY",
          keys: storageKeyNames(localStorageInput)
        },
        session_storage: {
          source: "MANUAL_KEY_NAMES_ONLY",
          keys: storageKeyNames(sessionStorageInput)
        }
      },
      heuristic_signals: {
        note: "Heuristics based on URL/domain strings only; signal != qualification.",
        ...heuristics
      },
      accessibility_manual_observations: a11yState(),
      minimization: {
        cookie_values: "EXCLUDED",
        authorization_headers: "EXCLUDED",
        request_bodies: "EXCLUDED",
        response_bodies: "EXCLUDED",
        raw_query_strings: "EXCLUDED",
        url_fragments: "EXCLUDED"
      }
    };
  }

  function metric(label, value) {
    const div = document.createElement("div");
    div.className = "metric";
    const strong = document.createElement("strong");
    strong.textContent = String(value);
    const span = document.createElement("span");
    span.textContent = label;
    div.append(strong, span);
    return div;
  }

  function renderReport(nextReport) {
    report = nextReport;
    jsonNode.textContent = JSON.stringify(report, null, 2);
    summaryNode.replaceChildren(
      metric("requêtes first-party", report.target.first_party_request_count),
      metric("domaines tiers", report.browser_data.third_party_domains.length),
      metric("redirections", report.transport.redirects.length),
      metric("requêtes HTTP observées", report.transport.insecure_http_requests_observed.length),
      metric("cookies (métadonnées)", report.browser_data.cookies_metadata_only.length),
      metric("headers sécurité observés", Object.keys(report.target.main_document.security_headers).length)
    );
    summaryNode.hidden = false;
    exportButton.disabled = false;
  }

  function updateManualStates() {
    if (!report) return;
    report.accessibility_manual_observations = a11yState();
    jsonNode.textContent = JSON.stringify(report, null, 2);
  }

  async function analyze() {
    const file = fileInput.files?.[0];
    if (!file) {
      setStatus("Sélectionnez d’abord un fichier HAR.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setStatus("Fichier refusé : taille supérieure à 50 Mio.");
      return;
    }
    setStatus("Analyse locale en cours…");
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const nextReport = buildReport(parsed, file.name);
      renderReport(nextReport);
      setStatus("Analyse locale terminée. Aucun HAR brut n’a été transmis.");
    } catch (error) {
      report = null;
      exportButton.disabled = true;
      summaryNode.hidden = true;
      jsonNode.textContent = "Aucune analyse.";
      setStatus("Échec de lecture : " + (error?.message || "HAR invalide."));
    }
  }

  function exportReport() {
    if (!report) return;
    updateManualStates();
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    const blob = new Blob([JSON.stringify(report, null, 2) + "\n"], { type: "application/json;charset=utf-8" });
    downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = "ah-web-audit-har-minimized.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setStatus("Rapport minimisé exporté localement.");
  }

  function clearSession() {
    report = null;
    fileInput.value = "";
    browserInput.value = "";
    vpnInput.value = "UNKNOWN";
    phaseInput.value = "INITIAL_NO_INTERACTION";
    localStorageInput.value = "";
    sessionStorageInput.value = "";
    for (const input of a11yInputs) input.value = "NON_TESTE";
    summaryNode.hidden = true;
    summaryNode.replaceChildren();
    jsonNode.textContent = "Aucune analyse.";
    exportButton.disabled = true;
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
      downloadUrl = null;
    }
    setStatus("Session locale effacée.");
  }

  const params = new URLSearchParams(window.location.search);
  const prefilledTarget = params.get("target");
  const prefilledContext = params.get("context");
  if (prefilledTarget && targetInput) targetInput.value = prefilledTarget;
  if (prefilledContext && contextInput) contextInput.value = prefilledContext;

  analyzeButton.addEventListener("click", analyze);
  exportButton.addEventListener("click", exportReport);
  clearButton.addEventListener("click", clearSession);
  for (const input of a11yInputs) input.addEventListener("change", updateManualStates);
})();
