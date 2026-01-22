#!/bin/bash
# Example: Import structured data sources to Scour system
# Adjust the BASE_URL to your deployment (local, staging, prod)

BASE_URL="https://gnobnyzezkuyptuakztf.supabase.co/functions/v1/clever-function"

echo "=== Importing Structured Data Sources ==="
echo ""

# Import a batch of sources with structured types
curl -X POST "$BASE_URL/sources/bulk" \
  -H "Content-Type: application/json" \
  -d '[
    {
      "name": "USGS Earthquakes - Last Hour",
      "url": "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.atom",
      "type": "usgs-atom",
      "country": "USA",
      "enabled": true
    },
    {
      "name": "USGS Earthquakes - Last Day",
      "url": "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.atom",
      "type": "usgs-atom",
      "country": "USA",
      "enabled": true
    },
    {
      "name": "NWS Weather Alerts - USA",
      "url": "https://alerts.weather.gov/cap/us.php?x=1",
      "type": "cap",
      "country": "USA",
      "enabled": true
    },
    {
      "name": "NOAA NHC Tropical Cyclones",
      "url": "https://www.nhc.noaa.gov/feed.xml",
      "type": "noaa-tropical",
      "country": "USA",
      "enabled": true
    }
  ]' 2>&1 | jq .

echo ""
echo "=== Verifying Import ==="
curl -s "$BASE_URL/sources?limit=100" | jq '.sources[] | {id, name, type, url, enabled}' | head -30

echo ""
echo "=== Done ==="
