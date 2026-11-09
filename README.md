# ArenaAI Mobile

**ArenaAI Mobile** is a NativeScript + Angular WebView mobile app wrapper for the website `https://arena.ai/`.

It provides a native shell (Android & iOS) that loads the web application inside a `WebView`, handling navigation, system bar styling, and back-button routing.

## Features

- Native WebView shell around `https://arena.ai/`
- Automatic dark/light mode system appearance sync
- Back-button handling (Android hardware back / iOS swipe)
- Splash screen and adaptive icons (Arena branding)
- Network security configuration (HTTPS only, cleartext disabled)
- Angular 22 + NativeScript 9.1.x + Tailwind CSS

## Commands

### Install dependencies
```bash
npm install
```

### Type-check (no build)
```bash
npx tsc --noEmit -p tsconfig.json
```

### Build Android (production)
```bash
node -e "
  process.env.NODE_ENV = 'production';
  const webpack = require('@nativescript/webpack');
  const wp = require('webpack');
  webpack.init({ android: true, production: true, buildPath: 'platforms' });
  const config = webpack.resolveConfig();
  wp(config, (err, stats) => {
    if (err) { console.error('FATAL', err); process.exit(1); }
    process.exit(stats.hasErrors() ? 1 : 0);
  });
"
```

### Build iOS (production)
```bash
node -e "
  process.env.NODE_ENV = 'production';
  const webpack = require('@nativescript/webpack');
  const wp = require('webpack');
  webpack.init({ ios: true, production: true, buildPath: 'platforms' });
  const config = webpack.resolveConfig();
  wp(config, (err, stats) => {
    if (err) { console.error('FATAL', err); process.exit(1); }
    process.exit(stats.hasErrors() ? 1 : 0);
  });
"
```

### Run locally (requires NativeScript CLI / emulator)
*(Note: environment provisioning is handled externally by the maintainer. The repository only contains the scaffold and build artefacts.)*
```bash
ns run android --bundle
# or
ns run ios --bundle
```

## Swapping Site / Theme

### Site Configuration
Edit `src/app/core/site.config.ts`:
- `SITE_URL`: the base URL loaded in the WebView (default: `https://arena.ai/`)
- `APP_NAME`: application display name
- `PRIMARY_HOSTS`: allowed hosts for internal routing
- `INJECTED_CSS` / `INJECTED_JS`: scripts/styles injected into the WebView

### Theme / Colours
- Light / Dark palette is defined in `src/app/core/web-view-tuner.ts` (`SHELL_BACKGROUND`)
- Android splash colours are in `App_Resources/Android/src/main/res/values/colors.xml`
- iOS splash colours are in `App_Resources/iOS/LaunchScreen.storyboard`
- Branding assets (logo / background) are in `App_Resources/{Android,iOS}/`

## Architecture

- `src/app/core/`: core utilities (config, session storage, back handler, platform-specific WebView tuners)
- `src/app/web-shell/`: single screen component (`WebShellComponent`) rendering the WebView
- `src/app/app.routes.ts`: single route mapping to the shell
- `App_Resources/`: native platform resources (manifest, Info.plist, assets, splash, icons)

## License

MIT
