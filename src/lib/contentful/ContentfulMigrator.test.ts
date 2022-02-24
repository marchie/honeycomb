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
  });

  describe("CreateEnvironmentFromSource", () => {
    let sourceEnvironmentId: string;
    let targetEnvironmentId: string;
    let mockCreateWithId: jest.Mock;

    beforeEach(() => {
      migrator = new ContentfulMigrator({
        runMigration,
        managementClient,
        accessToken,
        spaceId,
        recorder,
      });

      sourceEnvironmentId = "master";
      targetEnvironmentId = "release";

      mockCreateWithId = jest.fn();
      managementClient.environment.createWithId = mockCreateWithId;
    });

    test(`Given a Contentful Migrator
When CreateEnvironmentFromSource is called
Then a new environment is created in the Contentful space`, async () => {
      mockCreateWithId.mockResolvedValue({
        name: targetEnvironmentId,
      });

      mockCreateEnvironmentFromSource.mockResolvedValue(null);

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
      expect(mockCreateEnvironmentFromSource.mock.calls.length).toBe(1);
      expect(mockCreateEnvironmentFromSource.mock.calls[0][0]).toBe({
        sourceEnvironmentId,
        targetEnvironmentId,
      });
    });

    test(`Given a Contentful Migrator
When CreateEnvironmentFromSource is called
Then the name of the created environment is resolved`, async () => {
      mockCreateWithId.mockResolvedValue({
        name: targetEnvironmentId,
      });

      mockCreateEnvironmentFromSource.mockResolvedValue(null);

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
And the recorder method is not called
Then the method rejects`, async () => {
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

      mockCreateWithId.mockResolvedValue({
        name: targetEnvironmentId,
      });

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

  describe("RunMigrationFunctions", () => {
    let migrationFunctions: MigrationFunction[];
    let environmentId: string;
    let answerYesToAllPrompts: boolean;
    let mockRunMigration: jest.Mock;
    let mockGetEnvironment: jest.Mock;

    beforeEach(() => {
      mockRunMigration = jest.fn();

      migrator = new ContentfulMigrator({
        runMigration: mockRunMigration,
        managementClient,
        accessToken,
        spaceId,
        recorder,
      });

      migrationFunctions = [jest.fn()];
      environmentId = "release";
      answerYesToAllPrompts = true;

      mockGetEnvironment = jest.fn();
      managementClient.environment.get = mockGetEnvironment;
    });

    test(`Given a Contentful Migrator
When RunMigrationFunctions is called
Then the environment is retrieved from Contentful`, async () => {
      mockGetEnvironment.mockResolvedValue({
        sys: {},
      });

      await migrator.RunMigrations({
        migrationFunctions,
        environmentId,
      });

      expect(mockGetEnvironment.mock.calls.length).toBe(1);
      expect(mockGetEnvironment.mock.calls[0][0]).toEqual({
        spaceId,
        environmentId,
      });
    });

    test(`Given a Contentful Migrator
When RunMigrationFunctions is called
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
          migrationFunctions,
          environmentId,
        }),
      ).rejects.toThrowError(
        `cannot run migrations on environment "${environmentId}": environment is the current master environment`,
      );
    });

    test(`Given a Contentful Migrator
When RunMigrationFunctions is called
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
          migrationFunctions,
          environmentId,
        }),
      ).rejects.toThrow();

      expect(mockRunMigration).not.toBeCalled();
    });

    test(`Given a Contentful Migrator
And one migration function
When RunMigrationFunctions is called
And the provided environment ID is not the master environment
Then runMigration is called with the migration function`, async () => {
      mockGetEnvironment.mockResolvedValue({
        sys: {},
      });

      const migrationFunctions: MigrationFunction[] = [
        () => {
          return Promise.resolve(0);
        },
      ];

      await migrator.RunMigrations({
        migrationFunctions,
        environmentId,
      });

      expect(mockRunMigration.mock.calls.length).toBe(1);
      expect(mockRunMigration.mock.calls[0][0]).toEqual({
        migrationFunction: migrationFunctions[0],
        accessToken,
        spaceId,
        environmentId,
        yes: answerYesToAllPrompts,
      });
    });

    test(`Given a Contentful Migrator
And multiple migration functions
When RunMigrationFunctions is called
Then runMigration is called with each migration function in order`, async () => {
      mockGetEnvironment.mockResolvedValue({
        sys: {},
      });

      const migrationFunctions: MigrationFunction[] = [
        () => {
          return Promise.resolve(0);
        },
        () => {
          return Promise.resolve(1);
        },
        () => {
          return Promise.resolve(2);
        },
      ];

      await migrator.RunMigrations({
        migrationFunctions,
        environmentId,
      });

      expect(mockRunMigration.mock.calls.length).toBe(3);
      expect(mockRunMigration.mock.calls[0][0]).toEqual({
        migrationFunction: migrationFunctions[0],
        accessToken,
        spaceId,
        environmentId,
        yes: answerYesToAllPrompts,
      });
      expect(mockRunMigration.mock.calls[1][0]).toEqual({
        migrationFunction: migrationFunctions[1],
        accessToken,
        spaceId,
        environmentId,
        yes: answerYesToAllPrompts,
      });
      expect(mockRunMigration.mock.calls[2][0]).toEqual({
        migrationFunction: migrationFunctions[2],
        accessToken,
        spaceId,
        environmentId,
        yes: answerYesToAllPrompts,
      });
    });

    test(`Given a Contentful Migrator
When RunMigrationFunctions is called
And a migration function rejects
Then the method rejects with the error`, async () => {
      mockGetEnvironment.mockResolvedValue({
        sys: {},
      });

      const expectedError = new Error("FUBAR");

      mockRunMigration.mockRejectedValue(expectedError);

      const migrationFunctions: MigrationFunction[] = [
        () => {
          return Promise.resolve(0);
        },
      ];

      await expect(
        migrator.RunMigrations({
          migrationFunctions,
          environmentId,
        }),
      ).rejects.toBe(expectedError);
    });

    test(`Given a Contentful Migrator
And multiple migrations
When RunMigrationFunctions is called
And a migration function rejects
Then no further migrations are executed`, async () => {
      mockGetEnvironment.mockResolvedValue({
        sys: {},
      });

      const expectedError = new Error("FUBAR");

      mockRunMigration.mockResolvedValueOnce({});
      mockRunMigration.mockRejectedValue(expectedError);

      const migrationFunctions: MigrationFunction[] = [
        () => {
          return Promise.resolve(0);
        },
        () => {
          return Promise.reject(1);
        },
        () => {
          return Promise.resolve(2);
        },
      ];

      await expect(
        migrator.RunMigrationFunctions({
          migrationFunctions,
          spaceId,
          environmentId,
          answerYesToAllPrompts,
        }),
      ).rejects.toThrow();

      expect(mockRunMigration.mock.calls.length).toBe(2);
      expect(mockRunMigration.mock.calls[0][0]).toEqual({
        migrationFunction: migrationFunctions[0],
        accessToken,
        spaceId,
        environmentId,
        yes: answerYesToAllPrompts,
      });
      expect(mockRunMigration.mock.calls[1][0]).toEqual({
        migrationFunction: migrationFunctions[1],
        accessToken,
        spaceId,
        environmentId,
        yes: answerYesToAllPrompts,
      });
    });
  });

  describe("SetEnvironmentAsMaster", () => {
    let environmentId: string;
    let existingEnvironmentAlias: object;
    let mockGetEnvironmentAlias: jest.Mock;
    let mockUpdateEnvironmentAlias: jest.Mock;

    beforeEach(() => {
      migrator = new ContentfulMigrator({
        runMigration,
        managementClient,
        accessToken,
        spaceId,
        recorder,
      });

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
    });

    test(`Given a Contentful Migrator
When SetEnvironmentAsMaster is called
Then the current master environment alias is retrieved from Contentful`, async () => {
      mockGetEnvironmentAlias.mockResolvedValue(existingEnvironmentAlias);

      mockUpdateEnvironmentAlias.mockResolvedValue({
        environment: {
          sys: {
            id: environmentId,
          },
        },
      });

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
      mockGetEnvironmentAlias.mockResolvedValue(existingEnvironmentAlias);

      mockUpdateEnvironmentAlias.mockResolvedValue({
        environment: {
          sys: {
            id: environmentId,
          },
        },
      });

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
      mockGetEnvironmentAlias.mockResolvedValue(existingEnvironmentAlias);

      mockUpdateEnvironmentAlias.mockResolvedValue({
        environment: {
          sys: {
            id: environmentId,
          },
        },
      });

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

      mockGetEnvironmentAlias.mockResolvedValue(existingEnvironmentAlias);

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
      migrator = new ContentfulMigrator({
        runMigration,
        managementClient,
        accessToken,
        spaceId,
        recorder,
      });

      environmentId = "release";

      mockDelete = jest.fn();

      managementClient.environment.delete = mockDelete;
    });

    test(`Given a Contentful Migrator
When DeleteEnvironment is called
Then the environment is deleted in the Contentful space`, async () => {
      mockDelete.mockResolvedValue({});

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
Then the name of the deleted environment is resolved`, async () => {
      mockDelete.mockResolvedValue({});

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
  });
});
