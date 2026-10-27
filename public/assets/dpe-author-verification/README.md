# DPE Author Verification Core

Reusable author/certification comparison layer for DPE workflows.

Contract:

```text
DPE_AUTHOR_VERIFICATION_CORE_V1 v0.1.0
```

Pipeline:

```text
DPE_ROW
 -> EXTRACT_AVAILABLE_AUTHOR_FIELDS
 -> OPTIONAL_LOCAL_ENRICHMENT_FROM_DPE_DOCUMENT
 -> MADI_DIRECTORY_LOOKUP
 -> VALIDITY_AT_DPE_DATE
 -> BUILDING_AUTHOR_COMPARISON
```

The current post-2021 ADEME open-data row may not expose the diagnostician identity. Missing identity therefore remains a valid state.

Semantic locks:

```text
CERTIFICATE_VALIDITY != DPE_TECHNICAL_CORRECTNESS
DIFFERENT_DIAGNOSTICIAN != INDEPENDENT_OBSERVATION
SAME_COMPANY != SAME_AUTHOR
MADI_MATCH != PROOF_OF_DPE_AUTHORSHIP
MISSING_OPEN_DATA_IDENTITY != AUTHOR_ABSENCE
```

No account and no persistent storage are required. When the user explicitly launches the MADI verification, the browser sends only the professional identity criteria required by the directory query; the DPE address is not part of that lookup.
