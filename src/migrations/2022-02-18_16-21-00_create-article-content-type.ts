import Migration, {
  MigrationContext,
  MigrationFunction,
} from "contentful-migration";

export = function (migration: Migration, context?: MigrationContext) {
  const articleContentType = migration
    .createContentType("article")
    .name("Article")
    .description("A plain article with a title, description and a body");

  const titleField = articleContentType
    .createField("title")
    .type("Symbol")
    .name("Title")
    .required(true);

  articleContentType
    .createField("description")
    .type("Symbol")
    .name("Description")
    .validations([
      {
        size: {
          max: 156,
        },
      },
    ]);

  articleContentType
    .createField("body")
    .type("Text")
    .name("Body")
    .required(true);

  articleContentType.displayField(titleField.id);
} as MigrationFunction;
