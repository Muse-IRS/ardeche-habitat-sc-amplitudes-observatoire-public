# DPE 3CL Scenario Core

Public reusable layer for local 3CL calculation and after-works projections.

## Contracts

- `DPE_3CL_SCENARIO_CORE_V1 v0.1.0`
- Open3CL provider pinned to `@open3cl/engine 1.9.1`

## Boundary

```text
SOURCE XML/JSON
 -> BASELINE 3CL
 -> CLONE
 -> EXPLICIT SCENARIO PATCHES
 -> 3CL RECALCULATION
 -> BEFORE/AFTER COMPARISON
 -> LOCAL JSON EXPORT
```

No account, no payment and no XML upload to Muse-IRS.

The current provider lazily loads the MIT-licensed Open3CL engine from jsDelivr only after an explicit calculation action. This downloads executable code from a third-party CDN; the local DPE file itself is not transmitted by this module.

## V0.1 scenario scope

Supported deterministic envelope scenarios:

- direct wall U-value (`umur_saisi`);
- direct upper-floor / roof U-value (`uph_saisi`);
- direct lower-floor U-value (`upb_saisi`);
- direct window Uw value (`uw_saisi`).

Wall / floor / roof direct U scenarios use `enum_methode_saisie_u_id = 9`, a direct-U mode exercised by Open3CL tests.

Heating, ECS, ventilation replacements and multi-generator mappings are intentionally not implemented in v0.1.

## Epistemic locks

```text
PROJECTION != REGULATORY_DPE
SIMULATED_INPUT != OBSERVED_STATE
CALCULATION != PHYSICAL_INSPECTION
DIVERGENCE != FAULT
```

The module is an informative calculation surface, not a validated DPE-authoring software package.
