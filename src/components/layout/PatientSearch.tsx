import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { patientService } from "@/services/patientService";
import type { Patient, UserRole } from "@/types";

const searchRoles: UserRole[] = ["HOSPITAL_ADMIN", "DOCTOR", "RECEPTIONIST", "NURSE"];

export function PatientSearch() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Patient[]>([]);
  const [open, setOpen] = useState(false);
  const canSearch = Boolean(user && searchRoles.includes(user.role));

  useEffect(() => {
    if (!canSearch) return;
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    const handle = window.setTimeout(() => {
      void patientService.getAll({ search: term, limit: 8 })
        .then((result) => setResults(result.data))
        .catch(() => setResults([]));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [query, canSearch]);

  if (!canSearch) return null;

  const choose = (patient: Patient) => {
    const name = `${patient.firstName} ${patient.lastName}`;
    setQuery("");
    setOpen(false);
    setResults([]);
    navigate(`/dashboard/patients?q=${encodeURIComponent(name)}`);
  };

  return (
    <div
      className="relative hidden min-w-0 flex-1 sm:block sm:max-w-md"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={query}
        placeholder="Rechercher un patient..."
        className="border-transparent bg-secondary/50 pl-10 focus:border-input focus:bg-background"
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && query.trim()) {
            setOpen(false);
            navigate(`/dashboard/patients?q=${encodeURIComponent(query.trim())}`);
          }
        }}
      />
      {open && query.trim().length >= 2 && (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
          {results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">Aucun patient trouvé</p>
          ) : (
            results.map((patient) => (
              <button
                key={patient.id}
                type="button"
                className="block w-full px-3 py-2 text-left hover:bg-accent"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(patient)}
              >
                <span className="block text-sm font-medium">{patient.firstName} {patient.lastName}</span>
                <span className="block text-xs text-muted-foreground">{patient.phone || patient.email || "Dossier patient"}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
