export function money(n) {
  if (isNaN(n)) return 'R$ 0,00';
  return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function todayISO(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
