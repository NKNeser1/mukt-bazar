export function normalizeBangladeshMobile(value: string): string | null {
  const normalizedDigits = value.trim().replace(/[০-৯]/g, (digit) =>
    String(digit.charCodeAt(0) - 2534),
  );

  if (!/^[+\d\s()-]+$/.test(normalizedDigits)) return null;

  const compact = normalizedDigits.replace(/[\s()-]/g, "");
  let digits = compact;

  if (digits.startsWith("+")) digits = digits.slice(1);

  if (digits.startsWith("0")) {
    digits = `88${digits}`;
  }

  if (!/^8801[3-9]\d{8}$/.test(digits)) return null;

  return `+${digits}`;
}
