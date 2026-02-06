#!/bin/bash
# Demo: Digest API Endpoint
# Shows weekly and monthly policy digests

API_URL="http://localhost:3001/v1/projects/default/regsync"

echo "=== Policy Digest API Demo ==="
echo ""

# Get current date info
YEAR=$(date +%Y)
MONTH=$(date +%m)
WEEK=$(date +%V)

echo "1. GET Weekly Digest (previous week - default)"
echo "   curl $API_URL/digest?period=week"
curl -s "$API_URL/digest?period=week" | jq '.'
echo ""

echo "2. GET Monthly Digest (previous month - default)"
echo "   curl $API_URL/digest?period=month"
curl -s "$API_URL/digest?period=month" | jq '.'
echo ""

echo "3. GET Specific Week Digest"
echo "   curl $API_URL/digest?period=week&year=$YEAR&week=$WEEK"
curl -s "$API_URL/digest?period=week&year=$YEAR&week=$WEEK" | jq '.'
echo ""

echo "4. GET Specific Month Digest"
echo "   curl $API_URL/digest?period=month&year=$YEAR&month=$MONTH"
curl -s "$API_URL/digest?period=month&year=$YEAR&month=$MONTH" | jq '.'
echo ""

echo "5. Error Case: Invalid period"
echo "   curl $API_URL/digest?period=invalid"
curl -s "$API_URL/digest?period=invalid" | jq '.'
echo ""

echo "=== Demo Complete ==="
