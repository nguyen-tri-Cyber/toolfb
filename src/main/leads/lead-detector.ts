export type LeadIntentType =
  | 'PRICE'
  | 'AVAILABILITY'
  | 'BUY'
  | 'SHIPPING'
  | 'INBOX'
  | 'PHONE'
  | 'BOOKING'
  | 'GENERAL';

export type LeadIntentLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface LeadDetectionResult {
  isLead: boolean;
  score: number;
  intentType: LeadIntentType;
  intentLevel: LeadIntentLevel;
  summary: string;
}

interface WeightedRule {
  intentType: LeadIntentType;
  weight: number;
  patterns: RegExp[];
}

const MIN_LEAD_SCORE = 35;

const rules: WeightedRule[] = [
  {
    intentType: 'PHONE',
    weight: 75,
    patterns: [/\b(?:0|84)(?:\d[ .-]?){8,10}\b/]
  },
  {
    intentType: 'BUY',
    weight: 60,
    patterns: [
      /\bmuon mua\b/,
      /\bchot (?:don|hang)\b/,
      /\bdat hang\b/,
      /\bdat (?:mot|hai|ba|\d+)\b/,
      /\blay (?:mot|hai|ba|\d+)\b/,
      /\bmua (?:mot|hai|ba|\d+)\b/
    ]
  },
  {
    intentType: 'BOOKING',
    weight: 60,
    patterns: [/\bdat lich\b/, /\bhen lich\b/, /\btu van (?:giup|cho|minh)\b/]
  },
  {
    intentType: 'PRICE',
    weight: 45,
    patterns: [/\bgia (?:bao nhieu|sao|the nao)\b/, /\bbao gia\b/, /\bgia\?/, /\bmay tien\b/]
  },
  {
    intentType: 'AVAILABILITY',
    weight: 45,
    patterns: [/\bcon hang\b/, /\bhet hang\b/, /\bco san\b/, /\bcon (?:size|mau)\b/]
  },
  {
    intentType: 'SHIPPING',
    weight: 40,
    patterns: [/\bship\b/, /\bgiao hang\b/, /\bvan chuyen\b/, /\bphi ship\b/]
  },
  {
    intentType: 'INBOX',
    weight: 35,
    patterns: [/\binbox\b/, /\bib\b/, /\bnhan tin\b/, /\bpm\b/]
  }
];

const negativePatterns = [
  /\bkhong mua\b/,
  /\bkhong can\b/,
  /\bchi xem\b/,
  /\bhoi cho biet\b/,
  /\bkhong quan tam\b/
];

function normalizeVietnamese(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function summarize(intentType: LeadIntentType): string {
  const summaries: Record<LeadIntentType, string> = {
    PRICE: 'Khách đang hỏi giá.',
    AVAILABILITY: 'Khách đang hỏi tình trạng còn hàng.',
    BUY: 'Khách thể hiện nhu cầu mua hoặc đặt hàng.',
    SHIPPING: 'Khách đang hỏi về giao hàng hoặc phí vận chuyển.',
    INBOX: 'Khách muốn trao đổi riêng qua tin nhắn.',
    PHONE: 'Khách để lại số điện thoại để được liên hệ.',
    BOOKING: 'Khách muốn đặt lịch hoặc được tư vấn.',
    GENERAL: 'Có tín hiệu quan tâm cần kiểm tra.'
  };
  return summaries[intentType];
}

export function detectLeadIntent(message: string): LeadDetectionResult {
  const normalized = normalizeVietnamese(message);
  if (!normalized) {
    return {
      isLead: false,
      score: 0,
      intentType: 'GENERAL',
      intentLevel: 'LOW',
      summary: summarize('GENERAL')
    };
  }

  let score = 0;
  let intentType: LeadIntentType = 'GENERAL';
  let strongestWeight = 0;

  for (const rule of rules) {
    if (rule.patterns.some((pattern) => pattern.test(normalized))) {
      score += rule.weight;
      if (rule.weight > strongestWeight) {
        strongestWeight = rule.weight;
        intentType = rule.intentType;
      }
    }
  }

  if (negativePatterns.some((pattern) => pattern.test(normalized))) {
    score -= 80;
  }

  score = Math.max(0, Math.min(100, score));
  const isLead = score >= MIN_LEAD_SCORE;
  const intentLevel: LeadIntentLevel = score >= 70 ? 'HIGH' : score >= 50 ? 'MEDIUM' : 'LOW';

  return {
    isLead,
    score,
    intentType,
    intentLevel,
    summary: summarize(intentType)
  };
}
