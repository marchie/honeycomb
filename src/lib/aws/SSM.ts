import {
  GetParameterCommand,
  ParameterType,
  SSMClient,
} from "@aws-sdk/client-ssm";

export interface SSMProps {
  client: SSMClient;
}

export class SSM {
  private readonly client: SSMClient;

  constructor({ client }: SSMProps) {
    this.client = client;
  }

  public async getParameterString(name: string): Promise<string> {
    const command = new GetParameterCommand({
      Name: name,
    });

    const output = await this.client.send(command);

    if (!output.Parameter) {
      throw new Error(`no SSM Parameter with name "${name}"`);
    }

    if (output.Parameter.Type !== ParameterType.STRING) {
      throw new Error(
        `invalid SSM Parameter type with name "${name}": got ${output.Parameter.Type}, want ${ParameterType.STRING}`,
      );
    }

    if (!output.Parameter.Value) {
      throw new Error(`no SSM Parameter Value with name "${name}"`);
    }

    return output.Parameter.Value;
  }
}
