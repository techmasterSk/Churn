import os
import traceback # More detailed error logging
import logging # Standard logging
import pandas as pd
import numpy as np
import joblib # For loading models
from flask import Flask, request, jsonify, render_template
from werkzeug.utils import secure_filename # For secure file handling
import datetime
import pymongo # For MongoDB
import google.generativeai as genai # For Gemini
from io import StringIO # To read CSV from memory stream

# --- Basic Logging Setup ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- Flask App Initialization ---
app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024 # Limit upload size (e.g., 16MB)
app.config['UPLOAD_FOLDER'] = 'uploads' # Folder to store uploaded CSVs (optional, not strictly needed now)

# Create upload folder if it doesn't exist
if not os.path.exists(app.config['UPLOAD_FOLDER']):
    os.makedirs(app.config['UPLOAD_FOLDER'])
    logging.info(f"Created upload directory at: {app.config['UPLOAD_FOLDER']}")

# --- Configuration Loading (HARDCODED KEYS - Use with caution) ---
# *** UPDATED API KEY ***
GEMINI_API_KEY = "AIzaSyD_fK0Dml69y0RnhQiT5ydbjR4ChcAHMjA"
MONGODB_URI = "mongodb+srv://Sumit:okenopei123@cluster0.ebs6g.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"

if not GEMINI_API_KEY:
    logging.error("GEMINI_API_KEY is missing! Custom analysis will fail.")
if not MONGODB_URI:
    logging.error("MONGODB_URI is missing! Database logging will fail.")

# --- Configure Gemini ---
gemini_model = None
# *** UPDATED Model Name as requested 'gemini-2.0-flash' ***
# NOTE: This specific name might cause API errors if not recognized.

MODEL_FEATURES = {
    "banking": ['CreditScore', 'Age', 'Tenure', 'Balance', 'NumOfProducts', 'HasCrCard',
                'IsActiveMember', 'EstimatedSalary',
                'Geography_Germany', 'Geography_Spain',  # 'France' dropped
                'Gender_Male'  # 'Female' dropped
    ],
    "telecom": ['account_length', 'international_plan', 'voice_mail_plan', 'number_vmail_messages',
                'total_day_minutes', 'total_day_calls', 'total_day_charge', 'total_eve_minutes',
                'total_eve_calls', 'total_eve_charge', 'total_night_minutes', 'total_night_calls',
                'total_night_charge', 'total_intl_minutes', 'total_intl_calls', 'total_intl_charge',
                'customer_service_calls',
                'area_code_415', 'area_code_510'  # Assuming 408 dropped
    ]
}

GEMINI_MODEL_NAME = 'gemini-2.0-flash'
if GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        gemini_model = genai.GenerativeModel(GEMINI_MODEL_NAME) # Use the variable
        logging.info(f"Attempting to configure Gemini with model: {GEMINI_MODEL_NAME}")
    except Exception as e:
        logging.error(f"Error configuring Gemini with model '{GEMINI_MODEL_NAME}': {e}")
        logging.error(traceback.format_exc())
        gemini_model = None
else:
    logging.warning("Gemini model not configured due to missing API key.")

# --- Configure MongoDB ---
mongo_client = None
db = None
analysis_collection = None # Collection for analysis logs
csv_data_collection = None # << NEW Collection to store CSV data >>
if MONGODB_URI:
    try:
        mongo_client = pymongo.MongoClient(MONGODB_URI, serverSelectionTimeoutMS=10000)
        mongo_client.admin.command('ping')
        db = mongo_client.churn_analysis_db # Database name
        analysis_collection = db.custom_analyses # Collection for analysis logs/metadata
        csv_data_collection = db.csv_data # << NEW Collection for raw data >>
        logging.info("MongoDB connected successfully.")
    except Exception as e:
        logging.error(f"Error connecting to MongoDB: {e}")
else:
    logging.warning("MongoDB not configured due to missing URI.")


# --- Model Loading ---
MODEL_PATH = "models"
MODEL_FILES = {
    "banking": "banking_churn_model.joblib",
    "telecom": "telecom_random_forest_churn_model.joblib",
    "saas": "saas_random_forest_churn_model.joblib"
}
MODELS = {}
logging.info("--- Loading Models ---")
for sector, filename in MODEL_FILES.items():
    path = os.path.join(MODEL_PATH, filename)
    if os.path.exists(path):
        try:
            MODELS[sector] = joblib.load(path)
            logging.info(f"Loaded model for sector '{sector}' from {path}")
        except Exception as e:
            logging.error(f"ERROR: Could not load model for sector '{sector}' from {path}. Error: {e}")
            logging.error(traceback.format_exc())
    else:
        logging.error(f"ERROR: Model file not found for sector '{sector}' at {path}.")
logging.info("---------------------")

# --- Feature Definitions (Frontend expects these names) ---
FRONTEND_FEATURES = {
    "banking": ["CreditScore", "Geography", "Gender", "Age", "Tenure", "Balance", "NumOfProducts", "HasCrCard", "IsActiveMember", "EstimatedSalary"],
    "telecom": ["state", "account_length", "area_code", "international_plan", "voice_mail_plan", "number_vmail_messages", "total_day_minutes", "total_day_calls", "total_day_charge", "total_eve_minutes", "total_eve_calls", "total_eve_charge", "total_night_minutes", "total_night_calls", "total_night_charge", "total_intl_minutes", "total_intl_calls", "total_intl_charge", "customer_service_calls"],
    "saas": ["subscription_plan", "account_age_months", "monthly_active_users", "feature_usage_score", "monthly_bill", "late_payments", "support_tickets", "avg_ticket_resolution_time"]
}

# --- Helper Function for Preprocessing (Manual) ---
def preprocess_input(data, sector):
    """
    Converts frontend form data into a DataFrame structured for the model,
    reflecting drop_first=True logic.
    """
    logging.info(f"--- Starting preprocessing for sector: {sector} ---")
    if sector not in FRONTEND_FEATURES or sector not in MODEL_FEATURES:
        logging.error(f"Sector '{sector}' not configured in FRONTEND_FEATURES or MODEL_FEATURES.")
        raise ValueError(f"Sector '{sector}' not configured for preprocessing.")
    frontend_feature_list = FRONTEND_FEATURES[sector]
    model_feature_list = MODEL_FEATURES[sector]
    processed_data = {col: 0 for col in model_feature_list}
    logging.debug(f"Initialized processed_data with keys: {list(processed_data.keys())}")
    for feature in frontend_feature_list:
        if feature not in data:
            logging.error(f"Missing input feature: '{feature}' for sector '{sector}'")
            raise ValueError(f"Missing required input feature: '{feature}'")
        value = data[feature]
        logging.debug(f"Processing feature: '{feature}', Raw value: '{value}' (Type: {type(value)})")
        if value is None or value == '':
            logging.warning(f"Feature '{feature}' has empty value. Using default (0 or base category).")
            continue
        try:
            if sector == "banking":
                if feature == "Geography":
                    value_str = str(value).strip()
                    if value_str != 'France':
                        encoded_col = f"Geography_{value_str}"
                        if encoded_col in processed_data:
                            processed_data[encoded_col] = 1
                            logging.debug(f"  Set {encoded_col} = 1")
                        else:
                            logging.warning(f"Geography value '{value_str}' generated unexpected column '{encoded_col}'.")
                elif feature == "Gender":
                    value_str = str(value).strip()
                    if value_str == 'Male':
                        if "Gender_Male" in processed_data:
                            processed_data["Gender_Male"] = 1
                            logging.debug(f"  Set Gender_Male = 1")
                elif feature in ['HasCrCard', 'IsActiveMember']:
                    processed_data[feature] = int(value)
                    logging.debug(f"  Set binary {feature} = {processed_data[feature]}")
                elif feature in model_feature_list:
                    processed_data[feature] = float(value)
                    logging.debug(f"  Set numerical {feature} = {processed_data[feature]}")
            elif sector == "telecom":
                if feature == "state":
                    value_str = str(value).strip().upper()
                    if value_str != 'AK':
                        encoded_col = f"state_{value_str}"
                        if encoded_col in processed_data:
                            processed_data[encoded_col] = 1
                elif feature == "area_code":
                    value_str = str(value).strip()
                    if value_str != '408':
                        encoded_col = f"area_code_{value_str}"
                        if encoded_col in processed_data:
                            processed_data[encoded_col] = 1
                elif feature in ['international_plan', 'voice_mail_plan']:
                    processed_data[feature] = 1 if str(value).strip().lower() == 'yes' else 0
                elif feature in model_feature_list:
                    processed_data[feature] = float(value)
            elif sector == "saas":
                if feature == "subscription_plan":
                    value_str = str(value).strip()
                    if value_str != 'Basic':
                        encoded_col = f"subscription_plan_{value_str}"
                        if encoded_col in processed_data:
                            processed_data[encoded_col] = 1
                elif feature in model_feature_list:
                    processed_data[feature] = float(value)
            else:
                logging.warning(f"Unhandled feature '{feature}'.")
        except (ValueError, TypeError) as conv_e:
            logging.error(f"Conversion error: {conv_e}")
            raise ValueError(f"Invalid value '{value}' for feature '{feature}'.")
    try:
        input_df = pd.DataFrame([processed_data])
        input_df = input_df.reindex(columns=model_feature_list, fill_value=0)
        logging.debug(f"DF shape: {input_df.shape}")
        logging.debug(f"DF columns: {input_df.columns.tolist()}")
        if input_df.isnull().values.any():
            logging.warning("NaNs detected! Filling with 0.")
            input_df.fillna(0, inplace=True)
    except Exception as df_e:
        logging.error(f"Error creating/reindexing DataFrame: {df_e}")
        logging.error(f"Processed data was: {processed_data}")
        logging.error(f"Model features expected: {model_feature_list}")
        raise ValueError("Internal error creating feature DataFrame for model.")
    logging.info(f"--- Preprocessing completed for sector: {sector} ---")
    return input_df

# --- Flask Routes ---

@app.route('/')
def home():
    """Serves the main HTML page."""
    logging.info("Serving index.html")
    return render_template("index.html")

@app.route('/predict', methods=['POST'])
def predict():
    """Handles prediction requests for a single customer."""
    endpoint = "/predict"
    logging.info(f"--- Received request at {endpoint} ---")
    if not request.is_json:
        logging.error(f"{endpoint} - Request is not JSON")
        return jsonify({"error": "Request must be JSON"}), 415
    data = request.json
    sector = data.get("sector")
    if not sector:
        logging.error(f"{endpoint} - Sector not provided")
        return jsonify({"error": "Sector not provided"}), 400
    sector = sector.lower()
    if sector not in MODELS:
        logging.error(f"{endpoint} - Sector '{sector}' model not loaded or invalid")
        if sector in MODEL_FILES:
            error_msg = f"Model for sector '{sector}' failed load"
            status_code = 500
        else:
            error_msg = f"Invalid sector '{sector}'"
            status_code = 400
        return jsonify({"error": error_msg}), status_code
    logging.info(f"{endpoint} - Processing for sector: {sector}")
    logging.debug(f"{endpoint} - Data: {data}")
    try:
        input_df = preprocess_input(data, sector)
        logging.info(f"{endpoint} - Preprocessing complete.")
        model = MODELS[sector]
        logging.info(f"{endpoint} - Predicting...")
        prediction = model.predict(input_df)
        probability = model.predict_proba(input_df)
        logging.info(f"{endpoint} - Prediction successful.")
        pred_int = int(prediction[0])
        prob_float = float(probability[0][1])
        response_data = {
            "prediction": pred_int,
            "churn_label": "Churn" if pred_int == 1 else "No Churn",
            "probability_churn": round(prob_float, 4)
        }
        logging.info(f"{endpoint} - Sending response: {response_data}")
        if analysis_collection is not None:
            try:
                log_entry = {
                    "request_type": "predict",
                    "sector": sector,
                    "timestamp": datetime.datetime.now(datetime.timezone.utc),
                    "status": "success",
                    "prediction": pred_int,
                    "probability": prob_float,
                    "request_data": data
                }
                analysis_collection.insert_one(log_entry)
            except Exception as db_log_e:
                logging.warning(f"Failed to log successful prediction to MongoDB: {db_log_e}")
        return jsonify(response_data)
    except ValueError as ve:
        logging.error(f"{endpoint} - Value Error: {ve}")
        logging.error(traceback.format_exc())
        return jsonify({"error": f"Input Error: {str(ve)}"}), 400
    except Exception as e:
        logging.error(f"{endpoint} - Unexpected Error: {e}")
        logging.error(traceback.format_exc())
        if analysis_collection is not None:
            try:
                log_entry = {
                    "request_type": "predict",
                    "sector": sector,
                    "timestamp": datetime.datetime.now(datetime.timezone.utc),
                    "status": "error",
                    "error_message": str(e),
                    "traceback": traceback.format_exc(),
                    "request_data": data
                }
                analysis_collection.insert_one(log_entry)
            except Exception as db_err_log:
                logging.warning(f"Failed to log prediction error to MongoDB: {db_err_log}")
        return jsonify({"error": "Internal server error during prediction."}), 500


@app.route('/upload', methods=['POST'])
def upload_file():
    """Handles CSV file upload and analysis using Gemini (based on column names)."""
    endpoint = "/upload"
    logging.info(f"--- Received request at {endpoint} ---")

    if 'file' not in request.files:
        logging.error(f"{endpoint} - 'file' part not in request.files")
        return jsonify({"error": "No file part in the request"}), 400
    file = request.files['file']
    if not file or file.filename == '':
        logging.error(f"{endpoint} - No file selected or filename is empty.")
        return jsonify({"error": "No file selected"}), 400
    if not file.filename.lower().endswith('.csv'):
        logging.error(f"{endpoint} - Invalid file type: {file.filename}")
        return jsonify({"error": "Invalid file type. Please upload a CSV file."}), 400
    if not gemini_model:
        logging.error(f"{endpoint} - Gemini AI model is not available.")
        return jsonify({"error": "AI analysis service is currently unavailable."}), 503

    filename = secure_filename(file.filename)
    logging.info(f"{endpoint} - Processing uploaded file: {filename}")

    try:
        logging.info(f"{endpoint} - Reading CSV data from stream...")
        try:
            csv_data = StringIO(file.stream.read().decode("utf-8"))
            df = pd.read_csv(csv_data)
        except UnicodeDecodeError:
            logging.error(f"{endpoint} - CSV '{filename}' Not UTF-8?")
            return jsonify({"error": "CSV must be UTF-8 encoded."}), 400
        except pd.errors.EmptyDataError:
            logging.error(f"{endpoint} - Uploaded CSV file '{filename}' is empty.")
            return jsonify({"error": "CSV file is empty."}), 400
        except Exception as read_e:
            logging.error(f"{endpoint} - Error reading CSV file '{filename}'. Error: {read_e}")
            logging.error(traceback.format_exc())
            return jsonify({"error": f"Could not read CSV file. Ensure it's valid CSV format. Error: {read_e}"}), 400

        logging.info(f"{endpoint} - CSV read successfully. Shape: {df.shape}")
        if df.empty:
            logging.error(f"{endpoint} - Uploaded CSV file '{filename}' is empty after reading.")
            return jsonify({"error": "Uploaded CSV file is empty."}), 400

        column_names = ", ".join(df.columns.tolist())
        num_rows = len(df)
        logging.info(f"{endpoint} - Preparing prompt for Gemini based on columns: {column_names}")
        prompt = f"""
        Act as an expert data analyst specializing in customer churn prediction.
        I have uploaded a CSV file named '{filename}' with {num_rows} rows and the following column headers: {column_names}.

        Based *only* on these column names and general business knowledge about typical churn factors associated with such features, please perform the following analysis:

        1.  **Potential Key Churn Drivers:** Identify which of these columns are *likely* key indicators or drivers of customer churn in a typical business context relevant to these features. Briefly explain why for each identified driver (e.g., 'high customer_service_calls often indicates dissatisfaction').
        2.  **Actionable Preventive Measures:** Suggest 3-5 concrete, actionable preventive strategies a business could implement, specifically targeting the potential drivers identified above. Make the suggestions practical (e.g., 'For high total_day_minutes, offer loyalty discounts or investigate plan suitability' rather than just 'improve service').

        Structure your response clearly with the following headings (use Markdown):
        ### Potential Key Churn Drivers (Based on Column Names)
        *(List drivers and brief explanations here)*

        ### Actionable Preventive Measures
        *(List suggested measures here)*

        Keep the analysis concise and focused on providing practical insights derivable from the column names provided. Do not attempt to analyze the actual data values within the file.
        """

        logging.info(f"{endpoint} - Sending prompt to Gemini model '{GEMINI_MODEL_NAME}'...")
        try:
            response = gemini_model.generate_content(prompt)
            if not response.text:
                logging.error(f"{endpoint} - Gemini API returned an empty response.")
                raise ValueError("AI model returned empty analysis.")
            analysis_result = response.text
            logging.info(f"{endpoint} - Received analysis from Gemini.")
        except Exception as gen_e:
            logging.error(f"{endpoint} - Error calling Gemini API: {gen_e}")
            logging.error(traceback.format_exc())
            if analysis_collection is not None:
                try:
                    log_entry = {
                        "filename": filename,
                        "upload_timestamp": datetime.datetime.now(datetime.timezone.utc),
                        "status": "error",
                        "error_source": "gemini_api",
                        "error_message": str(gen_e),
                        "traceback": traceback.format_exc()
                    }
                    analysis_collection.insert_one(log_entry)
                except Exception as db_err_log:
                    logging.warning(f"Failed to log Gemini API error to MongoDB: {db_err_log}")
            return jsonify({"error": f"Failed to get analysis from AI model. Error: {gen_e}"}), 500

        if analysis_collection is not None:
            logging.info(f"{endpoint} - Attempting to log analysis to MongoDB...")
            try:
                log_entry = {
                    "filename": filename,
                    "upload_timestamp": datetime.datetime.now(datetime.timezone.utc),
                    "column_headers": df.columns.tolist(),
                    "num_rows": num_rows,
                    "gemini_analysis": analysis_result,
                    "status": "success"
                }
                analysis_collection.insert_one(log_entry)
                logging.info(f"{endpoint} - Analysis successfully logged to MongoDB.")
            except Exception as db_e:
                logging.warning(f"{endpoint} - Failed to log successful analysis to MongoDB. Error: {db_e}")
        else:
            logging.info(f"{endpoint} - MongoDB logging skipped (client not configured).")

        response_data = {
            "message": f"File '{filename}' analyzed successfully using AI.",
            "analysis_result": analysis_result
        }
        logging.info(f"{endpoint} - Sending successful analysis response.")
        return jsonify(response_data)

    except Exception as e:
        logging.error(f"{endpoint} - An unexpected error occurred during file upload/analysis for '{filename}': {e}")
        logging.error(traceback.format_exc())
        if analysis_collection is not None:
            try:
                log_entry = {
                    "filename": filename,
                    "upload_timestamp": datetime.datetime.now(datetime.timezone.utc),
                    "status": "error",
                    "error_source": "upload_processing",
                    "error_message": str(e),
                    "traceback": traceback.format_exc()
                }
                analysis_collection.insert_one(log_entry)
                logging.info(f"{endpoint} - Upload processing error logged to MongoDB.")
            except Exception as db_log_e:
                logging.warning(f"{endpoint} - Failed to log upload processing error to MongoDB: {db_log_e}")
        return jsonify({"error": "An internal server error occurred during file processing."}), 500

# --- Main Execution ---
if __name__ == '__main__':
    if not os.path.exists(MODEL_PATH):
        os.makedirs(MODEL_PATH)
        logging.warning(f"Created models directory: {MODEL_PATH}")
        logging.warning(f"Place models here.")
    if mongo_client is not None:
        try:
            mongo_client.admin.command('ping')
            logging.info("MongoDB connection confirmed before server start.")
        except Exception as e:
            logging.warning(f"MongoDB connection check failed before server start. Error: {e}")
    logging.info("Starting Flask application...")
    app.run(debug=True, host='0.0.0.0', port=5000) # Set debug=False for production