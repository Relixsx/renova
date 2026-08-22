import { auth } from "../../../lib/admin-auth";

export const dynamic = "force-dynamic";
export const { GET, POST, PUT, DELETE, PATCH } = auth.handler();
