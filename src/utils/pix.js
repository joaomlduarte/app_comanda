// src/utils/pix.js
// Gera payload Pix "Copia e Cola" (EMV BR Code) com CRC16-CCITT (0x1021, init 0xFFFF)

function pad(n, size = 2) { return String(n).padStart(size, '0'); }

// Remove acentos e força ASCII/maiúsculas
export function sanitizeAscii(s = '') {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^ -~]/g, '')
    .toUpperCase();
}

// Monta um campo EMV: ID + length + value
function emv(id, value) {
  const v = value ?? '';
  return id + pad(v.length) + v;
}

// CRC16-CCITT (poly 0x1021, init 0xFFFF)
function crc16(payload) {
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    crc ^= (payload.charCodeAt(i) << 8);
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) crc = (crc << 1) ^ 0x1021;
      else crc <<= 1;
      crc &= 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

// src/utils/pix.js (mantém as helpers emv(), crc16(), sanitizeAscii() iguais)

export function buildPixPayload({ key, name, city, amount, txid, message }) {
  const GUI = 'BR.GOV.BCB.PIX';
  const merchantName = sanitizeAscii((name || 'LOJA')).slice(0, 25);
  const merchantCity = sanitizeAscii((city || 'SAO PAULO')).slice(0, 15);
  const valor = Number(amount || 0).toFixed(2);

  // 26 - Merchant Account Information (chave + descrição opcional)
  const mai =
    emv('00', GUI) +
    emv('01', String(key || '').trim()) +
    (message ? emv('02', sanitizeAscii(String(message)).slice(0, 25)) : '');
  const maiField = emv('26', mai);

  // 62 - Additional Data (para QR estático recomenda-se TXID "***")
  const addData = emv('62', emv('05', '***'));

  // QR ESTÁTICO: omita o campo 01 (Point of Initiation Method)
  let payload =
    emv('00', '01') +      // formato
    // emv('01','11')      // <- NÃO colocar no estático
    maiField +             // 26
    emv('52', '0000') +    // MCC
    emv('53', '986') +     // BRL
    emv('54', valor) +     // valor fixo
    emv('58', 'BR') +      // país
    emv('59', merchantName) +
    emv('60', merchantCity) +
    addData +              // 62-05 = ***
    '6304';                // placeholder do CRC

  const crc = crc16(payload);
  payload += crc;
  return payload;
}