import { tokenAtChar, type SpeechToken } from "@/lib/page-model";

export type SpeechHandle = {
  cancel: () => void;
  done: Promise<void>;
};

function waitForVoices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === "undefined" || !window.speechSynthesis) return Promise.resolve([]);
  const existing = window.speechSynthesis.getVoices();
  if (existing.length > 0) return Promise.resolve(existing);
  return new Promise((resolve) => {
    const finish = () => resolve(window.speechSynthesis.getVoices());
    window.speechSynthesis.addEventListener("voiceschanged", finish, { once: true });
    window.setTimeout(finish, 600);
  });
}

async function pickVoice(): Promise<SpeechSynthesisVoice | null> {
  const voices = await waitForVoices();
  const scored = voices
    .filter((v) => /^en([-_]|$)/i.test(v.lang))
    .map((voice) => {
      let score = 0;
      if (/en-US/i.test(voice.lang)) score += 2;
      if (/Google|Natural|Premium|Neural|Samantha|Aria|Jenny/i.test(voice.name)) score += 3;
      if (voice.localService) score += 1;
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

export function speakText(
  text: string,
  options?: {
    rate?: number;
    onBoundary?: (charIndex: number) => void;
    onToken?: (token: SpeechToken) => void;
    tokens?: SpeechToken[];
  },
): SpeechHandle {
  cancelSpeech();
  const spoken = text.trim();
  const rate = options?.rate ?? 0.5;
  let cancelled = false;
  const timeouts: number[] = [];
  let utterance: SpeechSynthesisUtterance | null = null;
  let settle: (() => void) | undefined;

  const done = new Promise<void>((resolve) => {
    settle = resolve;
  });

  const finish = () => {
    for (const id of timeouts) window.clearTimeout(id);
    timeouts.length = 0;
    if (active && utterance && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    utterance = null;
    if (active?.cancel === cancel) active = null;
    settle?.();
    settle = undefined;
  };

  const cancel = () => {
    cancelled = true;
    finish();
  };

  active = { cancel };

  if (!spoken || !canSpeak()) {
    queueMicrotask(() => {
      if (!cancelled) finish();
    });
    return { cancel, done };
  }

  void (async () => {
    if (cancelled) return;
    const voice = await pickVoice();
    if (cancelled) return;

    // Chrome drops speak() if it immediately follows cancel().
    await new Promise((r) => window.setTimeout(r, 40));
    if (cancelled) return;

    const u = new SpeechSynthesisUtterance(spoken);
    u.rate = rate;
    u.pitch = 1;
    u.lang = voice?.lang || "en-US";
    if (voice) u.voice = voice;
    utterance = u;

    let usedEngineBoundaries = false;
    u.onboundary = (event) => {
      if (cancelled) return;
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
      if (!cancelled) finish();
    };
    u.onerror = () => {
      if (!cancelled) finish();
    };

    if (options?.tokens && options.tokens.length > 0) {
      let elapsed = 0;
      for (const token of options.tokens) {
        const startAt = elapsed;
        const id = window.setTimeout(() => {
          if (cancelled || usedEngineBoundaries) return;
          options.onToken?.(token);
        }, startAt);
        timeouts.push(id);
        elapsed += estimateMs(token.speak, rate);
      }
    }

    window.speechSynthesis.speak(u);
  })();

  return { cancel, done };
}
