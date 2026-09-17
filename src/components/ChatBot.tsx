// src/components/ChatBot.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Send, Mic, Volume2, X, Loader2, Bot, User } from 'lucide-react';

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
      { role: 'model', parts: [{ text: `สวัสดีครับ! วันนี้เรามาทบทวนบทเรียน "${lessonTitle}" กันเถอะ พิมพ์หรือกดไมค์พูดภาษาจีนมาได้เลยนะครับ!` }] }
    ]);
  }, [lessonTitle]);

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || isLoading) return;

    const newUserMsg: Message = { role: 'user', parts: [{ text: textToSend }] };
    
    // 🎯 แก้ไขตรงนี้: ดึงประวัติเดิม แต่ "ลบข้อความทักทายแรกสุดของบอทออก" (เพราะ Gemini บังคับให้ประวัติต้องเริ่มด้วย user เสมอ)
    const historyToKeep = messages.filter((msg, idx) => !(idx === 0 && msg.role === 'model'));
    const newHistoryForApi = [...historyToKeep, newUserMsg].slice(-6);

    setMessages((prev) => [...prev, newUserMsg]);
    setInputText('');
    setIsLoading(true);

    const systemInstruction = `
      คุณคือครูสอนภาษาจีนที่ใจดีและเป็นกันเอง คอยคุยกับนักเรียนเพื่อทบทวนบทเรียน
      เนื้อหาที่กำลังเรียน: ${lessonTitle}
      คำศัพท์/บริบทที่เกี่ยวข้อง: ${lessonContext}
      
      กฎของคุณ:
      1. ชวนคุยด้วยคำถามง่ายๆ ที่เกี่ยวโยงกับบริบทด้านบน
      2. หากนักเรียนพิมพ์หรือพูดจีนผิด ให้ช่วยแก้ให้ถูกต้องแบบสุภาพ
      3. สามารถตอบอธิบายเป็นภาษาไทย จีน และอังกฤษผสมกันได้ตามความเหมาะสม
      4. ตอบให้สั้น กระชับ เป็นธรรมชาติ ไม่เกิน 2-3 ประโยค
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
        speak(data.reply);
      } else {
        // 🎯 แก้ไขตรงนี้: ดึงข้อความ Error ออกมาจาก Object เพื่อให้อ่านออกว่าพังเพราะอะไร
        const errorDetail = typeof data.error === 'object' ? JSON.stringify(data.error) : data.error;
        alert('เกิดข้อผิดพลาดจาก AI: ' + (errorDetail || 'ไม่ทราบสาเหตุ'));
        console.error("Gemini Error:", data);
      }
    } catch (err) {
      alert('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
      console.error("Fetch Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleListen = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return alert('เบราว์เซอร์ของคุณไม่รองรับการพิมพ์ด้วยเสียง (แนะนำให้ใช้ Chrome)');

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
      <div className="bg-indigo-600 text-white p-4 flex items-center justify-between shadow-md z-10">
        <div className="flex items-center gap-2">
          <Bot size={24} />
          <h3 className="font-bold">AI ติวเตอร์ภาษาจีน</h3>
        </div>
        <button onClick={onClose} className="hover:bg-indigo-500 p-1 rounded-lg transition-colors">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-4">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl p-3 shadow-sm ${msg.role === 'user' ? 'bg-indigo-100 text-indigo-900 rounded-tr-none' : 'bg-white text-slate-700 border border-slate-200 rounded-tl-none'}`}>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.parts[0].text}</p>
              {msg.role === 'model' && (
                <button onClick={() => speak(msg.parts[0].text)} className="mt-2 text-indigo-500 hover:text-indigo-700">
                  <Volume2 size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white p-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2 border border-slate-200 text-slate-500">
              <Loader2 className="animate-spin w-4 h-4" /> AI กำลังคิด...
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
          className="flex-1 bg-slate-100 border-none rounded-full px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
        />
        <button 
          onClick={() => handleSend(inputText)}
          disabled={!inputText.trim() || isLoading}
          className="p-3 bg-indigo-600 text-white rounded-full flex-shrink-0 hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm"
        >
          <Send size={20} />
        </button>
      </div>
    </div>
  );
}