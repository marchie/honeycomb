import { createClient, PlainClientAPI } from "contentful-management";

export const ContentfulClient = (): PlainClientAPI => {
  if (
    !process.env.__CONTENTFUL_ACCESS_TOKEN ||
    !process.env.__CONTENTFUL_SPACE_ID ||
    !process.env.__CONTENTFUL_ENVIRONMENT_ID
  ) {
    throw new Error(
      "missing required runtime environment: __CONTENTFUL_ACCESS_TOKEN, __CONTENTFUL_SPACE_ID and __CONTENTFUL_ENVIRONMENT_ID are required in runtime environment",
    );
  }

  return createClient(
    {
      accessToken: process.env.__CONTENTFUL_ACCESS_TOKEN,
    },
    {
      type: "plain",
      defaults: {
        spaceId: process.env.__CONTENTFUL_SPACE_ID,
        environmentId: process.env.__CONTENTFUL_ENVIRONMENT_ID,
      },
    },
  );
};
