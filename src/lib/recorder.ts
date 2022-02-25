export interface CreateEnvironmentFromSourceProps {
  sourceEnvironmentId: string;
  targetEnvironmentId: string;
}

export interface ListAppliedMigrationsForEnvironmentProps {
  environmentId: string;
}

export interface PutMigrationProps {
  environmentId: string;
  migrationId: string;
}

export interface DeleteEnvironmentProps {
  environmentId: string;
}

export interface Recorder {
  CreateEnvironmentFromSource: (
    props: CreateEnvironmentFromSourceProps,
  ) => Promise<void>;
  ListAppliedMigrationsForEnvironment: (
    props: ListAppliedMigrationsForEnvironmentProps,
  ) => Promise<Set<String>>;
  PutMigration: (props: PutMigrationProps) => Promise<void>;
  DeleteEnvironment: (props: DeleteEnvironmentProps) => Promise<void>;
}
