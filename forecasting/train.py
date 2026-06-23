# forecasting/train.py
import os
import pickle
import numpy as np
import pandas as pd
import psycopg2
from dotenv import load_dotenv
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline

def load_environment():
    # Load .env from root directory
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    dotenv_path = os.path.join(base_dir, '.env')
    if os.path.exists(dotenv_path):
        load_dotenv(dotenv_path)
    else:
        load_dotenv()

def get_db_data():
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        print("DATABASE_URL not found in environment. Falling back to synthetic data.")
        return None

    try:
        conn = psycopg2.connect(database_url)
        query = """
            SELECT
                d.name as dish_name,
                EXTRACT(DOW FROM o.created_at) as day_of_week,
                EXTRACT(MONTH FROM o.created_at) as month,
                o.created_at::date as order_date,
                SUM(oi.quantity) as total_quantity
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            JOIN dishes d ON oi.dish_id = d.id
            WHERE o.status IN ('CONFIRMED', 'PARTIALLY_COLLECTED', 'COLLECTED')
            GROUP BY d.name, day_of_week, month, order_date;
        """
        df = pd.read_sql_query(query, conn)
        conn.close()
        return df
    except Exception as e:
        print(f"Error reading database: {e}. Falling back to synthetic data.")
        return None

def generate_synthetic_data():
    print("Generating synthetic historical order data for training...")
    dishes = [
        "Beef Stew & Rice", "Chicken Biryani", "Yellow Beans & Chapati",
        "Samosa", "Sausage", "French Fries",
        "Masala Tea", "Cold Soda", "Bottled Water", "Fruit Salad"
    ]
    
    # Generate data for past 90 days
    date_range = pd.date_range(end=pd.Timestamp.today(), periods=90)
    data = []
    
    for date in date_range:
        day_of_week = date.dayofweek # 0=Monday, 6=Sunday
        month = date.month
        
        # 1. Nairobi weather temperature simulation (16C to 26C, average 21C)
        # Seasonal changes: slightly cooler in June/July (15-22C), warmer in Jan/Feb (19-27C)
        base_temp = 21.0
        if month in [6, 7, 8]:
            base_temp = 18.0
        elif month in [1, 2, 3]:
            base_temp = 24.0
        temp = base_temp + np.random.uniform(-3.0, 3.0)
        
        # 2. Exam periods (April=4, August=8, December=12)
        is_exam = month in [4, 8, 12]
        
        # 3. Headcount
        if day_of_week < 5: # Weekday
            headcount = 1000
        elif day_of_week == 5: # Saturday
            headcount = 400
        else: # Sunday
            headcount = 150
            
        if is_exam:
            headcount = int(headcount * 1.2)
            
        for dish in dishes:
            # Base quantity depending on dish type
            if "Rice" in dish or "Biryani" in dish or "Chapati" in dish:
                base_qty = 120
            elif dish in ["Samosa", "Sausage", "French Fries"]:
                base_qty = 80
            elif "Tea" in dish:
                base_qty = 100
                # Tea sells much more in cold weather
                temp_factor = max(0.5, 2.0 - (temp / 20.0))
                base_qty *= temp_factor
            elif "Soda" in dish or "Water" in dish:
                base_qty = 90
                # Cold drinks sell more in hot weather
                temp_factor = max(0.5, (temp / 21.0))
                base_qty *= temp_factor
            else:
                base_qty = 40 # Fruit salad
                
            # Scale by headcount
            demand = base_qty * (headcount / 1000.0)
            
            # Day of week fluctuations
            if day_of_week == 4: # Friday snack rush
                if dish in ["French Fries", "Samosa", "Sausage"]:
                    demand *= 1.3
            
            # Random noise
            noise = np.random.normal(0, demand * 0.1)
            quantity = max(5, int(round(demand + noise)))
            
            data.append({
                "dish_name": dish,
                "day_of_week": day_of_week,
                "month": month,
                "temperature": round(temp, 1),
                "is_exam_period": 1 if is_exam else 0,
                "headcount": headcount,
                "total_quantity": quantity
            })
            
    return pd.DataFrame(data)

def train_model():
    load_environment()
    
    # Try to load DB data first
    df = get_db_data()
    
    # If no database data or too small, use synthetic data
    if df is None or len(df) < 50:
        df = generate_synthetic_data()
    else:
        print(f"Loaded {len(df)} records from database. Appending synthetic features for training...")
        # Add engineered features not in DB: temperature, is_exam_period, headcount
        df['order_date'] = pd.to_datetime(df['order_date'])
        
        temps = []
        is_exams = []
        headcounts = []
        
        for idx, row in df.iterrows():
            date = row['order_date']
            month = date.month
            day_of_week = date.dayofweek
            
            # Simple temperature simulation
            base_temp = 21.0
            if month in [6, 7, 8]:
                base_temp = 18.0
            elif month in [1, 2, 3]:
                base_temp = 24.0
            temp = base_temp + np.random.uniform(-3.0, 3.0)
            temps.append(round(temp, 1))
            
            # Exam period
            is_exam = month in [4, 8, 12]
            is_exams.append(1 if is_exam else 0)
            
            # Headcount
            if day_of_week < 5:
                hc = 1000
            elif day_of_week == 5:
                hc = 400
            else:
                hc = 150
            if is_exam:
                hc = int(hc * 1.2)
            headcounts.append(hc)
            
        df['temperature'] = temps
        df['is_exam_period'] = is_exams
        df['headcount'] = headcounts
        
    print("Training dataset preview:")
    print(df.head())
    
    # Features & Target
    features = ['dish_name', 'day_of_week', 'month', 'temperature', 'is_exam_period', 'headcount']
    X = df[features]
    y = df['total_quantity']
    
    # Preprocessor for categorical variable: dish_name
    preprocessor = ColumnTransformer(
        transformers=[
            ('cat', OneHotEncoder(handle_unknown='ignore'), ['dish_name'])
        ],
        remainder='passthrough'
    )
    
    # Pipeline combining preprocessor & RandomForest model
    model_pipeline = Pipeline(steps=[
        ('preprocessor', preprocessor),
        ('regressor', RandomForestRegressor(n_estimators=100, random_state=42))
    ])
    
    # Fit the pipeline
    print("Fitting scikit-learn RandomForest regression model...")
    model_pipeline.fit(X, y)
    
    # Save the pipeline to model.pkl
    model_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'model.pkl')
    with open(model_path, 'wb') as f:
        pickle.dump(model_pipeline, f)
        
    print(f"Model saved successfully to {model_path}")

if __name__ == '__main__':
    train_model()
