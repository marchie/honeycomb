#!/usr/bin/env node
import * as yargs from "yargs";
import { runMigration } from "contentful-migration";
import { Client } from "../lib/contentful/Client";
import { ContentfulMigrator } from "../lib/contentful/ContentfulMigrator";
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { SecretsManager } from "../lib/aws/SecretsManager";
import { SSMClient } from "@aws-sdk/client-ssm";
import { SSM } from "../lib/aws/SSM";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { DynamoDBRecorder } from "../lib/aws/DynamoDBRecorder";

(async () => {
  const options = yargs
    .scriptName("create-contentful-environment")
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
    .option("sourceEnvironmentId", {
      describe:
        "Source Contentful environment that is the basis for the new environment",
      type: "string",
      default: "master",
    })
    .option("targetEnvironmentId", {
      describe: "Name of the new Contentful environment",
      type: "string",
      demandOption: true,
    }).argv;

  const {
    accessTokenSecretId,
    spaceIdParameterStoreName,
    sourceEnvironmentId,
    targetEnvironmentId,
    dynamoDBTableNameParameterStoreName,
  } = options;

  const awsSecretsManagerClient = new SecretsManagerClient({});
  const secretsManager = new SecretsManager({
    client: awsSecretsManagerClient,
  });

  const awsSSMClient = new SSMClient({});
  const ssm = new SSM({ client: awsSSMClient });

  const dynamoDBClient = new DynamoDBClient({});
  const dynamoDBDocumentClient = DynamoDBDocumentClient.from(
    dynamoDBClient,
    {},
  );

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

    const createdEnvironmentName = await migrator.CreateEnvironmentFromSource({
      sourceEnvironmentId,
      targetEnvironmentId,
    });

    console.log(`Created Contentful environment "${createdEnvironmentName}"`);
  } catch (e) {
    console.error(`Error creating Contentful environment: ${e}`);
  }
})();
