import base64
import io
import numpy as np
from PIL import Image
from typing import Tuple, Optional
from pathlib import Path
from core.constants import WasteType, FitStatus
import logging
import os
import requests
import warnings
import pandas as pd
import joblib

# Suppress all warnings before importing TensorFlow
warnings.filterwarnings('ignore')

# Suppress protobuf warnings specifically
import warnings
warnings.filterwarnings('ignore', message='.*protobuf.*')
warnings.filterwarnings('ignore', category=UserWarning, module='google.protobuf')

os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'  
import tensorflow as tf
tf.get_logger().setLevel('ERROR') 

from tensorflow.keras.models import load_model
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
            
            self.model = load_model(model_path_str)
            self.model_loaded = True
            print("CNN model loaded successfully")
            logger.info("CNN model loaded successfully")

            # Load text model with separate error handling
            text_model_path = model_dir / "model_text.keras"
            text_model_path_str = str(text_model_path.resolve())
            print(f"Loading text model from: {text_model_path_str}")
            self.text_model = load_model(text_model_path_str)
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
            
            try:
                input_shape = self.model.input_shape
                self.input_size = (input_shape[1], input_shape[2]) if input_shape else (224, 224)
            except:
                self.input_size = (224, 224)  
                
        except Exception as e:
            print(f"❌ Error loading model: {str(e)}")
            logger.error(f"Error loading model: {str(e)}")
            self.model = None
            self.model_loaded = False
            self.text_model = None
            self.text_model_loaded = False
            self.text_embedder = None
            self.text_embedder_loaded = False
            self.class_mapping = {}
            self.input_size = (224, 224)
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
    
    async def classify_from_text(self, description: str) -> Tuple[WasteType, float]:
            
        if not self.text_model_loaded or self.text_model is None:
            logger.warning("Text model not loaded, falling back to default classification")
            return WasteType.OTHER, 0.5
        
        if not self.text_embedder_loaded or self.text_embedder is None:
            logger.warning("Text embedder not loaded, falling back to default classification")
            return WasteType.OTHER, 0.5
        
        try:
            # processed_text = self._preprocess_text(description)
           
            embedding = self.text_embedder([description]).numpy()
            
            print(f"Embedding shape: {embedding.shape}")
            # Get prediction from model
            predictions = self.text_model.predict(embedding, verbose=0)
            
            # Log all class probabilities
            logger.info("All class probabilities (text):")
            for idx in range(len(predictions[0])):
                prob = float(predictions[0][idx])
                waste_type = self.text_class_mapping.get(idx, None)
                waste_type_str = waste_type.value if waste_type else "UNKNOWN"
                logger.info(f"  Class {idx:2d} ({waste_type_str:15s}): {prob:.6f} ({prob*100:.2f}%)")
            
            # Get predicted class
            predicted_class_idx = np.argmax(predictions[0])
            confidence = float(predictions[0][predicted_class_idx])
            waste_type = self.text_class_mapping.get(predicted_class_idx, WasteType.OTHER)
            
            logger.info(f"Predicted class index: {predicted_class_idx}, Waste type: {waste_type}, Confidence: {confidence:.2f}")
            
            return waste_type, confidence
                
        except Exception as e:
            logger.error(f"Error processing text with model: {str(e)}")
            return WasteType.OTHER, 0.5

    async def volume_from_distance(self, distance: float) -> float:

        width = 20
        length = 20

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
    async def generate_tips(self, waste_type: WasteType, user_id: Optional[str] = None) -> list:
       
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
        
        tips = self._generate_tips_from_technique(waste_type, technique, profile_data)
        
        return tips

    def get_technique(self, waste_type: WasteType, profile_data: dict) -> str:
        try:
            # Parse household_size - keep as int since training data had it as int
            household_size_str = str(profile_data['household_size']).replace('+', '')
            household_size = int(household_size_str) if household_size_str.isdigit() else 3
            
            # Build input DataFrame - use plain Python types, not pd.Categorical
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
            
            # Convert to numpy array of objects to avoid dtype issues with sklearn
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


    def _generate_tips_from_technique(self, waste_type: WasteType, technique: str, profile_data: dict) -> list:
        """Generate tips based on predicted technique and user profile."""
        tips = []
        
        # Tips based on technique
        if technique == "recycle":
            tips.append("Clean and dry the item before recycling")
            tips.append("Remove any non-recyclable parts (caps, labels)")
            if not profile_data.get("has_recycling_bin"):
                tips.append("Consider getting a recycling bin for easier sorting")
        
        elif technique == "reuse":
            tips.append("Consider repurposing this item for another use")
            tips.append("Check if local organizations accept donations")
            tips.append("Get creative - many items can have a second life")
        
        elif technique == "upcycle":
            tips.append("Transform this item into something of higher value")
            tips.append("Search online for DIY upcycling ideas")
            tips.append("Consider selling upcycled items at local markets")
        
        elif technique == "compost":
            tips.append("Break down large pieces for faster composting")
            if profile_data.get("has_compost_bin"):
                tips.append("Add to your compost bin - great for garden nutrients!")
            else:
                tips.append("Consider starting a compost bin to reduce waste")
        
        else:
            tips.append("Dispose in the appropriate bin")
            tips.append("Check local guidelines for proper disposal")
        
        # Add personalized tips based on profile
        if profile_data.get("has_weekly_collection"):
            tips.append("Put out for your weekly collection")
        
        return tips