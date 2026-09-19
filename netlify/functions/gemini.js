// netlify/functions/gemini.js

export const handler = async function (event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { messages, systemInstruction, provider = 'gemini' } = JSON.parse(event.body);
    
    // ดึง API Keys จาก Netlify Environment Variables
    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;
    const cfAccountId = process.env.CLOUDFLARE_ACCOUNT_ID; 
    const cfToken = process.env.CLOUDFLARE_API_TOKEN;

    // ==========================================
    // 1. Google Gemini
    // ==========================================
    if (provider === 'gemini') {
      if (!geminiKey) return { statusCode: 500, body: JSON.stringify({ error: 'ไม่พบ GEMINI_API_KEY' }) };

      const payload = {
        contents: messages,
        systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
        generationConfig: { maxOutputTokens: 2048, temperature: 0.4, responseMimeType: "application/json" }
      };

      // 🎯 หั่น URL เป็นท่อนๆ เพื่อป้องกันบั๊กจากการก๊อปปี้โค้ดแล้วกลายเป็นลิงก์
      const apiUrl = "https://" + "generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=" + geminiKey;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(JSON.stringify(data));
      return { statusCode: 200, body: JSON.stringify({ reply: data.candidates[0].content.parts[0].text }) };
    }

    // ==========================================
    // 2. ChatGPT หรือ Groq (ใช้ Format OpenAI)
    // ==========================================
    if (provider === 'chatgpt' || provider === 'groq') {
      const isGpt = provider === 'chatgpt';
      const apiKey = isGpt ? openaiKey : groqKey;
      
      if (!apiKey) return { statusCode: 500, body: JSON.stringify({ error: `ไม่พบ API Key สำหรับ ${provider.toUpperCase()}` }) };

      const formattedMessages = messages.map(m => ({
        role: m.role === 'model' ? 'assistant' : 'user',
        content: m.parts[0].text
      }));

      formattedMessages.unshift({ role: 'system', content: systemInstruction + "\nRespond strictly in valid JSON." });

      // 🎯 หั่น URL ป้องกันบั๊กลิงก์เช่นกัน
      const urlOpenAI = "https://" + "api.openai.com/v1/chat/completions";
      const urlGroq = "https://" + "api.groq.com/openai/v1/chat/completions";
      const apiUrl = isGpt ? urlOpenAI : urlGroq;
      
      const modelName = isGpt ? "gpt-4o-mini" : "llama3-70b-8192";

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: modelName,
          messages: formattedMessages,
          temperature: 0.4,
          response_format: { type: "json_object" }
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(JSON.stringify(data));
      
      return { statusCode: 200, body: JSON.stringify({ reply: data.choices[0].message.content }) };
    }

    // ==========================================
    // 3. Cloudflare Workers AI
    // ==========================================
    if (provider === 'cloudflare') {
      if (!cfAccountId || !cfToken) {
        return { statusCode: 500, body: JSON.stringify({ error: 'ไม่พบ CLOUDFLARE_ACCOUNT_ID หรือ CLOUDFLARE_API_TOKEN' }) };
      }

      const formattedMessages = messages.map(m => ({
        role: m.role === 'model' ? 'assistant' : 'user',
        content: m.parts[0].text
      }));

      formattedMessages.unshift({ role: 'system', content: systemInstruction + "\nIMPORTANT: You must respond ONLY with a valid JSON object. Do not include markdown formatting or any conversational text outside the JSON object." });

      const model = "@cf/meta/llama-3-8b-instruct";
      
      // 🎯 หั่น URL ป้องกันบั๊กลิงก์
      const apiUrl = "https://" + "api.cloudflare.com/client/v4/accounts/" + cfAccountId + "/ai/run/" + model;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cfToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: formattedMessages
        })
      });

      const data = await response.json();
      
      if (!response.ok || !data.success) {
         throw new Error(JSON.stringify(data.errors || data));
      }

      return { statusCode: 200, body: JSON.stringify({ reply: data.result.response }) };
    }

    return { statusCode: 400, body: JSON.stringify({ error: 'ไม่รู้จัก Provider ที่เลือก' }) };

  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};