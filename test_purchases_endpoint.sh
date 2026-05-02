#!/bin/bash
# Quick test script for purchases endpoint
# Run this after starting the backend server

echo "==================================="
echo "Testing /api/purchases endpoint"
echo "==================================="
echo ""

# Test 1: Health check
echo "1. Testing health endpoint..."
curl -s http://localhost:8000/api/health | python -m json.tool
echo ""

# Test 2: GET /api/purchases (requires authentication)
echo "2. Testing GET /api/purchases..."
echo "Note: This will fail with 401 if not authenticated"
curl -s http://localhost:8000/api/purchases | python -m json.tool
echo ""

echo "==================================="
echo "Test complete"
echo "==================================="
echo ""
echo "To test with authentication:"
echo "1. Login first: curl -X POST http://localhost:8000/api/auth/login -H 'Content-Type: application/json' -d '{\"email\":\"owner@eyerflow.com\",\"password\":\"owner123\"}'"
echo "2. Use the token: curl -H 'Authorization: Bearer YOUR_TOKEN' http://localhost:8000/api/purchases"
