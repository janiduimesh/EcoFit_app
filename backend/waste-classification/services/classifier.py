import base64
import io
import numpy as np
from PIL import Image
from typing import Tuple, Optional
from pathlib import Path
from core.constants import WasteType, FitStatus
from core.config import get_settings
import logging
import os
import requests
import warnings
import pandas as pd
import joblib
from groq import Groq
import numpy as np
import tensorflow as tf
from typing import Tuple

# Suppress all warnings before importing TensorFlow
warnings.filterwarnings('ignore')

# Suppress protobuf warnings specifically
import warnings
warnings.filterwarnings('ignore', message='.*protobuf.*')
warnings.filterwarnings('ignore', category=UserWarning, module='google.protobuf')

os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'  
import tensorflow as tf
tf.get_logger().setLevel('ERROR') 

import tensorflow_hub as hub

logger = logging.getLogger(__name__)

class WasteClassifier:
    
    def __init__(self):
        print(" Initializing WasteClassifier...")
        logger.info("Initializing WasteClassifier...")
        try:
            current_dir = Path(__file__).parent  
            model_dir = current_dir.parent / "model"  
            model_path = model_dir / "waste_model_three.keras"
            
            model_path_str = str(model_path.resolve())
            print(f"Loading CNN model from: {model_path_str}")
            logger.info(f"Loading model from: {model_path_str}")
            
            self.model = tf.keras.models.load_model(model_path_str)
            self.model_loaded = True
            print("CNN model loaded successfully")
            logger.info("CNN model loaded successfully")

            # Load text model with separate error handling
            text_model_path = model_dir / "model_functional_text.keras"
            text_model_path_str = str(text_model_path.resolve())
            print(f"Loading text model from: {text_model_path_str}")
            self.text_model = tf.keras.models.load_model(text_model_path_str)
            self.text_model_loaded = True
            print("Text model loaded successfully")

            self.text_embedder = hub.load(
                "https://tfhub.dev/google/universal-sentence-encoder/4"
            )
            self.text_embedder_loaded = True
            print("Text embedder loaded successfully")

            # Load XGBoost model and encoders for technique prediction
            xgboost_model_path = model_dir / "xgboost_model.pkl"
            encoder_path = model_dir / "technique_encoder.pkl"
            label_encoder_path = model_dir / "technique_label_encoder.pkl"
            categorical_columns_path = model_dir / "technique_feature_columns.pkl"
            
            self.xgboost_model = joblib.load(str(xgboost_model_path))
            self.encoder = joblib.load(str(encoder_path))
            self.label_encoder = joblib.load(str(label_encoder_path))
            self.categorical_columns = joblib.load(str(categorical_columns_path))
            print("XGBoost model and encoders loaded successfully")


            self.text_class_mapping = {
                0: WasteType.CLOTHES,
                1: WasteType.E_WASTE,
                2: WasteType.GLASS,
                3: WasteType.PHARMACEUTICAL,
                4: WasteType.METAL,
                5: WasteType.ORGANIC,
                6: WasteType.PAPER,
                7: WasteType.PLASTIC,
                8: WasteType.UNKNOWN,
            }

            self.image_class_mapping = {
                0: WasteType.BATTERIES,
                1: WasteType.CLOTHES,
                2: WasteType.E_WASTE,
                3: WasteType.GLASS,
                4: WasteType.LIGHT_BULBS,
                5: WasteType.METAL,
                6: WasteType.ORGANIC,
                7: WasteType.OTHER,
                8: WasteType.PAPER,
                9: WasteType.PLASTIC
            }
            
            # ESP32 configuration
            self.esp32_ip = os.getenv("ESP32_IP", "192.168.43.168")
            self.esp32_url = f"http://{self.esp32_ip}/distance"
            self.esp32_timeout = int(os.getenv("ESP32_TIMEOUT", "5"))
            
            # Initialize Groq LLM
            settings = get_settings()
            if settings.llm_key:
                self.llm = Groq(api_key=settings.llm_key)
                print("Groq LLM initialized successfully")
            else:
                self.llm = None
                print("Warning: LLM key not configured")
            
            try:
                input_shape = self.model.input_shape
                self.input_size = (input_shape[1], input_shape[2]) if input_shape else (224, 224)
            except:
                self.input_size = (224, 224)  
                
        except Exception as e:
            import traceback
            print(f"❌ Error loading model: {str(e)}")
            print(f"Full traceback:\n{traceback.format_exc()}")
            logger.error(f"Error loading model: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            
            # Only reset flags if they weren't already set to True
            if not getattr(self, 'model_loaded', False):
                self.model = None
                self.model_loaded = False
            if not getattr(self, 'text_model_loaded', False):
                self.text_model = None
                self.text_model_loaded = False
            if not getattr(self, 'text_embedder_loaded', False):
                self.text_embedder = None
                self.text_embedder_loaded = False
            
            self.class_mapping = {}
            self.input_size = getattr(self, 'input_size', (224, 224))
            # ESP32 configuration (still set even if models fail)
            self.esp32_ip = os.getenv("ESP32_IP", "192.168.43.168")
            self.esp32_url = f"http://{self.esp32_ip}/distance"
            self.esp32_timeout = int(os.getenv("ESP32_TIMEOUT", "5"))
    
    def _preprocess_image(self, pil_image: Image.Image) -> np.ndarray:
   
        if pil_image.mode != 'RGB':
            pil_image = pil_image.convert('RGB')
        
        pil_image = pil_image.resize(self.input_size, Image.Resampling.LANCZOS)
        
        img_array = np.array(pil_image, dtype=np.float32) 
        
        img_array = np.expand_dims(img_array, axis=0)
        
        return img_array

        
    def _preprocess_text(self, description: str) -> np.ndarray:
       
        processed_text = description.lower().strip()
        
        return np.array([processed_text])
        
    
    async def classify_from_image(self, image_data: str) -> Tuple[WasteType, float]:
  
        if not self.model_loaded or self.model is None:
            logger.warning("Model not loaded, falling back to default classification")
            return WasteType.OTHER, 0.5
        
        try:
            image_bytes = base64.b64decode(image_data)
            pil_image = Image.open(io.BytesIO(image_bytes))
            
            processed_image = self._preprocess_image(pil_image)
            
            predictions = self.model.predict(processed_image, verbose=0)
            
            # Log all class probabilities
            logger.info("All class probabilities:")
            for idx in range(len(predictions[0])):
                prob = float(predictions[0][idx])
                waste_type = self.image_class_mapping.get(idx, None)
                waste_type_str = waste_type.value if waste_type else "UNKNOWN"
                # logger.info(f"  Class {idx:2d} ({waste_type_str:15s}): {prob:.6f} ({prob*100:.2f}%)")
            
            predicted_class_idx = np.argmax(predictions[0])
            confidence = float(predictions[0][predicted_class_idx])
            waste_type = self.image_class_mapping.get(predicted_class_idx, WasteType.OTHER)
            
            logger.info(f"Predicted class index: {predicted_class_idx}, Waste type: {waste_type}, Confidence: {confidence:.2f}")
            
            return waste_type, confidence
                
        except Exception as e:
            logger.error(f"Error processing image with CNN: {str(e)}")
            # Return default classification on error
            return WasteType.OTHER, 0.5
    
    # async def classify_from_text(self, description: str) -> Tuple[WasteType, float]:
            
    #     if not self.text_model_loaded or self.text_model is None:
    #         logger.warning("Text model not loaded, falling back to default classification")
    #         return WasteType.OTHER, 0.5
        
    #     if not self.text_embedder_loaded or self.text_embedder is None:
    #         logger.warning("Text embedder not loaded, falling back to default classification")
    #         return WasteType.OTHER, 0.5
        
    #     try:
    #         # processed_text = self._preprocess_text(description)
           
    #         embedding = self.text_embedder([description]).numpy()
            
    #         print(f"Embedding shape: {embedding.shape}")
    #         # Get prediction from model
    #         predictions = self.text_model.predict(embedding, verbose=0)
            
    #         # Log all class probabilities
    #         logger.info("All class probabilities (text):")
    #         for idx in range(len(predictions[0])):
    #             prob = float(predictions[0][idx])
    #             waste_type = self.text_class_mapping.get(idx, None)
    #             waste_type_str = waste_type.value if waste_type else "UNKNOWN"
    #             logger.info(f"  Class {idx:2d} ({waste_type_str:15s}): {prob:.6f} ({prob*100:.2f}%)")
            
    #         # Get predicted class
    #         predicted_class_idx = np.argmax(predictions[0])
    #         confidence = float(predictions[0][predicted_class_idx])
    #         waste_type = self.text_class_mapping.get(predicted_class_idx, WasteType.OTHER)
            
    #         logger.info(f"Predicted class index: {predicted_class_idx}, Waste type: {waste_type}, Confidence: {confidence:.2f}")
            
    #         return waste_type, confidence
                
    #     except Exception as e:
    #         logger.error(f"Error processing text with model: {str(e)}")
    #         return WasteType.OTHER, 0.5


    async def classify_from_text(self, description: str) -> Tuple[WasteType, float]:

        if not self.text_model_loaded or self.text_model is None:
            logger.warning("Text model not loaded, falling back to default classification")
            return WasteType.OTHER, 0.5

        if not self.text_embedder_loaded or self.text_embedder is None:
            logger.warning("Text embedder not loaded, falling back to default classification")
            return WasteType.OTHER, 0.5

        try:
            embedding = self.text_embedder([description]).numpy()
            logger.info(f"Embedding shape: {embedding.shape}")

           
            logits = self.text_model.predict(embedding, verbose=0)  

            T = getattr(self, "text_temperature", 2.0)  
            probs = tf.nn.softmax(logits / T, axis=1).numpy()       

            logger.info("All class probabilities (text):")
            for idx in range(probs.shape[1]):
                prob = float(probs[0][idx])
                waste_type = self.text_class_mapping.get(idx, None)
                waste_type_str = waste_type.value if waste_type else "UNKNOWN"
                logger.info(f"  Class {idx:2d} ({waste_type_str:15s}): {prob:.6f} ({prob*100:.2f}%)")

            p = probs[0]
            top1_idx = int(np.argmax(p))
            top1_prob = float(p[top1_idx])

            top2_prob = float(np.partition(p, -2)[-2])
            margin = top1_prob - top2_prob

            conf_thresh = getattr(self, "text_conf_thresh", 0.60)
            margin_thresh = getattr(self, "text_margin_thresh", 0.15)

            reject = (top1_prob < conf_thresh) or (margin < margin_thresh)

            unknown_idx = getattr(self, "text_unknown_class_idx", None)

            if reject and unknown_idx is not None:
                predicted_class_idx = int(unknown_idx)
                confidence = top1_prob  
            else:
                predicted_class_idx = top1_idx
                confidence = top1_prob

            waste_type = self.text_class_mapping.get(predicted_class_idx, WasteType.OTHER)

            logger.info(
                f"Predicted idx: {predicted_class_idx}, Waste type: {waste_type}, "
                f"conf={confidence:.3f}, margin={margin:.3f}, reject={reject}"
            )

            return waste_type, confidence

        except Exception as e:
            logger.error(f"Error processing text with model: {str(e)}")
            return WasteType.OTHER, 0.5


    async def volume_from_distance(self, distance: float) -> float:

        width = 74
        length = 85

        return distance * width * length

    async def get_bin_volume_from_sensor(self) -> Tuple[Optional[float], Optional[float]]:
       
        try:
            r = requests.get(self.esp32_url, timeout=self.esp32_timeout)
            r.raise_for_status()
            data = r.json()
            distance_cm = data.get("distance_cm")
            
            if distance_cm is None:
                logger.warning("ESP32 sensor returned None for distance_cm")
                return None, None
            
            bin_volume = await self.volume_from_distance(distance_cm)
            return bin_volume, distance_cm
            
        except requests.exceptions.Timeout:
            logger.warning(f"ESP32 connection timeout: {self.esp32_ip}")
            return None, None
        except requests.exceptions.ConnectionError as e:
            logger.warning(f"ESP32 connection error: {self.esp32_ip} - {str(e)}")
            return None, None
        except requests.exceptions.HTTPError as e:
            logger.warning(f"ESP32 HTTP error: {str(e)}")
            return None, None
        except Exception as e:
            logger.warning(f"Could not get distance from sensor: {str(e)}")
            return None, None

    async def check_bin_fit(self, waste_volume: float, bin_volume: float) -> FitStatus:
       
        if waste_volume <= bin_volume:
            return FitStatus.FITS
        elif waste_volume <= bin_volume * 1.1:
            return FitStatus.PARTIAL_FIT
        else:
            return FitStatus.DOES_NOT_FIT
    async def generate_tips(self, waste_type: WasteType, user_id: Optional[str] = None) -> Tuple[Optional[dict], str]:
        """
        Generate personalized tip based on waste type and user profile.
        Returns tuple of (tip_data, technique)
        """
        # Get user profile if user_id is provided
        user_profile = None
        if user_id:
            try:
                from services.User_service import get_user_by_id
                user_profile = await get_user_by_id(user_id)
                if user_profile:
                    logger.info(f"Fetched user profile for tips generation: {user_id}")
                else:
                    logger.warning(f"User profile not found for user_id: {user_id}")
            except Exception as e:
                logger.error(f"Error fetching user profile: {str(e)}")
        
        profile_data = {
            "has_compost_bin": user_profile.get("has_compost_bin", False) if user_profile else False,
            "has_recycling_bin": user_profile.get("has_recycling_bin", False) if user_profile else False,
            "has_weekly_collection": user_profile.get("has_weekly_collection", False) if user_profile else False,
            "household_size": user_profile.get("household_size", "1") if user_profile else "1",
            "residence_type": user_profile.get("residence_type", "House") if user_profile else "House",
            "waste_amount": user_profile.get("waste_amount", "medium") if user_profile else "medium",
        }
        
        logger.info(f"Profile data for tip generation: {profile_data}")
        
        technique = self.get_technique(waste_type, profile_data)
        
        tip_data = await self._get_random_tip_from_db(waste_type, technique)

        tip_workflow = self.get_tip_from_llm(waste_type, technique, tip_data)
        
        return tip_data, technique, tip_workflow

    def get_technique(self, waste_type: WasteType, profile_data: dict) -> str:
        try:
            household_size_str = str(profile_data['household_size']).replace('+', '')
            household_size = int(household_size_str) if household_size_str.isdigit() else 3
            
            input_data = pd.DataFrame({
                'waste_type': [str(waste_type.value)],
                'living_type': [str(profile_data['residence_type']).lower()],
                'has_recycle_bin': ["Yes" if profile_data['has_recycling_bin'] else "No"],
                'has_compost_bin': ["Yes" if profile_data['has_compost_bin'] else "No"],
                'has_weekly_collection': ["Yes" if profile_data['has_weekly_collection'] else "No"],
                'household_size': [household_size],
                'waste_volume_per_week': [str(profile_data['waste_amount']).lower()]
            })
            
            logger.info(f"Categorical columns expected: {self.categorical_columns}")
            logger.info(f"Input data values: {input_data.iloc[0].to_dict()}")
            
            X_raw = input_data[self.categorical_columns]
            
            X_raw_values = X_raw.astype(str).values

            X_encoded = self.encoder.transform(X_raw_values)

            y_pred_int = self.xgboost_model.predict(X_encoded)
            
            predicted_label = self.label_encoder.inverse_transform(y_pred_int)[0]
            
            logger.info(f"Predicted technique: {predicted_label}")
            print(f"Predicted technique: {predicted_label}")
            return predicted_label
            
        except Exception as e:
            logger.error(f"Error in get_technique: {str(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            # Return default technique on error
            return "recycle"


    async def _get_random_tip_from_db(self, waste_type: WasteType, technique: str) -> Optional[dict]:
        """
        Fetch a random tip from database based on waste type and technique.
        Returns tip data with tip_id, title, and description.
        """
        try:
            from core.database import get_database
            db = get_database()
            tips_collection = db["tips"]
            
            # Query for matching tip with random selection using aggregation
            pipeline = [
                {"$match": {"waste_type": waste_type.value, "technique": technique}},
                {"$sample": {"size": 1}}
            ]
            
            cursor = tips_collection.aggregate(pipeline)
            tip_docs = await cursor.to_list(length=1)
            
            if tip_docs:
                tip_doc = tip_docs[0]
                logger.info(f"Found tip: {tip_doc['_id']} for waste_type={waste_type.value}, technique={technique}")
                return {
                    "tip_id": tip_doc["_id"],
                    "title": tip_doc.get("title", ""),
                    "description": tip_doc.get("description", "")
                }
            
            logger.warning(f"No tip found for waste_type={waste_type.value}, technique={technique}")
            return None
            
        except Exception as e:
            logger.error(f"Error fetching tip from database: {str(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return None

    def get_tip_from_llm(self, waste_type: WasteType, technique: str, tip_data: dict) -> Optional[str]:
        if not self.llm:
            logger.warning("LLM not configured, skipping workflow generation")
            return None
        try:
            prompt = (
                f"Generate brief workflow steps for disposing {waste_type.value} waste using {technique} technique.\n"
                f"Tip: {tip_data['title']} - {tip_data['description']}\n\n"
                f"Rules:\n"
                f"- Give only the steps to the user for the specific description of the tip.\n"
                f"- Output ONLY numbered steps (1. 2. 3. etc)\n"
                f"- Keep each step brief (sentences or brief paragraphs)\n"
                f"- Maximum 5 steps\n"
                f"- No introductions, headers, or extra text\n"
                f"- Start directly with step 1"
            )
            response = self.llm.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[
                    {"role": "system", "content": "You are a waste management expert. Give only brief numbered steps, nothing else."},
                    {"role": "user", "content": prompt}
                ]
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"Error generating tip from LLM: {str(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return None