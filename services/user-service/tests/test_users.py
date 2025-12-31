"""
Comprehensive unit tests for User Service
Tests user registration, login, authentication, and user management
"""
from fastapi.testclient import TestClient
import logging

from main import app

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

client = TestClient(app)


class TestUserRegistration:
    """Test suite for user registration functionality"""
    
    def test_create_user_success(self):
        """Test successful user registration with valid data"""
        logger.info("Testing user registration with valid data")
        
        payload = {
            "username": "test-user-reg-1",
            "email": "test-user-reg-1@example.com",
            "password": "SecurePass123!",
            "full_name": "Test User One",
        }
        
        response = client.post("/users", json=payload)
        logger.info(f"Registration response status: {response.status_code}")
        
        assert response.status_code in (200, 201), f"Expected 200/201, got {response.status_code}"
        data = response.json()
        
        assert data["username"] == payload["username"]
        assert data["email"] == payload["email"]
        assert data["full_name"] == payload["full_name"]
        assert "password" not in data, "Password should not be in response"
        assert "id" in data, "User ID should be present"
        
        logger.info(f"✓ User registered successfully with ID: {data['id']}")
    
    def test_create_user_duplicate_username(self):
        """Test registration fails with duplicate username"""
        logger.info("Testing duplicate username rejection")
        
        payload = {
            "username": "duplicate-user",
            "email": "duplicate1@example.com",
            "password": "Password123!",
            "full_name": "Duplicate User",
        }
        
        # First registration
        first = client.post("/users", json=payload)
        assert first.status_code in (200, 201)
        logger.info("✓ First user created")
        
        # Attempt duplicate username with different email
        payload["email"] = "duplicate2@example.com"
        second = client.post("/users", json=payload)
        
        assert second.status_code == 400, f"Expected 400, got {second.status_code}"
        assert "already exists" in second.json()["detail"].lower()
        logger.info("✓ Duplicate username correctly rejected")
    
    def test_create_user_duplicate_email(self):
        """Test registration fails with duplicate email"""
        logger.info("Testing duplicate email rejection")
        
        # Create first user
        payload1 = {
            "username": "user-email-1",
            "email": "shared-email@example.com",
            "password": "Password123!",
            "full_name": "User One",
        }
        client.post("/users", json=payload1)
        logger.info("✓ First user created")
        
        # Try to create second user with same email
        payload2 = {
            "username": "user-email-2",
            "email": "shared-email@example.com",
            "password": "Password456!",
            "full_name": "User Two",
        }
        response = client.post("/users", json=payload2)
        
        assert response.status_code == 400
        logger.info("✓ Duplicate email correctly rejected")


class TestUserAuthentication:
    """Test suite for user authentication and password validation"""
    
    def test_validate_password_success(self):
        """Test successful password validation"""
        logger.info("Testing valid password validation")
        
        # Create user
        user_payload = {
            "username": "auth-test-user",
            "email": "auth-test@example.com",
            "password": "MyPassword123!",
            "full_name": "Auth Test",
        }
        client.post("/users", json=user_payload)
        logger.info("✓ Test user created")
        
        # Validate password
        login_payload = {
            "username": "auth-test-user",
            "password": "MyPassword123!",
        }
        response = client.post("/auth/validate-password", json=login_payload)
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["valid"] is True
        assert data["user"]["username"] == "auth-test-user"
        assert data["user"]["email"] == "auth-test@example.com"
        assert "id" in data["user"]
        
        logger.info(f"✓ Password validated successfully for user: {data['user']['username']}")
    
    def test_validate_password_wrong_password(self):
        """Test password validation fails with incorrect password"""
        logger.info("Testing invalid password rejection")
        
        # Create user
        user_payload = {
            "username": "wrong-pass-user",
            "email": "wrong-pass@example.com",
            "password": "CorrectPassword123!",
            "full_name": "Wrong Pass User",
        }
        client.post("/users", json=user_payload)
        logger.info("✓ Test user created")
        
        # Try with wrong password
        login_payload = {
            "username": "wrong-pass-user",
            "password": "WrongPassword123!",
        }
        response = client.post("/auth/validate-password", json=login_payload)
        
        assert response.status_code == 200
        data = response.json()
        assert data["valid"] is False
        assert data["user"] is None
        
        logger.info("✓ Invalid password correctly rejected")
    
    def test_validate_password_user_not_found(self):
        """Test password validation fails for non-existent user"""
        logger.info("Testing non-existent user rejection")
        
        login_payload = {
            "username": "nonexistent-user-12345",
            "password": "AnyPassword123!",
        }
        response = client.post("/auth/validate-password", json=login_payload)
        
        assert response.status_code == 200
        data = response.json()
        assert data["valid"] is False
        assert data["user"] is None
        
        logger.info("✓ Non-existent user correctly rejected")


class TestUserRetrieval:
    """Test suite for user retrieval operations"""
    
    def test_get_user_by_id(self):
        """Test fetching user by ID"""
        logger.info("Testing get user by ID")
        
        # Create user
        user_payload = {
            "username": "fetch-user-test",
            "email": "fetch-test@example.com",
            "password": "Password123!",
            "full_name": "Fetch Test User",
        }
        create_response = client.post("/users", json=user_payload)
        user_id = create_response.json()["id"]
        logger.info(f"✓ Created user with ID: {user_id}")
        
        # Fetch by ID
        response = client.get(f"/users/{user_id}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "fetch-user-test"
        assert data["email"] == "fetch-test@example.com"
        assert data["full_name"] == "Fetch Test User"
        
        logger.info(f"✓ Successfully retrieved user: {data['username']}")
    
    def test_get_all_users(self):
        """Test fetching all users"""
        logger.info("Testing get all users")
        
        # Create a test user first
        user_payload = {
            "username": "list-test-user",
            "email": "list-test@example.com",
            "password": "Password123!",
            "full_name": "List Test User",
        }
        client.post("/users", json=user_payload)
        logger.info("✓ Created test user for listing")
        
        # Fetch all users
        response = client.get("/users")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        
        logger.info(f"✓ Retrieved {len(data)} users from database")


class TestUserEdgeCases:
    """Test suite for edge cases and error handling"""
    
    def test_create_user_missing_required_fields(self):
        """Test registration fails with missing required fields"""
        logger.info("Testing missing required fields validation")
        
        # Missing password
        payload = {
            "username": "incomplete-user",
            "email": "incomplete@example.com",
        }
        
        response = client.post("/users", json=payload)
        assert response.status_code == 422, "Should return validation error"
        
        logger.info("✓ Missing fields correctly rejected with 422")
    
    def test_get_user_invalid_id(self):
        """Test fetching user with invalid ID"""
        logger.info("Testing invalid user ID retrieval")
        
        response = client.get("/users/999999")
        
        # Could be 404 or 500 depending on implementation
        assert response.status_code in (404, 500)
        
        logger.info(f"✓ Invalid user ID returned status: {response.status_code}")


if __name__ == "__main__":
    # Run with: pytest services/user-service/tests/test_users.py -v
    logger.info("Run tests with: pytest services/user-service/tests/test_users.py -v")
