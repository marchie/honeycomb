export interface IntegrationTestProps {
  environmentId: string;
}

export interface Tester {
  IntegrationTest(props: IntegrationTestProps): Promise<boolean>;
}
