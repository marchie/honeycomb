# honeycomb

Experimenting with setting up Contentful in an automated way

## Pipeline

### Pre-requisites

NodeJS, obviously! Plus...

1. Your Contentful space must
   have [Environment Aliases](https://www.contentful.com/developers/docs/concepts/environment-aliases/) enabled.
2. Your [Contentful Access Token](https://www.contentful.com/help/personal-access-tokens/) must be stored in AWS Secrets
   Manager.
3. Your [Contentful Space ID](https://www.contentful.com/help/find-space-id/) must be stored in AWS Systems Manager (
   SSM) Parameter Store.
4. Your DynamoDB table name must be stored in AWS Systems Manager (SSM) Parameter Store.

### Installation

To install, run:

```shell
npm install
```

### Execution

To run the pipeline from the project root using your default AWS account credentials:

```shell
npx ts-node src/bin/pipeline.ts \
  --migrationsDirectory "./src/migrations" \
  --testsDirectory "./src/integration-tests" \
  --targetEnvironmentId "<your-release-environment-id>"
```

**NOTE:** If you are operating in a multi-account AWS environment, you can use the `AWS_PROFILE` environment variable 
to specify an alternative AWS credentials to use.

### Further help

To see all options available for the pipeline, run:

```shell
npx ts-node src/bin/pipeline.ts --help
```

### Actions

The pipeline does the following:

1. Gets the **environmentId** of your current Contentful `master` environment alias.
2. Creates a new `release` environment from the current `master` environment.
3. Copies the record of migrations that have already been run on the `master` environment to a new record for
   the `release` environment in the DynamoDB table.
4. Performs each migration on the `release` environment.
5. Records each migration on the `release` environment in the DynamoDB table.
6. Runs automated integration tests against the `release` environment.
7. Changes the Contentful `master` environment alias to point to the `release` environment. (i.e. `release` environment
   becomes `master`.)
8. Runs automated integration tests against the new `master` environment.
9. Deletes the old `master` environment.
10. Deletes the record of migrations for the old `master` environment.

### Failure scenarios

If the pipeline fails, it will attempt to revert any action taken:

* If the failure occurs before the `master` environment alias is changed, the revert action attempts to delete
the `release` environment and associated records in DynamoDB.
* If the failure occurs after the `master` environment alias is changed but before the old `master` environment is
deleted (i.e. integration tests fail against the `master` environment), the revert action attempts to switch
the `master` environment alias back to the old `master` environment and then delete the `release` environment.
* If the failure occurs while deleting the old `master` environment, no revert action is taken.

## Dependencies

* [contentful-management](https://github.com/contentful/contentful-management.js) - for creating and deleting Contentful
  environments and switching the current `master` environment alias
* [contentful-migration](https://github.com/contentful/contentful-migration) - for creating and editing content types,
  etc.
* AWS Secrets Manager - for storing Contentful access token
* AWS Parameter Store - for storing Contentful space ID
* AWS DynamoDB - for storing migration state

## Gotchas

### State management

I had assumed that the `contentful-migrations` package would automatically manage its own state. (This is what typically
happens in other migrations packages; e.g. [node-migrate](https://github.com/tj/node-migrate)
, [flyway](https://flywaydb.org/documentation/concepts/migrations))

**`contentful-migrations` does not do this!** This means that if you run a set of migrations against Contentful more
than once, it will result in an error:

```shell
Validation failed


Errors in /path/to/migration.ts

Line 4: Content type with id "<id>" already exists.
 2:   MigrationContext,
 3:   MigrationFunction,
 4: } from "contentful-migration";
 5: 
 6: export = function (migration: Migration, context?: MigrationContext) {

🚨  Migration unsuccessful
```

So, we need a way of managing the current state of migrations so that we don't run those that have already been
executed.

### Migration order

One of the important things with migrations is to ensure that they are executed in order. Contentful recommends
a [forward-only migration plan](https://www.contentful.com/help/cms-as-code/#how-to-get-started) rather than the
common "up" and "down" type migrations.

In order to try and achieve this, the application expects migration file names to begin with a timestamp;
e.g. `2022-02-24_16-55-34_an-example-migration.ts`.

While this is still subject to human error, it's a fairly simple method that adds a bit of safety to the process.

## Useful resources

* [Deploying changes with environment aliases](https://www.contentful.com/developers/docs/tutorials/general/deploying-changes-with-environment-aliases/)
* ["CMS as code"](https://www.contentful.com/help/cms-as-code/)
