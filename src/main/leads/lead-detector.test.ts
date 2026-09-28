import { describe, expect, it } from 'vitest';
import { detectLeadIntent } from './lead-detector';

describe('detectLeadIntent', () => {
  it.each([
    ['Giá bao nhiêu vậy shop?', 'PRICE'],
    ['Còn hàng không ạ?', 'AVAILABILITY'],
    ['Mình muốn đặt 2 bao, inbox mình nhé', 'BUY'],
    ['Ship về An Giang không shop?', 'SHIPPING'],
    ['Liên hệ mình 0912345678', 'PHONE'],
    ['Cho mình đặt lịch tư vấn chiều mai', 'BOOKING']
  ])('detects Vietnamese buying intent for %s', (message, expectedIntentType) => {
    const result = detectLeadIntent(message);

    expect(result.isLead).toBe(true);
    expect(result.intentType).toBe(expectedIntentType);
    expect(result.score).toBeGreaterThanOrEqual(35);
  });

  it('does not create a lead from explicit negative intent', () => {
    const result = detectLeadIntent('Không mua đâu shop, mình chỉ xem thôi.');

    expect(result.isLead).toBe(false);
    expect(result.score).toBeLessThan(35);
  });

  it('does not create a lead from an empty message', () => {
    expect(detectLeadIntent('   ')).toMatchObject({
      isLead: false,
      score: 0,
      intentType: 'GENERAL'
    });
  });
});
