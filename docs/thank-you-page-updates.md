# Thank You Page Updates for Memorial Garden Form

## Summary of Changes

The thank you page now dynamically adjusts its content based on whether the application is for immediate or future placement.

### Changes for Future Placement Applications:

1. **Main Heading**: Changed to "Future Placement Application Successfully Submitted!"

2. **Application Type Display**: Shows "Future Placement" instead of just "future"

3. **Step 1 - Confirmation Email**: 
   - Updated to: "You will receive a confirmation email within 24 hours with a copy of your application and payment instructions for securing your future placement."

4. **Step 4 - Payment Processing**:
   - Title changed to: "Secure Your Placement"
   - Description: "Please submit your payment to secure your future placement rights. Your application will be kept on file until placement is needed."

5. **Step 5 - Service Coordination**:
   - Title changed to: "Future Placement Coordination"
   - Description: "When placement is needed in the future, contact the Memorial Garden Committee to coordinate service details. Please notify us at least 30 days in advance."

6. **Timeline Updates**:
   - "Upon payment:" changed to "Application approved and held on file"
   - "30+ days:" changed to "When needed: Contact committee with 30+ days notice for placement"

7. **Payment Section**:
   - Added note: "For future placements, your payment secures your placement rights. The Memorial Garden Committee will contact you when you notify them that placement is needed."

### Changes for Immediate Placement Applications:

1. **Main Heading**: "Memorial Garden Application Successfully Submitted!"

2. **Application Type Display**: Shows "Immediate Placement"

3. **Timeline Updates**:
   - "Upon payment:" shows "Service coordination begins"
   - Last timeline item: "4-6 weeks: Placement ceremony scheduled (weather permitting)"

4. **Payment Section**:
   - Added note: "For immediate placements, prompt payment helps ensure timely scheduling of the placement ceremony."

## Technical Implementation

The changes are implemented in the `showThankYouPage()` function, which checks `submittedData['Application Type']` and updates the DOM elements accordingly. This ensures that users see relevant information based on their specific application type, providing clearer expectations about the process timeline.