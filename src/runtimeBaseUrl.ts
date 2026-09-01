export const legacyLocalApiBaseUrl = "http://localhost:10588/api";

interface BrowserLocation {
  origin: string;
  protocol: string;
}

function isHttpLocation(location: BrowserLocation): boolean {
  return location.protocol === "http:" || location.protocol === "https:";
}

export function getInitialApiBaseUrl(location: BrowserLocation): string {
  return isHttpLocation(location) ? `${location.origin.replace(/\/$/, "")}/api` : legacyLocalApiBaseUrl;
}

export function migrateLegacyWebApiBaseUrl(current: string, location: BrowserLocation): string {
  if (!isHttpLocation(location) || current !== legacyLocalApiBaseUrl) return current;
  return getInitialApiBaseUrl(location);
}
