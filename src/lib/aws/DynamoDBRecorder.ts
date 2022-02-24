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
  TableAlreadyExistsException,
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
}

interface CreateTableIfNotExistsResult {
  tableCreated: boolean;
}

export class DynamoDBRecorder implements Recorder {
  private readonly dynamoDBClient: DynamoDBClient;
  private readonly dynamoDBDocumentClient: DynamoDBDocumentClient;
  private readonly tableName: string;

  constructor({
    dynamoDBClient,
    dynamoDBDocumentClient,
    tableName,
  }: DynamoDBRecorderProps) {
    this.dynamoDBClient = dynamoDBClient;
    this.dynamoDBDocumentClient = dynamoDBDocumentClient;
    this.tableName = tableName;
  }

  public async CreateEnvironmentFromSource({
    sourceEnvironmentId,
    targetEnvironmentId,
  }: CreateEnvironmentFromSourceProps): Promise<void> {
    const { tableCreated } = await this.createTableIfNotExists();

    let previouslyExecutedMigrations: Set<String>;

    if (tableCreated) {
      previouslyExecutedMigrations = new Set<String>();
    } else {
      previouslyExecutedMigrations = await this.getAllMigrationsForEnvironment(
        sourceEnvironmentId,
      );
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
        ":m": new Set<String>(migrationId),
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
        {
          AttributeName: "Migrations",
          AttributeType: "SS",
        },
      ],
      KeySchema: [
        {
          AttributeName: "EnvironmentId",
          KeyType: "HASH",
        },
      ],
    });

    try {
      await this.dynamoDBClient.send(createTableCommand);

      return {
        tableCreated: true,
      };
    } catch (e: any) {
      if (e.name && e.name === "TableAlreadyExistsException") {
        return {
          tableCreated: false,
        };
      }

      throw e;
    }
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
      throw new Error(
        `error getting migrations for environment "${environmentId}: no Item returned from DynamoDB`,
      );
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
}