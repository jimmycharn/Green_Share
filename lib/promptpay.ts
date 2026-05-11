import generatePayload from 'promptpay-qr';

/**
 * Generate a PromptPay-compatible QR payload.
 * Uses the well-tested `promptpay-qr` npm package (EMVCo QR MPM standard).
 * @param id - PromptPay ID (phone number 10 digits, citizen ID 13 digits, tax ID 13 digits, or e-Wallet 15 digits)
 * @param amount - Amount in THB (optional)
 * @returns EMVCo QR payload string, or the raw ID if not a valid PromptPay ID
 */
export function generatePromptPayPayload(id: string, amount?: number): string {
  const cleanId = id.replace(/[^0-9]/g, '');
  const isPromptPay =
    /^0\d{9}$/.test(cleanId) || // mobile
    /^\d{13}$/.test(cleanId) || // citizen/tax ID
    /^\d{15}$/.test(cleanId); // e-wallet

  if (!isPromptPay) {
    // Not a PromptPay ID — return raw ID for plain text fallback
    return id;
  }

  return generatePayload(cleanId, { amount: amount && amount > 0 ? amount : undefined });
}
