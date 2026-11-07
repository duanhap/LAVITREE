import inspect
import time
import logging
from typing import Any, Callable, Dict, List, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import ValidationError

from app.mcp.schema import (
    MCPCallRequest,
    MCPCallResponse,
    MCPToolDefinition,
    ToolInputSchema,
    ToolParameterProperty
)
from app.mcp import tools

logger = logging.getLogger("mcp.server")


class MCPServer:
    """
    Model Context Protocol (MCP) Server cho Agent Service.
    Quản lý danh mục 4 công cụ nông nghiệp theo chuẩn MCP / JSON Schema,
    đồng thời xuất định dạng tương thích với Gemini Function Calling cho ReAct Loop (TASK-07).
    Tuân thủ nguyên tắc Read-Only 100%: Tuyệt đối không đăng ký tool ghi dữ liệu.
    """
    def __init__(self):
        self._tools: Dict[str, MCPToolDefinition] = {}
        self._handlers: Dict[str, Callable[..., Any]] = {}
        self._register_default_tools()

    def register_tool(
        self,
        name: str,
        description: str,
        properties: Dict[str, ToolParameterProperty],
        required: List[str],
        handler: Callable[..., Any]
    ) -> None:
        schema = ToolInputSchema(
            type="object",
            properties=properties,
            required=required
        )
        tool_def = MCPToolDefinition(
            name=name,
            description=description,
            inputSchema=schema
        )
        self._tools[name] = tool_def
        self._handlers[name] = handler
        logger.info(f"Registered MCP Tool: {name} (Read-Only)")

    def list_tools(self) -> List[MCPToolDefinition]:
        return list(self._tools.values())

    def get_tool(self, name: str) -> Optional[MCPToolDefinition]:
        return self._tools.get(name)

    def call_tool(self, name: str, arguments: Dict[str, Any]) -> MCPCallResponse:
        """Thực thi một MCP Tool theo tên với đối số đã truyền."""
        if name not in self._handlers:
            return MCPCallResponse(
                tool=name,
                is_error=True,
                result=None,
                error_code="NOT_FOUND",
                error_message=f"MCP Tool '{name}' not found."
            )

        handler = self._handlers[name]
        # LLM có thể thiếu hoặc tự nghĩ ra tham số: đó là input sai, không phải lỗi hệ thống
        try:
            inspect.signature(handler).bind(**arguments)
        except TypeError:
            return MCPCallResponse(
                tool=name,
                is_error=True,
                result=None,
                error_code="INVALID_INPUT",
                error_message="Invalid tool input parameters."
            )

        start_time = time.perf_counter()
        try:
            res = handler(**arguments)
            elapsed_ms = (time.perf_counter() - start_time) * 1000.0
            return MCPCallResponse(
                tool=name,
                is_error=False,
                result=res,
                execution_time_ms=round(elapsed_ms, 2)
            )
        except ValidationError as ve:
            elapsed_ms = (time.perf_counter() - start_time) * 1000.0
            logger.warning(f"Validation error in tool '{name}': {ve}")
            return MCPCallResponse(
                tool=name,
                is_error=True,
                result=None,
                error_code="INVALID_INPUT",
                error_message="Invalid tool input parameters.",
                execution_time_ms=round(elapsed_ms, 2)
            )
        except ConnectionError as ce:
            elapsed_ms = (time.perf_counter() - start_time) * 1000.0
            logger.error(f"Downstream service connection error in tool '{name}': {ce}")
            return MCPCallResponse(
                tool=name,
                is_error=True,
                result=None,
                error_code="UPSTREAM_UNAVAILABLE",
                error_message="Downstream service is currently unavailable.",
                execution_time_ms=round(elapsed_ms, 2)
            )
        except Exception as e:
            elapsed_ms = (time.perf_counter() - start_time) * 1000.0
            logger.error(f"Unexpected error executing MCP Tool '{name}': {e}", exc_info=True)
            return MCPCallResponse(
                tool=name,
                is_error=True,
                result=None,
                error_code="INTERNAL",
                error_message="Internal error while executing tool.",
                execution_time_ms=round(elapsed_ms, 2)
            )

    def to_gemini_declarations(self) -> List[Dict[str, Any]]:
        """
        Chuyển đổi các MCP Tools sang định dạng Gemini Function Declarations
        sẵn sàng nạp trực tiếp vào google-genai Client trong TASK-07.
        """
        declarations = []
        for tool in self._tools.values():
            props = {}
            for prop_name, prop_val in tool.inputSchema.properties.items():
                props[prop_name] = {
                    "type": prop_val.type.upper(),
                    "description": prop_val.description or ""
                }
                if prop_val.enum:
                    props[prop_name]["enum"] = prop_val.enum

            declarations.append({
                "name": tool.name,
                "description": tool.description,
                "parameters": {
                    "type": "OBJECT",
                    "properties": props,
                    "required": tool.inputSchema.required
                }
            })
        return declarations

    def _register_default_tools(self) -> None:
        """Đăng ký 4 công cụ chuẩn Read-Only của Lavitree Agent Service."""
        # Tool 1: lookup_disease_knowledge
        self.register_tool(
            name="lookup_disease_knowledge",
            description=(
                "Tra cứu tài liệu khoa học khuyến nông đã được Kỹ sư/Admin duyệt và cơ chế phát sinh bệnh "
                "theo mã bệnh cây trồng (Ví dụ: 'Tomato___Late_blight'). Hợp nhất Dense Vector và BM25."
            ),
            properties={
                "disease_code": ToolParameterProperty(
                    type="string",
                    description="Mã định danh bệnh học cây trồng (Ví dụ: 'Tomato___Late_blight')."
                ),
                "query_focus": ToolParameterProperty(
                    type="string",
                    description="Từ khóa hoặc trọng tâm câu hỏi cần tìm (Ví dụ: 'biện pháp sinh học', 'triệu chứng lá')."
                ),
                "top_k": ToolParameterProperty(
                    type="integer",
                    description="Số lượng đoạn trích khuyến nông tối đa cần lấy (mặc định 3)."
                )
            },
            required=["disease_code"],
            handler=tools.lookup_disease_knowledge
        )

        # Tool 2: check_weather_risk
        self.register_tool(
            name="check_weather_risk",
            description=(
                "Tra cứu nhiệt độ, độ ẩm và nguy cơ mưa rửa trôi thuốc bảo vệ thực vật tại địa phương trồng cây. "
                "Core API chịu trách nhiệm cache 1 giờ để tiết kiệm quota gọi API ngoài."
            ),
            properties={
                "location": ToolParameterProperty(
                    type="string",
                    description="Tên tỉnh, thành phố hoặc địa danh trồng cây tại Việt Nam (Ví dụ: 'Hà Nam', 'Đà Lạt')."
                ),
                "forecast_hours": ToolParameterProperty(
                    type="integer",
                    description="Số giờ dự báo tới (mặc định 12 giờ)."
                )
            },
            required=["location"],
            handler=tools.check_weather_risk
        )

        # Tool 3: query_pesticide_store
        self.register_tool(
            name="query_pesticide_store",
            description=(
                "Tra cứu danh mục thuốc BVTV chính ngạch có sẵn trong kho, giá bán, thời gian cách ly (PHI), "
                "đặc tính bám dính chống rửa trôi. Tự động loại bỏ hoàn toàn thuốc bị cấm lưu hành."
            ),
            properties={
                "disease_code": ToolParameterProperty(
                    type="string",
                    description="Mã bệnh để lọc thuốc phù hợp trong kho (Ví dụ: 'Tomato___Late_blight')."
                ),
                "require_rain_resistant": ToolParameterProperty(
                    type="boolean",
                    description="Nếu True: chỉ lấy các loại thuốc có phụ gia bám dính chống mưa rửa trôi."
                )
            },
            required=["disease_code"],
            handler=tools.query_pesticide_store
        )

        # Tool 4: verify_phi_safety
        self.register_tool(
            name="verify_phi_safety",
            description=(
                "Kiểm tra chốt chặn an toàn thời gian cách ly (Pre-Harvest Interval - PHI). "
                "Kích hoạt báo động đỏ bảo thủ nếu số ngày còn lại đến kỳ thu hoạch <= thời gian cách ly của thuốc."
            ),
            properties={
                "harvest_days_left": ToolParameterProperty(
                    type="integer",
                    description="Số ngày dự kiến còn lại đến thời điểm thu hoạch nông sản."
                ),
                "phi_days": ToolParameterProperty(
                    type="integer",
                    description="Thời gian cách ly PHI của thuốc tính theo ngày (Ví dụ: 7, 14 ngày)."
                )
            },
            required=["harvest_days_left", "phi_days"],
            handler=tools.verify_phi_safety
        )


# Singleton instance của MCP Server
mcp_server = MCPServer()

_ERROR_STATUS = {
    "NOT_FOUND": status.HTTP_404_NOT_FOUND,
    "INVALID_INPUT": 422,
    "UPSTREAM_UNAVAILABLE": status.HTTP_503_SERVICE_UNAVAILABLE,
    "INTERNAL": status.HTTP_500_INTERNAL_SERVER_ERROR,
}

# FastAPI Router cho MCP Endpoints
mcp_router = APIRouter(prefix="/api/v1/mcp", tags=["Model Context Protocol (MCP)"])


@mcp_router.get("/tools")
def list_mcp_tools():
    """Liệt kê danh sách 4 công cụ MCP cùng JSON Schema tương ứng."""
    return {"tools": [t.model_dump() for t in mcp_server.list_tools()]}


@mcp_router.post("/tools/{tool_name}")
def execute_mcp_tool(tool_name: str, payload: Optional[MCPCallRequest] = None):
    """
    Thực thi một MCP Tool trực tiếp qua HTTP.
    Kiểm tra sự tồn tại của tool trước khi gọi; bắt lỗi chặt chẽ:
    - 404: Tool không tồn tại trong danh mục.
    - 422: Tham số truyền vào không hợp lệ.
    - 503: Dịch vụ Core API phụ thuộc không khả dụng.
    - 500: Lỗi nội bộ, không trả chi tiết ra ngoài.
    """
    arguments = payload.arguments if payload else {}
    resp = mcp_server.call_tool(tool_name, arguments)

    if resp.is_error:
        raise HTTPException(
            status_code=_ERROR_STATUS.get(resp.error_code, status.HTTP_500_INTERNAL_SERVER_ERROR),
            detail=resp.error_message or "Tool execution failed."
        )

    return resp.model_dump()
