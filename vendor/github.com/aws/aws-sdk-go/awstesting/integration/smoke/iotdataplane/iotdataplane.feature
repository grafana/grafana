# language: en
@iotdataplane @client
Feature: AWS IoT Data Plane

  Scenario: Handling errors
    When I attempt to call the "GetThingShadow" API with:
    | ThingName | "fakeThing" |
    Then I expect the response error code to be "InvalidRequestException"
    And I expect the response error message to include:
    """
    Invalid thing name
    """
