#!/usr/bin/env node
import * as yargs from "yargs";
import { Client } from "../lib/contentful/Client";
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { SecretsManager } from "../lib/aws/SecretsManager";
import { SSMClient } from "@aws-sdk/client-ssm";
import { SSM } from "../lib/aws/SSM";
import { ContentfulMigrator } from "../lib/contentful/ContentfulMigrator";
import { runMigration } from "contentful-migration";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { DynamoDBRecorder } from "../lib/aws/DynamoDBRecorder";

(async () => {
  const options = yargs
    .scriptName("set-contentful-environment-as-master")
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
      describe: "Contentful environment to set as the master",
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

    const masterEnvironmentId = await migrator.SetEnvironmentAsMaster({
      environmentId,
    });

    console.log(
      `Set Contentful master environment to "${masterEnvironmentId}"`,
    );
  } catch (e) {
    console.error(
      `Error setting Contentful environment "${environmentId}" as "master": ${e}`,
    );
  }
})();
