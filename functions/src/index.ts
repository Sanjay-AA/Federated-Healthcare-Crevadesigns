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
