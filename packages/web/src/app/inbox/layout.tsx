import { InboxDetailPane, InboxGridShell } from "@/components/inbox-detail-pane";

export default function InboxLayout({
  children,
  detail,
}: {
  children: React.ReactNode;
  detail: React.ReactNode;
}) {
  return (
    <InboxGridShell>
      <section className="min-w-0">{children}</section>
      <InboxDetailPane>{detail}</InboxDetailPane>
    </InboxGridShell>
  );
}
