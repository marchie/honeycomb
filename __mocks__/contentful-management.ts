export const mockCreateClient = jest.fn();

jest.mock("contentful-management", () => {
  return {
    createClient: mockCreateClient,
  };
});
