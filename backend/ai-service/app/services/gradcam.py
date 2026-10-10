import io
import base64
import torch
import torch.nn.functional as F
import numpy as np
from PIL import Image
import cv2

class GradCAM:
    def __init__(self, model, target_layer):
        self.model = model
        self.target_layer = target_layer
        self.gradients = None
        self.activations = None
        self._register_hooks()

    def _register_hooks(self):
        def forward_hook(module, input, output):
            self.activations = output

        def backward_hook(module, grad_in, grad_out):
            self.gradients = grad_out[0]

        self.target_layer.register_forward_hook(forward_hook)
        self.target_layer.register_full_backward_hook(backward_hook)

    def generate_heatmap(self, input_tensor, target_class=None):
        self.model.eval()
        self.model.zero_grad()

        output = self.model(input_tensor)
        if target_class is None:
            target_class = torch.argmax(output, dim=1).item()

        score = output[0, target_class]
        score.backward(retain_graph=True)

        gradients = self.gradients[0].cpu().data.numpy()      # [C, H, W]
        activations = self.activations[0].cpu().data.numpy()  # [C, H, W]

        weights = np.mean(gradients, axis=(1, 2))              # [C]
        cam = np.zeros(activations.shape[1:], dtype=np.float32) # [H, W]

        for i, w in enumerate(weights):
            cam += w * activations[i]

        cam = np.maximum(cam, 0) # ReLU
        if np.max(cam) > 0:
            cam = cam / np.max(cam) # Normalize [0, 1]
        else:
            cam = np.zeros_like(cam)

        return cam, target_class

def overlay_gradcam(original_image: Image.Image, cam: np.ndarray, alpha: float = 0.5) -> str:
    """
    Overlays Grad-CAM heatmap on original PIL Image and returns base64 string.
    """
    img_np = np.array(original_image.convert("RGB"))
    h, w, _ = img_np.shape

    # Resize CAM to image size
    cam_resized = cv2.resize(cam, (w, h))
    heatmap = cv2.applyColorMap(np.uint8(255 * cam_resized), cv2.COLORMAP_JET)
    heatmap = cv2.cvtColor(heatmap, cv2.COLOR_BGR2RGB)

    blended = np.uint8(alpha * heatmap + (1 - alpha) * img_np)
    blended_pil = Image.fromarray(blended)

    buffered = io.BytesIO()
    blended_pil.save(buffered, format="JPEG", quality=90)
    return base64.b64encode(buffered.getvalue()).decode("utf-8")
