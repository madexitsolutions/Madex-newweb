import { MadexCredit } from "@/components/admin/madex";

/** Sign-in, setup and recovery pages: the page itself plus the credit of the agency. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <footer className="a-authfoot">
        <MadexCredit />
      </footer>
    </>
  );
}
