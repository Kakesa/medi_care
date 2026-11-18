import { Link } from "react-router-dom";
import { Activity } from "lucide-react";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background px-4 py-8 text-foreground sm:py-12">
      <div className="mx-auto max-w-3xl">
        <Link to="/" className="inline-flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Activity className="h-5 w-5" />
          </span>
          <span className="text-lg font-semibold">HopeCare</span>
        </Link>
        <h1 className="mt-8 text-3xl font-bold">Politique de confidentialité</h1>
        <p className="mt-2 text-sm text-muted-foreground">Dernière mise à jour : 17 novembre 2026</p>

        <div className="mt-8 space-y-8 text-sm leading-6 text-foreground/90">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Qui est responsable</h2>
            <p>
              HopeCare est le logiciel utilisé par un établissement de santé pour organiser ses soins,
              son accueil et sa facturation. L’établissement qui vous prend en charge est responsable des
              données de son dossier. HopeCare isole les données de chaque établissement : un centre ne
              consulte pas le dossier d’un autre.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Données utilisées</h2>
            <p>Selon votre rôle et les actes réalisés, l’établissement peut enregistrer :</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>identité, coordonnées et compte de connexion ;</li>
              <li>rendez-vous, consultations, soins, examens et ordonnances ;</li>
              <li>factures, encaissements et pièces liées à la pharmacie ou au laboratoire ;</li>
              <li>journaux techniques d’accès, nécessaires à la sécurité du dossier.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Pourquoi ces données</h2>
            <p>
              Elles servent à vous identifier, à organiser le parcours de soins, à produire les documents
              médicaux et comptables de l’établissement, et à protéger l’accès au dossier. HopeCare ne vend
              pas ces données et ne les utilise pas pour de la publicité.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Qui peut les voir</h2>
            <p>
              L’accès dépend du métier : accueil, soins, laboratoire, pharmacie, facturation ou direction
              de l’établissement. Un patient consulte son propre espace. Le support technique n’ouvre pas
              un dossier médical hors du cadre prévu par l’établissement.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Conservation et sécurité</h2>
            <p>
              La durée de conservation est celle décidée par l’établissement, dans le respect des règles
              de santé qui s’appliquent à lui. Les mots de passe sont stockés sous une forme illisible.
              La connexion passe par un jeton conservé dans le navigateur, limité dans le temps.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Cookies</h2>
            <p>
              Le site mémorise la session et le thème d’affichage dans le navigateur. Il n’installe pas
              de traceur publicitaire.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Vos demandes</h2>
            <p>
              Pour accéder à votre dossier, le corriger ou demander sa limitation, adressez-vous à
              l’établissement qui vous suit. Pour un compte de connexion, utilisez la page
              {" "}
              <Link to="/forgot-password" className="font-medium text-primary hover:underline">mot de passe oublié</Link>
              {" "}
              ou l’espace profil après connexion.
            </p>
          </section>
        </div>

        <div className="mt-10 flex flex-wrap gap-4 text-sm">
          <Link to="/" className="font-medium text-primary hover:underline">Retour à l’accueil</Link>
          <Link to="/login" className="font-medium text-primary hover:underline">Connexion</Link>
        </div>
      </div>
    </div>
  );
}
