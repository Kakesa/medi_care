import { useEffect, useState } from "react";
import { ShoppingCart, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PharmacyDesk } from "@/components/pharmacy/PharmacyDesk";
import { PharmacyCatalog } from "@/components/pharmacy/PharmacyCatalog";
import { PharmacyDashboard } from "@/components/pharmacy/PharmacyDashboard";
import { CashflowJournal } from "@/pages/Accounting";
import { pharmacyService } from "@/services/pharmacyService";
import type { PharmacyOrder, PharmacyProduct } from "@/types";
import { apiMessage } from "@/lib/apiError";
import { formatMoney } from "@/lib/money";
import { toast } from "sonner";

export default function Pharmacy() {
  const [products, setProducts] = useState<PharmacyProduct[]>([]);
  const [orders, setOrders] = useState<PharmacyOrder[]>([]);
  const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [currency, setCurrency] = useState("EUR");
  const canManageProducts = permissions.includes("pharmacy.products.manage");
  const canApprovePurchase = permissions.includes("pharmacy.purchase.approve");
  const [orderFormData, setOrderFormData] = useState({
    productId: "",
    quantity: 0,
    supplier: "",
    notes: "",
  });

  const loadPharmacy = async () => {
    try {
      const [productResult, orderResult, access] = await Promise.all([
        pharmacyService.getProducts({ limit: 100 }),
        pharmacyService.getOrders({ limit: 100 }),
        pharmacyService.getAccess(),
      ]);
      setProducts(productResult.data);
      setOrders(orderResult.data);
      setPermissions(access.permissions);
      setCurrency(access.currency);
    } catch (error) {
      toast.error(apiMessage(error));
    }
  };

  useEffect(() => {
    void loadPharmacy();
  }, []);

  const handleOrderSubmit = async () => {
    if (!orderFormData.productId || orderFormData.quantity < 1) {
      toast.error("Sélectionnez un produit et une quantité");
      return;
    }
    try {
      if (canApprovePurchase) {
        await pharmacyService.createOrder({
          productId: orderFormData.productId,
          productName: "",
          quantity: orderFormData.quantity,
          supplier: orderFormData.supplier,
          notes: orderFormData.notes || undefined,
        });
        toast.success("Commande créée");
      } else {
        await pharmacyService.createRequest([{
          productId: orderFormData.productId,
          quantity: orderFormData.quantity,
          reason: orderFormData.notes || "Demande d'approvisionnement",
        }]);
        toast.success("Demande envoyée pour approbation");
      }
      setIsOrderDialogOpen(false);
      setOrderFormData({ productId: "", quantity: 0, supplier: "", notes: "" });
      await loadPharmacy();
    } catch (error) {
      toast.error(apiMessage(error));
    }
  };

  const handleOrderStatusChange = async (orderId: string, status: PharmacyOrder["status"]) => {
    try {
      await pharmacyService.updateOrderStatus(orderId, status);
      toast.success(status === "delivered" ? "Réception enregistrée" : "Statut de commande mis à jour");
      await loadPharmacy();
    } catch (error) {
      toast.error(apiMessage(error));
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pending: { variant: "secondary", label: "En attente" },
      confirmed: { variant: "default", label: "Confirmée" },
      partial: { variant: "secondary", label: "Réception partielle" },
      delivered: { variant: "outline", label: "Livrée" },
      cancelled: { variant: "destructive", label: "Annulée" },
    };
    const { variant, label } = variants[status] || { variant: "outline", label: status };
    return <Badge variant={variant}>{label}</Badge>;
  };

  const askOrder = (product: PharmacyProduct) => {
    setOrderFormData({
      productId: product.id,
      quantity: Math.max(product.minStock * 2, 1),
      supplier: product.supplier,
      notes: "",
    });
    setIsOrderDialogOpen(true);
  };

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Pharmacie</h1>
          <p className="mt-1 text-muted-foreground">Stocks, mouvements et approvisionnements de l’établissement</p>
        </div>
        <Dialog open={isOrderDialogOpen} onOpenChange={setIsOrderDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="gap-2">
              <ShoppingCart className="h-4 w-4" />
              {canApprovePurchase ? "Commander" : "Demander"}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{canApprovePurchase ? "Nouvelle commande" : "Demande d'approvisionnement"}</DialogTitle>
              <DialogDescription>
                {canApprovePurchase ? "La commande n'entre en stock qu'à la réception." : "Un administrateur doit approuver cette demande."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Produit</Label>
                <Select value={orderFormData.productId} onValueChange={(value) => setOrderFormData({ ...orderFormData, productId: value })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un produit" /></SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name} ({product.quantity} {product.unit})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quantité</Label>
                  <Input type="number" value={orderFormData.quantity} onChange={(event) => setOrderFormData({ ...orderFormData, quantity: parseInt(event.target.value, 10) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label>Fournisseur</Label>
                  <Input value={orderFormData.supplier} onChange={(event) => setOrderFormData({ ...orderFormData, supplier: event.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={orderFormData.notes} onChange={(event) => setOrderFormData({ ...orderFormData, notes: event.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsOrderDialogOpen(false)}>Annuler</Button>
              <Button onClick={() => void handleOrderSubmit()}>{canApprovePurchase ? "Commander" : "Envoyer"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="dashboard">Tableau de bord</TabsTrigger>
          <TabsTrigger value="products">Produits</TabsTrigger>
          <TabsTrigger value="orders">Commandes ({orders.length})</TabsTrigger>
          <TabsTrigger value="desk">Opérations</TabsTrigger>
          <TabsTrigger value="journal">Journal</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <PharmacyDashboard />
        </TabsContent>
        <TabsContent value="products">
          <PharmacyCatalog
            currency={currency}
            canManage={canManageProducts}
            orderLabel={canApprovePurchase ? "Commander" : "Demander"}
            onOrder={askOrder}
            onChanged={loadPharmacy}
          />
        </TabsContent>
        <TabsContent value="orders" className="space-y-4">
          {orders.length === 0 && <p className="text-sm text-muted-foreground">Aucune commande.</p>}
          {orders.map((order) => (
            <Card key={order.id} className="card-elevated">
              <CardContent className="pt-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                      <Truck className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{order.productName}</h3>
                      <p className="text-sm text-muted-foreground">{order.quantity} unités · {order.supplier || "Fournisseur non précisé"}</p>
                      <p className="text-xs text-muted-foreground">Commandé le {order.orderDate}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-semibold">{formatMoney(order.totalCost, currency)}</p>
                      {typeof order.receivedQuantity === "number" && <p className="text-xs text-muted-foreground">Reçu {order.receivedQuantity}/{order.quantity}</p>}
                      {getStatusBadge(order.status)}
                    </div>
                    {order.status !== "delivered" && order.status !== "cancelled" && (
                      <Select value={order.status} onValueChange={(value) => void handleOrderStatusChange(order.id, value as PharmacyOrder["status"])}>
                        <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">En attente</SelectItem>
                          <SelectItem value="confirmed">Confirmée</SelectItem>
                          <SelectItem value="partial">Réception partielle</SelectItem>
                          <SelectItem value="delivered">Livrée</SelectItem>
                          <SelectItem value="cancelled">Annulée</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
                {order.notes && <p className="mt-3 border-t pt-3 text-sm text-muted-foreground">{order.notes}</p>}
              </CardContent>
            </Card>
          ))}
        </TabsContent>
        <TabsContent value="journal">
          <CashflowJournal serviceLock="pharmacy" title="Journal de la pharmacie" />
        </TabsContent>
        <TabsContent value="desk">
          <PharmacyDesk products={products} currency={currency} permissions={permissions} onChanged={loadPharmacy} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
