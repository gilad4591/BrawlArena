import './styles/main.css';
import { App } from './app/App.js';
import { AudioService } from './services/AudioService.js';
import { HapticsService } from './services/HapticsService.js';
import { AdService } from './services/AdService.js';
import { PurchaseService } from './services/PurchaseService.js';

async function initNativeShell() {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return;

    const { StatusBar, Style } = await import('@capacitor/status-bar');
    const { ScreenOrientation } = await import('@capacitor/screen-orientation');
    const { SplashScreen } = await import('@capacitor/splash-screen');
    const { App: CapApp } = await import('@capacitor/app');

    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#0b0e1a' });
    await ScreenOrientation.lock({ orientation: 'landscape' });
    await SplashScreen.hide();

    CapApp.addListener('backButton', () => {
      window.dispatchEvent(new CustomEvent('brawl-back'));
    });

    // Relay foreground/background transitions so the app can auto-pause + mute.
    CapApp.addListener('appStateChange', ({ isActive }) => {
      window.dispatchEvent(new CustomEvent('brawl-appstate', { detail: { active: isActive } }));
    });
  } catch (err) {
    console.warn('Native init skipped:', err);
  }
}

/** Nudge the boot-splash progress bar (CSS-animated) as we pass load milestones. */
function bootProgress(pct) {
  const bar = document.getElementById('boot-bar');
  if (bar) bar.style.width = `${pct}%`;
}

async function bootstrap() {
  // Start the bar moving right away; it eases toward ~85% while assets load.
  requestAnimationFrame(() => bootProgress(30));

  await initNativeShell();
  bootProgress(50);

  const audio = new AudioService();
  const haptics = new HapticsService();
  const ads = new AdService();
  const purchases = new PurchaseService();
  await audio.init();
  await purchases.init();
  await ads.init();
  ads.setPurchases(purchases); // no interstitials once "Remove Ads" is owned
  bootProgress(70);

  const app = new App(document.getElementById('app'), { audio, haptics, ads, purchases });
  await app.init();
  bootProgress(100);

  // Menu DOM is built; hold at 100% for a beat, then fade the boot splash out.
  const splash = document.getElementById('boot-splash');
  if (splash) {
    setTimeout(() => splash.classList.add('hide'), 280);
    setTimeout(() => splash.remove(), 760);
  }

  document.addEventListener('pointerdown', () => audio.resume(), { once: true });
}

bootstrap().catch((err) => {
  console.error('Boot failed:', err);
  document.getElementById('boot-splash')?.remove();
});
