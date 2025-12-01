import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { description, amount, groups, subgroups } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build context for AI with available groups and subgroups
    const groupsList = groups.map((g: any) => `${g.name} (${g.icon})`).join(", ");
    const subgroupsList = subgroups.map((s: any) => {
      const group = groups.find((g: any) => g.id === s.group_id);
      return `${s.name} (${s.icon}) under ${group?.name}`;
    }).join(", ");

    const systemPrompt = `You are an expense categorization assistant. Analyze transaction descriptions and suggest the most appropriate category and subcategory.

Available expense groups: ${groupsList}

Available subgroups: ${subgroupsList}

Return a JSON object with:
- group_id: the ID of the most appropriate group
- subgroup_id: the ID of the most appropriate subgroup (or null if none fits)
- confidence: a score from 0-100 indicating confidence in the categorization
- reasoning: brief explanation of why this category was chosen`;

    const userPrompt = `Categorize this expense:
Description: "${description}"
Amount: ${amount}

Groups available:
${JSON.stringify(groups, null, 2)}

Subgroups available:
${JSON.stringify(subgroups, null, 2)}

Provide the best matching group_id and subgroup_id.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "categorize_expense",
              description: "Categorize an expense into group and subgroup",
              parameters: {
                type: "object",
                properties: {
                  group_id: {
                    type: "string",
                    description: "The ID of the expense group"
                  },
                  subgroup_id: {
                    type: ["string", "null"],
                    description: "The ID of the expense subgroup or null"
                  },
                  confidence: {
                    type: "number",
                    description: "Confidence score from 0-100"
                  },
                  reasoning: {
                    type: "string",
                    description: "Brief explanation of the categorization"
                  }
                },
                required: ["group_id", "confidence", "reasoning"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "categorize_expense" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error("No tool call returned from AI");
    }

    const categorization = JSON.parse(toolCall.function.arguments);

    return new Response(
      JSON.stringify({
        success: true,
        categorization
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Categorization error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
