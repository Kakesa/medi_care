import { useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { disablePush, enablePush, pushSupported } from "@/pwa/push";

export function PushSettings() {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const supported = pushSupported();

  const enable = async () => {
    setBusy(true);
    try {
      const result = await enablePush();
      const message = result === "enabled"
        ? "Les rappels de Medicare peuvent s’afficher sur cet appareil. Aucun dossier médical n’y est écrit."
        : result === "denied"
          ? "Les notifications sont refusées dans le navigateur."
          : result === "unconfigured"
            ? "Le serveur n’a pas encore de clés VAPID. Les notifications internes restent disponibles."
            : "Cet appareil ne reçoit pas les notifications push.";
      toast({ title: result === "enabled" ? "Notifications activées" : "Notifications", description: message });
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      await disablePush();
      toast({ title: "Notifications retirées", description: "Cet appareil ne recevra plus les rappels push." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><Bell className="h-6 w-6" /></span>
        <div>
          <h2 className="text-xl font-semibold">Notifications</h2>
          <p className="text-sm text-muted-foreground">Rappels selon votre rôle. Le détail médical reste dans Medicare.</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={enable} disabled={!supported || busy}>Activer sur cet appareil</Button>
        <Button type="button" variant="outline" onClick={disable} disabled={!supported || busy}>Révoquer</Button>
      </div>
      {!supported && <p className="mt-3 text-sm text-muted-foreground">Ce navigateur n’affiche pas les notifications push.</p>}
    </Card>
  );
}
