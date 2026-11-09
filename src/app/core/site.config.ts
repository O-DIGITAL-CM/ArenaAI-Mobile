/**
 * Central configuration for the ArenaAI mobile shell.
 *
 * The app is a thin native shell that hosts https://arena.ai in a WebView, so
 * everything that could change over time is kept in this one file.
 */

/** The website the app wraps. */
export const SITE_URL = 'https://arena.ai/';

/** Human readable app name, used in copy and diagnostics. */
export const APP_NAME = 'Arena';

/** Host names that are considered "inside" the app. */
export const PRIMARY_HOSTS = ['arena.ai', 'www.arena.ai'];

/** Suffix appended to the WebView user agent so the site can detect the app. */
export const USER_AGENT_SUFFIX = 'ArenaAIApp/1.0';

/**
 * Styles injected into every page so the wrapped site blends into the native
 * shell instead of looking like a browser tab.
 */
const INJECTED_CSS = `
  html, body {
    -webkit-tap-highlight-color: transparent;
    -webkit-text-size-adjust: 100%;
  }
  ::-webkit-scrollbar { width: 0 !important; height: 0 !important; }
`;

/**
 * Injected into every page right after it loads so the wrapped site blends
 * into the native shell.
 */
export const INJECTED_JS = `(function () {
  if (window.__arenaShell) { return; }
  window.__arenaShell = { version: 1 };

  // Links/scripts that ask for a new window cannot open one inside a plain
  // WebView, so they are navigated in the current view instead (iOS already
  // does this natively; this keeps Android in step).
  var nativeOpen = window.open;
  window.open = function (url) {
    if (typeof url === 'string' && url) { window.location.href = url; }
    return null;
  };

  document.addEventListener('click', function (event) {
    var target = event.target;
    var link = target && target.closest ? target.closest('a[target="_blank"]') : null;
    if (!link || !link.href) { return; }
    event.preventDefault();
    window.location.href = link.href;
  }, true);

  if (!document.getElementById('arena-native-style')) {
    var style = document.createElement('style');
    style.id = 'arena-native-style';
    style.textContent = ${JSON.stringify(INJECTED_CSS)};
    (document.head || document.documentElement).appendChild(style);
  }
})();`;

/** Turns a raw URL into its host name, tolerating malformed input. */
export function hostOf(url: string | undefined | null): string {
  if (!url) {
    return '';
  }

  const match = /^(?:[a-z][a-z0-9+.-]*:)?\/\/([^/:?#]+)/i.exec(url.trim());
  return match ? match[1].toLowerCase() : '';
}

/** True when the URL belongs to the wrapped site (and should stay in-app). */
export function isPrimaryUrl(url: string | undefined | null): boolean {
  const host = hostOf(url);
  if (!host) {
    return false;
  }

  return PRIMARY_HOSTS.some((primary) => host === primary || host.endsWith(`.${primary}`));
}

/** True for plain web URLs - the only kind the app is allowed to load. */
export function isWebUrl(url: string | undefined | null): boolean {
  return !!url && /^https?:\/\//i.test(url.trim());
}

/** True for links that the operating system has to open (mail, phone, sms). */
export function isExternalSchemeUrl(url: string | undefined | null): boolean {
  return !!url && /^(mailto|tel|sms):/i.test(url.trim());
}
