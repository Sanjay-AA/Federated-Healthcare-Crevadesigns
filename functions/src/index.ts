import { onCall, HttpsError } from "firebase-functions/v2/https";
import { GoogleAuth } from "google-auth-library";
import { setGlobalOptions } from "firebase-functions";

setGlobalOptions({ maxInstances: 10 });

// Initialize GoogleAuth client for calling Google APIs
const auth = new GoogleAuth({
  scopes: "https://www.googleapis.com/auth/cloud-platform",
});

/**
 * Cloud Function proxy that securely delegates stockout predictions to Vertex AI.
 */
export const predictStockout = onCall(async (request) => {
  const { consumption_trend, case_growth_rate, current_stock } = request.data || {};

  if (
    consumption_trend === undefined ||
    case_growth_rate === undefined ||
    current_stock === undefined
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Missing required features: consumption_trend, case_growth_rate, current_stock"
    );
  }

  // Get project config from environment variables (or fall back to placeholders)
  const projectId = process.env.VERTEX_PROJECT_ID || "demo-federated-healthcare";
  const region = process.env.VERTEX_REGION || "us-central1";
  const endpointId = process.env.VERTEX_ENDPOINT_ID || "placeholder-endpoint-id";

  try {
    // Get OAuth2 access token for authentication
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    const accessToken = tokenResponse.token;

    if (!accessToken) {
      throw new Error("Failed to obtain Google Cloud OAuth2 access token");
    }

    const url = `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/endpoints/${endpointId}:predict`;

    // Construct the standard Vertex AI tabular prediction payload
    const payload = {
      instances: [
        {
          consumption_trend: Number(consumption_trend),
          case_growth_rate: Number(case_growth_rate),
          current_stock: Number(current_stock),
        },
      ],
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Vertex AI returned status ${response.status}: ${errorText}`);
    }

    const result = (await response.json()) as { predictions: any[] };

    // Extract predicted days to stockout
    const predictionValue = result.predictions?.[0];
    if (predictionValue === undefined) {
      throw new Error("No prediction returned from Vertex AI endpoint");
    }

    const daysToStockout = Array.isArray(predictionValue)
      ? Number(predictionValue[0])
      : Number(predictionValue);

    return { daysToStockout };
  } catch (error: any) {
    console.error("Vertex AI proxy error:", error);
    throw new HttpsError("internal", error.message || "Failed to query Vertex AI");
  }
});


/**
 * Cloud Function proxy that securely generates situation briefings using Gemini.
 */
export const generateBriefing = onCall(async (request) => {
  const { decision, language } = request.data || {};

  if (!decision) {
    throw new HttpsError("invalid-argument", "Missing required 'decision' structured data.");
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new HttpsError("failed-precondition", "Gemini API key is not configured.");
  }

  const langName = language === 'ml' ? 'Malayalam (മലയാളം)' : language === 'ta' ? 'Tamil (தமிழ்)' : language === 'hi' ? 'Hindi (हिंदी)' : 'English';

  const systemInstruction = `You are an AI decision-support assistant for a public healthcare inventory command center.

Your role is to summarize verified inventory, demand, stockout prediction, risk, and redistribution results for healthcare administrators.

You must ONLY use the information provided in the structured input. Do not invent stock levels, dates, PHCs, quantities, risks, diseases, or recommendations.
Do not change or override the calculated prediction or redistribution recommendation.

Clearly distinguish between:
- observed inventory data (current stock, safety stock, daily consumption)
- model-generated prediction (predicted days until stockout)
- calculated redistribution recommendation (transfer quantity, donor PHC, safe surplus)
- your natural-language explanation

Tone: Plain-language, professional, and suitable for a public health administrator.
Do not provide clinical treatment advice.
Do not invent emergency procedures.
Do not claim that a transfer has occurred when it is only a recommendation.

You must generate all text field values in the JSON output in the requested language: ${langName}. However, do not translate English medicine names, PHC names, or district names incorrectly if they are in English in the input data. Maintain numeric values exactly as provided.`;

  const prompt = `Generate a structured situation briefing in JSON format based on the following verified decision data:
${JSON.stringify(decision, null, 2)}

The output MUST be a JSON object with these exact keys:
{
  "headline": "A short, concise headline summarizing the situation (e.g., Paracetamol stockout risk at Namakkal Town PHC)",
  "situation": "A concise description of the current stock, daily consumption, and safety stock target (e.g., Current stock is 50 tablets against safety stock target of 300 tablets, with average daily consumption of 120 tablets)",
  "riskExplanation": "A concise explanation of the predicted days to stockout and the risk level (e.g., Predicted stockout is in 2 days, representing a CRITICAL risk level)",
  "recommendedAction": "A concise statement of the recommended action (e.g., Transfer of 250 tablets from Salem PHC is proposed, or no safe donor is available, or no redistribution is required)",
  "reason": "Why this recommendation is appropriate (e.g., Salem PHC has 600 tablets safely available above its safety stock, or routine monitoring is recommended as inventory is stable)",
  "priority": "HIGH, MEDIUM, or LOW based on the risk level (CRITICAL/HIGH risk is HIGH priority, MEDIUM risk is MEDIUM priority, LOW risk is LOW priority)",
  "confidenceNote": "A short note indicating this briefing is grounded in the deterministic/AI pipeline calculation data"
}

All JSON field values must be generated in the language: ${langName}. The keys themselves must remain in English. Return ONLY the JSON object, with no other text, markdown, or comments.`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        systemInstruction: {
          parts: [
            {
              text: systemInstruction
            }
          ]
        },
        generationConfig: {
          responseMimeType: "application/json"
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API returned status ${response.status}: ${errorText}`);
    }

    const result = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string;
          }>;
        };
      }>;
    };

    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return text.trim();
  } catch (error: any) {
    console.error("Gemini API proxy error:", error);
    throw new HttpsError("internal", error.message || "Failed to generate briefing via Gemini");
  }
});

