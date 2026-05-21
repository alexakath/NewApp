Alea 1: Import
Apiana option : coche refa mi upload an'ilay fichier .zip images 
Ilay option : "Ne pas importer", par defaut zany importer fona ny sary refa tsy cocher io, sinon tsy importer
Uploadena foana ihany image dia refa le mipotra le otrany recap anle fichier iny dia mipotra eo le checkbox oe "Ne pas importer"
A faire : rajouter le checkbox dans ImportPage ici :
const FileCard = ({ entry, onRemove, onDelimiterChange, disabled }) => {
  if (entry.type === 'zip') {
    return (
      <div className="file-card">
        <div className="file-card-main">
          <div className="file-card-icon zip">
            <i className="ti ti-file-zip"></i>
          </div>
          <div className="file-card-info">
            <span className="file-card-name">{entry.file.name}</span>
            <div className="file-card-badges">
              <span className="module-badge" style={{ background: '#64748b18', color: '#64748b', border: '0.5px solid #64748b44' }}>
                <i className="ti ti-photo"></i> Images produits
              </span>
            </div>
          </div>
        </div>
        {!disabled && (
          <button className="file-card-remove" onClick={() => onRemove(entry.id)} title="Retirer ce fichier">
            <i className="ti ti-x"></i>
          </button>
        )}
      </div>
    )
  }

Alea 2 : Cote frontoffice : duplicate commande :
Dans "Mes commandes" d'un client sur chaque ligne de commande pour tous les etats confondus a part "dans le panier" on rajoute un bouton dupliquer
Action du bouton :
    - modal : champ libre (nombre) par defaut 1 : le nombre ecrit est le nombre de fois qu'on va dupliquer chaque produit dans le commande en question : ex : si je clique sur "Dupliquer" de id commande = 1 qui contient 5 tee shirt et 1 casquette, et que je remplis le champ par 2 -> resultat la commande est dupliquee mais avec : 5 * 2 = 10 tee shirt et 1 * 2 = 2 casquettes donc au lieu de 6 produits il y a 12
    - Quand le client valide le nombre dans le champ libre, il est rediirge vers une page de confirmation : qui affiche un resume de son duplicate, pour chaque produit on doit verifier si le stock est assez : on dit si c'est assez donc valider, si ca ne l'est pas on dit que le stock est insuffisant et manque combien de stock pour cela pour le nombre inscrit pour tel produit, puis un bouton annuler et valider 
        Regle : - tant qu'un des produits n'est pas valide (stock insuffisant), la duplicata ne peut etre valider
                - Quand le client valide le statut de la commande passe tout de suite en "livre"
