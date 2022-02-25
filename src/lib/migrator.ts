import { Tester } from "./tester";

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
  tester: Tester;
}

export interface SetEnvironmentAsMasterProps {
  environmentId: string;
}

export interface SetEnvironmentAsMasterResult {
  oldMasterEnvironmentId: string;
  newMasterEnvironmentId: string;
}

export interface DeleteEnvironmentProps {
  environmentId: string;
}

export interface Migrator {
  GetCurrentMasterEnvironmentId: () => Promise<string>;
  CreateEnvironmentFromSource: (
    props: CreateEnvironmentFromSourceProps,
  ) => Promise<string>;
  RunMigrations: (props: RunMigrationsProps) => Promise<string[]>;
  TestEnvironment: (props: TestEnvironmentProps) => Promise<boolean>;
  SetEnvironmentAsMaster: (
    props: SetEnvironmentAsMasterProps,
  ) => Promise<SetEnvironmentAsMasterResult>;
  DeleteEnvironment: (props: DeleteEnvironmentProps) => Promise<string>;
}
