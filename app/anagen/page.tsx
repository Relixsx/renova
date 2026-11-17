import { AnagenLandingPage, anagenLandingMetadata } from "../components/anagen-landing-page";

export const dynamic = "force-static";
export const metadata = anagenLandingMetadata("/anagen");

export default function AnagenPage() {
  return <AnagenLandingPage variant="gold" path="/anagen" />;
}
