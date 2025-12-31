#!/usr/bin/env bash
set -euo pipefail

if ! command -v jq >/dev/null 2>&1; then
 echo "jq is required for these tests" >&2
 exit 1
fi

BASE_GATEWAY="http://localhost:3000"
TIMESTAMP=$(date +%s)
TEST_USER="ci-user-${TIMESTAMP}"
TEST_EMAIL="ci-user-${TIMESTAMP}@example.com"

echo "========================================="
echo "CloudCartOps Integration Test Suite"
echo "========================================="

echo ""
echo "[Scenario 1/10] Register a new user via API Gateway"
REGISTER_STATUS=$(curl -s -o /tmp/cc_reg.json -w "%{http_code}" -X POST "$BASE_GATEWAY/api/auth/register" \
 -H "Content-Type: application/json" \
 -d "{
   \"username\": \"$TEST_USER\",
   \"email\": \"$TEST_EMAIL\",
   \"password\": \"Password123!\"
 }")

# Fixed: Use string comparison for status codes (more reliable than -ne with potential non-numeric values)
if [ "$REGISTER_STATUS" != "201" ] && [ "$REGISTER_STATUS" != "200" ]; then
 echo "✗ User registration failed with status $REGISTER_STATUS" >&2
 cat /tmp/cc_reg.json >&2 || true
 exit 1
fi

USER_ID=$(jq -r '.user.id // empty' /tmp/cc_reg.json)
if [ -z "$USER_ID" ]; then
 echo "✗ User ID not found in registration response" >&2
 cat /tmp/cc_reg.json >&2 || true
 exit 1
fi

echo "✓ User registered successfully (ID: $USER_ID)"

echo ""
echo "[Scenario 2/10] Login and capture JWT"
LOGIN_STATUS=$(curl -s -o /tmp/cc_login.json -w "%{http_code}" -X POST "$BASE_GATEWAY/api/auth/login" \
 -H "Content-Type: application/json" \
 -d "{
   \"username\": \"$TEST_USER\",
   \"password\": \"Password123!\"
 }")

if [ "$LOGIN_STATUS" != "200" ]; then
 echo "✗ Login failed with status $LOGIN_STATUS" >&2
 cat /tmp/cc_login.json >&2 || true
 exit 1
fi

TOKEN=$(jq -r '.token // empty' /tmp/cc_login.json)
if [ -z "$TOKEN" ]; then
 echo "✗ JWT token not found in login response" >&2
 cat /tmp/cc_login.json >&2 || true
 exit 1
fi

echo "✓ Login successful, JWT captured"

echo ""
echo "[Scenario 3/10] Test invalid login (should fail)"
INVALID_LOGIN=$(curl -s -o /tmp/cc_invalid.json -w "%{http_code}" -X POST "$BASE_GATEWAY/api/auth/login" \
 -H "Content-Type: application/json" \
 -d "{
   \"username\": \"$TEST_USER\",
   \"password\": \"WrongPassword123!\"
 }")

if [ "$INVALID_LOGIN" = "200" ]; then
 echo "✗ Invalid login should have failed but got 200" >&2
 exit 1
fi

echo "✓ Invalid login correctly rejected"

echo ""
echo "[Scenario 4/10] List all products via API Gateway"
PROD_STATUS=$(curl -s -o /tmp/cc_products.json -w "%{http_code}" "$BASE_GATEWAY/api/products")

if [ "$PROD_STATUS" != "200" ]; then
 echo "✗ Product list failed with status $PROD_STATUS" >&2
 cat /tmp/cc_products.json >&2 || true
 exit 1
fi

PRODUCT_COUNT=$(jq 'length' /tmp/cc_products.json)
if [ "$PRODUCT_COUNT" -le 0 ]; then
 echo "✗ No products returned from API" >&2
 cat /tmp/cc_products.json >&2 || true
 exit 1
fi

PRODUCT_ID=$(jq '.[0].id' /tmp/cc_products.json)
PRODUCT_NAME=$(jq -r '.[0].name' /tmp/cc_products.json)
echo "✓ Retrieved $PRODUCT_COUNT products (first: $PRODUCT_NAME)"

echo ""
echo "[Scenario 5/10] Search products by name"
SEARCH_STATUS=$(curl -s -o /tmp/cc_search.json -w "%{http_code}" "$BASE_GATEWAY/api/products?search=Laptop")

if [ "$SEARCH_STATUS" != "200" ]; then
 echo "✗ Product search failed with status $SEARCH_STATUS" >&2
 exit 1
fi

echo "✓ Product search successful"

echo ""
echo "[Scenario 6/10] Get product by category"
CATEGORY_STATUS=$(curl -s -o /tmp/cc_category.json -w "%{http_code}" "$BASE_GATEWAY/api/products?category=Electronics")

if [ "$CATEGORY_STATUS" != "200" ]; then
 echo "✗ Category filter failed with status $CATEGORY_STATUS" >&2
 exit 1
fi

echo "✓ Category filtering successful"

echo ""
echo "[Scenario 7/10] Create order for first product"
ORDER_STATUS=$(curl -s -o /tmp/cc_order.json -w "%{http_code}" -X POST "$BASE_GATEWAY/api/orders" \
 -H "Content-Type: application/json" \
 -H "Authorization: Bearer $TOKEN" \
 -d "{
   \"user_id\": $USER_ID,
   \"items\": [
     {\"product_id\": $PRODUCT_ID, \"quantity\": 1, \"price\": 10.0}
   ]
 }")

if [ "$ORDER_STATUS" != "201" ] && [ "$ORDER_STATUS" != "200" ]; then
 echo "✗ Create order failed with status $ORDER_STATUS" >&2
 cat /tmp/cc_order.json >&2 || true
 exit 1
fi

jq -e '.id and (.items | length > 0)' /tmp/cc_order.json >/dev/null || {
 echo "✗ Order response missing id/items" >&2
 cat /tmp/cc_order.json >&2 || true
 exit 1
}

ORDER_ID=$(jq -r '.id' /tmp/cc_order.json)
echo "✓ Order created successfully (ID: $ORDER_ID)"

echo ""
echo "[Scenario 8/10] Fetch my orders and verify items have product_name and quantity"
MY_ORDERS_STATUS=$(curl -s -o /tmp/cc_my_orders.json -w "%{http_code}" \
 -H "Authorization: Bearer $TOKEN" \
 "$BASE_GATEWAY/api/orders/my-orders")

if [ "$MY_ORDERS_STATUS" != "200" ]; then
 echo "✗ Fetching my orders failed with status $MY_ORDERS_STATUS" >&2
 cat /tmp/cc_my_orders.json >&2 || true
 exit 1
fi

jq -e '.[0].items[0].product_name and (.[0].items[0].quantity > 0)' /tmp/cc_my_orders.json >/dev/null || {
 echo "✗ Orders response missing product_name/quantity" >&2
 cat /tmp/cc_my_orders.json >&2 || true
 exit 1
}

echo "✓ My orders retrieved with product_name and quantity"

echo ""
echo "[Scenario 9/10] Get specific order by ID"
ORDER_DETAIL_STATUS=$(curl -s -o /tmp/cc_order_detail.json -w "%{http_code}" \
 -H "Authorization: Bearer $TOKEN" \
 "$BASE_GATEWAY/api/orders/$ORDER_ID")

if [ "$ORDER_DETAIL_STATUS" != "200" ]; then
 echo "✗ Get order by ID failed with status $ORDER_DETAIL_STATUS" >&2
 cat /tmp/cc_order_detail.json >&2 || true
 exit 1
fi

jq -e '.id and .items and (.items | length > 0)' /tmp/cc_order_detail.json >/dev/null || {
 echo "✗ Order detail missing required fields" >&2
 cat /tmp/cc_order_detail.json >&2 || true
 exit 1
}

echo "✓ Order details retrieved successfully"

echo ""
echo "[Scenario 10/10] Test chaos service toggle (optional)"
CHAOS_STATUS=$(curl -s -o /tmp/cc_chaos.json -w "%{http_code}" "$BASE_GATEWAY/api/chaos/config" || echo "000")

if [ "$CHAOS_STATUS" = "200" ]; then
 echo "✓ Chaos service is accessible"
else
 echo "⚠ Chaos service returned status $CHAOS_STATUS (may not be running)"
fi

echo ""
echo "========================================="
echo "✓ All integration tests passed!"
echo "========================================="
echo ""


