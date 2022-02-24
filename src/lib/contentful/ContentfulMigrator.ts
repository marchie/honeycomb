import { RunMigrationConfig } from "contentful-migration";
import { OptionalDefaults } from "contentful-management/dist/typings/plain/wrappers/wrap";
import {
  GetSpaceEnvAliasParams,
  GetSpaceEnvironmentParams,
} from "contentful-management/dist/typings/common-types";
import {
  CreateEnvironmentProps,
  EnvironmentProps,
} from "contentful-management/dist/typings/entities/environment";
import { AxiosRequestHeaders } from "axios";
import { EnvironmentAliasProps } from "contentful-management/dist/typings/entities/environment-alias";
import {
  CreateEnvironmentFromSourceProps,
  DeleteEnvironmentProps,
  Migrator,
  RunMigrationsProps,
  SetEnvironmentAsMasterProps,
  TestEnvironmentProps,
} from "../migrator";
import { Recorder } from "../recorder";
import { parse as ParsePath } from "path";

export interface ContentfulMigratorProps {
  runMigration: (config: RunMigrationConfig) => Promise<any>;
  managementClient: ManagementClient;
  accessToken: string;
  spaceId: string;
  recorder: Recorder;
}

interface CheckIfEnvironmentIsMasterProps {
  environmentId: string;
}

export interface ManagementClient {
  environment: {
    get(
      params: OptionalDefaults<GetSpaceEnvironmentParams>,
    ): Promise<EnvironmentProps>;
    createWithId(
      params: OptionalDefaults<
        GetSpaceEnvironmentParams & {
          sourceEnvironmentId?: string;
        }
      >,
      rawData: CreateEnvironmentProps,
      headers?: AxiosRequestHeaders,
    ): Promise<EnvironmentProps>;
    delete(params: OptionalDefaults<GetSpaceEnvironmentParams>): Promise<any>;
  };
  environmentAlias: {
    get(
      params: OptionalDefaults<GetSpaceEnvAliasParams>,
    ): Promise<EnvironmentAliasProps>;
    update(
      params: OptionalDefaults<GetSpaceEnvAliasParams>,
      rawData: EnvironmentAliasProps,
      headers?: AxiosRequestHeaders,
    ): Promise<EnvironmentAliasProps>;
  };
}

export class ContentfulMigrator implements Migrator {
  private readonly runMigration: (config: RunMigrationConfig) => Promise<any>;
  private readonly managementClient: ManagementClient;
  private readonly accessToken: string;
  private readonly spaceId: string;
  private readonly recorder: Recorder;

  constructor({
    runMigration,
    managementClient,
    accessToken,
    spaceId,
    recorder,
  }: ContentfulMigratorProps) {
    this.runMigration = runMigration;
    this.managementClient = managementClient;
    this.accessToken = accessToken;
    this.spaceId = spaceId;
    this.recorder = recorder;
  }

  public async CreateEnvironmentFromSource({
    sourceEnvironmentId,
    targetEnvironmentId,
  }: CreateEnvironmentFromSourceProps): Promise<string> {
    const createdEnvironment =
      await this.managementClient.environment.createWithId(
        {
          spaceId: this.spaceId,
          environmentId: targetEnvironmentId,
          sourceEnvironmentId: sourceEnvironmentId,
        },
        {
          name: targetEnvironmentId,
        },
      );

    await this.recorder.CreateEnvironmentFromSource({
      sourceEnvironmentId,
      targetEnvironmentId,
    });

    return createdEnvironment.name;
  }

  public async RunMigrations({
    migrationFilePaths,
    environmentId,
  }: RunMigrationsProps): Promise<string[]> {
    const environmentIsMaster = await this.checkIfEnvironmentIsMaster({
      environmentId,
    });
    if (environmentIsMaster) {
      throw new Error(
        `cannot run migrations on environment "${environmentId}": environment is the current master environment`,
      );
    }

    const previouslyAppliedMigrations =
      await this.recorder.ListAppliedMigrationsForEnvironment({
        environmentId,
      });

    const newlyExecutedMigrations = [];

    for (const filePath of migrationFilePaths) {
      const migrationId = this.getMigrationIdFromFilePath(filePath);

      if (previouslyAppliedMigrations.has(migrationId)) {
        continue;
      }

      await this.runMigration({
        filePath,
        accessToken: this.accessToken,
        spaceId: this.spaceId,
        environmentId,
        yes: true,
      });

      await this.recorder.PutMigration({
        environmentId,
        migrationId,
      });

      newlyExecutedMigrations.push(filePath);
    }

    return newlyExecutedMigrations;
  }

  public async TestEnvironment({
    environmentId,
    testFunction,
  }: TestEnvironmentProps): Promise<boolean> {
    return false;
  }

  public async SetEnvironmentAsMaster({
    environmentId,
  }: SetEnvironmentAsMasterProps): Promise<string> {
    const alias = await this.managementClient.environmentAlias.get({
      spaceId: this.spaceId,
      environmentAliasId: "master",
    });

    alias.environment.sys.id = environmentId;

    const updatedAlias = await this.managementClient.environmentAlias.update(
      {
        spaceId: this.spaceId,
        environmentAliasId: "master",
      },
      {
        ...alias,
      },
    );

    return updatedAlias.environment.sys.id;
  }

  public async DeleteEnvironment({
    environmentId,
  }: DeleteEnvironmentProps): Promise<string> {
    await this.managementClient.environment.delete({
      spaceId: this.spaceId,
      environmentId,
    });

    await this.recorder.DeleteEnvironment({
      environmentId,
    });

    return environmentId;
  }

  private async checkIfEnvironmentIsMaster({
    environmentId,
  }: CheckIfEnvironmentIsMasterProps): Promise<boolean> {
    const environment = await this.managementClient.environment.get({
      spaceId: this.spaceId,
      environmentId,
    });

    return (
      !!environment.sys.aliases &&
      environment.sys.aliases.length > 0 &&
      environment.sys.aliases[0].sys.id === "master"
    );
  }

  private getMigrationIdFromFilePath(filePath: string): string {
    const { name } = ParsePath(filePath);

    return name;
  }
}
