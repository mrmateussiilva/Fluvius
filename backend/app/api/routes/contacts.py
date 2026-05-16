from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.auth import get_current_agent
from app.core.database import get_db
from app.models.agent import Agent
from app.models.contact import Contact
from app.models.workspace import utcnow
from app.schemas.conversation import ContactResponse

router = APIRouter(prefix="/api/contacts", tags=["contacts"])


class ContactTagsUpdate(BaseModel):
    tags: list[str]


def normalize_tags(tags: list[str]) -> list[str]:
    normalized = []
    seen = set()
    for tag in tags:
        value = tag.strip()
        key = value.casefold()
        if not value or key in seen:
            continue
        normalized.append(value[:40])
        seen.add(key)
        if len(normalized) == 20:
            break
    return normalized


@router.patch("/{contact_id}/tags", response_model=ContactResponse)
def update_contact_tags(
    contact_id: str,
    body: ContactTagsUpdate,
    db: Session = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent),
):
    contact = db.query(Contact).filter(
        Contact.id == contact_id,
        Contact.workspace_id == current_agent.workspace_id,
    ).first()

    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    contact.tags = normalize_tags(body.tags)
    contact.updated_at = utcnow()
    db.commit()
    db.refresh(contact)
    return contact
