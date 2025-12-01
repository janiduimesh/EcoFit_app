from enum import Enum

class WasteType(str, Enum):
    PLASTIC = "plastic"
    PAPER = "paper"
    GLASS = "glass"
    METAL = "metal"
    ORGANIC = "organic"
    ELECTRONIC = "electronic"
    HAZARDOUS = "hazardous"
    OTHER = "other"
    BATTERIES = "batteries"
    CLOTHES = "clothes"
    E_WASTE = "e_waste"
    LIGHT_BULBS = "light_bulbs"
    UNKNOWN = "unknown"
    PHARMACEUTICAL = "pharmaceutical"
    RESIDUAL = "residual"

class BinCategory(str, Enum):
    RECYCLING = "blue_bin"
    GENERAL = "yellow_bin"
    ORGANIC = "green_bin"
    HAZARDOUS = "black_bin"
    ELECTRONIC = "red_bin"

class FitStatus(str, Enum):
    FITS = "fits"
    DOES_NOT_FIT = "does_not_fit"
    PARTIAL_FIT = "partial_fit"

# Waste type to bin mapping
WASTE_TO_BIN_MAPPING = {
    WasteType.PLASTIC: BinCategory.RECYCLING,
    WasteType.PAPER: BinCategory.RECYCLING,
    WasteType.GLASS: BinCategory.RECYCLING,
    WasteType.METAL: BinCategory.RECYCLING,
    WasteType.ORGANIC: BinCategory.ORGANIC,
    WasteType.ELECTRONIC: BinCategory.ELECTRONIC,
    WasteType.HAZARDOUS: BinCategory.HAZARDOUS,
    WasteType.OTHER: BinCategory.GENERAL,
    WasteType.BATTERIES: BinCategory.HAZARDOUS,
    WasteType.CLOTHES: BinCategory.GENERAL,
    WasteType.E_WASTE: BinCategory.ELECTRONIC,
    WasteType.LIGHT_BULBS: BinCategory.HAZARDOUS,
    WasteType.UNKNOWN: BinCategory.GENERAL,
    WasteType.PHARMACEUTICAL: BinCategory.HAZARDOUS,
    WasteType.RESIDUAL: BinCategory.GENERAL,
}

# Volume thresholds for fit status (in ml)
VOLUME_THRESHOLDS = {
    BinCategory.RECYCLING: 1000,  # 1L
    BinCategory.GENERAL: 2000,    # 2L
    BinCategory.ORGANIC: 1500,    # 1.5L
    BinCategory.HAZARDOUS: 500,   # 0.5L
    BinCategory.ELECTRONIC: 2000, # 2L
}
