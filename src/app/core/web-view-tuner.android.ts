import { Application, Color, Utils, WebView } from '@nativescript/core';

/**
 * Android flavour of `web-view-tuner.ts`.
 *
 * Android's system WebView needs a few WebSettings before it can render a
 * modern SPA (DOM storage, wide viewport, mixed content, media playback) and
 * the system bars have to be painted by hand. This file replaces the shared
 * module on Android builds and exports exactly the same members.
 *
 * The WebViewClient installed by @nativescript/core is deliberately left in
 * place: it is what raises `loadStarted` / `loadFinished`, and it already hands
 * non-network URLs (mailto:, tel:) to the OS.
 */

/** Page background colours - also what the WebView paints before first byte. */
export const SHELL_BACKGROUND = {
  light: '#FFFFFF',
  dark: '#0B0B0F',
};

/** Strong references, so the Java proxies are not collected while in use. */
let chromeClient: any = null;

export function configureWebView(webView: WebView): void {
  const native = webView.android as android.webkit.WebView | undefined;
  if (!native) {
    return;
  }

  const settings = native.getSettings();
  settings.setJavaScriptEnabled(true);
  settings.setDomStorageEnabled(true);
  settings.setDatabaseEnabled(true);
  settings.setMediaPlaybackRequiresUserGesture(false);
  settings.setLoadWithOverviewMode(true);
  settings.setUseWideViewPort(true);
  settings.setJavaScriptCanOpenWindowsAutomatically(true);
  settings.setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
  // `target="_blank"` / `window.open` are handled by the chrome client below.
  settings.setSupportMultipleWindows(true);

  try {
    settings.setUserAgentString(`${settings.getUserAgentString()} ArenaAIApp/1.0`);
  } catch {
    // A custom user agent is a nice-to-have; it must never break the shell.
  }

  // Paint the page background like the shell instead of the default white.
  native.setBackgroundColor(new Color(SHELL_BACKGROUND.light).android);

  // No browser-style overscroll glow.
  try {
    native.setOverScrollMode(android.view.View.OVER_SCROLL_NEVER);
  } catch {
    // purely cosmetic
  }

  attachPopupHandler(native);
}

/**
 * Loads `window.open` / `target="_blank"` targets in the current view.
 *
 * NativeScript's Android WebView ships without a WebChromeClient, so without
 * this the site's "open in a new tab" links would silently do nothing. A second
 * window makes no sense in a phone-sized wrapper, so the request is redirected
 * into the view the user is already looking at.
 */
function attachPopupHandler(native: android.webkit.WebView): void {
  if (chromeClient) {
    return;
  }

  const ChromeClient = (android.webkit.WebChromeClient as any).extend({
    onCreateWindow(view: any, _isDialog: boolean, _isUserGesture: boolean, resultMsg: any): boolean {
      const transport = resultMsg?.obj as android.webkit.WebView.WebViewTransport | undefined;
      if (!transport) {
        return false;
      }

      // The URL is only known once the temporary view starts navigating, so
      // intercept that first request, replay it in the real view, then throw
      // the temporary one away.
      const popup = new android.webkit.WebView(view.getContext());
      const PopupClient = (android.webkit.WebViewClient as any).extend({
        shouldOverrideUrlLoading(popupView: any, request: any): boolean {
          const url =
            typeof request === 'string' ? request : request?.getUrl?.()?.toString?.() ?? '';
          if (url) {
            view.loadUrl(url);
          }
          try {
            popup.destroy();
          } catch {
            // ignore
          }
          return true;
        },
      });

      popup.setWebViewClient(new PopupClient());
      transport.setWebView(popup);
      resultMsg.sendToTarget();
      return true;
    },
  });

  chromeClient = new ChromeClient();

  try {
    native.setWebChromeClient(chromeClient);
  } catch {
    chromeClient = null;
  }
}

/** Runs JS in the page's main frame. */
export function executeScript(webView: WebView, script: string): void {
  webView.android?.evaluateJavascript?.(script, null);
}

/** Reads the page title straight from the native WebView. */
export function fetchTitle(webView: WebView, callback: (title: string) => void): void {
  const title = webView.android?.getTitle?.();
  if (title && String(title).trim()) {
    callback(String(title).trim());
  }
}

/**
 * Paints the status and navigation bars to match the shell surface.
 *
 * `Utils.android.setStatusBarColor` drives the edge-to-edge styling added in
 * NativeScript 9, so the bars stay aligned with the window instead of being
 * overdrawn by it.
 */
export function syncChrome(dark: boolean): void {
  try {
    const activity = Application.android.foregroundActivity;
    if (!activity) {
      return;
    }

    const surface = new Color(dark ? SHELL_BACKGROUND.dark : SHELL_BACKGROUND.light);

    Utils.android.setStatusBarColor({ activity, lightColor: surface, darkColor: surface });
    Utils.android.setNavigationBarColor({ activity, lightColor: surface, darkColor: surface });

    // Icon contrast: dark icons on a light surface and vice versa.
    const decor = activity.getWindow().getDecorView();
    const flags = decor.getSystemUiVisibility();
    decor.setSystemUiVisibility(
      dark
        ? flags & ~android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
        : flags | android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
    );
  } catch {
    // Theming must never crash the shell.
  }
}

/** The OS-level dark mode flag. */
export function prefersDarkChrome(): boolean {
  try {
    return Application.primaryWindow?.systemAppearance?.() === 'dark';
  } catch {
    return false;
  }
}
