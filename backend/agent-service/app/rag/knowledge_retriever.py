from typing import List, Dict, Any

class AgriKnowledgeRetriever:
    """
    Mock retriever or ChromaDB/Vector store retriever for agricultural guidelines.
    """
    def __init__(self):
        # Initial agricultural knowledge dictionary
        self.mock_kb = {
            "Tomato___Early_blight": {
                "vietnamese_name": "Bệnh đốm vòng cà chua (Alternaria solani)",
                "symptoms": "Đốm nâu đen có các vòng đồng tâm trên lá già, lá chuyển vàng và rụng sớm.",
                "organic_treatment": "Tỉa bỏ lá sát mặt đất, phun chế phẩm nấm đối kháng Trichoderma.",
                "chemical_treatment": "Hoạt chất Mancozeb, Chlorothalonil hoặc Difenoconazole.",
                "phi_days": "7 - 14 ngày tùy hoạt chất."
            },
            "Tomato___Late_blight": {
                "vietnamese_name": "Bệnh mốc sương / sương mai cà chua (Phytophthora infestans)",
                "symptoms": "Vết bệnh úng nước màu xanh xám, mặt dưới lá có lớp mốc trắng mịn khi trời ẩm.",
                "organic_treatment": "Tránh tưới nước lên tán lá, nhổ bỏ cây bệnh nặng tiêu hủy.",
                "chemical_treatment": "Hoạt chất Metalaxyl-M, Cymoxanil hoặc Fosetyl-aluminium.",
                "phi_days": "10 - 14 ngày."
            }
        }

    def search_guideline(self, disease_code: str) -> Dict[str, Any]:
        return self.mock_kb.get(disease_code, {
            "vietnamese_name": "Bệnh hại cây trồng",
            "symptoms": "Quan sát biểu hiện biến màu, đốm lá hoặc rỉ sắt trên phiến lá.",
            "organic_treatment": "Cắt tỉa cành thông thoáng, hạn chế bón thừa đạm.",
            "chemical_treatment": "Sử dụng thuốc bảo vệ thực vật theo danh mục cho phép của Cục BVTV.",
            "phi_days": "Tuân thủ hướng dẫn trên bao bì thuốc."
        })
