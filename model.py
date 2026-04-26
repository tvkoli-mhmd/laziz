import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# Load dataset
df = pd.read_json("recipes.jsonl", lines=True)

def normalize_meal_type(x):
    if x == "غذای اصلی":
        return "main"
    elif x == "نان و شیرینی":
        return "bakery"
    elif x == "پیش غذا":
        return "appetizer"
    elif x in ["دسر", "بستنی", "تیرامیسو", "کرمها و خامهها", "لواشک", "کیک", "مربا", "ژله", "پای و تارت"]:
        return "dessert"
    elif x in ["چاشنیها", "دیپ ها", "سرکه", "شوری", "پنیر"]:
        return "condiment"
    elif x in ["صبحانه", "املت", "حلیم"]:
        return "breakfast"
    elif x in ["نوشیدنی", "شربت"]:
        return "drink"
    elif x in ["انواع سوپ", "سالادها", "فینگرفود", "بورانی و پوره"]:
        return "appetizer"
    elif x in ["انواع پیتزا", "انواع خوراک", "انواع خورشت", "انواع دلمه", "انواع پاستا"]:
        return "main"
    else:
        return "other"






# Preprocessing: Extract unique ingredient names into a list and a set
df["ingredients_names"] = (
    df["ingredients"]
    .explode()
    .str["name"]
    .groupby(level=0)
    .agg(lambda x: list(x.dropna().unique()))
)

df["ingredient_set"] = df["ingredients_names"].apply(set)
# Filter out recipes with no ingredients
df = df[df["ingredient_set"].apply(len) > 0].copy()
df["meal_type_normalized"] = df["meal_type"].apply(normalize_meal_type)
df = df.drop(columns=["meal_type"])
# Train TF-IDF
# Note: Since ingredients are already clean, we use a simple space-join
vectorizer = TfidfVectorizer()
tfidf_matrix = vectorizer.fit_transform(df["ingredients_names"].str.join(" "))

def recommend(user_ingredients, top_k=5, cook_time=None, difficulty=None, meal_type=None):
    user_set = set(user_ingredients)
    # 1. TF-IDF Similarity (Semantic relevance)
    query = " ".join(user_ingredients)
    query_vec = vectorizer.transform([query])
    tfidf_scores = cosine_similarity(query_vec, tfidf_matrix).flatten()
    # 2. Jaccard & Penalty Scores
    # We use .apply for now (fine for 3k-10k recipes)

    def calculate_metrics(recipe_set):
        intersection = user_set & recipe_set
        union = user_set | recipe_set

        # Jaccard: intersection / union
        jaccard = len(intersection) / len(union) if len(union) > 0 else 0

        # Penalty: How many ingredients are MISSING?
        # A high penalty score (near 1.0) means few items are missing.
        missing_count = len(recipe_set - user_set)
        penalty = 1 / (1 + missing_count)  # Non-linear penalty (drops fast as missing items increase)

        return pd.Series([jaccard, penalty])
    filtered_df = df.copy()
    if cook_time and difficulty and meal_type:
        filtered_df = df[
            (df["recipe_cook_time"] == cook_time) &
            (df["recipe_difficulty"] == difficulty) &
            (df["meal_type_normalized"] == meal_type)
            ]

    elif cook_time and difficulty:
        filtered_df = df[
            (df["recipe_cook_time"] == cook_time) &
            (df["recipe_difficulty"] == difficulty)
            ]

    elif cook_time and meal_type:
        filtered_df = df[
            (df["recipe_cook_time"] == cook_time) &
            (df["meal_type_normalized"] == meal_type)
            ]

    elif difficulty and meal_type:
        filtered_df = df[
            (df["recipe_difficulty"] == difficulty) &
            (df["meal_type_normalized"] == meal_type)
            ]

    elif cook_time:
        filtered_df = df[df["recipe_cook_time"] == cook_time]

    elif difficulty:
        filtered_df = df[df["recipe_difficulty"] == difficulty]

    elif meal_type:
        filtered_df = df[df["meal_type_normalized"] == meal_type]
    filtered_indices = filtered_df.index
    metrics = filtered_df["ingredient_set"].apply(calculate_metrics)
    jaccard_scores = metrics[0]
    penalty_scores = metrics[1]
    tfidf_filtered = tfidf_scores[filtered_indices]
    # 3. Final Scoring (Hybrid Approach)
    final_score = (0.4 * penalty_scores) + (0.4 * jaccard_scores) + (0.2 * tfidf_filtered)

    # Get Top K indices
    top_idx = final_score.sort_values(ascending=False).head(top_k).index

    results = filtered_df.loc[top_idx, [
        "title",
        "ingredients_names",
        "instructions",
        "recipe_difficulty",
        "recipe_cook_time",
        "recipe_prep_time",
        "image",
        "ingredients",
        "meal_type_normalized"
    ]]

    return results.to_dict(orient="records")
