import { Injectable, NgZone, inject } from '@angular/core';
import { Application, isAndroid } from '@nativescript/core';

/** Returns `true` when the handler consumed the gesture. */
export type BackPredicate = () => boolean;

/** Payload of the NativeScript `activityBackPressed` event. */
interface BackPressedEvent {
  cancel?: boolean;
}

/**
 * Central Android hardware/gesture back dispatcher.
 *
 * NativeScript fires one global `activityBackPressed` event. Screens register
 * here instead of each listening to the event themselves, so only the handler
 * that is currently relevant runs: go back inside the WebView first, and exit
 * the app only when there is no history left.
 */
@Injectable({ providedIn: 'root' })
export class BackHandler {
  private readonly zone = inject(NgZone);
  private readonly handlers: BackPredicate[] = [];
  private listening = false;
  private attachedActivity?: unknown;

  /**
   * Registers a handler. Returning `true` means "handled, do not exit".
   * The returned function unregisters it again.
   */
  register(handler: BackPredicate): () => void {
    this.handlers.push(handler);
    this.attach();

    return () => {
      const index = this.handlers.indexOf(handler);
      if (index >= 0) {
        this.handlers.splice(index, 1);
      }
      if (!this.handlers.length) {
        this.detach();
      }
    };
  }

  private get android() {
    return isAndroid ? Application.android : null;
  }

  private attach(): void {
    const android = this.android;
    if (this.listening || !android) {
      return;
    }

    const activity = android.foregroundActivity;
    if (activity && this.attachedActivity === activity) {
      return;
    }

    this.attachedActivity = activity;
    android.on(android.activityBackPressedEvent, this.onNativeBack as never, this);
    this.listening = true;
  }

  private detach(): void {
    const android = this.android;
    if (!this.listening || !android) {
      return;
    }

    try {
      android.off(android.activityBackPressedEvent, this.onNativeBack as never, this);
    } catch {
      // The activity may already be gone; nothing to clean up then.
    }

    this.listening = false;
    this.attachedActivity = undefined;
  }

  /** Runs handlers last-in-first-out; the first one that returns `true` wins. */
  private readonly onNativeBack = (args: BackPressedEvent): void => {
    // Claim the event optimistically, then decide what to do with it.
    args.cancel = true;

    this.zone.run(() => {
      for (let i = this.handlers.length - 1; i >= 0; i--) {
        try {
          if (this.handlers[i]()) {
            return;
          }
        } catch {
          // A broken handler must not block the remaining ones.
        }
      }

      this.exitApp();
    });
  };

  /**
   * Closes the app the way the launcher button does. NativeScript 9 no longer
   * exposes `Application.exit()`, and finishing the root activity is the
   * documented replacement.
   */
  private exitApp(): void {
    try {
      Application.android.foregroundActivity?.finish();
    } catch {
      // Ignore: if the activity is already finishing, there is nothing to do.
    }
  }
}
