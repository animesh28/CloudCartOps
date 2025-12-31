# CloudCartOps Integration Test Suite - Windows PowerShell Version
# Run with: powershell -ExecutionPolicy Bypass -File .\tests\app_scenarios.ps1

$ErrorActionPreference = "Stop"

# Check if curl is available (Windows 10+ has curl.exe)
if (-not (Get-Command curl.exe -ErrorAction SilentlyContinue)) {
   Write-Error "curl.exe is required for these tests"
   exit 1
}

# Check if jq is available
if (-not (Get-Command jq -ErrorAction SilentlyContinue)) {
   Write-Host "jq is required. Install via: winget install jqlang.jq" -ForegroundColor Red
   Write-Host "Or download from: https://stedolan.github.io/jq/download/" -ForegroundColor Red
   exit 1
}

$BASE_GATEWAY = "http://localhost:3000"
$TIMESTAMP = [int][double]::Parse((Get-Date -UFormat %s))
$TEST_USER = "ci-user-$TIMESTAMP"
$TEST_EMAIL = "ci-user-$TIMESTAMP@example.com"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "CloudCartOps Integration Test Suite" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# Scenario 1: Register User
Write-Host ""
Write-Host "`[Scenario 1/10`] Register a new user via API Gateway" -ForegroundColor Yellow

$regBody = @{
   username = $TEST_USER
   email = $TEST_EMAIL
   password = "Password123!"
} | ConvertTo-Json

$regBody | Out-File -FilePath "$env:TEMP\cc_reg_body.json" -Encoding ascii -NoNewline

$regResponse = curl.exe -s -o "$env:TEMP\cc_reg.json" -w "%{http_code}" -X POST "$BASE_GATEWAY/api/auth/register" `
   -H "Content-Type: application/json" `
   -d "@$env:TEMP\cc_reg_body.json"

if ($regResponse -ne "201" -and $regResponse -ne "200") {
   Write-Host "[FAIL] User registration failed with status $regResponse" -ForegroundColor Red
   Get-Content "$env:TEMP\cc_reg.json" -ErrorAction SilentlyContinue
   exit 1
}

$regData = Get-Content "$env:TEMP\cc_reg.json" | ConvertFrom-Json
$USER_ID = $regData.user.id

if (-not $USER_ID) {
   Write-Host "[FAIL] User ID not found in registration response" -ForegroundColor Red
   Get-Content "$env:TEMP\cc_reg.json"
   exit 1
}

Write-Host "[PASS] User registered successfully (ID: $USER_ID)" -ForegroundColor Green

# Scenario 2: Login
Write-Host ""
Write-Host "`[Scenario 2/10`] Login and capture JWT" -ForegroundColor Yellow

$loginBody = @{
   username = $TEST_USER
   password = "Password123!"
} | ConvertTo-Json

$loginBody | Out-File -FilePath "$env:TEMP\cc_login_body.json" -Encoding ascii -NoNewline

$loginResponse = curl.exe -s -o "$env:TEMP\cc_login.json" -w "%{http_code}" -X POST "$BASE_GATEWAY/api/auth/login" `
   -H "Content-Type: application/json" `
   -d "@$env:TEMP\cc_login_body.json"

if ($loginResponse -ne "200") {
   Write-Host "[FAIL] Login failed with status $loginResponse" -ForegroundColor Red
   Get-Content "$env:TEMP\cc_login.json" -ErrorAction SilentlyContinue
   exit 1
}

$loginData = Get-Content "$env:TEMP\cc_login.json" | ConvertFrom-Json
$TOKEN = $loginData.token

if (-not $TOKEN) {
   Write-Host "[FAIL] JWT token not found in login response" -ForegroundColor Red
   Get-Content "$env:TEMP\cc_login.json"
   exit 1
}

Write-Host "[PASS] Login successful, JWT captured" -ForegroundColor Green

# Scenario 3: Invalid Login
Write-Host ""
Write-Host "`[Scenario 3/10`] Test invalid login (should fail)" -ForegroundColor Yellow

$invalidBody = @{
   username = $TEST_USER
   password = "WrongPassword123!"
} | ConvertTo-Json

$invalidBody | Out-File -FilePath "$env:TEMP\cc_invalid_body.json" -Encoding ascii -NoNewline

$invalidResponse = curl.exe -s -o "$env:TEMP\cc_invalid.json" -w "%{http_code}" -X POST "$BASE_GATEWAY/api/auth/login" `
   -H "Content-Type: application/json" `
   -d "@$env:TEMP\cc_invalid_body.json"

if ($invalidResponse -eq "200") {
   Write-Host "[FAIL] Invalid login should have failed but got 200" -ForegroundColor Red
   exit 1
}

Write-Host "[PASS] Invalid login correctly rejected" -ForegroundColor Green

# Scenario 4: List Products
Write-Host ""
Write-Host "`[Scenario 4/10`] List all products via API Gateway" -ForegroundColor Yellow

$prodResponse = curl.exe -s -o "$env:TEMP\cc_products.json" -w "%{http_code}" "$BASE_GATEWAY/api/products"

if ($prodResponse -ne "200") {
   Write-Host "[FAIL] Product list failed with status $prodResponse" -ForegroundColor Red
   Get-Content "$env:TEMP\cc_products.json" -ErrorAction SilentlyContinue
   exit 1
}

$products = Get-Content "$env:TEMP\cc_products.json" | ConvertFrom-Json
$PRODUCT_COUNT = $products.Count

if ($PRODUCT_COUNT -le 0) {
   Write-Host "[FAIL] No products returned from API" -ForegroundColor Red
   Get-Content "$env:TEMP\cc_products.json"
   exit 1
}

$PRODUCT_ID = $products[0].id
$PRODUCT_NAME = $products[0].name

Write-Host "[PASS] Retrieved $PRODUCT_COUNT products (first: $PRODUCT_NAME)" -ForegroundColor Green

# Scenario 5: Search Products
Write-Host ""
Write-Host "`[Scenario 5/10`] Search products by name" -ForegroundColor Yellow

$searchResponse = curl.exe -s -o "$env:TEMP\cc_search.json" -w "%{http_code}" "$BASE_GATEWAY/api/products?search=Laptop"

if ($searchResponse -ne "200") {
   Write-Host "[FAIL] Product search failed with status $searchResponse" -ForegroundColor Red
   exit 1
}

Write-Host "[PASS] Product search successful" -ForegroundColor Green

# Scenario 6: Category Filter
Write-Host ""
Write-Host "`[Scenario 6/10`] Get product by category" -ForegroundColor Yellow

$categoryResponse = curl.exe -s -o "$env:TEMP\cc_category.json" -w "%{http_code}" "$BASE_GATEWAY/api/products?category=Electronics"

if ($categoryResponse -ne "200") {
   Write-Host "[FAIL] Category filter failed with status $categoryResponse" -ForegroundColor Red
   exit 1
}

Write-Host "[PASS] Category filtering successful" -ForegroundColor Green

# Scenario 7: Create Order
Write-Host ""
Write-Host "`[Scenario 7/10`] Create order for first product" -ForegroundColor Yellow

$orderBody = @{
   user_id = $USER_ID
   items = @(
       @{
           product_id = $PRODUCT_ID
           quantity = 1
           price = 10.0
       }
   )
} | ConvertTo-Json -Depth 3

$orderBody | Out-File -FilePath "$env:TEMP\cc_order_body.json" -Encoding ascii -NoNewline

$orderResponse = curl.exe -s -o "$env:TEMP\cc_order.json" -w "%{http_code}" -X POST "$BASE_GATEWAY/api/orders" `
   -H "Content-Type: application/json" `
   -H "Authorization: Bearer $TOKEN" `
   -d "@$env:TEMP\cc_order_body.json"

if ($orderResponse -ne "201" -and $orderResponse -ne "200") {
   Write-Host "[FAIL] Create order failed with status $orderResponse" -ForegroundColor Red
   Get-Content "$env:TEMP\cc_order.json" -ErrorAction SilentlyContinue
   exit 1
}

$orderData = Get-Content "$env:TEMP\cc_order.json" | ConvertFrom-Json

if (-not $orderData.id -or $orderData.items.Count -eq 0) {
   Write-Host "[FAIL] Order response missing id/items" -ForegroundColor Red
   Get-Content "$env:TEMP\cc_order.json"
   exit 1
}

$ORDER_ID = $orderData.id
Write-Host "[PASS] Order created successfully (ID: $ORDER_ID)" -ForegroundColor Green

# Scenario 8: Fetch My Orders
Write-Host ""
Write-Host "`[Scenario 8/10`] Fetch my orders and verify items have product_name and quantity" -ForegroundColor Yellow

$myOrdersResponse = curl.exe -s -o "$env:TEMP\cc_my_orders.json" -w "%{http_code}" `
   -H "Authorization: Bearer $TOKEN" `
   "$BASE_GATEWAY/api/orders/my-orders"

if ($myOrdersResponse -ne "200") {
   Write-Host "[FAIL] Fetching my orders failed with status $myOrdersResponse" -ForegroundColor Red
   Get-Content "$env:TEMP\cc_my_orders.json" -ErrorAction SilentlyContinue
   exit 1
}

$myOrders = Get-Content "$env:TEMP\cc_my_orders.json" | ConvertFrom-Json

if (-not $myOrders[0].items[0].product_name -or $myOrders[0].items[0].quantity -le 0) {
   Write-Host "[FAIL] Orders response missing product_name/quantity" -ForegroundColor Red
   Get-Content "$env:TEMP\cc_my_orders.json"
   exit 1
}

Write-Host "[PASS] My orders retrieved with product_name and quantity" -ForegroundColor Green

# Scenario 9: Get Order Details
Write-Host ""
Write-Host "`[Scenario 9/10`] Get specific order by ID" -ForegroundColor Yellow

$orderDetailResponse = curl.exe -s -o "$env:TEMP\cc_order_detail.json" -w "%{http_code}" `
   -H "Authorization: Bearer $TOKEN" `
   "$BASE_GATEWAY/api/orders/$ORDER_ID"

if ($orderDetailResponse -ne "200") {
   Write-Host "[FAIL] Get order by ID failed with status $orderDetailResponse" -ForegroundColor Red
   Get-Content "$env:TEMP\cc_order_detail.json" -ErrorAction SilentlyContinue
   exit 1
}

$orderDetail = Get-Content "$env:TEMP\cc_order_detail.json" | ConvertFrom-Json

if (-not $orderDetail.id -or -not $orderDetail.items -or $orderDetail.items.Count -eq 0) {
   Write-Host "[FAIL] Order detail missing required fields" -ForegroundColor Red
   Get-Content "$env:TEMP\cc_order_detail.json"
   exit 1
}

Write-Host "[PASS] Order details retrieved successfully" -ForegroundColor Green

# Scenario 10: Chaos Service
Write-Host ""
Write-Host "`[Scenario 10/10`] Test chaos service toggle (optional)" -ForegroundColor Yellow

try {
   $chaosResponse = curl.exe -s -o "$env:TEMP\cc_chaos.json" -w "%{http_code}" "$BASE_GATEWAY/api/chaos/config"
  
   if ($chaosResponse -eq "200") {
       Write-Host "[PASS] Chaos service is accessible" -ForegroundColor Green
   } else {
       Write-Host "[WARN] Chaos service returned status $chaosResponse (may not be running)" -ForegroundColor Yellow
   }
} catch {
   Write-Host "[WARN] Chaos service is not accessible (may not be running)" -ForegroundColor Yellow
}

# Summary
Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "[SUCCESS] All integration tests passed!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""


