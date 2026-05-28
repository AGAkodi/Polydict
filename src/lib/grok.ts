// lib/grok.ts
import OpenAI from "openai";

if (!process.env.XAI_API_KEY) {
    throw new Error("Missing XAI_API_KEY in environment variables");
}

export const grok = new OpenAI({
    apiKey: process.env.XAI_API_KEY,
    baseURL: "https://api.x.ai/v1",
});