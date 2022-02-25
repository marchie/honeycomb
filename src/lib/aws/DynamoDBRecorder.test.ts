import { DynamoDBRecorder } from "./DynamoDBRecorder";
import {
  CreateTableCommand,
  CreateTableOutput,
  DynamoDBClient,
  ResourceInUseException,
} from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DeleteCommandOutput,
  DynamoDBDocumentClient,
  GetCommand,
  GetCommandOutput,
  PutCommand,
  PutCommandOutput,
  UpdateCommand,
  UpdateCommandOutput,
} from "@aws-sdk/lib-dynamodb";
import {
  MockDynamoDBClient,
  mockSendFn as mockDynamoDBClientSendFn,
} from "../../../__mocks__/@aws-sdk/client-dynamodb";
import {
  MockDynamoDBDocumentClient,
  mockSendFn as mockDynamoDBDocumentClientSendFn,
} from "../../../__mocks__/@aws-sdk/lib-dynamodb";
import { InvalidRequestException } from "@aws-sdk/client-secrets-manager";

describe("DynamoDBRecorder", () => {
  let dynamoDBClient: DynamoDBClient;
  let dynamoDBDocumentClient: DynamoDBDocumentClient;
  let tableName: string;
  let recorder: DynamoDBRecorder;

  beforeEach(() => {
    mockDynamoDBClientSendFn.mockReset();
    mockDynamoDBDocumentClientSendFn.mockReset();
    dynamoDBClient = new MockDynamoDBClient({});
    dynamoDBDocumentClient = new MockDynamoDBDocumentClient(dynamoDBClient);
    tableName = "TableName";
    recorder = new DynamoDBRecorder({
      dynamoDBClient,
      dynamoDBDocumentClient,
      tableName,
    });
  });

  describe("CreateEnvironmentFromSource", () => {
    let sourceEnvironmentId: string;
    let targetEnvironmentId: string;

    beforeEach(() => {
      sourceEnvironmentId = "source";
      targetEnvironmentId = "target";
    });

    test(`Given a DynamoDBRecorder
And a DynamoDB table does not exist
When CreateEnvironmentFromSource is called
Then a DynamoDB table is created`, async () => {
      const createTableOutput: CreateTableOutput = {};
      mockDynamoDBClientSendFn.mockResolvedValue(createTableOutput);

      const putCommandOutput: PutCommandOutput = {
        $metadata: {},
      };
      mockDynamoDBDocumentClientSendFn.mockResolvedValue(putCommandOutput);

      await recorder.CreateEnvironmentFromSource({
        sourceEnvironmentId,
        targetEnvironmentId,
      });

      const expectedCreateTableCommand = new CreateTableCommand({
        TableName: tableName,
        AttributeDefinitions: [
          {
            AttributeName: "EnvironmentId",
            AttributeType: "S",
          },
        ],
        KeySchema: [
          {
            AttributeName: "EnvironmentId",
            KeyType: "HASH",
          },
        ],
        BillingMode: "PAY_PER_REQUEST",
      });

      expect(mockDynamoDBClientSendFn.mock.calls.length).toBe(1);
      expect(JSON.stringify(mockDynamoDBClientSendFn.mock.calls[0][0])).toBe(
        JSON.stringify(expectedCreateTableCommand),
      );
      expect(mockDynamoDBDocumentClientSendFn.mock.calls.length).toBe(0);
    });

    test(`Given a DynamoDBRecorder
And a DynamoDB table exists
When CreateEnvironmentFromSource is called
Then a DynamoDB table is not created
And the DynamoDB table is queried for the migrations that have been previously executed on the source
And the DynamoDB table key for the target environment ID is populated with the returned migrations`, async () => {
      const createTableOutput: ResourceInUseException = {
        name: "ResourceInUseException",
        $fault: "client",
        $metadata: {},
      };
      mockDynamoDBClientSendFn.mockRejectedValue(createTableOutput);

      const migrationsPreviouslyExecutedAgainstSourceEnvironmentId: Set<String> =
        new Set<String>(["first-migration", "second-migration"]);

      const getCommandOutput: GetCommandOutput = {
        Item: {
          Migrations: migrationsPreviouslyExecutedAgainstSourceEnvironmentId,
        },
        ConsumedCapacity: {},
        $metadata: {},
      };
      mockDynamoDBDocumentClientSendFn.mockResolvedValueOnce(getCommandOutput);

      const putCommandOutput: PutCommandOutput = {
        $metadata: {},
      };
      mockDynamoDBDocumentClientSendFn.mockResolvedValueOnce(putCommandOutput);

      await recorder.CreateEnvironmentFromSource({
        sourceEnvironmentId,
        targetEnvironmentId,
      });

      const expectedGetCommand = new GetCommand({
        TableName: tableName,
        Key: {
          EnvironmentId: sourceEnvironmentId,
        },
        ProjectionExpression: "Migrations",
      });

      const expectedPutCommand = new PutCommand({
        TableName: tableName,
        Item: {
          EnvironmentId: targetEnvironmentId,
          Migrations: migrationsPreviouslyExecutedAgainstSourceEnvironmentId,
        },
      });

      expect(mockDynamoDBClientSendFn.mock.calls.length).toBe(1);
      expect(mockDynamoDBDocumentClientSendFn.mock.calls.length).toBe(2);
      expect(
        JSON.stringify(mockDynamoDBDocumentClientSendFn.mock.calls[0][0]),
      ).toBe(JSON.stringify(expectedGetCommand));
      expect(
        JSON.stringify(mockDynamoDBDocumentClientSendFn.mock.calls[1][0]),
      ).toBe(JSON.stringify(expectedPutCommand));
    });

    test(`Given a DynamoDBRecorder
And a DynamoDB table exists
When CreateEnvironmentFromSource is called
And there are no previous migrations
Then a DynamoDB table is not created
And the DynamoDB table is queried for the migrations that have been previously executed on the source
And the DynamoDB table key for the target environment ID is not populated with the returned migrations`, async () => {
      const createTableOutput: ResourceInUseException = {
        name: "ResourceInUseException",
        $fault: "client",
        $metadata: {},
      };
      mockDynamoDBClientSendFn.mockRejectedValue(createTableOutput);

      const getCommandOutput: GetCommandOutput = {
        ConsumedCapacity: {},
        $metadata: {},
      };
      mockDynamoDBDocumentClientSendFn.mockResolvedValueOnce(getCommandOutput);

      await recorder.CreateEnvironmentFromSource({
        sourceEnvironmentId,
        targetEnvironmentId,
      });

      const expectedGetCommand = new GetCommand({
        TableName: tableName,
        Key: {
          EnvironmentId: sourceEnvironmentId,
        },
        ProjectionExpression: "Migrations",
      });

      expect(mockDynamoDBClientSendFn.mock.calls.length).toBe(1);
      expect(mockDynamoDBDocumentClientSendFn.mock.calls.length).toBe(1);
      expect(
        JSON.stringify(mockDynamoDBDocumentClientSendFn.mock.calls[0][0]),
      ).toBe(JSON.stringify(expectedGetCommand));
    });

    test(`Given a DynamoDBRecorder
When CreateEnvironmentFromSource is called
And the create table command rejects with an unexpected error
Then no records are added to DynamoDB
And the method rejects with the error`, async () => {
      const createTableOutput: InvalidRequestException = {
        name: "InvalidRequestException",
        $fault: "client",
        $metadata: {},
      };
      mockDynamoDBClientSendFn.mockRejectedValue(createTableOutput);

      await expect(
        recorder.CreateEnvironmentFromSource({
          sourceEnvironmentId,
          targetEnvironmentId,
        }),
      ).rejects.toBe(createTableOutput);

      expect(mockDynamoDBClientSendFn.mock.calls.length).toBe(1);
      expect(mockDynamoDBDocumentClientSendFn).not.toBeCalled();
    });

    test(`Given a DynamoDBRecorder
When CreateEnvironmentFromSource is called
And the get command rejects with an unexpected error
Then no records are added to DynamoDB
And the method rejects with the error`, async () => {
      const createTableOutput: ResourceInUseException = {
        name: "ResourceInUseException",
        $fault: "client",
        $metadata: {},
      };
      mockDynamoDBClientSendFn.mockRejectedValue(createTableOutput);

      const getCommandOutput: InvalidRequestException = {
        name: "InvalidRequestException",
        $fault: "client",
        $metadata: {},
      };
      mockDynamoDBDocumentClientSendFn.mockRejectedValue(getCommandOutput);

      await expect(
        recorder.CreateEnvironmentFromSource({
          sourceEnvironmentId,
          targetEnvironmentId,
        }),
      ).rejects.toBe(getCommandOutput);

      expect(mockDynamoDBClientSendFn.mock.calls.length).toBe(1);
      expect(mockDynamoDBDocumentClientSendFn.mock.calls.length).toBe(1);
    });

    test(`Given a DynamoDBRecorder
When CreateEnvironmentFromSource is called
And the put command rejects with an error
Then the method rejects with the error`, async () => {
      const createTableOutput: ResourceInUseException = {
        name: "ResourceInUseException",
        $fault: "client",
        $metadata: {},
      };
      mockDynamoDBClientSendFn.mockRejectedValue(createTableOutput);

      const migrationsPreviouslyExecutedAgainstSourceEnvironmentId: Set<String> =
        new Set<String>(["first-migration", "second-migration"]);

      const getCommandOutput: GetCommandOutput = {
        Item: {
          Migrations: migrationsPreviouslyExecutedAgainstSourceEnvironmentId,
        },
        ConsumedCapacity: {},
        $metadata: {},
      };
      mockDynamoDBDocumentClientSendFn.mockResolvedValueOnce(getCommandOutput);

      const putCommandOutput: InvalidRequestException = {
        name: "InvalidRequestException",
        $fault: "client",
        $metadata: {},
      };
      mockDynamoDBDocumentClientSendFn.mockRejectedValueOnce(putCommandOutput);

      await expect(
        recorder.CreateEnvironmentFromSource({
          sourceEnvironmentId,
          targetEnvironmentId,
        }),
      ).rejects.toBe(putCommandOutput);

      expect(mockDynamoDBClientSendFn.mock.calls.length).toBe(1);
      expect(mockDynamoDBDocumentClientSendFn.mock.calls.length).toBe(2);
    });
  });

  describe("DeleteEnvironment", () => {
    let environmentId: string;

    beforeEach(() => {
      environmentId = "environment";
    });

    test(`Given a DynamoDBRecorder
When DeleteEnvironment is called
Then the environment record is deleted from the table`, async () => {
      const deleteCommandOutput: DeleteCommandOutput = {
        $metadata: {},
      };

      mockDynamoDBDocumentClientSendFn.mockResolvedValue(deleteCommandOutput);

      await recorder.DeleteEnvironment({
        environmentId,
      });

      const expectedDeleteCommand = new DeleteCommand({
        TableName: tableName,
        Key: {
          EnvironmentId: environmentId,
        },
      });

      expect(mockDynamoDBDocumentClientSendFn.mock.calls.length).toBe(1);
      expect(
        JSON.stringify(mockDynamoDBDocumentClientSendFn.mock.calls[0][0]),
      ).toEqual(JSON.stringify(expectedDeleteCommand));
    });

    test(`Given a DynamoDBRecorder
When DeleteEnvironment is called
And the delete command rejects with an error
Then the method rejects with the error`, async () => {
      const deleteCommandOutput: InvalidRequestException = {
        name: "InvalidRequestException",
        $fault: "client",
        $metadata: {},
      };

      mockDynamoDBDocumentClientSendFn.mockRejectedValue(deleteCommandOutput);

      await expect(
        recorder.DeleteEnvironment({
          environmentId,
        }),
      ).rejects.toBe(deleteCommandOutput);

      expect(mockDynamoDBDocumentClientSendFn.mock.calls.length).toBe(1);
    });
  });

  describe("ListAppliedMigrationsForEnvironment", () => {
    let environmentId: string;

    beforeEach(() => {
      environmentId = "environment";
    });

    test(`Given a DynamoDBRecorder
When ListAppliedMigrationsForEnvironment is called
Then the list of previously applied migrations for the environment is returned from the table`, async () => {
      const previouslyAppliedMigrations: Set<String> = new Set<String>([
        "first-migration",
        "second-migration",
      ]);

      const getCommandOutput: GetCommandOutput = {
        Item: {
          Migrations: previouslyAppliedMigrations,
        },
        ConsumedCapacity: {},
        $metadata: {},
      };
      mockDynamoDBDocumentClientSendFn.mockResolvedValue(getCommandOutput);

      await expect(
        recorder.ListAppliedMigrationsForEnvironment({
          environmentId,
        }),
      ).resolves.toBe(previouslyAppliedMigrations);

      const expectedGetCommand = new GetCommand({
        TableName: tableName,
        Key: {
          EnvironmentId: environmentId,
        },
        ProjectionExpression: "Migrations",
      });

      expect(mockDynamoDBDocumentClientSendFn.mock.calls.length).toBe(1);
      expect(
        JSON.stringify(mockDynamoDBDocumentClientSendFn.mock.calls[0][0]),
      ).toEqual(JSON.stringify(expectedGetCommand));
    });

    test(`Given a DynamoDBRecorder
When ListAppliedMigrationsForEnvironment is called
And no previous migrations are stored
Then an empty StringSet is returned`, async () => {
      const getCommandOutput: GetCommandOutput = {
        ConsumedCapacity: {},
        $metadata: {},
      };
      mockDynamoDBDocumentClientSendFn.mockResolvedValue(getCommandOutput);

      await expect(
        recorder.ListAppliedMigrationsForEnvironment({
          environmentId,
        }),
      ).resolves.toEqual(new Set<String>());
    });

    test(`Given a DynamoDBRecorder
When ListAppliedMigrationsForEnvironment is called
And the get command rejects with an error
Then the method rejects with the error`, async () => {
      const getCommandOutput: InvalidRequestException = {
        name: "InvalidRequestException",
        $fault: "client",
        $metadata: {},
      };

      mockDynamoDBDocumentClientSendFn.mockRejectedValue(getCommandOutput);

      await expect(
        recorder.ListAppliedMigrationsForEnvironment({
          environmentId,
        }),
      ).rejects.toBe(getCommandOutput);
    });
  });

  describe("PutMigration", () => {
    let environmentId: string;
    let migrationId: string;

    beforeEach(() => {
      environmentId = "environment";
      migrationId = "migration-name";
    });

    test(`Given a DynamoDBRecorder
When PutMigration is called
Then the migration ID is appended to the Migrations string set for the EnvironmentId in the table`, async () => {
      const updateCommandOutput: UpdateCommandOutput = {
        $metadata: {},
      };
      mockDynamoDBDocumentClientSendFn.mockResolvedValue(updateCommandOutput);

      await recorder.PutMigration({
        environmentId,
        migrationId,
      });

      const expectedUpdateCommand = new UpdateCommand({
        TableName: tableName,
        Key: {
          EnvironmentId: environmentId,
        },
        UpdateExpression: "ADD Migrations :m",
        ExpressionAttributeValues: {
          ":m": new Set<String>([migrationId]),
        },
        ReturnValues: "NONE",
      });

      expect(mockDynamoDBDocumentClientSendFn.mock.calls.length).toBe(1);
      expect(
        JSON.stringify(mockDynamoDBDocumentClientSendFn.mock.calls[0][0]),
      ).toEqual(JSON.stringify(expectedUpdateCommand));
    });

    test(`Given a DynamoDBRecorder
When PutMigration is called
And the update command rejects with an error
Then the method rejects with the error`, async () => {
      const updateCommandOutput: InvalidRequestException = {
        name: "InvalidRequestException",
        $fault: "client",
        $metadata: {},
      };

      mockDynamoDBDocumentClientSendFn.mockRejectedValue(updateCommandOutput);

      await expect(
        recorder.PutMigration({
          environmentId,
          migrationId,
        }),
      ).rejects.toBe(updateCommandOutput);
    });
  });
});
