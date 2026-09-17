// netlify/functions/gemini.js

export const handler = async function (event, context) {
    // อนุญาตเฉพาะการยิงแบบ POST
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }
  
    try {
      const { messages, systemInstruction } = JSON.parse(event.body);
      const apiKey = process.env.GEMINI_API_KEY;
  
      if (!apiKey) {
        return { 
          statusCode: 500, 
          body: JSON.stringify({ error: 'ไม่พบ API Key กรุณาตั้งค่า GEMINI_API_KEY ใน Netlify' }) 
        };
      }
  
      // จัดรูปแบบข้อมูลให้ตรงกับ Gemini API
      const payload = {
        contents: messages,
        systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
        generationConfig: {
          maxOutputTokens: 150, // จำกัดไม่ให้บอทตอบยาวเกินไป (เซฟโควต้า)
          temperature: 0.7,     // ความคิดสร้างสรรค์กำลังดี
        }
      };
  
      // ยิง API ไปหา Google Gemini 1.5 Flash
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
  
      const data = await response.json();
  
      if (!response.ok) {
        return { statusCode: response.status, body: JSON.stringify(data) };
      }
  
      const reply = data.candidates[0].content.parts[0].text;
      
      return {
        statusCode: 200,
        body: JSON.stringify({ reply })
      };
    } catch (error) {
      return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
  };