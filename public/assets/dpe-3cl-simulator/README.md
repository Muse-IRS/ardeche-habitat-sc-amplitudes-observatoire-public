# DPE 3CL Scenario Core

Public reusable layer for local 3CL calculation and after-works projections.

## Contracts

- `DPE_3CL_SCENARIO_CORE_V1 v0.3.0`
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

## V0.3 scenario scope

Supported deterministic envelope scenarios:

- direct wall U-value (`umur_saisi`);
- direct upper-floor / roof U-value (`uph_saisi`);
- direct lower-floor U-value (`upb_saisi`);
- direct window Uw value (`uw_saisi`).

Wall / floor / roof direct U scenarios use `enum_methode_saisie_u_id = 9`, a direct-U mode exercised by Open3CL tests.

Supported guarded system presets:

| Preset | Open3CL mapping | Required topology |
|---|---|---|
| Gas condensing boiler after 2015 — heating only | CH type `97`, energy `2`, method `1` | one individual simple heating installation, one heating-only generator |
| Air/water heat pump after 2017 — heating only | CH type `7`, energy `1`, method `1` | one individual simple heating installation, one heating-only generator |
| Gas condensing boiler after 2015 — heating + ECS | CH type `97` + ECS type `57`, energy `2`, method `1` | one matched mixed CH/ECS generator pair with the same `reference_generateur_mixte` |
| Outdoor-air thermodynamic water heater after 2014 | ECS type `6`, energy `1`, thermo period `3`, integrated storage | one individual simple ECS installation, one ECS-only generator |

Before applying a system preset, generator-specific cached/table fields from the source generator are removed so that the target scenario is recalculated from the selected type and the Open3CL default method.

The thermodynamic water-heater preset requires a positive storage volume and a known storage position. If the source does not contain those values, the user must supply them.

Unsupported topologies are refused explicitly. This includes multi-generator heating, cascades, collective systems, ambiguous mixed systems and other mappings not yet qualified.

```text
TOPOLOGY_REFUSAL = VALID_RESULT
```

Supported guarded ventilation presets require exactly one ventilation object:

| Preset | Open3CL mapping |
|---|---|
| VMC simple flux autoréglable après 2012 | type `6`, `ventilation_post_2012 = 1` |
| VMC simple flux Hygro A après 2012 | type `9`, `ventilation_post_2012 = 1` |
| VMC simple flux Hygro B après 2012 | type `15`, `ventilation_post_2012 = 1` |
| VMC double flux individuelle avec échangeur à partir de 2013 | type `20`, `ventilation_post_2012 = 1` |

The scenario clears the ventilation debit table reference and product reference before recalculation, while retaining envelope permeability fields such as q4pa.

Collective systems, cascades, multi-generator systems, multiple ventilation objects, photovoltaic systems and other complex replacements remain detected but are not simplified automatically in v0.3.

## Epistemic locks

```text
PROJECTION != REGULATORY_DPE
SIMULATED_INPUT != OBSERVED_STATE
CALCULATION != PHYSICAL_INSPECTION
DIVERGENCE != FAULT
```

The module is an informative calculation surface, not a validated DPE-authoring software package.


## V0.2 regression checks

Synthetic contract checks cover:

- empty numeric scenario values stay `null` and never become zero;
- gas-condensing heating maps to CH `97` / gas `2`;
- air/water heat pump maps to CH `7` / electricity `1`;
- mixed gas-condensing maps coherently to CH `97` + ECS `57` with preserved mixed reference;
- thermodynamic water heater maps to ECS `6` / electricity `1`, thermo period `3`, integrated storage;
- a two-generator heating topology is refused.

These checks validate the scenario transformation contract. They do not replace an end-to-end regulatory validation of Open3CL itself.


## V0.3 topology inspection

The core reports:

- heating installation count;
- heating generator count;
- ECS installation count;
- ECS generator count;
- ventilation object count;
- simple-heating / simple-ECS / simple-mixed / simple-ventilation eligibility.

```text
COMPLEX_TOPOLOGY_DETECTED
!=
SAFE_TO_SIMPLIFY
```
