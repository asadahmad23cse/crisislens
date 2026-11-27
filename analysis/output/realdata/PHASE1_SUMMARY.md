# Phase 1: real-post classifier evaluation

Restricted relevance is a partial class-derived proxy; broad relevance is a different humanitarian topic target. Neither supplies complete ten-need gold labels. Simulation v2 was tuned on the simulation being scored.

Source audit: 76,484 public-dataset tweets in 19 events.

| Data | Event | Target | Classifier | N | Coverage | Precision | Recall | F1 |
|---|---|---|---|---:|---:|---:|---:|---:|
| real | hurricane_maria_2017 | restricted | v1 | 1784 | 24.5% | 0.653 | 0.281 | 0.393 |
| real | hurricane_maria_2017 | restricted | v2 | 1784 | 24.5% | 0.812 | 0.200 | 0.320 |
| real | hurricane_maria_2017 | restricted | tfidf_lr | 1784 | 24.5% | 0.896 | 0.593 | 0.713 |
| real | hurricane_maria_2017 | broad | v1 | 7278 | 100.0% | 0.922 | 0.235 | 0.374 |
| real | hurricane_maria_2017 | broad | v2 | 7278 | 100.0% | 0.949 | 0.115 | 0.206 |
| real | hurricane_maria_2017 | broad | tfidf_lr | 7278 | 100.0% | 0.948 | 0.914 | 0.931 |
| real | kerala_floods_2018 | restricted | v1 | 1937 | 24.3% | 0.572 | 0.633 | 0.601 |
| real | kerala_floods_2018 | restricted | v2 | 1937 | 24.3% | 0.831 | 0.503 | 0.627 |
| real | kerala_floods_2018 | restricted | tfidf_lr | 1937 | 24.3% | 0.915 | 0.584 | 0.713 |
| real | kerala_floods_2018 | broad | v1 | 7984 | 100.0% | 0.897 | 0.400 | 0.553 |
| real | kerala_floods_2018 | broad | v2 | 7984 | 100.0% | 0.947 | 0.175 | 0.296 |
| real | kerala_floods_2018 | broad | tfidf_lr | 7984 | 100.0% | 0.921 | 0.932 | 0.927 |
| simulated | kerala_flood_2018 | gold_relevance | v1 | 10067 | 100.0% | 0.659 | 0.850 | 0.742 |
| simulated | kerala_flood_2018 | gold_relevance | v2 | 10067 | 100.0% | 1.000 | 1.000 | 1.000 |
| simulated | kerala_flood_2018 | gold_relevance | tfidf_lr | 10067 | 100.0% | 0.740 | 0.979 | 0.843 |
| simulated | maria_2017 | gold_relevance | v1 | 7303 | 100.0% | 0.679 | 0.812 | 0.739 |
| simulated | maria_2017 | gold_relevance | v2 | 7303 | 100.0% | 1.000 | 1.000 | 1.000 |
| simulated | maria_2017 | gold_relevance | tfidf_lr | 7303 | 100.0% | 0.774 | 0.968 | 0.860 |
| simulated | nepal_eq_2015 | gold_relevance | v1 | 6017 | 100.0% | 0.654 | 0.625 | 0.639 |
| simulated | nepal_eq_2015 | gold_relevance | v2 | 6017 | 100.0% | 1.000 | 1.000 | 1.000 |
| simulated | nepal_eq_2015 | gold_relevance | tfidf_lr | 6017 | 100.0% | 1.000 | 0.924 | 0.961 |

TF-IDF LR uses the capped, frozen configuration documented in MAPPING.md. Real models train on other HumAID events; simulated models train on other simulated events. These are different training domains and label definitions, not a direct transfer benchmark.

## All event results

| Data | Event | Target | Classifier | N | Coverage | Precision | Recall | F1 |
|---|---|---|---|---:|---:|---:|---:|---:|
| real | california_wildfires_2018 | restricted | v1 | 2237 | 30.3% | 0.335 | 0.389 | 0.360 |
| real | california_wildfires_2018 | restricted | v2 | 2237 | 30.3% | 0.584 | 0.273 | 0.372 |
| real | california_wildfires_2018 | restricted | tfidf_lr | 2237 | 30.3% | 0.916 | 0.828 | 0.870 |
| real | california_wildfires_2018 | broad | v1 | 7376 | 100.0% | 0.821 | 0.283 | 0.421 |
| real | california_wildfires_2018 | broad | v2 | 7376 | 100.0% | 0.894 | 0.131 | 0.229 |
| real | california_wildfires_2018 | broad | tfidf_lr | 7376 | 100.0% | 0.853 | 0.941 | 0.895 |
| real | canada_wildfires_2016 | restricted | v1 | 640 | 28.5% | 0.688 | 0.110 | 0.190 |
| real | canada_wildfires_2016 | restricted | v2 | 640 | 28.5% | 0.955 | 0.105 | 0.189 |
| real | canada_wildfires_2016 | restricted | tfidf_lr | 640 | 28.5% | 0.971 | 0.932 | 0.952 |
| real | canada_wildfires_2016 | broad | v1 | 2242 | 100.0% | 0.913 | 0.104 | 0.187 |
| real | canada_wildfires_2016 | broad | v2 | 2242 | 100.0% | 0.977 | 0.042 | 0.080 |
| real | canada_wildfires_2016 | broad | tfidf_lr | 2242 | 100.0% | 0.955 | 0.977 | 0.966 |
| real | cyclone_idai_2019 | restricted | v1 | 762 | 19.4% | 0.440 | 0.605 | 0.509 |
| real | cyclone_idai_2019 | restricted | v2 | 762 | 19.4% | 0.771 | 0.405 | 0.531 |
| real | cyclone_idai_2019 | restricted | tfidf_lr | 762 | 19.4% | 0.916 | 0.655 | 0.764 |
| real | cyclone_idai_2019 | broad | v1 | 3933 | 100.0% | 0.903 | 0.425 | 0.578 |
| real | cyclone_idai_2019 | broad | v2 | 3933 | 100.0% | 0.966 | 0.203 | 0.336 |
| real | cyclone_idai_2019 | broad | tfidf_lr | 3933 | 100.0% | 0.946 | 0.965 | 0.956 |
| real | ecuador_earthquake_2016 | restricted | v1 | 433 | 27.7% | 0.340 | 0.198 | 0.250 |
| real | ecuador_earthquake_2016 | restricted | v2 | 433 | 27.7% | 0.542 | 0.143 | 0.226 |
| real | ecuador_earthquake_2016 | restricted | tfidf_lr | 433 | 27.7% | 0.913 | 0.692 | 0.787 |
| real | ecuador_earthquake_2016 | broad | v1 | 1563 | 100.0% | 0.910 | 0.288 | 0.438 |
| real | ecuador_earthquake_2016 | broad | v2 | 1563 | 100.0% | 0.918 | 0.101 | 0.182 |
| real | ecuador_earthquake_2016 | broad | tfidf_lr | 1563 | 100.0% | 0.952 | 0.971 | 0.961 |
| real | greece_wildfires_2018 | restricted | v1 | 421 | 27.8% | 0.152 | 0.600 | 0.242 |
| real | greece_wildfires_2018 | restricted | v2 | 421 | 27.8% | 0.312 | 0.400 | 0.351 |
| real | greece_wildfires_2018 | restricted | tfidf_lr | 421 | 27.8% | 0.750 | 0.480 | 0.585 |
| real | greece_wildfires_2018 | broad | v1 | 1515 | 100.0% | 0.801 | 0.303 | 0.440 |
| real | greece_wildfires_2018 | broad | v2 | 1515 | 100.0% | 0.876 | 0.139 | 0.239 |
| real | greece_wildfires_2018 | broad | tfidf_lr | 1515 | 100.0% | 0.909 | 0.884 | 0.896 |
| real | hurricane_dorian_2019 | restricted | v1 | 2938 | 38.6% | 0.391 | 0.245 | 0.301 |
| real | hurricane_dorian_2019 | restricted | v2 | 2938 | 38.6% | 0.457 | 0.109 | 0.176 |
| real | hurricane_dorian_2019 | restricted | tfidf_lr | 2938 | 38.6% | 0.948 | 0.881 | 0.913 |
| real | hurricane_dorian_2019 | broad | v1 | 7613 | 100.0% | 0.818 | 0.297 | 0.436 |
| real | hurricane_dorian_2019 | broad | v2 | 7613 | 100.0% | 0.812 | 0.097 | 0.173 |
| real | hurricane_dorian_2019 | broad | tfidf_lr | 7613 | 100.0% | 0.880 | 0.934 | 0.906 |
| real | hurricane_florence_2018 | restricted | v1 | 2223 | 35.5% | 0.283 | 0.323 | 0.301 |
| real | hurricane_florence_2018 | restricted | v2 | 2223 | 35.5% | 0.260 | 0.146 | 0.187 |
| real | hurricane_florence_2018 | restricted | tfidf_lr | 2223 | 35.5% | 0.910 | 0.932 | 0.921 |
| real | hurricane_florence_2018 | broad | v1 | 6264 | 100.0% | 0.768 | 0.397 | 0.523 |
| real | hurricane_florence_2018 | broad | v2 | 6264 | 100.0% | 0.626 | 0.101 | 0.175 |
| real | hurricane_florence_2018 | broad | tfidf_lr | 6264 | 100.0% | 0.831 | 0.982 | 0.900 |
| real | hurricane_harvey_2017 | restricted | v1 | 2066 | 22.7% | 0.706 | 0.454 | 0.553 |
| real | hurricane_harvey_2017 | restricted | v2 | 2066 | 22.7% | 0.809 | 0.320 | 0.459 |
| real | hurricane_harvey_2017 | restricted | tfidf_lr | 2066 | 22.7% | 0.983 | 0.773 | 0.865 |
| real | hurricane_harvey_2017 | broad | v1 | 9112 | 100.0% | 0.923 | 0.288 | 0.439 |
| real | hurricane_harvey_2017 | broad | v2 | 9112 | 100.0% | 0.918 | 0.107 | 0.192 |
| real | hurricane_harvey_2017 | broad | tfidf_lr | 9112 | 100.0% | 0.948 | 0.952 | 0.950 |
| real | hurricane_irma_2017 | restricted | v1 | 2063 | 21.9% | 0.565 | 0.362 | 0.441 |
| real | hurricane_irma_2017 | restricted | v2 | 2063 | 21.9% | 0.728 | 0.225 | 0.343 |
| real | hurricane_irma_2017 | restricted | tfidf_lr | 2063 | 21.9% | 0.916 | 0.902 | 0.909 |
| real | hurricane_irma_2017 | broad | v1 | 9399 | 100.0% | 0.901 | 0.273 | 0.420 |
| real | hurricane_irma_2017 | broad | v2 | 9399 | 100.0% | 0.921 | 0.104 | 0.187 |
| real | hurricane_irma_2017 | broad | tfidf_lr | 9399 | 100.0% | 0.930 | 0.957 | 0.943 |
| real | hurricane_maria_2017 | restricted | v1 | 1784 | 24.5% | 0.653 | 0.281 | 0.393 |
| real | hurricane_maria_2017 | restricted | v2 | 1784 | 24.5% | 0.812 | 0.200 | 0.320 |
| real | hurricane_maria_2017 | restricted | tfidf_lr | 1784 | 24.5% | 0.896 | 0.593 | 0.713 |
| real | hurricane_maria_2017 | broad | v1 | 7278 | 100.0% | 0.922 | 0.235 | 0.374 |
| real | hurricane_maria_2017 | broad | v2 | 7278 | 100.0% | 0.949 | 0.115 | 0.206 |
| real | hurricane_maria_2017 | broad | tfidf_lr | 7278 | 100.0% | 0.948 | 0.914 | 0.931 |
| real | hurricane_matthew_2016 | restricted | v1 | 562 | 34.0% | 0.425 | 0.341 | 0.378 |
| real | hurricane_matthew_2016 | restricted | v2 | 562 | 34.0% | 0.600 | 0.231 | 0.333 |
| real | hurricane_matthew_2016 | restricted | tfidf_lr | 562 | 34.0% | 0.972 | 0.758 | 0.852 |
| real | hurricane_matthew_2016 | broad | v1 | 1654 | 100.0% | 0.845 | 0.194 | 0.315 |
| real | hurricane_matthew_2016 | broad | v2 | 1654 | 100.0% | 0.853 | 0.068 | 0.127 |
| real | hurricane_matthew_2016 | broad | tfidf_lr | 1654 | 100.0% | 0.916 | 0.954 | 0.935 |
| real | italy_earthquake_aug_2016 | restricted | v1 | 609 | 50.7% | 0.148 | 0.267 | 0.190 |
| real | italy_earthquake_aug_2016 | restricted | v2 | 609 | 50.7% | 0.182 | 0.067 | 0.098 |
| real | italy_earthquake_aug_2016 | restricted | tfidf_lr | 609 | 50.7% | 0.769 | 0.333 | 0.465 |
| real | italy_earthquake_aug_2016 | broad | v1 | 1201 | 100.0% | 0.797 | 0.291 | 0.426 |
| real | italy_earthquake_aug_2016 | broad | v2 | 1201 | 100.0% | 0.833 | 0.072 | 0.133 |
| real | italy_earthquake_aug_2016 | broad | tfidf_lr | 1201 | 100.0% | 0.931 | 0.887 | 0.909 |
| real | kaikoura_earthquake_2016 | restricted | v1 | 767 | 34.9% | 0.263 | 0.189 | 0.220 |
| real | kaikoura_earthquake_2016 | restricted | v2 | 767 | 34.9% | 0.487 | 0.171 | 0.253 |
| real | kaikoura_earthquake_2016 | restricted | tfidf_lr | 767 | 34.9% | 0.968 | 0.829 | 0.893 |
| real | kaikoura_earthquake_2016 | broad | v1 | 2195 | 100.0% | 0.854 | 0.224 | 0.354 |
| real | kaikoura_earthquake_2016 | broad | v2 | 2195 | 100.0% | 0.794 | 0.050 | 0.094 |
| real | kaikoura_earthquake_2016 | broad | tfidf_lr | 2195 | 100.0% | 0.867 | 0.954 | 0.908 |
| real | kerala_floods_2018 | restricted | v1 | 1937 | 24.3% | 0.572 | 0.633 | 0.601 |
| real | kerala_floods_2018 | restricted | v2 | 1937 | 24.3% | 0.831 | 0.503 | 0.627 |
| real | kerala_floods_2018 | restricted | tfidf_lr | 1937 | 24.3% | 0.915 | 0.584 | 0.713 |
| real | kerala_floods_2018 | broad | v1 | 7984 | 100.0% | 0.897 | 0.400 | 0.553 |
| real | kerala_floods_2018 | broad | v2 | 7984 | 100.0% | 0.947 | 0.175 | 0.296 |
| real | kerala_floods_2018 | broad | tfidf_lr | 7984 | 100.0% | 0.921 | 0.932 | 0.927 |
| real | maryland_floods_2018 | restricted | v1 | 187 | 25.2% | 0.000 | 0.000 | 0.000 |
| real | maryland_floods_2018 | restricted | v2 | 187 | 25.2% | 0.000 | 0.000 | 0.000 |
| real | maryland_floods_2018 | restricted | tfidf_lr | 187 | 25.2% | 0.000 | 0.000 | 0.000 |
| real | maryland_floods_2018 | broad | v1 | 742 | 100.0% | 0.887 | 0.495 | 0.636 |
| real | maryland_floods_2018 | broad | v2 | 742 | 100.0% | 0.967 | 0.267 | 0.418 |
| real | maryland_floods_2018 | broad | tfidf_lr | 742 | 100.0% | 0.895 | 0.951 | 0.922 |
| real | midwestern_us_floods_2019 | restricted | v1 | 600 | 31.9% | 0.045 | 0.174 | 0.071 |
| real | midwestern_us_floods_2019 | restricted | v2 | 600 | 31.9% | 0.075 | 0.109 | 0.088 |
| real | midwestern_us_floods_2019 | restricted | tfidf_lr | 600 | 31.9% | 0.593 | 0.348 | 0.438 |
| real | midwestern_us_floods_2019 | broad | v1 | 1880 | 100.0% | 0.684 | 0.279 | 0.396 |
| real | midwestern_us_floods_2019 | broad | v2 | 1880 | 100.0% | 0.610 | 0.073 | 0.131 |
| real | midwestern_us_floods_2019 | broad | tfidf_lr | 1880 | 100.0% | 0.805 | 0.949 | 0.871 |
| real | pakistan_earthquake_2019 | restricted | v1 | 1055 | 53.9% | 0.054 | 0.579 | 0.099 |
| real | pakistan_earthquake_2019 | restricted | v2 | 1055 | 53.9% | 0.097 | 0.316 | 0.148 |
| real | pakistan_earthquake_2019 | restricted | tfidf_lr | 1055 | 53.9% | 0.615 | 0.421 | 0.500 |
| real | pakistan_earthquake_2019 | broad | v1 | 1958 | 100.0% | 0.747 | 0.618 | 0.677 |
| real | pakistan_earthquake_2019 | broad | v2 | 1958 | 100.0% | 0.851 | 0.346 | 0.492 |
| real | pakistan_earthquake_2019 | broad | tfidf_lr | 1958 | 100.0% | 0.788 | 0.899 | 0.840 |
| real | puebla_mexico_earthquake_2017 | restricted | v1 | 466 | 23.1% | 0.339 | 0.311 | 0.325 |
| real | puebla_mexico_earthquake_2017 | restricted | v2 | 466 | 23.1% | 0.529 | 0.148 | 0.231 |
| real | puebla_mexico_earthquake_2017 | restricted | tfidf_lr | 466 | 23.1% | 0.867 | 0.426 | 0.571 |
| real | puebla_mexico_earthquake_2017 | broad | v1 | 2015 | 100.0% | 0.932 | 0.313 | 0.469 |
| real | puebla_mexico_earthquake_2017 | broad | v2 | 2015 | 100.0% | 0.915 | 0.053 | 0.101 |
| real | puebla_mexico_earthquake_2017 | broad | tfidf_lr | 2015 | 100.0% | 0.942 | 0.973 | 0.957 |
| real | srilanka_floods_2017 | restricted | v1 | 94 | 16.8% | 0.645 | 0.588 | 0.615 |
| real | srilanka_floods_2017 | restricted | v2 | 94 | 16.8% | 0.762 | 0.471 | 0.582 |
| real | srilanka_floods_2017 | restricted | tfidf_lr | 94 | 16.8% | 0.885 | 0.676 | 0.767 |
| real | srilanka_floods_2017 | broad | v1 | 560 | 100.0% | 0.946 | 0.386 | 0.548 |
| real | srilanka_floods_2017 | broad | v2 | 560 | 100.0% | 0.957 | 0.220 | 0.358 |
| real | srilanka_floods_2017 | broad | tfidf_lr | 560 | 100.0% | 0.939 | 0.992 | 0.965 |

## Limitations

- Restricted relevance is a partial class-derived proxy, not an unmet-need gold label.
- Broad humanitarian relevance differs from CrisisLens need relevance.
- No exhaustive ten-need or urgency gold; only three positive topic-proxy hit rates.
- HumAID contains English posts only and is not a representative municipal stream.
- Simulation v2 was tuned on the simulation being scored.
- Training excludes normalized exact held-out overlaps, not every near-duplicate.
- Transformer: No suitable cached multilingual encoder; no CUDA; model download needs approval.
- Error examples are in the ignored private JSON, with handles and URLs masked; do not redistribute its contents.
