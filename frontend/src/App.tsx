import { NavLink, Route, Routes } from "react-router";
import { AuteursArtistes } from "./pages/auteurs-artistes/AuteursArtistes.tsx";
import { PageArtiste } from "./pages/auteurs-artistes/PageArtiste.tsx";
import { PageAuteur } from "./pages/auteurs-artistes/PageAuteur.tsx";
import { Bibliotheque } from "./pages/bibliotheque/Bibliotheque.tsx";
import { NouvelAsset } from "./pages/bibliotheque/NouvelAsset.tsx";
import { PageAsset } from "./pages/bibliotheque/PageAsset.tsx";
import { Exports } from "./pages/exports/Exports.tsx";
import { Inbox } from "./pages/inbox/Inbox.tsx";
import { Parametres } from "./pages/parametres/Parametres.tsx";
import { ModifierProjet } from "./pages/projets/ModifierProjet.tsx";
import { NouveauProjet } from "./pages/projets/NouveauProjet.tsx";
import { PageProjet } from "./pages/projets/PageProjet.tsx";
import { TableauDeBord } from "./pages/TableauDeBord.tsx";

const MENU = [
  { chemin: "/", libelle: "Tableau de bord" },
  { chemin: "/nouveau-projet", libelle: "Nouveau projet" },
  { chemin: "/inbox", libelle: "Inbox" },
  { chemin: "/exports", libelle: "Exports" },
  { chemin: "/bibliotheque", libelle: "Bibliothèque" },
  { chemin: "/auteurs-artistes", libelle: "Auteurs et artistes" },
  { chemin: "/parametres", libelle: "Paramètres" },
];

export function App() {
  return (
    <div className="application">
      <nav className="menu">
        <p className="menu-titre">Éditeur</p>
        {MENU.map((entree) => (
          <NavLink key={entree.chemin} to={entree.chemin} end={entree.chemin === "/"}>
            {entree.libelle}
          </NavLink>
        ))}
      </nav>
      <main className="contenu">
        <Routes>
          <Route path="/" element={<TableauDeBord />} />
          <Route path="/nouveau-projet" element={<NouveauProjet />} />
          <Route path="/projets/:id" element={<PageProjet />} />
          <Route path="/projets/:id/modifier" element={<ModifierProjet />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/exports" element={<Exports />} />
          <Route path="/bibliotheque" element={<Bibliotheque />} />
          <Route path="/bibliotheque/nouveau" element={<NouvelAsset />} />
          <Route path="/bibliotheque/assets/:id" element={<PageAsset />} />
          <Route path="/auteurs-artistes" element={<AuteursArtistes />} />
          <Route path="/auteurs-artistes/artistes/nouveau" element={<PageArtiste key="nouveau" />} />
          <Route path="/auteurs-artistes/artistes/:id" element={<PageArtiste />} />
          <Route path="/auteurs-artistes/auteurs/nouveau" element={<PageAuteur key="nouveau" />} />
          <Route path="/auteurs-artistes/auteurs/:id" element={<PageAuteur />} />
          <Route path="/parametres" element={<Parametres />} />
          <Route path="*" element={<h1>Page introuvable</h1>} />
        </Routes>
      </main>
    </div>
  );
}
