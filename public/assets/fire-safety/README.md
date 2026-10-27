# Fire Safety Building Core

Contract: `FIRE_SAFETY_BUILDING_CORE_V1 v0.1.0`.

The layer is attached to a persistent building asset, preferably through an ID-RNB.

```text
BUILDING / ID-RNB
├── REGULATORY CLASSIFICATION
├── ERP / ADMINISTRATIVE
├── EXTERNAL RISK
├── DECI / PEI
├── INTERNAL FIRE-SAFETY SYSTEMS
├── PERIODIC CONTROLS
├── COMMISSION DECISIONS
└── DOCUMENTARY EVIDENCE
```

The public core does not calculate an automatic fire-safety compliance score.

```text
RNB_ID != FIRE_SAFETY_STATUS
ERP_CLASSIFICATION != FIRE_SAFETY_COMPLIANCE
NEARBY_PEI != SUFFICIENT_DECI
GEORISK != INTERNAL_FIRE_SAFETY
DOCUMENT_ASSERTS_CONTROL != CONTROL_OCCURRED
CONTROL_OCCURRED != CURRENT_COMPLIANCE
NO_OPEN_DATA != NO_SAFETY_DEVICE
FIRE_SAFETY_CONTEXT != FIRE_SAFETY_CONFORMITY
```

RNB is used as the public building identity pivot. DECI/PEI data are standardized nationally but published/consolidated mainly at departmental level. Géorisques provides external-risk context. Internal fire-safety status still requires appropriate building documents, inspections, observations or administrative decisions.
