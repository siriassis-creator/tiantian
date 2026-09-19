// src/components/ChatBot.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Send, Mic, Volume2, X, Loader2, Bot } from 'lucide-react';

interface ChatBotProps {
  lessonTitle: string;
  lessonContext: string;
  onClose: () => void;
}

interface Message {
  role: 'user' | 'model';
  parts: [{ text: string }];
}

export default function ChatBot({ lessonTitle, lessonContext, onClose }: ChatBotProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  // 🎯 เพิ่ม State สำหรับสลับภาษาไมโครโฟน
  const [micLang, setMicLang] = useState<'th-TH' | 'zh-CN'>('th-TH'); 
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    setMessages([
      { role: 'model', parts: [{ text: `สวัสดีครับ! วันนี้เรามาทบทวนบทเรียน "${lessonTitle}" กันเถอะ มีคำศัพท์หรือประโยคไหนในบทนี้ที่อยากให้เหล่าซือช่วยอธิบายไหมครับ?` }] }
    ]);
  }, [lessonTitle]);

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const cleanText = text.replace(/[\[\]\(\)\-\*]/g, ''); 
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'zh-CN'; 
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || isLoading) return;

    const newUserMsg: Message = { role: 'user', parts: [{ text: textToSend }] };
    
    // จำประวัติ 6 ประโยคล่าสุด
    const historyToKeep = messages.filter((msg, idx) => !(idx === 0 && msg.role === 'model'));
    const newHistoryForApi = [...historyToKeep, newUserMsg].slice(-6);

    setMessages((prev) => [...prev, newUserMsg]);
    setInputText('');
    setIsLoading(true);

    // 🎯 ตีกรอบสมอง AI ใหม่ ให้อิง Database และเชื่อมโยงเนื้อหาให้เนียนที่สุด
    const systemInstruction = `
      คุณคือ "AI เหล่าซือ" ครูสอนภาษาจีนที่เชี่ยวชาญและใจดี
      หน้าที่ของคุณคือการพูดคุย ตอบคำถาม และทบทวนเนื้อหากับนักเรียน โดยอิงจากฐานข้อมูล (Database) ด้านล่างนี้เป็นหลัก:
      
      --- DATABASE บทเรียนปัจจุบัน ---
      หัวข้อที่เรียน: ${lessonTitle}
      เนื้อหาและคำศัพท์: ${lessonContext}
      ------------------------
      
      กฎการตอบคำถาม (สำคัญมาก):
      1. อ้างอิงเนื้อหาจาก DATABASE ด้านบนมาตอบนักเรียนให้มากที่สุด
      2. ถ้านักเรียนถามเรื่องที่ "ไม่อยู่ใน DATABASE" ให้พยายามตอบให้เกี่ยวข้องหรือเชื่อมโยงกับเนื้อหาใน DATABASE ที่ใกล้เคียงที่สุดอย่างเป็นธรรมชาติ (ไม่ต้องปฏิเสธว่าไม่มีข้อมูล ให้เนียนๆ โยงเข้าบทเรียน)
      3. ถ้าให้สรุปบทเรียน ให้สรุปเนื้อหาจาก DATABASE ออกมาเป็นข้อๆ ให้เข้าใจง่าย
      4. อธิบายด้วยภาษาไทยที่อ่านง่าย เป็นมิตร สอดแทรกอักษรจีนและพินอิน (Pinyin) ที่เกี่ยวข้องเสมอ
      5. อธิบายให้ครบถ้วน สมบูรณ์ ห้ามตอบตัดจบกลางประโยค
    `;

    try {
      const response = await fetch('/.netlify/functions/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newHistoryForApi,
          systemInstruction: systemInstruction
        })
      });

      const data = await response.json();
      if (response.ok && data.reply) {
        setMessages((prev) => [...prev, { role: 'model', parts: [{ text: data.reply }] }]);
      } else {
        const errorDetail = typeof data.error === 'object' ? JSON.stringify(data.error) : data.error;
        setMessages((prev) => prev.slice(0, -1));
        alert('ระบบ AI ขัดข้องชั่วคราว: ' + (errorDetail || 'ไม่ทราบสาเหตุ'));
      }
    } catch (err) {
      setMessages((prev) => prev.slice(0, -1));
      alert('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ AI ได้');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleListen = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return alert('เบราว์เซอร์ของคุณไม่รองรับการพิมพ์ด้วยเสียง (แนะนำให้ใช้ Chrome Safari หรือ Edge)');

    const recognition = new SpeechRecognition();
    recognition.lang = micLang; // 🎯 ใช้ภาษาตามที่นักเรียนกดเลือก (ไทย หรือ จีน)
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInputText(transcript);
      handleSend(transcript); 
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognition.start();
  };

  return (
    <div className="fixed bottom-6 right-6 w-[400px] h-[550px] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col z-[9999] overflow-hidden">
      <div className="bg-emerald-600 text-white p-4 flex items-center justify-between shadow-md z-10">
        <div className="flex items-center gap-2">
          <Bot size={24} />
          <h3 className="font-bold">AI ติวเตอร์ภาษาจีน</h3>
        </div>
        <button onClick={onClose} className="hover:bg-emerald-500 p-1 rounded-lg transition-colors">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-4">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl p-3 shadow-sm ${msg.role === 'user' ? 'bg-emerald-100 text-emerald-900 rounded-tr-none' : 'bg-white text-slate-700 border border-slate-200 rounded-tl-none'}`}>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.parts[0].text}</p>
              {msg.role === 'model' && (
                <button onClick={() => speak(msg.parts[0].text)} className="mt-2 text-emerald-500 hover:text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md flex items-center gap-1 text-xs font-bold transition-colors">
                  <Volume2 size={14} /> ฟังเสียงอ่าน
                </button>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white p-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2 border border-slate-200 text-slate-500 text-sm">
              <Loader2 className="animate-spin w-4 h-4 text-emerald-500" /> เหล่าซือกำลังพิมพ์...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 bg-white border-t border-slate-100 flex items-center gap-2">
        {/* 🎯 ปุ่มสลับภาษาไมค์ */}
        <button 
          onClick={() => setMicLang(prev => prev === 'th-TH' ? 'zh-CN' : 'th-TH')}
          className="text-xs font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-2 rounded-xl hover:bg-slate-200 transition-colors flex-shrink-0"
          title="สลับภาษาไมโครโฟน"
        >
          {micLang === 'th-TH' ? '🇹🇭 พูดไทย' : '🇨🇳 พูดจีน'}
        </button>

        <button 
          onClick={toggleListen}
          className={`p-3 rounded-full flex-shrink-0 transition-all shadow-sm ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
          title="กดเพื่อพูด"
        >
          <Mic size={20} />
        </button>
        <input 
          type="text"
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend(inputText)}
          placeholder="พิมพ์ข้อความ..."
          className="flex-1 bg-slate-100 border-none rounded-full px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none w-full"
        />
        <button 
          onClick={() => handleSend(inputText)}
          disabled={!inputText.trim() || isLoading}
          className="p-3 bg-emerald-600 text-white rounded-full flex-shrink-0 hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-sm"
        >
          <Send size={20} />
        </button>
      </div>
    </div>
  );
}