import { IntegrationTestProps, Tester } from "../tester";

export const mockIntegrationTest: jest.Mock = jest.fn();

export class MockTester implements Tester {
  public async IntegrationTest(props: IntegrationTestProps): Promise<boolean> {
    return mockIntegrationTest(props);
  }
}
