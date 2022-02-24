import { MigrationFunction, RunMigrationConfig } from "contentful-migration";
import { ManagementClient, ContentfulMigrator } from "./ContentfulMigrator";
import {
  MockRecorder,
  mockCreateEnvironmentFromSource,
  mockDeleteEnvironment,
  mockListAppliedMigrationsFromEnvironment,
  mockPutMigration,
} from "../__mocks__/recorder";
import { Recorder } from "../recorder";

describe("Contentful Migrator", () => {
  let runMigration: (config: RunMigrationConfig) => Promise<any>;
  let managementClient: ManagementClient;
  let accessToken: string;
  let spaceId: string;
  let migrator: ContentfulMigrator;
  let recorder: Recorder;

  beforeEach(() => {
    runMigration = jest.fn();
    managementClient = {
      environment: {
        get: jest.fn(),
        createWithId: jest.fn(),
        delete: jest.fn(),
      },
      environmentAlias: {
        get: jest.fn(),
        update: jest.fn(),
      },
    };
    accessToken = "abc123";
    spaceId = "space-id";
    mockCreateEnvironmentFromSource.mockReset();
    mockDeleteEnvironment.mockReset();
    mockListAppliedMigrationsFromEnvironment.mockReset();
    mockPutMigration.mockReset();

    recorder = new MockRecorder();
  });

  describe("CreateEnvironmentFromSource", () => {
    let sourceEnvironmentId: string;
    let targetEnvironmentId: string;
    let mockCreateWithId: jest.Mock;

    beforeEach(() => {
      sourceEnvironmentId = "master";
      targetEnvironmentId = "release";

      mockCreateWithId = jest.fn();
      managementClient.environment.createWithId = mockCreateWithId;

      mockCreateWithId.mockResolvedValue({
        name: targetEnvironmentId,
      });

      mockCreateEnvironmentFromSource.mockResolvedValue(null);

      migrator = new ContentfulMigrator({
        runMigration,
        managementClient,
        accessToken,
        spaceId,
        recorder,
      });
    });

    test(`Given a Contentful Migrator
When CreateEnvironmentFromSource is called
Then a new environment is created in the Contentful space`, async () => {
      await migrator.CreateEnvironmentFromSource({
        sourceEnvironmentId,
        targetEnvironmentId,
      });

      expect(runMigration).not.toBeCalled();
      expect(mockCreateWithId.mock.calls.length).toBe(1);
      expect(mockCreateWithId.mock.calls[0][0]).toEqual({
        spaceId,
        environmentId: targetEnvironmentId,
        sourceEnvironmentId: sourceEnvironmentId,
      });
      expect(mockCreateWithId.mock.calls[0][1]).toEqual({
        name: targetEnvironmentId,
      });
    });

    test(`Given a Contentful Migrator
When CreateEnvironmentFromSource is called
Then a record of the new environment is created`, async () => {
      await migrator.CreateEnvironmentFromSource({
        sourceEnvironmentId,
        targetEnvironmentId,
      });

      expect(mockCreateEnvironmentFromSource.mock.calls.length).toBe(1);
      expect(mockCreateEnvironmentFromSource.mock.calls[0][0]).toEqual({
        sourceEnvironmentId,
        targetEnvironmentId,
      });
    });

    test(`Given a Contentful Migrator
When CreateEnvironmentFromSource is called
Then the name of the created environment is resolved`, async () => {
      await expect(
        migrator.CreateEnvironmentFromSource({
          sourceEnvironmentId,
          targetEnvironmentId,
        }),
      ).resolves.toBe(targetEnvironmentId);
    });

    test(`Given a Contentful Migrator
When CreateEnvironmentFromSource is called
And the Contentful Management client rejects
Then a record of the new environment is not created
And the method rejects`, async () => {
      const expectedError = new Error("FUBAR");

      mockCreateWithId.mockRejectedValue(expectedError);

      await expect(
        migrator.CreateEnvironmentFromSource({
          sourceEnvironmentId,
          targetEnvironmentId,
        }),
      ).rejects.toBe(expectedError);

      expect(mockCreateEnvironmentFromSource).not.toBeCalled();
    });

    test(`Given a Contentful Migrator
When CreateEnvironmentFromSource is called
And the recorder method rejects
Then the method rejects`, async () => {
      const expectedError = new Error("FUBAR");

      mockCreateEnvironmentFromSource.mockRejectedValue(expectedError);

      await expect(
        migrator.CreateEnvironmentFromSource({
          sourceEnvironmentId,
          targetEnvironmentId,
        }),
      ).rejects.toBe(expectedError);

      expect(mockCreateEnvironmentFromSource.mock.calls.length).toBe(1);
    });
  });

  describe("RunMigrations", () => {
    let migrationFilePaths: string[];
    let environmentId: string;
    let mockRunMigration: jest.Mock;
    let mockGetEnvironment: jest.Mock;

    beforeEach(() => {
      mockRunMigration = jest.fn().mockResolvedValue(null);

      migrator = new ContentfulMigrator({
        runMigration: mockRunMigration,
        managementClient,
        accessToken,
        spaceId,
        recorder,
      });

      migrationFilePaths = [
        "path/to/2022-02-24_16-32-00_previouslyRunMigration.ts",
        "path/to/2022-02-24_16-32-01_previouslyRunMigration.ts",
        "path/to/2022-02-24_16-32-02_migration.ts",
        "path/to/2022-02-24_16-32-03_migration.ts",
        "a/different/path/to/2022-02-24_16-32-04_migration.ts",
      ];
      environmentId = "release";

      mockGetEnvironment = jest.fn();
      managementClient.environment.get = mockGetEnvironment;

      mockGetEnvironment.mockResolvedValue({
        sys: {},
      });

      mockListAppliedMigrationsFromEnvironment.mockResolvedValue(
        new Set<String>([
          "2022-02-24_16-32-00_previouslyRunMigration",
          "2022-02-24_16-32-01_previouslyRunMigration",
        ]),
      );

      mockPutMigration.mockResolvedValue(null);
    });

    test(`Given a Contentful Migrator
When RunMigrations is called
Then the environment is retrieved from Contentful`, async () => {
      await migrator.RunMigrations({
        migrationFilePaths,
        environmentId,
      });

      expect(mockGetEnvironment.mock.calls.length).toBe(1);
      expect(mockGetEnvironment.mock.calls[0][0]).toEqual({
        spaceId,
        environmentId,
      });
    });

    test(`Given a Contentful Migrator
When RunMigrations is called
And the provided environment ID is the master environment
Then the method rejects with an error`, async () => {
      mockGetEnvironment.mockResolvedValue({
        sys: {
          aliases: [
            {
              sys: {
                id: "master",
              },
            },
          ],
        },
      });

      await expect(
        migrator.RunMigrations({
          migrationFilePaths,
          environmentId,
        }),
      ).rejects.toThrowError(
        `cannot run migrations on environment "${environmentId}": environment is the current master environment`,
      );
    });

    test(`Given a Contentful Migrator
When RunMigrations is called
And the provided environment ID is the master environment
Then previously run migrations are not retrieved`, async () => {
      mockGetEnvironment.mockResolvedValue({
        sys: {
          aliases: [
            {
              sys: {
                id: "master",
              },
            },
          ],
        },
      });

      await expect(
        migrator.RunMigrations({
          migrationFilePaths,
          environmentId,
        }),
      ).rejects.toThrow();

      expect(mockListAppliedMigrationsFromEnvironment).not.toBeCalled();
    });

    test(`Given a Contentful Migrator
When RunMigrations is called
And the provided environment ID is the master environment
Then no runMigration functions are called`, async () => {
      mockGetEnvironment.mockResolvedValue({
        sys: {
          aliases: [
            {
              sys: {
                id: "master",
              },
            },
          ],
        },
      });

      await expect(
        migrator.RunMigrations({
          migrationFilePaths,
          environmentId,
        }),
      ).rejects.toThrow();

      expect(mockRunMigration).not.toBeCalled();
    });

    test(`Given a Contentful Migrator
When RunMigrations is called
And the provided environment ID is the master environment
Then the migration is not recorded`, async () => {
      mockGetEnvironment.mockResolvedValue({
        sys: {
          aliases: [
            {
              sys: {
                id: "master",
              },
            },
          ],
        },
      });

      await expect(
        migrator.RunMigrations({
          migrationFilePaths,
          environmentId,
        }),
      ).rejects.toThrow();

      expect(mockPutMigration).not.toBeCalled();
    });

    test(`Given a Contentful Migrator
When RunMigrations is called
Then previously run migrations for the environment are retrieved from the recorder`, async () => {
      await migrator.RunMigrations({
        migrationFilePaths,
        environmentId,
      });

      expect(mockListAppliedMigrationsFromEnvironment.mock.calls.length).toBe(
        1,
      );
      expect(mockListAppliedMigrationsFromEnvironment.mock.calls[0][0]).toEqual(
        {
          environmentId,
        },
      );
    });

    test(`Given a Contentful Migrator
When RunMigrations is called
And the ListAppliedMigrationsFromEnvironment method rejects
Then the method rejects with the error`, async () => {
      const expectedError = new Error("FUBAR");

      mockListAppliedMigrationsFromEnvironment.mockRejectedValue(expectedError);

      await expect(
        migrator.RunMigrations({
          migrationFilePaths,
          environmentId,
        }),
      ).rejects.toThrowError(expectedError);
    });

    test(`Given a Contentful Migrator
When RunMigrations is called
And the ListAppliedMigrationsFromEnvironment method rejects
Then no migrations are executed`, async () => {
      const error = new Error("FUBAR");

      mockListAppliedMigrationsFromEnvironment.mockRejectedValue(error);

      await expect(
        migrator.RunMigrations({
          migrationFilePaths,
          environmentId,
        }),
      ).rejects.toThrow();

      expect(mockRunMigration).not.toBeCalled();
    });

    test(`Given a Contentful Migrator
When RunMigrations is called
And the ListAppliedMigrationsFromEnvironment method rejects
Then no migrations are recorded`, async () => {
      const error = new Error("FUBAR");

      mockListAppliedMigrationsFromEnvironment.mockRejectedValue(error);

      await expect(
        migrator.RunMigrations({
          migrationFilePaths,
          environmentId,
        }),
      ).rejects.toThrow();

      expect(mockPutMigration).not.toBeCalled();
    });

    test(`Given a Contentful Migrator
When RunMigrations is called
Then runMigration is called with each new migration file in order`, async () => {
      await migrator.RunMigrations({
        migrationFilePaths,
        environmentId,
      });

      expect(mockRunMigration.mock.calls.length).toBe(3);
      expect(mockRunMigration.mock.calls[0][0]).toEqual({
        filePath: migrationFilePaths[2],
        accessToken,
        spaceId,
        environmentId,
        yes: true,
      });
      expect(mockRunMigration.mock.calls[1][0]).toEqual({
        filePath: migrationFilePaths[3],
        accessToken,
        spaceId,
        environmentId,
        yes: true,
      });
      expect(mockRunMigration.mock.calls[2][0]).toEqual({
        filePath: migrationFilePaths[4],
        accessToken,
        spaceId,
        environmentId,
        yes: true,
      });
    });

    test(`Given a Contentful Migrator
When RunMigrations is called
Then each new migration is recorded in order`, async () => {
      await migrator.RunMigrations({
        migrationFilePaths,
        environmentId,
      });

      expect(mockPutMigration.mock.calls.length).toBe(3);
      expect(mockPutMigration.mock.calls[0][0]).toEqual({
        environmentId,
        migrationId: "2022-02-24_16-32-02_migration",
      });
      expect(mockPutMigration.mock.calls[1][0]).toEqual({
        environmentId,
        migrationId: "2022-02-24_16-32-03_migration",
      });
      expect(mockPutMigration.mock.calls[2][0]).toEqual({
        environmentId,
        migrationId: "2022-02-24_16-32-04_migration",
      });
    });

    test(`Given a Contentful Migrator
When RunMigrations is called
And the name of a migration is invalid
Then it rejects with an error`, async () => {
      migrationFilePaths = ["path/to/invalid-migration-name.ts"];

      const expectedError = new Error(
        `migration ID format incorrect: migration ID must begin with a timestamp in the format YYYY-MM-DD_HH-mm-ss_ (got "invalid-migration-name")`,
      );

      await expect(
        migrator.RunMigrations({
          migrationFilePaths,
          environmentId,
        }),
      ).rejects.toThrowError(expectedError);
    });

    test(`Given a Contentful Migrator
When RunMigrations is called
Then a list of the executed migrations is resolved`, async () => {
      await expect(
        migrator.RunMigrations({
          migrationFilePaths,
          environmentId,
        }),
      ).resolves.toEqual([
        "path/to/2022-02-24_16-32-02_migration.ts",
        "path/to/2022-02-24_16-32-03_migration.ts",
        "a/different/path/to/2022-02-24_16-32-04_migration.ts",
      ]);
    });

    test(`Given a Contentful Migrator
When RunMigrations is called
And a migration function rejects
Then the method rejects with the error`, async () => {
      const expectedError = new Error("FUBAR");

      mockRunMigration.mockRejectedValue(expectedError);

      await expect(
        migrator.RunMigrations({
          migrationFilePaths,
          environmentId,
        }),
      ).rejects.toBe(expectedError);
    });

    test(`Given a Contentful Migrator
When RunMigrations is called
And recording the migration rejects
Then the method rejects with the error`, async () => {
      const expectedError = new Error("FUBAR");

      mockPutMigration.mockRejectedValue(expectedError);

      await expect(
        migrator.RunMigrations({
          migrationFilePaths,
          environmentId,
        }),
      ).rejects.toBe(expectedError);
    });

    test(`Given a Contentful Migrator
When RunMigrations is called
And a migration function rejects
Then only the successful migration is recorded
And no further migrations are executed`, async () => {
      const expectedError = new Error("FUBAR");

      mockRunMigration.mockResolvedValueOnce({});
      mockRunMigration.mockRejectedValue(expectedError);

      await expect(
        migrator.RunMigrations({
          migrationFilePaths,
          environmentId,
        }),
      ).rejects.toThrow();

      expect(mockRunMigration.mock.calls.length).toBe(2);
      expect(mockPutMigration.mock.calls.length).toBe(1);
    });

    test(`Given a Contentful Migrator
When RunMigrations is called
And recording a migration rejects
Then no further migrations are executed`, async () => {
      const expectedError = new Error("FUBAR");

      mockPutMigration.mockResolvedValueOnce(null);
      mockPutMigration.mockRejectedValue(expectedError);

      await expect(
        migrator.RunMigrations({
          migrationFilePaths,
          environmentId,
        }),
      ).rejects.toThrow();

      expect(mockRunMigration.mock.calls.length).toBe(2);
      expect(mockPutMigration.mock.calls.length).toBe(2);
    });
  });

  describe("SetEnvironmentAsMaster", () => {
    let environmentId: string;
    let existingEnvironmentAlias: object;
    let mockGetEnvironmentAlias: jest.Mock;
    let mockUpdateEnvironmentAlias: jest.Mock;

    beforeEach(() => {
      environmentId = "release";

      existingEnvironmentAlias = {
        environment: {
          sys: {
            id: "existing-master-environment",
            type: "Link",
            linkType: "Environment",
          },
        },
        sys: {
          irrelevant: "for-this",
        },
      };

      mockGetEnvironmentAlias = jest.fn();
      managementClient.environmentAlias.get = mockGetEnvironmentAlias;

      mockUpdateEnvironmentAlias = jest.fn();
      managementClient.environmentAlias.update = mockUpdateEnvironmentAlias;

      mockGetEnvironmentAlias.mockResolvedValue(existingEnvironmentAlias);

      mockUpdateEnvironmentAlias.mockResolvedValue({
        environment: {
          sys: {
            id: environmentId,
          },
        },
      });

      migrator = new ContentfulMigrator({
        runMigration,
        managementClient,
        accessToken,
        spaceId,
        recorder,
      });
    });

    test(`Given a Contentful Migrator
When SetEnvironmentAsMaster is called
Then the current master environment alias is retrieved from Contentful`, async () => {
      await migrator.SetEnvironmentAsMaster({
        environmentId,
      });

      expect(runMigration).not.toBeCalled();
      expect(mockGetEnvironmentAlias.mock.calls.length).toBe(1);
      expect(mockGetEnvironmentAlias.mock.calls[0][0]).toEqual({
        spaceId,
        environmentAliasId: "master",
      });
    });

    test(`Given a Contentful Migrator
When SetEnvironmentAsMaster is called
Then the environment ID in the environment alias returned from Contentful is updated
And the environment alias is updated on Contentful`, async () => {
      await migrator.SetEnvironmentAsMaster({
        environmentId,
      });

      expect(mockUpdateEnvironmentAlias.mock.calls.length).toBe(1);
      expect(mockUpdateEnvironmentAlias.mock.calls[0][0]).toEqual({
        spaceId,
        environmentAliasId: "master",
      });
      expect(mockUpdateEnvironmentAlias.mock.calls[0][1]).toEqual({
        environment: {
          sys: {
            id: environmentId,
            linkType: "Environment",
            type: "Link",
          },
        },
        sys: {
          irrelevant: "for-this",
        },
      });
    });

    test(`Given a Contentful Migrator
When SetEnvironmentAsMaster is called
Then the new master environment ID is resolved`, async () => {
      await expect(
        migrator.SetEnvironmentAsMaster({ environmentId }),
      ).resolves.toBe(environmentId);
    });

    test(`Given a Contentful Migrator
When SetEnvironmentAsMaster is called
And the call to Contentful get environment alias rejects
Then the method rejects with the error`, async () => {
      const expectedError = new Error("FUBAR");

      mockGetEnvironmentAlias.mockRejectedValue(expectedError);

      await expect(
        migrator.SetEnvironmentAsMaster({ environmentId }),
      ).rejects.toBe(expectedError);
    });

    test(`Given a Contentful Migrator
When SetEnvironmentAsMaster is called
And the call to Contentful get environment alias rejects
Then the Contentful update environment alias is not called`, async () => {
      const getError = new Error("FUBAR");

      mockGetEnvironmentAlias.mockRejectedValue(getError);

      await expect(
        migrator.SetEnvironmentAsMaster({ environmentId }),
      ).rejects.toThrow();

      expect(mockUpdateEnvironmentAlias).not.toBeCalled();
    });

    test(`Given a Contentful Migrator
When SetEnvironmentAsMaster is called
And the call to Contentful updated environment alias rejects
Then the method rejects with the error`, async () => {
      const expectedError = new Error("FUBAR");

      mockUpdateEnvironmentAlias.mockRejectedValue(expectedError);

      await expect(
        migrator.SetEnvironmentAsMaster({ environmentId }),
      ).rejects.toBe(expectedError);
    });
  });

  describe("DeleteEnvironment", () => {
    let environmentId: string;
    let mockDelete: jest.Mock;

    beforeEach(() => {
      environmentId = "release";

      mockDelete = jest.fn();

      managementClient.environment.delete = mockDelete;

      mockDelete.mockResolvedValue({});

      mockDeleteEnvironment.mockResolvedValue(null);

      migrator = new ContentfulMigrator({
        runMigration,
        managementClient,
        accessToken,
        spaceId,
        recorder,
      });
    });

    test(`Given a Contentful Migrator
When DeleteEnvironment is called
Then the environment is deleted in the Contentful space`, async () => {
      await migrator.DeleteEnvironment({
        environmentId,
      });

      expect(runMigration).not.toBeCalled();
      expect(mockDelete.mock.calls.length).toBe(1);
      expect(mockDelete.mock.calls[0][0]).toEqual({
        spaceId,
        environmentId,
      });
    });

    test(`Given a Contentful Migrator
When DeleteEnvironment is called
Then the environment is deleted in the recorder`, async () => {
      await migrator.DeleteEnvironment({
        environmentId,
      });

      expect(mockDeleteEnvironment.mock.calls.length).toBe(1);
      expect(mockDeleteEnvironment.mock.calls[0][0]).toEqual({
        environmentId,
      });
    });

    test(`Given a Contentful Migrator
When DeleteEnvironment is called
Then the name of the deleted environment is resolved`, async () => {
      await expect(
        migrator.DeleteEnvironment({
          environmentId,
        }),
      ).resolves.toBe(environmentId);
    });

    test(`Given a Contentful Migrator
When DeleteEnvironment is called
And the Contentful Management client rejects
Then the method rejects`, async () => {
      const expectedError = new Error("FUBAR");

      mockDelete.mockRejectedValue(expectedError);

      await expect(
        migrator.DeleteEnvironment({
          environmentId,
        }),
      ).rejects.toBe(expectedError);
    });

    test(`Given a Contentful Migrator
When DeleteEnvironment is called
And the Contentful Management client rejects
Then the environment is not deleted in the recorder`, async () => {
      const error = new Error("FUBAR");

      mockDelete.mockRejectedValue(error);

      await expect(
        migrator.DeleteEnvironment({
          environmentId,
        }),
      ).rejects.toThrow();

      expect(mockDeleteEnvironment).not.toBeCalled();
    });

    test(`Given a Contentful Migrator
When DeleteEnvironment is called
And the recorder rejects
Then the method rejects with the error`, async () => {
      const expectedError = new Error("FUBAR");

      mockDeleteEnvironment.mockRejectedValue(expectedError);

      await expect(
        migrator.DeleteEnvironment({
          environmentId,
        }),
      ).rejects.toThrowError(expectedError);
    });
  });
});
