export default function InboxLayout({
  children,
  detail,
}: {
  children: React.ReactNode;
  detail: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[1600px]">
      <div className="grid grid-cols-1 gap-6 has-[[data-detail-pane]]:lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
        <section className="min-w-0">{children}</section>
        <aside className="hidden min-w-0 has-[[data-detail-pane]]:lg:block">
          <div className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto">
            {detail}
          </div>
        </aside>
      </div>
    </div>
  );
}
