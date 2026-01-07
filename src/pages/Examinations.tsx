import { useState } from "react";
import { 
  FlaskConical, 
  Search, 
  Plus, 
  FileImage, 
  TestTube,
  Filter,
  Download,
  Eye,
  Edit,
  Trash2
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
import { mockExams, mockPatients, availableDoctors, examCategories, Exam } from "@/data/mockData";
import { toast } from "sonner";

export default function Examinations() {
  const [exams, setExams] = useState<Exam[]>(mockExams);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);

  const [formData, setFormData] = useState({
    patientId: "",
    doctorId: "",
    type: "laboratory" as Exam['type'],
    category: "",
    name: "",
    date: "",
    notes: "",
    results: ""
  });

  const filteredExams = exams.filter(exam => {
    const matchesSearch = 
      exam.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exam.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exam.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === "all" || exam.type === typeFilter;
    const matchesStatus = statusFilter === "all" || exam.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const laboratoryExams = filteredExams.filter(e => e.type === 'laboratory');
  const imagingExams = filteredExams.filter(e => e.type === 'imaging');

  const resetForm = () => {
    setFormData({
      patientId: "",
      doctorId: "",
      type: "laboratory",
      category: "",
      name: "",
      date: "",
      notes: "",
      results: ""
    });
    setEditingExam(null);
  };

  const handleSubmit = () => {
    const patient = mockPatients.find(p => p.id === formData.patientId);
    const doctor = availableDoctors.find(d => d.id === formData.doctorId);

    if (!patient || !doctor) {
      toast.error("Veuillez sélectionner un patient et un médecin");
      return;
    }

    if (editingExam) {
      setExams(prev => prev.map(e => 
        e.id === editingExam.id 
          ? { 
              ...e, 
              ...formData,
              patientName: `${patient.firstName} ${patient.lastName}`,
              doctorName: `Dr. ${doctor.firstName} ${doctor.lastName}`
            } 
          : e
      ));
      toast.success("Examen modifié avec succès");
    } else {
      const newExam: Exam = {
        id: `exam-${Date.now()}`,
        patientId: formData.patientId,
        patientName: `${patient.firstName} ${patient.lastName}`,
        doctorId: formData.doctorId,
        doctorName: `Dr. ${doctor.firstName} ${doctor.lastName}`,
        type: formData.type,
        category: formData.category,
        name: formData.name,
        date: formData.date,
        status: "pending",
        notes: formData.notes,
        createdAt: new Date().toISOString().split('T')[0]
      };
      setExams(prev => [newExam, ...prev]);
      toast.success("Examen planifié avec succès");
    }

    setIsDialogOpen(false);
    resetForm();
  };

  const handleEdit = (exam: Exam) => {
    setEditingExam(exam);
    setFormData({
      patientId: exam.patientId,
      doctorId: exam.doctorId,
      type: exam.type,
      category: exam.category,
      name: exam.name,
      date: exam.date,
      notes: exam.notes || "",
      results: exam.results || ""
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (examId: string) => {
    setExams(prev => prev.filter(e => e.id !== examId));
    toast.success("Examen supprimé");
  };

  const handleStatusChange = (examId: string, status: Exam['status']) => {
    setExams(prev => prev.map(e => 
      e.id === examId ? { ...e, status } : e
    ));
    toast.success("Statut mis à jour");
  };

  const handleAddResults = (examId: string, results: string) => {
    setExams(prev => prev.map(e => 
      e.id === examId ? { ...e, results, status: 'completed' } : e
    ));
    toast.success("Résultats ajoutés");
    setSelectedExam(null);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pending: { variant: "secondary", label: "En attente" },
      in_progress: { variant: "default", label: "En cours" },
      completed: { variant: "outline", label: "Terminé" },
      cancelled: { variant: "destructive", label: "Annulé" }
    };
    const { variant, label } = variants[status] || { variant: "outline", label: status };
    return <Badge variant={variant}>{label}</Badge>;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'laboratory': return <TestTube className="h-5 w-5 text-success" />;
      case 'imaging': return <FileImage className="h-5 w-5 text-info" />;
      default: return <FlaskConical className="h-5 w-5 text-primary" />;
    }
  };

  const ExamCard = ({ exam }: { exam: Exam }) => (
    <Card className="card-elevated">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary">
              {getTypeIcon(exam.type)}
            </div>
            <div>
              <h3 className="font-semibold">{exam.name}</h3>
              <p className="text-sm text-muted-foreground">{exam.category}</p>
              <p className="text-sm font-medium mt-1">{exam.patientName}</p>
              <p className="text-xs text-muted-foreground">{exam.doctorName}</p>
            </div>
          </div>
          <div className="text-right space-y-2">
            {getStatusBadge(exam.status)}
            <p className="text-xs text-muted-foreground">{exam.date}</p>
          </div>
        </div>

        {exam.results && (
          <div className="mt-4 p-3 rounded-lg bg-success/10 border border-success/20">
            <p className="text-xs font-medium text-success mb-1">Résultats</p>
            <p className="text-sm text-muted-foreground">{exam.results}</p>
          </div>
        )}

        <div className="flex items-center gap-2 mt-4 pt-4 border-t">
          <Button variant="outline" size="sm" onClick={() => setSelectedExam(exam)}>
            <Eye className="h-4 w-4 mr-1" />
            Détails
          </Button>
          {exam.status !== 'completed' && (
            <Button variant="outline" size="sm" onClick={() => handleEdit(exam)}>
              <Edit className="h-4 w-4 mr-1" />
              Modifier
            </Button>
          )}
          {!exam.results && exam.status !== 'cancelled' && (
            <Select onValueChange={(value) => handleStatusChange(exam.id, value as Exam['status'])}>
              <SelectTrigger className="w-32 h-8">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="in_progress">En cours</SelectItem>
                <SelectItem value="completed">Terminé</SelectItem>
                <SelectItem value="cancelled">Annulé</SelectItem>
              </SelectContent>
            </Select>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer l'examen ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action est irréversible.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleDelete(exam.id)}>
                  Supprimer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Examens</h1>
          <p className="mt-1 text-muted-foreground">
            Gestion des examens de laboratoire et imagerie médicale
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Planifier un examen
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingExam ? 'Modifier l\'examen' : 'Planifier un examen'}</DialogTitle>
              <DialogDescription>
                {editingExam ? 'Modifiez les informations de l\'examen' : 'Remplissez les informations pour planifier un nouvel examen'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Patient</Label>
                <Select value={formData.patientId} onValueChange={(v) => setFormData({...formData, patientId: v})}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un patient" /></SelectTrigger>
                  <SelectContent>
                    {mockPatients.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Médecin prescripteur</Label>
                <Select value={formData.doctorId} onValueChange={(v) => setFormData({...formData, doctorId: v})}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un médecin" /></SelectTrigger>
                  <SelectContent>
                    {availableDoctors.map(d => (
                      <SelectItem key={d.id} value={d.id}>Dr. {d.firstName} {d.lastName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={formData.type} onValueChange={(v) => setFormData({...formData, type: v as Exam['type'], category: ""})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="laboratory">Laboratoire</SelectItem>
                      <SelectItem value="imaging">Imagerie</SelectItem>
                      <SelectItem value="biopsy">Biopsie</SelectItem>
                      <SelectItem value="other">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Catégorie</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData({...formData, category: v})}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner une catégorie" /></SelectTrigger>
                  <SelectContent>
                    {examCategories[formData.type]?.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nom de l'examen</Label>
                <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="Ex: Bilan sanguin complet" />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} placeholder="Instructions ou notes..." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Annuler</Button>
              <Button onClick={handleSubmit}>{editingExam ? 'Modifier' : 'Planifier'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher par patient, examen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="pending">En attente</SelectItem>
            <SelectItem value="in_progress">En cours</SelectItem>
            <SelectItem value="completed">Terminés</SelectItem>
            <SelectItem value="cancelled">Annulés</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all" className="space-y-6">
        <TabsList>
          <TabsTrigger value="all">Tous ({filteredExams.length})</TabsTrigger>
          <TabsTrigger value="laboratory">
            <TestTube className="h-4 w-4 mr-1" />
            Laboratoire ({laboratoryExams.length})
          </TabsTrigger>
          <TabsTrigger value="imaging">
            <FileImage className="h-4 w-4 mr-1" />
            Imagerie ({imagingExams.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {filteredExams.map(exam => <ExamCard key={exam.id} exam={exam} />)}
          </div>
        </TabsContent>

        <TabsContent value="laboratory" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {laboratoryExams.map(exam => <ExamCard key={exam.id} exam={exam} />)}
          </div>
        </TabsContent>

        <TabsContent value="imaging" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {imagingExams.map(exam => <ExamCard key={exam.id} exam={exam} />)}
          </div>
        </TabsContent>
      </Tabs>

      {/* Exam details dialog */}
      <Dialog open={!!selectedExam} onOpenChange={() => setSelectedExam(null)}>
        <DialogContent className="max-w-lg">
          {selectedExam && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {getTypeIcon(selectedExam.type)}
                  {selectedExam.name}
                </DialogTitle>
                <DialogDescription>{selectedExam.category}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Patient</p>
                    <p className="font-medium">{selectedExam.patientName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Prescripteur</p>
                    <p className="font-medium">{selectedExam.doctorName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Date</p>
                    <p className="font-medium">{selectedExam.date}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Statut</p>
                    {getStatusBadge(selectedExam.status)}
                  </div>
                </div>
                
                {selectedExam.notes && (
                  <div>
                    <p className="text-sm text-muted-foreground">Notes</p>
                    <p className="text-sm">{selectedExam.notes}</p>
                  </div>
                )}

                {selectedExam.results ? (
                  <div className="p-4 rounded-lg bg-success/10 border border-success/20">
                    <p className="text-sm font-medium text-success mb-2">Résultats</p>
                    <p className="text-sm">{selectedExam.results}</p>
                    <Button variant="outline" size="sm" className="mt-3">
                      <Download className="h-4 w-4 mr-1" />
                      Télécharger
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Ajouter les résultats</Label>
                    <Textarea 
                      id="results-input"
                      placeholder="Saisir les résultats de l'examen..."
                    />
                    <Button 
                      size="sm"
                      onClick={() => {
                        const input = document.getElementById('results-input') as HTMLTextAreaElement;
                        if (input.value) {
                          handleAddResults(selectedExam.id, input.value);
                        }
                      }}
                    >
                      Enregistrer les résultats
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}