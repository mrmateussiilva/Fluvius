import asyncio
from app.api.routes.dashboard import get_dashboard
from app.core.database import SessionLocal
from app.models.agent import Agent

db = SessionLocal()
agent = db.query(Agent).filter_by(email="scooby3010doo@gmail.com").first()
try:
    res = get_dashboard(db=db, current_agent=agent)
    print("Success")
except Exception as e:
    import traceback
    traceback.print_exc()
