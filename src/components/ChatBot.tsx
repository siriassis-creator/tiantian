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
  const [micLang, setMicLang] = useState<'th-TH' | 'zh-CN'>('th-TH'); 
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    // 🎯 จำลองข้อความแรกให้อยู่ในฟอร์แมต JSON เพื่อให้ระบบอ่านได้
    const initialJson = JSON.stringify({
      message: `สวัสดีครับ! วันนี้เรามาทบทวนบทเรียน "${lessonTitle}" กันเถอะ มีคำศัพท์หรือประโยคไหนในบทนี้ที่อยากให้เหล่าซือช่วยอธิบายไหมครับ? กดไมค์พูดถามมาได้เลยนะ!`,
      vocabularies: []
    });
    setMessages([
      { role: 'model', parts: [{ text: initialJson }] }
    ]);
  }, [lessonTitle]);

  // 🎯 ฟังก์ชันอ่านเสียง เลือกระบุภาษาได้
  const speak = (text: string, lang: 'zh-CN' | 'th-TH') => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const cleanText = text.replace(/[\[\]\(\)\-\*\_]/g, ''); 
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = lang; 
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || isLoading) return;

    const newUserMsg: Message = { role: 'user', parts: [{ text: textToSend }] };
    const historyToKeep = messages.filter((msg, idx) => !(idx === 0 && msg.role === 'model'));
    const newHistoryForApi = [...historyToKeep, newUserMsg].slice(-6);

    setMessages((prev) => [...prev, newUserMsg]);
    setInputText('');
    setIsLoading(true);

    // 🎯 สั่ง AI ให้ตอบกลับเป็น JSON ตามโครงสร้างที่อาจารย์ต้องการเป๊ะๆ
    const systemInstruction = `
      คุณคือ "AI เหล่าซือ" ครูสอนภาษาจีน
      หน้าทึ่: พูดคุยและดึงข้อมูลจาก DATABASE มาอธิบายนักเรียน
      
      --- DATABASE ---
      หัวข้อ: ${lessonTitle}
      ข้อมูล: ${lessonContext}
      ---------------
      
      กฎเหล็กการตอบ (สำคัญมาก):
      1. ห้ามใช้ Markdown (เช่น **, *) หรือสัญลักษณ์พิเศษ
      2. ต้องตอบกลับมาเป็น JSON Format เท่านั้น ตามโครงสร้างนี้:
      {
        "message": "ข้อความอธิบาย พูดคุย หรือสรุปบทเรียน (ภาษาไทยล้วน ไม่มีสัญลักษณ์)",
        "vocabularies": [
          {
            "meaning": "คำศัพท์จากบทเรียน (ความหมายภาษาไทย)",
            "reading": "คำอ่านภาษาไทย (เช่น เจ้อ คว้าย เซี่ยงพี)",
            "pinyin": "พินอิน (Pinyin)",
            "chinese": "การเขียน (อักษรจีน)",
            "example_cn": "ประโยคตัวอย่างภาษาจีน",
            "example_th": "คำแปลประโยคตัวอย่าง"
          }
        ]
      }
      3. หากคำถามเป็นการทักทาย หรือไม่ได้ถามหาคำศัพท์ ให้ใส่ vocabularies เป็นก้อน array ว่าง []
      4. ถ้าข้อมูลที่นักเรียนถามไม่มีใน DATABASE ให้พยายามโยงเข้าหาเนื้อหาใน DATABASE แบบเนียนๆ
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
        alert('ระบบ AI ขัดข้อง: ' + (errorDetail || 'ไม่ทราบสาเหตุ'));
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
    if (!SpeechRecognition) return alert('เบราว์เซอร์ของคุณไม่รองรับการพิมพ์ด้วยเสียง');

    const recognition = new SpeechRecognition();
    recognition.lang = micLang; 
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

  // 🎯 ฟังก์ชันแยกสำหรับ Render กล่องข้อความ AI จาก JSON
  const renderModelMessage = (text: string) => {
    try {
      const parsed = JSON.parse(text);
      return (
        <div className="flex flex-col gap-3 w-full">
          {/* ข้อความอธิบายหลัก */}
          {parsed.message && (
            <div className="bg-white text-slate-700 border border-slate-200 rounded-2xl rounded-tl-none p-3 shadow-sm">
              <p className="text-sm leading-relaxed">{parsed.message}</p>
              <button 
                onClick={() => speak(parsed.message, 'th-TH')} 
                className="mt-2 text-indigo-500 hover:text-indigo-700 bg-indigo-50 px-2 py-1 rounded-md flex items-center gap-1 text-xs font-bold transition-colors"
              >
                <Volume2 size={14} /> ฟังข้อความนี้
              </button>
            </div>
          )}

          {/* การ์ดคำศัพท์ (แยกตามโครงสร้างที่อาจารย์ขอ) */}
          {parsed.vocabularies && parsed.vocabularies.length > 0 && (
            <div className="flex flex-col gap-2">
              {parsed.vocabularies.map((v: any, i: number) => (
                <div key={i} className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 shadow-sm text-sm font-sans w-full max-w-[90%]">
                  <div className="font-bold text-emerald-800 mb-2 border-b border-emerald-200/50 pb-1">
                    📖 {v.meaning}
                  </div>
                  <div className="grid grid-cols-[80px_1fr] gap-y-2 gap-x-2 text-xs items-center">
                    <div className="text-slate-500 font-semibold">การอ่าน:</div>
                    <div className="text-slate-700">{v.reading}</div>
                    
                    <div className="text-slate-500 font-semibold">Pinyin:</div>
                    <div className="text-slate-700">{v.pinyin}</div>
                    
                    <div className="text-slate-500 font-semibold mt-1">การเขียน:</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-lg font-bold text-slate-800 leading-none">{v.chinese}</span>
                      <button onClick={() => speak(v.chinese, 'zh-CN')} className="text-emerald-600 hover:text-emerald-800 bg-emerald-100 p-1 rounded-full" title="ฟังเสียงจีน">
                        <Volume2 size={14} />
                      </button>
                    </div>
                  </div>

                  {(v.example_cn || v.example_th) && (
                    <div className="mt-3 pt-2 border-t border-emerald-200/50">
                      <div className="text-[10px] text-slate-400 font-semibold uppercase mb-1">ตัวอย่างการใช้งาน</div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-800">{v.example_cn}</span>
                          <span className="text-slate-500 text-xs mt-0.5">{v.example_th}</span>
                        </div>
                        {v.example_cn && (
                          <button onClick={() => speak(v.example_cn, 'zh-CN')} className="text-indigo-500 hover:text-indigo-700 bg-indigo-50 p-1.5 rounded-full shrink-0 mt-0.5" title="ฟังเสียงตัวอย่าง">
                            <Volume2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    } catch (e) {
      // เผื่อ AI ตอบผิดฟอร์แมต ให้แสดงเป็นข้อความธรรมดา
      return (
        <div className="bg-white text-slate-700 border border-slate-200 rounded-2xl rounded-tl-none p-3 shadow-sm">
          <p className="text-sm">{text}</p>
        </div>
      );
    }
  };

  return (
    <div className="fixed bottom-6 right-6 w-[420px] h-[550px] bg-slate-50 rounded-3xl shadow-2xl border border-slate-200 flex flex-col z-[9999] overflow-hidden">
      <div className="bg-emerald-600 text-white p-4 flex items-center justify-between shadow-md z-10">
        <div className="flex items-center gap-2">
          <Bot size={24} />
          <h3 className="font-bold">AI ติวเตอร์ภาษาจีน</h3>
        </div>
        <button onClick={onClose} className="hover:bg-emerald-500 p-1 rounded-lg transition-colors">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'user' ? (
              <div className="max-w-[85%] rounded-2xl p-3 shadow-sm bg-emerald-100 text-emerald-900 rounded-tr-none">
                <p className="text-sm leading-relaxed">{msg.parts[0].text}</p>
              </div>
            ) : (
              renderModelMessage(msg.parts[0].text)
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white p-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2 border border-slate-200 text-slate-500 text-sm">
              <Loader2 className="animate-spin w-4 h-4 text-emerald-500" /> เหล่าซือกำลังค้นหาข้อมูล...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
        <button 
          onClick={() => setMicLang(prev => prev === 'th-TH' ? 'zh-CN' : 'th-TH')}
          className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-2 rounded-xl hover:bg-slate-200 transition-colors flex-shrink-0"
        >
          {micLang === 'th-TH' ? '🇹🇭 พิมพ์/พูดไทย' : '🇨🇳 พูดจีน'}
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
          placeholder="พิมพ์ถามเหล่าซือ..."
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