import {
  CreateEnvironmentFromSourceProps,
  DeleteEnvironmentProps,
  ListAppliedMigrationsForEnvironmentProps,
  PutMigrationProps,
  Recorder,
} from "../recorder";

export const mockCreateEnvironmentFromSource = jest.fn();
export const mockDeleteEnvironment = jest.fn();
export const mockListAppliedMigrationsFromEnvironment = jest.fn();
export const mockPutMigration = jest.fn();

export class MockRecorder {
  async CreateEnvironmentFromSource(props: CreateEnvironmentFromSourceProps) {
    return mockCreateEnvironmentFromSource(props);
  }

  async DeleteEnvironment(props: DeleteEnvironmentProps) {
    return mockDeleteEnvironment(props);
  }

  async ListAppliedMigrationsForEnvironment(
    props: ListAppliedMigrationsForEnvironmentProps,
  ) {
    return mockListAppliedMigrationsFromEnvironment(props);
  }

  async PutMigration(props: PutMigrationProps): Promise<void> {
    return mockPutMigration(props);
  }
}
