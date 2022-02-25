module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/src/lib"],
  testMatch: ["**/*.test.ts"],
  transform: {
    "^.+\\.tsx?$": "ts-jest",
  },
};
