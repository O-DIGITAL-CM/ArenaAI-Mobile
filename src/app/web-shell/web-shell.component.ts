import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  NO_ERRORS_SCHEMA,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { NativeScriptCommonModule } from '@nativescript/angular';
import {
  Application,
  Connectivity,
  Frame,
  Page,
  Utils,
  WebView,
} from '@nativescript/core';

import { BackHandler } from '../core/back-handler';
import { SessionStore } from '../core/session.store';
import {
  INJECTED_JS,
  SITE_URL,
  hostOf,
  isPrimaryUrl,
  isWebUrl,
} from '../core/site.config';
import {
  configureWebView,
  executeScript,
  fetchTitle,
  prefersDarkChrome,
  syncChrome,
} from '../core/web-view-tuner';

/** Subset of the NativeScript web view load payload used here. */
interface LoadEvent {
  url?: string;
  error?: string;
}

/**
 * NativeScript raises plain `Event`s from native views; the payload lives on
 * the event object itself, so the handlers narrow it where it is used.
 */
type NsEvent = Event & { object?: WebView } & LoadEvent;

@Component({
  selector: 'ns-web-shell',
  templateUrl: './web-shell.component.html',
  imports: [NativeScriptCommonModule],
  schemas: [NO_ERRORS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WebShellComponent implements OnInit, AfterViewInit, OnDestroy {
  /** The native web view, used for navigation and JS execution. */
  @ViewChild('browser', { static: false }) private browser?: WebView;

  private readonly zone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly session = inject(SessionStore);
  private readonly backHandler = inject(BackHandler);

  /** Provided by the router outlet; present for routed components only. */
  private readonly page = inject(Page, { optional: true });
  private readonly frame = inject(Frame, { optional: true });

  /** URL the native web view displays. */
  src = this.session.lastUrl ?? SITE_URL;

  /** `true` while a page is being fetched. */
  loading = true;

  /** `true` when the app gave up loading the site (offline, blocked, ...). */
  failed = false;

  /** Secondary line on the offline card. */
  failureDetail = '';

  /** Title of the loaded page, mirrored onto the Android task switcher. */
  pageTitle = 'Arena';

  /** Extra class for the shell container, swapped with the system theme. */
  shellClass = 'shell';

  private unsubscribeBack?: () => void;
  private hasLoadedOnce = false;
  private retryCount = 0;
  private destroyed = false;

  // ---------------------------------------------------------------- lifecycle

  ngOnInit(): void {
    // The page hosting a routed component creates an empty ActionBar on load
    // unless it is told otherwise before the first layout - that would push the
    // WebView down and show a stray header, so hide it as early as possible.
    const page = this.page;
    if (page) {
      page.actionBarHidden = true;
      page.backgroundSpanUnderStatusBar = true;
      this.applyStatusBarStyle(page);
    }

    if (this.frame) {
      // Frame-level switch: belt and braces, also covers pages created later.
      this.frame.actionBarVisibility = 'never';
    }
  }

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      this.paintChrome();
      this.unsubscribeBack = this.backHandler.register(() => this.goBack());
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.unsubscribeBack?.();
  }

  /** Runs once the native WebView instance exists. */
  onWebViewLoaded(args: NsEvent): void {
    const webView = (args?.object ?? this.browser) as WebView | undefined;
    if (!webView) {
      return;
    }

    this.zone.runOutsideAngular(() => {
      try {
        configureWebView(webView);
      } catch {
        // WebView tuning is an enhancement; browsing must work regardless.
      }
    });
  }

  // ------------------------------------------------------------- page events

  onLoadStarted(args: NsEvent): void {
    this.patch({ loading: true });

    const url = args?.url;
    if (isWebUrl(url) && isPrimaryUrl(url)) {
      this.session.save(url);
    }
  }

  onLoadFinished(args: NsEvent): void {
    if (args?.error) {
      this.handleLoadError(args.error);
      return;
    }

    this.hasLoadedOnce = true;
    this.retryCount = 0;
    this.patch({ loading: false, failed: false, failureDetail: '' });

    const url = args?.url;
    if (isWebUrl(url) && isPrimaryUrl(url)) {
      this.session.save(url);
    }

    this.zone.runOutsideAngular(() => {
      const webView = this.browser;
      if (!webView) {
        return;
      }

      try {
        executeScript(webView, INJECTED_JS);
      } catch {
        // Page tweaks are cosmetic.
      }

      fetchTitle(webView, (title) => this.applyTitle(title));
      this.paintChrome();
    });
  }

  // ----------------------------------------------------------- user actions

  /** Retry button on the offline card. */
  retry(): void {
    this.retryCount = 0;
    this.patch({ failed: false, loading: true, failureDetail: '' });

    const webView = this.browser;
    if (webView) {
      webView.reload();
      return;
    }

    // No native view yet: bounce `src` so the page is loaded from scratch.
    const url = this.src;
    this.src = '';
    this.cdr.markForCheck();
    setTimeout(() => {
      this.src = url;
      this.cdr.markForCheck();
    }, 50);
  }

  /** "Open in browser" button on the offline card. */
  openInBrowser(): void {
    Utils.openUrl(isWebUrl(this.src) ? this.src : SITE_URL);
  }

  // --------------------------------------------------------------- internals

  private patch(changes: Partial<WebShellComponent>): void {
    if (this.destroyed) {
      return;
    }

    this.zone.run(() => {
      Object.assign(this, changes);
      this.cdr.markForCheck();
    });
  }

  private applyTitle(title: string): void {
    this.patch({ pageTitle: title });

    try {
      // Shown in the Android task switcher, so the app reads as "Arena <page>"
      // instead of a nameless web wrapper.
      Application.android?.foregroundActivity?.setTitle(title);
    } catch {
      // purely cosmetic
    }
  }

  private handleLoadError(error: string): void {
    // Once the main document has rendered, later errors come from sub-resources
    // (analytics, avatars, ...) and do not deserve an error screen.
    if (this.hasLoadedOnce) {
      this.patch({ loading: false });
      return;
    }

    const offline = !this.isOnline();

    // Transient failures are common on mobile data: retry a couple of times
    // before showing the offline card.
    if (this.retryCount < 2 && !offline) {
      this.retryCount++;
      setTimeout(() => {
        if (!this.destroyed) {
          this.browser?.reload();
        }
      }, 600 * this.retryCount);
      return;
    }

    this.patch({
      loading: false,
      failed: true,
      failureDetail: offline
        ? 'You appear to be offline. Check your connection and try again.'
        : error || 'The site did not load. Please try again.',
    });
  }

  private isOnline(): boolean {
    try {
      return Connectivity.getConnectionType() !== Connectivity.connectionType.none;
    } catch {
      return true;
    }
  }

  /**
   * Back-button policy: close the offline card, then walk the web history,
   * then return to the site root, and only then leave the app.
   */
  private goBack(): boolean {
    if (this.failed) {
      this.retry();
      return true;
    }

    const webView = this.browser;
    if (webView?.canGoBack) {
      webView.goBack();
      return true;
    }

    if (isWebUrl(this.src) && hostOf(this.src) !== hostOf(SITE_URL)) {
      this.patch({ src: SITE_URL, loading: true });
      return true;
    }

    return false;
  }

  /** Keeps the shell background and the system bars aligned with the theme. */
  private paintChrome(): void {
    const dark = prefersDarkChrome();
    this.patch({ shellClass: dark ? 'shell shell-dark' : 'shell' });

    if (this.page) {
      this.applyStatusBarStyle(this.page);
    }

    syncChrome(dark);
  }

  /**
   * iOS reads the status-bar contrast off the page. `'light'` means light
   * icons (for a dark surface), `'dark'` means dark icons (light surface).
   */
  private applyStatusBarStyle(page: Page): void {
    try {
      page.statusBarStyle = prefersDarkChrome() ? 'light' : 'dark';
    } catch {
      // Android ignores this property; nothing to do there.
    }
  }
}
