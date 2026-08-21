import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

/**
 * Generates an AI situation briefing for health officials regarding a specific PHC and medicine status.
 *
 * @param {Object} phcData { phc_name, district, medicine_name, predicted_days_to_stockout, case_growth_rate, current_stock }
 * @returns {Promise<string>} Plain-language briefing text.
 */
export async function generateSituationBriefing(phcData) {
  // If the API key is not configured or is a placeholder, return a clean mock/local briefing
  if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY_HERE" || apiKey.trim() === "") {
    return `${phcData.phc_name} in ${phcData.district} is monitoring ${phcData.medicine_name} stock (${phcData.current_stock} units remaining) with a reported case growth of +${phcData.case_growth_rate}% this week. Stockout is predicted in ${phcData.predicted_days_to_stockout} days at current rates.`;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `Write a 2-sentence plain-language situation briefing for a health official regarding a Primary Health Centre (PHC).

Details:
- PHC Name: ${phcData.phc_name}
- District: ${phcData.district}
- Medicine: ${phcData.medicine_name}
- Current Stock: ${phcData.current_stock} units
- Projected Days to Stockout: ${phcData.predicted_days_to_stockout} days
- Reported Case Growth Rate: +${phcData.case_growth_rate}% this week

Tone: Plain-language, professional, urgent if stockout is soon. Do not include any markdown formatting, bullet points, or extra text. Just output the two sentences directly.
Example: "Namakkal Town PHC is facing a 22% rise in dengue cases this week, and IV Fluid stock is projected to run out in 2 days at the current consumption rate. Immediate resupply or redistribution is recommended."`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    return text.trim();
  } catch (error) {
    console.error("Gemini briefing generation failed, falling back to local description:", error);
    return `${phcData.phc_name} in ${phcData.district} is monitoring ${phcData.medicine_name} stock (${phcData.current_stock} units remaining) with a reported case growth of +${phcData.case_growth_rate}% this week. Stockout is predicted in ${phcData.predicted_days_to_stockout} days at current rates.`;
  }
}
