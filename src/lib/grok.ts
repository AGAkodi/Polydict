// lib/grok.ts
import OpenAI from "openai";

export const grok = new OpenAI({
    apiKey: process.env.XAI_API_KEY || "dummy-xai-key-for-build",
    baseURL: "https://api.x.ai/v1",
});