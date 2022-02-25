import { DynamoDBDocumentClient, TranslateConfig } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

export const mockSendFn = jest.fn();

export class MockDynamoDBDocumentClient extends DynamoDBDocumentClient {
  constructor(client: DynamoDBClient, translateConfig?: TranslateConfig) {
    super(client, translateConfig);
  }

  send = mockSendFn;
}
