import base64
import io
import numpy as np
from PIL import Image
from typing import Tuple, Optional
from pathlib import Path
from core.constants import WasteType, FitStatus
import logging
from tensorflow.keras.models import load_model
import os
import requests

logger = logging.getLogger(__name__)

class WasteClassifier:
    """
    Waste classification service using CNN model for image classification
    and text model for text-based classification.
    Also handles ESP32 sensor integration for bin volume measurement.
    """
    
    def __init__(self):
        try:
            current_dir = Path(__file__).parent  
            model_dir = current_dir.parent / "model"  
            model_path = model_dir / "waste_model_three.keras"
            
            model_path_str = str(model_path.resolve())
            logger.info(f"Loading model from: {model_path_str}")
            
            self.model = load_model(model_path_str)
            self.model_loaded = True
            logger.info("CNN model loaded successfully")

            text_model_path = model_dir / "model_final_text.keras"
            text_model_path_str = str(text_model_path.resolve())
            logger.info(f"Loading text model from: {text_model_path_str}")
            
            self.text_model = load_model(text_model_path_str)
            self.text_model_loaded = True
            logger.info("Text model loaded successfully")
            
            self.class_mapping = {
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
            logger.error(f"Error loading model: {str(e)}")
            self.model = None
            self.model_loaded = False
            self.text_model = None
            self.text_model_loaded = False
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
                waste_type = self.class_mapping.get(idx, None)
                waste_type_str = waste_type.value if waste_type else "UNKNOWN"
                logger.info(f"  Class {idx:2d} ({waste_type_str:15s}): {prob:.6f} ({prob*100:.2f}%)")
            
            predicted_class_idx = np.argmax(predictions[0])
            confidence = float(predictions[0][predicted_class_idx])
            waste_type = self.class_mapping.get(predicted_class_idx, WasteType.OTHER)
            
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
        
        try:
            # Preprocess text
            processed_text = self._preprocess_text(description)
            
            # Get prediction from model
            predictions = self.text_model.predict(processed_text, verbose=0)
            
            # Log all class probabilities
            logger.info("All class probabilities (text):")
            for idx in range(len(predictions[0])):
                prob = float(predictions[0][idx])
                waste_type = self.class_mapping.get(idx, None)
                waste_type_str = waste_type.value if waste_type else "UNKNOWN"
                logger.info(f"  Class {idx:2d} ({waste_type_str:15s}): {prob:.6f} ({prob*100:.2f}%)")
            
            # Get predicted class
            predicted_class_idx = np.argmax(predictions[0])
            confidence = float(predictions[0][predicted_class_idx])
            waste_type = self.class_mapping.get(predicted_class_idx, WasteType.OTHER)
            
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
