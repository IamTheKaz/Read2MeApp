import { tokenAtChar, tokenAtTime, type SpeechToken } from "@/lib/page-model";
import { synthesizeSpeechFn } from "@/server/tts";

export type SpeechHandle = {
  cancel: () => void;
  done: Promise<void>;
  started: Promise<void>;
};

type SpeakOptions = {
  rate?: number;
  onBoundary?: (charIndex: number) => void;
  onToken?: (token: SpeechToken) => void;
  onStart?: () => void;
  tokens?: SpeechToken[];
};

function waitForVoices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === "undefined" || !window.speechSynthesis) return Promise.resolve([]);
  const existing = window.speechSynthesis.getVoices();
  if (existing.length > 0) return Promise.resolve(existing);
  return new Promise((resolve) => {
    const finish = () => resolve(window.speechSynthesis.getVoices());
    window.speechSynthesis.addEventListener("voiceschanged", finish, { once: true });
    window.setTimeout(finish, 800);
  });
}

async function pickVoice(): Promise<SpeechSynthesisVoice | null> {
  const voices = await waitForVoices();
  const scored = voices
    .filter((v) => /^en([-_]|$)/i.test(v.lang) || voices.length < 3)
    .map((voice) => {
      let score = 0;
      if (voice.localService) score += 8;
      if (/en-US/i.test(voice.lang)) score += 2;
      if (voice.localService && /Natural|Premium|Neural|Samantha|Aria|Jenny/i.test(voice.name)) {
        score += 3;
      }
      return { voice, score };
    })
    .sort((a, b) => b.score - a.score);
  return scored[0]?.voice ?? voices[0] ?? null;
}

function estimateMs(text: string, rate: number): number {
  const chars = Math.max(text.trim().length, 1);
  const ms = (chars / 13) * (1000 / rate);
  return Math.max(160, Math.min(2200, ms));
}

let active: { cancel: () => void } | null = null;
const audioCache = new Map<string, { mime: string; audio: string }>();

export function cancelSpeech() {
  active?.cancel();
  active = null;
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function makeHandle(): {
  handle: SpeechHandle;
  markStarted: () => void;
  finish: () => void;
  isCancelled: () => boolean;
  requestCancel: () => void;
} {
  let cancelled = false;
  let settle: (() => void) | undefined;
  let startSettle: (() => void) | undefined;
  let started = false;
  const done = new Promise<void>((resolve) => {
    settle = resolve;
  });
  const startedPromise = new Promise<void>((resolve) => {
    startSettle = resolve;
  });
  const markStarted = () => {
    if (started || cancelled) return;
    started = true;
    startSettle?.();
    startSettle = undefined;
  };
  const finish = () => {
    markStarted();
    settle?.();
    settle = undefined;
  };
  const requestCancel = () => {
    cancelled = true;
    finish();
  };
  const handle: SpeechHandle = { cancel: requestCancel, done, started: startedPromise };
  return {
    handle,
    markStarted,
    finish,
    isCancelled: () => cancelled,
    requestCancel,
  };
}

function runSpeechSynthesis(text: string, options?: SpeakOptions): SpeechHandle {
  const spoken = text.trim();
  const rate = options?.rate ?? 0.5;
  const timeouts: number[] = [];
  let utterance: SpeechSynthesisUtterance | null = null;
  const ctl = makeHandle();

  const cleanupEngine = () => {
    for (const id of timeouts) window.clearTimeout(id);
    timeouts.length = 0;
    if (utterance && window.speechSynthesis) window.speechSynthesis.cancel();
    utterance = null;
  };

  const finish = () => {
    cleanupEngine();
    if (active?.cancel === cancel) active = null;
    ctl.finish();
  };

  const cancel = () => {
    cleanupEngine();
    if (active?.cancel === cancel) active = null;
    ctl.requestCancel();
  };

  ctl.handle.cancel = cancel;
  active = { cancel };

  if (!spoken || !canSpeak()) {
    queueMicrotask(() => {
      if (!ctl.isCancelled()) finish();
    });
    return ctl.handle;
  }

  void (async () => {
    if (ctl.isCancelled()) return;
    const voice = await pickVoice();
    if (ctl.isCancelled()) return;

    await new Promise((r) => window.setTimeout(r, 40));
    if (ctl.isCancelled()) return;

    const u = new SpeechSynthesisUtterance(spoken);
    u.rate = rate;
    u.pitch = 1;
    u.lang = voice?.lang || "en-US";
    if (voice) u.voice = voice;
    utterance = u;

    let usedEngineBoundaries = false;

    const armFallback = () => {
      if (!options?.tokens || options.tokens.length === 0) return;
      let elapsed = 0;
      for (const token of options.tokens) {
        const startAt = elapsed;
        const id = window.setTimeout(() => {
          if (ctl.isCancelled() || usedEngineBoundaries) return;
          options.onToken?.(token);
        }, startAt);
        timeouts.push(id);
        elapsed += estimateMs(token.speak, rate);
      }
    };

    u.onstart = () => {
      if (ctl.isCancelled()) return;
      ctl.markStarted();
      options?.onStart?.();
      if (options?.tokens?.[0]) options.onToken?.(options.tokens[0]);
      armFallback();
    };

    u.onboundary = (event) => {
      if (ctl.isCancelled()) return;
      if (event.name && event.name !== "word") return;
      usedEngineBoundaries = true;
      const index = event.charIndex ?? 0;
      options?.onBoundary?.(index);
      if (options?.tokens) {
        const token = tokenAtChar(options.tokens, index);
        if (token) options.onToken?.(token);
      }
    };

    u.onend = () => {
      if (!ctl.isCancelled()) finish();
    };
    u.onerror = () => {
      if (!ctl.isCancelled()) finish();
    };

    window.speechSynthesis.speak(u);

    const watchdog = window.setTimeout(() => {
      if (ctl.isCancelled()) return;
      ctl.markStarted();
      options?.onStart?.();
      if (timeouts.length === 0) armFallback();
    }, 2500);
    timeouts.push(watchdog);
  })();

  return ctl.handle;
}

export function speakText(text: string, options?: SpeakOptions): SpeechHandle {
  cancelSpeech();
  return runSpeechSynthesis(text, options);
}

function b64ToBlob(b64: string, mime: string): Blob {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function waitCanPlayThrough(audio: HTMLAudioElement, timeoutMs = 12000): Promise<boolean> {
  if (audio.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) return Promise.resolve(true);
  return new Promise((resolve) => {
    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      audio.removeEventListener("canplaythrough", onReady);
      audio.removeEventListener("canplay", onReady);
      audio.removeEventListener("error", onErr);
      resolve(ok);
    };
    const onReady = () => done(true);
    const onErr = () => done(false);
    const timer = window.setTimeout(
      () => done(audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA),
      timeoutMs,
    );
    audio.addEventListener("canplaythrough", onReady, { once: true });
    audio.addEventListener("canplay", onReady, { once: true });
    audio.addEventListener("error", onErr, { once: true });
    audio.load();
  });
}

async function fetchPageAudio(text: string): Promise<{ mime: string; audio: string } | null> {
  const cached = audioCache.get(text);
  if (cached) return cached;
  try {
    const result = await synthesizeSpeechFn({ data: { text } });
    if (!result.ok) return null;
    audioCache.set(text, { mime: result.mime, audio: result.audio });
    return result;
  } catch {
    return null;
  }
}

/**
 * Full-page narration: preload the complete audio (canplaythrough) before any
 * playback or karaoke highlighting, so the highlight clock is locked to the
 * actual sound even on a slow connection. Falls back to SpeechSynthesis if
 * generated audio isn't available.
 */
export function speakPage(text: string, options: SpeakOptions): SpeechHandle {
  cancelSpeech();
  const spoken = text.trim();
  const ctl = makeHandle();
  let audio: HTMLAudioElement | null = null;
  let objectUrl: string | null = null;

  const cleanupMedia = () => {
    if (audio) {
      audio.ontimeupdate = null;
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audio = null;
    }
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  };

  const finish = () => {
    cleanupMedia();
    if (active?.cancel === cancel) active = null;
    ctl.finish();
  };

  const cancel = () => {
    cleanupMedia();
    if (active?.cancel === cancel) active = null;
    ctl.requestCancel();
  };

  ctl.handle.cancel = cancel;
  active = { cancel };

  if (!spoken) {
    queueMicrotask(() => {
      if (!ctl.isCancelled()) finish();
    });
    return ctl.handle;
  }

  void (async () => {
    const clip = await fetchPageAudio(spoken);
    if (ctl.isCancelled()) return;

    if (!clip) {
      if (active?.cancel === cancel) active = null;
      const nested = runSpeechSynthesis(spoken, options);
      ctl.handle.cancel = () => nested.cancel();
      void nested.started.then(() => {
        if (!ctl.isCancelled()) ctl.markStarted();
      });
      void nested.done.then(() => {
        if (!ctl.isCancelled()) ctl.finish();
      });
      return;
    }

    const blob = b64ToBlob(clip.audio, clip.mime);
    objectUrl = URL.createObjectURL(blob);
    const el = new Audio();
    el.preload = "auto";
    el.src = objectUrl;
    audio = el;

    const ready = await waitCanPlayThrough(el);
    if (ctl.isCancelled()) return;
    if (!ready) {
      cleanupMedia();
      if (active?.cancel === cancel) active = null;
      const nested = runSpeechSynthesis(spoken, options);
      ctl.handle.cancel = () => nested.cancel();
      void nested.started.then(() => {
        if (!ctl.isCancelled()) ctl.markStarted();
      });
      void nested.done.then(() => {
        if (!ctl.isCancelled()) ctl.finish();
      });
      return;
    }

    const duration =
      Number.isFinite(el.duration) && el.duration > 0
        ? el.duration
        : Math.max(0.4, spoken.length / 13);

    const tick = () => {
      if (ctl.isCancelled() || !options.tokens) return;
      const token = tokenAtTime(options.tokens, el.currentTime, duration);
      if (token) options.onToken?.(token);
    };

    el.ontimeupdate = tick;
    el.onended = () => {
      if (!ctl.isCancelled()) finish();
    };
    el.onerror = () => {
      if (!ctl.isCancelled()) finish();
    };

    try {
      await el.play();
    } catch {
      if (!ctl.isCancelled()) finish();
      return;
    }
    if (ctl.isCancelled()) return;
    ctl.markStarted();
    options.onStart?.();
    tick();
  })();

  return ctl.handle;
}
