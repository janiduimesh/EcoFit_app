# EcoFit Waste Classification API

FastAPI backend for waste classification and disposal guidance.

## Features

- 🖼️ **Image Classification**: Classify waste from uploaded images
- ✏️ **Text Classification**: Classify waste from text descriptions  
- 📏 **Volume Analysis**: Determine if waste fits in bins
- 💡 **Smart Tips**: Generate disposal guidance and tips
- 🔄 **CORS Enabled**: Ready for mobile app integration

## Quick Start

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Run the Server
```bash
python run.py
```

### 3. Test the API
Visit `http://localhost:8000/docs` for interactive API documentation.

## API Endpoints

### POST `/api/v1/dispose`
Classify waste and get disposal guidance.

**Request Body:**
```json
{
  "image_data": "base64_encoded_image_string",
  "description": "waste description",
  "volume": 500,
  "input_method": "image"
}
```

**Response:**
```json
{
  "waste_type": "plastic",
  "bin_type": "recycling", 
  "fit_status": "fits",
  "confidence": 0.85,
  "tips": ["Remove caps before recycling", "Rinse clean"],
  "message": "Waste classified as plastic"
}
```

### GET `/api/v1/health`
Health check endpoint.

## Project Structure

```
waste-classification/
├── apps/
│   └── api/
│       ├── main.py              # FastAPI app
│       ├── deps.py              # Dependencies
│       ├── routers/             # API routes
│       │   ├── dispose.py       # Waste classification
│       │   └── health.py        # Health check
│       └── schemas/             # Pydantic models
│           └── dispose_schemas.py
├── core/
│   ├── config.py                # Configuration
│   └── constants.py             # Enums and constants
├── services/
│   └── vision/
│       └── classifier.py        # Classification logic
├── requirements.txt
├── run.py                       # Server runner
└── README.md
```

## Mobile App Integration

The API is designed to work with the EcoFit mobile app:

1. **Image Upload**: Send base64 encoded images
2. **Text Input**: Send text descriptions as fallback
3. **Volume Input**: Include waste volume in milliliters
4. **CORS**: Configured for mobile app requests

## Development

### Adding New Waste Types
1. Update `WasteType` enum in `core/constants.py`
2. Add mapping in `WASTE_TO_BIN_MAPPING`
3. Update classification logic in `classifier.py`

### Adding New Tips
Modify the `generate_tips()` function in `routers/dispose.py`.

## Production Deployment

1. Set up environment variables
2. Configure CORS origins for your domain
3. Deploy using Docker or your preferred method
4. Update mobile app API URL

## Next Steps

- [ ] Integrate actual CNN model for image classification
- [ ] Add database for storing classification history
- [ ] Implement user authentication
- [ ] Add more sophisticated text classification
- [ ] Create admin dashboard for model management
