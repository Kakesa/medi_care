import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const host = window.location.hostname;
const local = host === "localhost" || host === "127.0.0.1" || host === "::1";
if (import.meta.env.PROD && window.location.protocol === "http:" && !local) {
  window.location.replace(
    `https://${window.location.host}${window.location.pathname}${window.location.search}${window.location.hash}`,
  );
} else {
  createRoot(document.getElementById("root")!).render(<App />);
  const boot = document.getElementById("boot");
  if (boot) {
    const started = window.__bootAt ?? Date.now();
    const wait = Math.max(0, 900 - (Date.now() - started));
    window.setTimeout(() => {
      boot.classList.add("boot-done");
      const remove = () => boot.remove();
      boot.addEventListener("transitionend", remove, { once: true });
      window.setTimeout(remove, 700);
    }, wait);
  }
}
