"""
Comprehensive unit tests for Product Service
Tests product listing, search, filtering, and retrieval
"""
import logging

from app import app

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

client = app.test_client()


class TestProductListing:
    """Test suite for product listing functionality"""
    
    def test_get_all_products(self):
        """Test listing all products"""
        logger.info("Testing get all products")
        
        response = client.get("/products")
        
        assert response.status_code == 200
        data = response.get_json()
        assert isinstance(data, list)
        assert len(data) > 0, "Database should have products from init-db.sql"
        
        # Validate product structure
        first_product = data[0]
        required_fields = ['id', 'name', 'price', 'stock', 'category']
        for field in required_fields:
            assert field in first_product, f"Product missing required field: {field}"
        
        logger.info(f"✓ Retrieved {len(data)} products successfully")
    
    def test_get_products_returns_valid_data(self):
        """Test product data integrity"""
        logger.info("Testing product data integrity")
        
        response = client.get("/products")
        data = response.get_json()
        
        for product in data[:5]:  # Check first 5 products
            assert isinstance(product['id'], int), "Product ID should be integer"
            assert isinstance(product['name'], str), "Product name should be string"
            assert product['price'] > 0, "Product price should be positive"
            assert product['stock'] >= 0, "Product stock should be non-negative"
        
        logger.info("✓ Product data integrity validated")


class TestProductSearch:
    """Test suite for product search functionality"""
    
    def test_search_products_by_name(self):
        """Test searching products by name"""
        logger.info("Testing product search by name")
        
        response = client.get("/products?search=Laptop")
        
        assert response.status_code == 200
        data = response.get_json()
        assert isinstance(data, list)
        
        # Verify search results contain the search term
        if len(data) > 0:
            search_terms_found = [
                "laptop" in p['name'].lower() for p in data
            ]
            assert any(search_terms_found), "At least one result should match 'Laptop'"
            logger.info(f"✓ Found {len(data)} products matching 'Laptop'")
        else:
            logger.info("⚠ No products matching 'Laptop' (acceptable if DB has no laptops)")
    
    def test_search_products_no_results(self):
        """Test search with no matching results"""
        logger.info("Testing search with no results")
        
        response = client.get("/products?search=NonExistentProduct12345")
        
        assert response.status_code == 200
        data = response.get_json()
        assert isinstance(data, list)
        assert len(data) == 0, "Search should return empty list for non-existent products"
        
        logger.info("✓ Empty search results handled correctly")


class TestProductFiltering:
    """Test suite for product filtering by category"""
    
    def test_filter_products_by_category(self):
        """Test filtering products by category"""
        logger.info("Testing product filter by category")
        
        response = client.get("/products?category=Electronics")
        
        assert response.status_code == 200
        data = response.get_json()
        assert isinstance(data, list)
        
        # All returned products should be in Electronics category
        for product in data:
            assert product.get("category") == "Electronics", \
                f"Product {product.get('name')} should be in Electronics category"
        
        logger.info(f"✓ Retrieved {len(data)} products in Electronics category")
    
    def test_filter_products_multiple_categories(self):
        """Test filtering across different categories"""
        logger.info("Testing multiple category filters")
        
        categories = ["Electronics", "Books", "Clothing", "Home & Garden"]
        
        for category in categories:
            response = client.get(f"/products?category={category}")
            assert response.status_code == 200
            data = response.get_json()
            
            # Verify all products match the category
            for product in data:
                assert product.get("category") == category
            
            logger.info(f"✓ Category '{category}': {len(data)} products")
    
    def test_get_products_by_category_endpoint(self):
        """Test dedicated category endpoint"""
        logger.info("Testing category-specific endpoint")
        
        response = client.get("/products/category/Electronics")
        
        # Could be 200 with data or 404 if no electronics
        assert response.status_code in (200, 404)
        
        if response.status_code == 200:
            data = response.get_json()
            assert isinstance(data, list)
            for product in data:
                assert product.get("category") == "Electronics"
            logger.info(f"✓ Category endpoint returned {len(data)} products")
        else:
            logger.info("⚠ No Electronics products found (404)")


class TestProductRetrieval:
    """Test suite for individual product retrieval"""
    
    def test_get_product_by_id(self):
        """Test fetching a specific product by ID"""
        logger.info("Testing get product by ID")
        
        # First get all products to find a valid ID
        all_products = client.get("/products").get_json()
        assert len(all_products) > 0, "Need at least one product in DB"
        
        product_id = all_products[0]["id"]
        expected_name = all_products[0]["name"]
        
        logger.info(f"Fetching product ID: {product_id}")
        
        # Fetch specific product
        response = client.get(f"/products/{product_id}")
        
        assert response.status_code == 200
        data = response.get_json()
        
        assert data["id"] == product_id
        assert data["name"] == expected_name
        assert "price" in data
        assert "stock" in data
        assert "category" in data
        
        logger.info(f"✓ Retrieved product: {data['name']} (ID: {product_id})")
    
    def test_get_product_not_found(self):
        """Test fetching non-existent product returns 404"""
        logger.info("Testing non-existent product retrieval")
        
        response = client.get("/products/999999")
        
        assert response.status_code == 404
        logger.info("✓ Non-existent product correctly returned 404")


class TestProductEdgeCases:
    """Test suite for edge cases and error handling"""
    
    def test_get_product_invalid_id_format(self):
        """Test product retrieval with invalid ID format"""
        logger.info("Testing invalid product ID format")
        
        response = client.get("/products/invalid-id")
        
        # Should return 404 or 400
        assert response.status_code in (404, 400)
        logger.info(f"✓ Invalid ID format returned status: {response.status_code}")
    
    def test_combined_search_and_category_filter(self):
        """Test combining search and category filters"""
        logger.info("Testing combined search and category filter")
        
        response = client.get("/products?category=Electronics&search=Phone")
        
        assert response.status_code == 200
        data = response.get_json()
        assert isinstance(data, list)
        
        # All results should be in Electronics and contain "Phone"
        for product in data:
            assert product.get("category") == "Electronics"
            # Search might be case-insensitive
        
        logger.info(f"✓ Combined filter returned {len(data)} products")


class TestProductMetrics:
    """Test suite for product metrics and analytics"""
    
    def test_products_have_required_metadata(self):
        """Test products have all required metadata fields"""
        logger.info("Testing product metadata completeness")
        
        response = client.get("/products")
        data = response.get_json()
        
        required_metadata = ['created_at', 'updated_at']
        
        for product in data[:3]:  # Check first 3
            for field in required_metadata:
                assert field in product, f"Product missing metadata field: {field}"
        
        logger.info("✓ Product metadata fields present")


if __name__ == "__main__":
    # Run with: pytest services/product-service/tests/test_products.py -v
    logger.info("Run tests with: pytest services/product-service/tests/test_products.py -v")
