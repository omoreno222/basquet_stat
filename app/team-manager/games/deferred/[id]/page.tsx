import CaptureScreen from '../../_capture/capture-screen';

export default async function DeferredCapturePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CaptureScreen gameId={id} mode="deferred" />;
}
