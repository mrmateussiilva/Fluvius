from typing import Any, Dict
from pydantic import BaseModel

class WebhookPayload(BaseModel):
    event: str
    instance: str
    data: Dict[str, Any]
    
    model_config = {"extra": "allow"}
