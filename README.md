# Ardèche Habitat & SC Amplitudes — Observatoire public

Projection publique de l’observatoire documentaire consacré à Ardèche Habitat, SC Amplitudes et au logement social français.

## Objet

Comparer de manière traçable :

- ce que les institutions déclarent ;
- ce que les sources publiques documentent ;
- ce que les données permettent réellement d’établir ;
- ce qui reste plausible, divergent ou indéterminé.

Le projet distingue systématiquement :

**statut juridique ≠ modèle économique ≠ finalité sociale ≠ pratique observée**.

## Périmètre

Ardèche Habitat → SC Amplitudes → Département de l’Ardèche → Région Auvergne-Rhône-Alpes → France.

Période principale : 1948–2026, avec focalisation 2000–2026.

## Couches publiques transversales

- **Comprendre l’information** : `public/information/`
- **Le Nomisma de Diogène — application documentaire au logement** : `public/information/le-nomisma-de-diogene.html`
- **Auto-audit RGPD de l’observatoire** : `public/rgpd/`
- **Notice de confidentialité** : `public/privacy.html`
- **État machine-readable de confidentialité** : `public/data/privacy-audit.json`

## Affiche QR — diffusion imprimable

- Page A4 autonome : `public/affiche-qr-observatoire.html` ;
- PDF A4 téléchargeable, QR vectoriel : `public/assets/affiche-qr-observatoire-a4.pdf` ;
- QR code relié directement à l’accueil GitHub Pages ; fichier indépendant des services tiers, sans suivi ni données personnelles.

## Affiche publique à imprimer

- **Affiche QR A4** : `public/affiche-qr-observatoire.html` ; PDF associé : `public/assets/affiche-qr-observatoire-a4.pdf`. QR autonome, sans tiers, vers l'accueil public.

## Pages publiques spécialisées

- **Audit technique du site Ardèche Habitat — refonte 2026** : `public/ardeche-habitat-audit-site-web-2026.html`
  - projection publique de l’état canonique privé `AH-WEB-AUDIT-2026 v0.4` ;
  - seules les observations, statuts, limites et références nécessaires à la compréhension publique sont exposés.
- **Registre structuré de cet audit** : `public/data/ardeche-habitat-audit-site-web-2026.csv`
- **Lignage juridique des prestataires diagnostics AED / AC ENVIRONNEMENT** : `public/data/ardeche-habitat-diagnostics-prestataires-lineage-2022-2026.csv`
- **Prestataires techniques — chauffage, ECS, VMC et réseaux** : `public/ardeche-habitat-prestataires-maintenance-technique.html`
- **Registre public des prestataires techniques** : `public/data/ardeche-habitat-prestataires-maintenance-technique.csv`
- **Matrice intervention → attestation / preuve** : `public/data/ardeche-habitat-interventions-attestations.csv`
- **Vie réelle d’un équipement — cycle de vie technique** : `public/vie-reelle-equipement.html`
- **Schéma public équipement / événements** : `public/data/ardeche-habitat-vie-reelle-equipement-schema.csv`
- **Traçabilité publique du bâti — cas pilotes 2000–2015 + Résidence Peyrouse + couche parcellaire/DVF** : `public/patrimoine-tracabilite-batiments.html`
- **Manifeste public de cette page** : `public/data/patrimoine-tracabilite-batiments.yml`
- **Recherche DPE par adresse / immeuble — comparaison open data ADEME** : `public/dpe/`
- **Offres Ardèche Habitat — DPE, GES et qualité des données** : `public/ardeche-habitat-offres-logements-dpe.html`
- **Manifeste public des offres / DPE** : `public/data/ardeche-habitat-offres-logements-dpe.yml`
- **Contester sans perdre la preuve — méthode documentaire publique** : `public/information/contester-sans-perdre-la-preuve.html`
- **État des lieux, DPE et commissaire de justice** : `public/information/etat-des-lieux-dpe-commissaire-justice.html`
- **SCP Masse-Vandenberghe — audit RGPD et actes de commissaire de justice** : `public/commissaire-justice-masse-vandenberghe-rgpd.html`
- **Registre public des incohérences, écarts neutralisés et points de contrôle** : `public/data/commissaire-justice-masse-vandenberghe-incoherences.csv`

## Frontière public / privé

Ce dépôt est une **surface publique de restitution**. Le travail préparatoire, les notes, les documents de recherche, les hypothèses intermédiaires et les éléments non destinés à publication restent dans un dépôt canonique privé.

Les fichiers publiés ici doivent pouvoir être justifiés par des sources publiques accessibles et vérifiables.

## Statuts épistémiques

- ÉTABLI
- FORTEMENT ÉTAYÉ
- PLAUSIBLE
- INDÉTERMINÉ
- DIVERGENT
- RÉFUTÉ

Pour les audits procéduraux, le projet utilise également les états **À TESTER** et **À ACTIVER** afin de ne pas transformer une hypothèse vérifiable en anomalie acquise.

## Indépendance

Projet documentaire indépendant, sans affiliation avec Ardèche Habitat, SC Amplitudes, l’ANCOLS, les collectivités ou organismes cités.

## Licences

- Code et composants techniques : MIT.
- Rédactions et données originales produites par le projet : CC BY 4.0.
- Les documents et contenus tiers restent soumis à leurs droits propres.


## Traitement ADEME portable

Le module public DPE repose sur le contrat `DPE_ADEME_CORE_V1 v1.1.0` : recherche par numéro, recherche par adresse + code postal, regroupement par identité BAN/adresse, déduplication par numéro DPE, tri temporel, comparaison `CONVERGENCE | DIVERGENCE | INDETERMINE` et export CSV local. Le navigateur interroge directement l'open data ADEME ; aucun secret d'API protégée n'est exposé.


## Asset Identity Core

Portable public contract: `ASSET_IDENTITY_CORE_V1 v1.0.0`.

- generic core: `public/assets/asset-identity/core.js`;
- housing adapter: `public/assets/asset-identity/housing-adapter.js`;
- reuse notes: `public/assets/asset-identity/README.md`;
- public application: `public/identite-logement/`.

Central lock:

```text
DOCUMENT_ASSERTS_EVENT != EVENT_OCCURRED
TRACE != FACT
```

The core performs no network request and no persistence. Domain repositories should import it through a thin adapter instead of duplicating or redefining the epistemic rules.


## Simulation 3CL après travaux

Public reusable contract: `DPE_3CL_SCENARIO_CORE_V1 v0.3.0`.

- scenario core: `public/assets/dpe-3cl-simulator/core.js`;
- Open3CL provider: `public/assets/dpe-3cl-simulator/open3cl-provider.js`;
- documentation: `public/assets/dpe-3cl-simulator/README.md`;
- public application: `public/dpe/simulation-3cl/`.

Current engine provider is pinned to `@open3cl/engine 1.9.1` (MIT) and loads lazily from jsDelivr after explicit user action.

V0.3 supports envelope scenarios, four guarded heating/ECS presets and four guarded ventilation presets (simple-flow auto, Hygro A, Hygro B, individual double-flow). The topology inspector reports heating/ECS installation and generator counts plus ventilation-object count. Collective, cascade, multi-generator or multi-ventilation topologies are detected and refused rather than simplified; photovoltaic mappings remain deferred.

```text
BASELINE XML/JSON
 -> OPEN3CL
 -> EXPLICIT SCENARIO PATCHES
 -> OPEN3CL RECALCULATION
 -> BEFORE / AFTER
 -> LOCAL JSON REPORT

PROJECTION != REGULATORY_DPE
SIMULATED_INPUT != OBSERVED_STATE
```


## DPE author and certification comparison

Reusable contract: `DPE_AUTHOR_VERIFICATION_CORE_V1 v0.1.0`.

The building comparison now keeps a separate professional-author axis:

```text
DPE
 -> AVAILABLE AUTHOR FIELDS
 -> OPTIONAL LOCAL ENRICHMENT FROM DPE DOCUMENT
 -> MADI DIRECTORY
 -> CERTIFICATE VALIDITY AT DPE DATE
 -> AUTHOR / COMPANY / CERTIFICATION-BODY COMPARISON
```

The current post-2021 ADEME open-data row may not expose the diagnostician identity. Missing identity is therefore preserved as a valid state rather than inferred.

```text
CERTIFICATE_VALIDITY != DPE_TECHNICAL_CORRECTNESS
DIFFERENT_DIAGNOSTICIAN != INDEPENDENT_OBSERVATION
SAME_COMPANY != SAME_AUTHOR
MADI_MATCH != PROOF_OF_DPE_AUTHORSHIP
```


## DPE documentary dependency graph

Reusable contract: `DPE_DOCUMENT_DEPENDENCY_CORE_V1 v0.1.0`.

The intra-building comparison can now build a local graph between DPEs and the documentary references identified as inputs:

```text
DPE_A -> SOURCE_1
DPE_A -> SOURCE_2
DPE_B -> SOURCE_2
        ↓
SHARED_SOURCE_REFERENCE_ESTABLISHED
```

Inventory completeness is explicit: `COMPLETE | PARTIAL | UNKNOWN`.

Pair states:

- `SHARED_SOURCE_REFERENCE_ESTABLISHED`;
- `NO_SHARED_SOURCE_IDENTIFIED`;
- `INDETERMINATE`.

The optional known-shared ratio only describes the proportion of known references shared across the known union. It is not a probability of independence.

```text
REPLICATION_DOCUMENTAIRE != CORROBORATION_INDEPENDANTE
NO_SHARED_SOURCE_IDENTIFIED != PROOF_OF_INDEPENDENCE
DIFFERENT_DIAGNOSTICIAN != INDEPENDENT_OBSERVATION
SOURCE_REFERENCE != SOURCE_AUTHENTICITY_PROOF
```

The graph is built in memory and can be exported locally as JSON.
