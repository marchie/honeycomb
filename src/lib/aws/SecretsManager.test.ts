import {
  MockSecretsManagerClient,
  mockSendFn,
} from "../../../__mocks__/@aws-sdk/client-secrets-manager";
import {
  GetSecretValueCommand,
  GetSecretValueCommandOutput,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { SecretsManager } from "./SecretsManager";

describe("SecretsManager", () => {
  let secretId: string;
  let client: SecretsManagerClient;

  beforeAll(() => {
    secretId = "secret-id";
  });

  beforeEach(() => {
    mockSendFn.mockReset();
    client = new MockSecretsManagerClient({});
  });

  describe("getSecretString", () => {
    test(`Given a configured Secrets Manager Client
When getSecretString is called with a secretId
Then Secrets Manager Client sends the command to AWS`, async () => {
      const expectedCommand = new GetSecretValueCommand({
        SecretId: secretId,
      });

      const mockOutput: GetSecretValueCommandOutput = {
        $metadata: {},
        SecretString: "foo",
      };

      mockSendFn.mockResolvedValue(mockOutput);

      const secretsManager = new SecretsManager({ client });

      await secretsManager.getSecretString(secretId);

      expect(mockSendFn.mock.calls.length).toBe(1);
      expect(JSON.stringify(mockSendFn.mock.calls[0][0])).toEqual(
        JSON.stringify(expectedCommand),
      );
    });

    test(`Given a secret string exists on AWS Secrets Manager
When getSecretString is called with a secretId
Then the secret string is resolved`, async () => {
      const expectedSecretString = "secret-value";

      const mockOutput: GetSecretValueCommandOutput = {
        $metadata: {},
        SecretString: expectedSecretString,
      };

      mockSendFn.mockResolvedValue(mockOutput);

      const secretsManager = new SecretsManager({ client });

      await expect(secretsManager.getSecretString(secretId)).resolves.toBe(
        expectedSecretString,
      );
    });

    test(`Given the Secrets Manager Client rejects
When getSecretString is called with a secretId
Then it rejects with an error`, async () => {
      const expectedError = new Error("FUBAR");

      mockSendFn.mockRejectedValue(expectedError);

      const secretsManager = new SecretsManager({ client });

      await expect(
        secretsManager.getSecretString(secretId),
      ).rejects.toThrowError(expectedError);
    });

    test(`Given the Secrets Manager Client returns a Secret with no Value
When getSecretString is called with a secretId
Then it rejects with an error`, async () => {
      const expectedError = new Error(`no SecretString with ID "secret-id"`);

      const mockOutput: GetSecretValueCommandOutput = {
        $metadata: {},
      };

      mockSendFn.mockResolvedValue(mockOutput);

      const secretsManager = new SecretsManager({ client });

      await expect(
        secretsManager.getSecretString(secretId),
      ).rejects.toThrowError(expectedError);
    });
  });
});
