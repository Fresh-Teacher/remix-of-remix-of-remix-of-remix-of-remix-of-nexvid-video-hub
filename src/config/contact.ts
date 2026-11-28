// Public contact configuration; a VITE_WHATSAPP_NUMBER setting overrides the default.
export const contactConfig = {
  whatsappNumber: import.meta.env["VITE_WHATSAPP_NUMBER"] || "+256786812837",
};

export function whatsappRequestUrl(
  kind: "movie" | "trailer",
  title: string,
  number = contactConfig.whatsappNumber,
): string {
  const digits = number.replace(/\D/g, "");
  if (!/^[1-9]\d{7,14}$/.test(digits)) throw new Error("Invalid WhatsApp contact number");
  const message = `Hello, the ${kind} called ${title} is missing on Freshflix. Please add it.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}