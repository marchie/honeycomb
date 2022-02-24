import { ContentFields, ContentTypeProps } from "contentful-management";

export function TestExpectedContentFields(
  contentType: ContentTypeProps,
  expectedContentFields: ContentFields,
): void {
  const field = contentType.fields.find(
    ({ id }) => id === expectedContentFields.id,
  );
  if (!field) {
    throw new Error(`field ${expectedContentFields.id} does not exist`);
  }

  for (const [key, val] of Object.entries(expectedContentFields)) {
    test(`${key} is "${val}`, () => {
      expect(field[key as keyof ContentFields]).toEqual(val);
    });
  }
}
