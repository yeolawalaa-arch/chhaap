import Link from "next/link";
import { Button } from "@/components/ui";
import { Wordmark } from "@/components/marketing/Wordmark";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 text-center">
      <Wordmark size={32} />
      <h1 className="mt-8 text-[32px] font-semibold tracking-[-0.025em]">Page not found</h1>
      <p className="mt-2.5 text-[15px] text-muted max-w-sm leading-relaxed">
        That page doesn&rsquo;t exist, or the brand you&rsquo;re looking for is private.
      </p>
      <div className="mt-7 flex gap-3">
        <Link href="/">
          <Button variant="outline">Home</Button>
        </Link>
        <Link href="/dashboard">
          <Button variant="secondary">My Brands</Button>
        </Link>
      </div>
    </div>
  );
}
