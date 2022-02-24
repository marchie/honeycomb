import { TestExpectedContentFields } from "../test-helpers/test-content-fields";
import { ContentTypeProps, PlainClientAPI } from "contentful-management";

describe.skip("Article", () => {
  // let contentType: ContentTypeProps;
  //
  // beforeAll(async () => {
  //   const client: PlainClientAPI
  //
  //   contentType = await client.contentType.get({
  //     contentTypeId: "article",
  //   });
  // });
  //
  // describe("Content Type", () => {
  //   const expectedName = "Article";
  //
  //   test(`name is "${expectedName}"`, () => {
  //     expect(contentType.name).toBe(expectedName);
  //   });
  //
  //   const expectedDescription =
  //     "A plain article with a title, description and a body";
  //   test(`description is "${expectedDescription}"`, () => {
  //     expect(contentType.description).toBe(expectedDescription);
  //   });
  //
  //   const expectedDisplayField = "title";
  //   test(`displayField is "${expectedDisplayField}`, () => {
  //     expect(contentType.displayField).toBe(expectedDisplayField);
  //   });
  // });
  // describe("Fields", () => {
  //   describe("Title", () => {
  //     TestExpectedContentFields(contentType, {
  //       id: "title",
  //       localized: false,
  //       required: true,
  //       name: "Title",
  //       type: "Symbol",
  //     });
  //   });
  // });
  //
  // describe("Description", () => {
  //   TestExpectedContentFields(contentType, {
  //     id: "description",
  //     localized: false,
  //     required: false,
  //     name: "Description",
  //     type: "Symbol",
  //     validations: [
  //       {
  //         size: {
  //           max: 156,
  //         },
  //       },
  //     ],
  //   });
  // });
  //
  // describe("Body", () => {
  //   TestExpectedContentFields(contentType, {
  //     id: "body",
  //     localized: false,
  //     name: "Body",
  //     required: true,
  //     type: "Text",
  //   });
  // });
});
