import { createServerFn } from "@tanstack/react-start";

export type SynthesizeResult =
  | { ok: true; mime: string; audio: string }
  | { ok: false; reason: string };

const MAX_CHARS = 1500;

/**
 * Turn a page sentence into MP3 bytes via xAI Voice. User-initiated only
 * (Read to me / Preview narration). Falls back on the client if the key is
 * missing or the request fails.
 */
export const synthesizeSpeechFn = createServerFn({ method: "POST" })
  .validator((input: { text: string }) => {
    if (typeof input?.text !== "string" || !input.text.trim()) {
      throw new Error("text required");
    }
    return { text: input.text.trim().slice(0, MAX_CHARS) };
  })
  .handler(async ({ data }): Promise<SynthesizeResult> => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false, reason: "unavailable" };
    try {
      const res = await fetch("https://api.x.ai/v1/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          text: data.text,
          voice_id: "eve",
          language: "en",
        }),
      });
      if (!res.ok) return { ok: false, reason: `tts ${res.status}` };
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.byteLength < 64) return { ok: false, reason: "empty" };
      const mime = res.headers.get("content-type") || "audio/mpeg";
      return { ok: true, mime, audio: buf.toString("base64") };
    } catch {
      return { ok: false, reason: "network" };
    }
  });
