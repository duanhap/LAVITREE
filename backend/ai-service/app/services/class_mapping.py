import csv
import logging
from pathlib import Path
from typing import Dict, Any, Optional, List

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
CSV_PATH = BASE_DIR / "models" / "Lavitree_Selected_Classes.csv"

class ClassMappingService:
    def __init__(self, csv_path: Optional[Path] = None):
        self.csv_path = csv_path or CSV_PATH
        self._classes: Dict[str, Dict[str, Any]] = {}
        self._confusion_groups: Dict[str, List[str]] = {}
        self._load_classes()

    def _load_classes(self) -> None:
        if not self.csv_path.exists():
            logger.error("Không tìm thấy tệp danh mục lớp tại %s", self.csv_path)
            return

        with open(self.csv_path, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                field_evidence = (row.get("Field_Evidence") or "").strip()
                # Bỏ qua 2 lớp HANDBOOK_ONLY (Orange___healthy, Squash___healthy)
                if field_evidence == "HANDBOOK_ONLY":
                    continue

                class_code = (row.get("Model_Class") or "").strip()
                if not class_code:
                    continue

                plant_name = (row.get("Ten_Cay_VN") or "").strip()
                disease_name = (row.get("Ten_Benh_VN") or "").strip()
                loai = (row.get("Loai") or "").strip()
                capture_tip = (row.get("Capture_Tip") or "").strip() or None
                confusion_group = (row.get("Confusion_Group") or "").strip() or None

                info = {
                    "class_code": class_code,
                    "plant_name": plant_name,
                    "disease_name": disease_name,
                    "loai": loai,
                    "capture_tip": capture_tip,
                    "confusion_group": confusion_group,
                    "field_evidence": field_evidence,
                }
                self._classes[class_code] = info

                if confusion_group:
                    self._confusion_groups.setdefault(confusion_group, []).append(class_code)

        logger.info(
            "Đã nạp thành công %d lớp nhận diện từ %s (Bỏ qua các lớp HANDBOOK_ONLY)",
            len(self._classes),
            self.csv_path.name,
        )

    def get_class_info(self, class_code: str) -> Optional[Dict[str, Any]]:
        return self._classes.get(class_code)

    def get_confusion_counterparts(self, confusion_group: str, current_class_code: str) -> List[Dict[str, Any]]:
        class_codes = self._confusion_groups.get(confusion_group, [])
        return [
            self._classes[code]
            for code in class_codes
            if code != current_class_code and code in self._classes
        ]

    def format_confusion_warning(self, class_code: str, capture_tip: Optional[str] = None) -> Optional[str]:
        info = self.get_class_info(class_code)
        if not info or not info.get("confusion_group"):
            return capture_tip

        counterparts = self.get_confusion_counterparts(info["confusion_group"], class_code)
        if not counterparts:
            return capture_tip

        counterpart_names = " / ".join(c["disease_name"] for c in counterparts)
        msg = f"Bệnh này dễ nhầm với {counterpart_names}. Xem thêm các khả năng khác bên dưới hoặc nhờ chuyên gia xác nhận."
        tip = capture_tip or info.get("capture_tip")
        if tip:
            return f"{msg} {tip}"
        return msg

    @property
    def total_classes(self) -> int:
        return len(self._classes)

    @property
    def all_classes(self) -> Dict[str, Dict[str, Any]]:
        return self._classes


# Singleton instance
class_mapping_service = ClassMappingService()
