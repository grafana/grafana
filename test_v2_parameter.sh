#!/bin/bash

# Test script to demonstrate the difference between v1 and v2 API calls
# This assumes Grafana is running locally on port 3000

GRAFANA_URL="http://localhost:3000"
API_KEY="YOUR_API_KEY_HERE"  # Replace with your actual API key

echo "====================================="
echo "Testing Alert Rules API - v1 vs v2"
echo "====================================="
echo ""

# Test v1 (default) implementation
echo "1. Testing v1 implementation (default):"
echo "   GET /api/prometheus/grafana/api/v1/rules"
echo ""
time curl -s -H "Authorization: Bearer $API_KEY" \
  "$GRAFANA_URL/api/prometheus/grafana/api/v1/rules" \
  -o /dev/null -w "Response code: %{http_code}\nTime total: %{time_total}s\n"

echo ""
echo "-------------------------------------"
echo ""

# Test v2 (optimized) implementation
echo "2. Testing v2 implementation (optimized streaming):"
echo "   GET /api/prometheus/grafana/api/v1/rules?v2=true"
echo ""
time curl -s -H "Authorization: Bearer $API_KEY" \
  "$GRAFANA_URL/api/prometheus/grafana/api/v1/rules?v2=true" \
  -o /dev/null -w "Response code: %{http_code}\nTime total: %{time_total}s\n"

echo ""
echo "====================================="
echo "Testing with pagination (group_limit)"
echo "====================================="
echo ""

# Test v1 with pagination
echo "3. Testing v1 with pagination (group_limit=10):"
echo ""
time curl -s -H "Authorization: Bearer $API_KEY" \
  "$GRAFANA_URL/api/prometheus/grafana/api/v1/rules?group_limit=10" \
  -o /dev/null -w "Response code: %{http_code}\nTime total: %{time_total}s\n"

echo ""
echo "-------------------------------------"
echo ""

# Test v2 with pagination
echo "4. Testing v2 with pagination (group_limit=10):"
echo ""
time curl -s -H "Authorization: Bearer $API_KEY" \
  "$GRAFANA_URL/api/prometheus/grafana/api/v1/rules?v2=true&group_limit=10" \
  -o /dev/null -w "Response code: %{http_code}\nTime total: %{time_total}s\n"

echo ""
echo "====================================="
echo "Memory Usage Comparison"
echo "====================================="
echo ""
echo "To monitor memory usage during these calls, run this in another terminal:"
echo "  watch -n 1 'ps aux | grep grafana | grep -v grep'"
echo ""
echo "The v2 implementation should use significantly less memory for large datasets."
echo ""
echo "Note: Replace YOUR_API_KEY_HERE with an actual Grafana API key before running."
