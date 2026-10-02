# Les taches automatiques sur le VPS

Tout ce qui tourne sans personne vit ici : la redaction des fiches, le moteur de
blog, les cinq sondes, les trois routes d'entretien de l'application, et la
veille qui surveille les neuf autres.

## Ce qui a change, et pourquoi

Avant, le travail etait reparti entre trois crons Vercel et cinq workflows
GitHub. Deux problemes mesures, pas supposes :

- **GitHub deprogramme les taches planifiees de plusieurs heures.** Une
  redaction annoncee a 02h10 est partie a 14h17, et la sonde censee la suivre a
  16h32 pour un horaire annonce a 04h05. L'ordre entre les etapes n'existait que
  dans les commentaires — d'ou le chainage `workflow_run:`, qui etait un
  contournement.
- **Le disque d'un runner est jetable.** `.state` (cache de decouverte, budget
  IA quotidien, verrous) ne survivait que par le cache Actions. Un cache
  manquant remettait le budget a zero sans que rien ne le dise.

Sur une machine a soi, l'ordre s'ecrit en mettant les commandes a la suite, et
l'etat reste sur le disque. La chaine nocturne est donc une seule ligne de
crontab.

## Installation

```bash
# 1. Le depot
sudo mkdir -p /srv && cd /srv
git clone <url-du-depot> cartoonova && cd cartoonova

# 2. Node 22 et les dependances
#    `npm install` et non `npm ci` : @swc/core de next-intl veut
#    @swc/helpers >= 0.5.17 quand la racine est en 0.5.15, et `npm ci` refuse.
npm install --no-audit --no-fund
(cd portable-content-publisher && npm ci --no-audit --no-fund)

# 3. Chromium, pour la sonde de vitesse
npx playwright install --with-deps chromium

# 4. Les secrets
cp vps/env.exemple .env.vps
chmod 600 .env.vps
nano .env.vps            # remplir

# 5. Les droits d'execution
chmod +x vps/executer.sh

# 6. Verifier avant de planifier
./vps/executer.sh veille
```

Puis, une fois que `veille` repond correctement :

```bash
sed -i "s#^CARTOONOVA=.*#CARTOONOVA=$(pwd)#" vps/crontab
crontab vps/crontab
crontab -l
```

## Verifier que ca tourne

```bash
tail -f vps/journaux/nuit.log          # le passage nocturne en direct
./vps/executer.sh fiches               # rejouer une tache seule
```

Et en base, la question qui compte — qui a tourne, quand, et avec quel
resultat :

```sql
SELECT tache, demarre_le, ok, produit, erreur
FROM ge_job_runs
ORDER BY demarre_le DESC
LIMIT 20;
```

## Les deux pannes que la veille attrape

`vps/executer.sh veille` lit `ge_job_runs` et alerte sur Discord dans deux cas,
definis dans `lib/tachesAttendues.ts` :

- **Muette** — aucun passage reussi depuis plus longtemps que sa tolerance. La
  tache ne se declenche plus, ou echoue avant d'ecrire quoi que ce soit.
- **Sterile** — la tache tourne, se termine sans erreur, et ne produit rien,
  plusieurs fois d'affilee.

La seconde est la raison d'etre de tout ce dispositif. En septembre 2026 les
credits OpenAI et le quota SerpAPI se sont epuises : la redaction des fiches
s'est arretee a 139 pages sur 350, le moteur de blog a cesse de generer, et les
deux ont continue d'afficher un succes pendant une semaine. Une tache qui echoue
bruyamment est un incident ; une tache qui reussit sans rien faire est un
mensonge, et il coute plus cher parce qu'on cherche le probleme ailleurs.

## Bascule : faite le 02/10/2026

Les plannings GitHub de `contenu-fiches.yml`, `contenu.yml` et
`sonde-entonnoir.yml` sont commentes ; `sonde-indexation.yml` et
`sonde-citations.yml` s'enchainaient derriere les fiches et ne partent donc
plus seuls. Tout tourne depuis la crontab d'ici. Verification faite avant de
couper : la nuit du 01 au 02/10 complete dans `ge_job_runs` (fiches, quatre
sondes, retouches, SEO, support, relances), seuls echecs dus aux credits
OpenAI et Perplexity epuises, qui touchaient GitHub de la meme facon.

Si le VPS tombe : relancer a la main depuis l'onglet Actions de GitHub
(`workflow_dispatch` est garde sur chaque workflow).

L'ordre suivi, pour memoire :

1. Installer le VPS et laisser les deux dispositifs tourner **en parallele
   pendant trois nuits**. Les taches sont idempotentes — les sondes ecrivent en
   `ON CONFLICT ... DO UPDATE` par jour, la redaction reprend ou elle en est —
   donc un doublon corrige au lieu de dupliquer.
2. Comparer : `SELECT tache, demarre_le, produit FROM ge_job_runs ORDER BY
   demarre_le DESC` doit montrer deux passages par nuit, avec des resultats
   coherents.
3. Alors seulement, commenter les blocs `schedule:` des cinq workflows dans
   `.github/workflows/`. Garder `workflow_dispatch:` : un declenchement manuel
   depuis GitHub reste le filet de secours si le VPS tombe.

## Ce qui reste chez Vercel

Le site lui-meme, et les trois routes `/api/cron/*` : elles ont besoin du
contexte de l'application. Mais ce n'est plus Vercel qui decide quand elles
tournent — c'est la crontab d'ici, qui les appelle en HTTP avec `CRON_SECRET`.

Les entrees `crons` de `vercel.json` sont donc devenues sans objet. Les laisser
ferait tourner les memes taches deux fois ; elles ont ete retirees.
