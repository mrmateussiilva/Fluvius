import sys
import os
sys.path.append(os.getcwd())

from app.core.database import SessionLocal
from app.models.agent import Agent
from app.core.auth import get_password_hash

db = SessionLocal()
agents = db.query(Agent).all()
for a in agents:
    a.hashed_password = get_password_hash('123456')
db.commit()
print(f'Updated {len(agents)} agents with password: 123456')
