import {
  CreateEnvironmentFromSourceProps,
  DeleteEnvironmentProps,
  ListAppliedMigrationsForEnvironmentProps,
  PutMigrationProps,
  Recorder,
} from "../recorder";
import {
  CreateTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

export interface DynamoDBRecorderProps {
  dynamoDBClient: DynamoDBClient;
  dynamoDBDocumentClient: DynamoDBDocumentClient;
  tableName: string;
  timeoutForDynamoDBTableToBecomeActive: number;
}

interface CreateTableIfNotExistsResult {
  tableCreated: boolean;
}

export class DynamoDBRecorder implements Recorder {
  private readonly dynamoDBClient: DynamoDBClient;
  private readonly dynamoDBDocumentClient: DynamoDBDocumentClient;
  private readonly tableName: string;
  private readonly timeoutForDynamoDBTableToBecomeActive: number;

  constructor({
    dynamoDBClient,
    dynamoDBDocumentClient,
    tableName,
    timeoutForDynamoDBTableToBecomeActive,
  }: DynamoDBRecorderProps) {
    this.dynamoDBClient = dynamoDBClient;
    this.dynamoDBDocumentClient = dynamoDBDocumentClient;
    this.tableName = tableName;
    this.timeoutForDynamoDBTableToBecomeActive =
      timeoutForDynamoDBTableToBecomeActive;
  }

  public async CreateEnvironmentFromSource({
    sourceEnvironmentId,
    targetEnvironmentId,
  }: CreateEnvironmentFromSourceProps): Promise<void> {
    const { tableCreated } = await this.createTableIfNotExists();

    if (tableCreated) {
      return;
    }

    const previouslyExecutedMigrations =
      await this.getAllMigrationsForEnvironment(sourceEnvironmentId);

    if (previouslyExecutedMigrations.size === 0) {
      return;
    }

    await this.putAllMigrationsForEnvironment(
      targetEnvironmentId,
      previouslyExecutedMigrations,
    );
  }

  public async DeleteEnvironment({
    environmentId,
  }: DeleteEnvironmentProps): Promise<void> {
    const deleteCommand = new DeleteCommand({
      TableName: this.tableName,
      Key: {
        EnvironmentId: environmentId,
      },
    });

    await this.dynamoDBDocumentClient.send(deleteCommand);
  }

  public async ListAppliedMigrationsForEnvironment({
    environmentId,
  }: ListAppliedMigrationsForEnvironmentProps): Promise<Set<String>> {
    return await this.getAllMigrationsForEnvironment(environmentId);
  }

  public async PutMigration({
    environmentId,
    migrationId,
  }: PutMigrationProps): Promise<void> {
    const updateCommand = new UpdateCommand({
      TableName: this.tableName,
      Key: {
        EnvironmentId: environmentId,
      },
      UpdateExpression: "ADD Migrations :m",
      ExpressionAttributeValues: {
        ":m": new Set<String>([migrationId]),
      },
      ReturnValues: "NONE",
    });

    await this.dynamoDBDocumentClient.send(updateCommand);
  }

  private async createTableIfNotExists(): Promise<CreateTableIfNotExistsResult> {
    const createTableCommand = new CreateTableCommand({
      TableName: this.tableName,
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

    try {
      await this.dynamoDBClient.send(createTableCommand);
    } catch (e: any) {
      if (e.name && e.name === "ResourceInUseException") {
        return {
          tableCreated: false,
        };
      }

      throw e;
    }

    await this.waitForTableToBeActive();

    return {
      tableCreated: true,
    };
  }

  private async getAllMigrationsForEnvironment(
    environmentId: string,
  ): Promise<Set<String>> {
    const getMigrationsCommand = new GetCommand({
      TableName: this.tableName,
      Key: {
        EnvironmentId: environmentId,
      },
      ProjectionExpression: "Migrations",
    });
    const { Item } = await this.dynamoDBDocumentClient.send(
      getMigrationsCommand,
    );

    if (!Item) {
      return new Set<String>();
    }

    return Item.Migrations;
  }

  private async putAllMigrationsForEnvironment(
    environmentId: string,
    migrations: Set<String>,
  ): Promise<void> {
    const putMigrationsCommand = new PutCommand({
      TableName: this.tableName,
      Item: {
        EnvironmentId: environmentId,
        Migrations: migrations,
      },
    });

    await this.dynamoDBDocumentClient.send(putMigrationsCommand);
  }

  private async waitForTableToBeActive(): Promise<void> {
    const describeTableCommand = new DescribeTableCommand({
      TableName: this.tableName,
    });

    for (let i = 0; i < this.timeoutForDynamoDBTableToBecomeActive; i++) {
      const tableDescription = await this.dynamoDBClient.send(
        describeTableCommand,
      );

      if (!tableDescription.Table) {
        throw new Error(
          `no table description returned for "${this.tableName}"`,
        );
      }

      if (tableDescription.Table.TableStatus === "ACTIVE") {
        return;
      }

      await new Promise((resolve) => {
        const id = setTimeout(() => {
          clearTimeout(id);
          resolve(null);
        }, 1000);
      });
    }

    throw new Error(
      `table "${this.tableName}" was not active within ${this.timeoutForDynamoDBTableToBecomeActive} seconds`,
    );
  }
}
