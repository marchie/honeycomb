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
import { Migrator, SetEnvironmentAsMasterResult } from "../lib/migrator";
import { readdir } from "fs/promises";
import { resolve } from "path";
import { Tester } from "../lib/tester";
import { ContentfulTester } from "../lib/contentful/ContentfulTester";

(async () => {
  const options = yargs
    .scriptName("pipeline")
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
    .option("timeoutForDynamoDBTableToBecomeActive", {
      describe:
        "The maximum number of seconds to wait when creating a DynamoDB table for it to become active",
      type: "number",
      default: 30,
    })
    .option("targetEnvironmentId", {
      describe: "Name of the new Contentful environment",
      type: "string",
      demandOption: true,
    })
    .option("migrationsDirectory", {
      describe: "The local directory containing the migrations files",
      type: "string",
      demandOption: true,
    })
    .option("testsDirectory", {
      describe: "Directory containing integration tests",
      type: "string",
      demandOption: true,
    }).argv;

  const {
    accessTokenSecretId,
    spaceIdParameterStoreName,
    dynamoDBTableNameParameterStoreName,
    timeoutForDynamoDBTableToBecomeActive,
    targetEnvironmentId,
    migrationsDirectory,
    testsDirectory,
  } = options;

  const AttemptTidyUp = async (
    migrator: Migrator,
    targetEnvironmentId: string,
  ) => {
    try {
      console.log(
        `Attempt tidy up: Contentful environment "${targetEnvironmentId}": - attempting to delete this environment...`,
      );

      await migrator.DeleteEnvironment({
        environmentId: targetEnvironmentId,
      });

      console.log(
        `Attempt tidy up: Deleted Contentful environment "${targetEnvironmentId}"`,
      );
    } catch (e) {
      console.error(
        `Attempt tidy up: Contentful environment "${targetEnvironmentId}" was not deleted: ${e}`,
      );
    }
  };

  const AttemptRevertMasterEnvironmentAlias = async (
    migrator: Migrator,
    targetEnvironmentId: string,
  ) => {
    try {
      console.log(
        `Reverting "master" environment to ${targetEnvironmentId}...`,
      );

      await migrator.SetEnvironmentAsMaster({
        environmentId: targetEnvironmentId,
      });

      console.log(`Reverted "master" environment to "${targetEnvironmentId}"`);
    } catch (e) {
      console.error(
        `Error reverting "master" environment to ${targetEnvironmentId} - MANUAL TIDY UP REQUIRED!`,
      );

      process.exit(999);
    }
  };

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

  let migrator: Migrator;
  let tester: Tester;
  const migrationFilePaths: string[] = [];

  try {
    console.log(`Initialising pipeline...`);
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
      timeoutForDynamoDBTableToBecomeActive,
    });

    migrator = new ContentfulMigrator({
      runMigration,
      managementClient,
      accessToken,
      spaceId,
      recorder,
    });

    for (const file of migrationFiles) {
      migrationFilePaths.push(resolve(migrationsDirectory, file));
    }

    tester = new ContentfulTester({
      testsDirectory,
      accessToken,
      spaceId,
    });

    console.log(`Pipeline initialised!`);
  } catch (e) {
    console.error(`Error initialising pipeline: ${e}`);
    process.exit(1);
  }

  let sourceEnvironmentId: string;

  try {
    console.log(`Getting current Contentful master environment ID...`);

    sourceEnvironmentId = await migrator.GetCurrentMasterEnvironmentId();

    console.log(
      `Got current Contentful master environment ID: "${sourceEnvironmentId}"`,
    );
  } catch (e) {
    console.error(`Error getting Contentful master environment ID: ${e}`);
    process.exit(2);
  }

  try {
    console.log(
      `Creating new Contentful environment "${targetEnvironmentId}" from "${sourceEnvironmentId}"...`,
    );
    await migrator.CreateEnvironmentFromSource({
      sourceEnvironmentId,
      targetEnvironmentId,
    });

    console.log(
      `Created new Contentful environment "${targetEnvironmentId}" from "${sourceEnvironmentId}"`,
    );
  } catch (e) {
    console.error(
      `Error creating new Contentful environment "${targetEnvironmentId}" from "${sourceEnvironmentId}": ${e}`,
    );

    await AttemptTidyUp(migrator, targetEnvironmentId);

    process.exit(3);
  }

  try {
    console.log(
      `Running migrations against Contentful environment "${targetEnvironmentId}"...`,
    );

    const executedMigrations = await migrator.RunMigrations({
      migrationFilePaths,
      environmentId: targetEnvironmentId,
    });

    const numberOfExecutedMigrations = executedMigrations.length;
    const numberOfSkippedMigrations =
      migrationFilePaths.length - executedMigrations.length;

    console.log(
      `Executed ${numberOfExecutedMigrations} migration${
        numberOfExecutedMigrations !== 1 ? "s" : ""
      }`,
    );
    for (const executedMigration of executedMigrations) {
      console.log(`- ${executedMigration}`);
    }
    console.log(
      `(${numberOfSkippedMigrations} migration${
        numberOfSkippedMigrations !== 1 ? "s" : ""
      } skipped)`,
    );
  } catch (e) {
    console.error(
      `Error executing migrations on environment "${targetEnvironmentId}": ${e}`,
    );

    await AttemptTidyUp(migrator, targetEnvironmentId);

    process.exit(4);
  }

  let integrationTestsPassingAgainstEnvironment: boolean;

  try {
    console.log(
      `Running integration tests on environment "${targetEnvironmentId}"...`,
    );

    integrationTestsPassingAgainstEnvironment = await migrator.TestEnvironment({
      environmentId: targetEnvironmentId,
      tester,
    });
  } catch (e) {
    console.error(
      `Error running integration tests against environment "${targetEnvironmentId}": ${e}`,
    );

    await AttemptTidyUp(migrator, targetEnvironmentId);

    process.exit(5);
  }

  if (!integrationTestsPassingAgainstEnvironment) {
    console.error(
      `Integration tests failed on environment "${targetEnvironmentId}"`,
    );

    await AttemptTidyUp(migrator, targetEnvironmentId);

    process.exit(6);
  }

  console.log(
    `Integrations tests passed on environment "${targetEnvironmentId}"`,
  );

  let setEnvironmentAsMasterResult: SetEnvironmentAsMasterResult;

  try {
    console.log(
      `Switching Contentful master environment alias to "${targetEnvironmentId}"`,
    );

    setEnvironmentAsMasterResult = await migrator.SetEnvironmentAsMaster({
      environmentId: targetEnvironmentId,
    });

    const { newMasterEnvironmentId } = setEnvironmentAsMasterResult;

    console.log(
      `Set Contentful master environment alias to "${newMasterEnvironmentId}"`,
    );
  } catch (e) {
    console.error(
      `Error switching Contentful master environment alias to "${targetEnvironmentId}: ${e}`,
    );

    await AttemptTidyUp(migrator, targetEnvironmentId);

    process.exit(7);
  }

  const { oldMasterEnvironmentId, newMasterEnvironmentId } =
    setEnvironmentAsMasterResult;

  let integrationTestsPassingAgainstMaster: boolean;

  try {
    console.log(`Running integration tests on "master" environment...`);

    integrationTestsPassingAgainstMaster = await migrator.TestEnvironment({
      environmentId: "master",
      tester,
    });
  } catch (e) {
    console.error(
      `Error running integration tests against "master" environment: ${e}`,
    );

    await AttemptRevertMasterEnvironmentAlias(migrator, oldMasterEnvironmentId);

    await AttemptTidyUp(migrator, newMasterEnvironmentId);

    process.exit(8);
  }

  if (!integrationTestsPassingAgainstMaster) {
    console.error(`Integration tests failed on "master" environment`);

    await AttemptRevertMasterEnvironmentAlias(migrator, oldMasterEnvironmentId);

    await AttemptTidyUp(migrator, newMasterEnvironmentId);

    process.exit(9);
  }

  console.log(`Integration tests passed on "master" environment`);

  try {
    console.log(`Deleting old environment "${oldMasterEnvironmentId}"...`);

    const deletedEnvironmentId = await migrator.DeleteEnvironment({
      environmentId: oldMasterEnvironmentId,
    });

    console.log(`Deleted old environment "${deletedEnvironmentId}"`);
  } catch (e) {
    console.error(
      `Error deleting old environment "${oldMasterEnvironmentId}: ${e}`,
    );

    process.exit(10);
  }

  console.log(`Pipeline completed successfully!`);

  process.exit(0);
})();
