import { Injectable } from '@angular/core';
import { ApplicationSettings } from '@nativescript/core';

const KEY = 'arena.webview.lastUrl';

/**
 * Remembers the last ArenaAI page the user was on so the WebView can be
 * restored on the next cold start (session continuity is lost otherwise,
 * because the page is hosted remotely).
 */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  private static readonly MAX_LENGTH = 2048;

  /** Last visited in-app URL, or `null` when there is nothing to restore. */
  get lastUrl(): string | null {
    try {
      const stored = ApplicationSettings.getString(KEY, '');
      if (!stored || stored.length > SessionStore.MAX_LENGTH) {
        return null;
      }

      // Only plain web URLs are restorable; never restore javascript:/file: etc.
      return /^https?:\/\//i.test(stored) ? stored : null;
    } catch {
      return null;
    }
  }

  save(url: string | undefined | null): void {
    if (!url || !/^https?:\/\//i.test(url) || url.length > SessionStore.MAX_LENGTH) {
      return;
    }

    try {
      ApplicationSettings.setString(KEY, url);
    } catch {
      // Storage is best-effort; failing to persist must never break browsing.
    }
  }

  clear(): void {
    try {
      ApplicationSettings.remove(KEY);
    } catch {
      // ignore
    }
  }
}
