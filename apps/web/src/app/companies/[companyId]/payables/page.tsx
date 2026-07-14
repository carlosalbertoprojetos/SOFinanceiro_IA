"use client";

import { useParams } from "next/navigation";

import { PayablesScreen } from "../../../../components/payables-screen";

export default function PayablesPage(): React.JSX.Element {
  const params = useParams<{ companyId: string }>();
  return <PayablesScreen companyId={params.companyId ?? ""} />;
}
