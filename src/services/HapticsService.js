export class HapticsService {
  constructor() {
    this.enabled = true;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
  }

  async impact(style = 'Medium') {
    if (!this.enabled) return;
    try {
      const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
      await Haptics.impact({ style: ImpactStyle[style] || ImpactStyle.Medium });
    } catch {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(style === 'Heavy' ? 30 : style === 'Light' ? 8 : 16);
      }
    }
  }

  hit() {
    return this.impact('Heavy');
  }

  tap() {
    return this.impact('Light');
  }

  medium() {
    return this.impact('Medium');
  }
}
