import * as jest from "jest";
import { IntegrationTestProps, Tester } from "../tester";

export interface ContentfulTesterProps {
  testsDirectory: string;
  accessToken: string;
  spaceId: string;
}

export class ContentfulTester implements Tester {
  private readonly testsDirectory: string;
  private readonly accessToken: string;
  private readonly spaceId: string;
  private initialProcessEnvState: NodeJS.ProcessEnv;

  constructor({ testsDirectory, accessToken, spaceId }: ContentfulTesterProps) {
    this.testsDirectory = testsDirectory;
    this.accessToken = accessToken;
    this.spaceId = spaceId;
  }

  public async IntegrationTest({
    environmentId,
  }: IntegrationTestProps): Promise<boolean> {
    const args: Array<string> = [];

    const config = {
      testEnvironment: "node",
      roots: [this.testsDirectory],
      testMatch: ["**/*.test.ts"],
      transform: {
        "^.+\\.tsx?$": "ts-jest",
      },
      ci: true,
      cache: false,
      detectOpenHandles: true,
    };

    args.push("--config", JSON.stringify(config));

    let result: boolean;

    try {
      this.setTestEnvVars({
        environmentId,
      });

      await jest.run(args);

      result = true;
    } catch (e) {
      result = false;
    } finally {
      this.resetEnvVars();
    }

    return result;
  }

  private setTestEnvVars({ environmentId }: IntegrationTestProps) {
    this.initialProcessEnvState = { ...process.env };

    process.env = {
      ...process.env,
      __CONTENTFUL_ACCESS_TOKEN: this.accessToken,
      __CONTENTFUL_SPACE_ID: this.spaceId,
      __CONTENTFUL_ENVIRONMENT_ID: environmentId,
    };
  }

  private resetEnvVars() {
    process.env = { ...this.initialProcessEnvState };
  }
}
