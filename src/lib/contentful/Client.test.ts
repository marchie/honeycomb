import { mockCreateClient } from "../../../__mocks__/contentful-management";
import { Client } from "./Client";

describe("Contentful Client", () => {
  test(`Given a Contentful access token
  When Client is called
  Then a Contentful PlainClientAPI management client is returned`, () => {
    const accessToken = "abc123";

    Client({ accessToken });

    expect(mockCreateClient.mock.calls.length).toBe(1);
    expect(mockCreateClient.mock.calls[0][0]).toEqual({
      accessToken,
    });
    expect(mockCreateClient.mock.calls[0][1]).toEqual({
      type: "plain",
    });
  });
});
