# Asset Identity Core

Portable public module for representing a durable physical asset, its components, dated events, documentary traces, assertions, observations and qualified relations.

## Contract

`ASSET_IDENTITY_CORE_V1` — version `1.0.0`.

The core is domain-independent and contains no housing, DPE, tenant or Ardèche-specific logic.

```text
ASSET
 -> COMPONENTS
 -> EVENTS
 -> DOCUMENTS
 -> ASSERTIONS
 -> RELATIONS
 -> OBSERVATIONS
```

## Central epistemic separation

```text
DOCUMENT ASSERTS EVENT
!=
EVENT OCCURRED

DOCUMENT AUTHENTIC
!=
MATERIAL FACT DEMONSTRATED

TRACE
!=
FACT

TRACE + FACT
!=
RELATION ESTABLISHED
```

A document can establish that a statement exists without establishing the occurrence of the material event described by that statement.

## Relation states

- `ESTABLISHED`
- `DIVERGENT`
- `INDETERMINATE`
- `NOT_SEARCHED`

`UNKNOWN` remains a valid bounded result.

## Reuse

A domain repository should import `core.js` and provide a thin adapter. The housing observatory uses `housing-adapter.js`.

Examples of other adapters:

- vehicle / aircraft component identity;
- industrial equipment;
- land / parcel / building;
- financial instrument or contract object;
- administrative object with documentary events.

The domain adapter may define vocabulary and mappings, but should not redefine the semantic locks.

## Privacy

The core performs no network request and writes no browser storage. Persistence, networking and UI are responsibilities of the host application.
