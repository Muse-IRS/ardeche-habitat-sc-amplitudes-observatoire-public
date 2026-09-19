# Normalisation des identités fournisseurs

Date d'observation du registre : 2026-09-17.

## Objet

Cette couche distingue quatre objets documentaires qui ne doivent pas être fusionnés :

1. **Identité publiée dans l'avis** : nom et, lorsqu'il existe, numéro d'immatriculation reproduits tels qu'ils apparaissent dans BOAMP, TED ou OJS.
2. **Établissement attributaire** : SIRET et adresse rattachés au titulaire au moment du marché. Cet établissement peut être différent du siège social actuel.
3. **Siège social actuel** : dénomination, SIRET de siège, adresse, commune, code postal et forme juridique observés dans les registres d'entreprise à la date de contrôle.
4. **Lieu d'exécution** : commune, patrimoine ou opération sur lesquels porte le marché. Il appartient au registre des marchés et n'est jamais utilisé comme adresse du fournisseur.

Formellement :

```text
AVIS DE MARCHÉ
  ├─ identité publiée
  └─ établissement attributaire à t0
          ↓ lien par SIREN / preuve documentaire
PERSONNE MORALE OU ENTREPRENEUR
  └─ siège social observé à t1

LIEU D'EXÉCUTION DU MARCHÉ = variable distincte
```

## Règles de conservation

- Le **SIREN** identifie la personne ou l'entité juridique lorsque cette identification est établie.
- Le **SIRET attributaire** reste celui du marché, même si le siège est ensuite transféré ou si un nouvel établissement devient siège.
- Une modification de dénomination ou de forme juridique est datée et n'efface pas la forme publiée dans l'avis historique.
- Lorsqu'un numéro publié diverge du registre officiel, le numéro brut reste dans `published_registration_number` et le numéro normalisé dans `awarded_siret` ; le statut signale explicitement la divergence.
- Une adresse de chantier, une commune d'exécution ou un patrimoine n'est jamais assimilé au siège social.
- Si l'état courant n'est pas établi avec une source suffisamment robuste, les champs actuels restent vides ou portent un statut d'indétermination : l'absence de donnée n'est pas transformée en hypothèse.

## Cas discriminants du corpus

- **TERIDEAL** : établissement attributaire de Genas (`41034492300124`) distinct du siège actuel de Wissous (`41034492300488`).
- **ENGIE HOME SERVICES / SAVELYS** : marché attribué à l'établissement de Bron (`30134058403818`) ; même SIREN `301340584`, dénomination actuelle SAVELYS et siège actuel distinct à Courbevoie (`30134058407439`).
- **MCC CARRELAGE** : SIRET attributaire `83049058700011`, siège actuel `83049058700029`.
- **LUC ESCHARAVIL** : la forme SA publiée dans l'avis est conservée ; la forme actuelle SAS est enregistrée séparément.
- **MENUISERIE CHINAPPI** : TED publie `41552828300036`, tandis que le registre officiel rattache la société à `412528283` et au SIRET `41252828300036` à la même adresse. Les deux valeurs sont conservées sans correction silencieuse de la source.

## Jointure des données

`provider_id` est la clé stable entre :

- `data/ardeche-habitat-prestataires-identites-niveau-1.csv` : identité, établissement attributaire et siège actuel ;
- `data/ardeche-habitat-marches-prestataires-niveau-1.csv` : marché, lot, fonction, patrimoine, lieu d'exécution et valeur publiée.

Cette séparation permet d'agréger les marchés par personne juridique sans perdre la temporalité des établissements ni transformer le lieu d'exécution en donnée d'identité.
