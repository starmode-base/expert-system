import OpenAI from "openai";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { playAudio } from "openai/helpers/audio";

/**
 * Generate speech audio from text and return it as a base‑64‑encoded WAV file.
 * The request is streamed so the caller can begin playback before the full
 * file finishes generating.
 */
const openai = new OpenAI();

/**
 * Server function that the frontend can call.
 * It returns a base‑64 string that the browser can convert into a Blob/URL
 * and play through an <audio> element.
 */
export const ttsSF = createServerFn({
  method: "POST",
  response: "raw",
})
  .validator(z.string())
  .handler(async ({ data }) => {
    //TODO: https://platform.openai.com/docs/guides/text-to-speech
    const response = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "alloy",
      instructions:
        "Spark the listener's interest. Be enthusiastic yet very clear.",
      input: data,
      response_format: "wav",
    });

    await playAudio(response);

    return response;
  });
