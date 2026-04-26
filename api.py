from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from model import recommend

app = FastAPI()


@app.get("/")
def root():
    return {"message": "Recipe recommender API"}


@app.get("/recommend")
def recommend_recipes(ingredients: str, top_k: int = 8, cook_time:str=None, difficulty:str=None, meal_type:str=None):

    ingredient_list = [i.strip() for i in ingredients.split(",") if i.strip()]

    if not ingredient_list:
        return {"error": "Please provide at least one ingredient"}

    results = recommend(ingredient_list, top_k, cook_time, difficulty, meal_type)

    return {
        "ingredients": ingredient_list,
        "results": results
    }

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)