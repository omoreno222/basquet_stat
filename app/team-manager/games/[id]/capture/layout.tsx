'use client';

export default function CaptureLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="capture-page">
      {children}
      <style jsx global>{`
        .capture-page ~ footer {
          display: none;
        }
      `}</style>
    </div>
  );
}
