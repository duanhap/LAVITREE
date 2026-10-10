import json
import io
from pathlib import Path
from typing import Dict, Any, List

import torch
import torch.nn.functional as F
from torchvision import models, transforms
from PIL import Image

from .gradcam import GradCAM, overlay_gradcam

BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_PATH = BASE_DIR / "models" / "best_plant_model.pt"
CLASS_INDICES_PATH = BASE_DIR / "models" / "class_indices.json"

UNCERTAINTY_THRESHOLD = 0.70  # PRD & BRD requirement: warning if confidence < 70%

class PlantPredictor:
    def __init__(self):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self._load_class_mapping()
        self._load_model()
        self._setup_transforms()
        self.grad_cam = GradCAM(self.model, self.model.layer4[-1])

    def _load_class_mapping(self):
        with open(CLASS_INDICES_PATH, "r", encoding="utf-8") as f:
            self.idx_to_class: Dict[str, str] = json.load(f)
        self.num_classes = len(self.idx_to_class)

    def _load_model(self):
        self.model = models.resnet18()
        self.model.fc = torch.nn.Linear(self.model.fc.in_features, self.num_classes)
        self.model.load_state_dict(
            torch.load(MODEL_PATH, map_location=self.device)
        )
        self.model.to(self.device)
        self.model.eval()

    def _setup_transforms(self):
        self.transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]
            ),
        ])

    def predict(self, image_bytes: bytes) -> Dict[str, Any]:
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        tensor = self.transform(image).unsqueeze(0).to(self.device)

        with torch.no_grad():
            outputs = self.model(tensor)
            probabilities = F.softmax(outputs, dim=1)[0]

        top_prob, top_idx = torch.topk(probabilities, k=min(3, self.num_classes))
        
        predicted_idx = top_idx[0].item()
        confidence = float(top_prob[0].item())
        predicted_class = self.idx_to_class.get(str(predicted_idx), "Unknown")

        # Top-3 predictions
        top_predictions = [
            {
                "class_code": self.idx_to_class.get(str(idx.item()), "Unknown"),
                "confidence": round(float(prob.item()), 4)
            }
            for prob, idx in zip(top_prob, top_idx)
        ]

        # Generate Grad-CAM heatmap
        cam, _ = self.grad_cam.generate_heatmap(tensor, target_class=predicted_idx)
        gradcam_base64 = overlay_gradcam(image, cam, alpha=0.45)

        is_uncertain = confidence < UNCERTAINTY_THRESHOLD
        is_healthy = "healthy" in predicted_class.lower()

        return {
            "predicted_class": predicted_class,
            "confidence": round(confidence, 4),
            "is_uncertain": is_uncertain,
            "warning": (
                "Độ tin cậy thấp (< 70%). Ảnh có thể mờ hoặc chụp ngoài phạm vi 38 lớp được hỗ trợ. Khuyên chụp lại cận cảnh vết lá bệnh."
                if is_uncertain else None
            ),
            "is_healthy": is_healthy,
            "top_predictions": top_predictions,
            "gradcam_image_base64": gradcam_base64
        }

# Global singleton predictor instance
predictor = PlantPredictor()
