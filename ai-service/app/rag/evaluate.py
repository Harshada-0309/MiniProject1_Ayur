"""
Deterministic Evaluation Engine for AyurDiet Phase 4 Hybrid RAG Retrieval.
Evaluates Hit@K, MRR, Precision@K, and Recall@K against a representative gold-standard test set.
"""

import json
import logging
from typing import Any, Dict, List, Set

from .hybrid_retriever import HybridRetriever
from .schemas import RetrieveRequest

logger = logging.getLogger("ayurdiet.rag.eval")

# Representative evaluation dataset with domain queries and ground-truth document IDs
EVALUATION_BENCHMARK: List[Dict[str, Any]] = [
    {
        "id": "eval_01_kapha_winter",
        "query": "Kapha pacifying foods suitable during winter cold season hemanta",
        "relevant_docs": {
            "doc_ayurvedic_food_properties",
            "doc_charaka_samhita_vol1",
            "doc_pathya_apathya_compendium",
            "doc_nutritional_advocacy_ayurveda",
        },
    },
    {
        "id": "eval_02_vata_digestion",
        "query": "Dietary advice for Vata dosha to improve digestion and strengthen Agni",
        "relevant_docs": {
            "doc_ayurvedic_food_properties",
            "doc_charaka_samhita_vol1",
            "doc_pathya_apathya_compendium",
            "doc_charaka_samhita_vol2",
        },
    },
    {
        "id": "eval_03_pathya_apathya",
        "query": "Classical Pathya and Apathya wholesome and unwholesome dietary rules",
        "relevant_docs": {
            "doc_pathya_apathya_compendium",
            "doc_charaka_samhita_vol1",
            "doc_charaka_samhita_vol2",
        },
    },
    {
        "id": "eval_04_diabetes",
        "query": "Dietary management and blood sugar control for diabetes mellitus and madhumeha",
        "relevant_docs": {
            "doc_diabetes_clinical_guidelines",
            "doc_common_diseases_guidelines",
            "doc_pathya_apathya_compendium",
        },
    },
    {
        "id": "eval_05_cardiac",
        "query": "Cardiovascular diet guidelines for heart disease hridroga and blood pressure",
        "relevant_docs": {
            "doc_cardiac_disorders_guidelines",
            "doc_common_diseases_guidelines",
            "doc_pathya_apathya_compendium",
        },
    },
    {
        "id": "eval_06_skin_diseases",
        "query": "Diet and lifestyle guidelines in skin diseases kushta psoriasis and eczema",
        "relevant_docs": {
            "doc_ayurveda_skin_diseases_guidelines",
            "doc_skin_diseases_guidelines",
            "doc_pathya_apathya_compendium",
        },
    },
    {
        "id": "eval_07_mental_health",
        "query": "Satvic diet and dietary guidelines for mental health disorders and anxiety",
        "relevant_docs": {
            "doc_ayurveda_mental_disorders_guidelines",
            "doc_charaka_samhita_vol1",
        },
    },
    {
        "id": "eval_08_food_allergies",
        "query": "Priority food allergens reference doses and hypersensitivity threshold",
        "relevant_docs": {
            "doc_food_allergen_reference_doses",
            "doc_priority_food_allergens",
            "doc_risk_assessment_food_allergens",
        },
    },
    {
        "id": "eval_09_food_drug_interactions",
        "query": "Food-drug interactions and pharmacokinetic impact of diet on medication absorption",
        "relevant_docs": {
            "doc_food_drug_interactions",
            "doc_diet_exercise_drug_responses",
        },
    },
    {
        "id": "eval_10_nutrient_deficiency_rda",
        "query": "Recommended dietary allowances RDA and nutrient requirements for Indians ICMR NIN",
        "relevant_docs": {
            "doc_icmr_nin_rda_indians",
            "doc_food_composition_data",
            "doc_nutrient_deficiency",
        },
    },
]


def evaluate_retrieval_pipeline(
    retriever: HybridRetriever,
    k_eval: int = 5,
) -> Dict[str, Any]:
    """
    Computes Hit@K, MRR, Precision@K, and Recall@K over benchmark queries.
    """
    total_queries = len(EVALUATION_BENCHMARK)
    hits_at_k = 0
    reciprocal_ranks = []
    precisions_at_k = []
    recalls_at_k = []
    query_reports = []

    for test_item in EVALUATION_BENCHMARK:
        qid = test_item["id"]
        qtext = test_item["query"]
        relevant_docs: Set[str] = set(test_item["relevant_docs"])

        request = RetrieveRequest(query=qtext, top_k=k_eval)
        response = retriever.retrieve(request)

        retrieved_docs = [r.document_id for r in response.results]
        retrieved_k = retrieved_docs[:k_eval]

        # Hit@K: 1 if at least one relevant document is in top K
        hit = any(doc in relevant_docs for doc in retrieved_k)
        if hit:
            hits_at_k += 1

        # MRR (Mean Reciprocal Rank)
        rr = 0.0
        for rank, doc in enumerate(retrieved_k, start=1):
            if doc in relevant_docs:
                rr = 1.0 / rank
                break
        reciprocal_ranks.append(rr)

        # Precision@K: (number of relevant retrieved in top K) / K
        rel_retrieved_count = sum(1 for doc in retrieved_k if doc in relevant_docs)
        precision = rel_retrieved_count / max(len(retrieved_k), 1)
        precisions_at_k.append(precision)

        # Recall@K: (number of relevant retrieved in top K) / total relevant
        recall = rel_retrieved_count / len(relevant_docs) if relevant_docs else 0.0
        recalls_at_k.append(recall)

        query_reports.append({
            "id": qid,
            "query": qtext,
            "retrieved_documents": retrieved_k,
            "hit": hit,
            "reciprocal_rank": round(rr, 4),
            "precision_at_k": round(precision, 4),
            "recall_at_k": round(recall, 4),
        })

    metrics = {
        "benchmark_queries_count": total_queries,
        "k": k_eval,
        "hit_at_k": round(hits_at_k / total_queries, 4),
        "mrr": round(sum(reciprocal_ranks) / total_queries, 4),
        "precision_at_k": round(sum(precisions_at_k) / total_queries, 4),
        "recall_at_k": round(sum(recalls_at_k) / total_queries, 4),
        "queries": query_reports,
    }

    return metrics


if __name__ == "__main__":
    retriever = HybridRetriever()
    results = evaluate_retrieval_pipeline(retriever, k_eval=5)
    print(json.dumps(results, indent=2))
