import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import Base, get_db

# Import ALL models so SQLAlchemy registers their tables before create_all()
import app.models.workspace       # noqa: F401
import app.models.agent           # noqa: F401
import app.models.inbox           # noqa: F401
import app.models.connection      # noqa: F401
import app.models.contact         # noqa: F401
import app.models.conversation    # noqa: F401
import app.models.message         # noqa: F401
import app.models.queue           # noqa: F401
import app.models.quick_reply     # noqa: F401
import app.models.webhook_event   # noqa: F401

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
