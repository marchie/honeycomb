import { createClient, PlainClientAPI } from "contentful-management";

export interface ContentfulClientProps {
  accessToken: string;
}

export const Client = ({
  accessToken,
}: ContentfulClientProps): PlainClientAPI => {
  return createClient(
    {
      accessToken,
    },
    {
      type: "plain",
    },
  );
};
