import { CaptureDetail } from "@/components/capture-detail";

export const dynamic = "force-dynamic";

interface Props {
  params: { id: string };
}

export default function InterceptedCaptureDetail({ params }: Props) {
  return (
    <div data-detail-pane className="rounded-md border border-border bg-background/40 p-6">
      <CaptureDetail id={params.id} variant="pane" />
    </div>
  );
}
