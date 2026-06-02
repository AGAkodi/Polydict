import OpenAI from "openai";

export const groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY || "dummy-groq-key-for-build",
    baseURL: "https://api.groq.com/openai/v1",
});