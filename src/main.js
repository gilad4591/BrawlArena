import './styles/main.css';
import { App } from './app/App.js';
import { AudioService } from './services/AudioService.js';
import { HapticsService } from './services/HapticsService.js';
import { AdService } from './services/AdService.js';

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

async function bootstrap() {
  await initNativeShell();

  const audio = new AudioService();
  const haptics = new HapticsService();
  const ads = new AdService();
  await audio.init();
  await ads.init();

  const app = new App(document.getElementById('app'), { audio, haptics, ads });
  await app.init();

  // Menu DOM is built; give it one frame to paint, then fade the boot splash out.
  const splash = document.getElementById('boot-splash');
  if (splash) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => splash.classList.add('hide'));
    });
    setTimeout(() => splash.remove(), 500);
  }

  document.addEventListener('pointerdown', () => audio.resume(), { once: true });
}

bootstrap().catch((err) => {
  console.error('Boot failed:', err);
  document.getElementById('boot-splash')?.remove();
});
