from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional
import datetime

app = FastAPI(title="CafeQ Forecasting API", version="1.0.0")

class DemandFeatures(BaseModel):
    day_of_week: int
    time_slot: str
    temperature: float
    is_exam_period: bool

@app.get("/")
def read_root():
    return {"message": "CafeQ Demand Forecasting Service"}

@app.post("/predict")
def predict_demand(features: DemandFeatures):
    # Dummy ML logic for Increment 1. Will implement Scikit-learn in Increment 3.
    # Returns estimated preparation quantities for major dish categories
    return {
        "status": "success",
        "predictions": {
            "main_dishes": 120,
            "snacks": 45,
            "drinks": 200
        },
        "timestamp": datetime.datetime.now().isoformat()
    }
