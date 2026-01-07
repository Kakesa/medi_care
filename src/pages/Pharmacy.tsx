import { useState } from "react";
import { 
  Pill, 
  Search, 
  Plus, 
  Package,
  AlertTriangle,
  TrendingUp,
  ShoppingCart,
  Filter,
  Edit,
  Trash2,
  Truck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { 
  mockPharmacyProducts, 
  mockPharmacyOrders, 
  pharmacyCategories,
  PharmacyProduct, 
  PharmacyOrder 
} from "@/data/mockData";
import { toast } from "sonner";

export default function Pharmacy() {
  const [products, setProducts] = useState<PharmacyProduct[]>(mockPharmacyProducts);
  const [orders, setOrders] = useState<PharmacyOrder[]>(mockPharmacyOrders);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<PharmacyProduct | null>(null);

  const [productFormData, setProductFormData] = useState({
    name: "",
    category: "",
    quantity: 0,
    minStock: 0,
    unit: "",
    price: 0,
    supplier: "",
    expiryDate: ""
  });

  const [orderFormData, setOrderFormData] = useState({
    productId: "",
    quantity: 0,
    supplier: "",
    notes: ""
  });

  // Stats
  const inStockCount = products.filter(p => p.status === 'in_stock').length;
  const lowStockCount = products.filter(p => p.status === 'low_stock').length;
  const outOfStockCount = products.filter(p => p.status === 'out_of_stock').length;
  const pendingOrders = orders.filter(o => o.status === 'pending' || o.status === 'confirmed').length;

  const filteredProducts = products.filter(product => {
    const matchesSearch = 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.supplier.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || product.category === categoryFilter;
    const matchesStatus = statusFilter === "all" || product.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const resetProductForm = () => {
    setProductFormData({
      name: "",
      category: "",
      quantity: 0,
      minStock: 0,
      unit: "",
      price: 0,
      supplier: "",
      expiryDate: ""
    });
    setEditingProduct(null);
  };

  const handleProductSubmit = () => {
    const status: PharmacyProduct['status'] = 
      productFormData.quantity === 0 ? 'out_of_stock' :
      productFormData.quantity < productFormData.minStock ? 'low_stock' : 'in_stock';

    if (editingProduct) {
      setProducts(prev => prev.map(p => 
        p.id === editingProduct.id 
          ? { ...p, ...productFormData, status } 
          : p
      ));
      toast.success("Produit modifié avec succès");
    } else {
      const newProduct: PharmacyProduct = {
        id: `prod-${Date.now()}`,
        ...productFormData,
        status,
        lastRestocked: new Date().toISOString().split('T')[0]
      };
      setProducts(prev => [newProduct, ...prev]);
      toast.success("Produit ajouté avec succès");
    }

    setIsProductDialogOpen(false);
    resetProductForm();
  };

  const handleOrderSubmit = () => {
    const product = products.find(p => p.id === orderFormData.productId);
    if (!product) {
      toast.error("Produit non trouvé");
      return;
    }

    const newOrder: PharmacyOrder = {
      id: `order-${Date.now()}`,
      productId: orderFormData.productId,
      productName: product.name,
      quantity: orderFormData.quantity,
      supplier: orderFormData.supplier || product.supplier,
      orderDate: new Date().toISOString().split('T')[0],
      status: "pending",
      totalCost: product.price * orderFormData.quantity,
      notes: orderFormData.notes
    };

    setOrders(prev => [newOrder, ...prev]);
    toast.success("Commande créée avec succès");
    setIsOrderDialogOpen(false);
    setOrderFormData({ productId: "", quantity: 0, supplier: "", notes: "" });
  };

  const handleEditProduct = (product: PharmacyProduct) => {
    setEditingProduct(product);
    setProductFormData({
      name: product.name,
      category: product.category,
      quantity: product.quantity,
      minStock: product.minStock,
      unit: product.unit,
      price: product.price,
      supplier: product.supplier,
      expiryDate: product.expiryDate || ""
    });
    setIsProductDialogOpen(true);
  };

  const handleDeleteProduct = (productId: string) => {
    setProducts(prev => prev.filter(p => p.id !== productId));
    toast.success("Produit supprimé");
  };

  const handleOrderStatusChange = (orderId: string, status: PharmacyOrder['status']) => {
    setOrders(prev => prev.map(o => 
      o.id === orderId ? { ...o, status } : o
    ));

    // If delivered, update product stock
    if (status === 'delivered') {
      const order = orders.find(o => o.id === orderId);
      if (order) {
        setProducts(prev => prev.map(p => {
          if (p.id === order.productId) {
            const newQuantity = p.quantity + order.quantity;
            return {
              ...p,
              quantity: newQuantity,
              status: newQuantity === 0 ? 'out_of_stock' : newQuantity < p.minStock ? 'low_stock' : 'in_stock',
              lastRestocked: new Date().toISOString().split('T')[0]
            };
          }
          return p;
        }));
        toast.success("Stock mis à jour");
      }
    }
    toast.success("Statut de commande mis à jour");
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      in_stock: { variant: "default", label: "En stock" },
      low_stock: { variant: "secondary", label: "Stock faible" },
      out_of_stock: { variant: "destructive", label: "Rupture" },
      pending: { variant: "secondary", label: "En attente" },
      confirmed: { variant: "default", label: "Confirmée" },
      delivered: { variant: "outline", label: "Livrée" },
      cancelled: { variant: "destructive", label: "Annulée" }
    };
    const { variant, label } = variants[status] || { variant: "outline", label: status };
    return <Badge variant={variant}>{label}</Badge>;
  };

  const getStockPercentage = (product: PharmacyProduct) => {
    return Math.min((product.quantity / product.minStock) * 50, 100);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Pharmacie</h1>
          <p className="mt-1 text-muted-foreground">
            Gestion des stocks et approvisionnements pharmaceutiques
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isOrderDialogOpen} onOpenChange={setIsOrderDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <ShoppingCart className="h-4 w-4" />
                Commander
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nouvelle commande</DialogTitle>
                <DialogDescription>Créer une commande d'approvisionnement</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Produit</Label>
                  <Select value={orderFormData.productId} onValueChange={(v) => setOrderFormData({...orderFormData, productId: v})}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner un produit" /></SelectTrigger>
                    <SelectContent>
                      {products.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} ({p.quantity} {p.unit} en stock)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Quantité</Label>
                    <Input 
                      type="number" 
                      value={orderFormData.quantity} 
                      onChange={(e) => setOrderFormData({...orderFormData, quantity: parseInt(e.target.value) || 0})} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Fournisseur</Label>
                    <Input 
                      value={orderFormData.supplier} 
                      onChange={(e) => setOrderFormData({...orderFormData, supplier: e.target.value})}
                      placeholder="Optionnel"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea 
                    value={orderFormData.notes} 
                    onChange={(e) => setOrderFormData({...orderFormData, notes: e.target.value})}
                    placeholder="Notes sur la commande..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsOrderDialogOpen(false)}>Annuler</Button>
                <Button onClick={handleOrderSubmit}>Commander</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isProductDialogOpen} onOpenChange={(open) => { setIsProductDialogOpen(open); if (!open) resetProductForm(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Ajouter produit
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingProduct ? 'Modifier le produit' : 'Ajouter un produit'}</DialogTitle>
                <DialogDescription>
                  {editingProduct ? 'Modifiez les informations du produit' : 'Remplissez les informations du nouveau produit'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                <div className="space-y-2">
                  <Label>Nom du produit</Label>
                  <Input value={productFormData.name} onChange={(e) => setProductFormData({...productFormData, name: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Catégorie</Label>
                    <Select value={productFormData.category} onValueChange={(v) => setProductFormData({...productFormData, category: v})}>
                      <SelectTrigger><SelectValue placeholder="Catégorie" /></SelectTrigger>
                      <SelectContent>
                        {pharmacyCategories.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Unité</Label>
                    <Input value={productFormData.unit} onChange={(e) => setProductFormData({...productFormData, unit: e.target.value})} placeholder="comprimés, flacons..." />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Quantité actuelle</Label>
                    <Input type="number" value={productFormData.quantity} onChange={(e) => setProductFormData({...productFormData, quantity: parseInt(e.target.value) || 0})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Stock minimum</Label>
                    <Input type="number" value={productFormData.minStock} onChange={(e) => setProductFormData({...productFormData, minStock: parseInt(e.target.value) || 0})} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Prix unitaire (€)</Label>
                    <Input type="number" step="0.01" value={productFormData.price} onChange={(e) => setProductFormData({...productFormData, price: parseFloat(e.target.value) || 0})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Date d'expiration</Label>
                    <Input type="date" value={productFormData.expiryDate} onChange={(e) => setProductFormData({...productFormData, expiryDate: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Fournisseur</Label>
                  <Input value={productFormData.supplier} onChange={(e) => setProductFormData({...productFormData, supplier: e.target.value})} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsProductDialogOpen(false)}>Annuler</Button>
                <Button onClick={handleProductSubmit}>{editingProduct ? 'Modifier' : 'Ajouter'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="card-elevated">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
                <Package className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{inStockCount}</p>
                <p className="text-sm text-muted-foreground">En stock</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-elevated">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/10">
                <AlertTriangle className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{lowStockCount}</p>
                <p className="text-sm text-muted-foreground">Stock faible</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-elevated">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10">
                <TrendingUp className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{outOfStockCount}</p>
                <p className="text-sm text-muted-foreground">Rupture</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-elevated">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-info/10">
                <Truck className="h-6 w-6 text-info" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingOrders}</p>
                <p className="text-sm text-muted-foreground">Commandes en cours</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher un produit..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Catégorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes</SelectItem>
            {pharmacyCategories.map(cat => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="in_stock">En stock</SelectItem>
            <SelectItem value="low_stock">Stock faible</SelectItem>
            <SelectItem value="out_of_stock">Rupture</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="products" className="space-y-6">
        <TabsList>
          <TabsTrigger value="products">
            <Pill className="h-4 w-4 mr-1" />
            Produits ({products.length})
          </TabsTrigger>
          <TabsTrigger value="orders">
            <ShoppingCart className="h-4 w-4 mr-1" />
            Commandes ({orders.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map(product => (
              <Card key={product.id} className={`card-elevated ${product.status === 'out_of_stock' ? 'border-destructive/50' : product.status === 'low_stock' ? 'border-warning/50' : ''}`}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold">{product.name}</h3>
                      <p className="text-sm text-muted-foreground">{product.category}</p>
                    </div>
                    {getStatusBadge(product.status)}
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Quantité</span>
                      <span className="font-medium">{product.quantity} {product.unit}</span>
                    </div>
                    <Progress value={getStockPercentage(product)} className="h-2" />
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Min: {product.minStock}</span>
                      <span className="font-medium">{product.price.toFixed(2)} €/{product.unit.slice(0, -1) || product.unit}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <p>Fournisseur: {product.supplier}</p>
                      {product.expiryDate && <p>Expire: {product.expiryDate}</p>}
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4 pt-4 border-t">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEditProduct(product)}>
                      <Edit className="h-4 w-4 mr-1" />
                      Modifier
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => {
                        setOrderFormData({ productId: product.id, quantity: product.minStock * 2, supplier: product.supplier, notes: "" });
                        setIsOrderDialogOpen(true);
                      }}
                    >
                      <ShoppingCart className="h-4 w-4 mr-1" />
                      Commander
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer le produit ?</AlertDialogTitle>
                          <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteProduct(product.id)}>Supprimer</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="orders" className="space-y-4">
          <div className="space-y-4">
            {orders.map(order => (
              <Card key={order.id} className="card-elevated">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                        <Truck className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{order.productName}</h3>
                        <p className="text-sm text-muted-foreground">
                          {order.quantity} unités • {order.supplier}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Commandé le {order.orderDate}
                          {order.expectedDelivery && ` • Livraison prévue: ${order.expectedDelivery}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-semibold">{order.totalCost.toFixed(2)} €</p>
                        {getStatusBadge(order.status)}
                      </div>
                      {order.status !== 'delivered' && order.status !== 'cancelled' && (
                        <Select 
                          value={order.status} 
                          onValueChange={(value) => handleOrderStatusChange(order.id, value as PharmacyOrder['status'])}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">En attente</SelectItem>
                            <SelectItem value="confirmed">Confirmée</SelectItem>
                            <SelectItem value="delivered">Livrée</SelectItem>
                            <SelectItem value="cancelled">Annulée</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                  {order.notes && (
                    <p className="mt-3 text-sm text-muted-foreground border-t pt-3">{order.notes}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}