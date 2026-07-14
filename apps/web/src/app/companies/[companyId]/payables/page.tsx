import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { PayablesScreen } from "../../../../components/payables-screen";
import { getAuth0Client } from "../../../../lib/auth0";

export default async function PayablesPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}): Promise<React.JSX.Element> {
  const session = await getAuth0Client().getSession();
  const { companyId } = await params;
  if (!session) {
    const returnTo = encodeURIComponent(`/companies/${companyId}/payables`);
    redirect(`/auth/login?returnTo=${returnTo}`);
  }
  const store = await cookies();
  const companyName =
    store.get("sofia_active_company")?.value === companyId
      ? store.get("sofia_active_company_name")?.value
      : undefined;
  return (
    <PayablesScreen
      companyId={companyId}
      companyName={companyName}
      userName={session.user.name ?? session.user.email ?? "Usuário"}
    />
  );
}
