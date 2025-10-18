#!/bin/bash

# Test script to verify filter parameters are being passed to the API correctly

echo "Testing Grafana Alert Rules API with filters..."
echo ""

# Test 1: Free form search
echo "Test 1: Free form search for 'test'"
curl -s -X GET "http://localhost:3000/api/prometheus/grafana/api/v1/rules?free_form_search=test" \
  -H "Authorization: Basic YWRtaW46YWRtaW4=" | jq '.status' || echo "Failed"

echo ""

# Test 2: Rule type filter
echo "Test 2: Filter by rule type (alerting)"
curl -s -X GET "http://localhost:3000/api/prometheus/grafana/api/v1/rules?rule_type=alerting" \
  -H "Authorization: Basic YWRtaW46YWRtaW4=" | jq '.status' || echo "Failed"

echo ""

# Test 3: Label filter
echo "Test 3: Filter by label"
curl -s -X GET "http://localhost:3000/api/prometheus/grafana/api/v1/rules?labels=team%3Dbackend" \
  -H "Authorization: Basic YWRtaW46YWRtaW4=" | jq '.status' || echo "Failed"

echo ""

# Test 4: Multiple filters combined
echo "Test 4: Multiple filters combined"
curl -s -X GET "http://localhost:3000/api/prometheus/grafana/api/v1/rules?rule_type=alerting&group_name_search=test&exclude_plugins=true" \
  -H "Authorization: Basic YWRtaW46YWRtaW4=" | jq '.status' || echo "Failed"

echo ""
echo "Tests completed!"
