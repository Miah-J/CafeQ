# forecasting/main.py
import os
import pickle
import datetime
import requests
from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional
import pandas as pd
from dotenv import load_dotenv

# Load environment variables
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
dotenv_path = os.path.join(base_dir, '.env')
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path)
else:
    load_dotenv()

app = FastAPI(title="CafeQ Demand Forecasting Service", version="1.0.0")

# Global model pipeline reference
model_pipeline = None

def load_or_train_model():
    global model_pipeline
    model_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'model.pkl')
    
    if not os.path.exists(model_path):
        print("Model file not found. Running training first...")
        try:
            from train import train_model
            train_model()
        except Exception as e:
            print(f"Failed to auto-train model: {e}")
            
    if os.path.exists(model_path):
        try:
            with open(model_path, 'rb') as f:
                model_pipeline = pickle.load(f)
            print("Model loaded successfully.")
        except Exception as e:
            print(f"Error loading model from {model_path}: {e}")
    else:
        print("Model file still missing. Will use rule-based fallback predictions.")

@app.on_event("startup")
def startup_event():
    load_or_train_model()

class ForecastRequest(BaseModel):
    date: str  # YYYY-MM-DD
    dishes: List[str]

def fetch_nairobi_weather() -> tuple[float, str]:
    api_key = os.environ.get('WEATHER_API_KEY')
    if not api_key:
        print("WEATHER_API_KEY not found in environment. Using default temperature.")
        return 20.0, "default_fallback"
        
    try:
        url = f"https://api.openweathermap.org/data/2.5/weather?q=Nairobi&appid={api_key}&units=metric"
        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            data = response.json()
            temp = data['main']['temp']
            print(f"Fetched live Nairobi temperature: {temp} C from OpenWeatherMap.")
            return float(temp), "live_openweathermap"
        else:
            print(f"OpenWeatherMap returned code {response.status_code}. Using default temperature.")
            return 20.0, "error_fallback"
    except Exception as e:
        print(f"Error fetching weather: {e}. Using default temperature.")
        return 20.0, "exception_fallback"

def get_fallback_prediction(dish_name: str, day_of_week: int, temp: float, is_exam: bool) -> int:
    # Rule-based fallback if model is not available
    if "Rice" in dish_name or "Biryani" in dish_name or "Chapati" in dish_name:
        base = 120
    elif dish_name in ["Samosa", "Sausage", "French Fries"]:
        base = 80
    elif "Tea" in dish_name:
        base = 100
        # Cold weather multiplier
        if temp < 19:
            base *= 1.4
        elif temp > 24:
            base *= 0.6
    elif "Soda" in dish_name or "Water" in dish_name:
        base = 90
        # Hot weather multiplier
        if temp > 24:
            base *= 1.3
        elif temp < 19:
            base *= 0.7
    else:
        base = 50
        
    # Scale by day of week
    if day_of_week < 5: # Weekday
        scale = 1.0
    elif day_of_week == 5: # Saturday
        scale = 0.4
    else: # Sunday
        scale = 0.15
        
    if is_exam:
        scale *= 1.2
        
    return int(round(base * scale))

@app.post("/predict")
def predict_demand(payload: ForecastRequest):
    global model_pipeline
    
    # 1. Parse date features
    try:
        dt = datetime.datetime.strptime(payload.date, "%Y-%m-%d")
    except ValueError:
        dt = datetime.datetime.today()
        
    day_of_week = dt.weekday() # 0 = Monday, 6 = Sunday
    month = dt.month
    is_exam = month in [4, 8, 12]
    
    # 2. Get Live Nairobi Weather
    temp, weather_source = fetch_nairobi_weather()
    
    # 3. Determine headcount feature
    if day_of_week < 5:
        headcount = 1000
    elif day_of_week == 5:
        headcount = 400
    else:
        headcount = 150
    if is_exam:
        headcount = int(headcount * 1.2)
        
    predictions = {}
    
    # 4. Predict for each dish
    for dish in payload.dishes:
        if model_pipeline is not None:
            try:
                # Prepare single-row DataFrame for prediction
                input_df = pd.DataFrame([{
                    "dish_name": dish,
                    "day_of_week": day_of_week,
                    "month": month,
                    "temperature": temp,
                    "is_exam_period": 1 if is_exam else 0,
                    "headcount": headcount
                }])
                
                pred_val = model_pipeline.predict(input_df)[0]
                # Ensure predictions make sense and are positive
                predictions[dish] = max(10, int(round(pred_val)))
            except Exception as e:
                print(f"Error predicting for {dish}: {e}. Using fallback.")
                predictions[dish] = get_fallback_prediction(dish, day_of_week, temp, is_exam)
        else:
            predictions[dish] = get_fallback_prediction(dish, day_of_week, temp, is_exam)
            
    return {
        "status": "success",
        "predictions": predictions,
        "weather": {
            "temperature": temp,
            "source": weather_source
        },
        "timestamp": datetime.datetime.now().isoformat()
    }

@app.post("/retrain")
def retrain_model():
    try:
        from train import train_model
        train_model()
        load_or_train_model()
        return {"status": "success", "message": "Model retrained and reloaded successfully."}
    except Exception as e:
        return {"status": "error", "message": f"Retraining failed: {str(e)}"}
