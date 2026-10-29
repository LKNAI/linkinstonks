import type { Metadata } from "next";
import { Status } from "@/components/paineis/Status";

export const metadata: Metadata = {
  title: "Status dos dados",
  description: "Saúde das fontes, defasagem e BDRs sem depositária identificada.",
};

export default function Page() {
  return <Status />;
}
