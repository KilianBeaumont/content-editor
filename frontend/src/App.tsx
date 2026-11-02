import { NavLink, Route, Routes } from "react-router";
import { AVenir } from "./pages/AVenir.tsx";
import { TableauDeBord } from "./pages/TableauDeBord.tsx";

const MENU = [
  { chemin: "/", libelle: "Tableau de bord" },
  { chemin: "/nouveau-projet", libelle: "Nouveau projet" },
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
          <NavLink key={entree.chemin} to={entree.chemin} end>
            {entree.libelle}
          </NavLink>
        ))}
      </nav>
      <main className="contenu">
        <Routes>
          <Route path="/" element={<TableauDeBord />} />
          <Route path="/nouveau-projet" element={<AVenir titre="Nouveau projet" etape={7} />} />
          <Route path="/projets/:id" element={<AVenir titre="Projet" etape={9} />} />
          <Route path="/bibliotheque" element={<AVenir titre="Bibliothèque" etape={5} />} />
          <Route path="/auteurs-artistes" element={<AVenir titre="Auteurs et artistes" etape={3} />} />
          <Route path="/parametres" element={<AVenir titre="Paramètres" etape={2} />} />
          <Route path="*" element={<h1>Page introuvable</h1>} />
        </Routes>
      </main>
    </div>
  );
}
