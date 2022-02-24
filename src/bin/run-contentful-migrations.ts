#!/usr/bin/env node
import * as yargs from "yargs";
import { MigrationFunction, runMigration } from "contentful-migration";
import { ContentfulMigrator } from "../lib/contentful/ContentfulMigrator";
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { SecretsManager } from "../lib/aws/SecretsManager";
import { SSMClient } from "@aws-sdk/client-ssm";
import { SSM } from "../lib/aws/SSM";
import migration_001 from "../migrations/2022-02-18_16-21_create-article-content-type";
import { Client } from "../lib/contentful/Client";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { DynamoDBRecorder } from "../lib/aws/DynamoDBRecorder";

(async () => {
  const options = yargs
    .scriptName("run-contentful-migrations")
    .option("accessTokenSecretId", {
      describe:
        "AWS Secrets Manager key containing the Contentful Access Token",
      type: "string",
      default: "contentful-token",
    })
    .option("spaceIdParameterStoreName", {
      describe: "AWS Parameter Store name containing the Contentful Space ID",
      type: "string",
      default: "contentful-space-id",
    })
    .option("dynamoDBTableNameParameterStoreName", {
      describe:
        "AWS Parameter Store key containing the name of a DynamoDB table for storing migration records",
      type: "string",
      default: "contentful-migration-record-table-name",
    })
    .option("environmentId", {
      describe: "Target Environment ID",
      type: "string",
      demandOption: true,
    }).argv;
  const {
    accessTokenSecretId,
    spaceIdParameterStoreName,
    dynamoDBTableNameParameterStoreName,
    environmentId,
  } = options;

  const awsSecretsManagerClient = new SecretsManagerClient({});
  const secretsManager = new SecretsManager({
    client: awsSecretsManagerClient,
  });

  const awsSSMClient = new SSMClient({});
  const ssm = new SSM({ client: awsSSMClient });

  const dynamoDBClient = new DynamoDBClient({});
  const dynamoDBDocumentClient = DynamoDBDocumentClient.from(dynamoDBClient);

  try {
    const [accessToken, spaceId, tableName] = await Promise.all([
      secretsManager.getSecretString(accessTokenSecretId),
      ssm.getParameterString(spaceIdParameterStoreName),
      ssm.getParameterString(dynamoDBTableNameParameterStoreName),
    ]);

    const managementClient = Client({
      accessToken,
    });

    const recorder = new DynamoDBRecorder({
      dynamoDBClient,
      dynamoDBDocumentClient,
      tableName,
    });

    const migrator = new ContentfulMigrator({
      runMigration,
      managementClient,
      accessToken,
      spaceId,
      recorder,
    });

    const migrationFunctions: MigrationFunction[] = [migration_001];

    await migrator.RunMigrations({
      migrationFunctions,
      spaceId,
      environmentId,
    });

    console.log(
      `${migrationFunctions.length} Contentful migration function${
        migrationFunctions.length !== 1 ? "s" : ""
      } ran successfully`,
    );
  } catch (e) {
    console.error(`Error running Contentful migrations: ${e}`);
  }
})();
