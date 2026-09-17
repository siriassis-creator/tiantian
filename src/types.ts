// src/types.ts
import type React from 'react';

// โครงสร้างคำศัพท์ (ปรับให้ตรงกับ Pattern 1)
export interface Vocabulary {
  id: string;
  no: number; // เลขลำดับคำศัพท์
  character: string; // ตัวอักษรจีน
  pinyin: string;
  type: string; // ชนิดคำ เช่น pron., v.
  meaning: string;
}

// โครงสร้างบทสนทนา
export interface Dialogue {
  id: string;
  speaker: string;
  chinese: string;
  pinyin: string;
  english: string;
}

// โครงสร้างหัวข้อย่อย (Section)
export interface LessonSection {
  id: string;
  patternType: string; // เลือกว่าจะใช้รูปแบบไหน เช่น 'pattern1'
  sectionNumber: string; // เลขข้อ เช่น "1"
  audioTrack: string; // รหัสเสียง เช่น "01-1"
  audioUrl: string; // ลิงก์ไฟล์เสียง
  imageUrl: string; // ลิงก์รูปภาพประกอบ
  dialogues: Dialogue[];
  vocabulary: Vocabulary[];
}

// โครงสร้างบทเรียนหลัก
export interface LessonData {
  id: string;
  lessonNumber: number;
  titleCn: string;
  titleEn: string;
  pdfUrl: string;
  sections: LessonSection[];
}

export interface HskCardData {
  id: string;
  topTextZh: string;
  topTextEn1: string;
  topTextEn2: string;
  mainText: string;
  level: string;
  title: string;
  from: string;
  to: string;
  shadow: string;
  Icon: React.ElementType;
  isEnabled: boolean;
  lessons?: LessonData[];
}
