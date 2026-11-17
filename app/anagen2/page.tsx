import { AnagenLandingPage, anagenLandingMetadata } from "../components/anagen-landing-page";

export const dynamic = "force-static";
export const metadata = anagenLandingMetadata("/anagen2");

export default function Anagen2Page() {
  return <AnagenLandingPage variant="lime" path="/anagen2" />;
}
