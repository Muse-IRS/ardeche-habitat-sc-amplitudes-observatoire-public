# DPE Data Justification Core

Reusable layer for separating a value stored in a DPE database from the evidence that would justify that value.

Contract:

```text
DPE_DATA_JUSTIFICATION_CORE_V1 v0.1.0
```

## Central chain

```text
VALUE
 -> ORIGIN METADATA
 -> DECLARED JUSTIFICATION
 -> SOURCE DOCUMENT
 -> SUPPORT RELATION
```

These levels are not interchangeable.

```text
VALUE_IN_DATABASE != JUSTIFICATION
DECLARED_ORIGIN != SOURCE_DOCUMENT
DECLARED_JUSTIFICATION != DOCUMENT_PAYLOAD
JUSTIFICATION_INVENTORY != FIELD_LEVEL_SUPPORT_RELATION
DATABASE_ACCEPTANCE != MATERIAL_VERIFICATION
```

## Current full-DPE structure

The inspected full DPE structure contains:

- technical sheets with `description`, `valeur`, `detail_origine_donnee`, `enum_origine_donnee_id`;
- a separate justification collection with `description` and `enum_type_justificatif_id`.

The inspected structure does not expose an explicit one-to-one link from each technical value to a specific embedded source-document payload. Therefore the public core keeps:

```text
FIELD_LEVEL_SUPPORT_RELATION = UNESTABLISHED
SOURCE_DOCUMENT = NOT_EMBEDDED
```

unless another source explicitly establishes that relation.

## Privacy

XML/JSON inspection is browser-local only. No network request or persistent application storage is required.
