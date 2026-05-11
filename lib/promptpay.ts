/**
 * Generate PromptPay QR payload (Thai QR Payment Standard / EMVCo QR MPM)
 * Supports PromptPay Mobile (phone number) and falls back to text QR for bank accounts.
 */

function crc16ccitt(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
    }
  }
  crc &= 0xffff;
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function tlv(tag: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return tag + len + value;
}

function isPromptPayMobile(value: string): boolean {
  // Thai mobile: 10 digits starting with 0
  return /^0\d{9}$/.test(value);
}

function formatPromptPayMobile(phone: string): string {
  // Remove leading 0, prepend country code 66
  return '66' + phone.slice(1);
}

/**
 * Generate a PromptPay-compatible QR payload or plain text fallback.
 * @param id - Phone number (PromptPay) or bank account number
 * @param amount - Amount in THB (optional)
 * @returns QR payload string
 */
export function generatePromptPayPayload(id: string, amount?: number): string {
  if (isPromptPayMobile(id)) {
    const mobile = formatPromptPayMobile(id);

    // Merchant Account Information (PromptPay Mobile)
    const gui = tlv('00', 'A000000677010111'); // Global Unique Identifier for Thai QR
    const mobileTlv = tlv('01', mobile);
    const merchantInfo = tlv('29', gui + mobileTlv);

    let payload = '';
    payload += tlv('00', '01'); // Payload Format Indicator
    payload += tlv('01', '11'); // Point of Initiation Method (static)
    payload += merchantInfo;
    payload += tlv('52', '0000'); // Merchant Category Code
    payload += tlv('53', '764'); // Transaction Currency (THB)
    if (amount && amount > 0) {
      payload += tlv('54', amount.toFixed(2)); // Transaction Amount
    }
    payload += tlv('58', 'TH'); // Country Code

    // CRC must be calculated on the payload WITHOUT tag 63, then appended as 6304 + CRC
    const crc = crc16ccitt(payload);
    return payload + '6304' + crc;
  }

  // Fallback: return the raw ID for plain text QR
  return id;
}

/**
 * Build a readable bank transfer text for plain QR fallback.
 */
export function buildBankQRText(bankName: string, accountNo: string, accountName: string): string {
  return `บัญชี: ${accountNo}\nธนาคาร: ${bankName}\nชื่อบัญชี: ${accountName}`;
}
