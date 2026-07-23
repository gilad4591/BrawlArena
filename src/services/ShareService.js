/**
 * Cross-platform "share an image" helper.
 *   - Native (Android/iOS via Capacitor): write the PNG to the cache dir with
 *     @capacitor/filesystem, then hand its file:// URI to @capacitor/share so
 *     the OS share sheet can send it to any app (Messages, Instagram, etc.).
 *   - Web: the Web Share API (navigator.share with a File) opens the same
 *     kind of native share sheet on mobile browsers; where that's
 *     unsupported (most desktop browsers), fall back to a plain image
 *     download so the user can share it manually.
 */
export class ShareService {
  constructor() {
    this.native = false;
  }

  async init() {
    try {
      const { Capacitor } = await import('@capacitor/core');
      this.native = Capacitor.isNativePlatform();
    } catch {
      this.native = false;
    }
  }

  /** canvas: an HTMLCanvasElement already drawn with the result card. */
  async shareCanvas(canvas, { title, text, fileName = 'brawl-arena-result.png' } = {}) {
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return false;
    if (this.native) return this._shareNative(blob, { title, text, fileName });
    return this._shareWeb(blob, { title, text, fileName });
  }

  async _shareNative(blob, { title, text, fileName }) {
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const { Share } = await import('@capacitor/share');
      const base64 = await blobToBase64(blob);
      const written = await Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: Directory.Cache,
      });
      await Share.share({ title, text, files: [written.uri] });
      return true;
    } catch (err) {
      console.warn('[share] native share failed:', err);
      return false;
    }
  }

  async _shareWeb(blob, { title, text, fileName }) {
    try {
      const file = new File([blob], fileName, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title, text, files: [file] });
        return true;
      }
    } catch (err) {
      // A user-cancelled share() rejects too — not a real failure, just don't
      // fall through to a surprise download in that case.
      if (err?.name === 'AbortError') return false;
      console.warn('[share] web share failed, falling back to download:', err);
    }
    // No Web Share (or no file support): download the PNG so the user can
    // still post it manually — better than a dead end.
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
