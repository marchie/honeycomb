import {
  SecretsManagerClient,
  SecretsManagerClientConfig,
} from "@aws-sdk/client-secrets-manager";

export const mockSendFn = jest.fn();

export class MockSecretsManagerClient extends SecretsManagerClient {
  constructor(props: SecretsManagerClientConfig) {
    super(props);
  }

  send = mockSendFn;
}
