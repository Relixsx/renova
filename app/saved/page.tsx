import { SavedCollections } from "../components/shopper-tools";
import { StoreFrame } from "../components/storefront";
export default function SavedPage() { return <StoreFrame><section className="page-hero small"><span className="eyebrow">Your shopping tools</span><h1>Save, revisit, compare.</h1><p>Your choices stay private on this device.</p></section><SavedCollections /></StoreFrame>; }
