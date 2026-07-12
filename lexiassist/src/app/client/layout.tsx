export default function ClientLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <>
      {/* This renders normal client dashboard (page.tsx) */}
      {children} 
      
      {/* This renders the upload modal OVER the dashboard when triggered */}
      {modal} 
    </>
  );
}