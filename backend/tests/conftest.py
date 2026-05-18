import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

# Import as 'fluvius_app' to avoid name collision with the 'app' package
from app.main import app as fluvius_app
from app.core.database import Base, get_db

# Import all models via the package __init__ so SQLAlchemy
# registers every table in Base.metadata before create_all()
import app.models  # noqa: F401

# StaticPool forces SQLAlchemy to reuse a single connection for all
# sessions. This is REQUIRED for SQLite in-memory databases, because
# each new connection would otherwise receive an empty database.
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
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

    fluvius_app.dependency_overrides[get_db] = override_get_db
    with TestClient(fluvius_app) as test_client:
        yield test_client
    fluvius_app.dependency_overrides.clear()

