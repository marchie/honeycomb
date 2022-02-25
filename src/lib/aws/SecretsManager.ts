import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";

export interface SecretsManagerProps {
  client: SecretsManagerClient;
}

export class SecretsManager {
  private readonly client: SecretsManagerClient;

  constructor({ client }: SecretsManagerProps) {
    this.client = client;
  }

  public async getSecretString(id: string): Promise<string> {
    const command = new GetSecretValueCommand({
      SecretId: id,
    });

    const output = await this.client.send(command);

    if (!output.SecretString) {
      throw new Error(`no SecretString with ID "${id}"`);
    }

    return output.SecretString;
  }
}
