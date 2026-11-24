Feature: Campus Resource Reservation Engine

  Scenario: Student successfully reserves an available study room
    Given the student is on the home page
    When they filter resources by type "ROOM"
    And they select "Study Room 302"
    And they submit a reservation for tomorrow at "10:00 AM"
    Then they should see "Reservation Confirmed"
    And the reservation should appear in their "My Bookings" list

  Scenario: Student receives conflict alert on double-booking
    Given "3D Printer A" is already reserved for tomorrow at "2:00 PM"
    When another student attempts to reserve the same resource for the same time slot
    Then they should see a conflict alert "Resource unavailable for selected time"
    And the reservation should not be created
