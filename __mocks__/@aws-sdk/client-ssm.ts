import { SSMClient, SSMClientConfig } from "@aws-sdk/client-ssm";

export const mockSendFn = jest.fn();

export class MockSSMClient extends SSMClient {
  constructor(props: SSMClientConfig) {
    super(props);
  }

  send = mockSendFn;
}
