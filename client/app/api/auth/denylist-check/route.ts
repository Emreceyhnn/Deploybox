import { DenylistService } from "@/app/lib/denylist";

export async function GET(request: Request) {
  const jti = request.headers.get("x-jti");

  if (!jti) {
    return Response.json({ isRevoked: false });
  }

  const isRevoked = await DenylistService.isTokenRevoked(jti);
  return Response.json({ isRevoked });
}
