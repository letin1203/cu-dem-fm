#!/bin/bash

# Credentials are read from the environment so no password is committed.
# Example: ADMIN_PASSWORD=... MOD_PASSWORD=... USER_PASSWORD=... ./test-login.sh
: "${ADMIN_PASSWORD:?Set ADMIN_PASSWORD}"
: "${MOD_PASSWORD:?Set MOD_PASSWORD}"
: "${USER_PASSWORD:?Set USER_PASSWORD}"

echo "🧪 Testing Cu Dem FM Login API..."
echo

# Test admin login
echo "1. Testing admin login:"
ADMIN_RESPONSE=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"admin\", \"password\": \"$ADMIN_PASSWORD\"}")

echo "$ADMIN_RESPONSE" | jq .
if echo "$ADMIN_RESPONSE" | jq -r .success | grep -q true; then
  echo "✅ Admin login successful"
  ADMIN_TOKEN=$(echo "$ADMIN_RESPONSE" | jq -r .data.token)
else
  echo "❌ Admin login failed"
  exit 1
fi

echo
echo "2. Testing moderator login:"
MOD_RESPONSE=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"moderator\", \"password\": \"$MOD_PASSWORD\"}")

echo "$MOD_RESPONSE" | jq .
if echo "$MOD_RESPONSE" | jq -r .success | grep -q true; then
  echo "✅ Moderator login successful"
else
  echo "❌ Moderator login failed"
fi

echo
echo "3. Testing user login:"
USER_RESPONSE=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"player1\", \"password\": \"$USER_PASSWORD\"}")

echo "$USER_RESPONSE" | jq .
if echo "$USER_RESPONSE" | jq -r .success | grep -q true; then
  echo "✅ User login successful"
else
  echo "❌ User login failed"
fi

echo
echo "4. Testing protected route with admin token:"
PROTECTED_RESPONSE=$(curl -s -X GET http://localhost:3001/api/auth/me \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

echo "$PROTECTED_RESPONSE" | jq .
if echo "$PROTECTED_RESPONSE" | jq -r .success | grep -q true; then
  echo "✅ Protected route access successful"
else
  echo "❌ Protected route access failed"
fi

echo
echo "5. Testing invalid credentials:"
INVALID_RESPONSE=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "wrongpassword"}')

echo "$INVALID_RESPONSE" | jq .
if echo "$INVALID_RESPONSE" | jq -r .success | grep -q false; then
  echo "✅ Invalid credentials properly rejected"
else
  echo "❌ Invalid credentials not properly rejected"
fi

echo
echo "🎉 All login tests completed!"
echo
echo "📋 Available login credentials:"
echo "   Admin: username=admin (password from ADMIN_PASSWORD)"
echo "   Moderator: username=moderator (password from MOD_PASSWORD)"
echo "   User 1: username=player1 (password from USER_PASSWORD)"
echo "   User 2: username=player2 (password from USER_PASSWORD)"
