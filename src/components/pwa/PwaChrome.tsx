import { useEffect, useState } from "react";
import { Download, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { applyWaitingUpdate, registerServiceWorker } from "@/pwa/register";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function standalone() {
  return window.matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && Boolean(navigator.standalone));
}

function iosDevice() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function PwaChrome() {
  const [offline, setOffline] = useState(!navigator.onLine);
  const [updateReady, setUpdateReady] = useState(false);
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(standalone());
  const [iosHelp, setIosHelp] = useState(false);

  useEffect(() => {
    registerServiceWorker(() => setUpdateReady(true));
    const onOffline = () => setOffline(true);
    const onOnline = () => setOffline(false);
    const onInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
    };
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    window.addEventListener("beforeinstallprompt", onInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("beforeinstallprompt", onInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (!installEvent) {
      setIosHelp(true);
      return;
    }
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setInstallEvent(null);
  };

  const showInstall = !installed && (installEvent || iosDevice());

  return (
    <>
      {offline && (
        <div className="fixed inset-x-0 top-0 z-[70] flex items-center justify-center gap-2 bg-amber-700 px-4 py-2 text-sm text-white">
          <WifiOff className="h-4 w-4" />
          Hors connexion. Les dossiers médicaux ne sont pas enregistrés sur cet appareil.
        </div>
      )}
      {updateReady && (
        <div className="fixed inset-x-3 top-14 z-[60] mx-auto flex max-w-lg items-center justify-between gap-3 rounded-2xl border bg-card p-3 shadow-lg sm:top-20">
          <p className="text-sm">Une mise à jour de Medicare est prête.</p>
          <Button type="button" size="sm" onClick={applyWaitingUpdate}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Mettre à jour
          </Button>
        </div>
      )}
      {showInstall && (
        <div className="fixed inset-x-3 bottom-24 z-40 mx-auto max-w-lg rounded-2xl border bg-card p-3 shadow-lg md:bottom-6 md:right-6 md:mx-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Installer Medicare</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {iosDevice() && !installEvent
                  ? "Dans Safari, touchez Partager, puis Sur l’écran d’accueil."
                  : "Ajoutez Medicare à votre écran d’accueil ou à votre bureau."}
              </p>
            </div>
            <Button type="button" size="sm" onClick={install}>
              <Download className="mr-1.5 h-4 w-4" />
              Installer
            </Button>
          </div>
          {iosHelp && !installEvent && (
            <p className="mt-2 text-xs text-muted-foreground">Le bouton Partager est en bas de Safari, puis choisissez « Sur l’écran d’accueil ».</p>
          )}
        </div>
      )}
    </>
  );
}
