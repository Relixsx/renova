export async function GET() {
  return Response.json({ error: "Legacy R2 media URLs are unavailable after the Cloudinary migration." }, { status: 410 });
}
