import { redirect } from "next/navigation";

// The landing page lived here before it was promoted to the root. Kept as a
// redirect rather than deleted: the URL was shared while it sat at /welcome,
// and a 404 is a worse answer than the page they were looking for.
export default function WelcomeRedirect() {
  redirect("/");
}
