#!/usr/bin/env node
import * as yargs from "yargs";
import { runMigration } from "contentful-migration";
import { ContentfulMigrator } from "../lib/contentful/ContentfulMigrator";
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { SecretsManager } from "../lib/aws/SecretsManager";
import { SSMClient } from "@aws-sdk/client-ssm";
import { SSM } from "../lib/aws/SSM";
import { Client } from "../lib/contentful/Client";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { DynamoDBRecorder } from "../lib/aws/DynamoDBRecorder";
import { readdir } from "fs/promises";
import { resolve } from "path";

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
    })
    .option("migrationsDirectory", {
      describe: "The local directory containing the migrations files",
      type: "string",
      demandOption: true,
    }).argv;
  const {
    accessTokenSecretId,
    spaceIdParameterStoreName,
    dynamoDBTableNameParameterStoreName,
    environmentId,
    migrationsDirectory,
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
    const [accessToken, spaceId, tableName, migrationFiles] = await Promise.all(
      [
        secretsManager.getSecretString(accessTokenSecretId),
        ssm.getParameterString(spaceIdParameterStoreName),
        ssm.getParameterString(dynamoDBTableNameParameterStoreName),
        readdir(resolve(migrationsDirectory)),
      ],
    );

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

    const migrationFilePaths: string[] = [];

    for (const file of migrationFiles) {
      migrationFilePaths.push(resolve(migrationsDirectory, file));
    }

    const executedMigrations = await migrator.RunMigrations({
      migrationFilePaths,
      environmentId,
    });

    console.log(`${executedMigrations.length} migration(s) ran successfully:
${executedMigrations.join("\n")}`);
  } catch (e) {
    console.error(`Error running Contentful migrations: ${e}`);
  }
})();
