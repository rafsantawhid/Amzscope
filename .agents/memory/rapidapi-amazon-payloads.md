---
name: RapidAPI Amazon payloads
description: Normalization constraints observed from the configured real-time Amazon RapidAPI provider.
---

The configured Amazon provider does not use one consistent list envelope: product, bestseller, deal, category, review, and offer results may be nested under different keys. Product text can also contain HTML entities.

**Why:** Treating only `data`, `results`, or `products` as list envelopes silently produced empty dashboard modules even though the provider returned HTTP 200 responses.

**How to apply:** Keep provider-specific parsing inside the server adapter, recursively inspect supported list keys, decode common HTML entities, and make UI empty states distinguish an omitted live feed from sample content.