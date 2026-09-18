# Tracking convention — observatoire public

## État courant — 18 septembre 2026

```text
PUBLIC_ANALYTICS = SUSPENDED
GTM = CONFIGURED_BUT_INACTIVE
GA4 = CONFIGURED_BUT_INACTIVE
```

L’audit de confidentialité du 18 septembre 2026 a identifié que certaines pages chargeaient GTM/GA4 immédiatement alors que d’autres ne le chargeaient pas, sans mécanisme de consentement versionné dans le dépôt. Le chargement de mesure d’audience est donc suspendu sur l’ensemble de la projection publique.

Aucun bloc `gtm.js` ni iframe `noscript` Google Tag Manager ne doit être présent dans les pages servies tant qu’une réactivation n’a pas été explicitement validée.

## Configuration historique conservée

- GTM : `GTM-5ZZ27N8W`
- GA4 : `G-JPQKQ9JKW8`
- ancienne relation prévue : `SITE PUBLIC → GOOGLE TAG MANAGER → GOOGLE ANALYTICS 4`

Ces identifiants sont conservés pour la traçabilité de l’état antérieur. Ils ne signifient pas que le tracking est actif.

## Conditions minimales avant réactivation

Une réactivation exige au minimum :

1. inventaire des tags réellement configurés dans GTM ;
2. finalité explicite de chaque tag ;
3. qualification du régime de consentement applicable ;
4. mécanisme permettant accepter, refuser et retirer avec une simplicité équivalente lorsque le consentement est requis ;
5. documentation des durées et destinataires ;
6. canal privé adapté pour l’exercice des droits ;
7. mise à jour simultanée de `/rgpd/`, `privacy.html` et `data/privacy-audit.json`.

## Invariant

```text
DOCUMENTED_TRACKING_STATE == CODE_ACTUALLY_SERVED
```

Une configuration externe non versionnée ne doit jamais être présentée comme auditée par le seul dépôt GitHub.
