#!/bin/bash

curl -X POST https://unified-system.vercel.app/api/memorial/submit-garden \
  -H "Content-Type: application/json" \
  -H "Origin: https://bvaadmin.github.io" \
  -d '{
    "properties": {
      "Submission ID": "FUTURE-TEST-5678",
      "Submission Date": "2025-08-13T10:00:00Z",
      "Status": "Pending",
      "Application Type": "future",
      "Placement Type": "single",
      "Bay View Member": "Yes",
      "Member Name": "Test Member",
      "Contact Name": "Test User",
      "Contact Email": "test@example.com",
      "Contact Phone": "555-0000",
      "Contact Address": "123 Test St",
      "Fee Amount": "400",
      "Policy Agreement": "__YES__",
      "Prepayment Person 1": "Future Person One",
      "Prepayment Person 2": ""
    }
  }' | python3 -m json.tool