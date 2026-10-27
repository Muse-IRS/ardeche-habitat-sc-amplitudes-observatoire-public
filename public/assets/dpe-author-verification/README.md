# DPE Author Verification Core

Reusable author/certification comparison layer for DPE workflows.

Contract:

```text
DPE_AUTHOR_VERIFICATION_CORE_V1 v0.2.0
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

The current post-2021 ADEME aggregated open-data row may not expose the diagnostician identity. When a full ADEME DPE XML/JSON is available, the public page extracts automatically: diagnostician name, company, certificate number, certification body and diagnostic date. No manual re-entry is required. Missing identity in the aggregated row remains a valid state.

Semantic locks:

```text
CERTIFICATE_VALIDITY != DPE_TECHNICAL_CORRECTNESS
DIFFERENT_DIAGNOSTICIAN != INDEPENDENT_OBSERVATION
SAME_COMPANY != SAME_AUTHOR
MADI_MATCH != PROOF_OF_DPE_AUTHORSHIP
MISSING_OPEN_DATA_IDENTITY != AUTHOR_ABSENCE
```

No account and no persistent storage are required. When the user explicitly launches the MADI verification, the browser sends only the professional identity criteria required by the directory query; the DPE address is not part of that lookup.


## V0.2 automatic source resolution

```text
ADEME_AGGREGATED_ROW
 -> use identity if exposed
 -> otherwise keep UNKNOWN

ADEME_FULL_DPE_XML_OR_JSON
 -> administratif.diagnostiqueur
 -> name / company / certificate / certification body
 -> automatic MADI verification
```

```text
ADEME_IDENTITY != MATERIAL_AUTHORSHIP_PROOF
CERTIFICATE_VALIDITY != DPE_TECHNICAL_CORRECTNESS
```
