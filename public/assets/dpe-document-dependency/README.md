# DPE Document Dependency Core

Reusable local-only graph for comparing the documentary dependencies of several DPEs.

Contract:

```text
DPE_DOCUMENT_DEPENDENCY_CORE_V1 v0.2.0
```

Pipeline:

```text
DPE_A -> {SOURCE_1, SOURCE_2, ...}
DPE_B -> {SOURCE_2, SOURCE_3, ...}
                    ↓
        SHARED_SOURCE_REFERENCE
                    ↓
       DEPENDENCY_RELATION_VISIBLE
```

The core does not infer documentary independence from different authors, different values or the absence of an identified common source.

Inventory completeness is explicit:

- `COMPLETE`
- `PARTIAL`
- `UNKNOWN`

Pair states:

- `SHARED_SOURCE_REFERENCE_ESTABLISHED`
- `SHARED_DECLARED_DESCRIPTOR`
- `NO_SHARED_SOURCE_IDENTIFIED`
- `INDETERMINATE`

`NO_SHARED_SOURCE_IDENTIFIED` is available only when both inventories are marked complete. It still does **not** prove independent observation.

The optional `knownSharedRatio` is only the proportion of known source references shared across the known union. It is not a probability of dependence or independence.

Semantic locks:

```text
REPLICATION_DOCUMENTAIRE != CORROBORATION_INDEPENDANTE
NO_SHARED_SOURCE_IDENTIFIED != PROOF_OF_INDEPENDENCE
DIFFERENT_DIAGNOSTICIAN != INDEPENDENT_OBSERVATION
IDENTICAL_VALUE != PROOF_OF_SHARED_SOURCE
DIFFERENT_VALUE != PROOF_OF_INDEPENDENT_SOURCE
SOURCE_REFERENCE != SOURCE_AUTHENTICITY_PROOF
```

No network request and no persistent storage are required.


## V0.2 ADEME automatic inventory

The public page no longer asks the user to type documentary references. A full ADEME DPE XML/JSON is parsed automatically from:

- `justificatif_collection`;
- `fiche_technique_collection / detail_origine_donnee`.

These values are treated as **declared descriptors** unless a specific document reference is actually available.

```text
SAME_DECLARED_DESCRIPTOR != SAME_DOCUMENT
SHARED_DECLARED_DESCRIPTOR != INDEPENDENT_CORROBORATION
```
