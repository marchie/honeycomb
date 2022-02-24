# honeycomb

Experimenting with setting up Contentful in an automated way

## Pipeline steps

1. Create `<release>` environment from current `master` alias
2. Copy state record of `master` environment to a new record for the `<release>` environment
3. Perform each migration on `<release>` environment
4. Record each migration
5. Run automated integration tests against `<release>` environment
6. Change `master` alias to `<release>`
7. Run automated tests against `master`
8. **On pass**, delete previous `master` environment? **On fail**, roll back by reverting `master` alias to previous
   value?

## Dependencies

* [contentful-management](https://github.com/contentful/contentful-management.js) - for creating and deleting Contentful
  environments and switching the current `master` environment alias
* [contentful-migration](https://github.com/contentful/contentful-migration) - for creating and editing content types,
  etc.
* AWS Secrets Manager - for storing Contentful access token
* AWS Parameter Store - for storing Contentful space ID
* AWS DynamoDB - for storing state

## Gotchas

### State management

I had assumed that the `contentful-migrations` package would automatically manage its own state. (
e.g. [node-migrate](https://github.com/tj/node-migrate)
, [flyway](https://flywaydb.org/documentation/concepts/migrations))

**It does not do this!** This means that if you run a set of migrations against Contentful more than once, it will
result in an error.

For example, if you are creating a new Content Type in your migration, Contentful will return an error that the Content
Type already exists if you run that migration again.

So, we need a way of managing the current state of migrations so that we don't run those that have already been
executed.

## Useful resources

* [Deploying changes with environment aliases](https://www.contentful.com/developers/docs/tutorials/general/deploying-changes-with-environment-aliases/)
