import express from "express";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const aiInvoiceRouter = express.Router();

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.warn("No Gemini API key found in .env");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

// Use only valid/current model names you want to try
const MODEL_CANDIDATES = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-pro",
];

function buildInvoicePrompt(promptText) {
  const invoiceTemplate = {
    invoiceNumber: `INV-${Math.floor(Math.random() * 9000) + 1000}`,
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: "",
    fromBusinessName: "",
    fromEmail: "",
    fromAddress: "",
    fromPhone: "",
    client: {
      name: "",
      email: "",
      address: "",
      phone: "",
    },
    items: [
      {
        id: "1",
        description: "",
        qty: 1,
        unitPrice: 0,
      },
    ],
    taxPercent: 18,
    notes: "",
  };

  return `
You are an invoice generation assistant.

Task:
- Analyze the user's input text.
- Produce a valid JSON object only.
- Do not return markdown.
- Do not return code fences.
- Do not return explanations.
- The JSON must include all fields from the schema below, even if empty.
- Dates must be in YYYY-MM-DD format.
- qty, unitPrice, and taxPercent must be numbers.

Schema:
${JSON.stringify(invoiceTemplate, null, 2)}

User input:
${promptText}

Return JSON only.
`;
}

function extractTextFromResponse(response) {
  if (!response) return null;

  if (typeof response.text === "string" && response.text.trim()) {
    return response.text.trim();
  }

  if (Array.isArray(response.candidates)) {
    for (const candidate of response.candidates) {
      const parts = candidate?.content?.parts;
      if (Array.isArray(parts)) {
        const joined = parts
          .map((p) => (typeof p?.text === "string" ? p.text : ""))
          .filter(Boolean)
          .join("\n")
          .trim();

        if (joined) return joined;
      }
    }
  }

  try {
    return JSON.stringify(response);
  } catch {
    return String(response);
  }
}

function classifyGeminiError(err) {
  const raw =
    err?.message ||
    err?.error?.message ||
    err?.response?.data?.error?.message ||
    JSON.stringify(err);

  const text = String(raw);

  if (
    text.includes("reported as leaked") ||
    text.includes("PERMISSION_DENIED")
  ) {
    return {
      type: "LEAKED_KEY",
      message:
        "Your Gemini API key was reported as leaked or is blocked. Create a new API key and replace the old one in .env.",
    };
  }

  if (
    text.includes("RESOURCE_EXHAUSTED") ||
    text.includes("quota") ||
    text.includes("429")
  ) {
    return {
      type: "QUOTA_EXCEEDED",
      message:
        "Gemini quota exceeded for this project/key. Check Google AI Studio quota and billing.",
    };
  }

  if (
    text.includes("NOT_FOUND") ||
    text.includes("not found for API version") ||
    text.includes("is not found")
  ) {
    return {
      type: "MODEL_NOT_FOUND",
      message: "The configured Gemini model name is invalid or unavailable.",
    };
  }

  if (text.includes("API key not valid") || text.includes("invalid API key")) {
    return {
      type: "INVALID_KEY",
      message: "Gemini API key is invalid.",
    };
  }

  return {
    type: "UNKNOWN",
    message: text,
  };
}

async function tryGenerateWithModel(modelName, prompt) {
  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
  });

  const text = extractTextFromResponse(response);

  if (!text || !text.trim()) {
    throw new Error(`Empty text returned from model ${modelName}`);
  }

  return { text: text.trim(), modelName };
}

function extractJsonObject(text) {
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  return text.slice(firstBrace, lastBrace + 1);
}

aiInvoiceRouter.post("/generate", async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(500).json({
        success: false,
        message: "Server configuration failed: no Gemini API key found.",
      });
    }

    const { prompt } = req.body || {};

    if (!prompt || !String(prompt).trim()) {
      return res.status(400).json({
        success: false,
        message: "Prompt text is required.",
      });
    }

    const fullPrompt = buildInvoicePrompt(String(prompt).trim());

    let lastError = null;
    let lastText = null;
    let usedModel = null;
    let fatalError = null;

    for (const modelName of MODEL_CANDIDATES) {
      try {
        const result = await tryGenerateWithModel(modelName, fullPrompt);
        lastText = result.text;
        usedModel = result.modelName;
        break;
      } catch (err) {
        const classified = classifyGeminiError(err);

        console.warn(`Model ${modelName} failed:`, classified.message);

        lastError = err;

        // Stop immediately for key problems
        if (
          classified.type === "LEAKED_KEY" ||
          classified.type === "INVALID_KEY"
        ) {
          fatalError = classified;
          break;
        }

        // For quota/model issues, try next model
        continue;
      }
    }

    if (fatalError) {
      return res.status(502).json({
        success: false,
        message: fatalError.message,
        errorType: fatalError.type,
      });
    }

    if (!lastText) {
      const classified = classifyGeminiError(lastError);

      return res.status(502).json({
        success: false,
        message: "AI generation failed.",
        errorType: classified.type,
        detail: classified.message,
      });
    }

    const jsonText = extractJsonObject(lastText);

    if (!jsonText) {
      return res.status(502).json({
        success: false,
        message: "AI returned malformed response: no JSON object found.",
        model: usedModel,
        raw: lastText,
      });
    }

    let data;
    try {
      data = JSON.parse(jsonText);
    } catch (parseErr) {
      console.error("Failed to parse JSON from AI response:", parseErr);

      return res.status(502).json({
        success: false,
        message: "AI returned invalid JSON.",
        model: usedModel,
        raw: lastText,
      });
    }

    return res.status(200).json({
      success: true,
      model: usedModel,
      data,
    });
  } catch (err) {
    console.error("AI invoice generation error:", err);

    return res.status(500).json({
      success: false,
      message: "Internal server error during AI invoice generation.",
      detail: err?.message || String(err),
    });
  }
});

export default aiInvoiceRouter;
