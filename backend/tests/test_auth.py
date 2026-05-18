import pytest

def test_register_and_login(client):
    # 1. Test Registration
    register_payload = {
        "company_name": "Fluvius Corp",
        "agent_name": "John Doe",
        "email": "john@example.com",
        "password": "securepassword123"
    }
    response = client.post("/api/auth/register", json=register_payload)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["agent"]["email"] == "john@example.com"
    token = data["access_token"]

    # 2. Test Success Login
    login_payload = {
        "email": "john@example.com",
        "password": "securepassword123"
    }
    response = client.post("/api/auth/login", json=login_payload)
    assert response.status_code == 200
    login_data = response.json()
    assert "access_token" in login_data
    assert login_data["token_type"] == "bearer"

    # 3. Test Invalid Login
    invalid_payload = {
        "email": "john@example.com",
        "password": "wrongpassword"
    }
    response = client.post("/api/auth/login", json=invalid_payload)
    assert response.status_code == 401

    # 4. Test GET /me
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/auth/me", headers=headers)
    assert response.status_code == 200
    me_data = response.json()
    assert me_data["email"] == "john@example.com"
    assert me_data["name"] == "John Doe"
