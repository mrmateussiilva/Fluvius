from fastapi import APIRouter, Depends, HTTPException
from typing import Optional

from pydantic import BaseModel, Field
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


class ContactUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=120)
    email: Optional[str] = Field(default=None, max_length=160)
    company: Optional[str] = Field(default=None, max_length=160)
    lead_source: Optional[str] = Field(default=None, max_length=80)
    lifecycle_stage: Optional[str] = Field(default=None, max_length=80)
    estimated_value: Optional[float] = None
    crm_notes: Optional[str] = Field(default=None, max_length=5000)


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


def normalize_optional_string(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


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


@router.patch("/{contact_id}", response_model=ContactResponse)
def update_contact(
    contact_id: str,
    body: ContactUpdate,
    db: Session = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent),
):
    contact = db.query(Contact).filter(
        Contact.id == contact_id,
        Contact.workspace_id == current_agent.workspace_id,
    ).first()

    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    data = body.model_dump(exclude_unset=True)
    for field in ["name", "email", "company", "lead_source", "lifecycle_stage", "crm_notes"]:
        if field in data:
            setattr(contact, field, normalize_optional_string(data[field]))

    if "estimated_value" in data:
        if data["estimated_value"] is not None and data["estimated_value"] < 0:
            raise HTTPException(status_code=400, detail="Estimated value must be positive")
        contact.estimated_value = data["estimated_value"]

    contact.updated_at = utcnow()
    db.commit()
    db.refresh(contact)
    return contact
