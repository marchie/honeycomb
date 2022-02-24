export interface CreateEnvironmentFromSourceProps {
  sourceEnvironmentId: string;
  targetEnvironmentId: string;
}

export interface RunMigrationsProps {
  migrationFilePaths: string[];
  environmentId: string;
}

export interface TestEnvironmentProps {
  environmentId: string;
  testFunction: () => Promise<boolean>;
}

export interface SetEnvironmentAsMasterProps {
  environmentId: string;
}

export interface DeleteEnvironmentProps {
  environmentId: string;
}

export interface Migrator {
  CreateEnvironmentFromSource: (
    props: CreateEnvironmentFromSourceProps,
  ) => Promise<string>;
  RunMigrations: (props: RunMigrationsProps) => Promise<string[]>;
  TestEnvironment: (props: TestEnvironmentProps) => Promise<boolean>;
  SetEnvironmentAsMaster: (
    props: SetEnvironmentAsMasterProps,
  ) => Promise<string>;
  DeleteEnvironment: (props: DeleteEnvironmentProps) => Promise<string>;
}
