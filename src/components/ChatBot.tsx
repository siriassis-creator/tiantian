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
      // ลบวงเล็บและสัญลักษณ์ออกก่อนอ่าน เพื่อให้อ่านออกเสียงเฉพาะคำพูด
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
    
    // ดึงประวัติการคุย โดยจำแค่ 6 ประโยคล่าสุดเพื่อไม่ให้กินโควต้า
    const historyToKeep = messages.filter((msg, idx) => !(idx === 0 && msg.role === 'model'));
    const newHistoryForApi = [...historyToKeep, newUserMsg].slice(-6);

    setMessages((prev) => [...prev, newUserMsg]);
    setInputText('');
    setIsLoading(true);

    // 🎯 ตีกรอบสมอง AI ให้ทำงานร่วมกับ Database ของเราแบบ 100%
    const systemInstruction = `
      คุณคือ "AI เหล่าซือ" ครูสอนภาษาจีน
      คุณมีหน้าที่ตอบคำถามและช่วยนักเรียนทบทวนบทเรียน โดยอ้างอิงจากฐานข้อมูล (Database) ด้านล่างนี้เท่านั้น:
      
      --- DATABASE บทเรียน ---
      หัวข้อที่เรียน: ${lessonTitle}
      เนื้อหาและคำศัพท์ทั้งหมดที่มีในบทนี้: ${lessonContext}
      ------------------------
      
      คำสั่งที่ต้องทำตามอย่างเคร่งครัด (ห้ามละเมิด):
      1. ดึงข้อมูลจาก DATABASE เพื่อมาตอบนักเรียน ห้ามแต่งคำศัพท์หรือเนื้อหาขึ้นมาเอง
      2. ถ้านักเรียนถามถึงคำศัพท์ หรือเนื้อหาที่ "ไม่มีใน DATABASE" ให้ตอบปฏิเสธอย่างสุภาพ เช่น "เนื้อหานี้ไม่มีในบทเรียนนี้นะคะ ลองถามเนื้อหาที่อยู่ในบทเรียนดูนะ"
      3. หากนักเรียนให้สรุปเนื้อหา ให้สรุปเฉพาะเนื้อหาที่มีใน DATABASE เท่านั้น
      4. ตอบคำถามแบบผู้สนทนา ห้ามพิมพ์ทวนคำถามของนักเรียนเด็ดขาด
      5. ใช้ภาษาไทยอธิบายให้เข้าใจง่าย สอดแทรกอักษรจีนและพินอิน (Pinyin) ที่ถูกต้องเสมอ
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
        // ถ้ายิง API ไม่ผ่าน ให้ลบข้อความ user อันล่าสุดออก จะได้ไม่บั๊กในรอบถัดไป
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
    recognition.lang = 'zh-CN'; 
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
    <div className="fixed bottom-6 right-6 w-96 h-[500px] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col z-[9999] overflow-hidden">
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
        <button 
          onClick={toggleListen}
          className={`p-3 rounded-full flex-shrink-0 transition-all shadow-sm ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
          title="กดเพื่อพูดภาษาจีน"
        >
          <Mic size={20} />
        </button>
        <input 
          type="text"
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend(inputText)}
          placeholder="พิมพ์ข้อความ..."
          className="flex-1 bg-slate-100 border-none rounded-full px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
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