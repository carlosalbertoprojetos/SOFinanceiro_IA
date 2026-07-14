import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getAuth0Client } from "../../../../lib/auth0";

type Company = { id: string; name: string };

export async function POST(request: Request): Promise<NextResponse> {
  const requestUrl = new URL(request.url);
  if (request.headers.get("origin") !== requestUrl.origin) {
    return NextResponse.json(
      { message: "Origin not allowed" },
      { status: 403 },
    );
  }
  let companyId: string;
  try {
    const body = (await request.json()) as { companyId?: unknown };
    if (typeof body.companyId !== "string" || !body.companyId)
      throw new Error();
    companyId = body.companyId;
  } catch {
    return NextResponse.json(
      { message: "Invalid company preference" },
      { status: 400 },
    );
  }

  try {
    const { token } = await getAuth0Client().getAccessToken();
    const response = await fetch(
      new URL(
        "/api/v1/me/companies",
        process.env.API_INTERNAL_URL ?? "http://localhost:3001",
      ),
      { cache: "no-store", headers: { Authorization: `Bearer ${token}` } },
    );
    if (!response.ok)
      return NextResponse.json(
        { message: "Access denied" },
        { status: response.status },
      );
    const { companies } = (await response.json()) as { companies: Company[] };
    const selectedCompany = companies.find(
      (company) => company.id === companyId,
    );
    if (!selectedCompany) {
      return NextResponse.json({ message: "Access denied" }, { status: 404 });
    }
    const store = await cookies();
    store.set("sofia_active_company", companyId, {
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    store.set("sofia_active_company_name", selectedCompany.name, {
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    return NextResponse.json({ selected: true });
  } catch {
    return NextResponse.json(
      { message: "Authentication required" },
      { status: 401 },
    );
  }
}
