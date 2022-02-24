import {
  mockSendFn,
  MockSSMClient,
} from "../../../__mocks__/@aws-sdk/client-ssm";
import {
  GetParameterCommand,
  GetParameterCommandOutput,
  ParameterType,
  SSMClient,
} from "@aws-sdk/client-ssm";
import { SSM } from "./SSM";

describe("SSM", () => {
  let name: string;
  let client: SSMClient;

  beforeAll(() => {
    name = "parameter-name";
  });

  beforeEach(() => {
    mockSendFn.mockReset();
    client = new MockSSMClient({});
  });

  describe("getParameterString", () => {
    test(`Given a configured SSM Client
When getParameterString is called with a name
Then SSM Client sends the command to AWS`, async () => {
      const expectedCommand = new GetParameterCommand({
        Name: name,
      });

      const mockOutput: GetParameterCommandOutput = {
        $metadata: {},
        Parameter: {
          Name: name,
          Type: ParameterType.STRING,
          Value: "foo",
        },
      };

      mockSendFn.mockResolvedValue(mockOutput);

      const ssm = new SSM({ client });

      await ssm.getParameterString(name);

      expect(mockSendFn.mock.calls.length).toBe(1);
      expect(JSON.stringify(mockSendFn.mock.calls[0][0])).toEqual(
        JSON.stringify(expectedCommand),
      );
    });

    test(`Given a parameter string exists on AWS SSM
When getParameterString is called with a name
Then the parameter string is resolved`, async () => {
      const expectedParameterString = "parameter-value";

      const mockOutput: GetParameterCommandOutput = {
        $metadata: {},
        Parameter: {
          Name: name,
          Type: ParameterType.STRING,
          Value: expectedParameterString,
        },
      };

      mockSendFn.mockResolvedValue(mockOutput);

      const ssm = new SSM({ client });

      await expect(ssm.getParameterString(name)).resolves.toBe(
        expectedParameterString,
      );
    });

    test(`Given the SSM Client rejects
When getParameterString is called with a name
Then it rejects with an error`, async () => {
      const expectedError = new Error("FUBAR");

      mockSendFn.mockRejectedValue(expectedError);

      const ssm = new SSM({ client });

      await expect(ssm.getParameterString(name)).rejects.toThrowError(
        expectedError,
      );
    });

    test(`Given the SSM Client returns a response without a Parameter attribute
When getParameterString is called with a name
Then it rejects with an error`, async () => {
      const expectedError = new Error(
        `no SSM Parameter with name "parameter-name"`,
      );

      const mockOutput: GetParameterCommandOutput = {
        $metadata: {},
      };

      mockSendFn.mockResolvedValue(mockOutput);

      const ssm = new SSM({ client });

      await expect(ssm.getParameterString(name)).rejects.toThrowError(
        expectedError,
      );
    });

    test(`Given the SSM Client returns a Parameter of an unexpected type
When getParameterString is called with a name
Then it rejects with an error`, async () => {
      const expectedError = new Error(
        `invalid SSM Parameter type with name "parameter-name": got SecureString, want String`,
      );

      const mockOutput: GetParameterCommandOutput = {
        $metadata: {},
        Parameter: {
          Name: name,
          Type: ParameterType.SECURE_STRING,
          Value: "encrypted",
        },
      };

      mockSendFn.mockResolvedValue(mockOutput);

      const ssm = new SSM({ client });

      await expect(ssm.getParameterString(name)).rejects.toThrowError(
        expectedError,
      );
    });

    test(`Given the SSM Client returns a Parameter with no Value
When getParameterString is called with a name
Then it rejects with an error`, async () => {
      const expectedError = new Error(
        `no SSM Parameter Value with name "parameter-name"`,
      );

      const mockOutput: GetParameterCommandOutput = {
        $metadata: {},
        Parameter: {
          Name: name,
          Type: ParameterType.STRING,
        },
      };

      mockSendFn.mockResolvedValue(mockOutput);

      const ssm = new SSM({ client });

      await expect(ssm.getParameterString(name)).rejects.toThrowError(
        expectedError,
      );
    });
  });
});
