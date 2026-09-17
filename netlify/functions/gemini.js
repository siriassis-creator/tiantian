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
          maxOutputTokens: 150, // จำกัดไม่ให้บอทตอบยาวเกินไป
          temperature: 0.7,     // ความคิดสร้างสรรค์กำลังดี
        }
      };
  
      // 🎯 รายชื่อ Models ที่เราจะให้ระบบลองเรียก (รองรับการอัปเดตของ Google)
      const modelsToTry = [
        'gemini-2.0-flash',          // ลองเวอร์ชันใหม่ล่าสุดก่อน
        'gemini-1.5-flash-latest',   // ลองเวอร์ชันล่าสุดของ 1.5
        'gemini-1.5-flash',          // ลองชื่อมาตรฐาน
        'gemini-1.5-pro-latest'      // ถ้ารุ่น flash ปิดหมด ให้ใช้รุ่น Pro แทน
      ];
  
      let data;
      let isSuccess = false;
      let lastStatus = 500;
  
      for (const model of modelsToTry) {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
  
        data = await response.json();
        lastStatus = response.status;
  
        // ถ้าเรียกสำเร็จ (status 200) ให้หยุดการค้นหาแล้วไปต่อ
        if (response.ok && data.candidates) {
          isSuccess = true;
          break;
        }
      }
  
      // ถ้าลองจนครบแล้วยังไม่ได้ ให้ส่ง Error สุดท้ายกลับไป
      if (!isSuccess) {
        return { statusCode: lastStatus, body: JSON.stringify(data) };
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