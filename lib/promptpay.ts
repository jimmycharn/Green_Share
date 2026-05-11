import promptpayQr from 'promptpay-qr';

// Handle CJS/ESM interop: some bundlers expose the function directly,
// others wrap it in a `.default` property.
const generatePayload =
  typeof (promptpayQr as any) === 'function' ? (promptpayQr as any) : (promptpayQr as any).default;

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

  if (!isPromptPay || !generatePayload) {
    // Not a PromptPay ID — return raw ID for plain text fallback
    return id;
  }

  try {
    return generatePayload(cleanId, { amount: amount && amount > 0 ? amount : undefined });
  } catch {
    return id;
  }
}
