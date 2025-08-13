#!/bin/bash

curl -X POST https://unified-system.vercel.app/api/memorial/submit-garden \
  -H "Content-Type: application/json" \
  -H "Origin: https://bvaadmin.github.io" \
  -d '{
    "properties": {
      "Submission ID": "IMMEDIATE-TEST-1234",
      "Submission Date": "2025-08-13T10:00:00Z",
      "Status": "Pending",
      "Application Type": "immediate",
      "Bay View Member": "Yes",
      "Contact Name": "Test User",
      "Contact Email": "test@example.com",
      "Contact Phone": "555-0000",
      "Contact Address": "123 Test St",
      "Fee Amount": "400",
      "Policy Agreement": "__YES__",
      "Deceased Name": "John Doe",
      "First Name": "John",
      "Last Name": "Doe",
      "Personal History JSON": "{\"firstName\":\"John\",\"lastName\":\"Doe\"}"
    }
  }' | python3 -m json.tool