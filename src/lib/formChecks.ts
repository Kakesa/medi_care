const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isEmail(value: string) {
  return emailPattern.test(value.trim());
}

export function isSlug(value: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.trim().toLowerCase());
}

export function spamTrapFilled(form: EventTarget | null) {
  if (!(form instanceof HTMLFormElement)) return false;
  const field = form.elements.namedItem("website");
  return field instanceof HTMLInputElement && field.value.trim().length > 0;
}

export function todayStamp() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}
