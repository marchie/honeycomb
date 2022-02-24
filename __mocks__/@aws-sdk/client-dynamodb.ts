import { DynamoDBClient, DynamoDBClientConfig } from "@aws-sdk/client-dynamodb";

export const mockSendFn = jest.fn();

export class MockDynamoDBClient extends DynamoDBClient {
  constructor(props: DynamoDBClientConfig) {
    super(props);
  }

  send = mockSendFn;
}
