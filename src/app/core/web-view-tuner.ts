import { Application, WebView } from '@nativescript/core';

import { USER_AGENT_SUFFIX } from './site.config';

/**
 * Native WebView tuning shared by both platforms.
 *
 * `web-view-tuner.android.ts` replaces this module on Android, where extra
 * WebSettings and a popup handler are needed. Both files export exactly the
 * same four members, so the shell itself never branches on the platform.
 */

/** Runs once, right after the native WebView exists. */
export function configureWebView(webView: WebView): void {
  const native = webView.ios;
  if (!native) {
    return;
  }

  // Append our marker to the stock WKWebView user agent so the site can tell
  // the app and a mobile browser apart.
  try {
    native.customUserAgent = `${native.customUserAgent ?? ''} ${USER_AGENT_SUFFIX}`.trim();
  } catch {
    // A custom user agent is a nice-to-have; it must never break the shell.
  }

  // Swipe from the left edge to go back, like Safari and Chrome.
  native.allowsBackForwardNavigationGestures = true;
  native.allowsLinkPreview = true;

  // `window.open` / `target="_blank"` are routed into this same view by the
  // WKUIDelegate that @nativescript/core installs, which needs this preference.
  native.configuration?.preferences?.setValueForKey?.(
    true,
    'javaScriptCanOpenWindowsAutomatically'
  );

  // Safari Web Inspector for debug builds only.
  if (typeof __DEV__ !== 'undefined' && __DEV__ && native.inspectable !== undefined) {
    native.inspectable = true;
  }
}

/** Executes JS inside the loaded page. */
export function executeScript(webView: WebView, script: string): void {
  webView.ios?.evaluateJavaScriptCompletionHandler?.(script, () => void 0);
}

/** Reads `document.title` out of the loaded page. */
export function fetchTitle(webView: WebView, callback: (title: string) => void): void {
  webView.ios?.evaluateJavaScriptCompletionHandler?.('document.title', (value: unknown) => {
    if (typeof value === 'string' && value.trim()) {
      callback(value.trim());
    }
  });
}

/** The OS-level appearance, so the shell can pick matching colours. */
export function prefersDarkChrome(): boolean {
  try {
    return Application.primaryWindow?.systemAppearance?.() === 'dark';
  } catch {
    return false;
  }
}

/**
 * Paints the native system bars to match the shell surface.
 *
 * iOS derives the status-bar appearance from the view hierarchy and the system
 * appearance on its own, so there is nothing to paint here; Android overrides
 * this module and colours both bars.
 */
export function syncChrome(_dark: boolean): void {
  // no-op on iOS
}

/** Page background colours - also what the WebView paints before first byte. */
export const SHELL_BACKGROUND = {
  light: '#FFFFFF',
  dark: '#0B0B0F',
};
