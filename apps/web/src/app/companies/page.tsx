import { redirect } from "next/navigation";

import { CompanySelector } from "../../components/company-selector";
import { getAuth0Client } from "../../lib/auth0";

export default async function CompaniesPage(): Promise<React.JSX.Element> {
  const session = await getAuth0Client().getSession();
  if (!session) redirect("/auth/login?returnTo=%2Fcompanies");
  return (
    <CompanySelector
      userName={session.user.name ?? session.user.email ?? "Usuário"}
    />
  );
}
